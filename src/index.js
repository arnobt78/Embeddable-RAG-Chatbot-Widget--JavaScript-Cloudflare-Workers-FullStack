/** 
 * AI Chatbot Widget - Cloudflare Worker
 * 
 * This Worker serves as both the API backend and static asset server for the chatbot widget.
 * It handles:
 * - RAG (Retrieval Augmented Generation) using Vectorize for FAQ search
 * - Session management via KV storage
 * - Streaming AI responses using Workers AI (free-plan chat + embedding models)
 * - Static asset serving with aggressive caching
 * - Sentry error reporting (@sentry/cloudflare) + POST /api/monitoring tunnel for browser SDK
 */
import * as Sentry from "@sentry/cloudflare";

// Workers AI model IDs (centralized — swap here only when Cloudflare catalog changes)
// Chat: @cf/meta/llama-3-8b-instruct was deprecated 2026-05-30; -fast variant remains active on free plan
const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
// Free-plan fallback if primary fails (capacity / 403 / transient) — still Workers AI only, no external keys
const CHAT_MODEL_FALLBACK = "@cf/zai-org/glm-4.7-flash";
// Tried in order until env.AI.run(stream) succeeds
const CHAT_MODELS = [CHAT_MODEL, CHAT_MODEL_FALLBACK];
// Embeddings: 768-d BGE — keep stable so Vectorize index dimensions stay compatible
const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";

// System prompt for the AI model - defines the assistant's behavior
const SYS = `You are a helpful customer support assistant. Be friendly, professional, and concise. Use the FAQ context to give accurate answers. If you don't know something, say so.`;

// TTL (Time To Live) for session storage: 30 days in seconds
const TTL = 30 * 24 * 60 * 60;

// Chat abuse cap: Rate Limiting binding window (seconds) — must match wrangler.jsonc period
const CHAT_RATE_WINDOW_S = 60;

// Max envelope size for POST /api/monitoring (ad-blocker bypass tunnel) — reject oversized abuse
const MAX_MONITOR_BYTES = 256 * 1024;

// CORS headers - allows cross-origin requests from any domain
const cors = { "Access-Control-Allow-Origin": "*" };

// Helper function to create JSON responses with CORS headers
const json = (d, s = 200, h = {}) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json", ...cors, ...h },
  });

// Extract session ID from cookie header
const cookie = (r) =>
  r.headers.get("Cookie")?.match(/chatbot_session=([^;]+)/)?.[1];

/**
 * Client IP for rate limiting (Cloudflare sets CF-Connecting-IP on the edge).
 * @param {Request} req
 * @returns {string}
 */
function clientIp(req) {
  return req.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

/**
 * Timing-safe-ish string equality via SHA-256 digests (Workers-compatible).
 * @param {string} a
 * @param {string} b
 * @returns {Promise<boolean>}
 */
async function secretsEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const ua = new Uint8Array(ha);
  const ub = new Uint8Array(hb);
  if (ua.length !== ub.length) return false;
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

/**
 * Extract seed token from Authorization: Bearer … or X-Seed-Secret.
 * @param {Request} req
 * @returns {string}
 */
function seedTokenFrom(req) {
  const auth = req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  return (req.headers.get("X-Seed-Secret") || "").trim();
}

/**
 * Fail-closed auth for POST /api/seed (REQ-0011).
 * @param {Request} req
 * @param {Object} env
 * @returns {Promise<Response|null>} Error Response, or null if authorized
 */
async function assertSeedAuth(req, env) {
  if (!env.SEED_SECRET) {
    return json({ error: "Seed not configured" }, 503);
  }
  const token = seedTokenFrom(req);
  if (!token || !(await secretsEqual(token, env.SEED_SECRET))) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

/**
 * Chat rate limit via Workers Rate Limiting binding (CHAT_LIMITER).
 * Replaces racy KV get/put counters — limit() is atomic within a Cloudflare colo.
 * Per-colo (not global billing accounting); suitable for abuse prevention on a public widget.
 * Key = client IP (anonymous embed has no user id).
 *
 * @param {Request} req
 * @param {Object} env
 * @returns {Promise<Response|null>} 429 Response when over limit, else null
 */
async function assertChatRateLimit(req, env) {
  if (!env.CHAT_LIMITER) {
    console.error("CHAT_LIMITER binding missing — check wrangler.jsonc ratelimits");
    return json({ error: "Rate limiter not configured" }, 503);
  }
  const { success } = await env.CHAT_LIMITER.limit({ key: clientIp(req) });
  if (!success) {
    return json(
      { error: "Too many requests", retryAfter: CHAT_RATE_WINDOW_S },
      429,
      { "Retry-After": String(CHAT_RATE_WINDOW_S) },
    );
  }
  return null;
}

/**
 * Parse Sentry DSN → ingest host + project id (used by tunnel allowlist).
 * @param {string} dsn
 * @returns {{ host: string, projectId: string } | null}
 */
function parseSentryDsn(dsn) {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "").split("/")[0];
    if (!u.hostname || !projectId) return null;
    return { host: u.hostname, projectId };
  } catch {
    return null;
  }
}

