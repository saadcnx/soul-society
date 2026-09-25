js
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* constants                                                          */
  /* ------------------------------------------------------------------ */
  var STORAGE_KEY = 'astagfarCounter.v1';
  var CHANNEL_NAME = 'astagfarCounter';
  var SEQ_TIMEOUT = 1600;   // key-set ke daramiyan max gap (ms)
  var MAX_KEYS = 6;         // maximum keys in a key-set

  var DEFAULTS = {
    items: [
      { id: 'astaghfirullah', ar: 'أَسْتَغْفِرُ اللّٰهَ', tr: 'Astaghfirullah', count: 0 },
      { id: 'astaghfirullah-rabbi', ar: 'أَسْتَغْفِرُ اللّٰهَ رَبِّي وَأَتُوبُ إِلَيْهِ', tr: 'Astaghfirullah Rabbi wa atubu ilayh', count: 0 },
      { id: 'subhanallah', ar: 'سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ', tr: 'Subhanallahi wa bihamdihi', count: 0 },
      { id: 'la-ilaha-illallah', ar: 'لَا إِلٰهَ إِلَّا اللّٰهُ', tr: 'La ilaha illallah', count: 0 }
    ],
    activeId: 'astaghfirullah',
    total: 0,
    day: { date: '', count: 0 },
    hotkey: ['a'],
    reminder: { enabled: true, minutes: 60, lastShown: 0 },
    sound: true
  };

  /* ------------------------------------------------------------------ */
  /* small helpers                                                      */
  /* ------------------------------------------------------------------ */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": ''' })[c];
    });
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function isModifier(k) {
    return k === 'control' || k === 'shift' || k === 'alt' || k === 'meta' ||
           k === 'capslock' || k === 'os' || k === 'fn';
  }

  function normKey(e) {
    var k = e.key;
    if (k === ' ' || k === 'Spacebar') return ' ';
    if (typeof k !== 'string' || !k) return '';
    return k.toLowerCase();
  }

  function prettyKey(k) {
    var map = {
      ' ': 'Space', 'arrowup': '↑', 'arrowdown': '↓', 'arrowleft': '←', 'arrowright': '→',
      'enter': 'Enter', 'escape': 'Esc', 'backspace': 'Backspace', 'tab': 'Tab', 'delete': 'Del'
    };
    if (map[k]) return map[k];
    return k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1);
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable === true;
  }

  /* ------------------------------------------------------------------ */
  /* state                                                              */
  /* ------------------------------------------------------------------ */
  var state = load();
  var CLIENT_ID = Math.random().toString(36).slice(2);
  var channel = null;
  try {
    if ('BroadcastChannel' in window) channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) { channel = null; }

  function rollDay(s) {
    var t = todayStr();
    if (!s.day || s.day.date !== t) s.day = { date: t, count: 0 };
  }

  function load() {
    var s = clone(DEFAULTS);
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          if (Array.isArray(saved.items)) {
            var items = saved.items.filter(function (it) {
              return it && typeof it.ar === 'string' && it.ar.trim();
            }).map(function (it) {
              return {
                id: String(it.id || uid()),
                ar: String(it.ar),
                tr: String(it.tr || ''),
                count: Math.max(0, Number(it.count) || 0)
              };
            });
            if (items.length) s.items = items;
          }
          if (typeof saved.activeId === 'string') s.activeId = saved.activeId;
          if (typeof saved.total === 'number') s.total = Math.max(0, saved.total);
          if (saved.day && typeof saved.day.date === 'string') {
            s.day = { date: saved.day.date, count: Math.max(0, Number(saved.day.count) || 0) };
          }
          if (Array.isArray(saved.hotkey)) {
            s.hotkey = saved.hotkey.slice(0, MAX_KEYS).map(String).filter(Boolean);
          }
          if (saved.reminder && typeof saved.reminder === 'object') {
            s.reminder.enabled = saved.reminder.enabled !== false;
            s.reminder.minutes = Math.min(720, Math.max(1, Number(saved.reminder.minutes) || 60));
            s.reminder.lastShown = Number(saved.reminder.lastShown) || 0;
          }
          if (typeof saved.sound === 'boolean') s.sound = saved.sound;
        }
      }
    } catch (e) { /* ignore broken storage */ }

    if (!s.items.length) s.items = clone(DEFAULTS.items);
    if (!s.items.some(function (i) { return i.id === s.activeId; })) s.activeId = s.items[0].id;
    if (!s.reminder.lastShown) s.reminder.lastShown = Date.now();
    rollDay(s);
    return s;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* full/blocked */ }
  }

  function broadcast() {
    if (!channel) return;
    try { channel.postMessage({ from: CLIENT_ID, type: 'state', state: state }); } catch (e) { /* ignore */ }
  }

  if (channel) {
    channel.addEventListener('message', function (ev) {
      var msg = ev.data;
      if (!msg || msg.type !== 'state' || msg.from === CLIENT_ID) return;
      state = msg.state;
      render();
    });
  }

  function activeItem() {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === state.activeId) return state.items[i];
    }
    return state.items[0] || null;
  }

  /* ------------------------------------------------------------------ */
  /* sound                                                              */
  /* ------------------------------------------------------------------ */
  var audioCtx = null;
  function beep() {
    if (!state.sound) return;
    try {
      if (!audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = 680;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
      o.stop(audioCtx.currentTime + 0.14);
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* counting                                                           */
  /* ------------------------------------------------------------------ */
  function count(by) {
    var it = activeItem();
    if (!it) return;
    rollDay(state);
    var next = it.count + by;
    it.count = next < 0 ? 0 : next;
    var t = state.total + by;
    state.total = t < 0 ? 0 : t;
    var d = state.day.count + by;
    state.day.count = d < 0 ? 0 : d;
    save();
    render();
    broadcast();
    if (by > 0) beep();
  }

  function resetActive() {
    var it = activeItem();
    if (!it) return;
    state.total = Math.max(0, state.total - it.count);
    state.day.count = Math.max(0, state.day.count - it.count);
    it.count = 0;
    save(); render(); broadcast();
  }

  /* ------------------------------------------------------------------ */
  /* key-set (1 se 6 keys)                                              */
  /* ------------------------------------------------------------------ */
  var seqBuffer = [];
  var seqTimer = null;

  function matchesPrefix(arr) {
    if (arr.length > state.hotkey.length) return false;
    for (var i = 0; i < arr.length; i++) {
      if (state.hotkey[i] !== arr[i]) return false;
    }
    return true;
  }

  function handleHotkey(key, ev) {
    if (!state.hotkey.length) return false;

    var next = seqBuffer.concat([key]);

    if (matchesPrefix(next)) {
      seqBuffer = next;
      clearTimeout(seqTimer);
      if (seqBuffer.length === state.hotkey.length) {
        seqBuffer = [];
        if (ev && ev.preventDefault) ev.preventDefault();
        count(1);
      } else {
        seqTimer = setTimeout(function () { seqBuffer = []; }, SEQ_TIMEOUT);
        if (ev && ev.preventDefault) ev.preventDefault();
      }
      return true;
    }

    clearTimeout(seqTimer);
    seqBuffer = [];

    if (matchesPrefix([key])) {
      seqBuffer = [key];
      seqTimer = setTimeout(function () { seqBuffer = []; }, SEQ_TIMEOUT);
      if (ev && ev.preventDefault) ev.preventDefault();
      return true;
    }
    return false;
  }

  function onKeyDown(e) {
    if (recording.on) return;
    if (isTypingTarget(e.target)) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var k = normKey(e);
    if (!k || isModifier(k)) return;
    handleHotkey(k, e);
  }

  /* ------------------------------------------------------------------ */
  /* key recorder                                                       */
  /* ------------------------------------------------------------------ */
  var recording = { on: false, keys: [], timer: null };

  function updateRecordBox() {
    var box = $('recordBox');
    if (!box) return;
    box.textContent = recording.keys.length
      ? recording.keys.map(prettyKey).join('  →  ')
      : '...';
  }

  function resetRecTimer() {
    clearTimeout(recording.timer);
    recording.timer = setTimeout(function () { stopRecording(true); }, SEQ_TIMEOUT);
  }

  function startRecording() {
    recording.on = true;
    recording.keys = [];
    $('recordOverlay').classList.add('show');
    updateRecordBox();
  }

  function stopRecording(saveIt) {
    recording.on = false;
    clearTimeout(recording.timer);
    $('recordOverlay').classList.remove('show');

    if (saveIt && recording.keys.length) {
      state.hotkey = recording.keys.slice(0, MAX_KEYS);
      save(); broadcast(); render();
      toast('Key set: ' + state.hotkey.map(prettyKey).join(' → '));
    }
    recording.keys = [];
  }

  function onRecordKey(e) {
    if (!recording.on) return;
    e.preventDefault();
    e.stopPropagation();

    var k = normKey(e);
    if (k === 'escape') { stopRecording(false); return; }
    if (k === 'enter') { stopRecording(true); return; }
    if (k === 'backspace') {
      recording.keys.pop();
      updateRecordBox();
      resetRecTimer();
      return;
    }
    if (!k || isModifier(k)) return;

    if (recording.keys.length >= MAX_KEYS) recording.keys = [];
    recording.keys.push(k);
    updateRecordBox();
    resetRecTimer();
  }

  /* ------------------------------------------------------------------ */
  /* mini always-on-top window (Document Picture-in-Picture)            */
  /* ------------------------------------------------------------------ */
  var pipWin = null;

  function toggleMini() {
    if (pipWin && !pipWin.closed) { pipWin.close(); return; }

    if (!('documentPictureInPicture' in window)) {
      toast('Mini window ke liye Chrome / Edge 116+ chahiye.');
      return;
    }

    documentPictureInPicture.requestWindow({ width: 250, height: 320 }).then(function (w) {
      pipWin = w;
      $('miniBtn').classList.add('on');
      buildMini(w);
      w.addEventListener('pagehide', function () {
        pipWin = null;
        $('miniBtn').classList.remove('on');
      });
    }).catch(function () {
      toast('Mini window open nahi ho saka.');
    });
  }

  function buildMini(w) {
    var d = w.document;
    d.title = 'Astagfar Counter';
    d.body.innerHTML = '';

    var style = d.createElement('style');
    style.textContent =
      'body{margin:0;background:#0b1220;color:#e9eefb;font-family:"Segoe UI",system-ui,sans-serif;' +
      'display:grid;place-items:center;height:100vh;user-select:none;-webkit-user-select:none}' +
      '.mini{text-align:center;padding:8px;width:100%}' +
      '.mini-ar{font-size:17px;direction:rtl;line-height:1.7;margin-bottom:4px}' +
      '.mini-count{font-size:46px;font-weight:800;color:#2dd4bf;line-height:1.1;margin:2px 0 8px}' +
      '.mini-tap{width:100%;padding:12px;font-size:18px;font-weight:800;border-radius:14px;border:0;' +
      'background:linear-gradient(160deg,#2dd4bf,#0d9488);color:#04211d;cursor:pointer;font-family:inherit}' +
      '.mini-key{font-size:11.5px;color:#93a3c2;margin-top:8px;letter-spacing:.06em}' +
      '.mini-row{display:flex;gap:6px;margin-top:8px}' +
      '.mini-row button{flex:1;padding:8px;border-radius:10px;border:1px solid #26344f;background:transparent;' +
      'color:#e9eefb;cursor:pointer;font-family:inherit;font-size:13px}';
    d.head.appendChild(style);

    var wrap = d.createElement('div');
    wrap.className = 'mini';
    wrap.innerHTML =
      '<div class="mini-ar" id="mAr"></div>' +
      '<div class="mini-count" id="mCount">0</div>' +
      '<button class="mini-tap" id="mTap" type="button">+1  Astagfar</button>' +
      '<div class="mini-key" id="mKey"></div>' +
      '<div class="mini-row">' +
        '<button id="mMinus" type="button">−1</button>' +
        '<button id="mReset" type="button">Reset</button>' +
      '</div>';
    d.body.appendChild(wrap);

    d.getElementById('mTap').addEventListener('click', function () { count(1); });
    d.getElementById('mMinus').addEventListener('click', function () { count(-1); });
    d.getElementById('mReset').addEventListener('click', function () { resetActive(); });
    d.addEventListener('keydown', onMiniKey);

    renderMini();
  }

  function onMiniKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var k = normKey(e);
    if (!k || isModifier(k)) return;
    handleHotkey(k, e);
  }

  function renderMini() {
    if (!pipWin || pipWin.closed) return;
    var d = pipWin.document;
    var it = activeItem();

    var ar = d.getElementById('mAr');
    if (ar) ar.textContent = it ? it.ar : '';

    var c = d.getElementById('mCount');
    if (c) c.textContent = it ? it.count : 0;

    var k = d.getElementById('mKey');
    if (k) {
      k.textContent = state.hotkey.length
        ? 'key: ' + state.hotkey.map(prettyKey).join(' → ')
        : 'key set nahi hai';
    }
  }

  /* ------------------------------------------------------------------ */
  /* reminder (default: har 60 minute)                                  */
  /* ------------------------------------------------------------------ */
  function checkReminder() {
    if (!state.reminder.enabled) return;
    var now = Date.now();
    var gap = state.reminder.minutes * 60000;
    if (now - state.reminder.lastShown < gap) return;
    state.reminder.lastShown = now;
    save();
    showReminder();
  }

  function showReminder() {
    var it = activeItem();
    var ar = it ? it.ar : 'أَسْتَغْفِرُ اللّٰهَ';
    var tr = it ? it.tr : 'Astaghfirullah';

    $('reminderText').textContent = ar;
    $('reminderOverlay').classList.add('show');
    notify('Astagfar ka waqt', tr || ar);
  }

  function notify(title, body) {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      new Notification(title, { body: body, tag: 'astagfar-reminder' });
    } catch (e) { /* mobile Chrome throws */ }
  }

  /* ------------------------------------------------------------------ */
  /* toast                                                              */
  /* ------------------------------------------------------------------ */
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ------------------------------------------------------------------ */
  /* rendering                                                          */
  /* ------------------------------------------------------------------ */
  function render() {
    rollDay(state);
    var it = activeItem();

    $('activeAr').textContent = it ? it.ar : '';
    $('activeTr').textContent = it ? it.tr : '';
    $('activeCount').textContent = it ? it.count : 0;
    $('todayLine').textContent = 'Aaj: ' + state.day.count + ' • Kul: ' + state.total;
    $('keyHint').textContent = state.hotkey.length
      ? 'Key: ' + state.hotkey.map(prettyKey).join(' → ')
      : 'Koi key set nahi';

    renderList();
    renderSettings();
    renderMini();
  }

  function renderList() {
    var list = $('list');
    if (!list) return;

    list.innerHTML = state.items.map(function (it) {
      var active = it.id === state.activeId ? ' active' : '';
      return '<li class="item' + active + '" data-id="' + esc(it.id) + '">' +
        '<button class="pick" type="button" data-action="pick" data-id="' + esc(it.id) + '">' +
          '<span class="ar">' + esc(it.ar) + '</span>' +
          '<span class="tr">' + esc(it.tr) + '</span>' +
        '</button>' +
        '<span class="num">' + it.count + '</span>' +
        '<button class="del" type="button" data-action="del" data-id="' + esc(it.id) + '" title="Delete">✕</button>' +
      '</li>';
    }).join('');
  }

  function renderSettings() {
    var box = $('hotkeyBox');
    if (box) {
      box.textContent = state.hotkey.length
        ? state.hotkey.map(prettyKey).join(' → ')
        : 'none';
    }

    var en = $('reminderEnabled');
    if (en && document.activeElement !== en) en.checked = state.reminder.enabled;

    var mi = $('reminderMinutes');
    if (mi && document.activeElement !== mi) mi.value = state.reminder.minutes;

    var sd = $('soundEnabled');
    if (sd && document.activeElement !== sd) sd.checked = state.sound;
  }

  /* ------------------------------------------------------------------ */
  /* events                                                             */
  /* ------------------------------------------------------------------ */
  function init() {
    $('tapBtn').addEventListener('click', function () { count(1); });
    $('minusBtn').addEventListener('click', function () { count(-1); });
    $('resetActiveBtn').addEventListener('click', function () {
      if (confirm('Is line ka count 0 kar dein?')) resetActive();
    });

    $('list').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-action]') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var action = btn.getAttribute('data-action');

      if (action === 'pick') {
        state.activeId = id;
        save(); render(); broadcast();
      } else if (action === 'del') {
        if (state.items.length <= 1) { toast('Kam az kam ek line rehni chahiye.'); return; }
        if (!confirm('Yeh line delete kar dein?')) return;
        var idx = -1;
        for (var i = 0; i < state.items.length; i++) {
          if (state.items[i].id === id) { idx = i; break; }
        }
        if (idx < 0) return;
        var removed = state.items.splice(idx, 1)[0];
        state.total = Math.max(0, state.total - removed.count);
        state.day.count = Math.max(0, state.day.count - removed.count);
        if (state.activeId === id) state.activeId = state.items[0].id;
        save(); render(); broadcast();
      }
    });

    $('addForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var ar = $('newAr').value.trim();
      var tr = $('newTr').value.trim();
      if (!ar) { toast('Pehle arabi text likhein.'); return; }
      var it = { id: uid(), ar: ar, tr: tr, count: 0 };
      state.items.push(it);
      state.activeId = it.id;
      $('newAr').value = '';
      $('newTr').value = '';
      save(); render(); broadcast();
      toast('Nayi line add ho gayi.');
    });

    $('settingsBtn').addEventListener('click', function () {
      var panel = $('settingsPanel');
      panel.hidden = !panel.hidden;
      renderSettings();
    });

    $('setKeyBtn').addEventListener('click', startRecording);
    $('recordSaveBtn').addEventListener('click', function () { stopRecording(true); });
    $('recordCancelBtn').addEventListener('click', function () { stopRecording(false); });

    $('clearKeyBtn').addEventListener('click', function () {
      state.hotkey = [];
      save(); render(); broadcast();
      toast('Key hata di gayi.');
    });

    $('reminderEnabled').addEventListener('change', function () {
      state.reminder.enabled = this.checked;
      state.reminder.lastShown = Date.now();
      save(); broadcast();
    });

    $('reminderMinutes').addEventListener('change', function () {
      var v = Math.min(720, Math.max(1, parseInt(this.value, 10) || 60));
      this.value = v;
      state.reminder.minutes = v;
      state.reminder.lastShown = Date.now();
      save(); broadcast();
    });

    $('soundEnabled').addEventListener('change', function () {
      state.sound = this.checked;
      save(); broadcast();
    });

    $('testReminderBtn').addEventListener('click', function () {
      state.reminder.lastShown = Date.now();
      save();
      showReminder();
    });

    $('notifyBtn').addEventListener('click', function () {
      if (!('Notification' in window)) { toast('Is browser mein notification support nahi.'); return; }
      Notification.requestPermission().then(function (p) {
        toast(p === 'granted' ? 'Notifications on.' : 'Notifications allow nahi hui.');
      });
    });

    $('reminderCountBtn').addEventListener('click', function () {
      count(1);
      $('reminderOverlay').classList.remove('show');
    });
    $('reminderCloseBtn').addEventListener('click', function () {
      $('reminderOverlay').classList.remove('show');
    });

    $('resetAllBtn').addEventListener('click', function () {
      if (!confirm('Sara data (count + lines + settings) reset kar dein?')) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      state = clone(DEFAULTS);
      state.reminder.lastShown = Date.now();
      rollDay(state);
      save(); render(); broadcast();
      toast('Sab reset ho gaya.');
    });

    $('miniBtn').addEventListener('click', toggleMini);

    document.addEventListener('keydown', onRecordKey, true);
    document.addEventListener('keydown', onKeyDown, false);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        rollDay(state);
        render();
        checkReminder();
      }
    });

    setInterval(function () {
      rollDay(state);
      render();
      checkReminder();
    }, 30000);

    render();
    checkReminder();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();