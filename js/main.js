/* =========================================================
   THE HOLLOW HOUSE — shared behaviour
   ========================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.getElementById("navToggle");
  var siteNav = document.getElementById("siteNav");

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });

    siteNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        siteNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Flashlight cursor (desktop only) ---------- */
  var torch = document.getElementById("flashlight");
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  if (torch && finePointer && !reduceMotion) {
    torch.classList.add("is-live");

    var x = window.innerWidth / 2;
    var y = window.innerHeight / 2;
    var targetX = x;
    var targetY = y;

    window.addEventListener("pointermove", function (event) {
      targetX = event.clientX;
      targetY = event.clientY;
    });

    (function loop() {
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      torch.style.transform = "translate3d(" + (x - 260) + "px, " + (y - 260) + "px, 0)";
      window.requestAnimationFrame(loop);
    })();
  }

  /* ---------- Typed subtitle ---------- */
  var typedEl = document.getElementById("typedText");

  if (typedEl) {
    var lines = [
      "It has been waiting for you.",
      "The lights do not work here.",
      "Do not answer the knocking.",
      "You are the third one this week."
    ];
    var lineIndex = 0;
    var charIndex = 0;
    var deleting = false;

    var tick = function () {
      var current = lines[lineIndex];

      if (!deleting) {
        charIndex += 1;
        typedEl.textContent = current.slice(0, charIndex);

        if (charIndex === current.length) {
          deleting = true;
          window.setTimeout(tick, 1800);
          return;
        }
      } else {
        charIndex -= 1;
        typedEl.textContent = current.slice(0, charIndex);

        if (charIndex === 0) {
          deleting = false;
          lineIndex = (lineIndex + 1) % lines.length;
        }
      }

      window.setTimeout(tick, deleting ? 32 : 62);
    };

    if (reduceMotion) {
      typedEl.textContent = lines[0];
    } else {
      tick();
    }
  }

  /* ---------- Visitor counter ---------- */
  var visitorEl = document.getElementById("visitorCount");

  if (visitorEl) {
    var count = 13666;
    window.setInterval(function () {
      count += Math.floor(Math.random() * 3);
      visitorEl.textContent = count.toLocaleString("en-US");
    }, 2600);
  }

  /* ---------- Countdown to dawn ---------- */
  var clockEl = document.getElementById("clock");

  if (clockEl) {
    var pad = function (value) {
      return String(value).padStart(2, "0");
    };

    var updateClock = function () {
      var now = new Date();
      var dawn = new Date(now);
      dawn.setHours(6, 0, 0, 0);

      if (dawn <= now) {
        dawn.setDate(dawn.getDate() + 1);
      }

      var diff = dawn - now;
      var hours = Math.floor(diff / 3600000);
      var minutes = Math.floor(diff / 60000) % 60;
      var seconds = Math.floor(diff / 1000) % 60;

      clockEl.textContent = pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
    };

    updateClock();
    window.setInterval(updateClock, 1000);
  }

  /* ---------- Fake story form ---------- */
  var storyForm = document.getElementById("storyForm");
  var formNote = document.getElementById("formNote");

  if (storyForm && formNote) {
    var replies = [
      "The house read it. It is deciding.",
      "Received. Someone will get back to you at 3:33 AM.",
      "Thank you. Your story is now the house's story.",
      "Error 666: the ink ran out. Try again never."
    ];

    storyForm.addEventListener("submit", function (event) {
      event.preventDefault();
      formNote.textContent = replies[Math.floor(Math.random() * replies.length)];
      storyForm.reset();
    });
  }
})();