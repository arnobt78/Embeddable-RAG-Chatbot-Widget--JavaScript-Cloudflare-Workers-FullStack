/**
 * Portfolio Chatbot Widget - Fast Loading Embeddable Script
 * 
 * This is a self-contained, embeddable chatbot widget that can be added to any website.
 * Key features:
 * - Zero dependencies (vanilla JavaScript)
 * - Inline styles for portability (works without Tailwind CSS)
 * - Dark/Light mode support
 * - Mobile-responsive with keyboard handling
 * - Real-time streaming chat via SSE
 * - Session persistence via cookies
 * 
 * Usage: Include this script on any page, and it will automatically initialize.
 */
(function(){
'use strict';

// Configuration object - can be overridden via global window variables
// Allows customization without modifying the script
const C={
  u:window.CHATBOT_BASE_URL||window.location.origin,  // API base URL
  t:window.CHATBOT_TITLE||'Chat Assistant',           // Widget title
  p:window.CHATBOT_PLACEHOLDER||'Message...',        // Input placeholder
  g:window.CHATBOT_GREETING||'👋 How can I help you today?' // Initial greeting
};

/**
 * Optional Sentry browser SDK (self-hosted under /vendor) + tunnel to /api/monitoring.
 * Loads async so the FAB still appears instantly. Skips when no DSN is available.
 * DSN sources: window.CHATBOT_SENTRY_DSN, or GET /api/health → sentryDsn.
 */
function initSentry(){
  try{
    const tunnel=C.u.replace(/\/$/,'')+'/api/monitoring';
    const boot=(dsn)=>{
      if(!dsn||typeof dsn!=='string')return;
      if(window.__cbSentryInit)return;
      window.__cbSentryInit=1;
      const s=document.createElement('script');
      s.src=C.u.replace(/\/$/,'')+'/vendor/sentry-browser.min.js';
      s.async=1;
      s.onload=()=>{
        try{
          if(!window.Sentry||!window.Sentry.init)return;
          window.Sentry.init({
            dsn:dsn,
            tunnel:tunnel,
            tracesSampleRate:0, // errors only — keep embed lightweight
            // Match Worker project; browser events still useful for widget crashes
          });
        }catch{}
      };
      document.head.appendChild(s);
    };
    if(window.CHATBOT_SENTRY_DSN){
      boot(window.CHATBOT_SENTRY_DSN);
      return;
    }
    fetch(C.u.replace(/\/$/,'')+'/api/health',{credentials:'omit'})
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(d&&d.sentryDsn)boot(d.sentryDsn);})
      .catch(()=>{});
  }catch{}
}

function reportClientError(err,ctx){
  try{
    if(window.Sentry&&window.Sentry.captureException){
      window.Sentry.captureException(err instanceof Error?err:new Error(String(err)),ctx?{extra:ctx}:undefined);
    }
  }catch{}
}

// State variables
let open=0,      // Widget open/closed state (0=closed, 1=open)
    msgs=[],     // Message history array
    typing=0,    // Typing indicator state
    menu=0,      // Menu dropdown state
    dark=false;  // Dark mode state

// Detect system dark mode preference
try{dark=matchMedia('(prefers-color-scheme:dark)').matches;}catch{}

// Helper functions: DOM selector and class toggle
const $=id=>document.getElementById(id),
      tog=(e,c,on)=>e&&e.classList&&e.classList.toggle(c,on);

// Add bounce animation keyframes for typing indicator
// Creates a smooth bouncing effect for the "Thinking..." dots
if(!document.getElementById('cb-animations')){
  const style=document.createElement('style');
  style.id='cb-animations';
  style.textContent='@keyframes bounce{0%,100%{transform:translateY(0);}50%{transform:translateY(-25%);}}';
  document.head.appendChild(style);
}

/**
 * Initialize widget - Creates all DOM elements and sets up event handlers
 * 
 * This function:
 * 1. Creates the floating action button (FAB) - appears instantly
 * 2. Loads CSS asynchronously (non-blocking)
 * 3. Creates the chat window with all UI elements
 * 4. Sets up responsive behavior for mobile/desktop
 * 5. Applies initial theme (dark/light mode)
 * 6. Binds event handlers
 * 7. Loads conversation history
 * 
 * Uses inline styles extensively to ensure the widget works on any website,
 * even without Tailwind CSS or other frameworks.
 */
