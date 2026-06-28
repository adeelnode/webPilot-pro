// ═══════════════════════════════════════════════
//  My Urban Limos Cache Clear  v4.0 — popup.js
//  by Adeel dev
// ═══════════════════════════════════════════════

const TARGET = 'myurbanlimos.com';

// Chrome's browsingData.remove() only accepts these types with an `origins` filter.
// Passing ANY other type (history, formData, downloads, passwords) WITH origins
// causes the ENTIRE call to fail silently — hence the two-pass approach.
const ORIGIN_SAFE = new Set([
  'cache', 'cacheStorage', 'cookies',
  'localStorage', 'indexedDB', 'serviceWorkers'
]);

let selectedTime = 604800000;
let clearScope   = 'site';
let currentTab   = null;

// In-memory copy log
let copyLog = [];

// ─── DEFAULT SEARCH ENGINES ────────────────────
const DEFAULT_ENGINES = [
  { id: 'google',    name: 'Google',    url: 'https://www.google.com/search?q={q}',                 icon: 'G',  color: '#4285F4' },
  { id: 'bing',      name: 'Bing',      url: 'https://www.bing.com/search?q={q}',                   icon: 'B',  color: '#00809d' },
  { id: 'ddg',       name: 'DuckDuckGo',url: 'https://duckduckgo.com/?q={q}',                       icon: 'D',  color: '#de5833' },
  { id: 'youtube',   name: 'YouTube',   url: 'https://www.youtube.com/results?search_query={q}',    icon: 'YT', color: '#ff0000' },
  { id: 'github',    name: 'GitHub',    url: 'https://github.com/search?q={q}',                     icon: 'GH', color: '#333' },
  { id: 'mdn',       name: 'MDN',       url: 'https://developer.mozilla.org/search?q={q}',          icon: 'M',  color: '#0069c2' },
  { id: 'npm',       name: 'npm',       url: 'https://www.npmjs.com/search?q={q}',                  icon: 'N',  color: '#cb3837' },
  { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q={q}',     icon: 'SO', color: '#f48024' },
];

// ═══════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('pc');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, pts;
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  function make() {
    pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.3 + 0.3,
      vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28,
      a: Math.random() * .38 + .08, h: Math.random() > .5 ? 248 : 174
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.h},100%,75%,${p.a})`; ctx.fill();
    });
    pts.forEach((p, i) => pts.slice(i + 1).forEach(q => {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < 65) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = `rgba(139,131,255,${.07 * (1 - d / 65)})`;
        ctx.lineWidth = .5; ctx.stroke();
      }
    }));
    requestAnimationFrame(draw);
  }
  resize(); make(); draw();
  window.addEventListener('resize', () => { resize(); make(); });
})();

// ═══════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    const t = tab.dataset.tab;
    if (t === 'seo')    runSEO();
    if (t === 'images') runImages();
    if (t === 'copy')   initCopyPanel();
    if (t === 'links')  initLinksPanel();
    if (t === 'ai')     initAIPanel();
    if (t === 'search') initSearchPanel();
  });
});

// ─── TIME PILLS ────────────────────────────────
document.querySelectorAll('.tp').forEach(p => {
  p.addEventListener('click', () => {
    document.querySelectorAll('.tp').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    selectedTime = parseInt(p.dataset.v) || 0;
  });
});

// ─── SCOPE TOGGLE ──────────────────────────────
document.getElementById('scopeSite').addEventListener('click', () => setScope('site'));
document.getElementById('scopeAll').addEventListener('click', () => setScope('all'));
function setScope(s) {
  clearScope = s;
  document.querySelectorAll('.scope-btn').forEach(b => b.classList.toggle('active', b.dataset.scope === s));
  const desc = document.getElementById('scopeDesc');
  desc.innerHTML = s === 'site'
    ? `Clears data only for <strong>${TARGET}</strong>`
    : `⚠️ Clears data for <strong>all websites</strong> in your browser`;
}

// ═══════════════════════════════════════════════
//  CLEAR BUTTON — fully logical
// ═══════════════════════════════════════════════
document.getElementById('bigBtn').addEventListener('click', doClear);

async function doClear() {
  const btn     = document.getElementById('bigBtn');
  const toastEl = document.getElementById('toast');
  const titleEl = document.getElementById('toastTitle');
  const msgEl   = document.getElementById('toastMsg');
  const icoEl   = document.getElementById('toastIco');

  btn.classList.add('loading'); btn.disabled = true;
  btn.querySelector('.bb-txt').textContent = 'Clearing…';
  hideToast();

  // 1. Active tab
  let tab = null;
  try { const tabs = await chrome.tabs.query({ active: true, currentWindow: true }); tab = tabs[0] || null; } catch (_) {}
  const tabUrl   = tab ? (tab.url || '') : '';
  const isOnSite = tabUrl.includes(TARGET);
  const canInject = !!(tabUrl && !tabUrl.startsWith('chrome://') && !tabUrl.startsWith('chrome-extension://') && !tabUrl.startsWith('about:'));

  // 2. Checkboxes
  const wantCache     = document.getElementById('cc-cache').checked;
  const wantCookies   = document.getElementById('cc-cookies').checked;
  const wantLS        = document.getElementById('cc-ls').checked;
  const wantSW        = document.getElementById('cc-sw').checked;
  const wantIDB       = document.getElementById('cc-idb').checked;
  const wantHistory   = document.getElementById('cc-history').checked;
  const wantPasswords = document.getElementById('cc-passwords').checked;
  const wantFormData  = document.getElementById('cc-formdata').checked;
  const wantDownloads = document.getElementById('cc-downloads').checked;

  if (![wantCache,wantCookies,wantLS,wantSW,wantIDB,wantHistory,wantPasswords,wantFormData,wantDownloads].some(Boolean)) {
    resetBtn(btn);
    showToast('err', 'Nothing Selected', 'Please check at least one item.', toastEl, titleEl, msgEl, icoEl);
    return;
  }

  // 3. Direct in-page wipe (bypasses timestamp filter)
  if (canInject && tab) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async function(opts) {
          if (opts.ls)  { try { localStorage.clear(); } catch(_){} }
          if (opts.ls)  { try { sessionStorage.clear(); } catch(_){} }
          if (opts.idb) {
            try {
              if (indexedDB.databases) {
                const dbs = await indexedDB.databases();
                await Promise.all(dbs.map(db => new Promise(res => {
                  const r = indexedDB.deleteDatabase(db.name);
                  r.onsuccess = r.onerror = r.onblocked = res;
                })));
              }
            } catch(_){}
          }
          if (opts.sw && 'serviceWorker' in navigator) {
            try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } catch(_){}
          }
          if (opts.cache && 'caches' in window) {
            try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch(_){}
          }
        },
        args: [{ ls: wantLS, idb: wantIDB, sw: wantSW, cache: wantCache || wantSW }]
      });
    } catch (_) {}
  }

  // 4. browsingData.remove — two-pass split
  try {
    const since = 0; // always use all-time for storage (timestamp filter skips old data)
    const sinceGlobal = selectedTime === 0 ? 0 : Date.now() - selectedTime;
    const origins = [`https://${TARGET}`,`http://${TARGET}`,`https://www.${TARGET}`,`http://www.${TARGET}`];

    if (clearScope === 'site') {
      const passA = {};
      if (wantCache)   { passA.cache = true; passA.cacheStorage = true; }
      if (wantCookies)  passA.cookies = true;
      if (wantLS)       passA.localStorage = true;
      if (wantSW)     { passA.serviceWorkers = true; passA.cacheStorage = true; }
      if (wantIDB)      passA.indexedDB = true;
      if (Object.keys(passA).length) await browsingRemove({ since, origins }, passA);

      const passB = {};
      if (wantHistory)   passB.history   = true;
      if (wantPasswords) passB.passwords = true;
      if (wantFormData)  passB.formData  = true;
      if (wantDownloads) passB.downloads = true;
      if (Object.keys(passB).length) await browsingRemove({ since: sinceGlobal }, passB);
    } else {
      const all = {};
      if (wantCache)     { all.cache = true; all.cacheStorage = true; }
      if (wantCookies)    all.cookies = true;
      if (wantLS)         all.localStorage = true;
      if (wantSW)       { all.serviceWorkers = true; all.cacheStorage = true; }
      if (wantIDB)        all.indexedDB = true;
      if (Object.keys(all).length) await browsingRemove({ since }, all);

      const global = {};
      if (wantHistory)   global.history   = true;
      if (wantPasswords) global.passwords = true;
      if (wantFormData)  global.formData  = true;
      if (wantDownloads) global.downloads = true;
      if (Object.keys(global).length) await browsingRemove({ since: sinceGlobal }, global);
    }

    // 5. Success
    resetBtn(btn);
    const list = [wantCache&&'Cache',wantCookies&&'Cookies',wantLS&&'LocalStorage+Session',wantSW&&'ServiceWorkers',wantIDB&&'IndexedDB',wantHistory&&'History',wantPasswords&&'Passwords',wantFormData&&'FormData',wantDownloads&&'Downloads'].filter(Boolean).join(', ');
    showToast('ok','✓ All Cleared!',`${list} wiped from ${clearScope==='site'?TARGET:'entire browser'}.`,toastEl,titleEl,msgEl,icoEl);
    ripple();

    // 6. Reload current tab only — never redirect or open new tab
    if (document.getElementById('autoReload').checked) {
      setTimeout(async () => {
        if (isOnSite && tab) await chrome.tabs.reload(tab.id, { bypassCache: true });
        window.close();
      }, 1400);
    }
    setTimeout(() => runAnalysis(), 1900);

  } catch (err) {
    resetBtn(btn);
    showToast('err','Clear Failed',(err&&err.message)||'Check extension permissions.',toastEl,titleEl,msgEl,icoEl);
  }
}

