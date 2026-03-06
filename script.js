/* =====================================================
   FOCUS TAB v4 — script.js
   Grid-based resizable widgets, drag & snap, settings
   ===================================================== */

// ─── DOM refs ───────────────────────────────────────
const body = document.getElementById('body');
const settingsBtn = document.getElementById('settingsBtn');
const settingsDrawer = document.getElementById('settingsDrawer');
const settingsOverlay = document.getElementById('settingsOverlay');
const closeSettingsEl = document.getElementById('closeSettings');
const editBar = document.getElementById('editBar');
const todoList = document.getElementById('todoList');
const todoBadge = document.getElementById('todoBadge');
const todoInput = document.getElementById('todoInput');
const linksDock = document.getElementById('linksDock');
const aiListEl = document.getElementById('aiList');
const sLinksListEl = document.getElementById('sLinksList');
const sAiTogglesEl = document.getElementById('sAiToggles');
const canvasEl = document.getElementById('canvas');
const gridGhost = document.getElementById('gridGhost');

// ─── State ──────────────────────────────────────────
let todos = [];
let quickLinks = [];
let aiState = {};
let editMode = false;
let widgetLayout = {};        // { widgetId: { col, row, colSpan, rowSpan, hidden } }
let removedWidgets = new Set();

// ─── Grid constants ─────────────────────────────────
const CELL = 40;
const GAP = 12;
const PAD = 24;
const UNIT = CELL + GAP; // 52px per grid unit

// Compute how many columns/rows fit the viewport
function gridCols() { return Math.floor((window.innerWidth - PAD * 2 + GAP) / UNIT); }
function gridRows() { return Math.floor((window.innerHeight - PAD * 2 + GAP) / UNIT); }

// Per-widget default grid placement & size limits
// { col, row, colSpan, rowSpan, minCol, maxCol, minRow, maxRow }
const WIDGET_DEFAULTS = {
  clock: { col: 1, row: 1, colSpan: 4, rowSpan: 3, minCol: 2, maxCol: 8, minRow: 2, maxRow: 5 },
  weather: { col: 1, row: 5, colSpan: 3, rowSpan: 4, minCol: 2, maxCol: 6, minRow: 3, maxRow: 6 },
  date: { col: 5, row: 5, colSpan: 3, rowSpan: 4, minCol: 2, maxCol: 5, minRow: 3, maxRow: 5 },
  todo: { col: 1, row: 10, colSpan: 5, rowSpan: 5, minCol: 3, maxCol: 10, minRow: 4, maxRow: 10 },
  greeting: { col: 9, row: 4, colSpan: 10, rowSpan: 2, minCol: 4, maxCol: 16, minRow: 2, maxRow: 4 },
  search: { col: 9, row: 6, colSpan: 10, rowSpan: 3, minCol: 5, maxCol: 16, minRow: 2, maxRow: 5 },
  links: { col: 9, row: 10, colSpan: 10, rowSpan: 3, minCol: 4, maxCol: 16, minRow: 2, maxRow: 5 },
  ai: { col: -6, row: 1, colSpan: 5, rowSpan: 10, minCol: 3, maxCol: 8, minRow: 4, maxRow: 14 },
  knowledge: { col: 1, row: 15, colSpan: 5, rowSpan: 4, minCol: 3, maxCol: 8, minRow: 3, maxRow: 8 },
};

// ─── Constants ──────────────────────────────────────
const SEARCH_URL = q => `https://www.google.com/search?q=${q}`;

const favicon = domain => `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

const DEFAULT_LINKS = [
  { name: 'YouTube', url: 'https://youtube.com', icon: favicon('youtube.com') },
  { name: 'GitHub', url: 'https://github.com', icon: favicon('github.com') },
  { name: 'Gmail', url: 'https://mail.google.com', icon: favicon('gmail.com') },
  { name: 'Drive', url: 'https://drive.google.com', icon: favicon('drive.google.com') },
  { name: 'Twitter', url: 'https://x.com', icon: favicon('x.com') },
  { name: 'Reddit', url: 'https://reddit.com', icon: favicon('reddit.com') },
];

const AI_TOOLS = [
  { id: 'gemini', name: 'Gemini', desc: 'Google AI', url: 'https://gemini.google.com', logo: favicon('gemini.google.com') },
  { id: 'chatgpt', name: 'ChatGPT', desc: 'OpenAI GPT-4o', url: 'https://chat.openai.com', logo: favicon('openai.com') },
  { id: 'claude', name: 'Claude', desc: 'Anthropic', url: 'https://claude.ai', logo: favicon('claude.ai') },
  { id: 'perplexity', name: 'Perplexity', desc: 'AI-powered search', url: 'https://perplexity.ai', logo: favicon('perplexity.ai') },
  { id: 'copilot', name: 'Copilot', desc: 'Microsoft AI', url: 'https://copilot.microsoft.com', logo: favicon('copilot.microsoft.com') },
  { id: 'mistral', name: 'Mistral', desc: 'Open-source model', url: 'https://chat.mistral.ai', logo: favicon('mistral.ai') },
];

// ─── Helpers ────────────────────────────────────────
const esc = s => { const d = document.createElement('div'); d.appendChild(document.createTextNode(s)); return d.innerHTML; };
const $ = id => document.getElementById(id);

// ─── Clock & Date ───────────────────────────────────
function tick() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  $('clockTime').textContent = `${h}:${m}`;
  $('clockSecs').textContent = s;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  $('dateDay').textContent = days[now.getDay()];
  $('dateNum').textContent = String(now.getDate()).padStart(2, '0');
  $('dateMon').textContent = months[now.getMonth()];

  const hour = now.getHours();
  let g, sub;
  if (hour >= 5 && hour < 12) { g = 'Good Morning'; sub = 'Start your day with focus ☀️'; }
  else if (hour >= 12 && hour < 17) { g = 'Good Afternoon'; sub = 'Keep up the great work 💪'; }
  else if (hour >= 17 && hour < 21) { g = 'Good Evening'; sub = 'You\'ve done well today 🌇'; }
  else { g = 'Good Night'; sub = 'Rest well, tomorrow awaits 🌙'; }
  $('greetingText').textContent = g;
  $('greetingSub').textContent = sub;
}
tick();
setInterval(tick, 1000);


// ─── Search & Action Panel ──────────────────────────
const SEARCH_ACTIONS = [
  { label: 'Search Google', icon: 'https://www.google.com/favicon.ico', url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { label: 'Ask ChatGPT', icon: favicon('chat.openai.com'), url: q => `https://chat.openai.com/?q=${encodeURIComponent(q)}` },
  { label: 'Search YouTube', icon: 'https://www.youtube.com/favicon.ico', url: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  { label: 'Search Wikipedia', icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico', url: q => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
];

const searchActionsEl = $('searchActions');
let actionSelectedIdx = 0;
let actionsVisible = false;

function renderActions(query) {
  searchActionsEl.innerHTML = '';
  SEARCH_ACTIONS.forEach((action, i) => {
    const row = document.createElement('div');
    row.className = 'search-action-row' + (i === actionSelectedIdx ? ' active' : '');
    row.innerHTML = `<img class="sa-icon" src="${action.icon}" alt="" onerror="this.style.display='none'"/><span class="sa-label">${action.label}</span><span class="sa-query">${esc(query)}</span>`;
    row.addEventListener('click', () => {
      window.location.href = action.url(query);
    });
    row.addEventListener('mouseenter', () => {
      actionSelectedIdx = i;
      highlightAction();
    });
    searchActionsEl.appendChild(row);
  });
}

function highlightAction() {
  const rows = searchActionsEl.querySelectorAll('.search-action-row');
  rows.forEach((r, i) => r.classList.toggle('active', i === actionSelectedIdx));
}

function positionDropdown() {
  const box = document.querySelector('#w-search .search-box');
  if (!box) return;
  const rect = box.getBoundingClientRect();
  searchActionsEl.style.left = rect.left + 'px';
  searchActionsEl.style.top = (rect.bottom + 6) + 'px';
  searchActionsEl.style.width = rect.width + 'px';
}

function showActions() {
  if (actionsVisible) return;
  actionsVisible = true;
  positionDropdown();
  searchActionsEl.classList.add('visible');
}

function hideActions() {
  if (!actionsVisible) return;
  actionsVisible = false;
  actionSelectedIdx = 0;
  searchActionsEl.classList.remove('visible');
}

function doSearch() {
  const q = $('searchInput').value.trim();
  if (!q) return;
  if (actionsVisible) {
    window.location.href = SEARCH_ACTIONS[actionSelectedIdx].url(q);
  } else {
    window.location.href = SEARCH_URL(encodeURIComponent(q));
  }
}

// Input listener — show/hide actions
$('searchInput').addEventListener('input', () => {
  const q = $('searchInput').value.trim();
  if (q) {
    actionSelectedIdx = 0;
    renderActions(q);
    showActions();
  } else {
    hideActions();
  }
});

// Keyboard navigation
$('searchInput').addEventListener('keydown', ev => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    doSearch();
    return;
  }
  if (!actionsVisible) return;
  if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    actionSelectedIdx = (actionSelectedIdx + 1) % SEARCH_ACTIONS.length;
    highlightAction();
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    actionSelectedIdx = (actionSelectedIdx - 1 + SEARCH_ACTIONS.length) % SEARCH_ACTIONS.length;
    highlightAction();
  } else if (ev.key === 'Escape') {
    ev.preventDefault();
    hideActions();
    $('searchInput').blur();
  }
});

