/* =========================================================
THE HOLLOW HOUSE — prank sequence
========================================================= */
(function () {
"use strict";

var intro = document.getElementById("prankIntro");
var accept = document.getElementById("acceptPrank");
var startBtn = document.getElementById("startPrank");
var stage = document.getElementById("prankStage");
var countdownEl = document.getElementById("countdown");
var whisperEl = document.getElementById("whisper");
var scare = document.getElementById("scare");
var reveal = document.getElementById("reveal");
var replayBtn = document.getElementById("replayBtn");
var againBtn = document.getElementById("againBtn");

if (!intro || !startBtn || !stage || !countdownEl || !scare || !reveal) {
return;
}

var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var timers = [];
var audioCtx = null;
var running = false;

function clearTimers() {
timers.forEach(function (id) {
window.clearTimeout(id);
});
timers = [];
}

function later(fn, ms) {
timers.push(window.setTimeout(fn, ms));
}

function getAudio() {
var Ctor = window.AudioContext || window.webkitAudioContext;
if (!Ctor) return null;
if (!audioCtx) {
audioCtx = new Ctor();
}
if (audioCtx.state === "suspended") {
audioCtx.resume();
}
return audioCtx;
}

/* ---------- Sound: low dread drone ---------- */
function playDrone() {
var ctx = getAudio();
if (!ctx) return;

var osc = ctx.createOscillator();
var gain = ctx.createGain();

osc.type = "sawtooth";
osc.frequency.setValueAtTime(58, ctx.currentTime);
osc.frequency.exponentialRampToValueAtTime(34, ctx.currentTime + 4);

gain.gain.setValueAtTime(0.0001, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 1.2);
gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4.4);

osc.connect(gain).connect(ctx.destination);
osc.start();
osc.stop(ctx.currentTime + 4.6);
}

/* ---------- Sound: jump scare scream ---------- */
function playScream() {
var ctx = getAudio();
if (!ctx) return;

var now = ctx.currentTime;

/* Noise burst */
var length = Math.floor(ctx.sampleRate * 1.4);
var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
var data = buffer.getChannelData(0);

for (var i = 0; i < length; i += 1) {
var decay = Math.pow(1 - i / length, 1.8);
data[i] = (Math.random() * 2 - 1) * decay;
}

var noise = ctx.createBufferSource();
noise.buffer = buffer;

var band = ctx.createBiquadFilter();
band.type = "bandpass";
band.frequency.setValueAtTime(1800, now);
band.frequency.exponentialRampToValueAtTime(420, now + 1.2);
band.Q.value = 0.9;

var noiseGain = ctx.createGain();
noiseGain.gain.setValueAtTime(0.9, now);
noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

noise.connect(band).connect(noiseGain).connect(ctx.destination);
noise.start(now);
noise.stop(now + 1.45);

/* Descending screech */
var osc = ctx.createOscillator();
var oscGain = ctx.createGain();

osc.type = "square";
osc.frequency.setValueAtTime(1400, now);
osc.frequency.exponentialRampToValueAtTime(120, now + 1.1);

oscGain.gain.setValueAtTime(0.28, now);
oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

osc.connect(oscGain).connect(ctx.destination);
osc.start(now);
osc.stop(now + 1.25);
}

/* ---------- Sound: happy chime for the reveal ---------- */
function playChime() {
var ctx = getAudio();
if (!ctx) return;

[523.25, 659.25, 783.99].forEach(function (freq, index) {
var osc = ctx.createOscillator();
var gain = ctx.createGain();
var start = ctx.currentTime + index * 0.11;

osc.type = "triangle";
osc.frequency.setValueAtTime(freq, start);

gain.gain.setValueAtTime(0.0001, start);
gain.gain.exponentialRampToValueAtTime(0.18, start + 0.04);
gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);

osc.connect(gain).connect(ctx.destination);
osc.start(start);
osc.stop(start + 0.55);
});
}

/* ---------- Enable / disable start button ---------- */
if (accept) {
accept.addEventListener("change", function () {
startBtn.disabled = !accept.checked;
});
}

/* ---------- Reset everything ---------- */
function reset() {
clearTimers();
running = false;

scare.classList.remove("is-on");
scare.setAttribute("aria-hidden", "true");
reveal.hidden = true;
stage.hidden = true;
stage.classList.remove("is-shaking");
intro.hidden = false;

countdownEl.textContent = "3";
whisperEl.textContent = "Get comfortable…";

if (accept) {
accept.checked = false;
}
startBtn.disabled = true;
startBtn.textContent = "Start The Prank";

window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Whisper script ---------- */
var whispers = [
"I can hear you breathing.",
"Don't turn around.",
"You shouldn't have come here.",
"There is someone behind you.",
"Look. At. The. Screen."
];

/* ---------- Main sequence ---------- */
function run() {
if (running) return;
running = true;

clearTimers();

intro.hidden = true;
reveal.hidden = true;
scare.classList.remove("is-on");
stage.hidden = false;

var numbers = ["3", "2", "1"];

numbers.forEach(function (value, index) {
later(function () {
countdownEl.textContent = value;

if (!reduceMotion) {
countdownEl.style.animation = "none";
void countdownEl.offsetWidth;
countdownEl.style.animation = "";
}

whisperEl.textContent = whispers[index];
playDrone();
}, index * 1000);
});

/* Whispers phase */
later(function () {
countdownEl.textContent = "";
whisperEl.textContent = whispers[3];
stage.classList.add("is-shaking");
}, 3050);

later(function () {
whisperEl.textContent = whispers[4];
}, 3700);

/* Jump scare */
later(function () {
stage.classList.remove("is-shaking");
scare.classList.add("is-on");
scare.setAttribute("aria-hidden", "false");

playScream();

if (navigator.vibrate) {
navigator.vibrate([220, 90, 320]);
}
}, 4300);

/* Reveal */
later(function () {
scare.classList.remove("is-on");
scare.setAttribute("aria-hidden", "true");
reveal.hidden = false;

playChime();

if (navigator.vibrate) {
navigator.vibrate(60);
}
}, 6200);
}

startBtn.addEventListener("click", run);

if (replayBtn) {
replayBtn.addEventListener("click", reset);
}

if (againBtn) {
againBtn.addEventListener("click", reset);
}

/* Escape hatch: tap the scare overlay to bail out early */
scare.addEventListener("click", function () {
clearTimers();
scare.classList.remove("is-on");
scare.setAttribute("aria-hidden", "true");
reveal.hidden = false;
running = false;
});
})();