const POLL_INTERVAL_MS = 2000;
const SCALE = 4;
const API_URL = '/api/last-trigger';
const CH_PATTERN = /^[a-zA-Z0-9_-]{1,25}$/;
const MANIFEST_URL = '/sprites/manifest.json';
const ANIM_CANDIDATES = ['Idle', 'Rotate', 'Walk'];
const ANIM_SPEED = 0.5;
const ENTER_CYCLES = 2;
const EXIT_CYCLES = 2;
const DIR_ROWS = { down: 0, right: 2, left: 6 };
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
let manualMode = false;
let sequenceLoop = false;
let drawRow = 0;
let animFrameRows = 1;
let seqRunning = false;
let manifest = null;
let pollUrl = API_URL;
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
  return (n * 1000) / 60 / ANIM_SPEED;
}
function setFrameSize(fw, fh) {
  canvas.width = fw;
  canvas.height = fh;
  canvas.style.width = fw * SCALE + 'px';
  canvas.style.height = fh * SCALE + 'px';
  container.style.width = fw * SCALE + 'px';
  container.style.height = fh * SCALE + 'px';
}
function loadAssetsForSprite(spriteId4, forcedAnim) {
  const candidates = forcedAnim ? [forcedAnim] : ANIM_CANDIDATES;
  return new Promise((resolve) => {
    let candidateIndex = 0;
    tryCandidate();
    function tryCandidate() {
      if (candidateIndex >= candidates.length) {
        currentAssetsReady = false;
        resolve(false);
        return;
      }
      const animName = candidates[candidateIndex++];
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
          animFrameRows = cached.animFrameRows;
          currentAssetsReady = true;
          setFrameSize(animFrameWidth, animFrameHeight);
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
      let sheetLoaded = false;
      const check = () => {
        if (xmlFailed || sheetFailed) { tryCandidate(); return; }
        if (xmlText === null || !sheetLoaded) return;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        const animEl = findAnim(xmlDoc, animName);
        if (!animEl) { tryCandidate(); return; }
        const fw = parseInt(animEl.querySelector('FrameWidth')?.textContent.trim());
        const fh = parseInt(animEl.querySelector('FrameHeight')?.textContent.trim());
        const durs = parseDurations(animEl);
        if (isNaN(fw) || isNaN(fh) || durs.length === 0) { tryCandidate(); return; }
        const rows = Math.max(1, Math.round(sheetImg.naturalHeight / fh));
        const entryCached = { sheetImg, animDurations: durs.slice(), animFrameWidth: fw, animFrameHeight: fh, animFrameRows: rows, ready: true };
        sheetCache.set(cachedKey, entryCached);
        currentAnimName = animName;
        currentSpriteId4 = spriteId4;
        currentSheetImg = sheetImg;
        animDurations = durs.slice();
        animFrameWidth = fw;
        animFrameHeight = fh;
        animFrameRows = rows;
        currentAssetsReady = true;
        setFrameSize(fw, fh);
        resolve(true);
      };
      sheetImg.onload = () => { sheetLoaded = true; check(); };
      sheetImg.onerror = () => { sheetFailed = true; check(); };
      sheetImg.src = sheetUrl;
      fetch(xmlUrl)
        .then((r) => { if (!r.ok) throw new Error('xml not found'); return r.text(); })
        .then((text) => { xmlText = text; check(); })
        .catch(() => { xmlFailed = true; check(); });
    }
  });
}
function cycleMs() {
  let t = 0;
  for (let i = 0; i < animDurations.length; i++) t += durationToMs(animDurations[i]);
  if (t <= 0) t = (animDurations.length || 1) * (1000 / 10);
  return t;
}
function frameIndexAt(elapsedMs) {
  let acc = 0;
  for (let i = 0; i < animDurations.length; i++) {
    acc += durationToMs(animDurations[i]);
    if (elapsedMs < acc) return i;
  }
  return animDurations.length - 1;
}
function restPosition() {
  const w = animFrameWidth * SCALE;
  const h = animFrameHeight * SCALE;
  return {
    x: Math.round((window.innerWidth - w) / 2),
    y: Math.round((window.innerHeight - h) / 2),
  };
}
function ensureManifest() {
  if (manifest) return Promise.resolve(manifest);
  return fetch(MANIFEST_URL, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => { manifest = m && typeof m === 'object' ? m : {}; return manifest; })
    .catch(() => { manifest = {}; return manifest; });
}
function pickCenterAnim(id4) {
  const list = (manifest && manifest[id4]) || [];
  const pool = list.filter((a) => a !== 'Walk');
  if (pool.length === 0) return 'Idle';
  return pool[Math.floor(Math.random() * pool.length)];
}
function animateMove(targetFacing, durationMs) {
  return new Promise((resolve) => {
    drawRow = targetFacing === 'left' ? DIR_ROWS.left : DIR_ROWS.right;
    const rest = restPosition();
    const offX = window.innerWidth;
    const fromX = targetFacing === 'left' ? offX : rest.x;
    const toX = targetFacing === 'left' ? rest.x : offX;
    const cMs = cycleMs();
    container.classList.remove('hidden');
    container.style.transform = `translate(${fromX}px, ${rest.y}px)`;
    drawFrame(0);
    const t0 = performance.now();
    const step = (ts) => {
      const elapsed = ts - t0;
      const p = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
      const x = Math.round(fromX + (toX - fromX) * p);
      container.style.transform = `translate(${x}px, ${rest.y}px)`;
      drawFrame(frameIndexAt(elapsed % cMs));
      if (p < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
function playCurrentAnimOnce() {
  return new Promise((resolve) => {
    drawRow = DIR_ROWS.down;
    const rest = restPosition();
    container.classList.remove('hidden');
    container.style.transform = `translate(${rest.x}px, ${rest.y}px)`;
    drawFrame(0);
    const dur = cycleMs();
    const t0 = performance.now();
    const step = (ts) => {
      const elapsed = ts - t0;
      if (elapsed >= dur) { resolve(); return; }
      drawFrame(frameIndexAt(elapsed));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
async function playSequence(id4) {
  if (seqRunning) return true;
  seqRunning = true;
  try {
    await ensureManifest();
    if (!(await loadAssetsForSprite(id4, 'Walk'))) {
      console.warn(`overlay: no walk animation for id ${id4} - skipping sequence`);
      return false;
    }
    await animateMove('left', ENTER_CYCLES * cycleMs());
    const picked = pickCenterAnim(id4);
    const attempts = picked === 'Idle' ? ['Idle'] : [picked, 'Idle'];
    let centered = false;
    for (let i = 0; i < attempts.length && !centered; i++) {
      if (await loadAssetsForSprite(id4, attempts[i])) {
        await playCurrentAnimOnce();
        centered = true;
      }
    }
    if (await loadAssetsForSprite(id4, 'Walk')) {
      await animateMove('right', EXIT_CYCLES * cycleMs());
    }
    container.classList.add('hidden');
    drawRow = DIR_ROWS.down;
    return true;
  } catch (e) {
    console.warn('overlay: sequence error', e);
    return false;
  } finally {
    seqRunning = false;
  }
}
async function runSequenceLoop(id4) {
  while (sequenceLoop) {
    const ok = await playSequence(id4);
    if (!ok) return;
    await new Promise((r) => setTimeout(r, 400));
  }
}
function startAnimOnce() {
  if (animPlaying || !currentAssetsReady || !currentSheetImg) return;
  animPlaying = true;
  animFrame = 0;
  animStartTime = performance.now();
  animTotalDuration = 0;
  for (let i = 0; i < animDurations.length; i++) animTotalDuration += durationToMs(animDurations[i]);
  if (animTotalDuration <= 0) animTotalDuration = (animDurations.length || 1) * (1000 / 10);
  setFrameSize(animFrameWidth, animFrameHeight);
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
  const row = drawRow < animFrameRows ? drawRow : 0;
  try { ctx.drawImage(currentSheetImg, idx * fw, row * fh, fw, fh, 0, 0, fw, fh); } catch (e) {}
}
function tickAnim(ts) {
  if (!animPlaying) return;
  const elapsed = ts - animStartTime;
  if (elapsed >= animTotalDuration) {
    if (manualMode) {
      animStartTime = ts;
      animFrame = -1;
      rafId = requestAnimationFrame(tickAnim);
      return;
    }
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
  if (manualMode) {
    animStartTime = ts;
    animFrame = -1;
    rafId = requestAnimationFrame(tickAnim);
    return;
  }
  animPlaying = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  container.classList.add('hidden');
}
async function onNewTrigger(data) {
  if (!data || typeof data.id !== 'number') return;
  const id4 = String(data.id).padStart(4, '0');
  await playSequence(id4);
}
async function pollOnce() {
  try {
    const res = await fetch(pollUrl, { cache: 'no-store' });
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
async function init() {
  const params = new URLSearchParams(window.location.search);
  const rawId = params.get('id');
  const rawAnim = params.get('anim');
  if (rawId === null && rawAnim === null) {
    const ch = (params.get('ch') || '').trim();
    if (ch) {
      if (CH_PATTERN.test(ch)) {
        pollUrl = `${API_URL}?ch=${encodeURIComponent(ch)}`;
      } else {
        console.warn(`overlay: invalid ?ch="${ch}" - expected [a-zA-Z0-9_-]{1,25} - falling back to global triggers`);
      }
    }
    startPolling();
    return;
  }
  manualMode = true;
  const id = rawId === null ? NaN : Number(rawId);
  if (!Number.isInteger(id) || id < 1 || id > 9999) {
    console.warn(`overlay: invalid ?id="${rawId}" - expected an integer between 1 and 9999`);
    return;
  }
  const id4 = String(id).padStart(4, '0');
  if (rawAnim !== null && rawAnim.trim()) {
    await ensureManifest();
    const list = (manifest && manifest[id4]) || null;
    let anim = null;
    if (list) {
      anim = list.find((a) => a.toLowerCase() === rawAnim.trim().toLowerCase()) || null;
      if (!anim) {
        console.warn(`overlay: "${rawAnim.trim()}" is not available for id ${id} - see /sprites/manifest.json`);
        return;
      }
    } else {
      anim = rawAnim.trim();
    }
    const ready = await loadAssetsForSprite(id4, anim);
    if (ready) {
      const rawRow = params.get('row');
      const rowNum = Number(rawRow);
      if (rawRow !== null && Number.isInteger(rowNum) && rowNum >= 0 && rowNum < animFrameRows) {
        drawRow = rowNum;
      }
      startAnimOnce();
    } else console.warn(`overlay: could not load "${anim}" for id ${id}`);
    return;
  }
  sequenceLoop = true;
  runSequenceLoop(id4);
}
init();