// Hide actions on blur (with delay so click can register)
$('searchInput').addEventListener('blur', () => {
  setTimeout(hideActions, 200);
});

// Global "/" shortcut to focus search
document.addEventListener('keydown', ev => {
  if (ev.key === '/' && document.activeElement !== $('searchInput') && !ev.ctrlKey && !ev.metaKey) {
    // Don't steal focus from other inputs
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    ev.preventDefault();
    $('searchInput').focus();
  }
});

// ─── Quick Links ─────────────────────────────────────
function renderLinks() {
  linksDock.innerHTML = '';
  quickLinks.forEach((lnk, i) => {
    const iconUrl = lnk.icon || favicon(new URL(lnk.url).hostname);
    const a = document.createElement('a');
    a.className = 'link-item';
    a.href = lnk.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.style.animationDelay = `${i * 0.04}s`;
    a.innerHTML = `
      <div class="link-icon-box"><img src="${iconUrl}" alt="${esc(lnk.name)}" onerror="this.src='https://www.google.com/s2/favicons?sz=64&domain=${new URL(lnk.url).hostname}'"/></div>
      <span class="link-name">${esc(lnk.name)}</span>`;
    linksDock.appendChild(a);
  });
  renderLinksSettings();
}

function renderLinksSettings() {
  sLinksListEl.innerHTML = '';
  quickLinks.forEach((lnk, i) => {
    const row = document.createElement('div');
    row.className = 's-link-row';
    row.innerHTML = `<span class="s-link-name">${esc(lnk.name)}</span><button class="s-link-del">✕</button>`;
    row.querySelector('.s-link-del').addEventListener('click', () => removeLink(i));
    sLinksListEl.appendChild(row);
  });
}

function addQuickLink() {
  const name = $('sLinkName').value.trim();
  let url = $('sLinkUrl').value.trim();
  if (!name || !url) return;
  if (!url.startsWith('http')) url = 'https://' + url;
  quickLinks.push({ name, url, icon: favicon(new URL(url).hostname) });
  save({ quickLinks });
  renderLinks();
  $('sLinkName').value = '';
  $('sLinkUrl').value = '';
}

function removeLink(i) {
  quickLinks.splice(i, 1);
  save({ quickLinks });
  renderLinks();
}

// ─── AI Tools ───────────────────────────────────────
function renderAI() {
  aiListEl.innerHTML = '';
  sAiTogglesEl.innerHTML = '';
  AI_TOOLS.forEach((t, i) => {
    const lbl = document.createElement('label');
    lbl.className = 's-toggle-row';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = `tog-${t.id}`;
    chk.checked = aiState[t.id] !== false;
    chk.onchange = saveAiState;
    lbl.appendChild(chk);
    lbl.appendChild(document.createTextNode(' ' + t.name));
    sAiTogglesEl.appendChild(lbl);

    if (aiState[t.id] === false) return;
    const a = document.createElement('a');
    a.className = 'ai-item';
    a.href = t.url; a.target = '_blank'; a.rel = 'noopener';
    a.style.animationDelay = `${i * 0.07}s`;
    a.innerHTML = `
      <img class="ai-logo" src="${t.logo}" alt="${t.name}" onerror="this.style.display='none'"/>
      <div class="ai-info"><div class="ai-name">${t.name}</div><div class="ai-desc">${t.desc}</div></div>
      <span class="ai-arrow">→</span>`;
    aiListEl.appendChild(a);
  });
}

function saveAiState() {
  AI_TOOLS.forEach(t => { aiState[t.id] = ($(`tog-${t.id}`)?.checked !== false); });
  save({ aiState });
  renderAI();
}