/**
 * Report exception to Sentry when DSN is configured (no-op otherwise).
 * @param {unknown} err
 * @param {Record<string, unknown>} [extra]
 */
function captureErr(err, extra) {
  try {
    Sentry.captureException(err, extra ? { extra } : undefined);
  } catch {
    // Never let observability break the Worker response path
  }
}

/**
 * POST /api/monitoring — same-origin Sentry envelope tunnel (bypasses ad blockers).
 * Allowlists host + project id from env.SENTRY_DSN only (not an open proxy).
 *
 * @param {Request} req
 * @param {Object} env
 * @returns {Promise<Response>}
 */
async function monitoring(req, env) {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: cors });

  if (!env.SENTRY_DSN) {
    return json({ error: "Monitoring not configured" }, 503);
  }

  const allowed = parseSentryDsn(env.SENTRY_DSN);
  if (!allowed) {
    return json({ error: "Invalid SENTRY_DSN" }, 503);
  }

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_MONITOR_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  let envelopeBytes;
  try {
    envelopeBytes = await req.arrayBuffer();
  } catch (err) {
    captureErr(err, { route: "/api/monitoring", phase: "read" });
    return json({ error: "Bad request" }, 400);
  }

  if (envelopeBytes.byteLength > MAX_MONITOR_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  try {
    const envelope = new TextDecoder().decode(envelopeBytes);
    const headerLine = envelope.split("\n")[0];
    const header = JSON.parse(headerLine);
    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace(/^\//, "").split("/")[0];

    if (dsn.hostname !== allowed.host || projectId !== allowed.projectId) {
      return json({ error: "Invalid DSN" }, 403);
    }

    const upstream = `https://${allowed.host}/api/${projectId}/envelope/`;
    const upstreamRes = await fetch(upstream, {
      method: "POST",
      body: envelopeBytes,
      headers: {
        "Content-Type":
          req.headers.get("Content-Type") || "application/x-sentry-envelope",
      },
    });

    // Pass through Sentry status; empty body is fine for the browser SDK
    return new Response(null, {
      status: upstreamRes.status,
      headers: cors,
    });
  } catch (err) {
    console.error("monitoring tunnel failed:", err);
    captureErr(err, { route: "/api/monitoring" });
    return json({ error: "Tunnel failed" }, 500);
  }
}

/**
 * Cache-Control for static assets: short TTL for HTML/robots; long for JS/CSS.
 * @param {string} pathname
 * @returns {string}
 */
function assetCacheControl(pathname) {
  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/robots.txt"
  ) {
    return "public, max-age=3600";
  }
  return "public, max-age=31536000, immutable";
}