function init(){
  // Non-blocking observability — never delay FAB paint
  initSentry();

  // Create button immediately - appears instantly (no waiting for CSS)
  const btn=document.createElement('button');
  btn.id='cb-btn';
  btn.className='fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-14 h-14 bg-black rounded-full shadow-2xl flex items-center justify-center cursor-pointer hover:scale-110 transition-all z-[99998]';
  
  // CRITICAL: Inline styles ensure positioning works even without Tailwind
  // This makes the widget truly portable - works on any website
  // Set initial button style - will be adjusted for mobile in handleResize
  const isMobile=window.matchMedia('(max-width: 639px)').matches;
  btn.style.cssText=`position:fixed!important;bottom:${isMobile?'0.75rem':'1.5rem'}!important;right:${isMobile?'0.75rem':'1.5rem'}!important;width:${isMobile?'3rem':'3.5rem'}!important;height:${isMobile?'3rem':'3.5rem'}!important;background-color:#000000!important;border-radius:9999px!important;border:none!important;cursor:pointer!important;z-index:99998!important;pointer-events:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)!important;`;
  
  // Button contains two SVG icons: chat icon (default) and close icon (when open)
  // Icons toggle visibility based on open/closed state
  btn.innerHTML=`<svg id="cb-o" style="width:1.5rem;height:1.5rem;color:white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg><svg id="cb-x" style="width:1.5rem;height:1.5rem;color:white;position:absolute;opacity:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>`;
  document.body.appendChild(btn);
  
  // Load CSS asynchronously (non-blocking)
  // This prevents CSS from blocking widget initialization
  const l=document.createElement('link');
  l.rel='stylesheet';
  l.href=C.u+'/styles.css';
  document.head.appendChild(l);
  
  // Create chat window - all styles are inline for portability
  // This ensures the widget works on any website without external dependencies
  const d=document.createElement('div');
  d.id='cb';
  
  // Base styles for chat window: fixed positioning, hidden by default (opacity:0)
  // Will be shown with smooth animation when opened
  const chatWindowBaseStyle='position:fixed!important;bottom:5rem!important;right:1rem!important;width:calc(100vw - 2rem)!important;max-width:calc(100vw - 2rem)!important;height:calc(100vh - 6rem)!important;max-height:600px!important;border-radius:1rem!important;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;z-index:99999!important;opacity:0!important;transform:scale(0.95)!important;pointer-events:none!important;background-color:#ffffff!important;transition:opacity 0.2s,transform 0.2s,bottom 0.3s ease!important;transform-origin:bottom right!important;';
  
  // Chat window HTML structure:
  // - Header: title, menu button, dropdown menu
  // - Messages container: scrollable area for chat messages
  // - Typing indicator: shows "Thinking..." while waiting for AI response
  // - Input form: text input and send button
  d.innerHTML=`<div id="cb-w" style="${chatWindowBaseStyle}">
<div id="cb-header" style="display:flex!important;align-items:center!important;justify-content:space-between!important;padding:0.75rem 1rem!important;border-bottom:1px solid #f3f4f6!important;background-color:#ffffff!important;flex-shrink:0!important;"><div style="display:flex!important;align-items:center!important;gap:0.5rem!important;min-width:0!important;flex:1!important;"><div id="cb-avatar" style="width:2rem!important;height:2rem!important;background-color:#000000!important;border-radius:9999px!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;"><svg style="width:1rem!important;height:1rem!important;color:white!important;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></div><h3 id="cb-title" style="font-size:0.875rem!important;font-weight:600!important;color:#111827!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;">${C.t}</h3></div>
<div style="position:relative!important;flex-shrink:0!important;"><button id="cb-m" style="padding:0.5rem!important;border:none!important;background:transparent!important;cursor:pointer!important;border-radius:9999px!important;color:#6b7280!important;transition:background-color 0.2s!important;" onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'"><svg style="width:1.25rem!important;height:1.25rem!important;color:inherit!important;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>
<div id="cb-d" style="display:none!important;position:absolute!important;right:0!important;top:100%!important;margin-top:0.5rem!important;width:11rem!important;background-color:#ffffff!important;border-radius:0.75rem!important;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05)!important;border:1px solid #f3f4f6!important;padding:0.25rem 0!important;z-index:100!important;">
<button id="cb-th" style="width:100%!important;padding:0.5rem 1rem!important;text-align:left!important;font-size:0.875rem!important;color:#374151!important;background:transparent!important;border:none!important;cursor:pointer!important;display:flex!important;align-items:center!important;gap:0.5rem!important;transition:background-color 0.2s!important;" onmouseover="this.style.backgroundColor='#f9fafb'" onmouseout="this.style.backgroundColor='transparent'"><svg id="cb-s" style="display:none!important;width:1rem!important;height:1rem!important;color:currentColor!important;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg><svg id="cb-n" style="width:1rem!important;height:1rem!important;color:currentColor!important;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg><span id="cb-tt">Dark Mode</span></button>
<button id="cb-cl" style="width:100%!important;padding:0.5rem 1rem!important;text-align:left!important;font-size:0.875rem!important;color:#374151!important;background:transparent!important;border:none!important;cursor:pointer!important;display:flex!important;align-items:center!important;gap:0.5rem!important;transition:background-color 0.2s!important;" onmouseover="this.style.backgroundColor='#f9fafb'" onmouseout="this.style.backgroundColor='transparent'"><svg style="width:1rem!important;height:1rem!important;color:currentColor!important;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Clear Chat</button></div></div></div>
<div id="cb-ms" style="flex:1!important;overflow-y:auto!important;overflow-x:hidden!important;padding:0.75rem 1rem!important;background-color:#f9fafb!important;display:flex!important;flex-direction:column!important;gap:0.75rem!important;"></div>
<div id="cb-ty" style="display:none!important;padding:0 1rem 0.5rem 1rem!important;background-color:#f9fafb!important;"><div style="display:flex!important;align-items:center!important;gap:0.5rem!important;color:#9ca3af!important;font-size:0.875rem!important;"><div style="display:flex!important;gap:0.25rem!important;"><span style="width:0.5rem!important;height:0.5rem!important;background-color:#9ca3af!important;border-radius:9999px!important;animation:bounce 1.4s infinite!important;"></span><span style="width:0.5rem!important;height:0.5rem!important;background-color:#9ca3af!important;border-radius:9999px!important;animation:bounce 1.4s infinite 0.15s!important;"></span><span style="width:0.5rem!important;height:0.5rem!important;background-color:#9ca3af!important;border-radius:9999px!important;animation:bounce 1.4s infinite 0.3s!important;"></span></div>Thinking...</div></div>
<form id="cb-f" style="display:flex!important;align-items:center!important;gap:0.5rem!important;padding:0.75rem 1rem!important;border-top:1px solid #f3f4f6!important;background-color:#ffffff!important;flex-shrink:0!important;"><input id="cb-i" type="text" style="flex:1!important;min-width:0!important;padding:0.5rem 1rem!important;background-color:#f9fafb!important;border:1px solid #e5e7eb!important;border-radius:9999px!important;font-size:1rem!important;color:#111827!important;outline:none!important;transition:none!important;box-sizing:border-box!important;" placeholder="${C.p}" autocomplete="off" onfocus="const isDark=document.getElementById('cb')&&document.getElementById('cb').classList.contains('dark');this.style.borderColor=isDark?'#6b7280':'#d1d5db';this.style.boxShadow=isDark?'0 0 0 2px #6b7280':'0 0 0 2px #d1d5db';this.style.outline='none';" onblur="const isDark=document.getElementById('cb')&&document.getElementById('cb').classList.contains('dark');this.style.borderColor=isDark?'#374151':'#e5e7eb';this.style.boxShadow='none';this.style.outline='none';"/><button type="submit" id="cb-se" style="padding:0.5rem!important;border:none!important;background:transparent!important;cursor:pointer!important;border-radius:9999px!important;color:#4b5563!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;transition:background-color 0.2s!important;" onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'"><svg style="width:1rem!important;height:1rem!important;color:inherit!important;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/></svg></button></form></div>`;
  document.body.appendChild(d);
  
  // Apply responsive styles for larger screens
  const chatWindow=$('cb-w');
  if(chatWindow){
    // Mobile-first: ensure it fits on phone screens
    // On mobile: use calc() values that fit within viewport
    // On desktop: use fixed sizes
    if(window.matchMedia('(min-width: 640px)').matches){
      // Desktop/Tablet: fixed size
      chatWindow.style.bottom='6rem';
      chatWindow.style.right='1.5rem';
      chatWindow.style.width='400px';
      chatWindow.style.maxWidth='400px';
      chatWindow.style.height='600px';
    }else{
      // Mobile: ensure it fits on screen with proper margins
      chatWindow.style.bottom='5.5rem';
      chatWindow.style.right='0.5rem';
      chatWindow.style.left='0.5rem';
      chatWindow.style.width='calc(100vw - 1rem)';
      chatWindow.style.maxWidth='calc(100vw - 1rem)';
      chatWindow.style.height='calc(100vh - 7rem)';
      chatWindow.style.maxHeight='calc(100vh - 7rem)';
    }
  }
  
  // Make button responsive for mobile
  // Reuse the btn variable already created above
  if(btn){
    if(window.matchMedia('(min-width: 640px)').matches){
      btn.style.bottom='1.5rem';
      btn.style.right='1.5rem';
      btn.style.width='3.5rem';
      btn.style.height='3.5rem';
    }else{
      // Mobile: ensure button is always visible on screen, not causing scroll
      btn.style.bottom='0.75rem';
      btn.style.right='0.75rem';
      btn.style.width='3rem';
      btn.style.height='3rem';
      btn.style.position='fixed';
      btn.style.zIndex='99998';
    }
  }
  
  // Apply initial dark mode if needed
  if(dark){
    const cb=$('cb');
    if(cb)cb.classList.add('dark');
  }
  
  bind();
  theme();
  
  // Prevent X-axis scrolling on mobile and fix viewport for iOS
  // This is critical for mobile UX - prevents horizontal scroll issues
  if(typeof document!=='undefined'){
    const style=document.createElement('style');
    style.id='cb-no-scroll';
    style.textContent='html,body{overflow-x:hidden!important;max-width:100vw!important;}body>*{max-width:100%!important;overflow-x:hidden!important;}';
    if(!document.getElementById('cb-no-scroll'))document.head.appendChild(style);
    
    // Prevent iOS from shifting viewport when keyboard appears
    // The 'interactive-widget=resizes-content' meta tag tells iOS to resize
    // the viewport when the keyboard appears, preventing layout issues
    const viewportMeta=document.querySelector('meta[name="viewport"]');
    if(viewportMeta){
      const content=viewportMeta.getAttribute('content')||'';
      if(!content.includes('interactive-widget=resizes-content')){
        viewportMeta.setAttribute('content',content+(content?', ':'')+'interactive-widget=resizes-content');
      }
    }
  }
  
  /**
   * Handle window resize for responsive behavior
   * 
   * Adjusts widget and button sizes/positions based on screen size:
   * - Desktop (≥640px): Fixed 400px width, 600px height
   * - Mobile (<640px): Full width with margins, full height minus button space
   * 
   * This ensures the widget fits perfectly on any screen size.
   */
  function handleResize(){
    const chatWindow=$('cb-w'),btn=$('cb-btn');
    if(chatWindow){
      if(window.matchMedia('(min-width: 640px)').matches){
        // Desktop: fixed size, positioned from bottom-right
        chatWindow.style.bottom='6rem';
        chatWindow.style.right='1.5rem';
        chatWindow.style.left='auto';
        chatWindow.style.width='400px';
        chatWindow.style.maxWidth='400px';
        chatWindow.style.height='600px';
        chatWindow.style.maxHeight='600px';
      }else{
        // Mobile: full width with margins, full height
        chatWindow.style.bottom='5.5rem';
        chatWindow.style.right='0.5rem';
        chatWindow.style.left='0.5rem';
        chatWindow.style.width='calc(100vw - 1rem)';
        chatWindow.style.maxWidth='calc(100vw - 1rem)';
        chatWindow.style.height='calc(100vh - 7rem)';
        chatWindow.style.maxHeight='calc(100vh - 7rem)';
      }
    }
    if(btn){
      if(window.matchMedia('(min-width: 640px)').matches){
        // Desktop: larger button
        btn.style.bottom='1.5rem';
        btn.style.right='1.5rem';
        btn.style.width='3.5rem';
        btn.style.height='3.5rem';
      }else{
        // Mobile: smaller button, closer to edges
        btn.style.bottom='1rem';
        btn.style.right='1rem';
        btn.style.width='3rem';
        btn.style.height='3rem';
      }
    }
  }
  window.addEventListener('resize',handleResize);
  
  // Load conversation history in background (non-blocking)
  // Small delay ensures DOM is ready before fetching
  setTimeout(()=>load().catch(()=>{}),100);
}