// ─── Todo ────────────────────────────────────────────
function renderTodos() {
  todoList.innerHTML = '';
  todoBadge.textContent = todos.length;
  todos.forEach((txt, i) => {
    const li = document.createElement('li');
    li.className = 'todo-item';
    li.innerHTML = `<span class="todo-dot"></span><span class="todo-txt">${esc(txt)}</span><span class="todo-x">✕</span>`;
    li.addEventListener('click', () => {
      li.style.transition = 'all 0.18s ease'; li.style.opacity = '0'; li.style.transform = 'translateX(8px)';
      setTimeout(() => { todos.splice(i, 1); save({ todos }); renderTodos(); }, 160);
    });
    todoList.appendChild(li);
  });
}
function addTodo() {
  const v = todoInput.value.trim(); if (!v) return;
  todos.push(v); save({ todos }); renderTodos(); todoInput.value = '';
}
todoInput.addEventListener('keydown', ev => { if (ev.key === 'Enter') addTodo(); });

// ─── Theme & Background ──────────────────────────────
let currentBgMode = 'static'; // static | aurora | blobs | particles
let particleAnimId = null;

function setTheme(t) {
  body.classList.toggle('theme-dark', t === 'dark');
  body.classList.toggle('theme-light', t === 'light');
  $('btnDark').classList.toggle('active', t === 'dark');
  $('btnLight').classList.toggle('active', t === 'light');
  save({ theme: t });
}

function setBg(bg) {
  // Remove existing bg-* classes and custom bg image
  [...body.classList].filter(c => c.startsWith('bg-') && !c.startsWith('bg-mode-')).forEach(c => body.classList.remove(c));
  body.style.backgroundImage = '';
  body.style.backgroundSize = '';
  body.style.backgroundPosition = '';
  body.style.backgroundRepeat = '';
  document.querySelectorAll('.s-swatch').forEach(s => s.classList.toggle('active', s.dataset.bg === bg));

  if (bg === 'custom') {
    body.classList.add('bg-custom');
  } else {
    body.classList.add(`bg-${bg}`);
    if (bg === 'ash') setTheme('light'); else setTheme('dark');
  }
  save({ bg });
}

// ─── Time-based background helpers ──────────────────
let autoTimerId = null;

function getTimePeriod() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 21) return 'evening';
  return 'night';
}

// Map time periods to animation types
const TIME_BG_MAP = {
  morning: 'aurora',     // soft warm pastels
  afternoon: 'blobs',      // energetic floating blobs
  evening: 'aurora',     // sunset gradient
  night: 'particles',  // calm starfield
};

// Particle hue ranges per time period
const TIME_PARTICLE_HUE = {
  morning: { min: 20, max: 60 },  // warm yellow/orange
  afternoon: { min: 120, max: 200 },  // green-blue
  evening: { min: 280, max: 340 },  // magenta/pink
  night: { min: 200, max: 260 },  // blue-purple
};

function applyTimePeriod(period) {
  // Clear old time-* classes
  [...body.classList].filter(c => c.startsWith('time-')).forEach(c => body.classList.remove(c));
  body.classList.add(`time-${period}`);
}

function applyAutoBg() {
  const period = getTimePeriod();
  const animType = TIME_BG_MAP[period];
  applyTimePeriod(period);

  // Clear all bg-mode-* and static bg classes
  [...body.classList].filter(c => c.startsWith('bg-mode-') || (c.startsWith('bg-') && c !== 'bg-custom')).forEach(c => body.classList.remove(c));
  body.style.backgroundImage = '';

  // Stop particles if running
  if (particleAnimId) {
    cancelAnimationFrame(particleAnimId);
    particleAnimId = null;
  }

  body.classList.add(`bg-mode-${animType}`);

  if (animType === 'blobs') {
    body.style.background = '#080818';
  } else if (animType === 'particles') {
    body.style.background = '#060612';
    // Set particle hues to match the time period
    const hueRange = TIME_PARTICLE_HUE[period];
    initParticles(hueRange.min, hueRange.max);
  }

  setTheme(period === 'morning' ? 'light' : 'dark');
}

// ─── Animated background mode switcher ──────────────
function setBgMode(mode) {
  currentBgMode = mode;

  // Clear auto timer
  if (autoTimerId) { clearInterval(autoTimerId); autoTimerId = null; }

  // Clear all bg-mode-* and time-* classes
  [...body.classList].filter(c => c.startsWith('bg-mode-') || c.startsWith('time-')).forEach(c => body.classList.remove(c));

  // Stop particles if running
  if (particleAnimId) {
    cancelAnimationFrame(particleAnimId);
    particleAnimId = null;
  }

  // Update settings UI
  document.querySelectorAll('.s-bg-type').forEach(b => b.classList.toggle('active', b.dataset.bgtype === mode));
  if (mode === 'auto') {
    bgSubStatic.classList.remove('visible');
    bgSubWp.classList.remove('visible');
    applyAutoBg();
    autoTimerId = setInterval(applyAutoBg, 60000);
  } else if (mode === 'static') {
    bgSubStatic.classList.add('visible');
    bgSubWp.classList.remove('visible');
  } else if (mode === 'wallpaper') {
    bgSubStatic.classList.remove('visible');
    bgSubWp.classList.add('visible');
    // Clear static bg classes + animated bg so wallpaper can show
    [...body.classList].filter(c => c.startsWith('bg-') && !c.startsWith('bg-mode-')).forEach(c => body.classList.remove(c));
    body.classList.add('bg-mode-wallpaper');
    body.style.background = '#0a0a1a';
    clearVideoPlayback();
    setTheme('dark');
    $('wpRefreshFloatingBtn')?.classList.add('show');
  } else {
    bgSubStatic.classList.remove('visible');
    bgSubWp.classList.remove('visible');
    $('wpRefreshFloatingBtn')?.classList.remove('show');
    [...body.classList].filter(c => c.startsWith('bg-') && !c.startsWith('bg-mode-')).forEach(c => body.classList.remove(c));
    body.style.backgroundImage = '';
    body.classList.add(`bg-mode-${mode}`);
    setTheme('dark');
  }

  // Start particles if needed (manual)
  if (mode === 'particles') {
    initParticles();
  }

  save({ bgMode: mode });
}

// ─── Particle system (canvas + rAF) ─────────────────
const particleCanvas = $('bgParticles');
const pCtx = particleCanvas.getContext('2d');
let particles = [];
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

function initParticles(hueMin = 200, hueMax = 260) {
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
  particles = [];
  const count = 55;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * particleCanvas.width,
      y: Math.random() * particleCanvas.height,
      r: Math.random() * 2.2 + 0.8,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      opacity: Math.random() * 0.5 + 0.2,
      dOpacity: (Math.random() - 0.5) * 0.004,
      hue: Math.random() * (hueMax - hueMin) + hueMin,
    });
  }
  drawParticles();
}

