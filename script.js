const STORAGE_KEY = "astaghfar-counter-v1";

const els = {
  count: document.getElementById("countDisplay"),
  total: document.getElementById("totalDisplay"),
  sessions: document.getElementById("sessionDisplay"),
  tap: document.getElementById("tapBtn"),
  undo: document.getElementById("undoBtn"),
  reset: document.getElementById("resetBtn"),
  sound: document.getElementById("soundBtn"),
  ring: document.querySelector(".counter__ring"),
};

const state = {
  count: 0,
  total: 0,
  sessions: 0,
  soundOn: true,
  history: [],
};

/* ---------- Persistence ---------- */
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.count = saved.count ?? 0;
    state.total = saved.total ?? 0;
    state.sessions = saved.sessions ?? 0;
    state.soundOn = saved.soundOn ?? true;
  } catch {
    /* ignore corrupted storage */
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        count: state.count,
        total: state.total,
        sessions: state.sessions,
        soundOn: state.soundOn,
      })
    );
  } catch {
    /* storage may be unavailable */
  }
}

/* ---------- Rendering ---------- */
function render(animate = false) {
  els.count.textContent = state.count;
  els.total.textContent = state.total;
  els.sessions.textContent = state.sessions;

  const progress = Math.min(state.count % 33, 33) / 33;
  els.ring.style.background = `conic-gradient(
    #d4af37 ${progress * 360}deg,
    rgba(212, 175, 55, 0.15) ${progress * 360}deg 360deg
  )`;

  els.sound.setAttribute("aria-pressed", String(state.soundOn));
  els.sound.textContent = state.soundOn ? "🔊 Sound" : "🔇 Muted";

  if (animate) {
    els.count.classList.add("counter__value--pop");
    setTimeout(() => els.count.classList.remove("counter__value--pop"), 150);
  }
}

/* ---------- Feedback ---------- */
let audioCtx = null;
let audioBus = null;
let noiseBuffer = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const master = audioCtx.createGain();
    master.gain.value = 0.95;

    // Warm space so the duff sounds like it's in a room
    const reverb = audioCtx.createConvolver();
    const len = audioCtx.sampleRate * 1.4;
    const impulse = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
    }
    reverb.buffer = impulse;

    const wet = audioCtx.createGain();
    wet.gain.value = 0.28;
    const dry = audioCtx.createGain();
    dry.gain.value = 0.9;

    master.connect(dry).connect(audioCtx.destination);
    master.connect(reverb).connect(wet).connect(audioCtx.destination);

    audioBus = master;

    // Pre-generate a white-noise buffer for drum transients
    const nLen = audioCtx.sampleRate * 0.5;
    noiseBuffer = audioCtx.createBuffer(1, nLen, audioCtx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nLen; i++) nd[i] = Math.random() * 2 - 1;
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

/* --- Daf / Duff frame-drum synthesis ---
   Layered hit:
   1) Deep "dum" — low pitched membrane tone with fast pitch drop
   2) Sharp "tak" — filtered noise transient for the slap
   3) Frame resonance — a short mid tom tone
   Slight tuning variation per hit so it feels hand-played. */