/**
 * Bind event handlers to DOM elements
 * 
 * Sets up all interactive functionality:
 * - Button click: toggle widget open/closed
 * - Form submit: send message
 * - Menu button: toggle dropdown menu
 * - Theme button: toggle dark/light mode
 * - Clear button: clear chat history
 * - Document click: close menu when clicking outside
 */
function bind(){
  const btn=$('cb-btn'),form=$('cb-f'),menuBtn=$('cb-m'),themeBtn=$('cb-th'),clearBtn=$('cb-cl'),dropdown=$('cb-d');
  if(btn)btn.onclick=flip;
  if(form)form.onsubmit=send;
  if(menuBtn)menuBtn.onclick=e=>{e.stopPropagation();menu=!menu;if(dropdown)dropdown.style.display=menu?'block':'none';};
  if(themeBtn)themeBtn.onclick=()=>{dark=!dark;theme();menu=0;if(dropdown)dropdown.style.display='none';};
  if(clearBtn)clearBtn.onclick=()=>{msgs=[];draw();menu=0;if(dropdown)dropdown.style.display='none';};
  document.onclick=()=>{if(menu){menu=0;if(dropdown)dropdown.style.display='none';}};
}

/**
 * Apply theme (dark/light mode) to all widget elements
 * 
 * This function dynamically updates all colors and styles based on the current theme.
 * Uses inline styles to ensure instant updates without flicker.
 * 
 * Key features:
 * - Instant color changes (no transition on input to prevent flicker)
 * - Consistent color scheme across all elements
 * - Proper contrast for accessibility
 * - Menu hover states that match header background
 */