/**
 * Start a streaming Workers AI chat completion, trying CHAT_MODELS in order.
 * Falls over immediately on run() failure (model down / capacity / paid-only / etc.).
 * Mid-stream errors cannot switch models after bytes are already sent to the client.
 *
 * @param {Object} env - Cloudflare environment bindings (AI)
 * @param {Array<{role: string, content: string}>} messages - Chat messages for the model
 * @returns {Promise<ReadableStream>} - SSE stream from the first model that starts successfully
 */
async function runChatStream(env, messages) {
  let lastErr;
  for (const model of CHAT_MODELS) {
    try {
      const stream = await env.AI.run(model, { messages, stream: true });
      if (model !== CHAT_MODELS[0]) {
        console.warn("CHAT_MODEL primary failed; using fallback:", model);
      }
      return stream;
    } catch (err) {
      lastErr = err;
      console.error("Workers AI chat failed for model", model, err);
    }
  }
  throw lastErr || new Error("All CHAT_MODELS failed");
}

/**
 * RAG (Retrieval Augmented Generation) function
 * 
 * This function implements the RAG pattern:
 * 1. Converts the user's question into an embedding vector using Workers AI
 * 2. Searches Vectorize index for similar FAQ entries (semantic search)
 * 3. Returns the top 3 most relevant Q&A pairs as context for the AI
 * 
 * @param {Object} env - Cloudflare environment bindings (AI, VECTORIZE)
 * @param {string} q - User's question
 * @returns {string} - Formatted FAQ context or empty string if no matches
 */
async function faq(env, q) {
  try {
    // Generate embedding vector for the question using BGE model (EMBED_MODEL)
    const e = await env.AI.run(EMBED_MODEL, { text: [q] });
    if (!e.data) return "";
    
    // Query Vectorize index for similar vectors (semantic search)
    // topK: 3 means return top 3 most similar FAQ entries
    const r = await env.VECTORIZE.query(e.data[0], {
      topK: 3,
      returnMetadata: "all",
    });
    
    // Format matches as Q&A pairs for the AI context
    return r.matches
      .map((m) => `Q: ${m.metadata?.question}\nA: ${m.metadata?.answer}`)
      .join("\n\n");
  } catch (err) {
    // Log + Sentry; degrade gracefully so chat still streams without FAQ context
    console.error("RAG faq() failed:", err);
    captureErr(err, { route: "faq" });
    return "";
  }
}

/**
 * Chat API endpoint handler
 * 
 * This function handles the complete chat flow:
 * 1. Validates request and extracts message
 * 2. Manages session (creates new or retrieves existing from KV)
 * 3. Retrieves relevant FAQ context using RAG
 * 4. Streams AI response using Workers AI (CHAT_MODELS with instant fallback)
 * 5. Saves conversation history to KV storage
 * 
 * Uses Server-Sent Events (SSE) for real-time streaming responses.
 * 
 * @param {Request} req - HTTP request object
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Response} - SSE stream response
 */
