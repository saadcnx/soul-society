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

function playTick() {
  if (!state.soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
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

/* ---------- Init ---------- */
load();
render();