function theme(){
  const cb=$('cb'),tt=$('cb-tt'),s=$('cb-s'),n=$('cb-n'),w=$('cb-w'),header=$('cb-header'),ms=$('cb-ms'),ty=$('cb-ty'),f=$('cb-f'),i=$('cb-i'),title=$('cb-title'),m=$('cb-m'),d=$('cb-d'),th=$('cb-th'),cl=$('cb-cl'),se=$('cb-se');
  
  // Toggle dark class on main container
  tog(cb,'dark',dark);
  
  // Update theme toggle button text and icons
  if(tt)tt.textContent=dark?'Light Mode':'Dark Mode';
  if(s)s.style.display=dark?'block':'none';  // Sun icon (light mode)
  if(n)n.style.display=dark?'none':'block';   // Moon icon (dark mode)
  
  // Apply dark mode inline styles
  if(dark){
    if(w)w.style.backgroundColor='#111827';
    if(header){header.style.backgroundColor='#111827';header.style.borderColor='#1f2937';}
    if(title)title.style.color='#ffffff';
    if(m){m.style.color='#9ca3af';m.setAttribute('onmouseover',"this.style.backgroundColor='#1f2937'");m.setAttribute('onmouseout',"this.style.backgroundColor='transparent'");}
    if(d){d.style.backgroundColor='#1f2937';d.style.borderColor='#374151';}
    if(th){
      th.style.color='#e5e7eb';
      th.onmouseover=function(){this.style.backgroundColor='#111827';this.style.setProperty('background-color','#111827','important');};
      th.onmouseout=function(){this.style.backgroundColor='transparent';this.style.setProperty('background-color','transparent','important');};
    }
    if(cl){
      cl.style.color='#e5e7eb';
      cl.onmouseover=function(){this.style.backgroundColor='#111827';this.style.setProperty('background-color','#111827','important');};
      cl.onmouseout=function(){this.style.backgroundColor='transparent';this.style.setProperty('background-color','transparent','important');};
    }
    if(ms)ms.style.backgroundColor='#030712';
    if(ty)ty.style.backgroundColor='#030712';
    if(f){f.style.backgroundColor='#111827';f.style.borderColor='#1f2937';}
    if(i){
      // Remove transition for instant color change (sync with widget background)
      i.style.transition='none';
      // Change colors instantly without delay
      i.style.backgroundColor='#1f2937';
      i.style.borderColor='#374151';
      i.style.color='#ffffff';
      i.style.fontSize='1rem';
      i.style.boxSizing='border-box';
      i.setAttribute('placeholder',C.p);
      // Update focus handler for dark mode - use grey-500 box-shadow (no layout shift)
      i.setAttribute('onfocus',"this.style.borderColor='#6b7280';this.style.boxShadow='0 0 0 2px #6b7280';this.style.outline='none';");
      i.setAttribute('onblur',"this.style.borderColor='#374151';this.style.boxShadow='none';this.style.outline='none';");
    }
    if(se){se.style.color='#d1d5db';se.setAttribute('onmouseover',"this.style.backgroundColor='#1f2937'");se.setAttribute('onmouseout',"this.style.backgroundColor='transparent'");}
    // Redraw messages with correct dark mode colors
    draw();
  }else{
    if(w)w.style.backgroundColor='#ffffff';
    if(header){header.style.backgroundColor='#ffffff';header.style.borderColor='#f3f4f6';}
    if(title)title.style.color='#111827';
    if(m){m.style.color='#6b7280';m.setAttribute('onmouseover',"this.style.backgroundColor='#f3f4f6'");m.setAttribute('onmouseout',"this.style.backgroundColor='transparent'");}
    if(d){d.style.backgroundColor='#ffffff';d.style.borderColor='#f3f4f6';}
    if(th){th.style.color='#374151';th.setAttribute('onmouseover',"this.style.backgroundColor='#f9fafb'");th.setAttribute('onmouseout',"this.style.backgroundColor='transparent'");}
    if(cl){cl.style.color='#374151';cl.setAttribute('onmouseover',"this.style.backgroundColor='#f9fafb'");cl.setAttribute('onmouseout',"this.style.backgroundColor='transparent'");}
    if(ms)ms.style.backgroundColor='#f9fafb';
    if(ty)ty.style.backgroundColor='#f9fafb';
    if(f){f.style.backgroundColor='#ffffff';f.style.borderColor='#f3f4f6';}
    if(i){
      // Remove transition for instant color change (sync with widget background)
      i.style.transition='none';
      // Change colors instantly without delay
      i.style.backgroundColor='#f9fafb';
      i.style.borderColor='#e5e7eb';
      i.style.color='#111827';
      i.style.fontSize='1rem';
      i.style.boxSizing='border-box';
      i.setAttribute('placeholder',C.p);
      // Update focus handler for light mode - grey-300 border with box-shadow (no layout shift)
      i.setAttribute('onfocus',"this.style.borderColor='#d1d5db';this.style.boxShadow='0 0 0 2px #d1d5db';this.style.outline='none';");
      i.setAttribute('onblur',"this.style.borderColor='#e5e7eb';this.style.boxShadow='none';this.style.outline='none';");
    }
    if(se){se.style.color='#4b5563';se.setAttribute('onmouseover',"this.style.backgroundColor='#f3f4f6'");se.setAttribute('onmouseout',"this.style.backgroundColor='transparent'");}
    // Redraw messages with correct light mode colors
    draw();
  }
}