async function chat(req, env) {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  // Cap abuse / Workers AI cost (REQ-0012) before parsing body
  const limited = await assertChatRateLimit(req, env);
  if (limited) return limited;

  const { message } = await req.json();
  if (!message?.trim()) return json({ error: "Message required" }, 400);

  // Session management: get existing session or create new one
  let sid = cookie(req),
    isNew = !sid;
  let sess = sid ? await env.CHAT_SESSIONS.get(sid, "json") : null;
  if (!sess) {
    sid = "sess_" + crypto.randomUUID();
    sess = {
      id: sid,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    isNew = true;
  }

  // Add user message to session
  sess.messages.push({
    role: "user",
    content: message.trim(),
    timestamp: Date.now(),
  });
  
  // Retrieve relevant FAQ context using RAG (semantic search)
  const ctx = await faq(env, message);
  
  // Build message array for AI:
  // - System prompt with FAQ context (if available)
  // - Last 10 messages for conversation context (prevents token limit issues)
  const msgs = [
    { role: "system", content: SYS + (ctx ? `\n\nFAQ:\n${ctx}` : "") },
    ...sess.messages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  // Stream via primary chat model; on failure immediately try fallback (Workers AI only)
  let stream;
  try {
    stream = await runChatStream(env, msgs);
  } catch (err) {
    console.error("All chat models failed:", err);
    // Notify operator when demo AI path is fully down (primary + fallback)
    captureErr(err, { route: "/api/chat", models: CHAT_MODELS });
    return json({ error: "AI temporarily unavailable" }, 503);
  }
  
  // Transform stream to accumulate full response while streaming
  let full = "";
  const { readable, writable } = new TransformStream({
    transform(chunk, ctrl) {
      // Parse SSE format: "data: {...}" lines
      for (const ln of new TextDecoder().decode(chunk).split("\n"))
        if (ln.startsWith("data: ") && ln.slice(6) !== "[DONE]")
          try {
            full += JSON.parse(ln.slice(6)).response || "";
          } catch {
            // Intentional: skip malformed SSE data lines without aborting the stream
          }
      ctrl.enqueue(chunk);
    },
    async flush() {
      // Save complete response to session after streaming completes
      if (full) {
        sess.messages.push({
          role: "assistant",
          content: full,
          timestamp: Date.now(),
        });
        sess.updatedAt = Date.now();
        await env.CHAT_SESSIONS.put(sid, JSON.stringify(sess), {
          expirationTtl: TTL,
        });
      }
    },
  });
  stream.pipeTo(writable);
  
  // Return SSE stream response
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      ...cors,
      // Set cookie for new sessions
      ...(isNew
        ? {
            "Set-Cookie": `chatbot_session=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL}`,
          }
        : {}),
    },
  });
}

/**
 * Seed API endpoint - Populates Vectorize index with FAQ embeddings
 * 
 * This function:
 * 1. Takes an array of FAQ pairs (question, answer)
 * 2. Generates embeddings for each FAQ using Workers AI
 * 3. Upserts embeddings + metadata into Vectorize index
 * 
 * Run this once after deployment to populate the RAG knowledge base.
 * 
 * @param {Request} req - HTTP request object
 * @param {Object} env - Cloudflare environment bindings
 * @returns {Response} - JSON response with success status
 */