function drawParticles() {
  if (currentBgMode !== 'particles') return;
  const W = particleCanvas.width;
  const H = particleCanvas.height;
  pCtx.clearRect(0, 0, W, H);

  particles.forEach(p => {
    // Subtle mouse influence
    const distX = (mouseX - p.x) * 0.0003;
    const distY = (mouseY - p.y) * 0.0003;
    p.x += p.dx + distX;
    p.y += p.dy + distY;

    // Wrap around edges
    if (p.x < 0) p.x = W;
    if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H;
    if (p.y > H) p.y = 0;

    // Fade in/out
    p.opacity += p.dOpacity;
    if (p.opacity <= 0.1 || p.opacity >= 0.7) p.dOpacity *= -1;

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    pCtx.fillStyle = `hsla(${p.hue}, 80%, 72%, ${p.opacity})`;
    pCtx.shadowBlur = 8;
    pCtx.shadowColor = `hsla(${p.hue}, 80%, 72%, ${p.opacity * 0.6})`;
    pCtx.fill();
  });

  pCtx.shadowBlur = 0;
  particleAnimId = requestAnimationFrame(drawParticles);
}

// ─── Parallax on background layer ────────────────────
document.addEventListener('mousemove', ev => {
  mouseX = ev.clientX;
  mouseY = ev.clientY;
  if (currentBgMode === 'static') return;
  const bgLayer = $('bgLayer');
  const cx = (ev.clientX / window.innerWidth - 0.5) * 12;
  const cy = (ev.clientY / window.innerHeight - 0.5) * 12;
  bgLayer.style.transform = `translate(${cx}px, ${cy}px)`;
});

// Resize particles canvas
window.addEventListener('resize', () => {
  if (currentBgMode === 'particles') {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  }
});

// ─── Custom background upload (image + video) ───────
const bgVideoEl = $('bgVideo');

function applyCustomBg(dataUrl) {
  if (!dataUrl) return;
  clearVideoPlayback();
  bgLayerEl.style.backgroundImage = `url(${dataUrl})`;
  bgLayerEl.style.backgroundSize = 'cover';
  bgLayerEl.style.backgroundPosition = 'center';
  bgLayerEl.style.backgroundRepeat = 'no-repeat';
}

function applyCustomVideo(src) {
  if (!src) return;
  body.style.backgroundImage = '';
  body.classList.add('bg-custom-video');
  bgVideoEl.src = src;
  bgVideoEl.play().catch(() => { });
}

function clearVideoPlayback() {
  body.classList.remove('bg-custom-video');
  bgVideoEl.pause();
  bgVideoEl.removeAttribute('src');
  bgVideoEl.load();
}

function handleBgUpload(file) {
  if (!file) return;
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    setBgMode('static');
    setBg('custom');

    if (isVideo) {
      // Use object URL for smooth playback, store base64 for persistence
      const blobUrl = URL.createObjectURL(file);
      applyCustomVideo(blobUrl);
      chrome.storage.local.set({ customBgData: dataUrl, customBgType: 'video' });
    } else {
      applyCustomBg(dataUrl);
      chrome.storage.local.set({ customBgData: dataUrl, customBgType: 'image' });
    }
    document.querySelectorAll('.s-swatch').forEach(s => s.classList.remove('active'));
  };
  reader.readAsDataURL(file);
}

function clearCustomBg() {
  bgLayerEl.style.backgroundImage = '';
  bgLayerEl.style.backgroundSize = '';
  bgLayerEl.style.backgroundPosition = '';
  bgLayerEl.style.backgroundRepeat = '';
  clearVideoPlayback();
  chrome.storage.local.remove(['customBgData', 'customBgType']);
  setBg('cosmos');
}

// ─── Wallpaper Generator ─────────────────────────────
const bgSubStatic = $('bgSubStatic');
const bgSubWp = $('bgSubWallpaper');
let wpCategory = 'nature';
let wpRefreshMode = 'newtab'; // newtab | daily | manual

function fetchWallpaper(category) {
  category = category || wpCategory;
  const rand = Math.floor(Math.random() * 100000);
  // picsum.photos returns random high-quality photos reliably
  const url = `https://picsum.photos/1920/1080?random=${rand}`;
  console.log('[Wallpaper] Category:', category, 'URL:', url);
  return url;
}

function applyWallpaper(url) {
  if (!url) return;
  console.log('[Wallpaper] Applying:', url);
  bgLayerEl.style.backgroundImage = `url(${url})`;
  bgLayerEl.style.backgroundSize = 'cover';
  bgLayerEl.style.backgroundPosition = 'center';
  bgLayerEl.style.backgroundRepeat = 'no-repeat';
}

async function generateWallpaper() {
  console.log('[Wallpaper] Generating for category:', wpCategory);
  const randomUrl = fetchWallpaper(wpCategory);

  try {
    // Fetch the random URL to get the final redirected static URL
    const response = await fetch(randomUrl);
    const staticUrl = response.url;

    // Storage cleanup: remove old, save new static URL
    chrome.storage.local.remove('currentWallpaperURL', () => {
      applyWallpaper(staticUrl);
      save({ currentWallpaperURL: staticUrl });
    });
  } catch (e) {
    console.error('[Wallpaper] Failed to fetch static URL:', e);
    // Fallback to random URL if fetch fails
    applyWallpaper(randomUrl);
    save({ currentWallpaperURL: randomUrl });
  }
}