function browsingRemove(opts, types) {
  return new Promise((res, rej) => {
    chrome.browsingData.remove(opts, types, () =>
      chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res());
  });
}
function hideToast() { document.getElementById('toast').classList.remove('show','err'); }
function showToast(type,title,msg,toast,titleEl,msgEl,icoEl) {
  titleEl.textContent = title; msgEl.textContent = msg;
  icoEl.innerHTML = type==='ok'
    ? `<svg viewBox="0 0 24 24" fill="none" style="width:24px;height:24px"><circle cx="12" cy="12" r="10" stroke="url(#tg)" stroke-width="2"/><path d="M7.5 12.5l3 3 6-7" stroke="url(#tg)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="tg" x1="2" y1="2" x2="22" y2="22"><stop stop-color="#8b83ff"/><stop offset="1" stop-color="#3fd4c8"/></linearGradient></defs></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" style="width:24px;height:24px"><circle cx="12" cy="12" r="10" stroke="#ff6b6b" stroke-width="2"/><path d="M8 8l8 8M16 8l-8 8" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round"/></svg>`;
  setTimeout(() => { toast.classList.add('show'); if(type==='err') toast.classList.add('err'); }, 20);
}
function resetBtn(btn) { btn.classList.remove('loading'); btn.disabled=false; btn.querySelector('.bb-txt').textContent='Clear Now'; }
function ripple() {
  const r = document.getElementById('bbRipple'); if(!r) return;
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;top:50%;left:50%;width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.3);transform:translate(-50%,-50%) scale(0);animation:rp .65s ease-out forwards';
  if (!document.getElementById('rStyle')) { const s=document.createElement('style');s.id='rStyle';s.textContent='@keyframes rp{to{transform:translate(-50%,-50%) scale(28);opacity:0}}';document.head.appendChild(s); }
  r.appendChild(el); setTimeout(() => el.remove(), 700);
}

// ═══════════════════════════════════════════════
//  ANALYSIS TAB
// ═══════════════════════════════════════════════
async function runAnalysis() {
  let tabs;
  try { tabs = await chrome.tabs.query({ active: true, currentWindow: true }); } catch (e) { return; }
  if (!tabs || !tabs.length) return;
  currentTab = tabs[0];
  const url = currentTab.url || '';
  const isOnSite = url.includes(TARGET);

  const dot = document.getElementById('pillDot');
  const txt = document.getElementById('pillTxt');
  if (dot) dot.className = 'pill-dot' + (isOnSite ? '' : ' warn');
  let hostname = ''; try { hostname = new URL(url).hostname; } catch (_) {}
  if (txt) txt.textContent = isOnSite ? TARGET : (hostname || 'other site');

  let data = null;
  const canInject = url && !url.startsWith('chrome://') && !url.startsWith('about:') && !url.startsWith('chrome-extension://');
  if (canInject) { try { const res = await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: collectData }); if (res&&res[0]) data = res[0].result; } catch (_) {} }

  let cookieCount = 0;
  try { const u = new URL(url); const cookies = await chrome.cookies.getAll({ domain: u.hostname }); cookieCount = cookies.length; } catch (_) {}

  const urlBar = document.getElementById('urlBar');
  if (urlBar) urlBar.innerHTML = `
    <img class="url-fav" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=32" onerror="this.style.display='none'"/>
    <div class="url-col">
      <div class="url-title">${esc(currentTab.title||'Unknown')}</div>
      <div class="url-href">${url.replace(/^https?:\/\//,'').substring(0,58)}</div>
    </div>
    <span class="url-chip ${isOnSite?'on':'off'}">${isOnSite?'TARGET':'OTHER'}</span>`;

  const lt = data ? Math.round(data.loadTime) : '—';
  const sr = document.getElementById('statRow');
  if (sr) {
    sr.innerHTML = [statCard('⏱',lt+(data?'ms':''),'Load Time'),statCard('🍪',cookieCount,'Cookies'),statCard('📦',data?data.totalRes:'—','Resources'),statCard('💾',data?fmtBytes(data.transferSize):'—','Page Size')].join('');
    sr.querySelectorAll('.stat-card').forEach((c,i)=>{c.style.animationDelay=(i*.07)+'s';c.classList.add('in');});
  }

  const ps = document.getElementById('perfSec');
  if (ps) {
    if (data) {
      const max = Math.max(data.dnsTime,data.tcpTime,data.ttfb,data.domLoad,lt,1500);
      ps.innerHTML = `<div class="sh"><span class="sh-txt">Performance Metrics</span><div class="sh-line"></div></div><div class="perf-list">
        ${pbar('DNS Lookup',data.dnsTime,max,pickColor(data.dnsTime,100,300))}
        ${pbar('TCP Connect',data.tcpTime,max,pickColor(data.tcpTime,150,400))}
        ${pbar('Time to 1st Byte',data.ttfb,max,pickColor(data.ttfb,300,600))}
        ${pbar('DOM Content Load',data.domLoad,max,pickColor(data.domLoad,1000,2000))}
        ${pbar('Full Page Load',lt,max,pickColor(lt,1500,3000))}</div>`;
      setTimeout(()=>ps.querySelectorAll('.pr-fill').forEach(el=>el.style.width=el.dataset.w),100);
    } else { ps.innerHTML = sh('Performance Metrics')+nodata('Cannot access performance data'); }
  }

  const rs = document.getElementById('resSec');
  if (rs) {
    if (data) {
      rs.innerHTML = `<div class="sh"><span class="sh-txt">Page Resources</span><div class="sh-line"></div></div><div class="res-grid">
        ${rc(svgImg(),data.images,'Images')}${rc(svgJs(),data.scripts,'Scripts')}${rc(svgCss(),data.stylesheets,'Stylesheets')}
        ${rc(svgLink(),data.links,'Links')}${rc(svgIframe(),data.iframes,'iFrames')}${rc(svgFont(),data.fonts,'Fonts')}</div>`;
    } else { rs.innerHTML = sh('Page Resources')+nodata('Resource data unavailable'); }
  }

  const ss = document.getElementById('storeSec');
  if (ss) {
    if (data) {
      ss.innerHTML = `<div class="sh"><span class="sh-txt">Storage</span><div class="sh-line"></div></div><div class="storage-row">
        ${sto(data.lsCount,'LocalStorage')}${sto(data.ssCount,'SessionStore')}${sto(cookieCount,'Cookies')}</div>`;
    } else { ss.innerHTML = sh('Storage')+`<div class="storage-row">${sto(cookieCount,'Cookies')}${sto('—','LocalStorage')}${sto('—','SessionStore')}</div>`; }
  }

  const rab = document.getElementById('reAnalyzeBtn');
  if (rab) rab.style.display = 'flex';
}