/**
 * Toggle widget open/closed state
 * 
 * Animates the widget window and button icons:
 * - Widget: fades in/out with scale animation
 * - Chat icon: fades out when opening
 * - Close icon: fades in when opening
 * 
 * When opening:
 * - Focuses input field for immediate typing
 * - Shows greeting message if no messages exist
 */
function flip(){
  open=!open;
  const w=$('cb-w'),o=$('cb-o'),x=$('cb-x'),input=$('cb-i');
  if(w){
    // Use inline styles for reliable positioning
    if(open){
      w.style.opacity='1';
      w.style.transform='scale(1)';
      w.style.pointerEvents='auto';
    }else{
      w.style.opacity='0';
      w.style.transform='scale(0.95)';
      w.style.pointerEvents='none';
    }
  }
  // Toggle button icons with smooth animation
  if(o){
    if(open){
      o.style.opacity='0';
      o.style.transform='scale(0.5)';
    }else{
      o.style.opacity='1';
      o.style.transform='scale(1)';
    }
  }
  if(x){
    if(open){
      x.style.opacity='1';
      x.style.transform='scale(1)';
    }else{
      x.style.opacity='0';
      x.style.transform='scale(0.5)';
    }
  }
  if(open){
    if(input)input.focus();  // Focus input for immediate typing
    if(!msgs.length)add('assistant',C.g);  // Show greeting on first open
  }
}