async function seed(req, env) {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  // Fail-closed shared secret (REQ-0011) — set via wrangler secret / .dev.vars
  const denied = await assertSeedAuth(req, env);
  if (denied) return denied;
  
  // FAQ dataset: Array of [question, answer] pairs
  // Organized by topic for maintainability
  const faqs = [
    // ==================== Home/About Page (3 FAQs) ====================
    [
      "Tell me about Arnob Mahmud.",
      "Arnob Mahmud is a Full-Stack Web Developer and Automation & Digital Solutions Engineer with 4+ years of experience delivering scalable, high-performance digital products from concept to launch. He is known for transforming complex requirements into elegant, user-focused solutions that drive measurable business impact. He is a collaborative problem-solver with sharp analytical thinking, clear communication, and composure under pressure. He is committed to creating high-value, results-oriented solutions that accelerate growth and profitability. He is married to Veronika Hicker, his father is Dr. Montazul Haque, his late mother Firoza Begum was an Assistant Professor, and his only brother Ayon Mahmud is a civil engineer who lives in the USA.",
    ],
    [
      "Where is Arnob Mahmud located?",
      "Arnob is based in Frankfurt, Germany. Specifically, his address is Groß-Umstadt, Hessen, Germany. He has been living in Germany for over 12 years now.",
    ],
    [
      "What is Arnob's contact information?",
      "You can contact Arnob via email at arnobt78@gmail.com (primary) or arnob_t78@yahoo.com (CV email), phone at +49 1573 4664351, LinkedIn at https://www.linkedin.com/in/arnob-mahmud-05839655/, GitHub at https://github.com/arnobt78/, or visit his portfolio at https://arnob-mahmud.vercel.app. His Skype ID is arnob_t78.",
    ],

    // ==================== Services Page (2 FAQs) ====================
    [
      "What services does Arnob offer?",
      "Arnob offers four main services: Web / Mobile Development, UI / UX Design, DevOps & Testing (Test Automation (QA)), and Cyber Security from scratch to production as scalable and secure solutionsand deliver high-value, results-oriented solutions that accelerate growth and profitability in the shortest possible time.",
    ],
    [
      "What can Arnob help me with?",
      "Arnob can help you with web and mobile development, UI/UX design, DevOps & Testing (Test Automation (QA)), and Cyber Security from scratch to production as scalable and secure solutions and deliver high-value, results-oriented solutions that accelerate growth and profitability in the shortest possible time.",
    ],

    // ==================== Resume Page - About Me (2 FAQs) ====================
    [
      "What is Arnob's professional summary?",
      "Arnob is a driven Full-Stack Developer with 5+ years of experience building scalable, high-performance web and mobile solutions. He has delivered user-focused applications that enhance business efficiency through clean architecture, automation, and cloud-ready deployment from scratch to production as scalable and secure solutions.",
    ],
    [
      "What languages does Arnob speak?",
      "Arnob speaks English (C2 - Fluent), German (B1), Bengali (Native), Hindi, and Urdu (Conversational). He is Bangladeshi by nationality and is currently based in Frankfurt, Germany.",
    ],

    // ==================== Resume Page - Experience (2 FAQs) ====================
    [
      "Where does Arnob currently work?",
      "Arnob currently works as a Full-Stack Web Developer as a Freelancer/Self-Employed (Remote) since June 2025. Previously, he worked at Sernitas GmbH in Bochum, Germany from March 2025 to July 2025 as a Full-Stack Web Developer Intern, where he led full-cycle builds using React, Next.js, Express, Odoo (ERP) and AWS, improving delivery by 30%. He has also worked as a Research Assistant at Frankfurt University of Applied Sciences (2017-2023), Mobile App Developer at get it live GmbH (2015-2016), Software Test Engineer at LEADS Corporation Limited (2013), and Junior Software Developer at Green Generation IT Ltd (2012).",
    ],
    [
      "What is Arnob's work experience?",
      "Arnob is a Web & Mobile Application Developer with a strong focus on quality, performance, and reliability. He builds intuitive, high-performing apps backed by clean code and rigorous testing, ensuring seamless user experiences from development to deployment as scalable and secure solutions to production.",
    ],

    // ==================== Resume Page - Education (1 FAQ) ====================
    [
      "What is Arnob's educational background?",
      "Arnob has a Bachelor's degree in Computer Science & Engineering from Military Institute of Science and Technology (MIST), Dhaka, Bangladesh (2008-2012), CGPA of 3.16 out of 4.0. He has a Master's degree in High Integrity Systems (M.Sc. in Informatik) from Frankfurt University of Applied Sciences, Frankfurt, Germany (2014-2024), CGPA of 3.15 out of 5.0. He has also completed an Advanced NextJS/Framer-Motion Web Development Bootcamp (2023-2025) and an Advanced ReactJS/TailwindCSS Web Development Bootcamp (2022-2024), both from Udemy Online Courses.",
    ],

    // ==================== Resume Page - Skills (2 FAQs) ====================
    [
      "What are Arnob's technical skills?",
      "Arnob has comprehensive technical skills including Frontend (React, Next.js, Angular, TypeScript, JavaScript, Tailwind CSS, Shadcn, Framer Motion), Backend (Node.js/Express.js, .NET, C++, Python/Flask/Django, PHP/Laravel/Symfony), Database (PostgreSQL/Supabase/NeonDB, DynamoDB, MongoDB, Firebase, Upstash, Appwrite, Prisma, Drizzle ORM), Testing (Selenium E2E, Cypress Integration, Jest Unit Testing), Cloud & DevOps (AWS EC2/S3/Lambda, Docker, Kubernetes, CI/CD GitHub Actions, Vercel, cPanel, Render, Coolify, VPS, Jira), and Other Tools (Figma, Stripe, Odoo ERP, GraphQL, AI Model Integration, SEO, Google Ads, LLM, TensorFlow).",
    ],
    [
      "Tell me about Arnob's technical skills.",
      "Arnob has extensive technical skills across multiple domains: Frontend technologies like React, Next.js, Angular, TypeScript, JavaScript, Tailwind CSS, Shadcn, and Framer Motion; Backend technologies including Node.js with Express.js, .NET, C++, Python with Flask and Django, and PHP with Laravel and Symfony; Databases such as PostgreSQL with Supabase and NeonDB, DynamoDB, MongoDB, Firebase, Upstash, Appwrite, Prisma, and Drizzle ORM; Testing tools including Selenium for E2E, Cypress for Integration, and Jest for Unit Testing; Cloud & DevOps tools like AWS (EC2, S3, Lambda), Docker, Kubernetes, CI/CD with GitHub Actions, Vercel, cPanel, Render, Coolify, VPS, and Jira; and Other Tools like Figma, Stripe, Odoo ERP, GraphQL, AI Model Integration, SEO, Google Ads, LLM, and TensorFlow.",
    ],

    // ==================== Work/Projects Page (2 FAQs) ====================
    [
      "How many projects has Arnob worked on?",
      "Arnob has worked on 40+ real-world projects, with overall 90+ projects currently available on his GitHub repository https://github.com/arnobt78 as open source projects, including web development, mobile apps, and automation solutions. According to his portfolio statistics, he has completed 90+ projects, mastered 14 technologies, made 1676 code commits in 2025, and has 5+ years of experience.",
    ],
    [
      "What projects has Arnob worked on?",
      "Arnob has worked on 40+ projects including web development, mobile apps, and automation solutions. Some key projects include RAG-AI ChatBot (Redis Vector + QStash + Next.js Full Stack), HealthCare Doctor Appointment Management System (Next.js + Appwrite + Twilio Full Stack), IoT Embedded MotorSync Intelligence Platform (C++/.NET/React Full Stack), Stock Inventory Management System (Next.js + MongoDB Full Stack), and Hotel Booking Management System (React MERN Full Stack). Many more open source projects are available on his GitHub repository https://github.com/arnobt78.",
    ],

    // ==================== Contact Page / Availability (3 FAQs) ====================
    [
      "How can I get in touch with Arnob?",
      "You can contact Arnob via email at arnobt78@gmail.com or arnob_t78@yahoo.com, phone at +49 1573 4664351, or visit his LinkedIn profile at https://www.linkedin.com/in/arnob-mahmud-05839655/ or his GitHub profile at https://github.com/arnobt78/",
    ],
    [
      "Is Arnob available for new projects?",
      "Yes, Arnob is currently self-employed and actively looking for a job. He is open to freelance, part-time, or full-time roles and can start immediately within a week. He is eager to learn, grow, and make a meaningful impact within a dynamic team. He is driven to deliver high-value solutions that bring measurable results and profit.",
    ],
    [
      "What is Arnob's salary expectation?",
      "Arnob has no preference regarding salary. Any amount is okay.",
    ],

    // ==================== Personal Life (3 FAQs) ====================
    [
      "Tell me about Arnob's personal life.",
      "Arnob Mahmud is married to Veronika Hicker. His father is Dr. Montazul Haque, and his late mother Firoza Begum was an Assistant Professor. His only brother Ayon Mahmud is a civil engineer who lives in the USA.",
    ],
    [
      "What are Arnob's hobbies?",
      "Arnob enjoys listening to metal and rock music, walking in nature, loving animals, watching TV series and anime, gardening, and attending concerts and festivals.",
    ],

    // ==================== CV/Professional (1 FAQ) ====================
    [
      "What are Arnob's key achievements?",
      "Arnob's key achievements include improving client onboarding speed by 40%, ensuring 100% on-time delivery for SaaS e-learning apps, cutting maintenance efforts by 25%, improving delivery by 30% at Sernitas, increasing operational efficiency by 35%, and improving conversions by 20%+ through UX/UI enhancements. He has worked across various industries including e-commerce, healthcare, CRM systems, finance, data-center applications, and enterprise solutions.",
    ],
  ];
  try {
    // Generate embeddings for all FAQs in parallel
    // Each FAQ gets an embedding vector that represents its semantic meaning
    const vecs = await Promise.all(
      faqs.map(async ([q, a], i) => {
        // Generate embedding from question + answer (combined for better context)
        const e = await env.AI.run(EMBED_MODEL, {
          text: [q + " " + a],
        });
        return {
          id: `faq-${i + 1}`,
          values: e.data?.[0] || [], // Embedding vector (768 dimensions for BGE / EMBED_MODEL)
          metadata: { question: q, answer: a }, // Stored alongside vector for retrieval
        };
      }),
    );
    
    // Upsert all vectors into Vectorize index
    // This enables semantic search: similar questions will find relevant FAQs
    await env.VECTORIZE.upsert(vecs);
    return json({ success: true, count: faqs.length });
  } catch (err) {
    console.error("seed() failed:", err);
    captureErr(err, { route: "/api/seed" });
    return json({ error: "Seed failed" }, 500);
  }
}