const reBtn = document.getElementById('reAnalyzeBtn');
if (reBtn) reBtn.addEventListener('click', () => { resetSkeletons(); reBtn.style.display='none'; setTimeout(()=>runAnalysis(),300); });
function resetSkeletons() {
  const i = (id,h) => { const el=document.getElementById(id); if(el) el.innerHTML=h; };
  i('urlBar','<div class="sk sk-url"></div>');
  i('statRow','<div class="stat-card sk-card"><div class="sk s1"></div><div class="sk s2"></div></div>'.repeat(4));
  i('perfSec','<div class="sk sk-sh"></div><div class="sk sk-pb"></div><div class="sk sk-pb"></div><div class="sk sk-pb"></div>');
  i('resSec','<div class="sk sk-sh"></div><div class="res-grid"><div class="sk sk-rg"></div><div class="sk sk-rg"></div><div class="sk sk-rg"></div><div class="sk sk-rg"></div><div class="sk sk-rg"></div><div class="sk sk-rg"></div></div>');
  i('storeSec','<div class="sk sk-sh"></div><div class="storage-row"><div class="sk sk-st"></div><div class="sk sk-st"></div><div class="sk sk-st"></div></div>');
}

// ═══════════════════════════════════════════════
//  SEO TAB
// ═══════════════════════════════════════════════
async function runSEO() {
  const el = document.getElementById('seoContent');
  if (!el || !currentTab) return;
  const url = currentTab.url || '';
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) { el.innerHTML = nodata('SEO data unavailable'); return; }

  let seo = null;
  try { const res = await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: collectSEO }); if (res&&res[0]) seo = res[0].result; } catch (_) {}
  if (!seo) { el.innerHTML = nodata('Cannot run SEO analysis on this page'); return; }

  let score = 0;
  const checks = [];
  const add = (ok,name,val,pts) => { checks.push({ok,name,val}); score+=pts; };

  seo.title&&seo.title.length>=30&&seo.title.length<=60 ? add(true,'Page Title',`"${seo.title}" (${seo.title.length} chars — optimal)`,12)
    : seo.title ? add('warn','Page Title',`"${seo.title}" (${seo.title.length} chars — ideal: 30–60)`,6)
    : add(false,'Page Title','Missing! Required for SEO.',0);

  seo.desc&&seo.desc.length>=120&&seo.desc.length<=160 ? add(true,'Meta Description',`${seo.desc.substring(0,80)}… (${seo.desc.length} chars)`,12)
    : seo.desc ? add('warn','Meta Description',`${seo.desc.substring(0,80)}… (${seo.desc.length} chars — ideal 120–160)`,6)
    : add(false,'Meta Description','Missing! Hurts click-through rate.',0);

  seo.h1Count===1 ? add(true,'H1 Tag','1 H1 — perfect',10)
    : seo.h1Count>1 ? add('warn','H1 Tag',`${seo.h1Count} H1s — use exactly 1`,5)
    : add(false,'H1 Tag','No H1 found',0);

  seo.canonical ? add(true,'Canonical URL',seo.canonical.substring(0,60),8) : add('warn','Canonical URL','Missing — duplicate content risk',0);

  const og=(seo.ogTitle?1:0)+(seo.ogDesc?1:0)+(seo.ogImg?1:0);
  og===3 ? add(true,'Open Graph','Title ✓  Description ✓  Image ✓',12)
    : og>0 ? add('warn','Open Graph',`${og}/3 tags present`,5)
    : add(false,'Open Graph','No OG tags — social shares won\'t preview',0);

  seo.twitterCard ? add(true,'Twitter Card',`Type: ${seo.twitterCard}`,8) : add('warn','Twitter Card','No twitter:card meta',0);

  const robOk = !seo.robots||(!seo.robots.includes('noindex')&&!seo.robots.includes('nofollow'));
  robOk ? add(true,'Robots Meta',seo.robots||'Not set (index, follow)',8) : add(false,'Robots Meta',`"${seo.robots}" — may block indexing!`,0);

  seo.hasSchema ? add(true,'Structured Data','JSON-LD found — rich snippets enabled',10) : add('warn','Structured Data','No JSON-LD schema',0);
  seo.viewport ? add(true,'Viewport',seo.viewport,10) : add(false,'Viewport','Missing — mobile rendering broken!',0);
  seo.lang ? add(true,'Language',`<html lang="${seo.lang}">`,5) : add('warn','Language','No lang attribute',0);
  seo.hasFavicon ? add(true,'Favicon','Favicon found',5) : add('warn','Favicon','No favicon detected',0);

  const fs = Math.min(100,Math.round(score));
  const grade = fs>=85?'Excellent':fs>=65?'Good':fs>=45?'Needs Work':'Poor';
  const strokeOffset = 163-(fs/100)*163;

  el.innerHTML = `
    <div class="seo-score-wrap">
      <div class="seo-ring-wrap">
        <svg viewBox="0 0 64 64"><circle class="seo-ring-bg" cx="32" cy="32" r="26"/>
          <circle class="seo-ring-fg" cx="32" cy="32" r="26" stroke="url(#sg)" style="stroke-dashoffset:${strokeOffset}"/>
          <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="${fs>=85?'#27ae60':fs>=65?'#8b83ff':fs>=45?'#f4a535':'#ff6b6b'}"/>
            <stop offset="1" stop-color="#3fd4c8"/></linearGradient></defs></svg>
        <div class="seo-score-num"><span class="seo-n">${fs}</span><span class="seo-pct">/ 100</span></div>
      </div>
      <div class="seo-meta"><div class="seo-grade">${grade} SEO</div>
        <div class="seo-summary">${checks.filter(c=>c.ok===true).length} passed · ${checks.filter(c=>c.ok==='warn').length} warnings · ${checks.filter(c=>!c.ok).length} errors</div></div>
    </div>
    <div class="sh"><span class="sh-txt">Heading Structure</span><div class="sh-line"></div></div>
    <div class="headings-grid">${['H1','H2','H3','H4','H5','H6'].map((h,i)=>`
      <div class="hg" style="animation-delay:${i*.06}s">
        <div class="hg-n">${[seo.h1Count,seo.h2Count,seo.h3Count,seo.h4Count,seo.h5Count,seo.h6Count][i]}</div>
        <div class="hg-l">${h}</div></div>`).join('')}</div>
    <div class="sh"><span class="sh-txt">SEO Checks</span><div class="sh-line"></div></div>
    <div class="seo-checks">${checks.map((c,i)=>`
      <div class="seo-chk" style="animation-delay:${i*.04}s">
        <div class="seo-chk-ico ${c.ok===true?'ico-ok':c.ok==='warn'?'ico-warn':'ico-err'}">
          ${c.ok===true?svgTick():c.ok==='warn'?svgWarn():svgX()}</div>
        <div class="seo-chk-body"><div class="seo-chk-name">${esc(c.name)}</div><div class="seo-chk-val">${esc(c.val)}</div></div>
      </div>`).join('')}</div>`;
}