function playTick() {
  if (!state.soundOn) return;
  try {
    ensureAudio();
    const ctx = audioCtx;
    const now = ctx.currentTime;

    // Slight per-hit tuning and stereo variation
    const detune = 1 + (Math.random() * 0.06 - 0.03);
    const panVal = Math.random() * 0.5 - 0.25;

    const panner = ctx.createStereoPanner();
    panner.pan.value = panVal;
    panner.connect(audioBus);

    // ---- 1) DUM: low membrane tone with pitch drop ----
    const dumOsc = ctx.createOscillator();
    const dumGain = ctx.createGain();
    dumOsc.type = "sine";
    const dumStart = 160 * detune;
    const dumEnd = 62 * detune;
    dumOsc.frequency.setValueAtTime(dumStart, now);
    dumOsc.frequency.exponentialRampToValueAtTime(dumEnd, now + 0.14);
    dumGain.gain.setValueAtTime(0.0001, now);
    dumGain.gain.exponentialRampToValueAtTime(0.75, now + 0.006);
    dumGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    dumOsc.connect(dumGain).connect(panner);
    dumOsc.start(now);
    dumOsc.stop(now + 0.4);

    // ---- 2) TAK: filtered noise attack (the slap) ----
    const tak = ctx.createBufferSource();
    tak.buffer = noiseBuffer;
    const takFilter = ctx.createBiquadFilter();
    takFilter.type = "bandpass";
    takFilter.frequency.setValueAtTime(2600 * detune, now);
    takFilter.frequency.exponentialRampToValueAtTime(900, now + 0.06);
    takFilter.Q.value = 1.4;
    const takGain = ctx.createGain();
    takGain.gain.setValueAtTime(0.0001, now);
    takGain.gain.exponentialRampToValueAtTime(0.4, now + 0.004);
    takGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    tak.connect(takFilter).connect(takGain).connect(panner);
    tak.start(now);
    tak.stop(now + 0.12);

    // ---- 3) Frame resonance: short mid tom tone ----
    const resOsc = ctx.createOscillator();
    const resGain = ctx.createGain();
    resOsc.type = "triangle";
    resOsc.frequency.setValueAtTime(320 * detune, now);
    resOsc.frequency.exponentialRampToValueAtTime(210 * detune, now + 0.09);
    resGain.gain.setValueAtTime(0.0001, now);
    resGain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    resGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    resOsc.connect(resGain).connect(panner);
    resOsc.start(now);
    resOsc.stop(now + 0.2);

    // ---- 4) High edge tick for crispness ----
    const edge = ctx.createBufferSource();
    edge.buffer = noiseBuffer;
    const edgeHp = ctx.createBiquadFilter();
    edgeHp.type = "highpass";
    edgeHp.frequency.value = 5200;
    const edgeGain = ctx.createGain();
    edgeGain.gain.setValueAtTime(0.0001, now);
    edgeGain.gain.exponentialRampToValueAtTime(0.08, now + 0.003);
    edgeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    edge.connect(edgeHp).connect(edgeGain).connect(panner);
    edge.start(now);
    edge.stop(now + 0.05);
  } catch {
    /* audio not available */
  }
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate(15);
}

/* ---------- Actions ---------- */
function increment() {
  state.count += 1;
  state.total += 1;
  state.history.push(1);

  els.tap.classList.add("is-pressed");
  setTimeout(() => els.tap.classList.remove("is-pressed"), 120);

  playTick();
  vibrate();
  save();
  render(true);
}

function undo() {
  if (state.count === 0) return;
  state.count -= 1;
  state.total = Math.max(0, state.total - 1);
  state.history.pop();
  save();
  render();
}

function reset() {
  if (state.count === 0) return;
  const confirmed = window.confirm(
    `Reset today's count (${state.count})? Your all-time total is kept.`
  );
  if (!confirmed) return;
  state.count = 0;
  state.sessions += 1;
  state.history = [];
  save();
  render();
}

function toggleSound() {
  state.soundOn = !state.soundOn;
  save();
  render();
  if (state.soundOn) playTick();
}

/* ---------- Events ---------- */
els.tap.addEventListener("click", increment);
els.undo.addEventListener("click", undo);
els.reset.addEventListener("click", reset);
els.sound.addEventListener("click", toggleSound);

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    increment();
  } else if (e.key === "Backspace") {
    e.preventDefault();
    undo();
  }
});

/* ---------- Tabs ---------- */
const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = Array.from(document.querySelectorAll(".tab-panel"));

function activateTab(name) {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  panels.forEach((panel) => {
    const active = panel.id === `panel-${name}`;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  tab.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + dir + tabs.length) % tabs.length];
      next.focus();
      activateTab(next.dataset.tab);
    }
  });
});

/* ---------- Init ---------- */
load();
render();