/**
 * Main Worker export - Request router
 *
 * Entry point wrapped with Sentry.withSentry (enabled when env.SENTRY_DSN is set).
 * Routes:
 * - API: /api/chat, /api/history, /api/seed, /api/health, /api/monitoring
 * - Static assets: widget.js, styles.css, vendor/sentry-browser.min.js, index.html
 *
 * @param {Request} req - HTTP request
 * @param {Object} env - Cloudflare environment bindings (KV, Vectorize, AI, ASSETS, CHAT_LIMITER)
 */
export default Sentry.withSentry(
  (env) => ({
    // Secret: wrangler secret put SENTRY_DSN (or .dev.vars locally)
    dsn: env.SENTRY_DSN || undefined,
    enabled: Boolean(env.SENTRY_DSN),
    // Low sample rate — demo traffic; errors still captured at 100%
    tracesSampleRate: 0.05,
  }),
  {
    async fetch(req, env) {
      const p = new URL(req.url).pathname;

      // Handle CORS preflight requests (includes monitoring tunnel for embeds)
      if (req.method === "OPTIONS")
        return new Response(null, {
          headers: {
            ...cors,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, X-Seed-Secret",
          },
        });

      // API route handlers
      if (p === "/api/chat") return chat(req, env);

      // History endpoint: retrieves conversation history from KV storage
      if (p === "/api/history") {
        const s = cookie(req);
        return json({
          messages: s
            ? (await env.CHAT_SESSIONS.get(s, "json"))?.messages || []
            : [],
        });
      }

      // Seed endpoint: populates Vectorize index with FAQ embeddings
      if (p === "/api/seed") return seed(req, env);

      // Browser Sentry envelope tunnel (ad-blocker bypass)
      if (p === "/api/monitoring") return monitoring(req, env);

      // Health + public client DSN (Sentry browser DSN is designed to be public)
      if (p === "/api/health") {
        return json({
          status: "ok",
          sentryDsn: env.SENTRY_DSN || null,
        });
      }

      // Serve static assets (widget.js, styles.css, index.html, robots.txt, vendor/*)
      const assetResponse = await env.ASSETS.fetch(req);
      if (assetResponse.ok) {
        const newHeaders = new Headers(assetResponse.headers);
        // Short cache for HTML/robots; long immutable cache for versioned JS/CSS
        newHeaders.set("Cache-Control", assetCacheControl(p));
        newHeaders.set("X-Content-Type-Options", "nosniff");

        return new Response(assetResponse.body, {
          status: assetResponse.status,
          statusText: assetResponse.statusText,
          headers: newHeaders,
        });
      }
      return assetResponse;
    },
  },
);