// ═══════════════════════════════════════════════
//  IMAGES TAB
// ═══════════════════════════════════════════════
async function runImages() {
  const toolbar=document.getElementById('imgToolbar'), grid=document.getElementById('imgGrid'), countEl=document.getElementById('imgCount');
  if(!grid) return;
  if(!currentTab){grid.innerHTML=nodata('No page loaded');return;}
  const url=currentTab.url||'';
  const canInject=url&&!url.startsWith('chrome://')&&!url.startsWith('about:');
  if(!canInject){grid.innerHTML=nodata('Cannot access images on this page type');if(toolbar)toolbar.style.display='none';return;}

  let images=[];
  try{const res=await chrome.scripting.executeScript({target:{tabId:currentTab.id},func:collectImages});if(res&&res[0])images=res[0].result||[];}catch(_){}
  if(toolbar)toolbar.style.display='flex';
  if(countEl)countEl.textContent=`${images.length} image${images.length!==1?'s':''} found`;

  if(!images.length){grid.innerHTML=`<div class="no-images" style="grid-column:span 2">${svgNoImg()}<div>No images found</div></div>`;return;}

  grid.innerHTML=images.map((img,i)=>{
    const name=img.src.split('/').pop().split('?')[0].substring(0,20)||'image';
    const dim=img.w&&img.h?`${img.w}×${img.h}`:img.naturalW&&img.naturalH?`${img.naturalW}×${img.naturalH}`:'';
    return `<div class="img-card" style="animation-delay:${i*.05}s">
      <div class="img-thumb-wrap"><img class="img-thumb" src="${esc(img.src)}" alt="${esc(img.alt)}" loading="lazy" onerror="this.parentElement.style.background='rgba(139,131,255,.06)'"/><div class="img-overlay"></div></div>
      <div class="img-footer"><span class="img-name" title="${esc(img.src)}">${esc(name||'Image '+(i+1))}</span>${dim?`<span class="img-dim">${dim}</span>`:''}<button class="btn-dl" data-src="${esc(img.src)}" data-name="${esc(name||'image-'+(i+1))}" title="Download"><svg viewBox="0 0 14 14" fill="none"><path d="M7 2v7M4.5 6.5L7 9l2.5-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 11h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button></div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.btn-dl').forEach(btn=>{
    btn.addEventListener('click',()=>{
      chrome.runtime.sendMessage({type:'DOWNLOAD_IMAGE',url:btn.dataset.src,filename:btn.dataset.name});
      btn.classList.add('done');
      btn.innerHTML=`<svg viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    });
  });

  const dlAll=document.getElementById('dlAllBtn');
  if(dlAll) dlAll.onclick=()=>images.forEach((img,i)=>{const f=img.src.split('/').pop().split('?')[0]||`image-${i+1}`;setTimeout(()=>chrome.runtime.sendMessage({type:'DOWNLOAD_IMAGE',url:img.src,filename:f}),i*200);});
}

// ═══════════════════════════════════════════════
//  COPY MODE TAB
// ═══════════════════════════════════════════════
function initCopyPanel() {
  // Check current state in the page
  checkCopyState();

  const toggle = document.getElementById('copyToggle');
  if (!toggle || toggle._initialized) return;
  toggle._initialized = true;

  toggle.addEventListener('change', async () => {
    if (toggle.checked) {
      await enableCopyOnPage();
    } else {
      await disableCopyOnPage();
    }
    updateCopyUI(toggle.checked);
  });

  document.getElementById('clrLogBtn').addEventListener('click', () => {
    copyLog = [];
    renderCopyLog();
  });
}

async function checkCopyState() {
  if (!currentTab) return;
  const url = currentTab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('about:')) return;
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => !!(window.__ulmCopyActive)
    });
    if (res && res[0]) {
      const active = res[0].result;
      const toggle = document.getElementById('copyToggle');
      if (toggle) toggle.checked = active;
      updateCopyUI(active);
    }
  } catch (_) {}
}

async function enableCopyOnPage() {
  if (!currentTab) return;
  const url = currentTab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('chrome-extension://')) {
    alert('Copy mode cannot be used on browser system pages. Please navigate to a regular website first.');
    document.getElementById('copyToggle').checked = false;
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: function injectCopyMode() {
        if (window.__ulmCopyActive) return;
        window.__ulmCopyActive = true;

        // Inject styles
        const style = document.createElement('style');
        style.id = '__ulm_copy_style';
        style.textContent = `
          body.__ulm_copy_mode,
          body.__ulm_copy_mode * {
            cursor: copy !important;
          }
          body.__ulm_copy_mode *:hover {
            outline: 2px solid rgba(139,131,255,0.7) !important;
            outline-offset: 2px !important;
            background-color: rgba(139,131,255,0.06) !important;
          }
          .__ulm_copy_toast {
            position: fixed !important;
            z-index: 2147483647 !important;
            background: linear-gradient(135deg,#5f57e0,#22b5aa) !important;
            color: #fff !important;
            font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            padding: 8px 16px !important;
            border-radius: 50px !important;
            box-shadow: 0 8px 28px rgba(95,87,224,0.5) !important;
            pointer-events: none !important;
            animation: __ulm_fadeout 1.2s ease forwards !important;
            white-space: nowrap !important;
          }
          @keyframes __ulm_fadeout {
            0%   { opacity:1; transform:translateY(0) scale(1); }
            70%  { opacity:1; transform:translateY(-6px) scale(1); }
            100% { opacity:0; transform:translateY(-14px) scale(0.9); }
          }`;
        document.head.appendChild(style);
        document.body.classList.add('__ulm_copy_mode');

        window.__ulmCopyHandler = function(e) {
          const el = e.target;
          if (!el || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
          e.preventDefault();
          e.stopPropagation();

          const text = (el.innerText || el.textContent || '').trim();
          if (!text) return;

          // Copy to clipboard
          function fallback(t) {
            const ta = document.createElement('textarea');
            ta.value = t; ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
            document.body.appendChild(ta); ta.focus(); ta.select();
            try { document.execCommand('copy'); } catch(_) {}
            ta.remove();
          }

          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).catch(() => fallback(text));
            } else { fallback(text); }
          } catch(_) { fallback(text); }

          // Show floating toast near cursor
          const toast = document.createElement('div');
          toast.className = '__ulm_copy_toast';
          toast.textContent = `✓ Copied! (${text.length} chars)`;
          toast.style.top  = (e.clientY - 50) + 'px';
          toast.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 1300);
        };

        document.addEventListener('click', window.__ulmCopyHandler, true);
      }
    });
  } catch (err) {
    console.warn('Copy mode injection failed:', err);
  }
}

