/* Hoàng Quân Hạo portfolio. No dependencies. Copy comes from i18n/en.js and i18n/vi.js. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var DICT = window.I18N || {};
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;
  var lang = "en";
  var listeners = [];

  /* ---------- Language ---------- */
  function stored() {
    try { return localStorage.getItem("lang"); } catch (e) { return null; }
  }
  function store(v) {
    try { localStorage.setItem("lang", v); } catch (e) { /* storage blocked: the choice lasts this visit */ }
  }
  function t(key) {
    var d = DICT[lang] || {};
    if (key in d) return d[key];
    if (DICT.en && key in DICT.en) return DICT.en[key];
    return key;
  }
  function fmt(value, dec) {
    return Number(value).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
      minimumFractionDigits: dec, maximumFractionDigits: dec
    });
  }

  function applyLang(next) {
    lang = DICT[next] ? next : "en";
    doc.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":");
        if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
    document.querySelectorAll("[data-num]").forEach(function (el) {
      if (!el.classList.contains("counting")) el.textContent = fmt(el.getAttribute("data-num"), +(el.getAttribute("data-dec") || 0));
    });
    var titleKey = document.body.getAttribute("data-title");
    if (titleKey) document.title = t(titleKey);
    var descKey = document.body.getAttribute("data-desc");
    var meta = document.querySelector('meta[name="description"]');
    if (descKey && meta) meta.setAttribute("content", t(descKey));
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
    markPens();
    listeners.forEach(function (fn) { fn(); });
  }

  document.querySelectorAll("[data-lang]").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-lang");
      store(v);
      applyLang(v);
    });
  });

  /* ---------- Links work when the file is opened straight from disk ---------- */
  if (location.protocol === "file:") {
    document.querySelectorAll("a[href]").forEach(function (a) {
      var h = a.getAttribute("href");
      if (/^(https?:|mailto:|tel:|#)/.test(h)) return;
      var parts = h.split("#");
      var path = parts[0];
      if (path === "" || /\.[a-z0-9]+$/i.test(path)) return;
      if (path.slice(-1) !== "/") path += "/";
      a.setAttribute("href", path + "index.html" + (parts[1] ? "#" + parts[1] : ""));
    });
  }

  /* ---------- Scroll helpers ---------- */
  function belowFold(el) { return el.getBoundingClientRect().top > window.innerHeight * 0.92; }
  function onEnter(el, fn, margin) {
    if (!hasIO) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { rootMargin: margin || "0px 0px -12% 0px" });
    io.observe(el);
  }

  /* Reveal: the page is complete at rest; only content that starts below the fold waits for the reader. */
  if (!reduce && hasIO) {
    document.querySelectorAll(".reveal").forEach(function (el) {
      if (!belowFold(el)) return;
      el.classList.add("wait");
      onEnter(el, function () { el.classList.remove("wait"); });
    });
    document.querySelectorAll(".scale").forEach(function (el) {
      if (!belowFold(el)) return;
      el.classList.add("wait");
      onEnter(el, function () { el.classList.remove("wait"); }, "0px 0px -20% 0px");
    });
  }

  /* The red pen marks each observed fact once, when it reaches the reader. Language switches re-create the mark. */
  var pensDrawn = {};
  function markPens() {
    document.querySelectorAll("mark.pen").forEach(function (m, i) {
      var id = (m.closest("[data-i18n-html]") || m).getAttribute("data-i18n-html") || String(i);
      if (reduce || !hasIO || pensDrawn[id] || !belowFold(m)) { pensDrawn[id] = true; return; }
      m.classList.add("wait");
      onEnter(m, function () { pensDrawn[id] = true; m.classList.remove("wait"); }, "0px 0px -25% 0px");
    });
  }

  /* Numbers count up once; the final value is already in the page. */
  function countUp(el) {
    var target = +el.getAttribute("data-num");
    var dec = +(el.getAttribute("data-dec") || 0);
    var start = null;
    var dur = 1100;
    el.classList.add("counting");
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(2, -10 * p);
      el.textContent = fmt(target * (p === 1 ? 1 : eased), dec);
      if (p < 1) requestAnimationFrame(frame);
      else { el.classList.remove("counting"); el.textContent = fmt(target, dec); }
    }
    requestAnimationFrame(frame);
  }
  if (!reduce && hasIO) {
    document.querySelectorAll("[data-num][data-count]").forEach(function (el) {
      if (!belowFold(el)) return;
      el.textContent = fmt(0, +(el.getAttribute("data-dec") || 0));
      el.classList.add("counting");
      onEnter(el, function () { countUp(el); }, "0px 0px -15% 0px");
    });
  }

  /* ---------- Chapter rails and case study contents: light the step the reader is in ---------- */
  function spy(items, onActive) {
    if (!hasIO || !items.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) onActive(e.target); });
    }, { rootMargin: "-40% 0px -55% 0px" });
    items.forEach(function (el) { io.observe(el); });
  }
  document.querySelectorAll(".chapter").forEach(function (ch) {
    var steps = ch.querySelectorAll(".steps li");
    spy(Array.prototype.slice.call(ch.querySelectorAll("[data-beat]")), function (beat) {
      var name = beat.getAttribute("data-beat");
      steps.forEach(function (li) { li.classList.toggle("on", li.getAttribute("data-step") === name); });
    });
  });
  var tocLinks = document.querySelectorAll(".toc a[href^='#']");
  if (tocLinks.length) {
    var secs = [];
    tocLinks.forEach(function (a) { var s = document.getElementById(a.getAttribute("href").slice(1)); if (s) secs.push(s); });
    spy(secs, function (sec) {
      tocLinks.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + sec.id;
        a.classList.toggle("on", on);
        if (on) {
          a.setAttribute("aria-current", "location");
          var ol = a.closest("ol");
          if (ol && ol.scrollWidth > ol.clientWidth) ol.scrollTo({ left: a.offsetLeft - 16, behavior: reduce ? "auto" : "smooth" });
        } else a.removeAttribute("aria-current");
      });
    });
  }

  /* ---------- The Hook: a short version of the kiosk ---------- */
  var sim = document.getElementById("sim");
  if (sim) {
    var base = sim.getAttribute("data-img") || "";
    var stage = sim.querySelector(".sim-stage");
    var live = sim.querySelector(".sim-live");
    var answers = [];
    var ICON = {
      home: '<path d="M8 26 28 10l20 16"/><path d="M13 22v24h30V22"/><path d="M24 46V34h8v12"/><path d="M34 27h5v5h-5z"/>',
      road: '<path d="M6 44h44"/><path d="M24 44 27 22M32 44l-3-22"/><path d="M28 30v2M28 36v3"/><circle cx="40" cy="16" r="5"/><path d="M10 22c4-4 8-4 12 0"/>',
      speak: '<path d="M10 14h30a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H24l-9 7v-7h-5a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z"/><path d="M25 19v8M25 31v.5"/>',
      scale: '<path d="M28 10v34M18 44h20"/><path d="M12 18h32"/><path d="M12 18 6 32h12zM44 18l-6 14h12z"/><path d="M6 32a6 6 0 0 0 12 0M38 32a6 6 0 0 0 12 0"/>',
      go: '<path d="M14 8h20v40H14z"/><path d="M34 28h16M44 22l6 6-6 6"/><circle cx="29" cy="29" r="1"/>',
      mirror: '<ellipse cx="28" cy="22" rx="11" ry="14"/><path d="M28 36v10M20 46h16"/><path d="M23 16c2-2 4-3 6-3"/>'
    };
    var QS = [
      { q: "sim.q1", a: ["sim.q1a", "home", "atticus"], b: ["sim.q1b", "road", "santiago"] },
      { q: "sim.q2", a: ["sim.q2a", "speak", "holden"], b: ["sim.q2b", "scale", "atticus"] },
      { q: "sim.q3", a: ["sim.q3a", "go", "santiago"], b: ["sim.q3b", "mirror", "holden"] }
    ];
    var arrowL = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>';
    var arrowR = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>';

    function icon(name) {
      return '<svg viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + "</svg>";
    }
    function result() {
      var score = { atticus: 0, holden: 0, santiago: 0 };
      answers.forEach(function (c) { score[c] += 1; });
      var best = answers[answers.length - 1];
      Object.keys(score).forEach(function (k) { if (score[k] > score[best]) best = k; });
      return best;
    }
    function render(focus) {
      var n = answers.length;
      if (n < QS.length) {
        var q = QS[n];
        stage.innerHTML =
          '<p class="sim-prog">' + t("sim.progress").replace("{n}", n + 1) + "</p>" +
          '<h4 class="sim-q" tabindex="-1">' + t(q.q) + "</h4>" +
          '<div class="choices">' +
          '<button type="button" class="choice l" data-pick="a"><span class="side">' + arrowL + t("sim.left") + "</span>" + icon(q.a[1]) + '<span class="txt">' + t(q.a[0]) + "</span></button>" +
          '<button type="button" class="choice r" data-pick="b"><span class="side">' + t("sim.right") + arrowR + "</span>" + icon(q.b[1]) + '<span class="txt">' + t(q.b[0]) + "</span></button>" +
          "</div>";
        stage.querySelectorAll(".choice").forEach(function (b) {
          b.addEventListener("click", function () { pick(b.getAttribute("data-pick")); });
        });
        if (focus) stage.querySelector(".sim-q").focus();
        live.textContent = focus ? t("sim.progress").replace("{n}", n + 1) + ". " + t(q.q) : "";
      } else {
        var who = result();
        var names = { atticus: "Atticus Finch", holden: "Holden Caulfield", santiago: "Santiago" };
        stage.innerHTML =
          '<div class="sim-result">' +
          '<img src="' + base + "hook-char-" + who + '.jpg" width="200" height="400" alt="' + t("sim.alt." + who).replace(/"/g, "&quot;") + '">' +
          "<div>" +
          '<p class="sim-prog">' + t("sim.result") + "</p>" +
          '<h4 class="who" tabindex="-1">' + names[who] + "</h4>" +
          '<p class="trait">' + t("sim." + who + ".trait") + "</p>" +
          '<p class="book">' + t("sim." + who + ".book") + "</p>" +
          '<p class="honest">' + t("sim.honest") + "</p>" +
          '<button type="button" class="btn btn-line again">' + t("sim.again") + "</button>" +
          "</div></div>";
        stage.querySelector(".again").addEventListener("click", function () { answers = []; render(true); });
        if (focus) stage.querySelector(".who").focus();
        live.textContent = focus ? t("sim.result") + " " + names[who] + ". " + t("sim." + who + ".trait") : "";
      }
    }
    function pick(side) {
      var n = answers.length;
      if (n >= QS.length) return;
      answers.push(QS[n][side][2]);
      render(true);
    }
    sim.addEventListener("keydown", function (e) {
      if (answers.length >= QS.length || e.altKey || e.ctrlKey || e.metaKey) return;
      var side = e.key === "ArrowLeft" ? "a" : e.key === "ArrowRight" ? "b" : null;
      if (!side) return;
      e.preventDefault();
      var btn = stage.querySelector(side === "a" ? ".choice.l" : ".choice.r");
      if (btn && !reduce) { btn.classList.add("tilt"); }
      setTimeout(function () { pick(side); }, reduce ? 0 : 160);
    });
    render(false);
    listeners.push(function () { render(false); });
  }

  /* ---------- Start ---------- */
  var first = stored();
  applyLang(first === "vi" || first === "en" ? first : "en");
})();