// Add message to history and redraw
function add(r,c){msgs.push({role:r,content:c});draw();}

// Escape HTML and convert newlines to <br> tags
// Prevents XSS attacks and preserves message formatting
function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML.replace(/\n/g,'<br>');}

/**
 * Render all messages in the chat window
 * 
 * This function:
 * 1. Generates HTML for each message (user or assistant)
 * 2. Applies appropriate styling based on dark/light mode
 * 3. Uses inline styles for portability
 * 4. Auto-scrolls to bottom to show latest message
 * 
 * Message styling:
 * - User messages: Black background, right-aligned, rounded on 3 corners
 * - Assistant messages: White/dark background, left-aligned, bot avatar, rounded on 3 corners
 * - Both have borders for better visibility in dark mode
 */
function draw(){
  const ms=$('cb-ms');
  if(!ms)return;
  
  // Check dark mode from the actual DOM element, not just the variable
  // This ensures theme is correctly detected even if state is out of sync
  const cb=$('cb');
  const isDark=cb&&cb.classList.contains('dark');
  
  // Generate HTML for all messages
  // Each message has a unique ID (m0, m1, m2...) for streaming updates
  ms.innerHTML=msgs.map((m,i)=>m.role==='user'
    // User message: black background, right-aligned
    ?`<div style="display:flex!important;justify-content:flex-end!important;"><div style="background-color:#000000!important;color:#ffffff!important;border-radius:1rem 1rem 0.25rem 1rem!important;padding:0.75rem 1rem!important;max-width:85%!important;border:1px solid ${isDark?'#4b5563':'#e5e7eb'}!important;font-size:0.875rem!important;line-height:1.5!important;white-space:pre-wrap!important;word-wrap:break-word!important;"><div id="m${i}">${esc(m.content)}</div></div></div>`
    // Assistant message: white/dark background, left-aligned, with bot avatar
    :`<div style="display:flex!important;justify-content:flex-start!important;"><div style="background-color:${isDark?'#1f2937':'#ffffff'}!important;color:${isDark?'#f9fafb':'#111827'}!important;border-radius:1rem 1rem 1rem 0.25rem!important;padding:0.75rem 1rem!important;max-width:85%!important;border:1px solid ${isDark?'#374151':'#e5e7eb'}!important;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05)!important;font-size:0.875rem!important;line-height:1.5!important;white-space:pre-wrap!important;word-wrap:break-word!important;"><div style="display:flex!important;align-items:center!important;gap:0.5rem!important;margin-bottom:0.5rem!important;"><div style="width:1.5rem!important;height:1.5rem!important;background-color:#000000!important;border-radius:9999px!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;"><svg style="width:1rem!important;height:1rem!important;color:white!important;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></div><span style="font-size:0.875rem!important;font-weight:500!important;color:${isDark?'#d1d5db':'#374151'}!important;">${C.t}</span></div><div id="m${i}">${esc(m.content)}</div></div></div>`
  ).join('');
  
  // Auto-scroll to bottom to show latest message
  ms.scrollTop=ms.scrollHeight;
}