async function disableCopyOnPage() {
  if (!currentTab) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: function removeCopyMode() {
        window.__ulmCopyActive = false;
        document.body.classList.remove('__ulm_copy_mode');
        if (window.__ulmCopyHandler) {
          document.removeEventListener('click', window.__ulmCopyHandler, true);
          window.__ulmCopyHandler = null;
        }
        const style = document.getElementById('__ulm_copy_style');
        if (style) style.remove();
      }
    });
  } catch (_) {}
}

function updateCopyUI(active) {
  const dot   = document.getElementById('csDot');
  const lbl   = document.getElementById('csLbl');
  const box   = document.getElementById('copyInfoBox');
  const logW  = document.getElementById('copyLogWrap');

  if (dot) { dot.className = 'cs-dot ' + (active ? 'on' : 'off'); }
  if (lbl) { lbl.textContent = active ? 'Active — click any element to copy' : 'Disabled'; lbl.className = 'cs-lbl' + (active ? ' on' : ''); }
  if (box) {
    box.className = 'copy-info-box' + (active ? ' active' : '');
    box.querySelector('.cib-ico').style.background = active ? 'rgba(63,212,200,.15)' : 'rgba(139,131,255,.1)';
    box.querySelector('.cib-ico').style.color      = active ? 'var(--p2)' : '';
    box.querySelector('.cib-txt').innerHTML = active
      ? 'Mode is <strong>ON</strong> — hover any text and click to copy it instantly'
      : 'Mode is <strong>OFF</strong> — toggle to activate';
  }
  if (logW) logW.style.display = copyLog.length > 0 ? 'block' : 'none';
}

function addToCopyLog(text) {
  copyLog.unshift({ text, time: Date.now() });
  if (copyLog.length > 10) copyLog.pop();
  renderCopyLog();
}

function renderCopyLog() {
  const logEl = document.getElementById('copyLog');
  const logW  = document.getElementById('copyLogWrap');
  if (!logEl || !logW) return;
  logW.style.display = copyLog.length > 0 ? 'block' : 'none';
  logEl.innerHTML = copyLog.map((item, i) => `
    <div class="copy-log-item" style="animation-delay:${i*.05}s">
      <div class="cli-txt">${esc(item.text)}</div>
      <button class="cli-copy" data-text="${esc(item.text)}">Copy</button>
    </div>`).join('');
  logEl.querySelectorAll('.cli-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      writeToClipboard(btn.dataset.text);
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
    });
  });
}

function writeToClipboard(text) {
  try {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => fallbackClipboard(text));
    else fallbackClipboard(text);
  } catch(_) { fallbackClipboard(text); }
}
function fallbackClipboard(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;top:-999px;opacity:0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(_) {} ta.remove();
}

// ═══════════════════════════════════════════════
//  LINKS TAB
// ═══════════════════════════════════════════════
let allLinks = [];

