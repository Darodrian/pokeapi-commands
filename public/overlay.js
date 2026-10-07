const POLL_INTERVAL_MS = 2000;
const API_URL = '/api/last-trigger';
const ANIM_CANDIDATES = ['Idle', 'Rotate'];
const container = document.getElementById('container');
const canvas = document.getElementById('spriteCanvas');
const ctx = canvas.getContext('2d');
const sheetCache = new Map();
let lastTriggerId = null;
let animPlaying = false;
let animFrame = 0;
let animStartTime = 0;
let animDurations = [];
let animFrameWidth = 0;
let animFrameHeight = 0;
let animTotalDuration = 0;
let rafId = null;
let pollTimer = null;
let currentSheetImg = null;
let currentSpriteId4 = null;
let currentAssetsReady = false;
let currentAnimName = ANIM_CANDIDATES[0];
function resolveCopyOf(xmlDoc, targetName) {
  const anims = xmlDoc.querySelectorAll('Anim');
  for (let i = 0; i < anims.length; i++) {
    const nameEl = anims[i].querySelector('Name');
    if (!nameEl) continue;
    if (nameEl.textContent.trim() === targetName) {
      const copyOfEl = anims[i].querySelector('CopyOf');
      if (copyOfEl && copyOfEl.textContent.trim()) {
        const base = findAnim(xmlDoc, copyOfEl.textContent.trim());
        if (base) return base;
      }
      return anims[i];
    }
  }
  return null;
}
function findAnim(xmlDoc, targetName) {
  const anims = xmlDoc.querySelectorAll('Anim');
  for (let i = 0; i < anims.length; i++) {
    const nameEl = anims[i].querySelector('Name');
    if (nameEl && nameEl.textContent.trim() === targetName) {
      const copyOfEl = anims[i].querySelector('CopyOf');
      if (copyOfEl && copyOfEl.textContent.trim()) {
        return resolveCopyOf(xmlDoc, copyOfEl.textContent.trim()) || anims[i];
      }
      return anims[i];
    }
  }
  return null;
}
function parseDurations(animEl) {
  const durations = [];
  const durEls = animEl.querySelectorAll('Durations Duration');
  for (let i = 0; i < durEls.length; i++) {
    const v = parseFloat(durEls[i].textContent.trim());
    if (!isNaN(v)) durations.push(v);
  }
  return durations;
}
function durationToMs(v) {
  const n = parseFloat(v);
  if (isNaN(n) || n <= 0) return 1000 / 60;
  return (n * 1000) / 60;
}
function loadAssetsForSprite(spriteId4) {
  return new Promise((resolve) => {
    let candidateIndex = 0;
    tryCandidate();
    function tryCandidate() {
      if (candidateIndex >= ANIM_CANDIDATES.length) {
        currentAssetsReady = false;
        resolve(false);
        return;
      }
      const animName = ANIM_CANDIDATES[candidateIndex++];
      const cachedKey = `${spriteId4}:${animName}`;
      if (sheetCache.has(cachedKey)) {
        const cached = sheetCache.get(cachedKey);
        if (cached.ready) {
          currentAnimName = animName;
          currentSpriteId4 = spriteId4;
          currentSheetImg = cached.sheetImg;
          animDurations = cached.animDurations.slice();
          animFrameWidth = cached.animFrameWidth;
          animFrameHeight = cached.animFrameHeight;
          currentAssetsReady = true;
          canvas.width = animFrameWidth;
          canvas.height = animFrameHeight;
          container.style.width = animFrameWidth + 'px';
          container.style.height = animFrameHeight + 'px';
          resolve(true);
          return;
        }
      }
      const base = `/sprites/${spriteId4}`;
      const xmlUrl = `${base}/AnimData.xml`;
      const sheetUrl = `${base}/${animName}-Anim.png`;
      const sheetImg = new Image();
      let xmlText = null;
      let xmlFailed = false;
      let sheetFailed = false;
      const check = () => {
        if (xmlFailed || sheetFailed) { tryCandidate(); return; }
        if (xmlText === null) return;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        const animEl = findAnim(xmlDoc, animName);
        if (!animEl) { tryCandidate(); return; }
        const fw = parseInt(animEl.querySelector('FrameWidth')?.textContent.trim());
        const fh = parseInt(animEl.querySelector('FrameHeight')?.textContent.trim());
        const durs = parseDurations(animEl);
        if (isNaN(fw) || isNaN(fh) || durs.length === 0) { tryCandidate(); return; }
        const entryCached = { sheetImg, animDurations: durs.slice(), animFrameWidth: fw, animFrameHeight: fh, ready: true };
        sheetCache.set(cachedKey, entryCached);
        currentAnimName = animName;
        currentSpriteId4 = spriteId4;
        currentSheetImg = sheetImg;
        animDurations = durs.slice();
        animFrameWidth = fw;
        animFrameHeight = fh;
        currentAssetsReady = true;
        canvas.width = fw;
        canvas.height = fh;
        container.style.width = fw + 'px';
        container.style.height = fh + 'px';
        resolve(true);
      };
      sheetImg.onload = () => check();
      sheetImg.onerror = () => { sheetFailed = true; check(); };
      sheetImg.src = sheetUrl;
      fetch(xmlUrl)
        .then((r) => { if (!r.ok) throw new Error('xml not found'); return r.text(); })
        .then((text) => { xmlText = text; check(); })
        .catch(() => { xmlFailed = true; check(); });
    }
  });
}
function startAnimOnce() {
  if (animPlaying || !currentAssetsReady || !currentSheetImg) return;
  animPlaying = true;
  animFrame = 0;
  animStartTime = performance.now();
  animTotalDuration = 0;
  for (let i = 0; i < animDurations.length; i++) animTotalDuration += durationToMs(animDurations[i]);
  if (animTotalDuration <= 0) animTotalDuration = (animDurations.length || 1) * (1000 / 10);
  canvas.width = animFrameWidth;
  canvas.height = animFrameHeight;
  container.style.width = animFrameWidth + 'px';
  container.style.height = animFrameHeight + 'px';
  container.classList.remove('hidden');
  drawFrame(0);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tickAnim);
}
function drawFrame(frameIndex) {
  if (!currentAssetsReady || !currentSheetImg) return;
  const dcount = animDurations.length;
  if (dcount === 0) return;
  let idx = frameIndex % dcount;
  if (idx < 0) idx = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const fw = animFrameWidth, fh = animFrameHeight;
  try { ctx.drawImage(currentSheetImg, idx * fw, 0, fw, fh, 0, 0, fw, fh); } catch (e) {}
}
function tickAnim(ts) {
  if (!animPlaying) return;
  const elapsed = ts - animStartTime;
  if (elapsed >= animTotalDuration) {
    animPlaying = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    container.classList.add('hidden');
    return;
  }
  let acc = 0;
  for (let i = 0; i < animDurations.length; i++) {
    const dms = durationToMs(animDurations[i]);
    acc += dms;
    if (elapsed < acc) {
      if (animFrame !== i) { animFrame = i; drawFrame(i); }
      rafId = requestAnimationFrame(tickAnim);
      return;
    }
  }
  animPlaying = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  container.classList.add('hidden');
}
async function onNewTrigger(data) {
  if (!data || typeof data.id !== 'number') return;
  const id4 = String(data.id).padStart(4, '0');
  try {
    const ready = await loadAssetsForSprite(id4);
    if (ready && !animPlaying) startAnimOnce();
    if (!ready && !animPlaying) {
      const tryStart = setInterval(() => {
        if (currentAssetsReady && currentSpriteId4 === id4 && !animPlaying) {
          clearInterval(tryStart);
          startAnimOnce();
        }
      }, 50);
      setTimeout(() => clearInterval(tryStart), 2000);
    }
  } catch (e) {}
}
async function pollOnce() {
  try {
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.triggered === false) return;
    const tId = data.triggerId || data.ts;
    if (tId && lastTriggerId !== tId) {
      lastTriggerId = tId;
      onNewTrigger(data);
    }
  } catch (e) {}
}
function startPolling() { pollOnce(); pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS); }
function init() { startPolling(); }
init();