/**
 * Send message to API and handle streaming response
 * 
 * This function implements Server-Sent Events (SSE) streaming:
 * 1. Prevents default form submission
 * 2. Adds user message to UI immediately
 * 3. Shows typing indicator
 * 4. Sends POST request to /api/chat
 * 5. Streams response chunks in real-time
 * 6. Updates message as it streams (progressive rendering)
 * 7. Hides typing indicator when complete
 * 
 * Uses ReadableStream API to handle SSE format: "data: {...}" lines
 */
async function send(e){
  e.preventDefault();
  const input=$('cb-i'),submit=$('cb-se'),typingEl=$('cb-ty'),ms=$('cb-ms');
  if(!input)return;
  const m=input.value.trim();
  if(!m||typing)return;  // Prevent multiple simultaneous requests
  
  // Add user message immediately (optimistic UI)
  add('user',m);
  input.value='';
  if(submit)submit.disabled=1;
  typing=1;
  
  // Wait for scroll to complete before showing typing indicator
  // This ensures the user message is fully visible before the "Thinking..." overlay appears
  setTimeout(()=>{
    if(typingEl)typingEl.style.display='block';
    // Scroll again after showing typing indicator to ensure it's visible
    if(ms)ms.scrollTop=ms.scrollHeight;
  },100);
  
  try{
    // Send POST request to chat API
    const r=await fetch(C.u+'/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:m}),
      credentials:'include'  // Include cookies for session management
    });
    if(!r.ok||!r.body)throw new Error('Request failed');
    
    // Read SSE stream
    const rd=r.body.getReader();
    const dc=new TextDecoder();
    let t='',idx=null;  // t = accumulated text, idx = message index
    
    while(1){
      const{done,value}=await rd.read();
      if(done)break;
      
      // Parse SSE format: "data: {...}" lines
      for(const ln of dc.decode(value,{stream:1}).split('\n')){
        if(!ln.startsWith('data: '))continue;
        const d=ln.slice(6);  // Remove "data: " prefix
        if(d==='[DONE]')continue;
        
        try{
          const p=JSON.parse(d);
          if(p.response){
            t+=p.response;  // Accumulate response text
            
            // Create message element on first chunk
            if(idx===null){
              if(typingEl)typingEl.style.display='none';
              typing=0;
              msgs.push({role:'assistant',content:t});
              idx=msgs.length-1;
              draw();  // Initial render
            }else{
              // Update existing message (progressive rendering)
              msgs[idx].content=t;
              const el=$('m'+idx);
              if(el)el.innerHTML=esc(t);
            }
            if(ms)ms.scrollTop=ms.scrollHeight;  // Auto-scroll
          }
        }catch{}
      }
    }
  }catch(err){
    // Error handling: show error message + optional Sentry (via tunnel)
    reportClientError(err,{route:'/api/chat'});
    if(typingEl)typingEl.style.display='none';
    typing=0;
    add('assistant','Sorry, an error occurred.');
  }finally{
    // Cleanup: re-enable submit button
    if(submit)submit.disabled=0;
    typing=0;
    if(typingEl)typingEl.style.display='none';
  }
}

/**
 * Load conversation history from API
 * 
 * Retrieves saved messages from the server using the session cookie.
 * This restores the conversation when the user returns to the page.
 * 
 * Uses credentials:'include' to send cookies for session identification.
 */
async function load(){
  try{
    const r=await fetch(C.u+'/api/history',{credentials:'include'});
    if(r.ok){
      const d=await r.json();
      if(d.messages&&Array.isArray(d.messages)&&d.messages.length){
        msgs=d.messages;
        draw();  // Render all loaded messages
      }
    }
  }catch{}
}

/**
 * Wait for document.body to be available before initializing
 * 
 * This ensures the widget can be safely injected even if the script
 * loads before the DOM is ready. Works with both synchronous and
 * asynchronous script loading.
 */
function waitForBody(){
  if(document.body){
    init();
  }else{
    setTimeout(waitForBody,10);  // Retry every 10ms
  }
}

// Start initialization based on document ready state
// Handles both cases: script loaded before/after DOMContentLoaded
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',waitForBody);
}else{
  waitForBody();  // DOM already ready
}
})();