function initLinksPanel() {
  const scanBtn = document.getElementById('scanLinksBtn');
  const filterEl = document.getElementById('linksFilter');
  const copyAllBtn = document.getElementById('copyAllLinksBtn');

  if (scanBtn && !scanBtn._initialized) {
    scanBtn._initialized = true;
    scanBtn.addEventListener('click', scanLinks);
  }

  if (filterEl && !filterEl._initialized) {
    filterEl._initialized = true;
    filterEl.addEventListener('input', () => renderLinks(filterEl.value.trim()));
  }

  if (copyAllBtn && !copyAllBtn._initialized) {
    copyAllBtn._initialized = true;
    copyAllBtn.addEventListener('click', () => {
      const filtered = allLinks.filter(l => !filterEl || !filterEl.value || l.href.includes(filterEl.value) || l.text.toLowerCase().includes(filterEl.value.toLowerCase()));
      const text = filtered.map(l => l.href).join('\n');
      writeToClipboard(text);
      copyAllBtn.textContent = `✓ Copied ${filtered.length} links`;
      setTimeout(() => {
        copyAllBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><rect x="2" y="5" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5V3.5A1.5 1.5 0 0 1 6.5 2h7A1.5 1.5 0 0 1 15 3.5v9A1.5 1.5 0 0 1 13.5 14H12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg> Copy All`;
      }, 1800);
    });
  }
}

async function scanLinks() {
  const listEl   = document.getElementById('linksList');
  const countEl  = document.getElementById('lnkCount');
  const filterEl = document.getElementById('linksFilter');
  const copyAllBtn = document.getElementById('copyAllLinksBtn');
  if (!listEl) return;

  listEl.innerHTML = '<div class="no-data">Scanning…</div>';

  if (!currentTab) { listEl.innerHTML = nodata('No active tab'); return; }
  const url = currentTab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('about:')) { listEl.innerHTML = nodata('Cannot access this page type'); return; }

  try {
    const res = await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: collectLinks });
    allLinks = (res && res[0] && res[0].result) || [];
  } catch (_) { allLinks = []; }

  if (countEl) countEl.textContent = allLinks.length;
  if (filterEl) filterEl.style.display = allLinks.length > 0 ? 'block' : 'none';
  if (copyAllBtn) copyAllBtn.style.display = allLinks.length > 0 ? 'flex' : 'none';

  renderLinks('');
}

function renderLinks(filter) {
  const listEl = document.getElementById('linksList');
  if (!listEl) return;
  const filtered = filter
    ? allLinks.filter(l => l.href.toLowerCase().includes(filter.toLowerCase()) || l.text.toLowerCase().includes(filter.toLowerCase()))
    : allLinks;

  if (!filtered.length) {
    listEl.innerHTML = nodata(filter ? 'No links match your filter' : 'No external links found on this page');
    return;
  }

  listEl.innerHTML = filtered.slice(0, 80).map((link, i) => {
    let domain = '';
    try { domain = new URL(link.href).hostname; } catch(_) {}
    return `<div class="link-item" style="animation-delay:${i*.03}s">
      <img class="li-fav" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32" onerror="this.style.display='none'"/>
      <div class="li-body">
        <div class="li-text">${esc(link.text || domain || 'Link')}</div>
        <div class="li-href">${esc(link.href.replace(/^https?:\/\//,'').substring(0, 55))}</div>
      </div>
      <div class="li-actions">
        <button class="li-btn" data-href="${esc(link.href)}" data-action="open">Open</button>
        <button class="li-btn" data-href="${esc(link.href)}" data-action="copy">Copy</button>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.li-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'open') {
        chrome.tabs.create({ url: btn.dataset.href });
      } else {
        writeToClipboard(btn.dataset.href);
        btn.textContent = '✓';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
      }
    });
  });
}

// ═══════════════════════════════════════════════
//  AI CONTENT DETECTOR TAB
// ═══════════════════════════════════════════════
function initAIPanel() {
  const textarea = document.getElementById('aiInput');
  const analyzeBtn = document.getElementById('aiAnalyzeBtn');
  const clearBtn = document.getElementById('aiClearBtn');
  const wcEl = document.getElementById('aiWc');

  if (textarea && !textarea._initialized) {
    textarea._initialized = true;
    textarea.addEventListener('input', () => {
      const words = (textarea.value.match(/\b\w+\b/g) || []).length;
      if (wcEl) wcEl.textContent = words + ' word' + (words !== 1 ? 's' : '');
    });
  }

  if (clearBtn && !clearBtn._initialized) {
    clearBtn._initialized = true;
    clearBtn.addEventListener('click', () => {
      if (textarea) { textarea.value = ''; if (wcEl) wcEl.textContent = '0 words'; }
      const result = document.getElementById('aiResult');
      if (result) result.style.display = 'none';
    });
  }

  if (analyzeBtn && !analyzeBtn._initialized) {
    analyzeBtn._initialized = true;
    analyzeBtn.addEventListener('click', () => {
      const text = textarea ? textarea.value.trim() : '';
      if (!text) { alert('Please paste some text first.'); return; }
      const words = (text.match(/\b\w+\b/g) || []).length;
      if (words < 30) { alert('Please paste at least 30 words for accurate analysis.'); return; }
      const result = detectAI(text);
      renderAIResult(result);
    });
  }
}

// ── Heuristic AI Detector ──────────────────────
function detectAI(text) {
  const words     = text.toLowerCase().match(/\b\w+\b/g) || [];
  const wordSet   = new Set(words);
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.length > 10);

  // 1. Type-Token Ratio (vocabulary diversity)
  //    Humans: 0.30–0.55  |  AI: 0.50–0.75 (more varied vocabulary)
  const ttr = wordSet.size / Math.max(words.length, 1);

  // 2. Sentence length variance (burstiness)
  //    Humans write in "bursts" — short then long. AI is more uniform.
  const sentLens = sentences.map(s => (s.match(/\b\w+\b/g) || []).length);
  const avgLen   = sentLens.reduce((a, b) => a + b, 0) / Math.max(sentLens.length, 1);
  const variance = sentLens.reduce((a, b) => a + Math.pow(b - avgLen, 2), 0) / Math.max(sentLens.length, 1);
  const cv       = avgLen > 0 ? Math.sqrt(variance) / avgLen : 0.5; // Coefficient of Variation

  // 3. Known AI phrases / signatures
  const AI_PHRASES = [
    'in conclusion','in summary','to summarize','it is important to note',
    "it's important to","it is worth noting","it's worth noting",
    'furthermore','moreover','additionally','consequently','nevertheless',
    'delve into','dive into','in the realm of','as we explore',
    'as we navigate','in today\'s world','in today\'s fast-paced',
    'it is crucial','it is essential','needless to say',
    'plays a crucial role','plays an important role','plays a vital role',
    'when it comes to','at the end of the day','it\'s clear that',
    'it is clear that','revolutionize','game-changing','transformative',
    'leverage','utilize','overall,','ultimately,','in essence',
    'rest assured','certainly,','absolutely,','undoubtedly'
  ];
  const textLower = text.toLowerCase();
  const foundPhrases = AI_PHRASES.filter(p => textLower.includes(p));

  // 4. Average sentence length
  //    AI tends: 15–24 words/sentence consistently

  // 5. Passive voice indicators
  const passiveCount = (text.match(/\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi) || []).length;
  const passiveRatio = passiveCount / Math.max(sentences.length, 1);

  // ── Score calculation (0–100, higher = more AI) ──
  let score = 30; // neutral baseline

  // TTR component (0–30 pts)
  if (ttr >= 0.70)      score += 30;
  else if (ttr >= 0.60) score += 22;
  else if (ttr >= 0.50) score += 14;
  else if (ttr >= 0.40) score += 6;
  else                  score -= 5;   // very repetitive → human

  // Sentence uniformity component (0–28 pts)
  if (cv <= 0.15)       score += 28;  // extremely uniform → AI
  else if (cv <= 0.25)  score += 22;
  else if (cv <= 0.35)  score += 14;
  else if (cv <= 0.50)  score += 5;
  else                  score -= 8;   // very bursty → human

  // AI phrases component (0–30 pts)
  score += Math.min(30, foundPhrases.length * 7);

  // Sentence length sweet-spot (AI: 15–24 words)
  if (avgLen >= 14 && avgLen <= 25) score += 10;
  else if (avgLen < 8 || avgLen > 32) score -= 10;

  // Passive voice (AI uses more passive)
  if (passiveRatio > 0.35) score += 8;
  else if (passiveRatio < 0.1) score -= 5;

  // Not enough data
  if (sentences.length < 4) score = 50;

  const finalScore = Math.min(96, Math.max(4, Math.round(score)));

  return {
    score:        finalScore,
    ttr:          Math.round(ttr * 100),
    cv:           Math.round(cv * 100),
    avgSentLen:   Math.round(avgLen),
    sentCount:    sentences.length,
    wordCount:    words.length,
    foundPhrases,
    passiveRatio: Math.round(passiveRatio * 100),
    verdict:      finalScore >= 72 ? 'Likely AI'   :
                  finalScore >= 50 ? 'Possibly AI'  :
                  finalScore >= 32 ? 'Mixed'         : 'Likely Human',
  };
}

function renderAIResult(r) {
  const result = document.getElementById('aiResult');
  if (!result) return;

  const isAI    = r.score >= 72;
  const isMixed = r.score >= 50;
  const ringOffset = 183 - (r.score / 100) * 183;
  const color = r.score >= 72 ? '#8b83ff' : r.score >= 50 ? '#f4a535' : '#3fd4c8';
  const wrapCls = r.score >= 72 ? 'ai-ai' : r.score >= 50 ? 'ai-mixed' : 'ai-human';

  result.style.display = 'block';
  result.innerHTML = `
    <div class="ai-score-wrap ${wrapCls}">
      <div class="ai-ring-wrap">
        <svg viewBox="0 0 64 64">
          <circle class="air-bg" cx="32" cy="32" r="29"/>
          <circle class="air-fg" cx="32" cy="32" r="29" stroke="${color}" style="stroke-dashoffset:${ringOffset}"/>
        </svg>
        <div class="air-score">
          <span class="air-n" style="color:${color}">${r.score}%</span>
          <span class="air-l">AI PROB</span>
        </div>
      </div>
      <div class="ai-verdict-wrap">
        <div class="ai-verdict" style="color:${color}">${r.verdict}</div>
        <div class="ai-verdict-sub">${r.wordCount} words · ${r.sentCount} sentences analyzed</div>
        <div class="ai-verdict-sub" style="margin-top:4px">${r.foundPhrases.length} AI phrase${r.foundPhrases.length!==1?'s':''} detected</div>
      </div>
    </div>

    <div class="ai-metrics">
      ${aiMetric('Vocabulary Diversity', r.ttr, 100, color, r.ttr+'%', r.ttr>60?'High — AI-like':r.ttr>45?'Moderate':'Low — Human-like')}
      ${aiMetric('Sentence Uniformity', Math.max(0,100-r.cv), 100, color, r.cv+'% variation', r.cv<25?'Very Uniform (AI)':r.cv<45?'Moderate':'Varied (Human)')}
      ${aiMetric('Avg Sentence Length', Math.min(100,r.avgSentLen*4), 100, color, r.avgSentLen+' words', r.avgSentLen>=14&&r.avgSentLen<=25?'AI-typical range':'Outside AI range')}
      ${aiMetric('Passive Voice Usage', r.passiveRatio, 100, color, r.passiveRatio+'%', r.passiveRatio>35?'Heavy (AI-like)':r.passiveRatio>15?'Moderate':'Low (Human-like)')}
    </div>

    ${r.foundPhrases.length > 0 ? `
    <div class="ai-phrases">
      <div class="ai-phrases-title">AI Phrases Detected</div>
      <div class="phrase-tags">${r.foundPhrases.map(p=>`<span class="phrase-tag">${esc(p)}</span>`).join('')}</div>
    </div>` : ''}

    <div class="seo-chk" style="margin-bottom:8px">
      <div class="seo-chk-ico ${isAI?'ico-warn':isMixed?'ico-warn':'ico-ok'}">${isAI?svgWarn():isMixed?svgWarn():svgTick()}</div>
      <div class="seo-chk-body">
        <div class="seo-chk-name">Analysis Disclaimer</div>
        <div class="seo-chk-val">Heuristic analysis — no detector is 100% accurate. Results are probabilistic estimates based on writing patterns.</div>
      </div>
    </div>`;

  // Animate ring
  setTimeout(() => {
    const fg = result.querySelector('.air-fg');
    if (fg) fg.style.strokeDashoffset = ringOffset;
  }, 80);

  // Animate metric bars
  setTimeout(() => {
    result.querySelectorAll('.am-bar').forEach(b => { b.style.width = b.dataset.w; });
  }, 100);
}

function aiMetric(label, val, max, color, valTxt, desc) {
  const pct = Math.min(100, Math.round((val / max) * 100));
  return `<div class="ai-metric">
    <div class="am-label">${label}</div>
    <div class="am-bar-wrap"><div class="am-bar" data-w="${pct}%" style="width:0;background:${color}"></div></div>
    <div class="am-val">${esc(valTxt)}</div>
    <div class="am-desc">${esc(desc)}</div>
  </div>`;
}

// ═══════════════════════════════════════════════
//  SEARCH BAR TAB
// ═══════════════════════════════════════════════
let customEngines = [];

async function initSearchPanel() {
  // Load custom engines
  try {
    const stored = await chrome.storage.local.get('customEngines');
    customEngines = stored.customEngines || [];
  } catch (_) { customEngines = []; }

  renderEngineGrid();
  renderCustomEngines();

  const searchInput = document.getElementById('searchInput');
  const sbClear     = document.getElementById('sbClear');
  const suggestEl   = document.getElementById('searchSuggestions');

  if (searchInput && !searchInput._initialized) {
    searchInput._initialized = true;

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      sbClear.style.display = q ? 'flex' : 'none';
      if (q.length >= 2) {
        fetchSuggestions(q);
      } else {
        suggestEl.style.display = 'none';
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) {
          chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(q)}` });
          window.close();
        }
      }
    });
  }

  if (sbClear && !sbClear._initialized) {
    sbClear._initialized = true;
    sbClear.addEventListener('click', () => {
      searchInput.value = '';
      sbClear.style.display = 'none';
      suggestEl.style.display = 'none';
      searchInput.focus();
    });
  }

  const addBtn = document.getElementById('aeAddBtn');
  if (addBtn && !addBtn._initialized) {
    addBtn._initialized = true;
    addBtn.addEventListener('click', addCustomEngine);
  }
}

async function fetchSuggestions(q) {
  const suggestEl = document.getElementById('searchSuggestions');
  if (!suggestEl) return;
  try {
    // Google Suggest API (works in extension context with <all_urls> permission)
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    const suggestions = data[1] || [];
    if (!suggestions.length) { suggestEl.style.display = 'none'; return; }

    suggestEl.style.display = 'block';
    suggestEl.innerHTML = suggestions.slice(0, 6).map(s => `
      <div class="sg-item" data-q="${esc(s)}">
        <svg viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.3"/><path d="M9 9l2.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        ${esc(s)}
      </div>`).join('');

    suggestEl.querySelectorAll('.sg-item').forEach(item => {
      item.addEventListener('click', () => {
        const qry = item.dataset.q;
        chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(qry)}` });
        window.close();
      });
    });
  } catch (_) {
    suggestEl.style.display = 'none';
  }
}