function loadWallpaperOnInit(res) {
  wpCategory = res.wpCategory || 'nature';
  // Update UI cats
  document.querySelectorAll('.s-wp-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === wpCategory));

  if (res.currentWallpaperURL) {
    applyWallpaper(res.currentWallpaperURL);
  } else {
    // First time or cleared
    generateWallpaper();
  }
}

// ─── Ambient Sound (Web Audio API) ───────────────────
let ambientCtx = null;
let ambientSource = null;
let ambientGain = null;
let ambientSound = 'off';
let ambientVolume = 0.3;

function stopAmbient() {
  if (ambientCtx) {
    ambientCtx.close().catch(() => { });
    ambientCtx = null;
    ambientSource = null;
    ambientGain = null;
  }
}

function startAmbient(type) {
  stopAmbient();
  if (type === 'off') return;

  ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
  ambientGain = ambientCtx.createGain();
  ambientGain.gain.value = ambientVolume;
  ambientGain.connect(ambientCtx.destination);

  if (type === 'rain') {
    createRainSound();
  } else if (type === 'cafe') {
    createCafeSound();
  } else if (type === 'lofi') {
    createLofiSound();
  }
}

function createRainSound() {
  // White noise → lowpass → gain
  const bufSize = ambientCtx.sampleRate * 4;
  const buf = ambientCtx.createBuffer(1, bufSize, ambientCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ambientCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const lp = ambientCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 800;
  lp.Q.value = 0.5;

  const hp = ambientCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 200;

  src.connect(lp).connect(hp).connect(ambientGain);
  src.start();
  ambientSource = src;
}

function createCafeSound() {
  // Brown noise (accumulated random walk) → bandpass
  const bufSize = ambientCtx.sampleRate * 4;
  const buf = ambientCtx.createBuffer(1, bufSize, ambientCtx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (last + 0.02 * white) / 1.02;
    last = data[i];
    data[i] *= 3.5;
  }

  const src = ambientCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const bp = ambientCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600;
  bp.Q.value = 0.8;

  src.connect(bp).connect(ambientGain);
  src.start();
  ambientSource = src;
}

function createLofiSound() {
  // Pink-ish noise with slow LFO volume modulation for warmth
  const bufSize = ambientCtx.sampleRate * 6;
  const buf = ambientCtx.createBuffer(1, bufSize, ambientCtx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  const src = ambientCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const lp = ambientCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;

  // Slow LFO for warmth
  const lfo = ambientCtx.createOscillator();
  const lfoGain = ambientCtx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.15;
  lfoGain.gain.value = 0.12;
  lfo.connect(lfoGain);
  lfoGain.connect(ambientGain.gain);
  lfo.start();

  src.connect(lp).connect(ambientGain);
  src.start();
  ambientSource = src;
}

function setAmbientSound(type) {
  ambientSound = type;
  document.querySelectorAll('.s-ambient-btn').forEach(b => b.classList.toggle('active', b.dataset.sound === type));
  $('volumeRow').style.display = type === 'off' ? 'none' : 'flex';
  startAmbient(type);
  save({ ambientSound: type });
}

function setAmbientVolume(val) {
  ambientVolume = val / 100;
  if (ambientGain) ambientGain.gain.value = ambientVolume;
  $('volumeVal').textContent = val + '%';
  save({ ambientVolume: val });
}

// ─── Background Blur & Brightness ────────────────────
let bgBlur = 0;
let bgBright = 100;
const bgLayerEl = $('bgLayer');

function applyBgFilter() {
  const parts = [];
  if (bgBlur > 0) parts.push(`blur(${bgBlur}px)`);
  if (bgBright !== 100) parts.push(`brightness(${bgBright}%)`);
  const filterStr = parts.length ? parts.join(' ') : '';
  bgLayerEl.style.filter = filterStr;
  // For wallpaper/static backgrounds on body, apply via a scale trick
  // to avoid blurring widgets: we set the filter on bgLayer which covers everything
}

function setBgBlur(val) {
  bgBlur = Number(val);
  $('bgBlurVal').textContent = val + 'px';
  applyBgFilter();
  save({ backgroundBlur: val });
}

function setBgBrightness(val) {
  bgBright = Number(val);
  $('bgBrightVal').textContent = val + '%';
  applyBgFilter();
  save({ backgroundBrightness: val });
}

// ─── Weather (Open-Meteo API — free, no key) ────────
const WEATHER_LAT = 30.5073;  // SLIET Longowal, Punjab
const WEATHER_LON = 75.7972;

const WMO_CODES = {
  0: ['☀️', 'Clear sky'],
  1: ['🌤️', 'Mainly clear'],
  2: ['⛅', 'Partly cloudy'],
  3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Foggy'],
  48: ['🌫️', 'Rime fog'],
  51: ['🌦️', 'Light drizzle'],
  53: ['🌦️', 'Drizzle'],
  55: ['🌧️', 'Heavy drizzle'],
  61: ['🌧️', 'Light rain'],
  63: ['🌧️', 'Rain'],
  65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'],
  73: ['🌨️', 'Snow'],
  75: ['❄️', 'Heavy snow'],
  80: ['🌦️', 'Rain showers'],
  81: ['🌧️', 'Heavy showers'],
  82: ['⛈️', 'Violent showers'],
  95: ['⛈️', 'Thunderstorm'],
  96: ['⛈️', 'Thunderstorm + hail'],
  99: ['⛈️', 'Severe thunderstorm'],
};

async function fetchWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,weather_code,wind_speed_10m&timezone=Asia%2FKolkata`;
    const res = await fetch(url);
    const data = await res.json();
    const cur = data.current;
    const temp = Math.round(cur.temperature_2m);
    const code = cur.weather_code;
    const [icon, desc] = WMO_CODES[code] || ['⛅', 'Unknown'];

    $('weatherIcon').textContent = icon;
    $('weatherTemp').textContent = `${temp}°C`;
    $('weatherDesc').textContent = desc;
  } catch (e) {
    $('weatherDesc').textContent = 'Offline';
    console.warn('[Weather] fetch failed:', e);
  }
}

// Fetch on load + refresh every 15 min
fetchWeather();
setInterval(fetchWeather, 900000);

// Location privacy toggle
let locHidden = false;
$('weatherEyeBtn').addEventListener('click', () => {
  locHidden = !locHidden;
  const locEl = $('weatherLoc');
  locEl.classList.add('switching');
  setTimeout(() => {
    locEl.textContent = locHidden ? '🌍 Earth' : 'SLIET, Longowal';
    locEl.classList.remove('switching');
  }, 350);
  save({ weatherLocHidden: locHidden });
});

// ─── Knowledge Widget ─────────────────────────────
async function fetchKnowledge() {
  const textEl = $('knowledgeText');
  if (!textEl) return;

  // Randomly choose between Science, Math, and Tech
  const rand = Math.random();
  let url;

  if (rand < 0.33) {
    url = 'https://uselessfacts.jsph.pl/random.json?language=en';
  } else if (rand < 0.66) {
    url = 'http://numbersapi.com/random/math?json';
  } else {
    url = 'https://techy-api.vercel.app/api/json';
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('API unstable');
    const data = await res.json();

    textEl.classList.remove('knowledge-fade-in');
    void textEl.offsetWidth; // Trigger reflow

    // Parse response based on API source
    if (rand < 0.33) {
      // Science Fact
      textEl.textContent = `"${data.text}"`;
    } else if (rand < 0.66) {
      // Math Fact
      textEl.textContent = `"${data.text}"`;
    } else {
      // Tech Fact
      textEl.textContent = `"${data.message}"`;
    }

    textEl.classList.add('knowledge-fade-in');

  } catch (e) {
    console.warn('[Knowledge] fetch failed:', e);
    textEl.textContent = '"Learning something new every day keeps the mind sharp."';
  }
}

fetchKnowledge();

// ─── Settings panel open/close ───────────────────────
function openSettings() {
  settingsDrawer.classList.add('open');
  settingsOverlay.classList.add('open');
}
function closeSettings() {
  settingsDrawer.classList.remove('open');
  settingsOverlay.classList.remove('open');
}
settingsBtn.addEventListener('click', openSettings);
closeSettingsEl.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

// ─── Wire up all buttons (MV3 CSP) ─────────────────
$('btnDark').addEventListener('click', () => setTheme('dark'));
$('btnLight').addEventListener('click', () => setTheme('light'));
$('customizeBtn').addEventListener('click', enterEditMode);
$('addLinkBtn').addEventListener('click', addQuickLink);
$('editSaveBtn').addEventListener('click', exitEditMode);
$('searchGoBtn').addEventListener('click', doSearch);
$('todoAddBtn').addEventListener('click', addTodo);

// Background type selector
document.querySelectorAll('.s-bg-type').forEach(btn => {
  btn.addEventListener('click', () => {
    setBgMode(btn.dataset.bgtype);
    if (btn.dataset.bgtype === 'static') {
      chrome.storage.local.get(['bg', 'customBgData'], res => {
        setBg(res.bg || 'cosmos');
        if (res.bg === 'custom' && res.customBgData) applyCustomBg(res.customBgData);
      });
    } else if (btn.dataset.bgtype === 'wallpaper') {
      chrome.storage.local.get(['wpCategory', 'wpRefreshMode', 'wpLastUrl', 'wpLastTime'], loadWallpaperOnInit);
    }
  });
});

document.querySelectorAll('.s-swatch').forEach(s => {
  s.addEventListener('click', () => {
    clearCustomBg();
    setBgMode('static');
    setBg(s.dataset.bg);
  });
});
document.querySelectorAll('.widget-remove-btn').forEach(btn => {
  btn.addEventListener('click', () => removeWidget(btn.dataset.widget));
});

// Custom background upload
$('uploadBgBtn').addEventListener('click', () => $('bgFileInput').click());
$('bgFileInput').addEventListener('change', (e) => {
  if (e.target.files[0]) handleBgUpload(e.target.files[0]);
  e.target.value = '';
});
$('clearBgBtn').addEventListener('click', clearCustomBg);

// Wallpaper categories
document.querySelectorAll('.s-wp-cat').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.s-wp-cat').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    wpCategory = btn.dataset.cat;
    save({ wpCategory });
  });
});

// Floating Wallpaper Refresh
$('wpRefreshFloatingBtn').addEventListener('click', () => {
  generateWallpaper();
});
// Ambient sound buttons
document.querySelectorAll('.s-ambient-btn').forEach(btn => {
  btn.addEventListener('click', () => setAmbientSound(btn.dataset.sound));
});
$('volumeSlider').addEventListener('input', e => setAmbientVolume(Number(e.target.value)));

// Background blur & brightness sliders
$('bgBlurSlider').addEventListener('input', e => setBgBlur(Number(e.target.value)));
$('bgBrightSlider').addEventListener('input', e => setBgBrightness(Number(e.target.value)));

// ─── Grid helpers ────────────────────────────────────

/** Convert grid col/row span to pixel size */
function spanToPx(span) {
  return span * CELL + (span - 1) * GAP;
}

/** Resolve a col value — negative means "from right edge" */
function resolveCol(col, colSpan) {
  if (col < 0) {
    const maxCols = gridCols();
    return Math.max(1, maxCols + col + 1 - (colSpan - 1));
  }
  return col;
}

/** Snap a pixel coordinate to the nearest grid col/row (1-indexed) */
function pxToGrid(px) {
  return Math.max(1, Math.round((px - PAD) / UNIT) + 1);
}

/** Convert grid col/row (1-indexed) to pixel offset */
function gridToPx(g) {
  return PAD + (g - 1) * UNIT;
}

// ─── Widget Layout ───────────────────────────────────

/** Migrate old pixel-based layout to grid layout */
function migrateLayout(layout) {
  const migrated = {};
  for (const [id, data] of Object.entries(layout)) {
    if (data.colSpan !== undefined) {
      // Already migrated
      migrated[id] = data;
    } else if (data.x !== undefined || data.y !== undefined) {
      // Old pixel format — convert to grid
      const def = WIDGET_DEFAULTS[id] || { col: 1, row: 1, colSpan: 3, rowSpan: 3 };
      const col = data.x != null ? pxToGrid(data.x) : resolveCol(def.col, def.colSpan);
      const row = data.y != null ? pxToGrid(data.y) : def.row;
      migrated[id] = {
        col,
        row,
        colSpan: def.colSpan,
        rowSpan: def.rowSpan,
        hidden: data.hidden || false,
      };
    } else {
      migrated[id] = data;
    }
  }
  return migrated;
}

function getWidgetData(id) {
  const saved = widgetLayout[id];
  const def = WIDGET_DEFAULTS[id];
  if (!def) return null;
  return {
    col: saved?.col ?? resolveCol(def.col, saved?.colSpan ?? def.colSpan),
    row: saved?.row ?? def.row,
    colSpan: saved?.colSpan ?? def.colSpan,
    rowSpan: saved?.rowSpan ?? def.rowSpan,
    hidden: saved?.hidden || false,
  };
}

function applyLayout() {
  const widgetIds = ['clock', 'weather', 'date', 'todo', 'greeting', 'search', 'links', 'ai', 'knowledge'];

  widgetIds.forEach(id => {
    const el = $(`w-${id}`);
    if (!el) return;

    // Hidden?
    if (removedWidgets.has(id)) {
      el.style.display = 'none'; return;
    }
    const data = getWidgetData(id);
    if (!data || data.hidden) {
      el.style.display = 'none'; return;
    }
    el.style.display = '';

    // Set grid placement
    const col = resolveCol(data.col, data.colSpan);
    el.style.gridColumn = `${col} / span ${data.colSpan}`;
    el.style.gridRow = `${data.row} / span ${data.rowSpan}`;

    // Set explicit pixel dimensions for the container queries to work
    el.style.width = spanToPx(data.colSpan) + 'px';
    el.style.height = spanToPx(data.rowSpan) + 'px';
  });
}

function removeWidget(id) {
  if (!editMode) return;
  removedWidgets.add(id);
  widgetLayout[id] = { ...(widgetLayout[id] || {}), ...getWidgetData(id), hidden: true };
  applyLayout();
}

// ─── Drag & Drop (grid-snapping) ─────────────────────
let dragging = null, dragOffX = 0, dragOffY = 0;
let dragStartCol = 0, dragStartRow = 0;

function initDrag() {
  document.querySelectorAll('.widget').forEach(el => {
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('touchstart', onTouchStart, { passive: false });
  });
}

function onMouseDown(e) {
  if (!editMode) return;
  // Don't drag if clicking remove or resize handle
  if (e.target.closest('.widget-remove-btn') || e.target.closest('.widget-resize-handle')) return;
  startDrag(e.currentTarget, e.clientX, e.clientY);
  e.preventDefault();
}
function onTouchStart(e) {
  if (!editMode) return;
  if (e.target.closest('.widget-remove-btn') || e.target.closest('.widget-resize-handle')) return;
  const t = e.touches[0];
  startDrag(e.currentTarget, t.clientX, t.clientY);
  e.preventDefault();
}

function startDrag(el, cx, cy) {
  if (resizing) return; // don't drag while resizing
  dragging = el;
  const rect = el.getBoundingClientRect();
  dragOffX = cx - rect.left;
  dragOffY = cy - rect.top;

  const id = el.dataset.id;
  const data = getWidgetData(id);
  dragStartCol = resolveCol(data.col, data.colSpan);
  dragStartRow = data.row;

  // Switch to absolute positioning for smooth dragging
  el.style.position = 'fixed';
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';
  el.style.gridColumn = '';
  el.style.gridRow = '';
  el.style.transition = 'none';
  el.classList.add('dragging');
  el.style.zIndex = '999';

  // Show ghost at current position
  showGhost(dragStartCol, dragStartRow, data.colSpan, data.rowSpan);
}

document.addEventListener('mousemove', e => {
  if (dragging) { moveDrag(e.clientX, e.clientY); return; }
  if (resizing) { moveResize(e.clientX, e.clientY); return; }
});
document.addEventListener('touchmove', e => {
  if (dragging) { moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); return; }
  if (resizing) { moveResize(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); return; }
}, { passive: false });

function moveDrag(cx, cy) {
  const x = cx - dragOffX;
  const y = cy - dragOffY;
  dragging.style.left = x + 'px';
  dragging.style.top = y + 'px';

  // Update ghost snap position
  const id = dragging.dataset.id;
  const data = getWidgetData(id);
  const newCol = Math.max(1, Math.min(gridCols() - data.colSpan + 1, pxToGrid(x)));
  const newRow = Math.max(1, pxToGrid(y));
  showGhost(newCol, newRow, data.colSpan, data.rowSpan);
}

document.addEventListener('mouseup', endDragOrResize);
document.addEventListener('touchend', endDragOrResize);

function endDragOrResize() {
  if (dragging) endDrag();
  if (resizing) endResize();
}

function endDrag() {
  if (!dragging) return;
  const id = dragging.dataset.id;
  const data = getWidgetData(id);

  // Compute snapped grid position from current pixel position
  const rect = dragging.getBoundingClientRect();
  const newCol = Math.max(1, Math.min(gridCols() - data.colSpan + 1, pxToGrid(rect.left)));
  const newRow = Math.max(1, pxToGrid(rect.top));

  // Update layout
  widgetLayout[id] = {
    ...(widgetLayout[id] || {}),
    col: newCol,
    row: newRow,
    colSpan: data.colSpan,
    rowSpan: data.rowSpan,
  };

  // Restore to grid positioning
  dragging.style.position = '';
  dragging.style.left = '';
  dragging.style.top = '';
  dragging.style.transition = '';
  dragging.classList.remove('dragging');
  dragging.style.zIndex = '';
  dragging = null;

  hideGhost();
  applyLayout();
}

// ─── Resize system ───────────────────────────────────
let resizing = null, resizeStartW = 0, resizeStartH = 0, resizeStartX = 0, resizeStartY = 0;

function initResize() {
  document.querySelectorAll('.widget-resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', onResizeMouseDown);
    handle.addEventListener('touchstart', onResizeTouchStart, { passive: false });
  });
}

function onResizeMouseDown(e) {
  if (!editMode) return;
  e.stopPropagation();
  e.preventDefault();
  const widget = e.target.closest('.widget');
  startResize(widget, e.clientX, e.clientY);
}

function onResizeTouchStart(e) {
  if (!editMode) return;
  e.stopPropagation();
  e.preventDefault();
  const widget = e.target.closest('.widget');
  const t = e.touches[0];
  startResize(widget, t.clientX, t.clientY);
}

function startResize(el, cx, cy) {
  resizing = el;
  resizeStartW = el.offsetWidth;
  resizeStartH = el.offsetHeight;
  resizeStartX = cx;
  resizeStartY = cy;
  el.style.transition = 'none';
  el.classList.add('resizing');

  const id = el.dataset.id;
  const data = getWidgetData(id);
  const col = resolveCol(data.col, data.colSpan);
  showGhost(col, data.row, data.colSpan, data.rowSpan);
}

function moveResize(cx, cy) {
  if (!resizing) return;
  const id = resizing.dataset.id;
  const def = WIDGET_DEFAULTS[id];

  const deltaX = cx - resizeStartX;
  const deltaY = cy - resizeStartY;

  // Compute new pixel size
  const newW = Math.max(spanToPx(def.minCol), resizeStartW + deltaX);
  const newH = Math.max(spanToPx(def.minRow), resizeStartH + deltaY);

  // Clamp to max
  const maxW = spanToPx(def.maxCol);
  const maxH = spanToPx(def.maxRow);

  resizing.style.width = Math.min(newW, maxW) + 'px';
  resizing.style.height = Math.min(newH, maxH) + 'px';

  // Update ghost to show snapped size
  const data = getWidgetData(id);
  const col = resolveCol(data.col, data.colSpan);
  const snappedCols = Math.max(def.minCol, Math.min(def.maxCol, Math.round(Math.min(newW, maxW) / UNIT)));
  const snappedRows = Math.max(def.minRow, Math.min(def.maxRow, Math.round(Math.min(newH, maxH) / UNIT)));
  showGhost(col, data.row, snappedCols, snappedRows);
}

function endResize() {
  if (!resizing) return;
  const id = resizing.dataset.id;
  const def = WIDGET_DEFAULTS[id];

  // Snap to grid
  const currentW = resizing.offsetWidth;
  const currentH = resizing.offsetHeight;
  const newColSpan = Math.max(def.minCol, Math.min(def.maxCol, Math.round(currentW / UNIT)));
  const newRowSpan = Math.max(def.minRow, Math.min(def.maxRow, Math.round(currentH / UNIT)));

  const data = getWidgetData(id);
  widgetLayout[id] = {
    ...(widgetLayout[id] || {}),
    col: resolveCol(data.col, newColSpan),
    row: data.row,
    colSpan: newColSpan,
    rowSpan: newRowSpan,
  };

  resizing.style.transition = '';
  resizing.classList.remove('resizing');
  resizing = null;

  hideGhost();
  applyLayout();
}

// ─── Grid ghost (snap preview) ───────────────────────
function showGhost(col, row, colSpan, rowSpan) {
  const x = gridToPx(col);
  const y = gridToPx(row);
  const w = spanToPx(colSpan);
  const h = spanToPx(rowSpan);
  gridGhost.style.left = x + 'px';
  gridGhost.style.top = y + 'px';
  gridGhost.style.width = w + 'px';
  gridGhost.style.height = h + 'px';
  gridGhost.classList.add('visible');
}

function hideGhost() {
  gridGhost.classList.remove('visible');
}

// ─── Edit mode ───────────────────────────────────────
function enterEditMode() {
  editMode = true;
  body.classList.add('edit-mode');
  editBar.classList.add('visible');
  closeSettings();
}

function exitEditMode() {
  editMode = false;
  body.classList.remove('edit-mode');
  editBar.classList.remove('visible');
  hideGhost();
  save({ widgetLayout, removedWidgets: [...removedWidgets] });
}

// ─── Storage helpers ─────────────────────────────────
function save(obj) {
  chrome.storage.local.set(obj);
}

// ─── Init: load all from storage ─────────────────────
chrome.storage.local.get(
  ['todos', 'quickLinks', 'theme', 'bg', 'aiState', 'widgetLayout', 'removedWidgets',
    'customBgData', 'customBgType', 'bgMode',
    'wpCategory', 'currentWallpaperURL',
    'ambientSound', 'ambientVolume',
    'backgroundBlur', 'backgroundBrightness', 'weatherLocHidden'],
  res => {
    todos = res.todos || [];
    quickLinks = res.quickLinks || DEFAULT_LINKS;
    aiState = res.aiState || {};
    removedWidgets = new Set(res.removedWidgets || []);

    const rawLayout = res.widgetLayout || {};
    widgetLayout = migrateLayout(rawLayout);
    if (JSON.stringify(rawLayout) !== JSON.stringify(widgetLayout)) {
      save({ widgetLayout });
    }

    // Apply theme + bg
    setTheme(res.theme || 'dark');
    const savedMode = res.bgMode || 'static';
    setBgMode(savedMode);
    if (savedMode === 'static') {
      setBg(res.bg || 'cosmos');
      if (res.bg === 'custom' && res.customBgData) {
        if (res.customBgType === 'video') {
          applyCustomVideo(res.customBgData);
        } else {
          applyCustomBg(res.customBgData);
        }
      }
    } else if (savedMode === 'wallpaper') {
      loadWallpaperOnInit(res);
    }

    // Render dynamic content
    renderTodos();
    renderLinks();
    renderAI();

    // Position all widgets
    applyLayout();

    // Init drag & resize
    initDrag();
    initResize();
    initInteractions();

    // Ambient sound
    if (res.ambientVolume != null) {
      ambientVolume = res.ambientVolume / 100;
      $('volumeSlider').value = res.ambientVolume;
      $('volumeVal').textContent = res.ambientVolume + '%';
    }
    if (res.ambientSound && res.ambientSound !== 'off') {
      setAmbientSound(res.ambientSound);
    }

    // Background blur & brightness
    if (res.backgroundBlur != null) {
      bgBlur = Number(res.backgroundBlur);
      $('bgBlurSlider').value = bgBlur;
      $('bgBlurVal').textContent = bgBlur + 'px';
    }
    if (res.backgroundBrightness != null) {
      bgBright = Number(res.backgroundBrightness);
      $('bgBrightSlider').value = bgBright;
      $('bgBrightVal').textContent = bgBright + '%';
    }
    applyBgFilter();

    // Focus search
    setTimeout(() => $('searchInput')?.focus(), 120);

    // Restore weather location toggle
    if (res.weatherLocHidden) {
      locHidden = true;
      $('weatherLoc').textContent = '🌍 Earth';
    }

    // Reveal page
    requestAnimationFrame(() => {
      body.classList.add('loaded');
      bgLayerEl.classList.add('loaded');
    });
  }
);

// ─── Modern Interactions (Parallax & Magnetic Hover & Cursor Glow) ─
function initInteractions() {
  const bgLayerObj = $('bgLayer');
  const cursorGlow = $('cursorGlow');
  let ticking = false;

  // Cursor Glow state
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let glowX = mouseX;
  let glowY = mouseY;
  let glowActive = false;

  // Global Mouse Move (Parallax & Glow Target)
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Show glow on first move
    if (!glowActive && cursorGlow) {
      glowActive = true;
      cursorGlow.style.opacity = '0.6';
    }

    if (!ticking) {
      requestAnimationFrame(() => {
        if (bgLayerObj && bgLayerObj.classList.contains('loaded')) {
          const ww = window.innerWidth;
          const wh = window.innerHeight;
          const dx = (mouseX - ww / 2) / (ww / 2);
          const dy = (mouseY - wh / 2) / (wh / 2);
          bgLayerObj.style.transform = `translate(${dx * -15}px, ${dy * -15}px) scale(1.05)`;
        }
        ticking = false;
      });
      ticking = true;
    }
  });

  // Glow Animation Loop (lerping)
  function animateGlow() {
    if (cursorGlow && glowActive) {
      glowX += (mouseX - glowX) * 0.15;
      glowY += (mouseY - glowY) * 0.15;
      cursorGlow.style.left = `${glowX}px`;
      cursorGlow.style.top = `${glowY}px`;
    }
    requestAnimationFrame(animateGlow);
  }
  if (cursorGlow) requestAnimationFrame(animateGlow);

  // Magnetic Hover for Widgets
  document.querySelectorAll('.widget').forEach(widget => {
    widget.addEventListener('mousemove', e => {
      if (editMode || dragging || resizing || widget.classList.contains('resizing')) {
        widget.style.transform = '';
        return;
      }
      
      const rect = widget.getBoundingClientRect();
      const hw = rect.width / 2;
      const hh = rect.height / 2;
      const cx = rect.left + hw;
      const cy = rect.top + hh;
      
      // Offset -1 to 1
      const dx = (e.clientX - cx) / hw;
      const dy = (e.clientY - cy) / hh;
      
      // Move widget subtly (max 8px)
      widget.style.transform = `translate(${dx * 8}px, ${dy * 8}px) scale(1.02)`;
    });

    widget.addEventListener('mouseleave', () => {
      // Smooth reset
      widget.style.transform = 'translate(0px, 0px) scale(1)';
      setTimeout(() => {
        if (!widget.matches(':hover') && !widget.classList.contains('dragging')) {
          widget.style.transform = '';
        }
      }, 300);
    });
  });
}

// Reapply layout on resize
window.addEventListener('resize', applyLayout);