function renderEngineGrid() {
  const grid = document.getElementById('engineGrid');
  if (!grid) return;
  const searchInput = document.getElementById('searchInput');

  grid.innerHTML = DEFAULT_ENGINES.map(eng => `
    <button class="engine-btn" data-url="${esc(eng.url)}" data-name="${esc(eng.name)}" title="${esc(eng.name)}">
      <div class="eb-logo" style="background:${eng.color}20;border:1px solid ${eng.color}40;color:${eng.color}">${esc(eng.icon)}</div>
      <span class="eb-name">${esc(eng.name)}</span>
    </button>`).join('');

  grid.querySelectorAll('.engine-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = (searchInput && searchInput.value.trim()) || '';
      const url = btn.dataset.url.replace('{q}', encodeURIComponent(q || btn.dataset.name + ' search'));
      chrome.tabs.create({ url });
      if (q) window.close();
    });
  });
}

function renderCustomEngines() {
  const listEl = document.getElementById('customEngineList');
  const wrap   = document.getElementById('customEnginesWrap');
  const searchInput = document.getElementById('searchInput');
  if (!listEl || !wrap) return;

  wrap.style.display = customEngines.length > 0 ? 'block' : 'none';

  listEl.innerHTML = customEngines.map((eng, i) => `
    <div class="ce-item">
      <div class="eb-logo" style="width:22px;height:22px;font-size:10px;border-radius:5px;background:linear-gradient(135deg,rgba(139,131,255,.25),rgba(63,212,200,.15));color:var(--p1);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:900">${esc(eng.name[0].toUpperCase())}</div>
      <div class="ce-name">${esc(eng.name)}</div>
      <div class="ce-url">${esc(eng.url)}</div>
      <button class="ce-del" data-i="${i}" title="Delete">×</button>
    </div>`).join('');

  // Make custom engine items clickable to search
  listEl.querySelectorAll('.ce-item').forEach((item, i) => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('ce-del')) return;
      const q = (searchInput && searchInput.value.trim()) || '';
      const url = customEngines[i].url.replace('{q}', encodeURIComponent(q || ''));
      chrome.tabs.create({ url });
      if (q) window.close();
    });
  });

  // Delete buttons
  listEl.querySelectorAll('.ce-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.i);
      customEngines.splice(idx, 1);
      await chrome.storage.local.set({ customEngines });
      renderCustomEngines();
      // Also re-add to grid if needed
    });
  });
}

async function addCustomEngine() {
  const nameEl = document.getElementById('aeName');
  const urlEl  = document.getElementById('aeUrl');
  const name   = nameEl ? nameEl.value.trim() : '';
  const url    = urlEl  ? urlEl.value.trim()  : '';

  if (!name) { nameEl && nameEl.focus(); return; }
  if (!url || !url.includes('{q}')) {
    alert('URL must contain {q} as the search placeholder.\nExample: https://example.com/search?q={q}');
    return;
  }

  customEngines.push({ name, url });
  await chrome.storage.local.set({ customEngines });

  if (nameEl) nameEl.value = '';
  if (urlEl)  urlEl.value  = '';

  renderCustomEngines();
}

// ═══════════════════════════════════════════════
//  PAGE DATA COLLECTORS (run in page context)
// ═══════════════════════════════════════════════
function collectData() {
  const perf = performance.getEntriesByType('navigation')[0];
  const res  = performance.getEntriesByType('resource');
  let ls=0,ss=0;
  try{ls=localStorage.length;}catch(_){}
  try{ss=sessionStorage.length;}catch(_){}
  return {
    loadTime:     perf ? perf.loadEventEnd - perf.startTime : 0,
    dnsTime:      perf ? Math.round(perf.domainLookupEnd - perf.domainLookupStart) : 0,
    tcpTime:      perf ? Math.round(perf.connectEnd - perf.connectStart) : 0,
    ttfb:         perf ? Math.round(perf.responseStart - perf.requestStart) : 0,
    domLoad:      perf ? Math.round(perf.domContentLoadedEventEnd - perf.startTime) : 0,
    transferSize: perf ? (perf.transferSize || 0) : 0,
    totalRes:     res.length,
    images:       document.images.length,
    scripts:      document.scripts.length,
    stylesheets:  document.styleSheets.length,
    links:        document.links.length,
    iframes:      document.querySelectorAll('iframe').length,
    fonts:        res.filter(r=>/\.(woff2?|ttf|otf)/.test(r.name)).length,
    lsCount:      ls, ssCount: ss,
  };
}

function collectSEO() {
  const qs=s=>document.querySelector(s), qsa=s=>document.querySelectorAll(s);
  const meta=n=>((qs(`meta[name="${n}"]`)||qs(`meta[property="${n}"]`)||{}).content||'');
  return {
    title:document.title, desc:meta('description'), keywords:meta('keywords'),
    robots:meta('robots'), canonical:(qs('link[rel="canonical"]')||{}).href||'',
    ogTitle:meta('og:title'), ogDesc:meta('og:description'), ogImg:meta('og:image'),
    twitterCard:meta('twitter:card'), viewport:meta('viewport'),
    lang:document.documentElement.lang||'',
    h1Count:qsa('h1').length, h2Count:qsa('h2').length, h3Count:qsa('h3').length,
    h4Count:qsa('h4').length, h5Count:qsa('h5').length, h6Count:qsa('h6').length,
    hasSchema:!!qs('script[type="application/ld+json"]'),
    hasFavicon:!!(qs('link[rel="icon"]')||qs('link[rel="shortcut icon"]')),
  };
}

function collectImages() {
  return Array.from(document.images)
    .filter(img=>img.src&&img.src.startsWith('http')&&img.naturalWidth>10)
    .slice(0,40)
    .map(img=>({src:img.src,alt:img.alt||'',w:img.width,h:img.height,naturalW:img.naturalWidth,naturalH:img.naturalHeight}));
}

function collectLinks() {
  return Array.from(document.querySelectorAll('a[href]'))
    .filter(a => {
      try { const u=new URL(a.href); return u.protocol==='https:'||u.protocol==='http:'; } catch(_){return false;}
    })
    .slice(0, 150)
    .map(a => ({
      href: a.href,
      text: (a.innerText||a.textContent||'').trim().substring(0, 80),
    }));
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
const esc       = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtBytes  = b => !b?'—':b<1024?b+'B':b<1048576?(b/1024).toFixed(1)+'KB':(b/1048576).toFixed(1)+'MB';
const pickColor = (v,w,r) => v>r?'pr2':v>w?'po':'pg';
const nodata    = msg => `<div class="no-data">${msg}</div>`;
const sh        = t => `<div class="sh"><span class="sh-txt">${t}</span><div class="sh-line"></div></div>`;
const statCard  = (em,v,l) => `<div class="stat-card"><div class="stat-em">${em}</div><div class="stat-v">${v}</div><div class="stat-l">${l}</div></div>`;
const pbar      = (l,v,max,cls) => { const p=max>0?Math.min(100,(v/max)*100).toFixed(1):0; return `<div class="pr"><span class="pr-lbl">${l}</span><div class="pr-track"><div class="pr-fill ${cls}" data-w="${p}%" style="width:0"></div></div><span class="pr-val">${v>0?v+'ms':'< 1ms'}</span></div>`; };
const rc        = (icon,n,l) => `<div class="rc">${icon}<div class="rc-n">${n}</div><div class="rc-l">${l}</div></div>`;
const sto       = (v,l) => `<div class="sto"><div class="sto-v">${v}</div><div class="sto-l">${l}</div></div>`;

const icS      = (p,c='var(--p2)',w=15,h=15) => `<svg viewBox="0 0 20 20" fill="none" style="width:${w}px;height:${h}px;color:${c}">${p}</svg>`;
const svgImg   = () => icS(`<rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M2 12l4-3.5 3.5 3.5 2.5-2.5L18 14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="7.5" r="1" fill="currentColor"/>`, 'var(--p2)');
const svgJs    = () => icS(`<path d="M5 4L2 10l3 6M15 4l3 6-3 6M10 3l-2 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`, 'var(--p1)');
const svgCss   = () => icS(`<path d="M3 2l1.5 16L10 19l5.5-1L17 2H3z" stroke="currentColor" stroke-width="1.3"/><path d="M6.5 8h7M7 12h6M8 16h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`, 'var(--p3)');
const svgLink  = () => icS(`<path d="M7 10a4 4 0 0 1 5.66-.56l1.41-1.41A6 6 0 0 0 5 16M13 10a4 4 0 0 1-5.66.56L5.93 11.97A6 6 0 0 0 15 4" stroke="currentColor" stroke-width="1.4"/>`, 'var(--p2)');
const svgIframe= () => icS(`<rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.4"/><rect x="5" y="5" width="10" height="7" rx="1" stroke="currentColor" stroke-width="1.2"/>`, 'var(--p1)');
const svgFont  = () => icS(`<path d="M4 16V4h12v2M4 10h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M10 10v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`, 'var(--p3)');
const svgTick  = () => `<svg viewBox="0 0 12 12" fill="none" style="width:10px;height:10px"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const svgWarn  = () => `<svg viewBox="0 0 12 12" fill="none" style="width:10px;height:10px"><path d="M6 3v3M6 8.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const svgX     = () => `<svg viewBox="0 0 12 12" fill="none" style="width:10px;height:10px"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const svgNoImg = () => `<svg viewBox="0 0 32 32" fill="none"><rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M4 18l6-5 5 5 4-4 7 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="12" r="1.5" fill="currentColor"/></svg>`;

// ─── BOOT ──────────────────────────────────────
runAnalysis();
