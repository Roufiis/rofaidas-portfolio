/* Rofaida Abdelwahap portfolio scripts */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var site = $("#site"), world = $("#world"), scene = $("#scene"), prism = $("#prism");
  var faces = $$(".face"), live = $("#live");
  var R = window.R2 = window.R2 || {};
  R.reduced = reduced;
  /* who is driving: focus is handed around only for keyboard users, so a
     mouse or wheel never leaves a focus label lit after a transition */
  R.keyboardUser = false;
  addEventListener("keydown", function (e) { if (!e.metaKey && !e.ctrlKey && !e.altKey) R.keyboardUser = true; }, true);
  ["pointerdown", "wheel", "touchstart"].forEach(function (t) { addEventListener(t, function () { R.keyboardUser = false; }, { capture: true, passive: true }); });

  /* ======================================================= the turning world
     Three rooms on the sides of a triangular prism. At rest the front face sits
     exactly on the screen plane (scale 1, pixel-true to Figma). Hold and drag
     and the prism backs away from the camera, so you see it as an object, and
     turns with your hand; let go and it settles on the nearest room. */
  var W = 0, H = 0, A = 0, P = 0, Z = 0;              // apothem, perspective, zoom-out depth
  var ang = { x: 0, v: 0, t: 0 }, dep = { x: 0, v: 0, t: 0 };
  var face = 0, phase = "", goCb = null, raf = 0, lastT = 0, dragging = false;

  function measure() {
    W = window.innerWidth; H = window.innerHeight;
    A = W / (2 * Math.tan(Math.PI / 3));
    P = Math.max(1400, W * 1.5);
    var zoom = W < 760 ? 0.74 : 0.6;
    Z = P * (1 / zoom - 1);
    scene.style.setProperty("--P", P + "px");
    faces.forEach(function (f) { f.style.setProperty("--a", A.toFixed(2) + "px"); });
    paint();
  }
  function paint() {
    prism.style.transform = "translateZ(" + (-(A + dep.x)).toFixed(2) + "px) rotateY(" + ang.x.toFixed(3) + "deg)";
  }
  var mod = function (n, m) { return ((n % m) + m) % m; };
  function faceOf(a) { return mod(Math.round(-a / 120), 3); }
  function nearestAngle(i) {               /* the copy of face i's angle closest to where we are */
    var base = -i * 120, k = Math.round((ang.x - base) / 360);
    return base + k * 360;
  }

  var faceSet = false;
  function setFace(i, announce) {
    if (faceSet && i === face) return;
    faceSet = true;
    face = i; site.setAttribute("data-face", String(i));
    faces.forEach(function (f) {
      var on = +f.getAttribute("data-i") === i;
      f.inert = !on; f.classList.toggle("on", on); f.setAttribute("aria-hidden", on ? "false" : "true");
    });
    navCurrent();
    if (announce) live.textContent = ["Home", "Selected works", "About me"][i];
    if (R.onFace) R.onFace(i);
  }
  R.face = function () { return face; };

  /* critically-damped-ish springs, integrated at a fixed step */
  function spring(s, k, c, dt) { var a = k * (s.t - s.x) - c * s.v; s.v += a * dt; s.x += s.v * dt; }
  function tick(now) {
    var dt = Math.min(0.1, (now - lastT) / 1000 || 0.016); lastT = now;
    var steps = Math.ceil(dt / 0.008), h = dt / steps;
    for (var i = 0; i < steps; i++) {
      if (!dragging) spring(ang, 95, 18.5, h);
      spring(dep, dep.t ? 90 : 130, dep.t ? 19 : 22.5, h);
    }
    if (phase === "out" && dep.x > Z * 0.35) { phase = "turn"; ang.t = goTarget; }
    if ((phase === "turn" || phase === "release") && Math.abs(ang.t - ang.x) < 24) { phase = "in"; dep.t = 0; }
    paint();
    var f = faceOf(ang.x); if (f !== face && !dragging) setFace(f, false);
    var orb = dragging || dep.x > 2;
    if (orb !== site.hasAttribute("data-orbit")) site.toggleAttribute("data-orbit", orb);
    var settled = !dragging && Math.abs(ang.t - ang.x) < 0.06 && Math.abs(ang.v) < 0.4 && Math.abs(dep.t - dep.x) < 1.5 && Math.abs(dep.v) < 4;
    if (settled) {
      ang.x = ang.t; dep.x = dep.t; ang.v = dep.v = 0; paint(); raf = 0;
      if (dep.t === 0) { site.removeAttribute("data-orbit"); setFace(faceOf(ang.x), true); phase = ""; var cb = goCb; goCb = null; if (cb) cb(); }
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }

  var goTarget = 0;
  /* turn to a room: back away, swing round, come forward */
  R.go = function (i, cb) {
    i = mod(i, 3);
    if (i !== 0 && R.intro && !R.intro.done()) { R.intro.finish(function () { R.go(i, cb); }); return; }
    var tgt = nearestAngle(i);
    if (reduced) {
      ang.x = ang.t = tgt; dep.x = dep.t = 0; paint(); setFace(i, true);
      if (cb) cb(); return;
    }
    if (Math.abs(tgt - ang.x) < 0.5 && dep.x < 1) { setFace(i, true); if (cb) cb(); return; }
    goCb = cb || null; goTarget = tgt;
    phase = "out"; dep.t = Z;
    site.setAttribute("data-turned", "");
    kick();
  };

  /* ---------------------------------------------------------- hold & drag */
  var ptr = null, suppressClick = false, holdT = 0;
  function enterOrbit() {
    if (dragging) return;
    dragging = true; phase = "drag"; dep.t = Z; ang.t = ang.x; ang.v = 0;
    world.classList.add("grab");
    site.setAttribute("data-turned", "");
    try { world.setPointerCapture(ptr.id); } catch (e) {}
    kick();
  }
  world.addEventListener("pointerdown", function (e) {
    if (site.getAttribute("data-mode") !== "world" || e.button > 0) return;
    if (e.target.closest(".vibes,input")) return;
    if (face === 0 && R.intro && !R.intro.done()) return;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, a: ang.x, hist: [[performance.now(), ang.x]], type: e.pointerType };
    clearTimeout(holdT);
    holdT = setTimeout(function () { if (ptr && !dragging && !reduced) enterOrbit(); }, 420);
  });
  world.addEventListener("pointermove", function (e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    var dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    if (!dragging) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) { clearTimeout(holdT); if (reduced) { ptr.swipe = dx; return; } enterOrbit(); ptr.x = e.clientX; dx = 0; }
      else if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx) * 1.3) {
        clearTimeout(holdT);
        if (ptr.type !== "mouse") { var d = dy < 0 ? 1 : -1; ptr = null; vertical(d); }
        return;
      } else return;
    }
    var perPx = 120 / (W * (W < 760 ? 0.74 : 0.6));
    ang.x = ang.t = ptr.a + dx * perPx;
    var now = performance.now(); ptr.hist.push([now, ang.x]); if (ptr.hist.length > 6) ptr.hist.shift();
    paint();
  });
  function release(e) {
    clearTimeout(holdT);
    if (!ptr || (e && e.pointerId !== ptr.id)) return;
    if (reduced && ptr.swipe) { var sw = ptr.swipe; ptr = null; R.go(face + (sw < 0 ? 1 : -1)); return; }
    if (dragging) {
      dragging = false; world.classList.remove("grab");
      var h = ptr.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b[0] - a[0]);
      var v = (b[1] - a[1]) / dt * 1000;                      /* deg / s */
      if (performance.now() - b[0] > 120) v = 0;
      var proj = ang.x + v * 0.22;
      var base = Math.round(ptr.a / 120) * 120;
      var snap = Math.max(base - 240, Math.min(base + 240, Math.round(proj / 120) * 120));
      ang.t = snap; ang.v = v * 0.6; phase = "release";
      suppressClick = true; setTimeout(function () { suppressClick = false; }, 60);
      kick();
    }
    ptr = null;
  }
  world.addEventListener("pointerup", release);
  world.addEventListener("pointercancel", release);
  world.addEventListener("lostpointercapture", function (e) { if (dragging) release(e); });
  world.addEventListener("click", function (e) { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; } }, true);
  world.addEventListener("dragstart", function (e) { e.preventDefault(); });

  /* scroll and trackpads: down turns forward / opens the laptop, sideways turns */
  var wheelAcc = 0, wheelX = 0, wheelLock = 0;
  function vertical(dir) {
    if (face === 1 && R.cueAway) R.cueAway();
    if (dir > 0) { if (face === 1) { if (R.enterWorks) R.enterWorks(); } else if (face === 0) R.go(1); else if (R.hintPages) R.hintPages(); }
    else { if (face === 1) R.go(0); else if (face === 2) R.go(1); }
  }
  world.addEventListener("wheel", function (e) {
    if (site.getAttribute("data-mode") !== "world" || dragging) return;
    e.preventDefault();
    /* any scroll on the laptop screen clears its "open the laptop" cue straight away */
    if (face === 1 && R.cueAway && Math.abs(e.deltaY) > 2) R.cueAway();
    var now = performance.now();
    if (face === 0 && R.intro && Math.abs(e.deltaY) >= Math.abs(e.deltaX) && R.intro.wheel(e.deltaY)) { wheelAcc = 0; return; }
    if (face === 0 && R.intro && !R.intro.done()) return;
    if (now < wheelLock) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      wheelX += e.deltaX; wheelAcc = 0;
      if (Math.abs(wheelX) > 60) { R.go(face + (wheelX > 0 ? 1 : -1)); wheelX = 0; wheelLock = now + 900; }
    } else {
      wheelAcc += e.deltaY; wheelX = 0;
      if (Math.abs(wheelAcc) > 40) { vertical(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; wheelLock = now + 1100; }
    }
  }, { passive: false });

  addEventListener("keydown", function (e) {
    if (site.getAttribute("data-mode") !== "world" || site.hasAttribute("data-sheet")) return;
    var t = e.target; if (t && (t.tagName === "INPUT" || t.isContentEditable)) return;
    if (face === 0 && R.intro && !e.target.closest(".vibes")) {
      if (!R.intro.done() && (e.key === "ArrowDown" || e.key === "PageDown")) { R.intro.step(1); e.preventDefault(); return; }
      if (R.intro.t() > 0 && (e.key === "ArrowUp" || e.key === "PageUp")) { R.intro.step(-1); e.preventDefault(); return; }
    }
    if (e.key === "ArrowRight") { R.go(face + 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { R.go(face - 1); e.preventDefault(); }
    else if ((e.key === "ArrowDown" || e.key === "PageDown") && face === 1 && !e.target.closest(".vibes")) { if (R.enterWorks) R.enterWorks(); e.preventDefault(); }
  });

  /* ================================================================ routing */
  var cpBtn = $("#compassBtn"), navLinks = $$("#compass [data-go]"), navCur = $("#navCur"), CUR_LBL = { home: "Home", works: "Work", about: "About", contact: "Contact" };
  function navCurrent() {
    var m = site.getAttribute("data-mode"), cur = m === "contact" ? "contact" : (m === "works" || m === "all" || m === "case") ? "works" : ["home", "works", "about"][face];
    navLinks.forEach(function (a) { a.setAttribute("aria-current", a.getAttribute("data-go") === cur ? "page" : "false"); });
    /* the header names the page you are on, with a small swap when it changes */
    /* on the project pages the compass becomes the way back */
    var back = m === "case";
    if (cpBtn) {
      if (back) {
        cpBtn.setAttribute("aria-label", "Back to the projects");
        cpBtn.removeAttribute("aria-haspopup"); cpBtn.removeAttribute("aria-expanded");
      } else {
        cpBtn.removeAttribute("aria-label"); cpBtn.setAttribute("aria-haspopup", "dialog"); cpBtn.setAttribute("aria-expanded", site.hasAttribute("data-compass") ? "true" : "false");
      }
    }
    var want = back ? "Back" : CUR_LBL[cur];
    if (!navCur || navCur.dataset.want === want) return;
    navCur.dataset.want = want;
    if (reduced || navCur.textContent === "") { navCur.textContent = want; return; }
    /* a timed swap (not an animation callback), so the label always lands even while the world is turning */
    clearTimeout(navCur._t); navCur.classList.add("out");
    navCur._t = setTimeout(function () { navCur.textContent = navCur.dataset.want; navCur.classList.remove("out"); }, 170);
  }
  R.navCurrent = navCurrent;
  R.setMode = function (m) {
    site.setAttribute("data-mode", m);
    world.inert = m !== "world";
    navCurrent();
  };
  R.route = function (where) {
    var m = site.getAttribute("data-mode");
    /* from a case page (e.g. the header avatar): slide the case away, then route from where it was opened */
    if (m === "case" && R.closeCase) { R.closeCase(); m = site.getAttribute("data-mode"); }
    function fromWorld(fn) {
      if (site.hasAttribute("data-sheet") && R.closeSheet) { R.closeSheet(true); }
      if (m === "contact" && R.closeContact) R.closeContact(true);
      if (m === "all" && R.closeAll) R.closeAll(true);
      if ((m === "works" || m === "all") && R.exitWorks) { R.exitWorks(fn); return; }
      fn();
    }
    if (where === "contact") { if (m !== "contact" && R.openContact) R.openContact(); return; }
    if (where === "home") return fromWorld(function () { R.go(0); });
    if (where === "about") return fromWorld(function () { R.go(2); });
    if (where === "works" || where === "play") {
      var to = where === "play" ? "play" : null;
      if (m === "works") { if (R.worksScroll) R.worksScroll(to); return; }
      if (m === "all") { R.closeAll(); if (to) R.worksScroll(to); return; }
      if (m === "contact") R.closeContact(true);
      if (site.hasAttribute("data-sheet") && R.closeSheet) R.closeSheet(true);
      if (face === 1 && where === "works" && m === "world") { R.enterWorks(); return; }
      if (where === "play") { R.go(1, function () { R.enterWorks({ to: "play" }); }); return; }
      R.go(1, function () { if (R.peekScreen) R.peekScreen(); });
    }
  };
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-go]");
    if (!a || a.classList.contains("spot")) return;
    e.preventDefault();
    R.route(a.getAttribute("data-go"));
  });

  /* ============================================================ header + compass menu (Oct 26)
     Day only now (the day/night switch was removed). The name types itself in, letter by
     letter, once the opening zoom has finished; the compass opens a side menu over a blur. */
  site.setAttribute("data-theme", "day");
  var tw = $(".nh-name .tw"), twDone = false;
  if (tw) {
    var txt = tw.textContent; tw.textContent = "";
    txt.split("").forEach(function (ch) { var sp = document.createElement("span"); sp.textContent = ch; tw.appendChild(sp); });
  }
  /* the name types itself on the very first screen, holds, erases, and types again, on a loop.
     It rests (stays fully written) while the pointer or focus is on it, while the menu is open,
     and while the tab is hidden; reduced motion shows the name still. */
  var nm = $(".nh-name"), nhMe = $(".nh-me"), twLs = tw ? $$("span", tw) : [], twTimer = 0, twHold = false;
  var TYPE = 85, ERASE = 38, HOLD = 5200, GAP = 650;
  /* the caret rides just after the last letter that is showing, so it moves with the typing and the erasing */
  var twCaret = nm && $(".caret", nm);
  function twAt(n) {
    twLs.forEach(function (l, i) { l.classList.toggle("on", i < n); });
    if (!twCaret || !twLs.length) return;
    var x = n > 0 ? twLs[n - 1].offsetLeft + twLs[n - 1].offsetWidth : twLs[0].offsetLeft;
    twCaret.style.transform = "translate(" + (x + 1) + "px,-50%)";
  }
  function twResting() { return twHold || document.hidden || site.hasAttribute("data-compass"); }
  function twStep(n, dir) {
    clearTimeout(twTimer);
    if (twResting()) { twAt(twLs.length); nm.classList.remove("typing"); nm.classList.add("typed"); twTimer = setTimeout(function () { twStep(twLs.length, 0); }, 900); return; }
    twAt(n);
    if (dir > 0) {                                                   /* typing */
      nm.classList.add("typing"); nm.classList.remove("typed");
      if (n < twLs.length) twTimer = setTimeout(function () { twStep(n + 1, 1); }, TYPE);
      else twTimer = setTimeout(function () { twStep(n, 0); }, 900);
    } else if (dir === 0) {                                          /* holding, written out */
      nm.classList.remove("typing"); nm.classList.add("typed");
      twTimer = setTimeout(function () { twStep(n, -1); }, HOLD);
    } else {                                                         /* erasing */
      nm.classList.add("typing"); nm.classList.remove("typed");
      if (n > 0) twTimer = setTimeout(function () { twStep(n - 1, -1); }, ERASE);
      else twTimer = setTimeout(function () { twStep(1, 1); }, GAP);
    }
  }
  function typeName() {
    if (!tw) return;
    if (reduced) { twAt(twLs.length); nm.classList.add("typed"); return; }
    twStep(0, 1);
  }
  R.typeName = typeName;
  /* the header gets its blurred band once the current page has scrolled a little */
  var SCROLLER = { works: "worksPage", all: "allWorks", "case": "casePage", contact: "contactPage" };
  function hScroll() {
    var id = SCROLLER[site.getAttribute("data-mode")], el = id && document.getElementById(id);
    site.toggleAttribute("data-hscroll", !!(el && el.scrollTop > 8));
  }
  document.addEventListener("scroll", function (e) { if (e.target && e.target.id && /^(worksPage|allWorks|casePage|contactPage)$/.test(e.target.id)) hScroll(); }, { capture: true, passive: true });
  new MutationObserver(hScroll).observe(site, { attributes: true, attributeFilter: ["data-mode"] });
  var twStart = function () { setTimeout(typeName, 500); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(twStart, twStart); else twStart();
  /* hover: the letters nearest the pointer lift and tilt, a little wave that follows the cursor
     along the name (after Oorja Kapoor's logo); they settle back with a spring when it leaves */
  var waveC = [], waveOn = false;
  function waveMeasure() { waveC = twLs.map(function (l) { var r = l.getBoundingClientRect(); return r.left + r.width / 2; }); }
  function waveAt(px) {
    var SIG = 26, A = 6;
    twLs.forEach(function (l, i) {
      var d = (waveC[i] - px) / SIG, g = Math.exp(-d * d);
      l.style.setProperty("--wy", (-A * g).toFixed(2) + "px");
      l.style.setProperty("--wr", (Math.max(-1, Math.min(1, d)) * 9 * g).toFixed(2) + "deg");
    });
  }
  function waveOff() { waveOn = false; twLs.forEach(function (l) { l.style.setProperty("--wy", "0px"); l.style.setProperty("--wr", "0deg"); }); }
  /* keyboard focus or a tap sweeps the wave across once */
  function waveSweep() {
    if (reduced || !twLs.length) return;
    waveMeasure(); var a = waveC[0] - 30, z = waveC[waveC.length - 1] + 30, t0 = performance.now(), D = 1100;
    (function f(now) { var k = Math.min(1, (now - t0) / D); waveAt(a + (z - a) * k); if (k < 1) requestAnimationFrame(f); else waveOff(); })(t0);
  }
  if (nhMe && !reduced) {
    nhMe.addEventListener("pointerenter", function (e) { if (e.pointerType !== "mouse") return; waveOn = true; nm.classList.add("wave"); waveMeasure(); waveAt(e.clientX); });
    nhMe.addEventListener("pointermove", function (e) { if (waveOn) waveAt(e.clientX); });
    nhMe.addEventListener("pointerleave", function () { waveOff(); });
    nhMe.addEventListener("focus", function () { if (nhMe.matches(":focus-visible")) setTimeout(waveSweep, 60); });
  }
  if (nhMe) {
    nhMe.addEventListener("pointerenter", function () { twHold = true; });
    nhMe.addEventListener("pointerleave", function () { twHold = false; });
    nhMe.addEventListener("focus", function () { twHold = true; });
    nhMe.addEventListener("blur", function () { twHold = false; });
  }

  var cp = $("#compass"), cpLast = null;
  function cpFocusables() { return $$("a[href],button:not([disabled])", cp).filter(function (x) { return x.offsetParent !== null; }); }
  function openCompass() {
    if (!cp.hidden) return;
    clearTimeout(cpT); site.removeAttribute("data-cpout");
    cpLast = document.activeElement; cp.hidden = false; void cp.offsetWidth;
    site.setAttribute("data-compass", ""); cpBtn.setAttribute("aria-expanded", "true");
    var cur = $("[aria-current='page']", cp);
    setTimeout(function () { (cur || cpFocusables()[0]).focus({ preventScroll: true }); }, reduced ? 0 : 120);
  }
  /* closing is quicker than opening (about 60%), and gathers back toward the compass it came from */
  var cpT = 0;
  function closeCompass(viaRoute) {
    if (cp.hidden || site.hasAttribute("data-cpout")) return;
    cpBtn.setAttribute("aria-expanded", "false");
    if (reduced) { site.removeAttribute("data-compass"); cp.hidden = true; }
    else {
      site.setAttribute("data-cpout", ""); site.removeAttribute("data-compass");
      clearTimeout(cpT); cpT = setTimeout(function () { cp.hidden = true; site.removeAttribute("data-cpout"); }, 240);
    }
    if (cpLast && cpLast.focus && !viaRoute) cpLast.focus({ preventScroll: true });
  }
  $$(".cp-nav a", cp).forEach(function (a, i) { a.style.setProperty("--i", i); });
  /* decode the menu pictures ahead of time, so the first open never shows an empty card */
  addEventListener("load", function () { setTimeout(function () { $$("img", cp).forEach(function (im) { if (im.decode) im.decode().catch(function () {}); }); }, 1200); });
  R.openCompass = openCompass; R.closeCompass = closeCompass;
  cpBtn.addEventListener("click", function () {
    var m = site.getAttribute("data-mode");
    if (m === "case") { if (R.closeCase) R.closeCase(); return; }
    cp.hidden || site.hasAttribute("data-cpout") ? openCompass() : closeCompass();
  });
  cp.addEventListener("click", function (e) {
    if (e.target.closest("[data-cp-close]")) { closeCompass(); return; }
    if (e.target.closest("[data-go]")) closeCompass(true);            /* the route itself runs from the page-wide handler */
  });
  addEventListener("keydown", function (e) {
    if (cp.hidden || site.hasAttribute("data-cpout")) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeCompass(); return; }
    if (e.key === "Tab") {                                             /* keep focus inside the menu while it is open */
      var f = cpFocusables(), a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  }, true);

  function toast(anchor, text) {
    var tip = $("#kcTip"), r = anchor.getBoundingClientRect();
    tip.textContent = text; tip.style.left = Math.max(80, Math.min(innerWidth - 80, r.left + r.width / 2)) + "px"; tip.style.top = (r.bottom + 46) + "px";
    tip.classList.add("kc-on"); clearTimeout(tip._t); tip._t = setTimeout(function () { tip.classList.remove("kc-on"); }, 1800);
  }
  R.toast = toast;
  /* email: the mail app may not open from inside the page, so the address is copied too */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-copy]"); if (!a) return;
    var v = a.getAttribute("data-copy");
    try { navigator.clipboard.writeText(v).then(function () { toast(a, "Email copied: " + v); }, function () { toast(a, v); }); } catch (err) { toast(a, v); }
  });
  document.addEventListener("click", function (e) {
    var c = e.target.closest("[data-case]");
    if (c) { e.preventDefault(); toast(c, c.getAttribute("data-case") + " case study opens here"); }
  });

  /* ================================================================ sound */
  var AC = null, master = null, ambient = null;
  function ctx() {
    if (!AC) {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      AC = new C(); master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
    }
    if (AC.state === "suspended") AC.resume();
    return AC;
  }
  R.ctx = ctx; R.master = function () { ctx(); return master; };
  function chime() { return; }   /* Nov 7 (Doha): no sound effects, only the soundtrack */
  function chimeOff(freqs, gap, vol) {
    var a = ctx(); if (!a) return;
    freqs.forEach(function (f, i) {
      var t = a.currentTime + i * (gap || 0.09), o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || 0.07, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.7);
    });
  }
  R.chime = chime;
  /* Nov 7 (Doha): the meow stays; it and the soundtrack are the only sounds */
  /* the meow: Doha's recording (a/meow.mp3), one per tap. Each cat gets its own pitch,
     and every tap varies a hair so it never sounds copy-pasted. */
  var MEOW = { grey: 1, cream: 1.08, white: 1.15, black: 0.88, orange: 1.04, photo: 0.96 }, lastMeow = 0;
  var meowBytes = null, meowBuf = null, meowWait = null;
  function meowFetch() {
    if (meowBytes) return meowBytes;
    meowBytes = fetch("a/meow.mp3").then(function (r) { return r.arrayBuffer(); }).catch(function () { meowBytes = null; });
    return meowBytes;
  }
  function meowDecode() {
    var a = ctx(); if (!a) return null;
    if (!meowBuf) meowBuf = meowFetch().then(function (b) { return b && a.decodeAudioData(b.slice(0)); }).catch(function () { meowBuf = null; });
    return meowBuf;
  }
  function meow(kind) {
    var now = performance.now(); if (now - lastMeow < 140) return; lastMeow = now;
    var p = meowDecode(); if (!p) return;
    p.then(function (buf) {
      if (!buf || performance.now() - now > 900) return;   /* too late to feel like a reply: skip */
      var a = ctx(), src = a.createBufferSource(), g = a.createGain();
      src.buffer = buf; src.playbackRate.value = (MEOW[kind] || 1) * (0.97 + Math.random() * 0.06);
      g.gain.value = 0.85; src.connect(g); g.connect(master); src.start();
    });
  }
  /* fetch the file once the page is idle, and warm the decoder on the first press on a cat */
  setTimeout(meowFetch, 2500);
  R.meow = meow;
  /* any cat anywhere (the painted one, stickers, cat photos): a tap says meow. Drags stay quiet. */
  function catKind(t) {
    if (!t || !t.closest) return null;
    var m = t.closest("[data-meow]"); if (m) return m.getAttribute("data-meow") || "grey";
    var img = t.tagName === "IMG" ? t : t.querySelector(":scope > img"); if (!img) return null;
    var src = img.getAttribute("src") || "", c = /s-(white|cream|black|orange)\.webp/.exec(src);
    return c ? c[1] : (/p-cat/.test(src) ? "photo" : null);
  }
  var tap = null;
  document.addEventListener("pointerdown", function (e) {
    var k = catKind(e.target); tap = k ? { k: k, x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() } : null;
    if (k) meowDecode();
  }, true);
  document.addEventListener("pointerup", function (e) {
    if (!tap || e.pointerId !== tap.id) return;
    var tp = tap; tap = null;
    if (Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 7 && performance.now() - tp.t < 700) meow(tp.k);
  }, true);
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.matches && e.target.matches(".spot[data-meow],.sticker,[data-meow]")) meow(catKind(e.target) || "grey");
  }, true);
  function startAmbient() {
    var a = ctx(); if (!a || ambient) return;
    var len = a.sampleRate * 3, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    var src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    var lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
    var g = a.createGain(); g.gain.value = 0;
    var lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(master); g.gain.linearRampToValueAtTime(0.11, a.currentTime + 1.5); src.start(); lfo.start();
    var birdT = setInterval(function () { if (Math.random() < 0.6) chime([2350 + Math.random() * 500, 2900 + Math.random() * 400], 0.07, 0.018); }, 3200);
    ambient = { stop: function () {
      clearInterval(birdT); g.gain.cancelScheduledValues(a.currentTime); g.gain.setValueAtTime(g.gain.value, a.currentTime);
      g.gain.linearRampToValueAtTime(0, a.currentTime + 0.6); setTimeout(function () { try { src.stop(); lfo.stop(); } catch (e) {} }, 700);
    } };
  }
  var soundBtn = $("#soundBtn"), kcSound = $("#kcSound");
  /* the menu's sound icon plays and pauses the home soundtrack (the "Feel the vibes" player); both stay in sync */
  soundBtn.addEventListener("click", function () { if (R.toggleMusic) R.toggleMusic(); });
  R.soundOn = function () { return soundBtn.getAttribute("aria-pressed") === "true"; };

  /* ============================================================ home room */
  var home = $("#home"), bubble = $("#bubble"), bubbleT = 0;
  function say(anchor, text, aside) {
    bubble.innerHTML = ""; bubble.appendChild(document.createTextNode(text));
    if (aside) { var em = document.createElement("em"); em.textContent = aside; bubble.appendChild(em); }
    var vr = home.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    bubble.style.left = Math.max(16, Math.min(vr.width - 256, r.left - vr.left + r.width * 0.55)) + "px";
    bubble.style.top = Math.max(96, r.top - vr.top - 12) + "px";
    bubble.classList.remove("on"); void bubble.offsetWidth; bubble.classList.add("on");
    clearTimeout(bubbleT); bubbleT = setTimeout(function () { bubble.classList.remove("on"); }, 3200);
  }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  R.restart = restart;
  function notes(anchor, n) {
    var vr = home.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    for (var i = 0; i < n; i++) {
      var s = document.createElement("span"); s.className = "note-float"; s.textContent = i % 2 ? "♪" : "♫";
      s.style.left = (r.left - vr.left + r.width * (0.2 + Math.random() * 0.6)) + "px"; s.style.top = (r.top - vr.top + r.height * 0.2) + "px";
      s.style.setProperty("--dx", (Math.random() * 60 - 30) + "px"); s.style.animationDelay = (i * 0.18) + "s";
      home.appendChild(s); setTimeout(function (el) { el.remove(); }.bind(null, s), 2400 + i * 180);
    }
  }
  ["#catHead", "#catTail", "#herHead"].forEach(function (id) {
    var el = $(id); el.addEventListener("animationend", function (e) { if (e.animationName === "boing" || e.animationName === "bignod") el.classList.remove("boing", "nod"); });
  });
  /* sparkles */
  var cv = $("#magic"), g2 = cv.getContext("2d"), parts = [], mraf = 0, DPR = Math.min(2, window.devicePixelRatio || 1), mlast = 0;
  function fit() { cv.width = home.clientWidth * DPR; cv.height = home.clientHeight * DPR; }
  function spawn(x, y, n, spread, up) {
    for (var i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.3,
      vx: (Math.random() - 0.5) * 30, vy: -(up || 60) - Math.random() * 80, life: 0, max: 1.4 + Math.random() * 1.4,
      r: 1.2 + Math.random() * 2.6, tw: Math.random() * 6.28, hue: Math.random() < 0.7 ? "255,246,200" : "200,236,255" });
    if (!mraf) { mlast = performance.now(); mraf = requestAnimationFrame(mloop); }
  }
  function sparkle(anchor, n) { var vr = home.getBoundingClientRect(), r = anchor.getBoundingClientRect(); spawn(r.left - vr.left + r.width / 2, r.top - vr.top + r.height / 2, n, r.width, 40); }
  function mloop(now) {
    var dt = Math.min(0.05, (now - mlast) / 1000); mlast = now;
    g2.setTransform(DPR, 0, 0, DPR, 0, 0); g2.clearRect(0, 0, cv.width, cv.height);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life += dt; if (p.life > p.max) { parts.splice(i, 1); continue; }
      p.vy += 12 * dt; p.vx += Math.sin(now / 600 + p.tw) * 8 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      var al = Math.sin(Math.PI * p.life / p.max) * (0.55 + 0.45 * Math.sin(now / 90 + p.tw));
      g2.beginPath(); g2.fillStyle = "rgba(" + p.hue + "," + al.toFixed(3) + ")"; g2.shadowColor = "rgba(" + p.hue + ",.9)"; g2.shadowBlur = 10;
      g2.arc(p.x, p.y, p.r, 0, 6.283); g2.fill();
    }
    mraf = parts.length ? requestAnimationFrame(mloop) : 0;
    if (!mraf) g2.clearRect(0, 0, cv.width, cv.height);
  }
  /* Nov 7 (Doha): no click effects on the home doors; a click just goes to its page */
  $$(".spot").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      var to = b.getAttribute("data-go");
      if (to) R.route(to);
    });
  });
  /* ============================================== the chatty cursor tooltip
     Over a door in the painting a frosted pill blooms next to the cursor and
     the line types itself in, letter by letter (the dog tooltip, reference). */
  var ptip = $("#ptip"), ptipT = $("#ptipT"), fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  var TIPS = { laptop: "psst, my work lives in here", notebook: "a little about me, inside", headphones: "let's talk? put these on", cat: "mrrp. tap me to say hi" };
  var tip = { x: -300, y: -300, tx: -300, ty: -300, on: false, raf: 0, text: "", hideT: 0 };
  function typeIn(text) {
    if (text === tip.text && ptip.classList.contains("on")) return;
    tip.text = text; ptipT.innerHTML = "";
    for (var i = 0; i < text.length; i++) {
      var c = document.createElement("span"); c.className = "ch"; c.textContent = text[i];
      c.style.animationDelay = (160 + i * 26) + "ms"; ptipT.appendChild(c);
    }
  }
  function tipLoop() {
    tip.x += (tip.tx - tip.x) * 0.22; tip.y += (tip.ty - tip.y) * 0.22;
    ptip.style.setProperty("--tx", tip.x.toFixed(1) + "px"); ptip.style.setProperty("--ty", tip.y.toFixed(1) + "px");
    /* keep the pill on screen: it swings to the cursor's left near the right edge */
    var pw = ptip.firstElementChild.offsetWidth;
    ptip.classList.toggle("flip", tip.x + pw > innerWidth - 16);
    ptip.classList.toggle("below", tip.y - 64 < 72);
    tip.raf = (Math.abs(tip.tx - tip.x) + Math.abs(tip.ty - tip.y) > 0.3 || tip.on) ? requestAnimationFrame(tipLoop) : 0;
  }
  function showTip(text, x, y, snap) {
    clearTimeout(tip.hideT);
    tip.tx = x; tip.ty = y; if (snap || !ptip.classList.contains("on")) { tip.x = x; tip.y = y; }
    typeIn(text); ptip.classList.add("on"); tip.on = true;
    if (!tip.raf) tip.raf = requestAnimationFrame(tipLoop);
  }
  function hideTip() { tip.on = false; ptip.classList.remove("on"); tip.hideT = setTimeout(function () { tip.text = ""; }, 300); }
  R.tip = { show: showTip, hide: hideTip, say: function (t) { if (ptip.classList.contains("on")) { tip.text = ""; typeIn(t); } } };
  if (fine) {
    $$(".spot").forEach(function (b) {
      var hit = $(".hit", b), k = b.getAttribute("data-spot");
      hit.addEventListener("pointermove", function (e) { if (!site.hasAttribute("data-orbit")) showTip(TIPS[k], e.clientX, e.clientY); });
      hit.addEventListener("pointerleave", hideTip);
    });
  }
  $$(".spot").forEach(function (b) {
    var k = b.getAttribute("data-spot");
    b.addEventListener("focus", function () { if (!b.matches(":focus-visible")) return; var r = b.getBoundingClientRect(); showTip(TIPS[k], r.left + r.width * 0.5, r.top + r.height * 0.3, true); });
    b.addEventListener("blur", hideTip);
  });
  /* while the camera is close on her face: "oi. scroll down" */
  home.addEventListener("pointermove", function (e) {
    if (!fine || true) return;   /* the close-up stays still and quiet: no tooltip there */
    if (!site.hasAttribute("data-intro") || (R.intro && R.intro.t() > 0.05)) { if (tip.text === "oi. scroll down") hideTip(); return; }
    var vr = home.getBoundingClientRect(), fx = vr.left + vr.width * 0.66, fy = vr.top + vr.height * 0.42;
    if (Math.hypot(e.clientX - fx, e.clientY - fy) < vr.width * 0.16) showTip("oi. scroll down", e.clientX, e.clientY);
    else if (tip.text === "oi. scroll down") hideTip();
  });
  addEventListener("wheel", function () { if (tip.text === "oi. scroll down") hideTip(); }, { passive: true });

  /* =================================================== cursor parallax
     Selected works and About lean a little away from the cursor,
     eased so it drifts rather than tracks. */
  if (fine && !reduced) {
    var par = R.par = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
    var parEls = $$(".f-about .art.bg, .f-about .art.fg, .f-works .art.bg, .f-works .art.wfg, .f-works .art.fx");   /* Home's hill stays still: its lean read as the picture sliding after the zoom */
    var parLoop = function () {
      par.x += (par.tx - par.x) * 0.045; par.y += (par.ty - par.y) * 0.045;
      /* only the layers that lean get the new numbers, so the page isn't restyled */
      parEls.forEach(function (el) { el.style.setProperty("--mx", par.x.toFixed(4)); el.style.setProperty("--my", par.y.toFixed(4)); });
      par.raf = Math.abs(par.tx - par.x) + Math.abs(par.ty - par.y) > 0.0008 ? requestAnimationFrame(parLoop) : 0;
    };
    addEventListener("pointermove", function (e) {
      par.tx = (e.clientX / innerWidth - 0.5) * 2; par.ty = (e.clientY / innerHeight - 0.5) * 2;
      if (!par.raf) par.raf = requestAnimationFrame(parLoop);
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { par.tx = 0; par.ty = 0; if (!par.raf) par.raf = requestAnimationFrame(parLoop); });
  }

  /* "Hello, I'm Rofaida": the pill folds down to its green online dot, waits a
     second, and opens again. The dot keeps pulsing the whole time. */
  var pill = $("#pill"), pillT = $(".pill-t", pill);
  function pillCycle() {
    if (reduced) return;
    var idle = site.getAttribute("data-mode") !== "world" || face !== 0 || site.hasAttribute("data-intro") || document.hidden;
    if (idle) { setTimeout(pillCycle, 2000); return; }
    var r = pill.getBoundingClientRect(), w = r.width, h = r.height, dot = $("i", pill).getBoundingClientRect().width;
    var pl = parseFloat(getComputedStyle(pill).paddingLeft), plC = (h - dot) / 2;
    pill.style.height = h + "px";
    var close = [{ width: w + "px", paddingLeft: pl + "px" }, { width: h + "px", paddingLeft: plC + "px" }];
    pillT.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards", easing: "ease-in" });
    var a = pill.animate(close, { duration: 620, delay: 120, fill: "forwards", easing: "cubic-bezier(.7,0,.25,1)" });
    a.onfinish = function () {
      setTimeout(function () {
        var b = pill.animate(close.slice().reverse(), { duration: 700, fill: "forwards", easing: "cubic-bezier(.34,1.3,.64,1)" });
        pillT.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 380, fill: "forwards", easing: "ease-out" });
        b.onfinish = function () {
          pill.getAnimations().forEach(function (x) { x.cancel(); }); pillT.getAnimations().forEach(function (x) { x.cancel(); });
          pill.style.height = ""; setTimeout(pillCycle, 4200);
        };
      }, 1000);                                                 /* the one-second pause */
    };
  }
  setTimeout(pillCycle, 3200);

  /* the objects take turns to glow for a moment, so people see they are doors */
  var spotsCycle = $$(".spot[data-go]"), sci = 0, sciT = 0;
  function hintSpots() {
    if (site.getAttribute("data-mode") !== "world" || face !== 0 || site.hasAttribute("data-orbit") || site.hasAttribute("data-intro") || reduced) return;
    var s = spotsCycle[sci++ % spotsCycle.length]; s.classList.add("hint"); setTimeout(function () { s.classList.remove("hint"); }, 1600);
  }
  setTimeout(function () { hintSpots(); sciT = setInterval(hintSpots, 5200); }, 2200);

  /* ====================================================== FEEL THE VIBES
     "Sound Bath in the Forest 432Hz" (Mettaverse, used with permission):
     a five-minute cut from 2:00 into the piece, with its last 8 seconds
     cross-faded into its first so the loop has no seam. It only downloads
     once someone presses play, and fades in and out instead of cutting.
     Play starts straight from the file (so it counts as the tap); the file
     is also pulled into memory and swapped in, which makes seeking work on
     any host, whether or not it serves byte ranges. */
  var vPlay = $("#vPlay"), vSeek = $("#vSeek"), vCur = $("#vCur"), vibes = $("#vibes"), au = $("#vAudio");
  var LEN = 300, VOL = 0.85, pos = 0, playing = false, vRaf = 0, fade = null;   /* not tick/raf: the world's spring loop owns those names */
  function fmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function showPos() {
    vibes.style.setProperty("--p", (pos / LEN).toFixed(4)); vCur.textContent = fmt(pos);
    vSeek.value = Math.floor(pos); vSeek.setAttribute("aria-valuetext", fmt(pos) + " of " + fmt(LEN));
  }
  function fadeTo(v, ms, done) {
    cancelAnimationFrame(fade); var v0 = au.volume, t0 = performance.now();
    (function step(now) {
      /* the first frame's timestamp can be a hair before t0: clamp, or a negative volume throws and the music stays silent */
      var k = Math.max(0, Math.min(1, (now - t0) / ms)); au.volume = Math.max(0, Math.min(1, v0 + (v - v0) * k));
      if (k < 1) fade = requestAnimationFrame(step); else if (done) done();
    })(t0);
  }
  function setPlaying(on) {
    playing = on;
    vPlay.setAttribute("aria-pressed", String(on)); vPlay.setAttribute("aria-label", on ? "Pause the sound bath" : "Play the sound bath");
    site.toggleAttribute("data-playing", on);
    soundBtn.setAttribute("aria-pressed", String(on)); soundBtn.setAttribute("aria-label", on ? "Pause the soundtrack" : "Play the soundtrack");
    if (kcSound && kcSound.getAttribute("aria-pressed") !== String(on)) kcSound.click();
  }
  /* a play() cut short by the swap is fine; only a refusal stops the player */
  function playSafe() { var p = au.play(); if (p && p.catch) p.catch(function (e) { if (!e || e.name !== "AbortError") setPlaying(false); }); }
  /* The track is also fetched whole and played from memory (looping and seeking work even where the host
     can't serve byte ranges). It is fetched in the background from the first interaction and swapped in only while
     the player is paused: swapping mid-play cut the sound and needed a second play() outside the click,
     which some browsers refuse; that is what made the button seem to do nothing. */
  var blobState = 0, blobUrl = "";          /* 0 not fetched, 1 fetching, 2 ready, 3 swapped in */
  function ensureBlob() {
    if (blobState || !window.fetch || !URL.createObjectURL) return; blobState = 1;
    fetch(au.getAttribute("src")).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (b) {
      blobUrl = URL.createObjectURL(b); blobState = 2; swapIn();
    }).catch(function () { blobState = 0; });
  }
  function swapIn() {
    if (blobState !== 2 || playing) return;
    au.src = blobUrl; blobState = 3;
    au.addEventListener("loadedmetadata", function once() { au.removeEventListener("loadedmetadata", once); if (!playing) au.currentTime = pos; });
  }
  /* start the background fetch on the visitor's first interaction, so passive visits don't download it */
  ["pointerdown", "keydown"].forEach(function (t) { addEventListener(t, function once() { removeEventListener(t, once, true); ensureBlob(); }, true); });
  function vTick() { if (!playing) return; pos = au.currentTime % LEN; showPos(); vRaf = requestAnimationFrame(vTick); }
  function startMusic() {
    if (Math.abs(au.currentTime - pos) > 0.5) au.currentTime = pos;
    au.volume = 0; setPlaying(true); playSafe();
    fadeTo(VOL, 900); cancelAnimationFrame(vRaf); vTick(); ensureBlob();   /* no-op once fetched */
  }
  function stopMusic() {
    if (!playing) return;
    setPlaying(false); cancelAnimationFrame(vRaf);
    fadeTo(0, 450, function () { if (!playing) { au.pause(); swapIn(); } });
  }
  vPlay.addEventListener("click", function () { if (playing) stopMusic(); else startMusic(); });
  vSeek.addEventListener("input", function () {
    pos = +vSeek.value; showPos();
    /* seeking can need the in-memory copy; swapping on the visitor's own seek is safe */
    if (playing && blobState === 2) {
      au.src = blobUrl; blobState = 3;
      au.addEventListener("loadedmetadata", function once() { au.removeEventListener("loadedmetadata", once); au.currentTime = pos; if (playing) playSafe(); });
    } else au.currentTime = pos;
  });
  R.stopMusic = stopMusic;
  R.toggleMusic = function () { if (playing) stopMusic(); else startMusic(); };

  /* ---- the strip above the page (status bar / app bar on phones) takes the colour at the top of what is
     on screen, instead of always the sky blue */
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeMeta) { themeMeta = document.createElement("meta"); themeMeta.name = "theme-color"; document.head.appendChild(themeMeta); }
  var topRaf = 0, lastTop = "";
  function opaqueBg(el) {
    for (; el && el !== document.documentElement; el = el.parentElement) {
      var s = getComputedStyle(el), c = s.backgroundColor, m = c.match(/rgba?\(([^)]+)\)/);
      if (m) { var p = m[1].split(",").map(parseFloat); if (p.length < 4 || p[3] > 0.6) return c; }
      if (s.backgroundImage && s.backgroundImage !== "none") { var g = s.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i); if (g) return g[0]; }
    }
    return "";
  }
  function syncTop() {
    topRaf = 0;
    var gn = document.getElementById("gnav"), list = document.elementsFromPoint ? document.elementsFromPoint(innerWidth / 2, 2) : [], c = "";
    for (var i = 0; i < list.length && !c; i++) { if (gn && gn.contains(list[i])) continue; c = opaqueBg(list[i]); }
    if (!c || c === lastTop) return;
    lastTop = c; document.documentElement.style.background = c; document.body.style.background = c; themeMeta.content = c;
  }
  function queueTop() { if (!topRaf) topRaf = requestAnimationFrame(syncTop); }
  addEventListener("scroll", queueTop, true); addEventListener("resize", queueTop);
  new MutationObserver(function () { setTimeout(queueTop, 60); setTimeout(queueTop, 900); }).observe(site, { attributes: true, attributeFilter: ["data-mode", "data-face", "class"] });
  setInterval(queueTop, 1500);

  /* ================================================================== boot */
  measure();
  addEventListener("resize", function () { measure(); fit(); });
  fit();
  setFace(0, false);
  R.setMode("world");
  var hash = (location.hash || "").slice(1);
  if (hash === "works" || hash === "about") { var i = hash === "works" ? 1 : 2; ang.x = ang.t = -i * 120; paint(); setFace(i, false); }
  window.__R2 = { state: function () { return { ang: ang.x, dep: dep.x, face: face, phase: phase }; } };
})();

(function () {
  "use strict";
  /* =================================================================== intro
     The painting zooms out to the layout as you scroll. The first frame is a
     close-up on her face; each scroll pulls the camera back along a log curve
     (so the speed of the zoom feels constant) until the full hill lands
     exactly on the Figma Home composition, and the copy rises in. */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var R = window.R2, site = $("#site"), home = $("#home");
  var artBg = $("#home .art.bg"), plate = $("#plate"), close = $("#closePlate");
  var wideSoft = $("#wideSoft"), closeSoft = $("#closeSoft");
  var backdrop = $("#introBackdrop"), vig = $("#introVig"), cue = $("#introCue");
  var reveal = Array.prototype.slice.call($("#home .home-ui").children).concat([$("#hint")]);

  /* anchor = her face; unit = cat-to-face distance as a share of each image's
     width. The ratio of the two units is the camera travel (2.54x).
     The transition is the reference prototype's, number for number. */
  var CFG = {
    close: { aspect: 3600 / 2174, ax: 0.715, ay: 0.445, unit: 0.5454 },
    wide:  { aspect: 3300 / 1100, ax: 0.815, ay: 0.460, unit: 0.1949 },
    startPush: 1.5,        /* how far past its own framing the camera starts */
    pinZoom: 1.1,          /* a touch closer, so the pinned close-up still fills the screen */
    handoffLen: 0.24,      /* how long the plates take to trade places       */
    blurMax: 19.2, smear: 0.06, glow: 0.20,  /* defocus +60% on the soft version, and a 20% bloom */
    tilt: 0.55, vig: 0.55,
    content: [0.74, 0.97],
    alive: 0.55            /* the scene wakes once the camera has swung past */
  };
  /* phones and touch screens: the same move, lighter to draw. The defocus steps through a few fixed radii
     (re-blurring a huge layer every frame is what made the zoom stutter on iPhone), and the screen-blended
     glow and the tilt are left out. Desktop is unchanged. */
  var LITE = matchMedia("(max-width:760px), (hover:none)").matches;
  if (LITE) { CFG.blurMax = 12; CFG.glow = 0; CFG.tilt = 0; }
  /* the defocus moves in steps (4 px on phones, 2 px elsewhere): every new radius means re-blurring a very
     large layer, and doing that on every frame is what made the zoom stutter, on computers too */
  var blurStep = function (b) { return Math.round(b / (LITE ? 4 : 2)) * (LITE ? 4 : 2); };
  var ghosts = Array.prototype.slice.call(document.querySelectorAll("#closePlate .ghost")), ghost = ghosts[0], closeInner = $("#closePlate .inner");
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var smooth = function (a, b, t) { var x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };

  var lastMB = "", PAR = { x: 24, y: 14 }, PR = null, W = 0, H = 0, U0 = 0, U1 = 0, S0 = null, S1 = null, C0 = null, A0 = null, cover = null, wideBox = null;
  var HAND = { start: 0.2, end: 0.44, mid: 0.32 }, WIDE_LIMIT = 0.8;
  var t = 0, tt = 0, raf = 0, last = 0, lockUntil = 0, wasAlive = false, fast = false;

  /* smallest rendered width at which a plate still covers the room with its
     anchor pinned to (Sx, Sy): four edges, four constraints */
  function minWidthToCover(p, Sx, Sy) {
    return Math.max(Sx / p.ax, (W - Sx) / (1 - p.ax), (Sy / p.ay) * p.aspect, ((H - Sy) / (1 - p.ay)) * p.aspect);
  }
  function scanLimit(p) {
    for (var i = 0; i <= 200; i++) {
      var k = i / 200, U = U0 * Math.pow(U1 / U0, k);
      var P = path(k); if (U / p.unit < minWidthToCover(p, P.x, P.y)) return k;
    }
    return 1;
  }
  /* the camera's line: her face stays on one spot from the first frame to
     the last, so the move is a straight pull-back centred on her */
  function path() { return { x: S1.x, y: S1.y }; }
  function measure() {
    W = home.clientWidth; H = home.clientHeight;
    /* END: where the hill sits when the camera has landed (no transform) */
    var keep = artBg.style.transform; artBg.style.transform = "none";
    var fr = home.getBoundingClientRect(), pr = plate.getBoundingClientRect(), ar = artBg.getBoundingClientRect();
    artBg.style.transform = keep;
    S1 = { x: pr.left - fr.left + CFG.wide.ax * pr.width, y: pr.top - fr.top + CFG.wide.ay * pr.height };
    U1 = CFG.wide.unit * pr.width;
    A0 = { x: S1.x - (ar.left - fr.left), y: S1.y - (ar.top - fr.top) };   /* anchor inside the art box */
    PR = { l: pr.left - fr.left, t: pr.top - fr.top, w: pr.width, h: pr.height };
    artBg.style.transformOrigin = A0.x.toFixed(1) + "px " + A0.y.toFixed(1) + "px";
    /* START: the close-up, full bleed, pushed in */
    var c = CFG.close, cw = Math.max(W, H * c.aspect), ch = cw / c.aspect;
    cover = { l: (W - cw) / 2, t: (H - ch) / 2, w: cw, h: ch };
    C0 = { x: cover.l + c.ax * cw, y: cover.t + c.ay * ch };   /* her face in the close-up's own framing */
    /* the camera pivots on her: the face is pinned where it lands in the
       layout, so the whole move zooms out of (and back into) the character
       instead of drifting from the middle of the screen */
    S0 = { x: S1.x, y: S1.y };   /* her face never moves: the camera pulls straight back from her */
    U0 = c.unit * cw * CFG.startPush * CFG.pinZoom;
    close.style.cssText = "left:" + cover.l + "px;top:" + cover.t + "px;width:" + cw + "px;height:" + ch + "px;transform-origin:" + (c.ax * 100) + "% " + (c.ay * 100) + "%";
    ghosts.forEach(function (gh) { gh.style.transformOrigin = (c.ax * 100) + "% " + (c.ay * 100) + "%"; });
    /* where the close-up stops covering: the fade must finish before it */
    var limit = clamp01(scanLimit(c)), guard = 0;
    while (limit < 0.12 && U0 < c.unit * cw * 2.4 && guard++ < 48) { U0 *= 1.05; limit = clamp01(scanLimit(c)); }
    /* keep the slower crossfade even when the pinned framing stops covering
       early: the incoming wide plate and its blur fill the edges meanwhile */
    HAND.end = Math.min(0.92, Math.max(0.2, limit - 0.03));   /* soft edges are hidden by the incoming hill */
    HAND.start = Math.max(0, Math.min(HAND.end - 0.02, HAND.end - CFG.handoffLen));
    HAND.mid = (HAND.start + HAND.end) / 2;
    /* where the hill stops covering: from there the sky takes over */
    WIDE_LIMIT = clamp01(scanLimit(CFG.wide));
    render(t);
  }
  /* a bell peaking over the swap, so the defocus is heaviest right there */
  function bellAt(x, m) { var u = x < m ? x / (2 * m) : 0.5 + (x - m) / (2 * (1 - m)); return Math.pow(Math.sin(Math.PI * clamp01(u)), 1.5); }

  function render(x) {
    x = clamp01(x);
    var U = U0 * Math.pow(U1 / U0, x);
    var Pp = path(x), Sx = Pp.x, Sy = Pp.y;
    var bell = bellAt(x, HAND.mid), pixOn = PIX.ok, blur = pixOn ? 0 : blurStep(bell * CFG.blurMax), roll = pixOn ? 0 : bell * CFG.tilt;
    var opC = 1 - smooth(HAND.start, HAND.end, x);
    var opW = smooth(Math.max(0, HAND.start - 0.05), Math.max(0.02, HAND.end - 0.05), x);
    var f = "", soft = Math.min(1, bell * 1.35).toFixed(3);   /* no live CSS blur: the soft copies carry the defocus */
    if (wideSoft) wideSoft.style.opacity = x >= 1 ? 0 : soft; if (closeSoft) closeSoft.style.opacity = soft;
    var covered = PIX.draw(x, Sx, Sy, U);
    if (covered) { artBg.style.visibility = "hidden"; close.style.visibility = "hidden"; }
    else if (x >= 1) { artBg.style.transform = ""; artBg.style.opacity = ""; artBg.style.filter = ""; artBg.style.visibility = ""; }
    else if (opW < 0.004) { artBg.style.opacity = 0; artBg.style.visibility = "hidden"; }
    else {
      artBg.style.visibility = "visible"; artBg.style.opacity = opW.toFixed(3);
      artBg.style.transform = "translate3d(" + (Sx - S1.x).toFixed(2) + "px," + (Sy - S1.y).toFixed(2) + "px,0) rotateX(" + roll.toFixed(3) + "deg) scale(" + (U / U1).toFixed(5) + ")";
      artBg.style.filter = f;
    }
    if (covered) {}
    else if (opC < 0.004) { close.style.visibility = "hidden"; close.style.opacity = 0; }
    else {
      close.style.visibility = "visible"; close.style.opacity = opC.toFixed(3);
      close.style.transform = "translate3d(" + (Sx - C0.x).toFixed(2) + "px," + (Sy - C0.y).toFixed(2) + "px,0) rotateX(" + roll.toFixed(3) + "deg) scale(" + (U / (CFG.close.unit * cover.w)).toFixed(5) + ")";
      closeInner.style.filter = f;
    }
    /* the motion smear: a soft screen-blended copy that swells over the swap */
    /* the glow: a blurred, screen-blended copy of the picture swells with the
       defocus (bloom), plus a soft pale light over the frame; both peak at 20% */
    var g = bell * CFG.glow, night = site.getAttribute("data-theme") === "night";
    if (!LITE || g > 0) ghosts.forEach(function (gh) {
      var mine = gh.classList.contains("nightimg") === night;
      gh.style.opacity = mine ? g.toFixed(3) : "0";
      gh.style.transform = g > 0.004 ? "scale(" + (1 + bell * CFG.smear).toFixed(4) + ")" : "none";
    });
    vig.style.opacity = g.toFixed(3);
    /* as the hill settles into its band, its top melts into the sky */
    var land = smooth(Math.max(0, WIDE_LIMIT - 0.06), 1, x);
    var mB = (land * 16).toFixed(0);   /* whole percents: each change repaints the masked plate */
    if (mB !== lastMB) { plate.style.setProperty("--mA", "0%"); plate.style.setProperty("--mB", mB + "%"); lastMB = mB; }
    backdrop.style.opacity = (1 - land).toFixed(3);
    var alive = x > CFG.alive;
    if (alive !== wasAlive) { home.classList.toggle("alive", alive); wasAlive = alive; }
    var r = smooth(CFG.content[0], CFG.content[1], x);
    reveal.forEach(function (el, k) {
      var lag = k * 0.12, v = clamp01((r - lag) / (1 - lag));
      if (el.id === "hint") { el.style.setProperty("--rv", v.toFixed(3)); return; }
      el.style.opacity = x >= 1 ? "" : v.toFixed(3);
      el.style.transform = x >= 1 ? "" : "translate3d(0," + ((1 - v) * 28).toFixed(2) + "px,0)";
    });
    cue.style.setProperty("--cue", (1 - smooth(0, 0.14, x)).toFixed(3));
    if ((x < 1) !== site.hasAttribute("data-intro")) {
      site.toggleAttribute("data-intro", x < 1);
    }
  }

  /* no pixel dissolve in this version: the move is a clean optical defocus
     with a soft 20% bloom, drawn by the browser at full resolution */
  var PIX = { ok: false, draw: function () { return false; }, warm: function () {} };
  /* decode the pictures up front so the first frame of the move never waits */
  addEventListener("load", function () { setTimeout(function () {
    Array.prototype.forEach.call(document.querySelectorAll("#home .art.bg img, #closePlate img"), function (im) { if (im.decode) im.decode().catch(function () {}); });
  }, 300); });

  /* the zoom is a single move, not a scrub: one flick of the wheel plays it
     all the way through (out, or back in), so it never rests half-way */
  var tw = null, DUR = 1800, onDone = null;   /* a slow, unhurried pull-back */
  var ease = function (k) { return -(Math.cos(Math.PI * k) - 1) / 2; };
  function loop(now) {
    var k = clamp01((now - tw.t0) / tw.d);
    t = tw.from + (tw.to - tw.from) * ease(k);
    render(t);
    if (k < 1) { raf = requestAnimationFrame(loop); return; }
    raf = 0; t = tt; render(t); tw = null;
    if (t >= 1) { lockUntil = performance.now() + 700; if (R.navCurrent) R.navCurrent(); }
    var cb = onDone; onDone = null; if (cb) cb();
  }
  function to(v, dur) {
    v = clamp01(v);
    if (tw && tw.to === v) return;
    tt = v;
    tw = { from: t, to: v, t0: performance.now(), d: (dur || DUR) * Math.max(0.35, Math.abs(v - t)) };
    if (!raf) raf = requestAnimationFrame(loop);
  }

  var done = function () { return t >= 1 && tt >= 1 && !tw; };
  window.__introSeekK = function (k, dest) { var keep = tw; tw = { from: 1 - dest, to: dest, t0: performance.now() - k * DUR, d: DUR }; t = tw.from + (dest - tw.from) * ease(k); render(t); tw = keep; };
  window.__introSeek = function (x) { t = tt = x; render(x); };
  window.__intro = function () { return { HAND: HAND, U0: U0, U1: U1, S0: S0, S1: S1, cover: cover, W: W, H: H }; };
  R.intro = {
    done: done,
    t: function () { return t; },
    /* true when this wheel step belongs to the zoom, false when the world should take it */
    wheel: function (dy) {
      if (Math.abs(dy) < 2) return true;
      if (dy > 0) {
        if (tt >= 1 && !tw) return performance.now() < lockUntil;   /* landed: hold a beat, then the world takes it */
        to(1); return true;
      }
      if (tt <= 0 && !tw) return true;
      if (tt >= 1 && !tw && performance.now() < lockUntil) return true;
      to(0); return true;
    },
    step: function (d) { to(d > 0 ? 1 : 0); },
    finish: function (cb) {
      if (done()) { if (cb) cb(); return; }
      onDone = cb || null; to(1, 700);
    }
  };

  /* touch: a vertical swipe on the home room scrubs the camera */
  var ty = null;
  home.addEventListener("touchstart", function (e) { ty = e.touches[0].clientY; }, { passive: true });
  home.addEventListener("touchmove", function (e) {
    if (ty === null || site.getAttribute("data-mode") !== "world" || R.face() !== 0) return;
    var y = e.touches[0].clientY, dy = ty - y; ty = y;
    if (dy > 0 && done()) return;            /* landed: the world takes the swipe */
    if (Math.abs(dy) > 6) R.intro.wheel(dy);
  }, { passive: true });
  home.addEventListener("touchend", function () { ty = null; }, { passive: true });

  /* skip the opening shot: deep links, reduced motion */
  var hash = (location.hash || "").slice(1);
  measure();
  if (R.reduced || hash === "works" || hash === "about") { t = tt = 1; render(1); }
  else render(0);
  addEventListener("resize", function () { measure(); });
  addEventListener("load", function () { measure(); });
})();

(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var R = window.R2, reduced = R.reduced, site = $("#site");
  var page = $("#worksPage"), zoomer = $("#zoomer"), artFx = $("#works .art.fx");
  var lit = $("#screen .s-lit"), bloom = $("#screen .s-bloom"), screenSvg = $("#screen");
  var title = $("#works .works-title"), cue = $("#worksCue");
  var QUAD = [[1533.68, 461.94], [1032.18, 468.86], [990.63, 763.63], [1508.95, 786.38]];
  var busy = false, lastFocus = null;
  /* Chrome can leave a child that has run Web Animations stuck on its old
     inherited "hidden" when the page above it is shown again (found when the
     second dive into the laptop came up as a blank cream page). Writing an
     inline style forces a real restyle, so poke the animated parts whenever
     the page opens or closes. */
  function restyle(open) {
    [$("#stack"), $("#worksPage .wp-bar")].forEach(function (el) { if (el) el.style.visibility = open ? "inherit" : ""; });
  }

  function screenBox() {
    var r = artFx.getBoundingClientRect(), sx = r.width / 1921, sy = r.height / 1117;
    /* the rectangle that sits wholly inside the (slightly skewed) screen */
    var x0 = r.left + 1032.18 * sx, x1 = r.left + 1508.95 * sx, y0 = r.top + 468.86 * sy, y1 = r.top + 763.63 * sy;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }
  function zoomTo(b) {
    var W = innerWidth, H = innerHeight, s = Math.max(W / b.w, H / b.h) * 1.04;
    return "translate(" + (W / 2 - b.cx * s).toFixed(1) + "px," + (H / 2 - b.cy * s).toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
  }

  /* the cue steps aside as soon as someone scrolls or swipes on the laptop screen, and comes
     back after a quiet moment if the laptop did not open (scrolls during the turn are ignored) */
  var cueT = 0;
  R.cueAway = function () {
    cue.classList.add("gone"); clearTimeout(cueT);
    cueT = setTimeout(function () { if (site.getAttribute("data-mode") === "world") cue.classList.remove("gone"); }, 2600);
  };
  /* the screen flickers awake when you arrive from the laptop on the hill */
  R.peekScreen = function () {
    if (reduced) return;
    lit.animate([{ opacity: 0 }, { opacity: 0.35 }, { opacity: 0.1 }, { opacity: 0.28 }, { opacity: 0 }], { duration: 1100, easing: "ease-out" });
    bloom.animate([{ opacity: 0 }, { opacity: 0.4 }, { opacity: 0 }], { duration: 1100, easing: "ease-out" });
  };

  /* Scroll on the laptop: the screen lights up, the camera dives into it, and
     the cream of the screen becomes the page of projects. */
  R.enterWorks = function (opts) {
    if (busy || site.getAttribute("data-mode") !== "world") return;
    if (R.face() !== 1) { R.go(1, function () { R.enterWorks(opts); }); return; }
    busy = true; lastFocus = document.activeElement;
    var to = opts && opts.to;
    function done() {
      page.style.transition = "none"; page.classList.add("open"); restyle(true); page.scrollTop = 0; void page.offsetWidth; page.style.transition = "";
      R.setMode("works"); site.removeAttribute("data-dive");
      zoomer.style.transform = ""; title.style.opacity = ""; cue.style.opacity = ""; clearTimeout(cueT); cue.classList.remove("gone");
      lit.style.opacity = bloom.style.opacity = "";
      requestAnimationFrame(function () { if (site.getAttribute("data-mode") === "works") $("#world").style.visibility = "hidden"; });
      layoutFolders(); revealFolder(0);
      window.dispatchEvent(new Event("resize"));
      page.focus({ preventScroll: true });
      if (to) R.worksScroll(to, true);
      if (!reduced) {
        $("#stack").animate([{ transform: "translateY(18vh)" }, { transform: "none" }], { duration: 900, easing: "cubic-bezier(.16,1,.3,1)" });
        $("#stack").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 560, easing: "ease-in-out", fill: "backwards" });
        $("#worksPage .wp-bar").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: 120, easing: "ease-out", fill: "backwards" });
      }
      busy = false;
    }
    if (reduced) { done(); return; }
    var b = screenBox(), end = zoomTo(b);
    site.setAttribute("data-dive", "");
    lit.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.15 }, { opacity: 0.15, offset: 0.3 }, { opacity: 1 }], { duration: 650, easing: "ease-out", fill: "forwards" });
    bloom.animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: 650, easing: "ease-out", fill: "forwards" });
    title.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-24px)" }], { duration: 500, delay: 250, easing: "ease-in", fill: "forwards" });
    cue.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
    if (R.soundOn()) R.chime([523.25, 659.25, 783.99], 0.06, 0.04);
    var z = zoomer.animate([{ transform: "none" }, { transform: end }], { duration: 1150, delay: 520, easing: "cubic-bezier(.7,0,.25,1)", fill: "forwards" });
    z.onfinish = function () {
      done();
      z.cancel(); lit.getAnimations().forEach(function (a) { a.cancel(); }); bloom.getAnimations().forEach(function (a) { a.cancel(); });
      title.getAnimations().forEach(function (a) { a.cancel(); }); cue.getAnimations().forEach(function (a) { a.cancel(); });
    };
  };

  /* and back out of the screen, onto the hill: the dive played in reverse.
     The projects sink back down into the cream screen, the camera pulls out of
     the laptop, the screen flickers off and the title floats back in. */
  /* phones: each folder sticks once its bottom reaches the screen's bottom, so the next one slides over it */
  function stickFolders() {
    var phone = matchMedia("(max-width:760px)").matches, vh = innerHeight;
    $$("#stack .folder:not(.see)").forEach(function (f) { f.style.setProperty("--stick", phone ? Math.min(0, vh - f.offsetHeight) + "px" : "0px"); });
  }
  addEventListener("resize", stickFolders); addEventListener("load", stickFolders); setTimeout(stickFolders, 1200);
  if (window.ResizeObserver) new ResizeObserver(stickFolders).observe($("#stack"));
  R.exitWorks = function (then) {
    if (busy) return;
    var m = site.getAttribute("data-mode"); if (m !== "works" && m !== "all") { if (then) then(); return; }
    if (m === "all") R.closeAll(true);
    busy = true;
    var world = $("#world"), stack = $("#stack"), bar = $("#worksPage .wp-bar");
    function hidePage() {
      page.style.transition = "none"; page.classList.remove("open"); restyle(false); void page.offsetWidth;
      requestAnimationFrame(function () { page.style.transition = ""; });
    }
    function fin() {
      R.setMode("world"); site.removeAttribute("data-dive"); busy = false;
      if (then) then();
      else if (R.keyboardUser) { var h = $("#screenHit"); if (h) h.focus({ preventScroll: true }); }
      else if (document.activeElement && page.contains(document.activeElement)) document.activeElement.blur();
    }
    if (vc) vc.style.setProperty("--cs", 0);
    world.style.visibility = "";
    if (reduced) { hidePage(); fin(); return; }
    site.setAttribute("data-dive", "");
    /* the hill was hidden while the page was up; Chrome can keep that stale
       "hidden" on layers that are animating, so say "visible" outright */
    var shown = [zoomer, title, cue, lit, bloom];
    shown.forEach(function (el) { el.style.visibility = "visible"; });
    requestAnimationFrame(play);
    function play() {
    /* set the hill up exactly where the dive ended: inside the lit screen */
    var start = zoomTo(screenBox()), T = 1670, OUT = 700;
    var z = zoomer.animate([{ transform: start }, { transform: "none" }], { duration: 1150, delay: OUT, easing: "cubic-bezier(.75,0,.3,1)", fill: "both" });
    var l = lit.animate([{ opacity: 1 }, { opacity: 0.15, offset: 0.7 }, { opacity: 0.5, offset: 0.85 }, { opacity: 0 }], { duration: 650, delay: OUT + 1020, easing: "ease-in", fill: "both" });
    bloom.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 650, delay: OUT + 1020, easing: "ease-in", fill: "both" });
    title.animate([{ opacity: 0, transform: "translateY(-24px)" }, { opacity: 1, transform: "none" }], { duration: 500, delay: OUT + 920, easing: "ease-out", fill: "both" });
    cue.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: OUT + T - 300, fill: "both" });
    /* the folders sink back the way they rose, then the page lets go */
    var sk = stack.animate([{ transform: "none" }, { transform: "translateY(18vh)" }], { duration: OUT, easing: "cubic-bezier(.7,0,.84,0)", fill: "forwards" });
    stack.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 560, delay: OUT - 560, easing: "ease-in-out", fill: "both" });
    if (bar) bar.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT * 0.6, easing: "ease-in", fill: "forwards" });
    sk.onfinish = function () {
      hidePage();
      stack.getAnimations().forEach(function (a) { a.cancel(); }); if (bar) bar.getAnimations().forEach(function (a) { a.cancel(); });
    };
    l.onfinish = function () {
      [zoomer, lit, bloom, title, cue].forEach(function (el) { el.getAnimations().forEach(function (a) { a.cancel(); }); });
      lit.style.opacity = bloom.style.opacity = ""; title.style.opacity = ""; cue.style.opacity = "";
      shown.forEach(function (el) { el.style.visibility = ""; });
      fin();
    };
    void z;
    }
  };
  $("#worksBack").addEventListener("click", function () { R.exitWorks(); });
  $("#screenHit").addEventListener("click", function () { R.enterWorks(); });

  /* at the top of the page, keep scrolling up to climb back out */
  var upAcc = 0, upT = 0, ty0 = null;
  page.addEventListener("wheel", function (e) {
    if (site.getAttribute("data-mode") !== "works") return;
    if (page.scrollTop <= 0 && e.deltaY < 0) {
      upAcc += -e.deltaY; clearTimeout(upT); upT = setTimeout(function () { upAcc = 0; }, 260);
      if (upAcc > 220) { upAcc = 0; R.exitWorks(); }
    } else upAcc = 0;
  }, { passive: true });
  page.addEventListener("touchstart", function (e) { ty0 = page.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  page.addEventListener("touchmove", function (e) { if (ty0 !== null && e.touches[0].clientY - ty0 > 140) { ty0 = null; R.exitWorks(); } }, { passive: true });

  /* ------------------------------------------------------------ the folders
     Each project is a folder in a stack. They stick at the top as you scroll,
     the next one sliding over the last, and every tab stays in reach. */
  var folders = $$(".folder.f1,.folder.f2,.folder.f3"), VH = innerHeight, mobile = false;
  function layoutFolders() { VH = innerHeight; mobile = innerWidth <= 760; onScroll(); }
  function onScroll() {
    if (mobile) return;
    var st = page.scrollTop;
    folders.forEach(function (f, i) {
      var c = Math.max(0, Math.min(1, (st - i * VH) / VH));
      if (i === folders.length - 1) c = 0;
      f.style.setProperty("--cover", c.toFixed(3));
      if (st > (i - 0.55) * VH) revealFolder(i);
    });
  }
  function revealFolder(i) { if (folders[i]) folders[i].classList.add("in"); }
  page.addEventListener("scroll", function () { requestAnimationFrame(onScroll); }, { passive: true });
  addEventListener("resize", layoutFolders);
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add("in"); }); }, { root: page, threshold: 0.2 });
    folders.forEach(function (f) { io.observe(f); });
  }
  if (reduced) folders.forEach(function (f) { f.classList.add("in"); });
  R.worksScroll = function (to, instant) {
    var y = 0;
    if (to === "play") y = $("#play").offsetTop;
    else if (typeof to === "number") y = mobile ? folders[to].offsetTop - 120 : to * VH;
    page.scrollTo({ top: y, behavior: instant || reduced ? "auto" : "smooth" });
  };
  $$(".folder .tab[data-to]").forEach(function (t) {
    t.addEventListener("click", function (e) { e.preventDefault(); R.worksScroll(+t.getAttribute("data-to")); });
  });

  /* a glass "View" cursor over the project photos */
  var vc = $("#viewCur"), fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  if (fine) {
    $$(".folder .pimg").forEach(function (p) {
      p.addEventListener("pointerenter", function () { vc.style.setProperty("--cs", 1); });
      p.addEventListener("pointerleave", function () { vc.style.setProperty("--cs", 0); });
      p.addEventListener("click", function () { var f = p.closest(".folder"), a = f && f.querySelector("[data-case]"); if (a) a.click(); });   /* the photo opens the case study, like its button */
    });
    addEventListener("pointermove", function (e) { vc.style.setProperty("--cx", e.clientX + "px"); vc.style.setProperty("--cy", e.clientY + "px"); }, { passive: true });
  }

  /* --------------------------------------------------------- see all works
     The maroon tab at the back of the stack pulls forward and becomes the page. */
  var all = $("#allWorks"), seeTab = $("#seeAll"), allFrom = null;
  function openAll(from) {
    allFrom = from || seeTab;
    var r = allFrom.getBoundingClientRect();
    all.classList.add("open"); all.scrollTop = 0;
    R.setMode("all");
    if (!reduced) {
      var W = innerWidth, H = innerHeight;
      all.animate([
        { clipPath: "inset(" + r.top + "px " + (W - r.right) + "px " + (H - r.bottom) + "px " + r.left + "px round 24px)" },
        { clipPath: "inset(0px 0px 0px 0px round 0px)" }
      ], { duration: 760, easing: "cubic-bezier(.7,0,.2,1)" });
      $$(".aw-head, .aw-body.v-list .aw-filter, .aw-body.v-grid .awg-filter, .aw-body.v-list #awList > li:not([hidden]), .aw-body.v-grid .awg-item:not([hidden]), .aw-body.v-reel .awg-filter, .aw-body.v-reel .awr-item:not([hidden])", all).forEach(function (el, i) {
        if (i > 9) return;
        el.animate([{ opacity: 0, transform: "translateY(32px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 380 + i * 55, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
      });
    }
    setTimeout(function () { $("#awClose").focus({ preventScroll: true }); }, reduced ? 0 : 400);
  }
  R.closeAll = function (instant) {
    if (!all.classList.contains("open")) return;
    var r = (allFrom && allFrom.getBoundingClientRect()) || seeTab.getBoundingClientRect();
    function fin() { all.classList.remove("open"); if (site.getAttribute("data-mode") === "all") R.setMode("works"); if (!instant && allFrom) allFrom.focus({ preventScroll: true }); }
    if (reduced || instant) { fin(); return; }
    var W = innerWidth, H = innerHeight;
    var a = all.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" },
      { clipPath: "inset(" + r.top + "px " + (W - r.right) + "px " + (H - r.bottom) + "px " + r.left + "px round 24px)" }], { duration: 600, easing: "cubic-bezier(.7,0,.2,1)" });
    a.onfinish = fin;
    R.setMode("works");
  };
  seeTab.addEventListener("click", function () { openAll(seeTab); });
  $$("[data-allworks]").forEach(function (b) { b.addEventListener("click", function () { openAll(b); }); });
  $("#awClose").addEventListener("click", function () { R.closeAll(); });
  /* the list: one row open at a time (hover on a mouse, tap anywhere), and
     the filters renumber whatever is left 001, 002, 003 */
  var fbtns = $$(".aw-filter button"), rows = $$("#awList > li"), awEmpty = $("#awEmpty");
  var hoverOK = matchMedia("(hover:hover) and (pointer:fine)").matches, hoverT = 0;
  function openRow(li) {
    rows.forEach(function (r) {
      var on = r === li; r.classList.toggle("open", on);
      r.querySelector(".aw-toggle").setAttribute("aria-expanded", String(on));
    });
  }
  function firstVisible() { for (var i = 0; i < rows.length; i++) if (!rows[i].hidden) return rows[i]; return null; }
  rows.forEach(function (r) {
    r.querySelector(".aw-toggle").addEventListener("click", function () { openRow(r); });
    if (hoverOK) {
      r.addEventListener("pointerenter", function () { clearTimeout(hoverT); hoverT = setTimeout(function () { if (!r.classList.contains("open")) openRow(r); }, 160); });
      r.addEventListener("pointerleave", function () { clearTimeout(hoverT); });
    }
  });
  fbtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var f = b.getAttribute("data-f"), n = 0;
      fbtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      rows.forEach(function (r) {
        var on = f === "all" || r.getAttribute("data-cat") === f; r.hidden = !on;
        if (on) r.querySelector(".aw-n").textContent = ("00" + (++n)).slice(-3);
      });
      awEmpty.hidden = n > 0;
      openRow(firstVisible());
      if (reduced) return;
      rows.forEach(function (r, i) {
        if (r.hidden) return;
        r.animate([{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: Math.min(i, 8) * 40, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
      });
    });
  });
  openRow(firstVisible());

  /* ---- grid version (Oct 25): the same projects as cards, built from the list rows so
     there is one source of truth; Grid / List switch, remembered per viewer */
  var body = $(".aw-body", all), grid = $("#awGrid"), vbtns = $$(".aw-view button"), gbtns = $$(".awg-filter button");
  var CASE_IDS = { maaliy: 1, sadeem: 1, dhi: 1, halan: 1 };
  function gkind(cat, id) { return CASE_IDS[id] ? "case" : cat === "product" ? "ui" : "graphic"; }   /* Oct 2026: branding, graphics and social media are one "Graphics" filter */
  var KIND_LBL = { "case": "Case study", ui: "App UI", graphic: "Graphics & illustrations" };
  rows.forEach(function (r) {
    var btn = r.querySelector(".aw-btn"), id = btn && btn.getAttribute("data-case"), cover = r.querySelector(".aw-cover b"), name = r.querySelector(".aw-toggle").textContent;
    var k = gkind(r.getAttribute("data-cat"), id), li = document.createElement("li");
    li.className = "awg-item"; li.setAttribute("data-g", k); li.style.setProperty("--ph", r.style.getPropertyValue("--ph"));
    li.innerHTML = '<button class="awg-card" type="button" data-case="' + id + '"><span class="awg-cover pimg"><b>' + (cover ? cover.innerHTML : "") + '</b><small>' + (id === "halan" ? "Internship" : id === "snapchat" ? "Project page" : "On Behance") +
      '</small><i class="awg-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#arrUR"/></svg></i></span><span class="awg-name">' + name + '</span><span class="awg-kind">' + KIND_LBL[k] + "</span></button>";
    grid.appendChild(li);
  });
  var gitems = $$(".awg-item", grid);
  gbtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var g = b.getAttribute("data-g"), n = 0;
      gbtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      gitems.forEach(function (it, i) {
        var on = g === "all" || it.getAttribute("data-g") === g; it.hidden = !on; if (!on) return;
        if (!reduced) it.animate([{ opacity: 0, transform: "translateY(18px) scale(.98)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: Math.min(n, 8) * 45, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
        n++;
      });
      reelG = g; reelApply(false);
      if (R.reelOpenFirst) R.reelOpenFirst();
      awEmpty.hidden = n > 0;
    });
  });
  /* ---- reel version (Oct 25, a trial after oorjakapoor.com/work): numbered projects,
     one line each, and a slow, endless strip of its pictures; hover holds the strip */
  var reel = $("#awReel"), reelBuilt = false, reelG = "all", reelMore = false;
  /* which reel rows show: the filter decides; under "All works" the projects after the
     "More work" section stay folded away until it is opened */
  function reelApply(animate) {
    var sep = $(".awr-sep", reel), n = 0;
    if (sep) sep.hidden = reelG !== "all";
    var end = $(".awr-end", reel); if (end) end.hidden = !(reelG === "graphic" || (reelG === "all" && reelMore));
    reelItems().forEach(function (it) {
      var was = it.hidden;
      it.hidden = !(reelG === "all" || it.getAttribute("data-g") === reelG) || (reelG === "all" && it.classList.contains("later") && !reelMore);
      if (animate && was && !it.hidden && !reduced)
        it.animate([{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: n++ * 55, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
    });
    if (sep) {
      var b = $(".awr-more-btn", sep); b.setAttribute("aria-expanded", String(reelMore));
      $(".awr-kind", sep).textContent = reelMore ? "Show less" : "Show more";
    }
  }
  function reelItems() { return $$(".awr-item", reel); }
  var esc2 = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  /* what each row is, in a few words, so a closed row still says something to a recruiter */
  var REEL_LBL = { maaliy: "Case study \u00b7 Accounting ERP", sadeem: "Case study \u00b7 E-commerce dashboard", dhi: "Case study \u00b7 Interior design app",
    halan: "Internship \u00b7 Fintech", nexa: "App UI \u00b7 E-commerce", vybe: "App UI \u00b7 Events", lumiere: "Web UI \u00b7 Landing page", snapchat: "App UI \u00b7 Redesign",
    "gd-2024": "Graphic design \u00b7 Collection", "social-posts": "Social media \u00b7 Campaign", traubi: "Social media \u00b7 Campaign", dalya: "Social media \u00b7 Campaign" };
  function buildReel() {
    if (reelBuilt) return;
    if (!R.caseReel) { setTimeout(buildReel, 0); return; }      /* cases.js loads after this file */
    reelBuilt = true;
    var g0 = ($(".awg-filter button[aria-pressed='true']") || {}).getAttribute ? $(".awg-filter button[aria-pressed='true']").getAttribute("data-g") : "all", later = false;
    reelG = g0;
    rows.forEach(function (r, i) {
      var btn = r.querySelector(".aw-btn"), id = btn.getAttribute("data-case"), name = r.querySelector(".aw-toggle").textContent;
      var desc = (r.querySelector(".aw-desc") || {}).textContent || "", cover = r.querySelector(".aw-cover b"), k = gkind(r.getAttribute("data-cat"), id);
      var info = (R.caseReel && R.caseReel(id)) || { imgs: [], labels: [], tags: [] }, tiles = [];
      if (!(info.imgs[0] && info.imgs[0][0].indexOf("/") >= 0)) tiles.push('<figure class="awr-tile cover pimg"><b>' + (cover ? cover.innerHTML : esc2(name)) + "</b><small>" + esc2(name) + "</small></figure>");
      info.imgs.slice(0, id === "gd-2024" || id === "dhi" || id === "dalya" || id === "social-posts" || id === "snapchat" ? 12 : 6).forEach(function (im) {
        /* phone screens (Halan) sit in a phone frame; boards and mock-ups (Sadeem) keep their own shape */
        if (im[0].indexOf("/") < 0) tiles.push('<figure class="awr-tile shot"><img src="f/halan/' + im[0] + '.webp" alt="" decoding="async"></figure>');
        else tiles.push('<figure class="awr-tile pic"' + (im[2] ? ' style="aspect-ratio:' + im[2] + "/" + im[3] + '"' : "") + '><img src="' + im[0] + '" alt="" decoding="async"></figure>');
      });
      if (!info.imgs.length) info.labels.slice(0, 5).forEach(function (l, j) { tiles.push('<figure class="awr-tile phx pimg t' + (j % 3) + '"><span>' + esc2(l) + "</span></figure>"); });
      while (tiles.length < 4) tiles.push('<figure class="awr-tile phx pimg t' + (tiles.length % 3) + '"><span>' + esc2(info.tags[tiles.length] || KIND_LBL[k]) + "</span></figure>");
      var set = tiles.join("");
      var li = document.createElement("li");
      li.className = "awr-item"; li.setAttribute("data-g", k); li.style.setProperty("--ph", r.style.getPropertyValue("--ph"));
      if (id === "nexa") later = true;
      if (later) li.classList.add("later");
      li.innerHTML = '<div class="awr-row"><span class="awr-n">' + ("00" + (i + 1)).slice(-3) + '</span><h3 class="awr-name"><button class="awr-toggle" type="button" aria-expanded="false" aria-controls="awr-' + id + '">' + esc2(name) + '</button><span class="awr-kind">' + esc2(REEL_LBL[id] || KIND_LBL[k]) + "</span></h3>" +
        '<p class="awr-desc">' + esc2(desc) + '</p>' + ((info.link || k === "graphic") && info.behance
          /* graphics open the project on Behance, in a new tab */
          ? '<a class="awr-btn" href="' + info.behance + '" target="_blank" rel="noopener">View project <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#arrUR"/></svg><span class="sr"> (opens in a new tab)</span></a>'
          : '<button class="awr-btn" type="button" data-case="' + id + '">View project <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#arrUR"/></svg></button>') + '</div>' +
        '<div class="awr-more" id="awr-' + id + '"><div class="awr-more-in"><div class="awr-strip" aria-hidden="true"><div class="awr-track"><div class="awr-set">' + set + '</div><div class="awr-set dup">' + set + "</div></div></div></div></div>";
      if (id === "nexa") {
        var hr = document.createElement("li"); hr.className = "awr-sep";
        hr.innerHTML = '<button class="awr-more-btn" type="button" aria-expanded="false"><span class="awr-more-name">More work</span><span class="awr-more-sub"><span class="awr-kind"></span><i class="awr-plus" aria-hidden="true"></i></span></button>';
        reel.appendChild(hr);
      }
      reel.appendChild(li);
    });
    /* the end of Graphics: a quiet line pointing to the rest of the work on Behance */
    var endLi = document.createElement("li"); endLi.className = "awr-end";
    endLi.innerHTML = '<p>The rest of my graphic work lives on <a href="https://www.behance.net/rofaidaabdelwap" target="_blank" rel="noopener">my Behance profile <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#arrUR"/></svg><span class="sr"> (opens in a new tab)</span></a></p>';
    reel.appendChild(endLi);
    /* only the names show; hovering a name (or tapping / focusing it) opens that project's
       line, button and strip, and it stays open while the pointer is anywhere on the row */
    reelApply(false);
    $(".awr-more-btn", reel).addEventListener("click", function () {
      reelMore = !reelMore; reelApply(true);
      if (!reelMore && R.reelOpenFirst) R.reelOpenFirst();
    });
    var rItems = reelItems(), rT = 0;
    /* the strip runs as an endless loop (two copies of the set, moved by half the track);
       its speed is fixed in px per second, so a longer set takes longer to go round */
    function reelSpeed(li) {
      var set = li.querySelector(".awr-set"), w = set ? set.offsetWidth : 0;
      if (w) li.querySelector(".awr-track").style.setProperty("--awr-dur", (w / Math.max(70 * innerWidth / 1920, 34)).toFixed(1) + "s");
    }
    function openReel(li) {
      rItems.forEach(function (x) {
        var on = x === li; x.classList.toggle("open", on);
        x.querySelector(".awr-toggle").setAttribute("aria-expanded", String(on));
      });
      if (li) requestAnimationFrame(function () { reelSpeed(li); });
    }
    rItems.forEach(function (li) {
      var t = li.querySelector(".awr-toggle");
      t.addEventListener("click", function () { openReel(li); });
      t.addEventListener("focus", function () { if (t.matches(":focus-visible")) openReel(li); });
      if (hoverOK) {
        li.querySelector(".awr-row").addEventListener("pointerenter", function () { clearTimeout(rT); rT = setTimeout(function () { openReel(li); }, 140); });
        li.querySelector(".awr-row").addEventListener("pointerleave", function () { clearTimeout(rT); });
      }
    });
    function firstShown() { for (var i = 0; i < rItems.length; i++) if (!rItems[i].hidden) return rItems[i]; return null; }
    R.reelOpenFirst = function () { var o = rItems.filter(function (x) { return x.classList.contains("open") && !x.hidden; })[0]; if (!o) openReel(firstShown()); };
    openReel(firstShown());
    $$(".awr-strip", reel).forEach(function (st) {           /* the strip is a picture of the project too: clicking it opens it */
      st.addEventListener("click", function () { var b = st.closest(".awr-item").querySelector(".awr-btn"); if (b) b.click(); });
      /* a finger resting on the strip holds it too, like the cursor does */
      st.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") st.classList.add("hold"); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { st.addEventListener(ev, function () { st.classList.remove("hold"); }); });
    });
  }
  function setView(v, save) {
    if (v === "reel") buildReel();
    body.classList.toggle("v-reel", v === "reel");
    body.classList.toggle("v-grid", v === "grid"); body.classList.toggle("v-list", v === "list");
    vbtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-v") === v)); });
    awEmpty.hidden = v !== "list" ? gitems.some(function (i) { return !i.hidden; }) : rows.some(function (r) { return !r.hidden; });
    if (save) try { localStorage.setItem("aw-view", v); } catch (x) {}
  }
  vbtns.forEach(function (b) { b.addEventListener("click", function () { setView(b.getAttribute("data-v"), true); }); });
  /* the Reel is the one layout now (Oct 25); Grid and List stay in code but have no switch */
  setView("reel", false);
  R.awView = function (v) { if (v) setView(v, false); return body.classList.contains("v-grid") ? "grid" : body.classList.contains("v-reel") ? "reel" : "list"; };

  addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var m = site.getAttribute("data-mode");
    if (m === "all") { R.closeAll(); e.preventDefault(); }
    else if (m === "works") { R.exitWorks(); e.preventDefault(); }
  });
})();

(function () {
  "use strict";
  /* ============================================================ case studies
     "View Project" opens the story here instead of sending people to Behance.
     One template, fed by CASES: tags, a big title, the one-line statement,
     a meta grid, a full-bleed cover, numbered sections with image slots, a
     pull line, and a "Next up" footer that walks through every project.
     Only what Rofaida's CV and Behance titles say is written here; image
     slots are named for the screen that belongs in them. */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var R = window.R2, reduced = R.reduced, site = $("#site"), page = $("#casePage");
  if (!page) return;
  var BE = "https://www.behance.net/gallery/";

  var CASES = [
    /* ------------------------------------------------------------------
       PRODUCT CASE STUDIES (rewritten Oct 25) — each one tells the story the
       same way: at a glance (problem / what I did / impact), context, the
       problem, research, the insight, design decisions (problem -> decision
       -> why), design system, impact (honestly labelled), what I learned.
       Sources: Rofaida's resume, the Dhi case-study doc, the Maaliy sitemap
       from the SRS, and notes from the design sessions. Nothing measured is
       claimed where nothing was measured. */
    /* Maaliy (Oct 26): rebuilt from Rofaida's own Behance boards and copy. Images in f/maaliy/:
       screen boards keep their callouts (also given as text in notes), titles and footers became page text. */
    { id: "maaliy", name: "Maaliy", cat: "Product", color: "#522E93", behance: "252514101/Maaliy-Office-Accounting-ERP-UIUX-Case-Study",
      tags: ["UI/UX case study", "Accounting ERP", "Multi-client", "Arabic-first, RTL", "Modern fintech"],
      statement: "A unified, Arabic-first ERP that runs an entire accounting firm, clients, books, tax and deadlines, from one place.",
      meta: [["Product", "Maaliy Office, an ERP for accounting firms"], ["Platform", "Web app, Arabic RTL-first"], ["My role", "Product and UI design lead"], ["Scope", "Research synthesis, IA, design system, UI"], ["Research", "With Sanabel and Asmaa"], ["Date", "June 2026"]],
      tldr: [["The problem", "Accounting firms are buried in tools, not in work. Books live across Excel, email and paper, heavy ERPs bury daily tasks, and missed tax dates turn into penalties."],
             ["What I did", "One workspace for the whole firm: a flat sidebar, a client-first structure where every module scopes to one client, deadlines as a first-class calendar, and an audit trail on every screen."],
             ["The impact", "Every screen traces back to something the firm owner said in the interview, and the costliest mistake, a missed tax date, is now impossible to miss."]],
      cover: "Accounting ERP, Arabic-first",
      noCover: true,
      stats: [["31", "interview questions across 10 areas"], ["11", "SRS modules in one flat sidebar"], ["7", "roles, each with its own permissions"], ["14+", "screens designed"]],
      sections: [
        { k: "value", h: "Why it matters", p: ["Maaliy is a unified, Arabic-first ERP that runs an entire accounting firm, clients, books, tax and deadlines, from one place. RTL-first, modern fintech, built for firms that manage many clients at once.", "The brief arrived as a full Software Requirements Specification: eleven modules and seven roles. My part was the product and UI design: turning the research into structure, the structure into screens, and the screens into one design system."] },
        { k: "problem", h: "Accounting firms are buried in tools, not in work",
          lead: "One firm, many clients, and every client's books spread across paper, email and Excel, with no single place that knows what is due.",
          list: [["Scattered stack", "Books live across Excel, email and paper. No single source of truth."], ["Heavy ERPs", "Enterprise systems bury daily tasks under endless nested screens."], ["Missed deadlines", "No alerts for tax filings, so late fees and penalties follow."], ["Clients in the dark", "No way for a client to see their own status without chasing the accountant."], ["Manual and error-prone", "Hard to trace who changed what, and when."]] },
        { k: "goals", h: "Goals", p: ["The research turned the problem into four aims, each one something a screen has to prove."],
          goals: ["Bring every client's deadlines to the accountant before they are due, so penalties stop.", "Let an accountant work one client end to end, books, invoices, tax and documents, without leaving that client.", "Make every change traceable: who changed what, and when.", "Let clients see their own status without chasing the firm."] },
        { k: "scenarios", h: "Who works in it, and when", p: ["Seven roles share the system. These scenarios decided where each feature has to show up."],
          scenarios: [["Firm owner · Super Admin", "As the owner, I want to see what needs me today in five seconds, ranked by risk."], ["Accountant", "As an accountant, I want one client's entries, invoices and taxes in one place, not in five modules."], ["Auditor", "As an auditor, I want to review and validate entries, not just read them."], ["HR", "As HR, I want the office's people, payroll and tasks kept apart from client books."], ["Client", "As a client, I want to see my invoices, documents and tax status without calling my accountant."]] },
        { k: "research", h: "Stakeholder interview: hearing it from the source", p: ["Before designing, we sat with the decision-maker, a firm owner who would be the system's Super Admin. A structured interview, 31 questions across 10 areas (current tools, pain points, roles, workflows and vision), turned assumptions into direction.", "The owner didn't just list problems; he named the features that would solve them. Much of the system traces straight back to his words."],
          pairLbl: ["What he said", "What it became"],
          pairs: [["“We rely on paper, email, and Excel.”", "The case for one unified workspace"],
                  ["“Hard to track tax due dates, we get penalties.”", "Deadline alerts and a dedicated calendar"],
                  ["“Clients are in the dark about their status.”", "The self-serve Client Portal"],
                  ["“We check the activity log to see who changed what.”", "A full audit trail"],
                  ["“We need to track productivity and distribute tasks.”", "The Tasks module in Office Affairs"],
                  ["“The auditor reviews and validates, not just views.”", "An interactive, not read-only, auditor role"]] },
        { k: "research", h: "Competitive analysis", p: ["Powerful or simple, never both, and never local."],
          table: { head: ["Tool", "Strength", "Gap"], rows: [["SAP · Oracle · Dynamics", "Enterprise-grade power", "Complex, costly, steep setup"], ["Odoo", "Flexible, modular", "Customization gets complex and expensive"], ["QuickBooks · Xero", "Simple, clean", "Long setup, not built for multi-client firms, weak local tax"], ["Daftara · Zoho", "Regional reach", "Limited firm-level, multi-client depth"]] },
          insight: "The gap: no Arabic-first ERP built around the firm, managing many clients at once, wired to local tax, with built-in client transparency." },
        { k: "insight", h: "Research insights to design principles", p: ["Every design decision traces back to a finding."],
          pairLbl: ["We found", "So we designed"],
          pairs: [["Users get lost in nested ERP screens.", "Flat, predictable navigation: one level, no mazes."], ["Missed tax dates cause real penalties.", "Deadlines are first-class: smart alerts and a dedicated calendar."], ["Work is fragmented across tools.", "One workspace: clients, books, tax and documents in a single source."]] },
        { k: "options", h: "Options weighed", p: ["Two structural questions decided the whole product: where client work lives, and how much room deadlines get."],
          options: [["Option A · An Operations group in the sidebar", "Entries, invoices, taxes and receivables as top-level modules, the way the SRS listed them.", "rejected", "It follows the system's operations, not how accountants think, and rebuilds the nested ERP maze the interview complained about."], ["Option B · Everything only inside each client", "Every module reachable only from a client page.", "rejected", "Firm-wide views disappear: the owner can't see all overdue invoices or every tax date at once."], ["Option C · Two scopes, one pattern", "A flat sidebar for firm-wide views, and the same modules scoped inside each client, reached with a two-stage client row and top-bar tabs.", "chosen", "Firm-wide triage and one-client depth with the same tables and badges, so nothing new to learn when the scope flips."], ["Deadlines · A dashboard widget", "A small list of upcoming dates on the dashboard.", "rejected", "Missed tax dates were the #1 pain; a widget is easy to scroll past."], ["Deadlines · A module, a banner and alerts", "A full calendar module, a persistent deadline banner on the screens where tax work happens, and alerts.", "chosen", "The firm's costliest mistake becomes impossible to miss."]] },
        { k: "solution", h: "Information architecture: flat outside, grouped inside", p: ["One flat sidebar for the firm; depth tucked inside each page, never in the nav.", "Staff and clients come in through two doors: the main workspace for the office, and a separate Client Portal where each client sees only their own invoices, reports, documents and tax status."],
          iaflat: { entry: ["Log in", "Home"],
                    main: { h: "Firm workspace", sub: "Main sidebar, for the office staff", items: [
                      ["Dashboard", ["KPI cards", "Revenue and expenses", "Upcoming deadlines", "Invoices to follow up"]],
                      ["Appointments calendar", ["KPI cards", "Today's appointments", "Appointment schedule"]],
                      ["Clients", ["Overview", "Accounting", "Invoices and payments", "Taxes", "Documents", "Reports"]],
                      ["Office affairs", ["Employees", "Payroll", "Tasks", "Departments"]],
                      ["Journal entries"], ["Invoices and payments"], ["Taxes"], ["Receivables"],
                      ["Reports and analytics", ["Overview", "Revenue", "Taxes", "Payroll", "Expenses", "Client activity", "Employee performance"]],
                      ["Documents", ["Latest documents", "All documents"]],
                      ["Administration", ["Users", "Roles and permissions"]],
                      ["Settings", ["Sign-in", "Forgot password", "MFA", "Profile"]]] },
                    portal: { h: "Client Portal", sub: "Its own sidebar, for each client", items: ["My dashboard", "My invoices", "My reports", "My documents", "My tax position", "Chat with my accountant"] },
                    bell: ["Notifications", "The bell in the top bar, on every screen"],
                    note: "The six pages inside Clients are the same six tabs on every client profile: one structure, two scopes." },
          challenges: [{"h": "The SRS listed eleven modules; a sidebar that long is the maze we set out to remove.", "steps": ["Grouped the modules by who uses them and how often, using the interview's daily actions as the order.", "Moved entries, invoices and payments, taxes and receivables under Clients, because accountants work one client at a time.", "Kept firm-wide versions of the same tables reachable from the sidebar, so the owner can still triage across clients.", "Used one top-bar dropdown for the nine accounting screens instead of a nested tree.", "Gave the Client Portal its own door, outside the staff navigation."]}] },
        { k: "solution", h: "Dashboard: the firm at a glance", p: ["The owner's first screen answers one question in five seconds: what needs me today? Every element is ranked by urgency, not by data type."],
          screen: ["dashboard-s", "Dashboard screen in the Maaliy web app, on a tablet", 1800, 2292], take: "The dashboard is a to-do list disguised as an overview: every element signals a risk or shortcuts an action.",
          notes: [["Deadline banner on top", "the #1 pain point (missed tax dates) gets the most visible spot."], ["KPIs ranked by urgency", "actions first (pending, tax), context after (revenue, clients)."], ["One chart, not many", "a firm-pulse summary; depth lives in Reports."], ["Follow-up worklist", "surfaces overdue rows as next actions, not passive stats."], ["Activity feed", "an audit trail for accountability, straight from the interview."]] },
        { k: "solution", h: "Clients: all clients, one place", p: ["A firm managing 2,510 clients needs to scan, not search. This page is built to answer “who needs me?” before “who's here?”"],
          screen: ["clients-s", "Clients screen in the Maaliy web app, on a tablet", 1800, 1442], take: "The list isn't a directory, it's a triage board. Status, balance and ownership are visible before you ever open a client.",
          notes: [["Companies vs. individuals, upfront", "a top toggle splits the two account types."], ["The whole book in one table", "active, on-hold and archived clients in one filterable list."], ["“Needs follow-up” leads", "18 at-risk clients surface first, not just totals."], ["Assigned accountant is a column", "ownership visible, enabling scoped access."], ["Two-stage entry", "click for a summary, click again for the full profile."]] },
        { k: "solution", h: "Client profile: everything about one client", p: ["When an accountant opens a client, the whole relationship should be on one screen: identity, money, deadlines, documents and history, before they act."],
          screen: ["client-profile-s", "Client profile screen in the Maaliy web app, on a tablet", 1800, 1772], take: "One screen holds the entire relationship: the sidebar's global views, refocused on a single client, with nothing to hunt for.",
          notes: [["The scope flips here", "the same sidebar tables, now one client only; same components, scope = client."], ["Tabs, not a longer sidebar", "Overview, Accounting, Invoices, Tax, Documents and Reports inside the page."], ["Client-scoped KPIs", "firm-wide metrics re-computed for this client; risk still reads red."], ["Identity header answers “who”", "name, tax ID, register, accountant and status, up top."], ["Activity log = the client's story", "the audit trail scoped to one client."]] },
        { k: "solution", h: "Calendar: every deadline, visible", p: ["If missed tax dates are the biggest risk, a calendar can't be an afterthought, it's a core module. This is where deadlines stop slipping."],
          screen: ["calendar-s", "Calendar screen in the Maaliy web app, on a tablet", 1800, 1376], take: "Deadlines get their own workspace, color-ranked by risk, so nothing expensive slips through.",
          notes: [["A module, not a widget", "deadlines get a full workspace; late filings mean penalties."], ["Month, week, day and KPIs", "a status check, not just a date picker."], ["Color-ranked by risk", "tax red, invoices amber, meetings neutral."], ["Agenda beside the grid", "see and act on the same screen."], ["Everything dated in one place", "tax, invoices, payroll and meetings share one view."]] },
        { k: "solution", h: "Chart of accounts: the financial backbone", p: ["Every number in the system traces back here. The chart of accounts is the client's financial skeleton, so it's built to be navigated, not just listed."],
          screen: ["accounts-s", "Chart of accounts screen in the Maaliy web app, on a tablet", 1800, 1293], take: "The most technical screen in the system, made legible: a full account tree that an accountant trusts and a newcomer can still read.",
          notes: [["Hierarchy you can drill", "expand and collapse rows mirror the real 5-level account tree."], ["Always client-scoped", "a chart of accounts belongs to one client; it never aggregates firm-wide."], ["The accounting equation, upfront", "assets, liabilities and equity as KPIs; the books balance before you read a row."], ["Debit / credit typed per row", "every account tagged مدين or دائن at a glance."], ["One dropdown, whole module", "reached from the same Accounting menu as journal, ledger and trial balance."]] },
        { k: "solution", h: "Journal and accounting: the core, made calm",
          challenges: [{"h": "Journal entries are the most repeated task, and the riskiest: dense numbers where one mistake costs money.", "steps": ["Kept one table pattern for every module, so a new screen never has to be learned.", "Limited state to four badges (paid, draft, pending, unpaid) that read the same everywhere.", "Pinned a live “Balanced ✓” with running debit and credit totals above the entries.", "Made reference codes tappable, linking each entry to its invoice across the system.", "Kept exactly one filled purple action per screen, so the next step is never in doubt."]}], p: ["Journal entries are the most repeated task in the firm, the interview's #1 daily action. So the accounting core is built to feel routine, not risky."],
          screen: ["journal-s", "Journal and accounting screen in the Maaliy web app, on a tablet", 1800, 1293], take: "The firm's most repeated task, made routine: one table, four badges and a live balance check, so 142 entries read at a glance and an unbalanced book shows before it costs money.",
          notes: [["The deepest module, one tap away", "nine accounting screens via one top-bar dropdown, not a nested tree."], ["The status system carries the load", "the same four badges let you scan 142 entries at a glance."], ["Reference codes as anchors", "every entry links to its invoice, one tappable thread across the system."], ["“Balanced” as live reassurance", "a persistent متوازن ✓ with running debit and credit totals."], ["Same table, firm or client", "all clients from the sidebar, one client inside: the two-scope pattern again."]] },
        { k: "solution", h: "Tax: the problem we set out to solve", p: ["Missed tax deadlines were the #1 pain point in every source, the direct cause of penalties. This screen is where that risk gets defused."],
          take: "This is the screen that justifies the product: the firm's costliest, most avoidable mistake, turned into something visible, typed, and one click from done.",
          screen: ["tax-s", "Tax invoices screen in the Maaliy web app, on a tablet: a VAT deadline banner, running tax totals marked balanced, and a table of invoices with tax type and rate", 1800, 1510],
          notes: [["The deadline lives on the screen", "a persistent banner (“VAT filing ends in 14 days”) above the table; the costliest mistake is impossible to miss."], ["Same table, tax-shaped", "the familiar row pattern with the columns tax work needs."], ["“View filing” one click away", "from tracking to acting (عرض الإقرار) in a single tap."], ["“Balanced” and running tax totals", "assessed vs. due vs. balance up top, with متوازن ✓."], ["Tax types made explicit", "VAT, income, stamp and withholding, each tagged with its rate."]] },
        { k: "solution", h: "Expenses: where the money goes", p: ["Tracking expenses was a named pain point: money leaving the firm, scattered and untracked. This turns outflow into something categorized, searchable and accountable."],
          take: "Outflow gets the same structure as income: categorized, attributed and reconciled, so nothing leaves the firm untracked.",
          screen: ["expenses-s", "Expenses screen in the Maaliy web app, on a tablet: a summary bar of total, paid and outstanding, KPI cards, and a table of expenses with supplier, category, amount and status", 1800, 1510],
          notes: [["Every expense categorized", "rent, utilities, salaries, maintenance, software; the firm sees where money goes."], ["Summary bar ties it together", "total, paid and outstanding above the table."], ["A sub-screen, not a new pattern", "lives in Invoices and Payments; same table, badges, layout."], ["Vendor as a first-class column", "each expense names its supplier, mirroring the client column."], ["Status and payment state", "paid, pending, unpaid and draft, with a running paid-vs-outstanding total."]] },
        { k: "solution", h: "Documents: one secure archive", p: ["Scattered, disorganized documents were a named pain point. This turns a shoebox of files into a searchable, categorized, permissioned archive."],
          take: "The archive closes the loop: every invoice, filing and contract the other screens reference has one secure, findable home.",
          screen: ["documents-s", "Documents screen in the Maaliy web app, on a tablet: the latest documents as cards, filters, and the full archive table with client, category, uploader and last edit", 1800, 1608],
          screen2: ["documents-detail-s", "A document's detail panel: a bank statement with its client, category, type, size, linked record B-2201, sharing and permissions, and download, share and delete actions", 1800, 1520],
          notes: [["One archive across all clients", "tax docs, invoices, contracts and statements in one filterable place; it answers the fragmentation problem."], ["Categorized, not just stored", "every file typed and filed, so finding is a filter, not a hunt."], ["Recent up top, full archive below", "quick access without losing completeness."], ["Detail view = context", "shows client, category, size, and what it's linked to (B-2201)."], ["Sharing with permissions", "owner vs. edit explicit; download, share and delete ranked by weight."]] },
        { k: "solution", h: "Office affairs: the team behind", p: ["The firm doesn't just manage clients, it manages itself. This module handles the office's own people, payroll and workload, cleanly separated from client finances."],
          screen: ["office-s", "Office affairs screen in the Maaliy web app, on a tablet", 1800, 1442], take: "The office manages itself with the same rigor it manages clients: people, payroll and workload, walled off from client books.",
          notes: [["The firm doesn't just manage clients", "employees, payroll and tasks never mixed with client books; access follows responsibility."], ["One module, four tabs", "Employees, Payroll, Tasks and Departments share one workspace."], ["Productivity made visible", "attendance and performance in the row; Tasks became a real feature from the interview."], ["Role-aware", "HR's whole world, the owner's single tab; same screen, scoped to the viewer."], ["Status at a glance", "present, on leave and pending requests turn a staff list into an ops check."]] },
        { k: "solution", h: "Reports and analytics: read the firm", p: ["This is where the firm reads itself, not where it works. A deliberate split: operational screens are for doing, this is for understanding."],
          take: "A read-only lens on the whole firm: restrained charts, six report types, and fast exports that fix the #1 reporting complaint.",
          screen: ["reports-s", "Reports and analytics screen in the Maaliy web app, on a tablet: KPI cards, revenue against expenses by month, expense breakdown, top clients by revenue, invoice status and the latest exported reports", 1800, 1907],
          notes: [["Read, not do", "no editing here; analytics is a lens, not a workspace."], ["Overview first, six types behind it", "summary up front, the SRS report types on demand."], ["Same domains, different lens", "payroll and performance appear here as the analytical mirror of Office Affairs."], ["Restrained charts", "one purple family; color carries meaning, not decoration."], ["Exports first-class", "built in, fixing the interview's “slow report extraction” complaint."]] },
        { k: "before", h: "Before and after", p: ["What the firm's day looked like before, and what Maaliy changes."],
          ba: [["Where client work lives", "Paper, email and Excel, a different place for each task", "One client page with tabs: overview, accounting, invoices, tax, documents, reports"], ["Tax deadlines", "Remembered, and missed: penalties", "A persistent banner, a calendar module and alerts"], ["Navigation", "Nested ERP screens, many levels deep", "One flat sidebar, depth inside each page"], ["Who changed what", "No trail", "An activity log on the dashboard and inside every client"], ["Client status", "Clients call the accountant to ask", "A self-serve Client Portal"], ["The auditor", "A read-only viewer", "An interactive role that reviews and validates"], ["Reports", "Slow to extract", "Six report types with exports built in"]] },
        { h: "Two mīm letters. One open ledger.", p: ["The mark is the two م of “مالي” facing each other: an open book, with a sparkle for precision and growth. Modern fintech: restrained, trustworthy, Arabic-first."] },
        { k: "system", h: "Color palette", p: ["A restrained fintech palette where every hue carries meaning. Deep tones ground the interface, purple and blue carry the brand and every action, and semantic colors signal state at a glance."],
          swatches: [["#522E93", "Purple · primary actions"], ["#623FD1", "Indigo · brand gradient"], ["#4B74F7", "Vivid blue · brand gradient"], ["#285BD5", "Blue · brand gradient"], ["#1A56E8", "Royal blue · active state"], ["#F3EFFA", "White lavender · surfaces"], ["#08050F", "Dark purple · text"]] },
        { k: "system", h: "Primary typography", p: ["Almarai for Arabic, Inter for Latin, JetBrains Mono for numbers and IDs. A clear, legible system built for dense financial data, each in regular, medium and bold."],
          type: [{ aa: "أب", name: "Almarai", role: "Arabic interface", font: "Almarai, sans-serif", lang: "ar", sample: "أبجد هوز حطي كلمن سعفص قرشت ثخذ ضظغ" },
                 { aa: "Aa", name: "Inter", role: "English interface", font: "Inter, sans-serif", sample: "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz" },
                 { aa: "01", name: "JetBrains Mono", role: "Numbers and IDs", font: "'JetBrains Mono', monospace", sample: "123456780 · INV-2024-001 · TINV-2026-084" }] },
        { k: "system", h: "Buttons, badges, spacing and components", p: ["A strict four-level button hierarchy: exactly one filled purple action per screen keeps the primary path unmistakable. Tinted status pills carry payment and record state at a glance, each pairing a soft background with its saturated label.", "An 8-point rhythm, three rounding tiers (8 for controls, 12 for cards, 16 for badges) and one soft elevation give every surface the same quiet, geometric calm. The recurring building blocks, KPI cards, data rows, navigation and wayfinding, come straight from the product."],
          figs: [{ g: "one", items: [["components-s", "Components from the product: KPI cards, sidebar menus, a document card, a data table, breadcrumbs, filter tabs and the icon set", "", 1440, 923, false]]}] },
        { h: "All your work. Finally, in one place.", p: ["Maaliy is the modern solution. Timeless trust."] },
        { k: "measure", h: "How we'd measure success", p: ["Maaliy hasn't shipped, so these are the measures the design is built to move, not results. Each maps to a goal above."],
          measure: [["Missed tax deadlines", "Filings submitted after their due date, per quarter, before and after the calendar and alerts.", "Zero penalties from late filings"], ["Time to a client's next deadline", "Usability test: from the client list, find a client's next tax date.", "Under 10 seconds"], ["Work done without leaving the client", "Share of a client's tasks (entry, invoice, filing) completed from the client page.", "Most tasks in one place"], ["Status calls avoided", "Clients checking status in the portal vs. calling the firm.", "Fewer status calls each month"]] },
        { k: "impact", h: "Impact", p: ["Maaliy is a concept built with a real stakeholder; it has not shipped, so these are design outcomes, not live metrics."],
          impact: [["Outcome", "Every feature traces back to a finding: the interview quotes map one to one onto modules."],
                   ["Outcome", "Tax deadlines get a persistent banner, a calendar and alerts, so the firm's costliest mistake is impossible to miss."],
                   ["Outcome", "One flat sidebar and one table pattern, firm-wide or scoped to a client, across every module."],
                   ["Outcome", "Exports are built in, answering the interview's “slow report extraction” complaint."],
                   ["Next", "Usability-test the client workspace with accountants and time how long it takes to find a client's next deadline."]] },
        { k: "learn", h: "What I learned", p: ["An SRS is a starting point, not a script. The structure only came together once I went back to what the firm owner said he does all day, and let his words decide what each screen shows first.", "Dense financial data can still feel calm: one table pattern, four status badges and one purple action per screen did more for clarity than any new component."] }
      ] },
    /* Sadeem (Oct 26): rebuilt from Rofaida's own Behance boards and copy, plus our earlier sessions
       (roles, tokens, the consistency pass). Images live in f/sadeem/. */
    { id: "sadeem", name: "Sadeem", cat: "Product", color: "#4B47D9", behance: "255668619/SADEEM-E-commerce-Responsive-Admin-Dashboard-RTL",
      tags: ["UI/UX case study", "E-commerce", "Admin dashboard", "Arabic-first, RTL", "Responsive"],
      statement: "An Arabic-first e-commerce admin panel for a single-vendor store, right to left by default. Built on one rule: show state before value.",
      meta: [["Product", "Sadeem, a single-vendor e-commerce admin panel"], ["Platform", "Responsive web: desktop, tablet and phone · Arabic, RTL by default"], ["My role", "UX, UI, brand identity, permissions model, design system"], ["Scope", "6 operational areas · 13 core screens · a full design system"], ["Type", "Tajawal, three weights"], ["Tools", "Figma: variables, components, prototype"]],
      tldr: [["The problem", "Store owners who work in Arabic get mirrored English dashboards: dense, rigid and ambiguous about state. Payment and delivery share one label, and team access is a wall of checkboxes."],
             ["What I did", "An Arabic-first, RTL dashboard on one principle, state before value: stock as a badge, payment and fulfilment as two states, a permission matrix, and cards that swap what they show."],
             ["The impact", "An owner can set all 40 team permissions alone, and 13 screens run on one token system, from desktop to phone."]],
      cover: "Store admin dashboard, RTL",
      coverImg: ["n-cover", "Sadeem's categories page on a desktop monitor rising out of a purple cloud: eight category cards with photos, product counts and active badges", 1392, 965],
      stats: [["6", "operational areas"], ["13", "core screens"], ["8 × 5", "permission matrix: 40 permissions"], ["84", "semantic tokens on 33 primitives"]],
      sections: [
        { k: "value", h: "Overview: why “Sadeem”", p: ["A sadeem (سديم) is a nebula: a vast cloud where stars form, unbound by distance.", "The name carries the product promise, orders that reach anywhere, fast, even from space. That idea shaped the identity: a cosmic gradient, a star-trail mark, and a dashboard built on the premise that distance is not an obstacle.", "Sadeem is an admin dashboard for a single-vendor online store, designed in Arabic first and right to left by default. It covers six operational areas, dashboard, products and categories, orders, customers, roles and permissions, and settings, in 13 core screens and a full design system."] },
        { k: "problem", h: "The task", lead: "Arabic-speaking store owners run their shop in dashboards built for English and flipped for Arabic, where a number never says what needs attention.", p: ["Design an admin dashboard for a single-vendor online store, in Arabic and right to left from the ground up.", "It had to cover products, orders, customers, and a permission model a non-technical store owner can configure alone. The existing options are mirrored English interfaces: dense, rigid, and ambiguous about state."],
          list: [["Tangled statuses", "One order status mixed payment and delivery, so “pending” could mean either."], ["Access needed support", "Team permissions were a long wall of checkboxes, so owners called for help."], ["The page kept growing", "Every new metric became another card, until nothing stood out."], ["Arabic as an afterthought", "Mirrored English layouts break the reading order and the rhythm of Arabic text."]] },
        { k: "goals", h: "Goals", p: ["Four aims, each one something the screens have to prove."],
          goals: ["Show what needs attention before the number: state first, value second.", "Let a store owner set the whole team's access alone, without calling support.", "Read naturally right to left, on the desk and on the phone.", "Keep 13 screens consistent through one token system."] },
        { k: "scenarios", h: "Who works in it, and when", p: ["Before drawing screens, I wrote down who uses the dashboard and where each role has to stop. Those limits became the permission model."],
          scenarios: [["Super Admin", "As the store owner, I want to see everything and be the only one who creates roles."], ["Order Manager", "As an order manager, I want to see which orders are paid but not shipped, and handle returns, without touching pricing."], ["Inventory Manager", "As an inventory manager, I want low stock to stand out before I read a number, without seeing revenue."], ["Customer Support", "As support, I want a customer's profile and activity log, without being able to delete or export."]] },
        { k: "insight", h: "A number is not an answer.", insight: "Show state before value, and let the user decide what's on screen.", p: ["The opportunity: a dashboard that starts from Arabic as a first language, shows state before value, and lets the store owner control team access without calling support."] },
        { k: "options", h: "Options weighed", p: ["Three choices where the obvious answer would have broken the principle."],
          options: [["Order status · One combined status", "A single label per order, as most dashboards do.", "rejected", "“Pending” could mean unpaid or unshipped, so the owner has to open the order to know."], ["Order status · Two states", "Payment and fulfilment as separate badges on every order.", "chosen", "A paid order that hasn't shipped is visible at a glance, and the other way round."], ["Adding a product · A multi-step wizard", "One field group per step.", "rejected", "Slow for an owner adding many products, and the upload rules only show up after a mistake."], ["Adding a product · One two-column page", "Everything on one page, rules stated before upload, and Save as draft for incomplete products.", "chosen", "Faster to fill, nothing hidden, and unfinished work isn't lost."], ["Team access · A list of checkboxes per role", "Every permission as its own checkbox.", "rejected", "Forty checkboxes in a column; owners can't see what a role can do at a glance."], ["Team access · An 8 × 5 matrix", "Eight areas by five actions (view, add, edit, delete, export), with select all.", "chosen", "The whole role reads as one grid, so the owner sets it alone."]] },
        { k: "solution", h: "The principle, applied", p: ["A system built on one principle: show state before value, and let the user decide what's on screen.", "Stock becomes a badge, not a number. Payment and fulfilment become two separate states, not one. Permissions become a matrix of areas × actions, not a wall of checkboxes. Cards swap what they display instead of the page growing to hold everything."],
          pairs: [["Stock was a number owners had to read and judge.", "Stock became a badge: in stock, low, out.", "The state is visible at a glance; the number is there when needed."],
                  ["One status mixed payment and delivery.", "Payment and fulfilment became two separate states on every order.", "A paid order that hasn't shipped is visible, and the other way round."],
                  ["Team access was a wall of checkboxes.", "A permission matrix: 8 areas by 5 actions, 40 permissions in one grid.", "Owners manage their team's access themselves, without support."],
                  ["The dashboard grew to hold everything.", "Cards swap what they display.", "The page stays the right size for the person using it."],
                  ["Mirrored layouts broke Arabic.", "Right to left from the start, in Tajawal, with responsive layouts for desk and phone.", "It reads naturally, not as a flipped copy."]] },
        { k: "solution", h: "One grid, desk to phone", p: ["Desktop runs on a 12-column grid: 74 px columns, 24 px gutters and margins, beside a 240 px sidebar. On phones it folds to 5 stretching columns on the same 24 px rhythm, so spacing never has to be decided again screen by screen."],
          figs: [{ g: "pair", items: [["n-grid", "The 12-column desktop grid: 74 px columns, 24 px gutters and margins, beside a 240 px sidebar", "Desktop: 12 columns beside a 240 px sidebar", 2000, 1604], ["n-grid-m", "The 5-column mobile grid: stretching columns, 24 px gutters and margins", "Phone: 5 columns, same 24 px rhythm", 900, 1593, false]] }] },
        { k: "solution", h: "Dashboard: description becomes decision",
          challenges: [{"h": "A dashboard tends to grow until nothing stands out; each new metric becomes another card.", "steps": ["Gave every figure its change and its baseline, so a number arrives with its meaning.", "Matched each chart to its question: a line for sales over time, stacked bars for order states, a donut for customer mix.", "Let cards swap what they display, so each owner keeps the page the right size for them.", "Kept the latest orders as a table below, the place where reading turns into action."]}], p: ["Every figure carries its change and its baseline, so a number arrives with its meaning. Each chart takes the shape its question needs, and cards swap what they show, so the user picks what's on screen."],
          figs: [{ g: "pair", items: [["n-home", "The Sadeem home dashboard on desktop: four KPI cards with change and baseline, the week's sales as a line, order states as stacked bars, customer growth as a donut, and the latest orders table", "Desktop: every figure with its change and its baseline", 2000, 2307], ["n-home-m", "The home dashboard on a phone: KPI cards in a carousel, the same charts stacked, and the orders table scrolling sideways", "Phone: the cards become a carousel", 900, 3043, false]] }] },
        { k: "solution", h: "Products and categories", p: ["In the products table, stock is a badge, available, low or out, with the count beside it, so the rows that need attention stand out before anyone reads a number. Filters for category, date, stock and price sit above the table.", "Categories are cards with their own active or archived state, a product count and audience tags, so a store owner sees the shape of the catalogue at once."] },
        { k: "solution", h: "Product detail: how it performs", p: ["A read page comes before editing, with price, specs, colours and sizes shown as values rather than fields.", "Sales and recent orders sit below, so the page answers how the product is performing, not just what its data is."],
          figs: [{ g: "narrow", items: [["n-product-view", "A product's read page on tablet: photos, price with its discount, category, stock, colours and sizes as values, local and international delivery, then the product's sales by month and its latest orders", "Read first: values, not fields, then how it sells", 1800, 1850]] }] },
        { k: "solution", h: "Product: view, add, edit", p: ["Three states of one page.", "Viewing is read-only, with sales and recent orders below: how the product performs, not just what it is.", "Adding is one two-column page instead of a wizard, with the rules stated before upload and Save as draft for incomplete products.", "Editing keeps that structure, pre-filled, minus the draft: a live product is edited in full."],
          figs: [{ g: "pair", items: [["n-product-add", "Add product on tablet: one two-column form, image rules stated before upload, Save as draft beside Add product", "Add: one page, Save as draft for incomplete products", 2000, 1612], ["n-product-edit", "Edit product on tablet: the same form pre-filled, with a single Edit action", "Edit: the same structure, pre-filled, minus the draft", 2000, 1612], ["n-product-edit-m", "Editing a product on a phone: the form in one column, photos after the fields, and a full-width Edit button", "Edit on the phone: one column", 900, 4213, false]] }] },
        { k: "solution", h: "Orders and customers", p: ["Tables show what you need at a glance; detail pages show the rest.", "Payment and delivery are two separate statuses, because a paid order isn't a shipped one. Filters sit above the table as buttons you can see. Customers are grouped by state, so “Dormant” is a list you can act on. Each order links to its customer, and each profile shows how much they spend compared with the store average."],
          figs: [{ g: "pair", items: [["n-order", "Order #1247 on tablet: Paid and In preparation as two badges, the order path from paid to received, products, invoice, shipping address, customer notes, payment and shipping details", "An order: payment and delivery as two statuses, and the path it's on", 1800, 2138], ["n-order-m", "The same order on a phone, in one column", "The same order on the phone", 401, 2092, false]] }, { g: "narrow", items: [["n-customer", "A customer profile on tablet: VIP and active badges, member for 18 months, orders, spend and average order value against the store average, her orders with filter buttons, latest activity, saved addresses and an activity chart", "A customer: spend against the store average, every order one tap away", 1800, 2437]] }] },
        { k: "solution", h: "Roles and permissions",
          challenges: [{"h": "Forty permissions have to be set by a store owner, not an engineer.", "steps": ["Grouped them as eight areas by five actions, so every role reads as one grid.", "Added select all for owners who just want full access.", "Gave each role a name, an internal description and a colour, so it is recognisable in lists.", "Showed reach on the roles list as a bar, from full access to 8 of 40."]}], p: ["Team access is a matrix: 8 areas by 5 actions, view, add, edit, delete and export, 40 permissions in one grid. A new role gets a name, an internal description, a colour and a “select all” shortcut. Each role page shows who holds it and what it can do, and the roles list shows how far each one reaches, from full access to 8 of 40."] ,
          figs: [{ g: "two", items: [["n-roles-list", "The roles and permissions list: six roles, their members, permission scope as a bar from full access to 8 of 40, and the last edit", "Roles at a glance: who holds each one and how far it reaches", 2000, 1422], ["n-role-add", "Adding a new role: name, an internal description, a colour, select all, and the permission matrix of areas by actions", "Create a role: name, description, colour, then the matrix", 2000, 1644]] },
                 { g: "two", items: [["n-role-view", "The Super Admin role page: its description, the two people who hold it, and all 40 of 40 permissions", "A role's page: who holds it and exactly what it can do", 2000, 1646], ["n-role-edit", "Editing the Order Manager role: the same form, pre-filled, with 12 of 40 permissions", "Edit: the same form, pre-filled", 2000, 1646]] }] },
        { k: "before", h: "Before and after", p: ["How the same jobs read in a mirrored English dashboard, and in Sadeem."],
          ba: [["Stock", "A number the owner has to read and judge", "A badge: in stock, low, out, with the count beside it"], ["Order state", "One status mixing payment and delivery", "Two badges: payment and fulfilment"], ["Team access", "A wall of checkboxes", "An 8 × 5 matrix with select all"], ["The dashboard", "Fixed cards, one more for every metric", "Cards that swap what they show"], ["Arabic", "A flipped English layout", "Right to left by default, in Tajawal"]] },
        { k: "system", h: "Design system", p: ["Two layers: 33 primitives holding raw values, and 84 semantic tokens on top, grouped by where they're used, badges, charts, buttons, sidebar, icons. No screen points at a raw colour, so changing one primitive updates every component that uses it.", "Tajawal in three weights on a fixed scale with a single 120% line height, and components grouped the way they're actually used: charts and tables, cards, KPIs, badges and sidebar, buttons and fields, icons."],
          figs: [{ g: "pair", items: [["n-ds-tokens", "The Figma variables panel: 33 primitives and 84 tokens, grouped as font, text, badge, charts and table, background, icons, stroke, sidebar and buttons", "Two layers: tokens point at primitives, never at raw values", 552, 496, false], ["n-ds-type", "Tajawal text styles: bold, medium and regular, from 44 down to 10, all at a 120% line height", "Tajawal, three weights, one line height", 164, 496, false]] },
                 { g: "one", items: [["n-ds-components", "Components: last-edit and KPI cards, a category card, colour and size chips, status badges, the sidebar in every state, search and the user chip", "Cards, badges and the sidebar, in every state", 2400, 1053, false]] },
                 { g: "one", items: [["n-ds-buttons", "Buttons in three sizes and every state: filled, tonal, outline and link, with dropdowns, filters, a destructive cancel and search fields", "Buttons and fields: three sizes, every state", 2000, 1353, false]] },
                 { g: "one", items: [["n-ds-tables", "Permission tables by role and by area, with view, add, edit, delete and export columns, beside the chart variants: activity, stacked order states, customer donut and monthly sales", "Permission tables and the chart family", 2400, 836, false]] },
                 { g: "one", items: [["n-ds-icons", "The icon set: one line style for navigation, actions and states", "One icon set, one line weight", 2400, 104, false]] }] },
        { k: "system", h: "Colour system", p: ["One hue family, not a set of colours. Indigo for actions, its pale tint for the background and sidebar, its near-black for text at 14:1 contrast. Orange is the only accent. The rest are reserved: green for success, orange for pending, red for delete, grey for inactive. A colour never means two things."],
          swatches: [["#3636D7", "Indigo · primary actions and active state"], ["#EEEEFF", "Light indigo · page background and sidebar"], ["#EA840E", "Orange · the only accent"], ["#161656", "Dark indigo · text, 14:1 contrast"]] },
        { h: "Sadeem in the world", p: ["The identity lives on two surfaces. The marketing side carries the nebula: purple clouds, glass and the orbiting parcel. The product itself stays light and calm, so the data is what stands out."] },
        { h: "Before publishing: a consistency pass", p: ["Before the case study went out, I checked every screen against the system and listed what didn't match: a placeholder logo left in the sidebar, currency and market indicators that disagreed between screens, repeated sample data, permission counters that contradicted each other, and a few mislabelled controls.", "I also prepared a showreel from the real screen exports, rendered frame by frame, so the product could be seen moving, not only in stills."] },
        { k: "measure", h: "How we'd measure success", p: ["Sadeem is a concept, so these are the measures the design is built to move, not results."],
          measure: [["Time to give a new team member access", "Usability test: create a role for a new employee from scratch.", "Under 2 minutes, without help"], ["Spotting what needs attention", "Five-second test on the products and orders tables: which rows need action?", "Low stock and paid-but-unshipped orders found first"], ["Support calls about permissions", "Calls or tickets asking how to set team access.", "Fewer each month"], ["Reading comfort in Arabic", "Owners compare Sadeem with a mirrored dashboard on the same task.", "Preferred, and faster to finish"]] },
        { k: "impact", h: "Impact", p: ["Sadeem is a concept project, so these are design outcomes rather than live numbers."],
          impact: [["Outcome", "40 team permissions in one matrix that a store owner can set alone."],
                   ["Outcome", "Order state readable at a glance: payment and fulfilment never share a label."],
                   ["Outcome", "84 semantic tokens on 33 primitives keep 13 screens consistent and easy to extend."],
                   ["Outcome", "One grid from desk to phone: 12 columns fold to 5 on the same 24 px rhythm."],
                   ["Next", "Test the permission matrix with store owners and time how long it takes to give a new team member access."]] },
        { k: "learn", h: "What I learned", p: ["The hardest part of an RTL dashboard is not flipping the layout; it's deciding what a person needs to notice first. Naming that rule early, state before value, made every later choice faster.", "Arabic-first is a decision, not a mirror: the sidebar, the reading order, the time axis of every chart and the way numbers sit beside Arabic words all had to be thought through on their own."] }
      ] },
    { id: "dhi", name: "Dhi", cat: "Product", color: "#97BE76", behance: "249166627/INTERIORFURNITURE-Mobile-App-UIUX-Case-Study",
      tags: ["UI/UX case study", "Interior design", "Mobile app", "Saudi market", "Digital transformation"],
      statement: "Dhi is a Saudi interior design and decor company that ran on a showroom, phone calls and social media. I designed the mobile app that turns that scattered journey, from finding a product to a consultation to a finished project, into one.",
      meta: [["Client", "Dhi (ضي), Saudi interior design and decor"], ["Platform", "iOS and Android, Arabic RTL"], ["My role", "UX/UI designer"], ["Tools", "Figma, FigJam"], ["Market", "Saudi Arabia"], ["Scale", "40+ screens"]],
      tldr: [["The problem", "Customers moved between showrooms, Instagram and phone calls with no clear path. Trust was weak, and the company couldn't reach remote regions or people with physical disabilities."],
             ["What I did", "Researched two competitors across 14 features, mapped the market gap, then designed one app for shopping, design consultations and live project tracking."],
             ["The impact", "Dhi is the only one of the three that offers design consultations with a clear way to request them. The consultation page went from 9 sections to 6."]],
      /* All works strip only (Nov 2): her presentation boards, not shown on the case page */
      reel: [["hero", "Dhi cover: the line Every home has its light, in Arabic, on deep green beside a warm living room", 1600, 828], ["splash", "The Dhi app splash screen with the bilingual logo, on a phone resting on green padded leather", 1600, 1068], ["context", "Two boards: Dhi is a Saudi interior design company, and the project is a mobile app that unifies its customer journey", 1600, 1398], ["market-audience", "Boards for the market gap and the target audience, beside two warm interior renders", 1600, 1776], ["moodboard", "The Dhi moodboard: olive velvet, walnut wood, brass and afternoon light, with the logo", 1600, 1044], ["billboard", "A green Dhi billboard on a ribbed wall: Details make the difference, beside a framed tapestry", 1600, 890], ["home", "The Dhi shop home screen, browse by room and a limited-time offer, on a phone in a marble stand", 1600, 1200], ["booking-hand", "The first step of booking a consultation, home type and own or rent, on a phone in someone’s hand", 1600, 1187], ["booking-flow", "Six screens of the consultation booking: home type, condition, rooms, budget and timing, details, and confirmation", 1600, 1280], ["style-mock", "The style result on a phone lying on an olive throw", 1400, 1915], ["phones", "Three phones in real settings: the style quiz, the style result, and the product list", 1600, 732]],
      cover: "Interior design app",
      coverImg: ["hero", "Dhi: the line Every home has its light, in Arabic, on deep green beside a warm living room", 1600, 828],
      stats: [["40+", "screens"], ["5", "tabs in one app"], ["14", "features compared with 2 competitors"], ["30%", "shorter consultation page"]],
      sections: [
        /* ------------------------------------------------ 1 · problem */
        { k: "context", h: "Context",
          p: ["Dhi is a Saudi company specialising in interior design and decor. It relied on its physical showroom, phone calls and social media to talk to customers.",
              "With Vision 2030 and the wider digital shift, the company needed a digital platform: one that widens its reach and builds customer trust smoothly and consistently, without making people feel lost or uneasy.",
              "The project: a mobile app that turns the customer journey, from discovering products to consultations to delivering the project, into one digital experience able to compete with the strongest platforms in the Saudi market."] },
        { k: "problem", h: "The problem",
          lead: "Every channel started from zero: customers moved between the showroom, Instagram and phone calls with no clear path.",
          list: [["A scattered customer journey", "People went back and forth between showrooms, Instagram and calls, with no clear path from idea to finished room."],
                 ["Weak trust", "Little confidence that products were safe, policies that weren't clear, and no easy way to picture a piece at home."],
                 ["The company couldn't compete online", "It couldn't reach remote regions or people with physical disabilities."]] },
        { k: "goals", h: "Goals",
          p: ["Three layers of goals. The filled chips are the ones the design was built around first."],
          tiers: [{ h: "Product objectives", items: [["One unified platform", 1], ["Project tracking", 1], ["Less reliance on phone calls", 0], ["Less time to decide", 0]] },
                  { h: "Business goals", items: [["The first choice for furnishing", 1], ["Reach remote regions", 1], ["Trust in buying online", 0], ["Break access barriers", 0]] },
                  { h: "Success metrics", items: [["User loyalty", 1], ["Conversion rate", 0], ["Brand value", 0]] }] },

        /* ------------------------------------------------ 2 · process */
        { k: "research", h: "Assumptions to test",
          p: ["Before designing, I set out four basic assumptions that needed checking."],
          list: [["Mixed messages", "What customers read on social media conflicts with what they hear on the phone."],
                 ["Out of reach", "Remote customers and people with physical disabilities have no way in."],
                 ["No single channel", "There is no one shared line between the company and its customer."],
                 ["Tools fall short", "The current tools aren't enough to compete digitally."]] },
        { k: "research", h: "Competitor analysis",
          p: ["Two platforms Dhi's customers already use: Elevenz, a Saudi decor and furniture store, and Homzmart, a home marketplace."],
          compete: [{ name: "Elevenz", note: "Website only",
                      strong: ["A dynamic design that feels interactive", "A dedicated offers section at the top of the page", "Clear photos in several colours and sizes", "A best-sellers page", "Product drawings with exact measurements", "Saudi-born, with competitive prices", "Several payment methods"],
                      weak: ["Cards that aren't the same size", "Weak text-to-background contrast in places", "Icons of uneven width", "Inconsistent margins", "A very low Google Trust Score (1%)", "Little presence on social media", "A website only, no mobile app"] },
                    { name: "Homzmart", note: "Website and app",
                      strong: ["Consistent colours and a clean interface", "Sorting by price, with high-quality photos", "A loyalty programme: bronze, silver, gold, diamond", "A technology option on the home page"],
                      weak: ["No back button", "No search by image or product code", "Offers sit mid-page instead of at the top, and lead to a 404 when they end", "No credentials or verification section", "No design consultation", "No customer-service chat"] }],
          table2: { head: ["Feature", "Homzmart", "Elevenz", "Dhi"],
                   rows: [["Mobile app", "✓", "✗", "✓"], ["Customer service by chat", "✓", "✗", "✓"], ["Design consultations", "✗", "✗", "✓"], ["Clear way to request a consultation", "✗", "✗", "✓"], ["Tracking the project's stages", "✗", "✓", "✓"], ["Filter by colour", "✗", "✓", "✓"], ["Filter by price", "✓", "✗", "✓"], ["Search by image or voice", "✓", "✓", "✓"], ["Search by model number or code", "✗", "✗", "✓"], ["Search by material", "✗", "✗", "✓"], ["Installation and maintenance", "✓", "✗", "✓"], ["Single furniture pieces for sale", "✗", "✓", "✓"], ["Before and after photos", "✗", "✓", "✓"], ["Saudi-born", "✗", "✓", "✓"]] } },
        { k: "insight", h: "The gap in the market",
          insight: "Competitors cover one half of the job, design or shopping. None lets the customer follow the work.",
          p: ["The real gap is how fragmented the customer's digital journey is. Competitors focus on one side of the process, either design or shopping, and there is no transparency once work begins: the customer can't follow the progress of their design, so they fall back on slow, traditional ways of keeping in touch."] },
        { k: "research", h: "Who it's for",
          p: ["Who we're designing for:"],
          tiers: [{ h: "", items: [["Furnishing a new home", 0], ["Renovating their current home", 0], ["Setting up a commercial workspace", 0], ["Working full or part time", 0], ["Shopping at brands like IKEA and Homzmart", 0], ["Mobile first", 0], ["Paying by credit card, cash or instalments", 0]] }],
          insight2: "What they share: they want furnishing to be easy, fast and professional, without losing time between showrooms, calls and different platforms.",
          persona: [{ name: "Menna", age: 24, ar: "منة", life: "Single, works part time",
                      story: "Moving into a new home with her family, and the one in charge of following up the furnishing. She needs designs that bring her taste and her family's tastes together.",
                      goals: ["Designs that suit everyone, at fair prices", "Product variety and modern technology"],
                      pains: ["An uncomfortable experience and no patience for it", "Little variety, and high costs without quality"],
                      pays: ["Card", "Cash"], uses: ["IKEA", "Homzmart"] },
                    { name: "Youssef", age: 36, ar: "يوسف", life: "Single, getting married, works full time",
                      story: "Furnishing his new apartment for the wedding. He needs a complete design solution with as little back-and-forth as possible and a flexible schedule.",
                      goals: ["As few calls as possible, on a flexible schedule", "A clear cost, with no surprises"],
                      pains: ["Slow replies and no organisation", "Never knowing where the project or the costs stand"],
                      pays: ["Card", "Instalments"], uses: ["Elevenz", "Homzmart"] },
                    { name: "Khaled", age: 42, ar: "خالد", life: "Works full time, opening his own office",
                      story: "Wants his office furnished fast and to a high professional standard. He has no time to visit showrooms.",
                      goals: ["Finish the project fast, at high quality", "Know the full cost up front"],
                      pains: ["Not knowing the full cost up front", "A lack of professionalism and organisation"],
                      pays: ["Card", "Instalments"], uses: ["Elevenz", "Homzmart"] }] },
        { k: "options", h: "Options weighed", p: ["Each choice came from the personas and the market, not from taste."],
          options: [["Talking to a designer · Calls by default", "Phone calls as the main channel, as the company worked before.", "rejected", "Youssef and Khaled don't want calls; it keeps the old friction."], ["Talking to a designer · Async first", "Chat, voice and video with equal weight, asynchronous by default.", "chosen", "People choose the channel that fits their day."], ["Showing the team · Designer profiles", "A profile page for every designer.", "rejected", "It turns the service into a freelancer marketplace; Dhi sells a team service."], ["Showing the team · Customer stories", "Before and after stories from real projects.", "chosen", "Proof of results builds the trust the research said was missing."], ["Choosing a service · Packages first", "Pick a named package, then describe the space.", "rejected", "No one should have to decode package names."], ["Choosing a service · Rooms first", "Pick the rooms; the app suggests the right package.", "chosen", "People think in rooms, not packages."], ["Budget · A slider", "An exact number on a slider.", "rejected", "Most people have a range, not a figure; a slider makes them anxious."], ["Budget · Four ranges", "Four budget ranges to choose from.", "chosen", "Faster, and calmer, to answer."]] },

        /* ------------------------------------------------ 3 · solution */
        { k: "solution", h: "Information architecture",
          p: ["One entry flow, then five tabs. Consultations change with the person: a new user sees how to book, a returning user goes straight to their projects."],
          ia: { entry: ["Splash", "Onboarding 1", "Onboarding 2", "Onboarding 3", "Log in or sign up", "Verify code", "Profile setup"],
                tabs: [{ h: "Home", items: ["Smart search", "Notifications", "Favourites", "Hero banner offers", "Quick actions: book, shop, quiz", "Your projects", "Styles most relevant to you", "Our products", "Offers", "Shop by category"] },
                       { h: "Consultations", groups: [{ h: "Returning user", items: ["Active projects", "Past projects", "Book a new consultation", "Talk to the designer", { h: "Style quiz", items: ["Rooms", "Colours", "Furniture", "Mood", "Main rooms", "Your style result"] }] },
                                                      { h: "New user", items: [{ h: "Booking", items: ["Home type", "Condition of the space", "Rooms to design", "Suggested package", "Budget and timing", "Extra details"] }, { h: "Project tracking", items: ["Project timeline", "Talk to the designer", "Delivery", "Review and rating"] }] }] },
                       { h: "Shop", groups: [{ h: "Browse and search", items: ["Search by text, voice, image or code", { h: "Browse by", items: ["Rooms", "Type", "Style"] }, "Product list", "Product details", "Ratings", "Similar products", "Add to cart"] }] },
                       { h: "Cart", groups: [{ h: "Full cart", items: ["Free delivery", "Discount code", "Order summary", "Suggested products", "Your style result"] }, { h: "Empty cart", items: ["Shop products", "See favourites"] }, { h: "Checkout", items: ["Address", "Payment, 7 methods", "Review", "Confirmation", "Order tracking"] }] },
                       { h: "Profile", items: ["Your details: name, photo, style", "Active projects", "Finished projects", "Number of rooms", "Projects, orders and favourites", "Account", "General and contact"] }] } },
        { k: "solution", h: "Design decisions", p: ["Each decision comes from the personas and the market, not from taste."],
          challenges: [{"h": "The consultation page had to explain a new service without becoming a wall of text: it had grown to 9 sections.", "steps": ["Listed every section and the question it answered for the customer.", "Found that “How it works” and “What you get” answered the same question from two sides.", "Merged them into one section and cut the repetition.", "Kept every piece of information: 6 sections instead of 9, 30% shorter."]}],
          pairs: [["Youssef and Khaled don't want phone calls.", "Async consultation is the default; chat, voice and video get equal weight.", "People choose the channel that fits their day."],
                  ["Designer profiles turn the service into a marketplace.", "Customer stories instead of individual designer profiles.", "Dhi sells a team service, not freelancers."],
                  ["People think in rooms, not packages.", "Rooms first, then the system suggests the right package.", "No one has to decode package names."],
                  ["Most people have a range, not an exact budget.", "Four budget ranges instead of a slider.", "Faster, and less anxious, to answer."],
                  ["Competitors hide work once it starts.", "A live project timeline with the designer's chat beside it.", "Closes the transparency gap the market research found."],
                  ["Homzmart can't search by image or code.", "Search by text, voice, image or model code, and filter by material.", "People find a piece the way they remember it."]] },
        { k: "solution", h: "Prototype: the whole journey in a minute", p: ["The clickable prototype, from the splash and sign-up through the style quiz, booking a consultation and the shop, to checkout. Played at 1.5× speed."],
          video: { src: "prototype.mp4", poster: "prototype-poster.webp", alt: "Screen recording of the Dhi prototype: splash, onboarding, sign-up, home, the style quiz and its result, booking a consultation, the shop, a product page, the cart and checkout", cap: "The Dhi prototype, end to end, at 1.5× speed", w: 480, h: 1018, g: "phonevid" } },
        { k: "solution", h: "Home: two doors from the first screen", p: ["Dhi sells two things, design projects and furniture, and most people arrive wanting one of them. The home screen asks which before showing anything else."],
          phones: [["s-home", "The Dhi home screen: search with camera and microphone, a hero image, two buttons, Book your project and Shop products, a Book your project now banner, the most popular styles, our products with room filters, National Day offers and shop by room", "Home: book a project, or shop", 640, 2860]],
          notes: [["Two equal doors under the hero", "Book your project and Shop products sit side by side, so the two halves of the business are one tap each from the first screen."], ["The service is sold before the products", "a full-width Book your project now banner comes before the product grid, because a consultation is what competitors don't offer."], ["Styles as a way in", "the most popular styles, modern, classic and boho, lead to the style quiz for people who don't yet know what they want."], ["Seasonal offers get their own band", "the National Day offers sit on a gold band, so they read as an event, not as more products."], ["Shop by room, again", "the page ends with rooms as large chips, the same way the shop is organised."]],
          take: "The first screen sorts people by intent: a project or a product, with the project offered first." },
        { k: "solution", h: "Consultations: sell the service before the form", p: ["A design consultation is new for most of Dhi's customers, so a first-time visitor lands on a page that explains the service, prices it and shows how it works before asking for anything. A returning customer skips all of that and lands on their projects."],
          phones: [["s-consult", "The consultations page for a new user: the headline, Book your consultation, three packages with the most requested one marked, how Dhi works in four steps, the three ways to talk to a designer, past projects and customer reviews", "New user: what it is, what it costs, how it works", 640, 2825], ["s-projects", "Your projects, for a returning user: active and completed counts, each project with its status, progress, next step and date, a Talk to the designer button, and rooms to book next", "Returning user: straight to their projects", 640, 1833]],
          notes: [["The offer and the price come first", "the headline, From 299 SAR and Book your consultation all sit above the fold, so the cost is never a surprise, which is what Youssef and Khaled asked for."], ["Packages as cards, one recommended", "three packages side by side with the most requested one marked and a money-back line under the title, to answer the weak trust the research found."], ["How it works, with the time per step", "four steps, from choosing a package to receiving the design in 48 hours, each with how long it takes, so the commitment is clear before booking."], ["Three ways to talk, side by side", "chat, voice call and video call get equal space; chat with photos comes first because two of the three personas don't want phone calls."], ["Returning users see their work, not the pitch", "each project card shows its stage, progress, next step and date, with Talk to the designer as the main action."]],
          take: "One tab, two states: the pitch for people who haven't booked yet, the work itself for people who have." },
        { k: "solution", h: "Booking: six short questions, no typing", p: ["Booking replaces the phone call where the designer used to ask the same questions. Six steps, one topic each, almost all answered with a tap."],
          phones: [["s-book-rooms", "Booking step 3 of 6, Which rooms do you want designed: nine room tiles with line icons, from the living room and majlis to the kitchen, office and garden", "Step 3: rooms first", 640, 1292], ["s-book-budget", "Booking step 5 of 6: furniture and decor budget as four ranges in riyals, and when you want it done as three choices", "Step 5: a range, not a number", 640, 1292], ["s-book-details", "Booking step 6 of 6: photos of your room, notes for the designer, and how you want to be contacted: chat, voice call or video", "Step 6: choose how to talk", 640, 1292], ["s-book-done", "Booking confirmed: project number, package, rooms and expected design date, a confirmation sent to the phone, and See your project", "Done: a summary, and the way in", 640, 1292]],
          notes: [["One question per screen, with a six-step tracker", "customers always know how much is left, and finished steps turn into checks."], ["Tiles with icons instead of text fields", "home type, the condition of the space and the rooms are all a tap, which suits people who book from their phone, between other things."], ["Rooms come before the package", "customers pick the rooms they think in, and the package is suggested from that, so no one has to decode package names."], ["Budget and timing as ranges", "four budget ranges and three timing options are faster and less stressful to answer than an exact figure, and the subtitle makes clear the budget is on top of the package fee."], ["The contact channel is chosen up front", "chat with attachments is listed first, then voice and video, so the designer knows how to reach each customer before the first message."], ["The confirmation repeats the deal", "project number, package, rooms and the expected design date, with See your project leading straight to tracking."]],
          take: "Six taps replace the first phone call, and the designer starts with everything they would have asked." },
        { k: "solution", h: "Project tracking: the gap, closed", p: ["The market research found that once work starts, customers can't see it, so they call to ask. This is the screen built for that: every stage, its date, and the designer one tap away."],
          phones: [["s-tracking", "A living room project: status Design in progress, Premium and Modern tags, 60% progress, and a timeline of stages: booked, request reviewed, design in progress with Talk to the designer, design review and final delivery", "Every stage, its date, and who to talk to", 640, 1292]],
          notes: [["A timeline, not a status word", "five stages from booking to final delivery; finished ones are checked and dated, the current one is gold, the rest wait in grey."], ["The designer sits inside the current stage", "Talk to the designer appears on the stage that's in progress, where the question comes up."], ["Status and progress in the header", "the stage name, the package and style, and a progress bar are visible before any scrolling."], ["Stages, files and details as tabs", "the timeline is the default; designs and booking details are one tap away, without a longer page."]],
          take: "The question “where is my project?” now has an answer on screen, so it doesn't need a phone call." },
        { k: "solution", h: "Shop: browse by room, search the way you remember", p: ["The shop is built around how people describe furniture: by the room it goes in, or by a photo of something they've seen."],
          phones: [["s-shop", "The shop home: search with camera and microphone, a hero banner, Browse by room with six room chips, a limited-time offer with a countdown, product filters and a product grid with prices and discounts", "Browse by room, offers at the top", 640, 2324], ["s-product", "A product page: photos with a 3D view, name, rating, tags, price with a 20% discount, Tamara and Tabby instalments, Add to cart, delivery times for Riyadh and the rest of the Kingdom, free delivery, in stock, free returns within 14 days, inspect on delivery, colours, description, specification table, rating breakdown and reviews", "Product: payment and delivery before specs", 640, 3401], ["s-search", "Search open: the latest searches above, and a filter sheet for materials, colours, styles and prices, with Apply and Clear all", "Search by text, voice or photo; filter by material", 640, 1292]],
          notes: [["Search by text, voice or photo", "the camera and microphone sit inside the search bar, filling the gap the competitor analysis found: Homzmart can't search by image or code."], ["Browse by room", "six rooms as chips with a small photo each, because customers think in rooms, not in catalogue categories."], ["Offers at the top", "the limited-time offer and its countdown sit near the top, where Elevenz puts them, instead of mid-page like Homzmart."], ["Filter by material", "materials, colours, styles and prices in one sheet; no competitor filtered by material."], ["Instalments and delivery come before the specs", "on the product page, Tamara and Tabby show the monthly amount and delivery times are split by Riyadh and the rest of the Kingdom, right under the price: the questions people ask before they buy furniture."], ["Inspect before you pay", "a line promises the customer can check the piece on delivery and refuse it at no cost, alongside free returns within 14 days, answering the weak trust the research found."], ["Recent searches first", "the last searches stay above the filters, so coming back to a piece takes one tap."]],
          take: "People find a piece the way they remember it: the room it belongs in, or a photo of it." },
        { k: "solution", h: "Cart and checkout: built for how Saudis pay", p: ["Three short steps, address, payment and review, with the total always pinned at the bottom."],
          phones: [["s-cart", "The cart: a bar showing how much more to add for a 10% discount, two products with colour, price, discount and quantity, In stock and Only 3 left, a discount code field, and the total", "Cart: what's left for a discount, and stock", 640, 1385], ["s-pay", "Checkout, payment step: Mada marked most used, cash on delivery, Apple Pay, Visa or Mastercard and STC Pay, with the total pinned at the bottom", "Payment: Mada first, cash on delivery second", 640, 1385], ["s-order-done", "Order confirmed: a thumbs-up illustration, Thank you, your order is on its way, the order summary, a confirmation sent to the phone, and Track your order", "Done: the summary and tracking", 640, 1385]],
          notes: [["A progress bar toward the next discount", "“Add 200 SAR to get 10% off” turns the total into a goal instead of a cost."], ["Stock on every item", "In stock or Only 3 left sits on each product, so a customer isn't surprised after paying."], ["Three steps with checks", "address, payment and review are tabs that turn green with a check when done; it's always clear where you are."], ["Local payment first", "Mada, the most used card, is first, then cash on delivery, Apple Pay, cards and STC Pay, matching the personas who pay by card, cash or instalments."], ["The total never scrolls away", "the number of items and the total sit above the main button on every step."]],
          take: "Checkout speaks the market's language: local cards and wallets first, cash still welcome, and no surprise at the end." },
        { h: "Dhi in the hand", p: ["The app in the settings it was designed for: a living room, a desk, an afternoon on the sofa."],
          figs: [{ g: "two", items: [["booking-hand", "Booking step one, home type, on a phone held in someone's hands on a sofa", "Booking, step one: what kind of home?", 1600, 1187], ["home", "The shop home screen on a phone in a marble stand on a desk", "The shop, browse by room", 1600, 1200]] },
                 { g: "one", items: [["phones", "Three phones in real settings: the style quiz, the style result, and the product list", "The style quiz, its result, and the products it leads to", 1600, 732]] },
                 { g: "two", items: [["style-mock", "The style result, Your style: luxury contemporary, with styles close to yours, on a phone lying on an olive throw", "The style quiz result", 1400, 1915], ["splash", "The Dhi splash screen with the bilingual logo and a collage of interiors, on a phone against green padded leather", "The splash screen", 1600, 1068]] }] },
        { k: "before", h: "Before and after", p: ["The same customer journey, before the app and with it."],
          ba: [["Where the journey happens", "Showroom, Instagram and calls, each starting from zero", "One app: shop, consult and track"], ["Talking to the company", "Phone calls during working hours", "Chat, voice or video, when it suits the customer"], ["Following the project", "Calling to ask", "A live timeline and a project chat"], ["Finding a piece", "Scrolling until you spot it", "Search by text, voice, image or code"], ["Reaching the company", "Visit the showroom", "From anywhere in Saudi Arabia"], ["The consultation page", "9 sections", "6 sections, 30% shorter"]] },
        { k: "system", h: "Design system", p: ["Warm luxury minimalism with strategic glass: 80% solid, 20% glass. Cairo for Arabic and Poppins for English, with Arabic never below 16px. A 4px spacing unit and radii from 8 to 24 to fully round."],
          swatches: [["#1B4D3E", "Deep teal, primary"], ["#C9A961", "Rich gold, accent"], ["#FAF8F3", "Warm cream, background"], ["#2C2C2C", "Charcoal, text"]],
          figs: [{ g: "two", items: [["moodboard", "The Dhi moodboard: olive velvet, walnut wood, brass and afternoon light, with the logo", "The moodboard: olive, walnut, brass and warm light", 1600, 1044], ["billboard", "A green Dhi billboard on a ribbed wall, Details make the difference in Arabic, beside a framed tapestry", "The identity outside the app", 1600, 890]] }] },

        /* ------------------------------------------------ 4 · result */
        { k: "measure", h: "How we'd measure success", p: ["Dhi hasn't launched, so these are the measures the design is built to move, starting with the three success metrics set at the start."],
          measure: [["User loyalty", "Repeat orders and second projects from the same customers.", "The lead metric"], ["Conversion rate", "Share of consultations and product views that turn into a purchase.", "Rising"], ["Brand value", "Bookings and orders from outside the showroom's city, and reviews.", "New regions served"], ["Calls per project", "Phone calls needed from booking to delivery, before and after the app.", "Far fewer"], ["Time to decide", "Usability test with 5–10 people from the three personas: time to book a consultation.", "Booked in one sitting"]] },
        { k: "impact", h: "Impact and next steps", p: ["Dhi was designed for an existing company and has not launched yet, so here is what the design changes."],
          impact: [["Outcome", "Shopping, consultations and live project tracking in one app. In our comparison, Dhi is the only one of the three with design consultations and a clear way to request them."],
                   ["Outcome", "The transparency gap is closed: customers follow every stage of their project instead of calling to ask."],
                   ["Outcome", "The consultation page is 30% shorter (9 sections to 6) with nothing lost."],
                   ["Next", "Prototype tests with 5–10 users, an MVP, a pilot in Riyadh, then AR, a loyalty programme and the wider Gulf."]] }
      ] },
    /* MNT-Halan (Oct 25): skeleton built from the Figma file "Halan Flows" (7O3cyEWnm7AvNEKUINkMFF).
       Everything under "What the screens show" is read off the screens; every todo:
       line is a gap only Rofaida can fill (the real issue, what was there before, why). */
    { id: "halan", name: "MNT-Halan", cat: "Product", color: "#16A06A", behance: "",
      tags: ["Product design internship", "Fintech", "Mobile app", "UAE and Egypt"],
      statement: "Three months inside a fintech super app: a card application cut to three steps, a card delivery request, motion for two key moments, and a Help Center I asked to design for the new investing app.",
      meta: [["Company", "MNT-Halan"], ["My role", "Product designer, internship"], ["Timeline", "Jul – Sep 2026"], ["Products", "Halan UAE app, Halan Borsa"], ["Scope", "Flows, UI, prototyping, motion, handoff"], ["Screens", "40 in this case study"]],
      tldr: [["The problem", "Halan needed its UAE card application inside the app, a way to order the physical card, and self-service support for Borsa, its new investing app. All of it had to fit the PM's requirements and the existing design system."],
             ["What I did", "I designed four flows end to end. I questioned the step count of the card application, removed an address feature nobody needed, prototyped motion and handed it off to the mobile developer, and designed the Borsa Help Center, which I asked to join and presented to PMs, designers and developers."],
             ["The result", "An application in three steps instead of the four or five first planned, an AI-first support model with clear request states, and a working Lottie animation handed to the mobile developer. Company numbers stay with the company, so no metrics here."]],
      cover: "Fintech super app, UAE and Egypt",
      coverImg: ["m-cover", "Three Halan screens on phones over a deep green field: the card application consent step, the Borsa support home and the card on its way", 1600, 1000],
      stats: [["4", "flows designed end to end"], ["3", "steps in the card application, from 4–5"], ["3", "support request states"], ["40", "screens and states"]],
      sections: [
        { k: "context", h: "Context", p: ["MNT-Halan runs a fintech super app across the UAE and Egypt. As a product design intern I worked on live products inside their design system: I turned PM requirements into flows, prototyped the moments that needed motion, prepared files for the mobile developers, and presented my work to PMs, designers and developers."],
          list: [["Borsa Help Center", "Support for the new investing app: answers, an AI assistant, and requests you can follow. I asked to take this on."], ["Halan Card application (UAE)", "The authentication flow to apply for the digital card, moved from a web form into the app."], ["Physical card request", "Ordering the plastic card to a UAE address, and the success moment."], ["Motion", "Code-entry feedback and the card-on-its-way animation, handed off as Lottie."]] },

        /* ---------- 1 · Borsa Help Center (lead) */
        { k: "problem", h: "1 · Borsa Help Center: answers first, a person one tap away",
          figs: [{ g: "one", items: [["m-help", "The Borsa Help Center on three phones: the support home with requests and the assistant, an open answer with deposit methods, and a resolved request", "", 1600, 1000]] }],
          lead: "A new investing app needs support that works at any hour, often for people new to investing. Without a structured way to find answers in the app, every question goes straight to the call center.",
          p: ["While the team was building Halan Borsa, I asked to contribute. I took the PRD for the Help Center and designed the full support experience: how people find answers, ask for help, and follow a request until it's resolved."] },
        { k: "solution", h: "The decisions behind it",
          pairs: [["Common questions about deposits, withdrawals, orders and balances don't need a person to answer them.", "AI first: users talk to a support assistant, and it escalates to the call center when a person is needed.", "People get help at any hour through structured self-service, and the call center isn't pressured by questions the app can answer."],
                  ["A blank chat box makes people phrase every question from scratch.", "Shortcuts inside the chat for the main topics: account, trading and orders, login and security, deposits and withdrawals, portfolio and balances.", "It's easier to start, and the shortcuts show what the assistant can help with."],
                  ["Once a request goes to the team, people don't know where it stands.", "Three request states (In progress, Action required, Resolved), shown both in the chat and on My Support Requests.", "Users can check from either place, and Action required tells them exactly what to do next."],
                  ["An assistant can't solve everything.", "A person stays close: Contact Support under every answer, and Re-open Case on a resolved request.", "AI first, not AI only."]],
          pairLbl: ["The situation", "My decision", "Why"],
          flow: ["Help Center home", "Search, questions or topics", "Answer + “Was this helpful?”", "Still need help?", "Ask Borsa AI or Contact Support", "Request with a clear state", "My Support Requests"], flowLbl: "How someone moves through it",
          find: [["Screen", "Three ways in", "Search, popular questions as chips, and seven topics, from getting started to subscriptions."],
                 ["Screen", "Requests appear when they matter", "“My Support Requests · 5 Active” moves to the top only when someone has open requests."],
                 ["Screen", "Every answer ends with a way forward", "“Was this answer helpful?” then “Still need help?” with Ask Borsa AI first and Contact Support beside it."]],
          shots: [{ t: "strip", items: [["help-home", "Help Center home"], ["help-home-tickets", "With open requests"], ["faq-open", "An answer, with feedback"], ["ai-topics", "Ask Borsa: shortcuts first"]] }] },
        { k: "solution", h: "Requests you can follow",
          p: ["Each request is a conversation with its state at the top. The same state shows in the list, so nobody has to ask where things stand."],
          list: [["In progress", "“Request is being processed. You'll be notified once our operations team updates your ticket.”"], ["Action required", "The thread says exactly what's needed, for example re-uploading a receipt."], ["Resolved", "“Issue resolved”, with Re-open Case if it comes back and “Start a new chat” for something else."]],
          shots: [{ t: "strip", items: [["req-open", "My Support Requests"], ["ticket-pending", "In progress"], ["ticket-action", "Action required"], ["ticket-resolved", "Resolved"]] }] },

        /* ---------- 2 · Getting a Halan Card in the UAE */
        { k: "problem", h: "2 · Applying for a Halan Card, in three steps",
          figs: [{ g: "one", items: [["m-card", "The card application on three phones: consent with the applicant's details, Emirates ID verification with extracted details, and the card on its way", "", 1600, 1000]] }],
          lead: "The UAE card application lived in a web form. Bringing it into the app meant fitting it on a phone screen, while the PM required the applicant's personal details to stay visible throughout.",
          p: ["The starting plan split the form into four or five steps. I questioned whether each one earned its place, and looked at what could be shortened, simplified or grouped on one screen."] },
        { k: "solution", h: "Grouped by job, not by field",
          flow: ["Personal details + consent", "One-time code", "Emirates ID + extracted details"], flowLbl: "The final flow",
          pairs: [["The brief suggested four or five steps.", "Three steps, each one job: details and consent; the code; the Emirates ID front, back and extracted details together.", "Shorter without crowding a screen: one task per step, not one field per step."],
                  ["Personal details had to stay visible while the user enters more, on a small screen.", "I explored several layouts inside the design system. The team chose mine: the verified email and phone as two compact chips.", "It kept the details in view at the smallest height and left room for the code."],
                  ["Terms usually mean leaving the form.", "Consent sits under one checkbox; “See T&C” opens the two statements in place.", "Agreeing never breaks the flow, and Next stays grey until it's done."],
                  ["Typing ID details invites mistakes.", "Name, date of birth and ID number are read from the uploaded Emirates ID for the user to check.", "Check, don't type."]],
          pairLbl: ["The constraint", "My decision", "Why"],
          shots: [{ t: "strip", items: [["form-empty", "Step 1: personal details"], ["form-consent", "Consent, read in place"], ["form-otp", "Step 2: details stay as chips"], ["id-front", "Step 3: Emirates ID"], ["id-extracted", "Details read from the ID"]] }] },

        { k: "options", h: "Ordering the physical card: what I took out",
          p: ["People who already have the virtual card can order the plastic one to a UAE address. An early idea let them save that address as Home, Work or Other. I questioned it: the address is either already entered or not needed again, so I removed it from my proposed direction."],
          compare: { a: ["addr-v1", "Version 1: form first", "Emirate, area, building, floor, apartment, landmark, and “Save this address as Home / Work / Other”."],
                     b: ["addr-v2", "Version 2: pin first", "“Drop a pin, then confirm the details below.” The pin fills the emirate and area; the fields stay visible to check."] },
          options: [["Save the address with a label", "Version 1 asked people to label where the card goes.", "rejected", "One card goes to one address. A label only pays off when an address is reused, so here it was one more decision for nothing."],
                    ["Pin first, fields below", "Version 2 starts with a map pin, then shows the address fields filled in.", "chosen", "Quicker for UAE addresses, and the visible fields let people check or fix what the pin found."]] },
        { k: "solution", h: "Every cost before paying, and value while waiting",
          find: [["Screen", "Pin, then confirm", "Search or use the current location on a full map; emirate and area fill in from the pin."],
                 ["Screen", "Every cost before paying", "The review shows the delivery address, the card fee, the delivery fee and the total, charged to the Halan Card balance."],
                 ["Screen", "A wait that isn't empty", "“Your card is on the way”, 3–5 business days, and straight away: “Spend online right now. Your virtual card is already active.”"]],
          shots: [{ t: "strip", items: [["addr-map", "Pin on the map"], ["addr-filled", "Details filled from the pin"], ["review", "Review: address and fees"], ["success-card", "The card is on its way"]] }] },

        /* ---------- 3 · Motion */
        { k: "solution", h: "3 · Motion: code accepted, card on its way",
          p: ["Two moments needed motion, and I prototyped both in Figma.",
              "For the verification code I built two takes on success. In one, the six digits fold into a single check: one signal that replaces the code. In the other, each digit turns green in turn and a “Code Verified” toast confirms it. Side by side, the trade-off was clear: the fold lands where people are looking, the digit-by-digit fill is playful but makes them wait about three seconds."],
          demo: ["otp-a", "otp-b"],
          motion: [["Take A, from the prototype", "All six digits wobble (ease-in, 0.2 s), fold into one check (0.5 s) and settle (0.5 s)."],
                   ["Take B, from the prototype", "Each digit lifts and turns green in turn (Smart Animate, ease-out, 0.5 s per box); 3 s later a “Code Verified” toast drops in (ease-out, 0.3 s)."]] },
        { k: "solution", h: "From the physical card to the one on screen",
          p: ["On the success screen I wanted the plastic card and the card on screen to feel like the same object. I explored several motion ideas in Figma, and with the mobile team we picked the one they could build reliably that still made that connection.",
              "I prepared it for LottieFiles myself. The export hit technical problems; I spent about three hours working through them, then handed a working file to the mobile developer. Handoff turned out to be part of the design.",
              "The prototype recording shows the three versions of the animation I explored."],
          video: { g: "phonevid", src: "proto.mp4", poster: "proto-poster.webp", alt: "Screen recording of the prototype, three versions of the card animation one after another: the card slides in, drops into a glass envelope, the envelope closes and flies off, and the card lands on Your card is on the way", w: 432, h: 938 },
          shots: [{ t: "strip", items: [["success-sheet", "Success sheet, before the animation"], ["success-lottie", "Success sheet, with the Lottie"]] }] },

        /* ---------- result */
        { k: "measure", h: "How I'd measure it",
          p: ["I can't share Halan's numbers, so these are the signals I'd watch to know whether the flows work."],
          measureLbl: "Would track",
          measure: [["Application completion", "Share of people who start the card application and submit it, and where they stop."],
                    ["Self-service resolution", "Help Center conversations closed without escalating to the call center."],
                    ["Escalation by topic", "Where the assistant falls short, so answers and shortcuts can improve."],
                    ["Answer helpfulness", "The Yes / No under every FAQ answer, already in the design."],
                    ["Repeat contacts", "Requests reopened, or the same issue raised again, within a week."]] },
        { k: "learn", h: "What I learned",
          list: [["Question the brief, kindly and with reasons", "The card application started as four or five steps. Asking what each step was for, rather than accepting the count, led to a shorter flow. A requirement is a starting point, not a spec."],
                 ["Constraints are design material", "Keeping personal details on screen in a small viewport, inside an established design system, pushed me to a better answer than a blank canvas would have."],
                 ["Design for the people who build it", "The richest motion idea isn't the best one if it can't ship. Choosing what the mobile team could build, then seeing it through LottieFiles myself, taught me that handoff is part of the work."],
                 ["Ask for the work", "Joining Borsa was my own request. Owning the Help Center and presenting it to PMs, designers and developers taught me to explain decisions, not screens."],
                 ["Learn from the people around you", "Halan's senior designers were my best mentors: their reviews taught me to defend a flow with the user's journey, not with how it looks."]] },
        { k: "learn", h: "What I'd do next",
          p: ["Looking back at the files with fresh eyes, these are the changes I'd make first."],
          list: [["One word per state", "Requests say “In progress” on the list and “Pending” in the thread. One label, everywhere."],
                 ["Say who's speaking", "Label replies from the assistant and from the operations team, and keep the assistant to explaining, never recommending investments."],
                 ["Make Action required actionable", "Put the upload button right in the thread when the team asks for a document."],
                 ["Codes that paste and autofill", "Let the six boxes accept a pasted code and SMS autofill, and design the wrong, expired and resend states."],
                 ["Show the total earlier", "Bring the total, delivery included, up to the address screen, not only the review."]] }
      ] },
    /* NEXA (Nov 3): rebuilt from her Behance slides. Screens cut out of the slides into f/nexa/s-*.webp;
       phone numbers on the review screen are blurred. Callout text is rewritten here, not shown as images. */
    { id: "nexa", name: "NEXA", cat: "Product", color: "#8DB31A", behance: "242418511/NEXA-E-Commerce-mobile-app-UIUX-design",
      tags: ["UI/UX", "E-commerce", "Mobile app"], statement: "NEXA is a modern e-commerce app for mobile. I designed a calm, minimal shopping experience, inspired by Amazon and Noon, for young adults who want to find something and check out fast.",
      meta: [["Project", "NEXA e-commerce app"], ["Platform", "Mobile app"], ["My role", "UI/UX design"], ["Tools", "Figma, Photoshop"], ["Audience", "Young adults"], ["Scope", "Home, categories, wishlist, product, cart, checkout, profile"]],
      tldr: [["The problem", "Big marketplaces offer everything, and their screens show it. Young shoppers who value speed and a clean interface have to dig through noise to get from a product to a paid order."],
             ["What I did", "Designed the whole journey, from home and categories to the product page and a four-step checkout, around a minimal interface, clear product presentation and quick actions."],
             ["The result", "A complete mobile shopping app where each screen has one job, and checkout asks only for what's needed, when it's needed."]],
      reel: [["hero", "NEXA cover: the line Your wardrobe one tap away beside the categories screen, on a lime circle over a giant NEXA wordmark", 1600, 1072], ["hand", "The NEXA home screen on a phone held in a hand, against black", 1600, 1067], ["rock", "The NEXA home screen on a phone standing on a dark rock, with notes on the offers banner and the flash sale", 1600, 1357], ["browse", "Category chips and product cards, the wishlist and the categories grid on phones, and a young man paying by card on his phone", 1600, 982], ["cart-profile", "The cart and the profile screens on two green phones", 1600, 1357], ["palette", "The NEXA palette, lime, near-black and three greys, beside the product page and the Roboto typeface", 1600, 1092]],
      cover: "E‑commerce mobile app",
      coverImg: ["hero", "NEXA: the line Your wardrobe one tap away beside the categories screen, on a lime circle over a giant NEXA wordmark", 1600, 1072],
      sections: [
        /* ------------------------------------------------ 1 · problem */
        { k: "value", h: "The brief", p: ["NEXA is a modern e-commerce app for mobile. The brief was a shopping experience that feels smooth and minimal, with the range people expect from platforms like Amazon and Noon but without their crowded screens."] },
        { k: "problem", h: "Who it's for", lead: "Young adults who value speed, simplicity and clean design.",
          p: ["They shop on their phones, often in a few spare minutes. They know what a good shopping app feels like, and they leave when a screen makes them work to find the next step."] },
        { k: "goals", h: "What the app had to do", goals: ["Let people browse a wide range of products.", "Make search and moving between categories fast.", "Let people save items to a wishlist and share them.", "Keep checkout smooth and payment secure."] },
        { k: "goals", h: "Design focus", p: ["Four principles held every screen to the same standard."],
          list: [["Minimal and modern", "Light surfaces, one lime accent and a black navigation bar. Nothing on screen that doesn't help someone shop."], ["Clear product presentation", "Large photos, the price and its discount, the rating, and one button to add to cart."], ["Easy navigation, quick actions", "Five tabs, always in reach, and the main action of each screen one tap away."], ["Mobile first", "Designed for a phone screen from the start, not shrunk from a website."]] },
        /* ------------------------------------------------ 2 · process */
        { k: "solution", h: "The journey", p: ["The app is designed around one path, from the first screen to a placed order, with categories and the wishlist as the two ways to find something."],
          flow: ["Home", "Categories", "Product", "Cart", "Checkout", "Order placed"], flowLbl: "The shopper's path" },
        /* ------------------------------------------------ 3 · solution */
        { k: "solution", h: "Home: offers first, then browsing", p: ["The home screen opens with a greeting and the delivery location, then search, then what's on offer today, before the categories and the product grid."],
          phones: [["s-home-grid", "The lower half of the home screen: Categories with Electronics, Fashion, Grocery and Toys and Games as chips, a grid of product cards with photo, name, rating, colours, price and an add to cart button, and the navigation bar with Home active", "Categories as chips, products as cards", 369, 530]],
          notes: [["Promotions near the top", "the offers banner sits right under search, where it catches the eye without shouting over everything else."], ["A countdown on the flash sale", "a live timer next to the title helps people catch limited-time deals before they end."], ["Categories as chips", "visual chip cards make switching between Electronics, Fashion or Grocery one tap, for quick browsing."], ["Product cards with just enough", "a clean grid shows the photo, name, rating, colours and price, enough to spark interest without crowding the screen."]],
          take: "The home screen answers two questions in order: what's on offer today, and where to start browsing." },
        { k: "solution", h: "Categories and wishlist", p: ["Two other ways in: a categories page for people who know the kind of thing they want, and a wishlist for what they've already found."],
          phones: [["s-categories", "The categories page: search, then a bento grid of photo tiles in different sizes, Electronics, Fashion, Skin Care, Toys and Games, Perfumes and Video Games, with Categories active in the navigation bar", "Categories as a bento grid", 370, 810], ["s-wishlist", "An empty wishlist: a box illustration, Your wishlist is empty, Add your favourite products to start shopping, a Continue shopping button and Best Sellers for you underneath", "The empty wishlist leads back to shopping", 372, 536]],
          notes: [["A bento grid of categories", "tiles in different sizes create a visual hierarchy, so browsing feels lively instead of a long list to scan."], ["Photos, not icons", "each tile is a real photo with the category name in lime, so people recognise a category before they read it."], ["Wishlists as artboards", "people can make their own boards and sort saved items into collections: gift ideas, seasonal wants, or different shopping goals."], ["An empty state that keeps going", "an empty wishlist explains what it's for, offers Continue shopping, and shows best sellers right away."]],
          take: "Categories and the wishlist are two doors into the same shop: one for browsing, one for coming back." },
        { k: "solution", h: "Product page: everything to decide, nothing more", p: ["The product page puts the decision first, photo, price and rating, and keeps the longer details folded until someone asks for them."],
          phones: [["s-product", "A product page for Korean skin care products: a photo gallery with wishlist and share, Best Seller and 4.5 stars from 117 reviews, colours, the brand with Shop this brand, 2350 LE with the old price struck through and a coupon, quantity, Description and Brand as folded sections, More for the collection, Reviews and Ratings, Frequent mentions tags and an Add to cart button", "Decide first, details folded", 370, 1324]],
          notes: [["Expandable sections", "Description and Brand fold away as an accordion. Following Hick's Law, fewer choices on screen at once means less overload, while every detail stays one tap away."], ["Validation through reviews", "real customer reviews and ratings sit on the page; the bandwagon effect does the rest: if others love it, it must be good."], ["Frequent mentions you can tap", "tags pulled from reviews, like Skin care or Lotion, are clickable and search for related products based on what customers actually talk about."], ["Price, discount and coupon in one row", "the new price, the old one struck through and the coupon sit together, so the deal is clear at a glance."], ["Add to cart never scrolls away", "the main button stays pinned at the bottom of the page."]],
          take: "The page answers “is it good, and is it worth it?” before it asks for anything." },
        { k: "solution", h: "Checkout: four short steps", p: ["Checkout is split into four steps, delivery info, shipping, payment and review, with a tracker at the top and the total always above the main button."],
          phones: [["s-signup", "A sign-up sheet over the cart: Hey, create an account to complete your order, Sign in with Google, or first name, last name, email and password, and Create Account", "Sign up only when it's needed", 364, 808], ["s-delivery", "Checkout step one, delivery information: name, address, two phone numbers, state and city, Save delivery details for future orders, and the total with Continue to Payment", "Step 1: delivery information", 366, 803], ["s-shipping", "Checkout, shipping method: Expedited Delivery marked new and free, 2 Day Delivery, 1 Day Saver and 1 Day Delivery, each with its price and timeframe", "Step 2: speed against price", 364, 803], ["s-payment", "Checkout, payment method: digital payment selected with Visa, Mastercard and PayPal, card number, expiry and CVV fields underneath, and cash on delivery", "Step 3: card fields only when needed", 364, 804]],
          notes: [["Sign up at the right moment", "the account sheet appears only when someone tries to check out without logging in, a strategic moment that balances friction against conversion. Google sign-in makes it one tap."], ["Two tabs for delivery", "Delivery Information and Shipping Method are separate tabs in one view: related details stay together, and nobody gets lost between pages."], ["Every shipping option, priced", "expedited delivery is promoted as new and free, but every tier shows its price and timeframe, so people trade speed against cost without pressure or hidden fees."], ["Progressive disclosure on payment", "card fields only appear when digital payment is chosen, which keeps the first view simple."], ["Save it for next time", "a checkbox keeps delivery details for future orders."]],
          take: "Each step asks one kind of question, and complexity only shows up when someone chooses it." },
        { k: "solution", h: "Review and order placed", p: ["The last step shows everything once more, then celebrates the order and points to what's next."],
          phones: [["s-saved-card", "Payment method with a saved card, Yasser Amin card with only the last digits showing, cash on delivery, and Add new card", "A saved card, recognised", 366, 804], ["s-review", "The review step: payment card, ship to, contact info and the item, each with an Edit link, then the order summary with subtotal, delivery fee and total, and Place Order", "Step 4: one last check", 370, 1013], ["s-done", "Order has been placed, with a check and an illustration of a gift passed between two screens, and two buttons: Continue shopping and Track your order", "Done: celebrate, then next steps", 370, 808]],
          notes: [["A card people recognise", "a saved card shows the cardholder's name and only its last digits, so it's familiar while the sensitive data stays protected."], ["Alternatives stay close", "cash on delivery and Add new card sit right under the saved card."], ["One last look, with an edit on everything", "payment, address, contact details and items are all on one screen, each with its own Edit link."], ["A success state that celebrates", "Order has been placed comes with an illustration, then two clear ways forward: continue shopping, or track the order."]],
          take: "The journey ends on a moment of confidence, not a receipt." },
        { h: "NEXA in the hand", p: ["The home, cart and profile screens, on the phones they were designed for."],
          figs: [{ g: "two", items: [["hand", "The NEXA home screen on a phone held in a hand, against black", "Home", 1600, 1067], ["cart-profile", "The cart, with two products, a coupon field and the order summary, and the profile, with personal information, address and orders, on two green phones", "Cart and profile", 1600, 1357]] }] },
        { k: "system", h: "Design system", p: ["One lime accent on near-black and soft greys. Lime marks what to tap next: the main buttons, the active tab, discount tags and the tracker steps that are done. Roboto carries the whole interface."],
          swatches: [["#B5F601", "Lime · main actions and active states"], ["#18181B", "Near-black · navigation bar and text"], ["#9294A0", "Grey · secondary text"], ["#C9CACF", "Light grey · borders and inactive states"], ["#F1F2F3", "Off-white · page background"]],
          type: [{ aa: "Aa", name: "Roboto", role: "The whole interface", font: "Roboto, sans-serif", sample: "Flash Sale ends in 02 : 30 : 24" }] },
        /* ------------------------------------------------ 4 · result */
        { k: "measure", h: "How we'd measure success", p: ["NEXA hasn't launched, so these are the measures the design is built to move, not results."],
          measure: [["Checkout completion", "Share of carts that reach Order placed.", "Rising"], ["Sign-up at checkout", "Share of guests who create an account on the checkout sheet instead of leaving.", "Most guests stay"], ["Time to first order", "Usability test with 5–8 young adults: time from opening the app to a placed order.", "One sitting"], ["Wishlist return", "Share of wishlist items later added to cart.", "Rising"], ["Search from reviews", "Taps on Frequent mentions tags that lead to a product view.", "Used regularly"]] },
        { k: "impact", h: "Result", p: ["A complete UI/UX design for a mobile shopping app."],
          impact: [["Outcome", "The whole journey is designed, from home, categories and the wishlist to the product page, a four-step checkout and the success state, plus the cart and profile."], ["Outcome", "The account is asked for only at checkout, and card fields only when card payment is chosen."], ["Next", "Usability tests with young adults, starting with the checkout steps."]] }
      ] },
    /* VYBE (Nov 3): rebuilt from her Behance slides. Phones cut out of the slides into f/vybe/ (m-* are
       mockup crops with the slide's labels painted out, s-tickets is the flat screen). Slide text rewritten here. */
    { id: "vybe", name: "VYBE", cat: "Product", color: "#6044FF", behance: "242417515/VYBE-Events-mobile-app-UI-design",
      tags: ["UI design", "Events", "Mobile app"], statement: "VYBE is a mobile events app. I designed its UI around three things: speed, clarity and effortless booking, so finding what's happening around you takes a glance and a tap.",
      meta: [["Project", "VYBE events app"], ["Platform", "Mobile app"], ["My role", "UI design"], ["Tools", "Figma, Photoshop"], ["Scope", "Home, search, filters, tickets and RSVPs, profile"]],
      tldr: [["The problem", "Events are scattered and time-bound. People need to see what's on, near them and soon, then book it, without wading through listings."],
             ["What I did", "Designed the UI for four tabs, Home, Search, Tickets and Profile, with filters by category, location and date, and tickets that look and feel like tickets."],
             ["The result", "A complete events app UI where discovering, filtering and keeping track of bookings each take one screen."]],
      reel: [["hero", "VYBE cover: two phones with the home and search screens in front of a giant white VYBE wordmark on violet", 1600, 900], ["splash", "The VYBE splash screen, the wordmark and two grey stars on violet, with Event app UI screens and the tools, Figma and Photoshop", 1600, 900], ["happening", "Find what's happening around you: the home screen in a hand, the tickets screen, and event categories as pills", 1600, 1880], ["hsf", "The home, search and filter screens on phones, each with its one-line description", 1600, 2552], ["tickets-board", "The tickets screen, flat and on a tilted phone, with Tickets: all your booked events in one place", 1600, 1063], ["palette-board", "The VYBE colours as cards: lime A0FF84, near-black 0B0415, violet 6044FF and white FDFDFD", 1600, 971]],
      cover: "Events mobile app",
      coverImg: ["hero", "VYBE: two phones with the home and search screens in front of a giant white VYBE wordmark on violet", 1600, 900],
      sections: [
        /* ------------------------------------------------ 1 · problem */
        { k: "value", h: "The brief", p: ["VYBE is a mobile app for finding events and booking them. The project is its UI: a modern events app that feels as lively as the events themselves while staying quick to use."] },
        { k: "problem", h: "The challenge", lead: "An events app has to make a plan feel worth it at a glance: what it is, where, when, and how much, before anyone taps.",
          p: ["Events are also time-bound: a great one next month is useless if it's buried under everything happening today. The interface had to sort by what's near and soon, without losing the energy."] },
        { k: "goals", h: "Design focus", p: ["Three words set the bar for every screen."],
          list: [["Speed", "The next event worth going to should be on the first screen, not three taps away."], ["Clarity", "Every card shows the same few facts in the same place: the name, the date and time, the venue."], ["Effortless booking", "Booked events and RSVPs live in their own tab, ready at the door."]] },
        /* ------------------------------------------------ 2 · process */
        { k: "solution", h: "The journey", p: ["Four tabs in a dark bar at the bottom: Home to discover, Search to look for something specific, Tickets for what's booked, and Profile."],
          flow: ["Discover", "Search", "Filter", "Your tickets", "Profile"], flowLbl: "The path through the app" },
        { k: "solution", h: "Event categories", p: ["Events come in many shapes, so the categories go beyond the usual handful. They show up as pills on search and in the filters."],
          tiers: [{ h: "What it is", items: [["Arts & Culture", 0], ["Learning", 0], ["Comedy", 0], ["Live Shows", 0], ["Gaming", 0], ["Workshops", 0], ["Wellness", 0], ["Sports", 0], ["Skill Sessions", 0], ["Talks", 0], ["Tech Events", 0], ["Creative Talks", 0], ["Performances", 0], ["Product Launches", 0], ["Festivals", 0]] },
                  { h: "How it feels", items: [["Night Out", 0], ["Rooftops", 0], ["Social", 0], ["Community", 0], ["Move", 0], ["Runs", 0], ["Cycling", 0], ["Outdoor", 0]] },
                  { h: "Picked for you", items: [["Near You", 1], ["This Week", 1], ["Trending", 0], ["Editor's Picks", 0], ["Recommended", 0]] }] },
        /* ------------------------------------------------ 3 · solution */
        { k: "solution", h: "Home: what's on, at a glance", p: ["Home shows trending and upcoming events the moment the app opens."],
          phones: [["m-home", "The VYBE home screen: Mark Yatin in Chicago with notifications, Top Events as a large card, Industry Summit, Wednesday April 8th, 19:00, Ukrain Theatre, then Recommended for you as a list of events with a date badge, venue, a heart and a Details button", "Top events first, then picks for you", 545, 1005]],
          notes: [["One big event on top", "Top Events is a wide photo card with the title in lime, the day, time and venue, so the most important event of the moment can't be missed."], ["Your city in the header", "the greeting carries the location, Chicago, which is what the recommendations are based on."], ["Recommended as a scannable list", "each event is a row with a date badge on the photo, a short description, the venue and a Details button."], ["Save without opening", "a heart on every card saves an event in one tap."]],
          take: "Home answers “what's worth going to?” before anyone types a thing." },
        { k: "solution", h: "Search and filters", p: ["Search is for people who know roughly what they want; filters narrow it down by category, place and date."],
          phones: [["m-search", "The search tab: a search bar with a filter button, Recent Searches as removable chips, Upcoming Near You as photo cards, Categories as pills with Learning selected, and an event card with the date, venue, attendees and 320$ per person", "Search: recent, near you, by category", 445, 1015], ["m-filter", "Filters: Clear all, categories as chips, location as a dropdown set to Alexandria, filter by day, month or year, a calendar for July 2025 with the 13th selected, and Apply", "Filters: category, place, date", 435, 975]],
          notes: [["Recent searches you can clear", "past searches sit as chips under the bar, each with an × to remove it."], ["Near you before everything else", "Upcoming Near You comes first, as photo cards with the event and venue on the image."], ["Categories as pills", "one tap narrows the list; the selected category turns violet."], ["Price on the card", "the event card shows the price per person and who's going, before the details page."], ["Filters on one sheet", "category, location and date sit on one screen, with Day, Month or Year to set the range, a calendar, Clear all at the top and one Apply button at the bottom."]],
          take: "From a vague idea to a short list in two screens: search for it, then narrow it." },
        { k: "solution", h: "Tickets and profile", p: ["All booked events live in one place, and the profile keeps bookings and personal details easy to manage."],
          phones: [["s-tickets", "Your Tickets as a carousel of ticket-shaped cards, Tech Conference, Wednesday April 8th, Pyramids theatre, then Your RSVPs: Industry Summit, Leadership Forum, Poetry Reading, Craft Market, each with a coloured date block, the venue and a bookmark", "Tickets and RSVPs, in one place", 430, 929], ["m-profile", "The profile: photo and name, Mark Yatin, counts for tracking 52, friends 26 and concerts 12, and a menu: manage tracked artists, find friends, connect an account, manage your location, your tickets", "Profile: bookings and details", 640, 865]],
          notes: [["Tickets that look like tickets", "booked events are cards with a notch cut in the top and bottom, like a torn ticket, so they read as something you own."], ["RSVPs apart from tickets", "events you've said yes to are a separate list under the tickets, each with its date on a coloured block."], ["Colour per date", "lime, pink, grey and violet blocks make the next few dates easy to tell apart at a glance."], ["Your numbers on the profile", "tracked artists, friends and concerts sit under the photo."], ["Everything personal in one menu", "tracked artists, friends, connected accounts, location and tickets are each one row."]],
          take: "Once booked, an event is always one tap away, in a form that looks like what it is." },
        { k: "system", h: "Design system", p: ["Electric violet with a lime spark, on near-black and white. Violet marks what's active: the selected tab, chip and date, and the main buttons. Lime is saved for event titles on photos. Roboto in three weights, Regular, Medium and Bold, carries the whole interface."],
          swatches: [["#6044FF", "Violet · active states and buttons"], ["#A0FF84", "Lime · event titles and highlights"], ["#0B0415", "Near-black · navigation bar and text"], ["#FDFDFD", "White · screens and cards"]],
          type: [{ aa: "Aa", name: "Roboto", role: "Regular, Medium and Bold", font: "Roboto, sans-serif", sample: "Industry Summit · Wednesday, April 8th · 19:00" }],
          figs: [{ g: "one", items: [["splash", "The VYBE splash screen, the wordmark and two grey stars on violet", "The splash screen", 1600, 900]] }] },
        /* ------------------------------------------------ 4 · result */
        { k: "measure", h: "How we'd measure success", p: ["VYBE hasn't launched, so these are the measures the design is built to move, not results."],
          measure: [["Time to a plan", "Usability test with 5–8 people: time from opening the app to saving or booking an event.", "Under a minute"], ["Filter use", "Share of searches narrowed with category, location or date.", "Used often"], ["Bookings from home", "Share of bookings that start from Top Events or Recommended.", "Rising"], ["Return to tickets", "How often people open Tickets before an event instead of searching for it again.", "Most of them"]] },
        { k: "impact", h: "Result", p: ["A complete UI design for a mobile events app."],
          impact: [["Outcome", "Home, search, filters, tickets with RSVPs and the profile are designed as one system, on one violet and lime palette."], ["Next", "Design the event page and the booking steps, then test the whole path with people who go out often."]] }
      ] },
    /* Lumiere (Nov 3): rebuilt from her web presentation, full-page screenshots and prototype recording.
       Sections cut from the page into f/lumiere/; the contact phone number is blurred and the video ends before it. */
    { id: "lumiere", name: "Lumiere", cat: "Product", color: "#8D1D19", behance: "243721917/Lumiere-landing-page-Graduation-2025",
      tags: ["Web UI", "Landing page", "Graduation project"], statement: "Lumière is a French cultural campaign that shows the unseen side of France: real stories, hidden places, authentic moments. I designed its landing page, my 2025 graduation project, to carry visitors from that story to the events and the regions behind it.",
      meta: [["Project", "Lumière, graduation project 2025"], ["Platform", "Website, campaign landing page"], ["My role", "UX and UI design"], ["Timeline", "May – June 2025"], ["Focus", "Storytelling, themes, events, an interactive map"]],
      tldr: [["The problem", "A campaign page has to tell a story and still lead somewhere. Visitors arrive curious about a culture, not ready to plan a visit."],
             ["What I did", "Designed one scrolling page: a postcard hero, the campaign's story, French culture by theme in tabs, an events carousel, an interactive map of the regions, and contact."],
             ["The result", "A landing page and clickable prototype where the campaign's mood and its practical goal, getting people to events and places, work as one path."]],
      reel: [["cover", "The Lumière landing page on a large screen and a small one, deep red with gold, over a pixelated painting of rooftops", 1600, 989], ["hero", "The hero: ESTD 2025, Spark The Unseen in gold over three Paris polaroids", 1393, 992], ["about", "Whose Lumiere? The campaign's story beside a photo of the Seine at golden hour", 1179, 780], ["tabs", "Theme tabs, Fashion, Cinema, Food: French Fashion, Timeless Elegance, with a photo near the Eiffel Tower", 1179, 836], ["events", "What to do in Paris: event cards with photo, date, place and More info, with arrows", 1393, 991], ["map", "The map: France by region in gold, beside Discover every place in France", 1179, 760]],
      cover: "Landing page, graduation 2025",
      coverImg: ["cover", "The Lumière landing page on a large screen and a small one, deep red with gold, over a pixelated painting of rooftops", 1600, 989],
      sections: [
        /* ------------------------------------------------ 1 · problem */
        { k: "value", h: "The brief", p: ["Lumière is a French campaign that reveals the unseen side of France. Away from clichés, it spotlights real stories, hidden places and authentic moments: a journey into the heart of the country. The landing page is where the campaign lives online, my graduation project in 2025."] },
        { k: "problem", h: "The challenge", lead: "A campaign page has to tell a story and still lead somewhere: from curiosity about a culture to an event and a place to go.",
          p: ["Story-led pages tend to stop at the story, and event pages start at the listings. Lumière needed both, in the right order, and in a voice that feels raw, quiet and deeply human rather than like a travel brochure."] },
        { k: "goals", h: "Goals", goals: ["Carry the campaign's mood, so the page feels like part of Lumière, not a ticket form.", "Let visitors explore France at their own pace: by theme, then by region.", "Lead from the story to what's happening, and to a way to get in touch."] },
        /* ------------------------------------------------ 2 · process */
        { k: "solution", h: "The page, top to bottom", p: ["One scrolling page in six parts, each a step from feeling to doing. A sticky bar with Home, About, Events, Contact and Map and a Reach Out button keeps every part one click away."],
          flow: ["Spark the unseen", "Whose Lumière?", "France by theme", "What to do in Paris", "Map", "Contact"], flowLbl: "The visitor's path" },
        /* ------------------------------------------------ 3 · solution */
        { k: "solution", h: "Hero: France as a stack of postcards", p: ["The page opens on the campaign line, not on a menu of offers."],
          screen: ["hero", "The hero: a gold star, ESTD and 2025 either side of SPARK, The Unseen in script, and three polaroids of Paris, a bridge at sunset with the Eiffel Tower, the Arc de Triomphe and a flowered street", 1393, 992],
          notes: [["The campaign line is the headline", "SPARK in tall gold capitals, The Unseen in a script laid over it, with ESTD and 2025 either side like a stamp."], ["Polaroids instead of a banner", "three tilted instant photos, a sunset bridge, the Arc de Triomphe and a quiet flowered street, set the tone: personal, found, a little nostalgic."], ["Red and gold, like old French print", "a deep red page and gold type feel like a theatre programme or a vintage label."], ["Reach Out stays in the corner", "the one call to action is always there, but never louder than the story."]],
          take: "The first screen sells a feeling, not a product." },
        { k: "solution", h: "Whose Lumière? The story, in a few lines", p: ["Right after the hero, the page says what Lumière is, in plain words."],
          screen: ["about", "Whose LUMIERE? in gold, a paragraph about the campaign, and the line Raw, quiet and deeply human, beside a photo of the Seine at golden hour in a gold-edged frame", 1179, 780],
          notes: [["A question as the title", "Whose Lumière? invites the visitor in instead of announcing a brand."], ["The promise, then the mood", "the paragraph says what the campaign does; a quieter line under it says how it feels: raw, quiet and deeply human."], ["One photo, golden hour", "the Seine at sunset in a frame with a thin gold edge, the same warm light as the hero."]],
          take: "Visitors know what Lumière is, and how it should feel, before they scroll further." },
        { k: "solution", h: "France by theme, in tabs", p: ["Culture comes in tabs: Fashion, Cinema, Food and more. Each tab is a short story with its own photo, and its own colour."],
          screen: ["tabs", "Folder tabs, Fashion, Cinema, Food and a fourth cut off, over a panel: French Fashion, Timeless Elegance, a paragraph about Paris as the fashion capital, and a photo of a woman in a red gown near the Eiffel Tower", 1179, 836],
          notes: [["Folder tabs, not a menu", "the themes sit on tabs like a file folder; the active one joins the panel, so it's clear which story is open."], ["A colour per theme", "Fashion is red, Cinema navy, Food blue: switching tabs changes the whole panel, so each theme feels like its own chapter."], ["Title, script, then the story", "a capital headline and a script subtitle, French Fashion: Timeless Elegance, then one paragraph and one strong photo."], ["Cinema ties back to the name", "the Cinema tab tells how France gave birth to cinema with the Lumière brothers' first film in 1895."], ["More tabs past the edge", "a fourth tab cut off at the edge shows there's more to explore."]],
          take: "France is told one theme at a time, so a long story never feels like a long read." },
        { k: "solution", h: "What to do in Paris", p: ["From story to plans: the events of the season, as a carousel of cards."],
          screen: ["events", "What to do in Paris, a line about the exclusive events of the anniversary, then a carousel of cards: Grand Palais reopening with a photo of the gilded hall, the date, the place and More info, and a garden festival at a château, with arrow buttons below", 1393, 991],
          notes: [["Cards that look like tickets", "each event is a photo and a card joined by a dashed line, like a ticket and its stub."], ["The facts in one row", "place and date sit under the title with small icons, so cards can be compared at a glance."], ["One button per card", "More info in the page's red, the only filled button on the card."], ["A carousel with arrows", "cards run past the edge of the page, and two round arrows step through them."]],
          take: "The story turns into plans without changing its voice." },
        { k: "solution", h: "The map: discover every region", p: ["An introductory, interactive map of France: hover a region and its name and a photo appear."],
          screen: ["map", "A gold map of France split into its regions, with Corsica, beside the word Map in script and Discover every place in France with our introductory interactive map", 1179, 760],
          notes: [["The whole country, region by region", "France is drawn in gold with every region outlined, so the campaign's reach beyond Paris is visible at once."], ["Hover to discover", "pointing at a region shows its name in a small gold label and a photo of a place there."], ["Exploring, not searching", "the map invites wandering, the way the campaign wants people to see France."]],
          take: "The map turns “the unseen side of France” into places you can point at." },
        { k: "solution", h: "Contact and footer", p: ["The page ends on an invitation to talk, in the campaign's gold."],
          screen: ["contact", "Contact in script, Have a question? Let's discuss your vision and bring it to life, the email address, and a red form with name, email and message fields and Send Message, above a gold footer with the logo and social links", 1179, 711],
          notes: [["The colours flip at the end", "a gold section with a red form marks the change from reading to writing."], ["Three fields only", "name, email and message, and one Send Message button."], ["Direct details beside the form", "for anyone who'd rather write themselves."]],
          take: "The last step is a conversation, not a sign-up." },
        { k: "solution", h: "Prototype", p: ["The clickable prototype, from the hero through the theme tabs, the events carousel and the map hover."],
          video: { src: "walk.mp4", poster: "walk-poster.webp", alt: "Screen recording of the Lumière prototype: the hero, Whose Lumière?, the Fashion, Cinema and Food tabs changing colour, the events carousel moving with its arrows, and the map showing region names and photos on hover", w: 1440, h: 822 } },
        { k: "system", h: "Design system", p: ["A deep French red with gold, like an old theatre programme, and the cream of an instant photo. Each theme tab brings its own colour. Type pairs a tall, condensed display serif for capitals, a formal script for the second line of each title, and a plain sans for reading."],
          swatches: [["#8D1D19", "French red · the page"], ["#F5C360", "Gold · titles, buttons, the map"], ["#E8C99D", "Polaroid cream · photo frames"], ["#A13D26", "Brick · the events band"], ["#272253", "Navy · the Cinema tab"], ["#3C7EA5", "Blue · the Food tab"]] },
        /* ------------------------------------------------ 4 · result */
        { k: "measure", h: "How we'd measure success", p: ["Lumière was a graduation project and hasn't launched, so these are the measures the page is built to move, not results."],
          measure: [["Reaching the events", "Share of visitors who scroll from the story down to What to do in Paris.", "Most visitors"], ["Theme tabs opened", "Average number of tabs opened per visit.", "More than one"], ["Map exploration", "Share of visitors who hover or tap at least one region.", "Rising"], ["From events to contact", "Clicks on More info and messages sent through the form.", "Rising"]] },
        { k: "impact", h: "Result", p: ["Lumière was delivered as my graduation project in 2025."],
          impact: [["Outcome", "One page that carries visitors from the campaign's story to themes, events, regions and contact."], ["Outcome", "A clickable prototype with theme tabs that change colour, an events carousel and a hover map."], ["Next", "Region pages behind the map, and the mobile layout tested with real visitors."]] },
        { k: "learn", h: "What I learned", p: ["A campaign page is a story with a destination. Deciding where the story ends and the plans begin mattered more than any single section."] }
      ] },
    { id: "gd-2024", name: "Graphic Design Portfolio 2024", cat: "Graphic", color: "#B9B39A", behance: "250574963/Graphic-Design-Portfolio-2024",
      tags: ["Graphic design", "Collection"], statement: "A collection of my graphic design work from 2024: posters, social media, print, illustration and branding.",
      meta: [["Project", "Graphic design portfolio"], ["Year", "2024"]], cover: "Selected graphic work",
      sections: [{ h: "Selected work", p: ["Posters, social media, print and packaging, illustration and branding, from 2024."], figs: [{ g: "one", items: [["jazz", "Three Jazz Festival posters mixing stock photos of musicians with bright hand-drawn shapes and clouds", "Posters: Jazz Festival", 1600, 1131]] }, { g: "one", items: [["amazigh", "Three Amazigh culture posters, Azul Felawn, with halftone portraits, Amazigh symbols and bilingual type", "Posters: Amazigh culture", 1600, 1131]] }, { g: "one", items: [["amazigh-street", "The Amazigh posters pasted on old Cairo walls, beside street signs, a motorcycle and a man sitting outside a shop", "Posters: Amazigh culture, in the street", 1600, 1131]] }, { g: "one", items: [["kilo-kabab", "Kilo Kabab social media posts around an Instagram phone mock-up, green and yellow with Arabic headlines", "Social media: Kilo Kabab", 1600, 1131]] }, { g: "one", items: [["breadfast", "Breadfast social media posts in magenta and light blue: croissants, salad, cake and coffee with Arabic headlines", "Social media: Breadfast", 1600, 1131]] }, { g: "one", items: [["emdad", "Emdad company profile 2023: cover, spreads with staff table, quality policy and organisation chart", "Print: Emdad company profile, Saudi Arabia", 1600, 1131]] }, { g: "one", items: [["print-real-life", "Printed books, booklets, posters and packaging on a table at an exhibition, and Rofaida presenting her work", "Print and packaging, in real life", 1600, 1131]] }, { g: "one", items: [["red-bull", "Red Bull ad: a winged character poster, pencil character sketches, model sheets and storyboard pages", "Illustration: Red Bull ad storyboard", 1600, 1131]] }, { g: "one", items: [["eid", "Eid al-Fitr illustration: hands shaping kahk cookies and a cat's paws, in an Islamic frame, shown as a coaster", "Illustration: Eid al-Fitr", 1600, 1131]] }, { g: "one", items: [["ghorya", "Mogamaa El-Ghorya sign system: calligraphic logo, booklet, pictograms for the rooms and directional signs", "Branding: Mogamaa El-Ghorya sign system", 1600, 1131]] }, { g: "one", items: [["personal-branding", "Personal branding: an R and A monogram with sparkles, business cards, badges, pattern, tote bags and a notebook", "Branding: personal identity", 1600, 1131]] }] }] },
    { id: "social-posts", name: "Breadfast and Kilo Kabab campaign", cat: "Playground", color: "#9CC488", behance: "194862413/Socia-media-post-designs-V1",
      tags: ["Social media", "Campaign"], statement: "Social media campaign designs for Breadfast and Kilo Kabab.",
      reel: [["bf-grid", "Breadfast posts in a grid with an Instagram phone mockup: Fresh organic, a baby croissant, a cake, coffee, Nutella croissant and lunch boxes", 800, 801], ["kk-feast", "Kilo Kabab post: kebab, kofta, chicken and rice on a wooden table, Having guests? Leave it to us", 800, 800], ["bf-baby", "Breadfast post: baby croissants falling across bold white lettering on magenta, with a New product sticker", 800, 800], ["kk-moments", "Kilo Kabab post: kofta on a board on the sand beside a straw hat and a camera, Sweet moments with Kilo Kabab", 800, 800], ["bf-banner", "Breadfast banner: a tray of croissants beside fresh eggs, Try a different breakfast?", 1605, 800], ["kk-mix", "Kilo Kabab post: a mixed grill plate on a checked cloth, with steam in the shape of a heart", 800, 800], ["bf-try", "Breadfast post: croissants and eggs with hand-drawn circles and arrows, Try fresh croissants and fresh eggs", 800, 800], ["kk-wraps", "Kilo Kabab post: two hands holding shish and fillet wraps in branded boxes on orange", 800, 800], ["bf-cake", "Breadfast post: a bundt cake with its ingredients, flour, eggs, butter and milk, labelled in handwriting, Let's bake a cake", 800, 800], ["kk-lentil", "Kilo Kabab post: a cup of lentil soup steaming on a tray, with a sticky note", 800, 800], ["bf-nutella", "Breadfast post: chocolate pouring onto a croissant on magenta, Tried the new Nutella croissant?", 800, 800], ["kk-holiday", "Kilo Kabab post: kofta in a basket on a line-drawn delivery scooter in the city, The holiday is flying by", 800, 800]],
      meta: [["Project", "Breadfast and Kilo Kabab campaign"], ["Discipline", "Social media campaign"]], cover: "Campaign posts",
      sections: [{ h: "Posts", media: [["three", ["Post", "Post", "Post"]], ["three", ["Post", "Post", "Post"]]] }] },
    /* Snapchat Spellbook (Nov 5): her illustration + UI redesign concept. Nov 7: moved to App & web UI; "View project" opens her page p/snapchat-spellbook/ in a new tab */
    { id: "snapchat", name: "Snapchat Spellbook", cat: "Product", color: "#544AE6", link: "p/snapchat-spellbook/",
      tags: ["Illustration", "UI redesign"], statement: "Snapchat’s logo is a ghost, so I asked: what if that ghost went to magic school? Snapchat Spellbook reimagines the app’s icons as enchanted objects: a key for location, a mirror for the camera, a message in a bottle for chat. These sit inside a cleaner interface built for the people who use it most. It’s a concept project made for fun, exploring how a pictogram system can give a familiar app a brand-new personality.",
      reel: [["screens", "The redesigned screens: camera, map, Discover, Stories, chats and Add friends, in lavender with the new pictograms", 1333, 800], ["pictograms", "21 magical pictograms on lime: key, eye, bottle, wand, mirror, tarot cards, ghost, hourglass, torch and more", 1231, 800], ["before-after", "Before and after: Snapchat's black-and-white icons beside the new violet and lime pictograms", 1454, 800], ["object-to-pictogram", "Real object plus a spell equals a pictogram: a key for Location, an evil eye for Discover, a bottle for Chat, a mirror for Camera", 1231, 800], ["camera", "The camera screen before and after, with patch notes: Camera, recast, and Four tabs", 1092, 800], ["inspiration", "Each feature as an enchanted object, with its story: Location, Discover, Chat, Camera, Multi snaps, Notifications and more", 1014, 800], ["old-icons", "Game over for black and white: the original icons, with 2 colours, 5 nav items and 0 ghost links", 1373, 800], ["audience", "Built for the people who snap the most: the audience, aged 13 to 27, what they love and what they hate", 1294, 800]],
      meta: [["Project", "Snapchat Spellbook"], ["Discipline", "Illustration and UI redesign"]], cover: "Pictograms and UI redesign",
      sections: [{ h: "Concept", media: [["full", ["Overview"]]] }] },
    { id: "traubi", name: "Traubi", cat: "Playground", color: "#B7A3CF", behance: "250717001/Traubi-SocialMedia-Campaign",
      tags: ["Social media", "Campaign"], statement: "A social media campaign for Traubi.",
      reel: [["t-pure", "Traubi post: a frosted bottle among purple grapes and splashes, with the line Pure raisin drink in Arabic", 864, 1080], ["t-adventure", "Traubi post: two bottles in a mountain lake under a cable car and a waterfall, Live a refreshing adventure", 864, 1080], ["t-anywhere", "Traubi post: a giant bottle beside a tower over a city at dusk, grapes floating down on parachutes, Any time, anywhere", 864, 1080], ["t-vine", "Traubi post: the bottle covered in purple grapes and vine leaves in a vineyard", 864, 1080], ["t-happy", "Traubi post: a bottle and a glass on a garden table, with playful lettering wishing a happy holiday", 864, 1080], ["t-heart", "Traubi post: a small bottle inside a heart made of grapes on moss, The first and the last love", 864, 1080]],
      meta: [["Project", "Traubi"], ["Discipline", "Social media campaign"]], cover: "Social media campaign",
      sections: [{ h: "Campaign", media: [["three", ["Post", "Post", "Post"]], ["full", ["Campaign overview"]]] }] },
    { id: "dalya", name: "Dalya", cat: "Playground", color: "#E0A9B6", behance: "250732059/Dalya-SocialMedia-Campaign",
      tags: ["Social media", "Campaign"], statement: "A social media campaign for Dalya.",
      reel: [["d-lemon", "Dalya post: a hand holding a green Fayrouza lemon soda over a pile of lemons", 864, 1080], ["d-movie", "Dalya post: popcorn, Fayrouza soda and a laptop on a yellow table for a movie night", 864, 1080], ["d-cartoon", "Dalya post: a ketchup crisps bag flying through a cartoon chase, Childhood memories with Dalya flavours", 864, 1080], ["d-stix", "Dalya post: Stix cheese snack sticks built into a maze on a green hill, The taste of fun", 864, 1080], ["d-otherworld", "Dalya post: a French cheese crisps bag in an enchanted forest with tiny witches and a cheese house, From another world", 864, 1080], ["d-top", "Dalya post: Top Dalya pineapple, mango and peach cans on a picnic blanket", 864, 1080], ["d-pufak", "Dalya post: Pufak peanut puffs bursting from the bag in a village of peanut houses, Rich crunchy peanut flavour", 864, 1080], ["d-pizza", "Dalya post: a boat with a pizza-slice sail and pizza crisps bags floating in the sea, A magical flavour", 864, 1080]],
      meta: [["Project", "Dalya"], ["Discipline", "Social media campaign"]], cover: "Social media campaign",
      sections: [{ h: "Campaign", media: [["three", ["Post", "Post", "Post"]], ["full", ["Campaign overview"]]] }] }
  ];
  var byId = {}; CASES.forEach(function (c, i) { c.i = i; byId[c.id] = c; });
  /* what each project can show in a reel: real screens where we have them, else its picture labels */
  R.caseReel = function (id) {
    var c = byId[id]; if (!c) return null;
    var imgs = [], labels = [];
    c.sections.forEach(function (sec) {
      (sec.shots || []).forEach(function (g) { if (g.t === "strip") g.items.forEach(function (it) { imgs.push([it[0], it[1]]); }); });
      (sec.figs || []).forEach(function (g) { g.items.forEach(function (it) { if (it[5] !== false) imgs.push(["f/" + c.id + "/" + it[0] + ".webp", it[1], it[3], it[4]]); }); });
      if (sec.screen2) imgs.push(["f/" + c.id + "/" + sec.screen2[0] + ".webp", sec.screen2[1], sec.screen2[2], sec.screen2[3]]);
      if (sec.screen) imgs.push(["f/" + c.id + "/" + sec.screen[0] + ".webp", sec.screen[1], sec.screen[2], sec.screen[3]]);
      (sec.media || []).forEach(function (m) { m[1].forEach(function (l) { if (labels.indexOf(l) < 0 && !/^(Screen|Post|Work|Detail|Application)$/.test(l)) labels.push(l); }); });
    });
    if (c.coverImg) imgs.unshift(["f/" + c.id + "/" + c.coverImg[0] + ".webp", c.coverImg[1], c.coverImg[2], c.coverImg[3]]);
    if (c.reel) imgs = c.reel.map(function (it) { return ["f/" + c.id + "/" + it[0] + ".webp", it[1], it[2], it[3]]; });
    return { imgs: imgs, labels: labels, tags: c.tags, color: c.color, behance: c.link || (c.behance ? BE + c.behance : ""), link: c.link || "" };   /* link: a project page outside Behance */
  };

  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  var ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#imgIco"/></svg>';
  var ARR = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#arrUR"/></svg>';
  function media(kind, labels) {
    return '<div class="cs-media ' + kind + '">' + labels.map(function (l) {
      return '<figure class="pimg cs-shot"><span class="ph-in">' + ICO + "<em>" + esc(l) + "</em></span></figure>";
    }).join("") + "</div>";
  }
  var KIND = { context: "Context", value: "Why it matters", problem: "Problem", goals: "Goals", scenarios: "User scenarios", research: "Research", insight: "Insight",
    options: "Options weighed", solution: "Solution", system: "Design system", before: "Before and after", measure: "Measuring success", impact: "Result", learn: "Reflection" };
  /* every case reads as an analysis (Oct 26, after a reference Doha shared): problem → process → solution → result.
     Each section kind belongs to one of those four phases; the outline at the top follows them. */
  var PHASE = { context: "problem", value: "problem", problem: "problem", goals: "problem", scenarios: "problem",
    research: "process", insight: "process", options: "process", solution: "solution", system: "solution", before: "solution",
    measure: "result", impact: "result", learn: "result" };
  var JUMP = [["problem", "Problem"], ["process", "Process"], ["solution", "Solution"], ["result", "Result"]];
  /* real screens in a phone frame (Halan, Oct 25) */
  var SHOT = "f/halan/";
  function phone(src, cap) {
    return '<figure class="cs-phone"><span class="pf"><img src="' + SHOT + src + '.webp" alt="' + esc(cap || src.replace(/-/g, " ")) + '" decoding="async"></span></figure>';   /* no captions under pictures (Doha, Nov 2) */
  }
  function shots(g) {
    if (g.t === "anim") return '<figure class="cs-phone cs-anim" data-anim="1"><span class="pf">' + g.items.map(function (it, i) {
      return '<img src="' + SHOT + it[0] + '.webp" alt="' + (i ? "" : esc(g.cap || "")) + '"' + (i ? ' aria-hidden="true"' : "") + ' class="' + (i ? "" : "on") + '" decoding="async">'; }).join("") + "</span>" + (g.cap ? "<figcaption>" + esc(g.cap) + "</figcaption>" : "") + "</figure>";
    return '<div class="cs-strip" tabindex="0" role="group" aria-label="Screens">' + g.items.map(function (it) { return phone(it[0], it[1]); }).join("") + "</div>";
  }
  /* ---- live motion, rebuilt from the Figma prototype (Halan, Oct 25).
     Timings and cubic-beziers are the ones set on each Smart Animate step. */
  var DEMO_CAP = { "otp-b": "Take B \u00b7 digits lift in turn, then a toast", "otp-a": "Take A \u00b7 digits fold into a check", envelope: "Success \u00b7 the card is posted" };
  function demoHTML(k) {
    var inner;
    if (k === "envelope") inner = '<div class="dm-env"><div class="ev-wrap"><i class="ev-back"></i><img class="ev-card" src="' + SHOT + 'card.webp" alt=""><svg class="ev-front" viewBox="0 0 200 128" aria-hidden="true"><defs><linearGradient id="evg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1CCB86" stop-opacity=".92"/><stop offset="1" stop-color="#00A970" stop-opacity=".92"/></linearGradient></defs><path d="M0 0 L100 70 L200 0 V128 H0 Z" fill="url(#evg)" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/><path d="M0 128 L84 60 M200 128 L116 60" stroke="rgba(255,255,255,.4)" stroke-width="1.2" fill="none"/></svg><svg class="ev-flap" viewBox="0 0 200 80" aria-hidden="true"><path d="M0 0 H200 L108 72 Q100 78 92 72 Z" fill="#2fd497" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/></svg></div></div>';
    else {
      var boxes = ""; for (var i = 0; i < 6; i++) boxes += '<i class="ob" style="--i:' + i + '">7</i>';
      inner = '<div class="dm-otp ' + k + '"><p class="ot-t">Verify your number</p><p class="ot-s">Please enter the verification code sent to your number.</p><div class="ot-row">' + boxes + '<b class="ot-check" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#16A06A"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></b></div><p class="ot-r">Didn\u2019t get a code? <b>Resend</b></p>' +
        (k === "otp-b" ? '<p class="ot-toast"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fff" fill-opacity=".25"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Code Verified</p>' : "") + "</div>";
    }
    return '<figure class="cs-demo" data-demo="' + k + '"><div class="dm-stage">' + inner + '</div><figcaption><span>' + esc(DEMO_CAP[k]) + '</span><button class="dm-replay" type="button" aria-label="Replay: ' + esc(DEMO_CAP[k]) + '">Replay</button></figcaption></figure>';
  }
  var BZ = function (a, b, c, d) { return "cubic-bezier(" + [a, b, c, d].join(",") + ")"; };
  function anim(el, kf, o) { return el.animate(kf, Object.assign({ fill: "forwards" }, o)); }
  var PLAY = {
    "otp-b": function (st) {                                     /* OTP variants 1→7: ease-out 0.5 s each */
      var bs = $$(".ob", st), toast = $(".ot-toast", st), T = 0;
      bs.forEach(function (b, i) {
        anim(b, [{ transform: "none", borderColor: "#E6E6E3" }, { transform: "translateY(-8px)", borderColor: "#16A06A", offset: .45 }, { transform: "none", borderColor: "#16A06A" }], { duration: 500, delay: i * 500, easing: "ease-out" });
      });
      T = 3100;                                                  /* the screen moves to the toast state after 3 s */
      anim(toast, [{ transform: "translate(-50%,-140%)", opacity: 0 }, { transform: "translate(-50%,0)", opacity: 1 }], { duration: 300, delay: T, easing: "ease-out" });
      return T + 1800;
    },
    "otp-a": function (st) {
      var bs = $$(".ob", st), ck = $(".ot-check", st);
      bs.forEach(function (b, i) { b.style.borderColor = "#16A06A"; });
      bs.forEach(function (b, i) {                               /* 0.05 s hold, wobble ease-in 0.2 s */
        anim(b, [{ transform: "none" }, { transform: "rotate(" + (i % 2 ? 9 : -9) + "deg) translateY(" + (i % 2 ? -3 : 3) + "px)" }], { duration: 200, delay: 600, easing: "ease-in" });
        /* fold into the middle, custom bezier 0.5 s */
        anim(b, [{ transform: "rotate(" + (i % 2 ? 9 : -9) + "deg)", opacity: 1 }, { transform: "translateX(" + ((2.5 - i) * 60) + "px) scale(.4)", opacity: 0 }], { duration: 500, delay: 900, easing: BZ(.61, 0, .29, .99) });
      });
      anim(ck, [{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.25)", opacity: 1, offset: .6 }, { transform: "translate(-50%,-50%) scale(1.15)", opacity: 1 }], { duration: 500, delay: 1150, easing: BZ(.61, 0, .43, 1.11) });
      anim(ck, [{ transform: "translate(-50%,-50%) scale(1.15)" }, { transform: "translate(-50%,-50%) scale(.85)" }], { duration: 500, delay: 1750, easing: BZ(.53, -.01, .42, 1.02) });
      return 3600;
    },
    envelope: function (st) {                                    /* envelop+card 1:14317, eight variants */
      var w = $(".ev-wrap", st), card = $(".ev-card", st), fr = $(".ev-front", st), back = $(".ev-back", st), flap = $(".ev-flap", st);
      [fr, back, flap].forEach(function (x) { x.style.opacity = 0; });
      anim(card, [{ transform: "translate(-260%,-18%) scale(1.45)" }, { transform: "translate(0,-18%) scale(1.45)" }], { duration: 600, easing: BZ(.61, 0, .29, .99) });                       /* slides in */
      anim(card, [{ transform: "translate(0,-18%) scale(1.45)" }, { transform: "translate(0,-46%) scale(.86)" }], { duration: 600, delay: 1000, easing: BZ(.61, 0, .43, 1.11) });          /* shrinks over the envelope */
      [fr, back, flap].forEach(function (x) { anim(x, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 1100 }); });
      anim(card, [{ transform: "translate(0,-46%) scale(.86)" }, { transform: "translate(0,6%) scale(.86)" }], { duration: 500, delay: 1800, easing: BZ(.53, -.01, .42, 1.02) });          /* drops into the pocket */
      anim(flap, [{ transform: "rotateX(180deg)" }, { transform: "rotateX(0deg)" }], { duration: 500, delay: 2500, easing: BZ(.53, -.01, .38, 1.05) });                                  /* flap closes */
      setTimeout(function () { flap.style.zIndex = 4; }, 2700);
      anim(w, [{ transform: "none" }, { transform: "rotate(-22deg)" }], { duration: 300, delay: 3200, easing: BZ(.93, .01, .33, 1.02) });                                                  /* tips 22 deg */
      anim(w, [{ transform: "rotate(-22deg)" }, { transform: "rotate(-22deg) translate(30%,-260%)" }], { duration: 600, delay: 3900, easing: BZ(.53, -.01, .38, 1.05) });                  /* flies off */
      return 5200;
    }
  };
  var demoT = [];
  function resetDemo(f) {
    $$("*", f).forEach(function (x) { if (x.getAnimations) x.getAnimations().forEach(function (a) { a.cancel(); }); x.style.removeProperty("opacity"); x.style.removeProperty("border-color"); x.style.removeProperty("z-index"); });
  }
  function playDemo(f, loop) {
    var k = f.getAttribute("data-demo"); resetDemo(f);
    if (reduced) { f.classList.add("still"); return; }
    var d = PLAY[k](f);
    if (loop) demoT.push(setTimeout(function () { if (f.isConnected && page.classList.contains("open")) playDemo(f, true); }, d + 1400));
  }
  function runDemos() {
    demoT.forEach(clearTimeout); demoT = [];
    var fs = $$(".cs-demo", page); if (!fs.length) return;
    if (!("IntersectionObserver" in window)) { fs.forEach(function (f) { playDemo(f, true); }); return; }
    var dio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { dio.unobserve(e.target); playDemo(e.target, true); } }); }, { root: page, threshold: .4 });
    fs.forEach(function (f) { dio.observe(f); });
  }
  page.addEventListener("click", function (e) { var b = e.target.closest(".dm-replay"); if (!b) return; var f = b.closest(".cs-demo"); demoT.forEach(clearTimeout); demoT = []; playDemo(f, false); });

  /* a gap Rofaida still has to fill: visible on purpose, so nothing is invented */
  /* real boards and screens (Sadeem, Oct 26): white cards with the picture and an optional caption.
     items: [file, alt, caption, width, height, inReel] from f/<case id>/ */
  function fig1(it, id, cls) {
    var img = '<img src="f/' + id + "/" + it[0] + '.webp" alt="' + esc(it[1]) + '"' + (it[3] ? ' width="' + it[3] + '" height="' + it[4] + '"' : "") + ' decoding="async" loading="lazy"' + (it[3] && it[3] < 700 ? ' style="max-width:' + it[3] + 'px"' : "") + ">";
    return '<figure class="cs-fig' + (cls ? " " + cls : "") + '">' + (cls === "phone" ? '<div class="ph-scroll" tabindex="0" aria-label="' + esc(it[2] || it[1]) + ', scrolls">' + img + "</div>" : img) +
      "</figure>";
  }
  function figs(g, id) {
    /* pair (Sadeem, Oct 28): the big screens stacked on the left, the phone beside them; a phone taller than its row scrolls inside its frame */
    if (g.g === "pair") { var last = g.items[g.items.length - 1];
      return '<div class="cs-figs pair"><div class="pr-main">' + g.items.slice(0, -1).map(function (it) { return fig1(it, id); }).join("") + "</div>" + fig1(last, id, "phone") + "</div>"; }
    return '<div class="cs-figs ' + (g.g || "one") + '">' + g.items.map(function (it) { return fig1(it, id); }).join("") + "</div>";
  }
  function video(v, id) {
    /* WebM first (plays in every browser, incl. builds without H.264), MP4 as the fallback */
    var base = "f/" + id + "/" + v.src.replace(/\.mp4$/, "");
    return '<div class="cs-figs ' + (v.g || "one") + '"><figure class="cs-fig cs-vid"><video poster="f/' + id + "/" + v.poster + '" muted loop playsinline preload="metadata"' + (reduced ? "" : " autoplay") +
      ' aria-label="' + esc(v.alt) + '"' + (v.w ? ' width="' + v.w + '" height="' + v.h + '"' : "") + '><source src="' + base + '.webm" type="video/webm"><source src="' + base + '.mp4" type="video/mp4"></video>' + (v.cap ? "<figcaption>" + esc(v.cap) + "</figcaption>" : "") + "</figure></div>";   /* video captions stay (Doha) */
  }
  /* a comparison table: ✓ / ✗ cells read aloud as yes / no */
  function tableHTML(t) {
    return '<div class="cs-table-wrap"><table class="cs-table"><thead><tr>' + t.head.map(function (x) { return '<th scope="col">' + esc(x) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      t.rows.map(function (r) { return "<tr>" + r.map(function (x, i) { return i ? '<td class="' + (x === "\u2713" ? "yes" : x === "\u2717" ? "no" : "") + '"><span aria-hidden="true">' + esc(x) + '</span><span class="sr">' + (x === "\u2713" ? "yes" : x === "\u2717" ? "no" : esc(x)) + "</span></td>" : '<th scope="row">' + esc(x) + "</th>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  /* chip groups; a filled chip is a primary goal */
  function tiersHTML(ts) {
    return '<div class="cs-tiers">' + ts.map(function (g) {
      return '<div class="ct-g">' + (g.h ? '<p class="ct-h">' + esc(g.h) + "</p>" : "") + '<ul>' + g.items.map(function (it) { return '<li' + (it[1] ? ' class="on"' : "") + ">" + esc(it[0]) + (it[1] ? '<span class="sr"> (primary)</span>' : "") + "</li>"; }).join("") + "</ul></div>"; }).join("") + "</div>";
  }
  /* competitors: strengths and weaknesses side by side */
  function competeHTML(cs) {
    return '<div class="cs-compete">' + cs.map(function (c) {
      return '<article class="cc"><header><b>' + esc(c.name) + "</b>" + (c.note ? "<small>" + esc(c.note) + "</small>" : "") + "</header>" +
        '<div class="cc-col cc-s"><p>Strengths</p><ul>' + c.strong.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
        '<div class="cc-col cc-w"><p>Weaknesses</p><ul>' + c.weak.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div></article>"; }).join("") + "</div>";
  }
  /* information architecture: the entry flow, then one column per tab */
  function iaItems(items) {
    return "<ul>" + items.map(function (it) { return typeof it === "string" ? "<li>" + esc(it) + "</li>" : '<li class="ia-sub"><b>' + esc(it.h) + "</b>" + iaItems(it.items) + "</li>"; }).join("") + "</ul>";
  }
  function iaHTML(ia) {
    var h = '<div class="cs-ia"><ol class="ia-entry" aria-label="Entry flow">' + ia.entry.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ol>";
    h += '<div class="ia-tabs">' + ia.tabs.map(function (t, i) {
      var body = t.items ? iaItems(t.items) : t.groups.map(function (g) { return '<div class="ia-grp"><p>' + esc(g.h) + "</p>" + iaItems(g.items) + "</div>"; }).join("");
      return '<section class="ia-tab"><h4><i>' + (i + 1) + "</i>" + esc(t.h) + "</h4>" + body + "</section>"; }).join("") + "</div></div>";
    return h;
  }
  /* phone screens in a row, then the decisions behind them and a takeaway (Dhi, Nov 2).
     phones: [file, alt, caption, w, h]; a screen taller than a phone scrolls inside its frame */
  function phonesHTML(s, id) {
    var h = '<div class="cs-phones n' + s.phones.length + '">' + s.phones.map(function (p, i) {
      var tall = p[4] / p[3] > 2.3, img = '<img src="f/' + id + "/" + p[0] + '.webp" alt="' + esc(p[1]) + '" width="' + p[3] + '" height="' + p[4] + '" decoding="async" loading="lazy">';
      return '<figure class="cs-phone' + (tall ? " tall" : "") + '">' + (tall ? '<div class="ph-frame" tabindex="0" aria-label="' + esc(p[2]) + ', scrolls">' + img + '</div><span class="ph-hint" aria-hidden="true">Scroll</span>' : img) +
        "</figure>"; }).join("") + "</div>";
    if (s.notes) h += '<div class="cs-phnotes"><p class="sc-lbl">' + s.notes.length + ' design decisions</p><ol class="sc-notes">' + s.notes.map(function (n) { return "<li><b>" + esc(n[0]) + "</b><span>" + esc(n[1]) + "</span></li>"; }).join("") + "</ol>" +
      (s.take ? '<p class="sc-take"><small>Takeaway</small>' + esc(s.take) + "</p>" : "") + "</div>";
    return h;
  }
  /* a clean product screen with the decisions behind it, numbered, and the takeaway (Maaliy, Oct 28):
     screen: [file, alt, w, h]; notes: [[decision, why]]; take: one line */
  function screenHTML(s, id) {
    var sc = s.screen;
    return '<div class="cs-screen' + (sc ? "" : " no-img") + '">' + (sc ? '<figure class="sc-fig"><img src="f/' + id + "/" + sc[0] + '.webp" alt="' + esc(sc[1]) + '" width="' + sc[2] + '" height="' + sc[3] + '" decoding="async" loading="lazy">' + (s.screen2 ? '<img class="sc-2" src="f/' + id + "/" + s.screen2[0] + '.webp" alt="' + esc(s.screen2[1]) + '" width="' + s.screen2[2] + '" height="' + s.screen2[3] + '" decoding="async" loading="lazy">' : "") + "</figure>" : "") +
      '<div class="sc-side"><p class="sc-lbl">' + (s.notes ? s.notes.length + " design decisions" : "Design decisions") + "</p>" +
      (s.notes ? '<ol class="sc-notes">' + s.notes.map(function (n) { return "<li><b>" + esc(n[0]) + "</b><span>" + esc(n[1]) + "</span></li>"; }).join("") + "</ol>" : "") +
      (s.take ? '<p class="sc-take"><small>Takeaway</small>' + esc(s.take) + "</p>" : "") + "</div></div>";
  }
  /* flat IA (Maaliy): one numbered sidebar rail, the pages inside each item as chips, the client door beside it */
  function iaFlatHTML(f) {
    var h = '<div class="cs-iaf"><ol class="ia-entry" aria-label="Entry flow">' + f.entry.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ol>";
    h += '<div class="iaf-cols"><section class="iaf-rail"><header><b>' + esc(f.main.h) + "</b><small>" + esc(f.main.sub) + '</small><span class="iaf-count">' + f.main.items.length + " items · one level</span></header><ol>" +
      f.main.items.map(function (it, i) { return '<li><i>' + ("0" + (i + 1)).slice(-2) + "</i><b>" + esc(it[0]) + '</b><span class="iaf-in">' +
        (it[1] ? it[1].map(function (x) { return "<em>" + esc(x) + "</em>"; }).join("") : '<em class="one">One page</em>') + "</span></li>"; }).join("") + "</ol></section>";
    h += '<div class="iaf-aside"><section class="iaf-rail portal"><header><b>' + esc(f.portal.h) + "</b><small>" + esc(f.portal.sub) + '</small></header><ol>' +
      f.portal.items.map(function (x, i) { return "<li><i>" + ("0" + (i + 1)).slice(-2) + "</i><b>" + esc(x) + "</b></li>"; }).join("") + "</ol></section>" +
      (f.bell ? '<section class="iaf-bell"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5ZM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg><b>' + esc(f.bell[0]) + "</b><small>" + esc(f.bell[1]) + "</small></section>" : "") +
      (f.note ? '<p class="iaf-note">' + esc(f.note) + "</p>" : "") + "</div></div></div>";
    return h;
  }
  /* personas as folder tabs: one card at a time, like the board (Dhi) */
  function personaHTML(ps, cid) {
    var h = '<div class="cs-pers"><div class="pr-tabs" role="tablist" aria-label="Personas">' + ps.map(function (p, i) {
      return '<button type="button" role="tab" id="pt-' + cid + i + '" aria-controls="pp-' + cid + i + '" aria-selected="' + (i === 0) + '" tabindex="' + (i ? -1 : 0) + '">' + esc(p.name) + '<span class="pr-ar" lang="ar" aria-hidden="true">' + esc(p.ar) + "</span></button>"; }).join("") + "</div>";
    h += ps.map(function (p, i) {
      var list = function (xs) { return "<ul>" + xs.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };
      var chips = function (xs) { return '<p class="pr-chips">' + xs.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</p>"; };
      return '<div class="pr-card" role="tabpanel" id="pp-' + cid + i + '" aria-labelledby="pt-' + cid + i + '"' + (i ? " hidden" : "") + ">" +
        '<header><b>' + esc(p.name) + '</b><span class="pr-age">' + p.age + " \u00b7 " + esc(p.life) + "</span></header>" +
        '<p class="pr-story">' + esc(p.story) + "</p>" +
        '<div class="pr-grid"><div class="pr-box pr-goals"><small>Goals</small>' + list(p.goals) + '</div><div class="pr-box pr-pains"><small>Frustrations</small>' + list(p.pains) + "</div>" +
        '<div class="pr-box"><small>Pays with</small>' + chips(p.pays) + '</div><div class="pr-box"><small>Shops at</small>' + chips(p.uses) + "</div></div></div>"; }).join("");
    return h + "</div>";
  }
  function personaPick(tab, focus) {
    var w = tab.closest(".cs-pers"); if (!w) return;
    $$(".pr-tabs [role=tab]", w).forEach(function (t) { var on = t === tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; document.getElementById(t.getAttribute("aria-controls")).hidden = !on; });
    if (focus) tab.focus();
  }
  page.addEventListener("click", function (e) { var t = e.target.closest(".pr-tabs [role=tab]"); if (t) personaPick(t); });
  page.addEventListener("keydown", function (e) {
    var t = e.target.closest && e.target.closest(".pr-tabs [role=tab]"); if (!t) return;
    var ts = $$("[role=tab]", t.parentNode), i = ts.indexOf(t), n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % ts.length; else if (e.key === "ArrowLeft") n = (i - 1 + ts.length) % ts.length; else if (e.key === "Home") n = 0; else if (e.key === "End") n = ts.length - 1;
    if (n >= 0) { e.preventDefault(); personaPick(ts[n], true); }
  });
  function todo(t) { return '<p class="cs-todo"><b>To add</b>' + esc(t) + "</p>"; }
  var animT = 0;
  function runAnims() {
    clearInterval(animT);
    var as = $$(".cs-anim", page); if (!as.length) return;
    if (reduced) { as.forEach(function (a) { var im = $$("img", a); im.forEach(function (x, i) { x.classList.toggle("on", i === im.length - 1); }); }); return; }
    var k = 0;
    animT = setInterval(function () {
      if (!page.classList.contains("open")) { clearInterval(animT); return; }
      k++;
      as.forEach(function (a) { var im = $$("img", a), n = im.length, step = k % (n + 2); im.forEach(function (x, i) { x.classList.toggle("on", i === Math.min(step, n - 1)); }); });
    }, 850);
  }
  function render(c) {
    /* "Next up" walks only projects with a page on this site; Graphics projects open on Behance instead */
    var n = CASES[(c.i + 1) % CASES.length], num = ("00" + (c.i + 1)).slice(-3);
    for (var k = 1; k < CASES.length && n.cat !== "Product"; k++) n = CASES[(c.i + 1 + k) % CASES.length];
    var h = '<div class="cs-in" style="--ph:' + c.color + '">';
    h += '<div class="cs-bar"><button class="glass-btn cs-back" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Back to all works</button>' +
         '<span class="cs-crumb">' + num + " &middot; " + esc(c.cat) + "</span></div>";
    h += '<header class="cs-hero"><ul class="cs-tags">' + c.tags.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
         '<h2 class="cs-title" id="csTitle">' + esc(c.name) + '</h2><p class="cs-statement">' + esc(c.statement) + "</p></header>";
    h += '<dl class="cs-meta">' + c.meta.map(function (m) { return "<div><dt>" + esc(m[0]) + "</dt><dd>" + esc(m[1]) + "</dd></div>"; }).join("") + "</dl>";
    /* at a glance: the whole story in three cards, for people who only have a minute */
    if (c.tldr) h += '<section class="cs-tldr" aria-label="At a glance"><p class="cs-lbl">At a glance</p><ol>' + c.tldr.map(function (t, i) {
      return '<li class="t' + i + '"><b>' + esc(t[0]) + "</b>" + (t[1].indexOf("todo:") === 0 ? todo(t[1].slice(5)) : "<p>" + esc(t[1]) + "</p>") + "</li>"; }).join("") + "</ol></section>";
    var kinds = {}; c.sections.forEach(function (s) { if (s.k) kinds[PHASE[s.k]] = 1; });
    var jumps = JUMP.filter(function (j) { return kinds[j[0]]; });
    if (jumps.length > 2) h += '<nav class="cs-jump" aria-label="Parts of this case study">' + jumps.map(function (j, i) { return '<a href="#cs-' + c.id + "-" + j[0] + '" data-jump="' + j[0] + '"><i>' + (i + 1) + "</i>" + j[1] + "</a>"; }).join("") + "</nav>";
    if (c.coverImg) h += '<figure class="cs-cover has-img"><img src="f/' + c.id + "/" + c.coverImg[0] + '.webp" alt="' + esc(c.coverImg[1]) + '" width="' + c.coverImg[2] + '" height="' + c.coverImg[3] + '" decoding="async"></figure>';
    else if (!c.noCover) h += '<figure class="cs-cover pimg"><span class="aw-cover"><b>' + esc(c.cover) + "</b><small>" + esc(c.name) + "</small></span></figure>";
    if (c.stats) h += '<ul class="cs-stats">' + c.stats.map(function (s) { return "<li><b>" + esc(s[0]) + "</b><span>" + esc(s[1]) + "</span></li>"; }).join("") + "</ul>";
    var seen = {};
    c.sections.forEach(function (s, k) {
      var ph = s.k && PHASE[s.k], anchor = ph && !seen[ph] ? ' id="cs-' + c.id + "-" + ph + '"' : ""; if (ph) seen[ph] = 1;
      h += '<section class="cs-sec' + (s.k ? " k-" + s.k : "") + '"' + (ph ? ' data-phase="' + ph + '"' : "") + anchor + '><p class="cs-lbl">' + ("0" + (k + 1)).slice(-2) + (s.k ? '<span class="cs-kind">' + KIND[s.k] + "</span>" : "") + '</p><div class="cs-body"><h3>' + esc(s.h) + "</h3>";
      /* the root cause, in one bold sentence */
      if (s.lead) h += '<p class="cs-lead">' + esc(s.lead) + "</p>";
      if (s.insight) h += '<p class="cs-insight">' + esc(s.insight) + "</p>";
      if (s.table) h += tableHTML(s.table);
      (s.p || []).forEach(function (p) { h += "<p>" + esc(p) + "</p>"; });
      if (s.tiers) h += tiersHTML(s.tiers);
      if (s.insight2) h += '<p class="cs-insight">' + esc(s.insight2) + "</p>";
      if (s.compete) h += competeHTML(s.compete);
      if (s.table2) h += tableHTML(s.table2);
      if (s.ia) h += iaHTML(s.ia);
      if (s.iaflat) h += iaFlatHTML(s.iaflat);
      if (s.list) h += '<ol class="cs-list">' + s.list.map(function (it) { return "<li><b>" + esc(it[0]) + "</b><span>" + esc(it[1]) + "</span></li>"; }).join("") + "</ol>";
      if (s.find) h += '<ul class="cs-find">' + s.find.map(function (f) { return '<li><small>' + esc(f[0]) + "</small><b>" + esc(f[1]) + "</b>" + (f[2] ? "<span>" + esc(f[2]) + "</span>" : "") + "</li>"; }).join("") + "</ul>";
      if (s.persona) h += personaHTML(s.persona, c.id);
      if (s.personas) h += '<ul class="cs-personas">' + s.personas.map(function (q) { return '<li><b>' + esc(q[0]) + "</b><small>" + esc(q[1]) + "</small><span>" + esc(q[2]) + "</span></li>"; }).join("") + "</ul>";
      /* pairs: Problem → Decision → Why by default; pairLbl renames them, and a pair with no third part shows two columns */
      if (s.pairs) { var PL = s.pairLbl || ["Problem", "Decision", "Why"];
        h += '<ol class="cs-pairs' + (s.pairs[0].length < 3 ? " two" : "") + '">' + s.pairs.map(function (q) {
        return '<li><div class="pp"><small>' + esc(PL[0]) + '</small><p>' + esc(q[0]) + '</p></div><div class="pd"><small>' + esc(PL[1]) + '</small><p>' + esc(q[1]) + "</p></div>" + (q[2] ? '<div class="pw"><small>' + esc(PL[2]) + "</small><p>" + esc(q[2]) + "</p></div>" : "") + "</li>"; }).join("") + "</ol>"; }
      if (s.flow) h += '<div class="cs-flow"><small>' + esc(s.flowLbl || "Flow") + '</small><ol>' + s.flow.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ol></div>";
      if (s.swatches) h += '<ul class="cs-swatches">' + s.swatches.map(function (w) { return '<li><i style="background:' + w[0] + '"></i><b>' + esc(w[0]) + "</b><span>" + esc(w[1]) + "</span></li>"; }).join("") + "</ul>";
      if (s.compare) h += '<div class="cs-compare">' + [s.compare.a, s.compare.b].map(function (v) { return '<div>' + phone(v[0], "") + '<p class="cv-t">' + esc(v[1]) + '</p><p class="cv-d">' + esc(v[2]) + "</p></div>"; }).join("") + "</div>";
      if (s.motion) h += '<ul class="cs-motion-notes">' + s.motion.map(function (m) { return "<li><b>" + esc(m[0]) + "</b><span>" + esc(m[1]) + "</span></li>"; }).join("") + "</ul>";
      if (s.goals) h += '<ol class="cs-goals">' + s.goals.map(function (g) { return "<li>" + esc(g) + "</li>"; }).join("") + "</ol>";
      if (s.scenarios) h += '<ul class="cs-scen">' + s.scenarios.map(function (q) { return "<li><small>" + esc(q[0]) + "</small><p>" + esc(q[1]) + "</p></li>"; }).join("") + "</ul>";
      /* options weighed: [label, what it was, "chosen" | "rejected", why] */
      if (s.options) h += '<ol class="cs-options">' + s.options.map(function (o) {
        return '<li class="op-' + o[2] + '"><div class="op-top"><b>' + esc(o[0]) + '</b><span class="op-tag">' + (o[2] === "chosen" ? "Chosen" : "Rejected") + "</span></div><p>" + esc(o[1]) + '</p><p class="op-why">' + esc(o[3]) + "</p></li>"; }).join("") + "</ol>";
      /* a design challenge, worked through in steps */
      (s.challenges || []).forEach(function (ch) {
        h += '<div class="cs-chal"><p class="ch-h"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 9.5v4.5M12 16.8v.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg><b>Design challenge</b> ' + esc(ch.h) + '</p><ol>' +
          ch.steps.map(function (st) { return "<li>" + esc(st) + "</li>"; }).join("") + "</ol></div>"; });
      /* before and after: [what changed, before, after] */
      if (s.ba) h += '<div class="cs-ba" role="table" aria-label="Before and after"><div class="ba-r ba-h" role="row"><span role="columnheader"></span><span role="columnheader">Before</span><span role="columnheader">After</span></div>' + s.ba.map(function (r) {
        return '<div class="ba-r" role="row"><b role="rowheader">' + esc(r[0]) + '</b><span role="cell" class="ba-b">' + esc(r[1]) + '</span><span role="cell" class="ba-a">' + esc(r[2]) + "</span></div>"; }).join("") + "</div>";
      /* how success is measured: [metric, how, target] */
      if (s.measure) h += '<ul class="cs-measure">' + s.measure.map(function (m) { return '<li><small>' + esc(s.measureLbl || "Expected") + "</small><b>" + esc(m[0]) + "</b><p>" + esc(m[1]) + "</p>" + (m[2] ? '<p class="ms-t"><span>Target</span> ' + esc(m[2]) + "</p>" : "") + "</li>"; }).join("") + "</ul>";
      if (s.todo) h += todo(s.todo);
      if (s.todo2) h += todo(s.todo2);
      if (s.impact) h += '<ul class="cs-impact">' + s.impact.map(function (m) { return '<li class="i-' + m[0].toLowerCase() + '"><small>' + esc(m[0]) + "</small><p>" + esc(m[1]) + "</p></li>"; }).join("") + "</ul>";
      h += "</div></section>";
      if (s.quote) h += '<blockquote class="cs-quote">' + esc(s.quote) + "</blockquote>";
      (s.media || []).forEach(function (m) { h += media(m[0], m[1]); });
      (s.shots || []).forEach(function (g) { h += shots(g); });
      if (s.video) h += video(s.video, c.id);
      (s.figs || []).forEach(function (g) { h += figs(g, c.id); });
      if (s.phones) h += phonesHTML(s, c.id);
      else if (s.screen || s.take) h += screenHTML(s, c.id);
      /* the callouts printed on a board, as real text: read aloud everywhere, shown on phones where the board is too small to read */
      else if (s.notes) h += '<ul class="cs-notes">' + s.notes.map(function (n) { return "<li><b>" + esc(n[0]) + "</b> " + esc(n[1]) + "</li>"; }).join("") + "</ul>";
      /* type specimens, set in the real fonts */
      if (s.type) h += '<ul class="cs-type">' + s.type.map(function (t) { return '<li><span class="ty-aa" style="font-family:' + t.font + '" lang="' + (t.lang || "en") + '"' + (t.lang === "ar" ? ' dir="rtl"' : "") + ">" + esc(t.aa) + '</span><b>' + esc(t.name) + "</b><small>" + esc(t.role) + '</small><span class="ty-s" style="font-family:' + t.font + '"' + (t.lang === "ar" ? ' dir="rtl" lang="ar"' : "") + ">" + esc(t.sample) + "</span></li>"; }).join("") + "</ul>";
      if (s.demo) h += '<div class="cs-demos">' + s.demo.map(demoHTML).join("") + "</div>";
    });
    if (c.behance) h += '<p class="cs-ref"><a class="cs-behance" href="' + BE + c.behance + '" target="_blank" rel="noopener">See the full case study on Behance ' + ARR + "</a></p>";
    else h += '<p class="cs-ref cs-nda">The full Figma flows are company work. Happy to walk through them in a call.</p>';
    h += '<a class="cs-next" href="#" data-next="' + n.id + '" style="--nph:' + n.color + '"><span class="cs-next-lbl">Next up</span><span class="cs-next-name">' + esc(n.name) + "</span>" + ARR + "</a>";
    h += "</div>";
    h += '<footer class="sky-end sky-hid" style="--from:var(--cream)" aria-label="Footer"><div class="sky-glass"><p>Sky has no limits.</p></div></footer>';
    page.innerHTML = h;
    page.setAttribute("aria-label", c.name + " case study");
    if (R.editScope) R.editScope(page, "c" + c.id);
    reveal(); runAnims(); runDemos(); markPhase();
  }
  /* jump links scroll the case page itself (it is its own scroller) */
  page.addEventListener("click", function (e) {
    var a = e.target.closest("[data-jump]"); if (!a) return;
    e.preventDefault();
    var t = document.getElementById(a.getAttribute("href").slice(1)); if (!t) return;
    page.scrollTo({ top: t.offsetTop - 80, behavior: reduced ? "auto" : "smooth" });
    t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true });
  });

  /* ---- scroll reveal: watch everything below the hero, inside this page */
  var io = null;
  function countUp(el) {
    var b = el.querySelector("b"), m = b && /^(\d+)(.*)$/.exec(b.textContent);
    if (!m || reduced) return;
    var to = +m[1], tail = m[2], t0 = performance.now(), D = 1100;
    (function step(now) {
      var k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      b.textContent = Math.round(to * e) + tail;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function reveal() {
    if (io) io.disconnect();
    var els = $$(".cs-tldr li, .cs-cover, .cs-stats li, .cs-sec, .cs-quote, .cs-shot, .cs-strip, .cs-anim, .cs-fig, .cs-ref, .cs-next", page);
    els.forEach(function (el) {
      el.classList.add("rv");
      var sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      if (el.classList.contains("cs-shot") || el.parentElement.classList.contains("cs-stats") || el.closest(".cs-tldr")) el.style.setProperty("--rd", (sib * 0.09).toFixed(2) + "s");
    });
    if (reduced || !("IntersectionObserver" in window)) { page.classList.remove("rv-on"); els.forEach(function (el) { el.classList.add("in"); }); return; }
    page.classList.add("rv-on");
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in"); io.unobserve(e.target);
        if (e.target.parentElement && e.target.parentElement.classList.contains("cs-stats")) countUp(e.target);
      });
    }, { root: page, rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
    sweep = function () {                     /* a fast fling can jump clean past a part: */
      var lim = page.clientHeight * 0.92;      /* anything already above the fold arrives too */
      els.forEach(function (el) {
        if (el.classList.contains("in")) return;
        if (el.getBoundingClientRect().top < lim) {
          el.classList.add("in"); io.unobserve(el);
          if (el.parentElement && el.parentElement.classList.contains("cs-stats")) countUp(el);
        }
      });
    };
  }
  var sweep = null, sweepQ = 0;
  /* the outline marks the phase you are reading */
  function markPhase() {
    var nav = $(".cs-jump", page); if (!nav) return;
    var secs = $$(".cs-sec[data-phase]", page), cur = "", line = page.getBoundingClientRect().top + page.clientHeight * 0.35;
    secs.forEach(function (sc) { if (sc.getBoundingClientRect().top <= line) cur = sc.getAttribute("data-phase"); });
    $$("a", nav).forEach(function (a) { var on = a.getAttribute("data-jump") === cur; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current"); });
  }
  page.addEventListener("scroll", markPhase, { passive: true });
  page.addEventListener("scroll", function () {
    if (!sweep || sweepQ) return;
    sweepQ = requestAnimationFrame(function () { sweepQ = 0; sweep(); });
  }, { passive: true });

  var prev = "works", cur = null, busy = false;
  function open(id, from) {
    var c = byId[id]; if (!c || busy) return;
    var m = site.getAttribute("data-mode");
    if (m !== "case") prev = m === "all" ? "all" : "works";
    render(c); cur = c; page.scrollTop = 0;
    page.classList.add("open"); R.setMode("case");
    if (!reduced) {
      busy = true;
      var a = page.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 760, easing: "cubic-bezier(.7,0,.2,1)" });
      $$(".cs-bar, .cs-tags, .cs-title, .cs-statement, .cs-meta", page).forEach(function (el, i) {
        el.animate([{ opacity: 0, transform: "translateY(40px)" }, { opacity: 1, transform: "none" }], { duration: 800, delay: 360 + i * 70, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
      });
      a.onfinish = function () { busy = false; };
    }
    setTimeout(function () { var b = $(".cs-back", page); if (b) b.focus({ preventScroll: true }); }, reduced ? 0 : 500);
  }
  function close() {
    if (!page.classList.contains("open") || busy) return;
    function fin() { page.classList.remove("open"); page.innerHTML = ""; busy = false; }
    R.setMode(prev);
    if (reduced) { fin(); return; }
    busy = true;
    var a = page.animate([{ transform: "none" }, { transform: "translateY(100%)" }], { duration: 620, easing: "cubic-bezier(.7,0,.2,1)" });
    a.onfinish = fin;
  }
  function next(id) {
    if (busy) return;
    var c = byId[id]; if (!c) return;
    if (reduced) { render(c); cur = c; page.scrollTop = 0; return; }
    busy = true;
    var inn = $(".cs-in", page);
    var a = inn.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-48px)" }], { duration: 360, easing: "cubic-bezier(.7,0,.84,0)", fill: "forwards" });
    a.onfinish = function () {
      render(c); cur = c; page.scrollTop = 0;
      $(".cs-in", page).animate([{ opacity: 0, transform: "translateY(56px)" }, { opacity: 1, transform: "none" }], { duration: 700, easing: "cubic-bezier(.16,1,.3,1)" });
      busy = false;
    };
  }
  R.openCase = open; R.closeCase = close;

  page.addEventListener("click", function (e) {
    var nx = e.target.closest(".cs-next"); if (nx) { e.preventDefault(); next(nx.getAttribute("data-next")); return; }
    if (e.target.closest(".cs-back")) close();
  });
  /* every "View project" in the site lands here */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-case]"); if (!a || !byId[a.getAttribute("data-case")]) return;
    e.preventDefault(); e.stopPropagation();
    var lk = byId[a.getAttribute("data-case")].link;   /* a project with its own page (Snapchat Spellbook) opens it in a new tab */
    if (lk) { window.open(lk, "_blank", "noopener"); return; }
    open(a.getAttribute("data-case"), a);
  }, true);
  addEventListener("keydown", function (e) { if (e.key === "Escape" && site.getAttribute("data-mode") === "case") { close(); e.preventDefault(); } });
})();

/* ---- page ends: the sky waits under the page (Oct 25)
   Each scrolling page (Selected works, All works, case studies) ends on .sky-end. It is
   sticky at the bottom and sits under the page, so nothing of it shows until the content
   runs out and lifts away. --p (0..1) is how much is uncovered: the glass rises and opens up
   with it. Scrolling or swiping on past the end pulls the glass up with resistance (--pull,
   px), and letting go springs it back with a small bounce: a rubber band. */
(function () {
  var R = window.R2 || {}, reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MAX = 120;                                       /* the furthest the glass can be pulled */
  function setup(box) {
    var pull = 0, raw = 0, t = 0, ty = null, raf = 0;
    function foot() { return box.querySelector(".sky-end"); }
    function left() { return box.scrollHeight - box.clientHeight - box.scrollTop; }
    function paint() {
      raf = 0; var f = foot(); if (!f) return;
      var h = f.offsetHeight || 1, p = Math.max(0, Math.min(1, 1 - left() / h));
      f.style.setProperty("--p", p.toFixed(3));
      f.classList.toggle("sky-hid", p <= 0.001);
    }
    function ask() { if (!raf) raf = requestAnimationFrame(paint); }
    function setPull(v) {
      raw = Math.max(0, v); pull = MAX * (1 - Math.exp(-raw / 260));   /* the harder you pull, the less it gives */
      var f = foot(); if (f) { f.classList.remove("sky-spring"); f.style.setProperty("--pull", pull.toFixed(1)); }
    }
    function release() {
      var f = foot(); raw = 0; pull = 0; ty = null;
      if (f) { f.classList.add("sky-spring"); f.style.setProperty("--pull", "0"); }
    }
    box.addEventListener("scroll", ask, { passive: true });
    if (reduced) { ask(); return; }
    box.addEventListener("wheel", function (e) {
      if (left() > 2) { if (raw) release(); return; }
      if (e.deltaY > 0 || raw) { setPull(raw + e.deltaY * 0.6); clearTimeout(t); t = setTimeout(release, 160); }
    }, { passive: true });
    box.addEventListener("touchstart", function (e) { ty = left() <= 2 ? e.touches[0].clientY : null; }, { passive: true });
    box.addEventListener("touchmove", function (e) {
      var y = e.touches[0].clientY;
      if (ty === null) { if (left() <= 2) ty = y; return; }
      setPull((ty - y) * 0.9);
    }, { passive: true });
    box.addEventListener("touchend", function () { if (raw || ty !== null) release(); }, { passive: true });
    box.addEventListener("touchcancel", release, { passive: true });
    R.skyPaint = R.skyPaint || []; R.skyPaint.push(ask);
    ask();
  }
  ["worksPage", "allWorks", "casePage"].forEach(function (id) { var b = document.getElementById(id); if (b) setup(b); });
  /* a case page is rebuilt for each project, and pages open hidden: measure again on open */
  addEventListener("resize", function () { (R.skyPaint || []).forEach(function (f) { f(); }); });
  new MutationObserver(function () { (R.skyPaint || []).forEach(function (f) { f(); }); })
    .observe(document.getElementById("site") || document.body, { attributes: true, attributeFilter: ["data-mode"] });
  R.skyPull = function (id) { var b = document.getElementById(id), f = b && b.querySelector(".sky-end"); return f ? [getComputedStyle(f).getPropertyValue("--p"), getComputedStyle(f).getPropertyValue("--pull")] : null; };
})();

(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var R = window.R2, reduced = R.reduced, site = $("#site");
  var wrap = $("#sheets"), scrim = $("#sheetScrim"), artFg = $("#about .art.fg");
  var pgL = $("#pgL"), pgR = $("#pgR");
  var QUADS = {   /* the two pages as they lie in the painting (art px): TL, TR, BR, BL */
    intro:  [[885.1, 364.3], [1221.4, 490.5], [1019.4, 905], [617.7, 747.4]],
    pixels: [[1227.3, 490.5], [1630.1, 568.7], [1507.5, 1051], [1028.7, 908.5]]
  };
  var SHEET = { intro: $("#sheetIntro"), pixels: $("#sheetPixels") };
  var open = null, opener = null, animRaf = 0;

  /* --------------------------------------------- the notebook answers you */
  $$(".page-hit").forEach(function (b) {
    var pg = b.classList.contains("l") ? pgL : pgR;
    b.addEventListener("pointerenter", function () { pg.classList.add("on"); });
    b.addEventListener("pointerleave", function () { pg.classList.remove("on"); });
    b.addEventListener("focus", function () { pg.classList.add("on"); });
    b.addEventListener("blur", function () { pg.classList.remove("on"); });
    b.addEventListener("click", function () { R.openSheet(b.getAttribute("data-sheet"), b); });
  });
  R.hintPages = function () {
    [pgL, pgR].forEach(function (p, i) { setTimeout(function () { R.restart(p, "shim"); }, i * 260); });
  };
  R.onFace = function (i) { if (i === 2 && !reduced) setTimeout(R.hintPages, 500); };

  /* ------------------------------------------- homography: rect -> any quad */
  function solve(A, b) {          /* 8x8 gaussian elimination */
    var n = 8, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var t = M[c]; M[c] = M[p]; M[p] = t;
      for (r = c + 1; r < n; r++) { var f = M[r][c] / M[c][c]; for (var k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    var x = new Array(n);
    for (r = n - 1; r >= 0; r--) { var s = M[r][n]; for (k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  }
  function matrixFor(w, h, q) {
    var src = [[0, 0], [w, 0], [w, h], [0, h]], A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = q[i][0], v = q[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var h8 = solve(A, b);
    var m = [h8[0], h8[3], 0, h8[6], h8[1], h8[4], 0, h8[7], 0, 0, 1, 0, h8[2], h8[5], 0, 1];
    return "matrix3d(" + m.map(function (v) { return +v.toFixed(8); }).join(",") + ")";
  }
  function pageQuad(kind) {
    var r = artFg.getBoundingClientRect(), sx = r.width / 1921, sy = r.height / 1117;
    return QUADS[kind].map(function (p) { return [r.left + p[0] * sx, r.top + p[1] * sy]; });
  }
  function restRect(el) {
    var w = el.offsetWidth, h = el.offsetHeight, x = (innerWidth - w) / 2, y = innerWidth <= 760 ? 128 : Math.max(80, (innerHeight - h) / 2 + 24);
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  }
  var ease = function (t) { return 1 - Math.pow(1 - t, 4); };
  var easeIn = function (t) { return t * t * t; };
  function fly(el, from, to, dur, ez, done) {
    cancelAnimationFrame(animRaf);
    var w = el.offsetWidth, h = el.offsetHeight, t0 = performance.now();
    (function f(now) {
      var t = Math.min(1, (now - t0) / dur), e = ez(t), lift = Math.sin(Math.PI * t) * 28;
      var q = from.map(function (p, i) { return [p[0] + (to[i][0] - p[0]) * e, p[1] + (to[i][1] - p[1]) * e - lift]; });
      el.style.transform = matrixFor(w, h, q);
      if (t < 1) animRaf = requestAnimationFrame(f); else done();
    })(t0);
  }

  /* --------------------------------- a page lifts out of the notebook to you */
  R.openSheet = function (kind, from) {
    if (open || site.getAttribute("data-mode") !== "world") return;
    var el = SHEET[kind]; open = kind; opener = from || null;
    var mob = innerWidth <= 760;
    el.classList.toggle("m-flow", mob);
    wrap.classList.add("open"); wrap.setAttribute("aria-hidden", "false");
    site.setAttribute("data-sheet", kind);
    $("#world").inert = true;
    el.classList.add("live"); el.classList.remove("landed");
    if (kind === "intro" && R.resetLeaf) R.resetLeaf();
    deckleAll(el);
    if (R.soundOn()) R.chime([784, 988, 1175], 0.06, 0.035);
    function landed() {
      var rr = restRect(el); el.style.transform = "translate(" + rr[0][0] + "px," + rr[0][1] + "px)";
      el.classList.add("landed"); el.focus({ preventScroll: true });
      if (kind === "intro") writeCopy(); else flyPhotos();
      placeSel(null, true);
    }
    if (reduced) { landed(); return; }
    el.style.transform = matrixFor(el.offsetWidth, el.offsetHeight, pageQuad(kind));
    fly(el, pageQuad(kind), restRect(el), 950, ease, landed);
  };
  R.closeSheet = function (instant) {
    if (!open) return;
    var kind = open, el = SHEET[kind];
    open = null; el.classList.remove("landed");
    function fin() {
      el.classList.remove("live"); wrap.classList.remove("open"); wrap.setAttribute("aria-hidden", "true");
      site.removeAttribute("data-sheet"); $("#world").inert = site.getAttribute("data-mode") !== "world";
      el.style.transform = "";
      if (!instant && opener) opener.focus({ preventScroll: true });
    }
    if (reduced || instant) { fin(); return; }
    site.removeAttribute("data-sheet");
    fly(el, restRect(el), pageQuad(kind), 720, easeIn, fin);
  };
  scrim.addEventListener("click", function () { R.closeSheet(); });
  $$("[data-close]", wrap).forEach(function (b) { b.addEventListener("click", function () { R.closeSheet(); }); });
  addEventListener("keydown", function (e) {
    if (!open || lbOpen()) return;
    if (e.key === "Escape") { R.closeSheet(); e.preventDefault(); }
    if (e.key === "Tab") {                    /* keep focus inside the open page */
      var el = SHEET[open], f = $$("button,[tabindex='0'],a[href]", el).filter(function (x) { return x.offsetParent !== null && !x.closest("[inert]"); });
      if (!f.length) return;
      if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === el)) { f[f.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
    }
  });
  addEventListener("resize", function () {
    if (!open) return; var el = SHEET[open]; el.classList.toggle("m-flow", innerWidth <= 760);
    deckleAll(el);
    var rr = restRect(el); el.style.transform = "translate(" + rr[0][0] + "px," + rr[0][1] + "px)"; placeSel(null, true);
  });

  /* the copy writes itself along the ruled lines */
  var ab = $("#abCopy");
  function writeCopy() {
    if (reduced || !ab.animate) return;
    ab.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 1600, easing: "cubic-bezier(.45,0,.2,1)", delay: 150, fill: "backwards" });
  }
  var q = $(".ab-why .q");
  if (q && !reduced) q.animate([{ transform: "rotate(0)" }, { transform: "rotate(14deg)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(0)" }], { duration: 1400, iterations: Infinity, delay: 600, easing: "ease-in-out" });

  /* ----------------------------------------- cats: pick them up, flick them */
  var zS = 20, tipShown = false;
  var introIn = $("#sheetIntro .nb-in");
  $$(".sticker").forEach(function (s) {
    var kind = s.className.split(" ")[1];
    if (kind === "orange") {
      s.addEventListener("click", function () { R.restart(s, "wig"); });   /* the meow comes from the site-wide cat-tap listener */
      s.addEventListener("pointerenter", function () { if (!reduced) R.restart(s, "wig"); });
      return;
    }
    var dx = 0, dy = 0, vx = 0, vy = 0, on = false, moved = false, sx = 0, sy = 0, lim = null, lt = 0, lx = 0, ly = 0, raf = 0;
    function limits() {
      var b = introIn.getBoundingClientRect(), r = s.getBoundingClientRect(), L = r.left - dx, T = r.top - dy;
      return { x0: b.left - L, x1: b.right - (L + r.width), y0: b.top - T, y1: b.bottom - (T + r.height) };
    }
    function paint() { s.style.translate = dx.toFixed(1) + "px " + dy.toFixed(1) + "px"; }
    function bounce() {
      if (dx < lim.x0) { dx = lim.x0; vx = -vx * 0.55; } else if (dx > lim.x1) { dx = lim.x1; vx = -vx * 0.55; }
      if (dy < lim.y0) { dy = lim.y0; vy = -vy * 0.55; } else if (dy > lim.y1) { dy = lim.y1; vy = -vy * 0.55; }
    }
    function glide(t) {
      var dt = Math.min(0.033, (t - lt) / 1000); lt = t;
      dx += vx * dt; dy += vy * dt; vx *= Math.pow(0.04, dt); vy *= Math.pow(0.04, dt); bounce(); paint();
      raf = Math.abs(vx) + Math.abs(vy) > 12 ? requestAnimationFrame(glide) : 0;
    }
    s.addEventListener("pointerdown", function (e) {
      cancelAnimationFrame(raf); raf = 0; on = true; moved = false; sx = e.clientX - dx; sy = e.clientY - dy; lim = limits();
      lx = e.clientX; ly = e.clientY; lt = performance.now(); vx = vy = 0;
      s.setPointerCapture(e.pointerId); s.classList.add("grab"); s.style.zIndex = ++zS; e.preventDefault();
    });
    s.addEventListener("pointermove", function (e) {
      if (!on) return;
      var now = performance.now(), dtm = Math.max(8, now - lt);
      vx = vx * 0.6 + ((e.clientX - lx) / dtm * 1000) * 0.4; vy = vy * 0.6 + ((e.clientY - ly) / dtm * 1000) * 0.4;
      lx = e.clientX; ly = e.clientY; lt = now;
      var nx = e.clientX - sx, ny = e.clientY - sy; moved = moved || Math.abs(nx - dx) + Math.abs(ny - dy) > 3;
      dx = Math.min(lim.x1, Math.max(lim.x0, nx)); dy = Math.min(lim.y1, Math.max(lim.y0, ny)); paint();
    });
    function stop(e) {
      if (!on) return; on = false; s.classList.remove("grab");
      try { s.releasePointerCapture(e.pointerId); } catch (x) {}
      if (!moved) { R.restart(s, "wig"); return; }
      if (!reduced && performance.now() - lt < 80) { lt = performance.now(); raf = requestAnimationFrame(glide); }
    }
    s.addEventListener("pointerup", stop); s.addEventListener("pointercancel", stop);
    s.addEventListener("keydown", function (e) {
      var st = e.shiftKey ? 40 : 8, k = e.key;
      if (k === "ArrowLeft") dx -= st; else if (k === "ArrowRight") dx += st; else if (k === "ArrowUp") dy -= st; else if (k === "ArrowDown") dy += st; else return;
      lim = limits(); vx = vy = 0; bounce(); paint(); e.preventDefault();
    });
    s.addEventListener("pointerenter", function () {
      if (!reduced && !on) R.restart(s, "wig");
      if (!tipShown) { tipShown = true; R.toast(s, "Pick me up and drag me around"); }
    });
  });

  /* ------------------------------------- writing and photos on the notebook
     Each page carries a 720 x 920 sheet mapped onto the page as it lies in the
     painting, so the ink and the polaroids sit in the same perspective. */
  var inkL = $("#inkL"), inkL2 = $("#inkL2"), inkR = $("#inkR");
  function layoutInk() {
    var k = artFg.offsetWidth / 1921; if (!k) return;
    [[inkL, QUADS.intro], [inkL2, QUADS.intro], [inkR, QUADS.pixels]].forEach(function (p) {
      var q = p[1].map(function (v) { return [v[0] * k, v[1] * k]; });
      p[0].style.transform = matrixFor(720, 920, q);
    });
  }
  layoutInk(); addEventListener("resize", layoutInk); addEventListener("load", layoutInk);

  /* ------------------------------------------- real paper: torn, deckled edges */
  function deckle(el) {
    var w = el.offsetWidth, h = el.offsetHeight; if (!w || !h) return;
    var seed = (w * 7 + h * 13) | 0;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var pts = [], step = 5, d = Math.max(2, Math.min(5, w / 260));
    function edge(n, f) { for (var i = 0; i <= n; i++) { var j = rnd() * d * 0.7 + Math.sin(i * 0.37 + rnd()) * d * 0.3 + (rnd() < 0.04 ? d * 1.4 : 0); pts.push(f(i / n, j)); } }
    edge(Math.ceil(w / step), function (t, j) { return [t * w, j]; });
    edge(Math.ceil(h / step), function (t, j) { return [w - j, t * h]; });
    edge(Math.ceil(w / step), function (t, j) { return [w - t * w, h - j]; });
    edge(Math.ceil(h / step), function (t, j) { return [j, h - t * h]; });
    el.style.setProperty("--deckle", "polygon(" + pts.map(function (p) { return p[0].toFixed(1) + "px " + p[1].toFixed(1) + "px"; }).join(",") + ")");
  }
  function deckleAll(sheet) {
    $$(".paper", sheet).forEach(deckle);
    var f = $(".side.front .paper", sheet), j = $(".side.back .paper", sheet);   /* shades follow the torn edges */
    if (f) sheet.style.setProperty("--deckle-f", f.style.getPropertyValue("--deckle"));
    if (j) sheet.style.setProperty("--deckle-j", j.style.getPropertyValue("--deckle"));
  }
  R.deckleAll = deckleAll;

  /* ------------------------------------- turn the page: the work journey
     The about page is a leaf hinged on its left edge. Grab it anywhere (not
     a cat) and pull left: it follows the hand, darkens as it tilts away and
     throws a moving shadow on the journey underneath. Let go past ~40% (or
     flick) and it swings over; short tugs spring back. Pull the journey to
     the right to bring it back. Buttons and arrow keys do the same. */
  var intro = SHEET.intro, front = $("#sheetIntro .side.front"), back = $("#journeySide"), leaf = $("#leaf");
  var turn = 0, turnRaf = 0, drag = null, swallowClick = false;
  var leafShade = $("#sheetIntro .leaf-shade"), underShade = $("#sheetIntro .under-shade");
  function paintTurn(t) {                    /* compositor-only: one transform, two opacities */
    turn = t; leaf.dataset.turn = t.toFixed(4);
    var lift = Math.sin(Math.PI * t), w = intro.offsetWidth;
    leaf.style.transform = t ? "rotateY(" + (-180 * t).toFixed(2) + "deg)" : "";
    leafShade.style.opacity = lift.toFixed(3);
    underShade.style.opacity = (t < 0.5 ? lift : lift * 0.6).toFixed(3);
    underShade.style.transform = "translateX(" + (t < 0.5 ? Math.cos(Math.PI * t) * w : 0).toFixed(1) + "px)";
  }
  function settle(on, focus) {
    intro.classList.toggle("flipped", on); intro.classList.toggle("settled", on); intro.classList.remove("turning");
    front.inert = on; back.inert = !on;
    front.setAttribute("aria-hidden", String(on)); back.setAttribute("aria-hidden", String(!on));
    intro.setAttribute("aria-labelledby", on ? "jr-title" : "ab-title");
    if (focus) (on ? $("#turnBack") : $("#turnBtn")).focus({ preventScroll: true });
    if (innerWidth <= 760) deckleAll(intro);
  }
  function animateTurn(to, opts) {
    opts = opts || {};
    cancelAnimationFrame(turnRaf);
    var from = turn, dist = Math.abs(to - from);
    if (to === 1 && from < 1 && R.soundOn()) rustle();
    if (to === 0 && from > 0.5 && R.soundOn()) rustle();
    if (reduced || innerWidth <= 760 || dist < 0.001) { paintTurn(to); settle(to === 1, opts.focus); return; }
    intro.classList.add("turning"); intro.classList.remove("settled");
    var dur = (opts.release ? 260 : 420) + 680 * dist, t0 = performance.now();
    var ez = opts.release ? function (k) { return 1 - Math.pow(1 - k, 3); } : function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      paintTurn(from + (to - from) * ez(k));
      if (k < 1) turnRaf = requestAnimationFrame(step); else settle(to === 1, opts.focus);
    })(t0);
  }
  function setFlip(on, focus) { animateTurn(on ? 1 : 0, { focus: focus }); }
  R.resetLeaf = function () { cancelAnimationFrame(turnRaf); paintTurn(0); settle(false, false); };

  function startDrag(e, dir) {
    if (e.button > 0 || innerWidth <= 760) return;
    if (dir > 0 && e.target.closest(".sticker,.close,a")) return;
    if (dir < 0 && e.target.closest(".close,a,.jr-detail")) return;
    var w = intro.getBoundingClientRect().width;
    drag = { dir: dir, x0: e.clientX, y0: e.clientY, t0: turn, w: w, on: false, id: e.pointerId, lx: e.clientX, lt: performance.now(), v: 0, el: e.currentTarget };
  }
  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = drag.x0 - e.clientX, dy = e.clientY - drag.y0;
    if (!drag.on) {
      if (Math.abs(dx) < 7) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.2) { drag = null; return; }
      if ((drag.dir > 0 && dx < 0) || (drag.dir < 0 && dx > 0)) { drag = null; return; }
      drag.on = true; cancelAnimationFrame(turnRaf); leaf.classList.remove("peek");
      intro.classList.add("turning"); intro.classList.remove("settled"); leaf.classList.add("grabbing");
      try { drag.el.setPointerCapture(e.pointerId); } catch (x) {}
    }
    var now = performance.now(), dt = Math.max(8, now - drag.lt);
    drag.v = drag.v * 0.5 + ((drag.lx - e.clientX) / dt) * 0.5; drag.lx = e.clientX; drag.lt = now;
    paintTurn(Math.max(0, Math.min(1, drag.t0 + dx / (drag.w * 0.95))));
    e.preventDefault();
  }
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; leaf.classList.remove("grabbing");
    if (!d.on) return;
    swallowClick = true; setTimeout(function () { swallowClick = false; }, 0);
    var to = d.v > 0.45 ? 1 : d.v < -0.45 ? 0 : (turn > 0.42 ? 1 : 0);
    if (d.dir < 0 && turn < 0.58 && d.v > -0.45) to = 0;
    animateTurn(to, { release: true });
  }
  leaf.addEventListener("pointerdown", function (e) { if (!intro.classList.contains("flipped")) startDrag(e, 1); });
  /* hover near the outer edge and the page lifts a little, asking to be turned */
  leaf.addEventListener("pointermove", function (e) {
    if (drag || e.pointerType !== "mouse" || intro.classList.contains("turning") || intro.classList.contains("flipped")) return;
    var r = intro.getBoundingClientRect();
    leaf.classList.toggle("peek", e.clientX > r.right - r.width * 0.18 && !e.target.closest(".sticker"));
  });
  leaf.addEventListener("pointerleave", function () { leaf.classList.remove("peek"); });
  back.addEventListener("pointerdown", function (e) { if (intro.classList.contains("flipped")) startDrag(e, -1); });
  [leaf, back].forEach(function (el) {
    el.addEventListener("pointermove", moveDrag);
    el.addEventListener("pointerup", endDrag); el.addEventListener("pointercancel", endDrag);
  });
  intro.addEventListener("click", function (e) { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  intro.addEventListener("keydown", function (e) {
    if (open !== "intro" || e.target.closest(".sticker")) return;
    if ((e.key === "ArrowRight" || e.key === "PageDown") && turn < 1) { setFlip(true, true); e.preventDefault(); }
    else if ((e.key === "ArrowLeft" || e.key === "PageUp") && turn > 0) { setFlip(false, true); e.preventDefault(); }
  });
  /* mobile: a sideways swipe turns the page */
  var sw = null;
  intro.addEventListener("touchstart", function (e) { if (innerWidth <= 760 && !e.target.closest(".sticker")) sw = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
  intro.addEventListener("touchend", function (e) {
    if (!sw) return; var t = e.changedTouches[0], dx = t.clientX - sw[0], dy = t.clientY - sw[1]; sw = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setFlip(dx < 0, false);
  }, { passive: true });

  function rustle() { return; }   /* Nov 7: no sound effects */
  function rustleOff() {
    var a = R.ctx(); if (!a) return;
    var len = a.sampleRate * 0.5, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * i / len), 2) * (0.6 + 0.4 * Math.random());
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = 0.6; g.gain.value = 0.08;
    src.connect(f); f.connect(g); g.connect(R.master()); src.start();
  }
  back.inert = true;
  $("#turnBtn").addEventListener("click", function () { setFlip(true, R.keyboardUser); });
  $("#turnBack").addEventListener("click", function () { setFlip(false, R.keyboardUser); });

  /* the journey: tap a stop and its card fills in (from the CV) */
  var JOBS = {
    halan: { when: "Jul 2026 – now", role: "Product designer intern", where: "MNT-Halan", pts: [
      "Designed the Help Center flow for the new Halan Borsa app from the real support journey, so people solve common issues without calling support.",
      "Prototyped and animated the card-approval success screens: clear, instant confirmation that feels on-brand.",
      "Designed the authentication and Halan Card application flows for the UAE app, from entry to submission, inside the existing design system."] },
    xperience: { when: "May – Jul 2026", role: "UI/UX designer", where: "Xperience Software Solutions", pts: [
      "Designed Maaliy, an ERP system built from its SRS requirements.",
      "Advanced UI/UX workshop: SaaS, ERP and CRM dashboards, scalable design systems and stakeholder interviews."] },
    zain: { when: "Jan 2025 – Jun 2026", role: "Graphic designer, full time", where: "Zain Group", pts: [
      "Designed full brand identities: social media posts, reels, branding and packaging.",
      "Created visual content for digital platforms with AI-powered design tools.",
      "Produced motion graphics and advanced photo manipulation."] },
    applied: { when: "2020 – 2025", role: "Visual design", where: "Faculty of Applied Arts", pts: [
      "Colour theory, typography, layout, branding and motion design, for print and digital.",
      "UX design thinking and UI principles, with the Adobe Creative Suite.",
      "Route UX/UI course (Oct 2024 – Jan 2025): research, personas, journey maps, IA, wireframes, prototypes and usability testing."] }
  };
  var detail = $("#jrDetail"), picks = $$(".jr-list li");
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function showJob(k, anim) {
    var j = JOBS[k]; if (!j) return;
    picks.forEach(function (li) { var on = li.getAttribute("data-job") === k; li.classList.toggle("picked", on); li.querySelector(".jr-pick").setAttribute("aria-pressed", String(on)); });
    detail.innerHTML = '<span class="jd-when">' + esc(j.when) + "</span><h3>" + esc(j.role) + '</h3><p class="jd-where">' + esc(j.where) + "</p><ul>" +
      j.pts.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
    if (anim && !reduced) { detail.classList.remove("swap"); void detail.offsetWidth; detail.classList.add("swap"); }
    if (anim && intro.classList.contains("m-flow")) detail.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }
  picks.forEach(function (li) { li.querySelector(".jr-pick").addEventListener("click", function () { showJob(li.getAttribute("data-job"), true); }); });
  showJob("halan", false);

  /* --------------------------------------- beyond the pixels: a little canvas */
  var canvasEl = $("#pxCanvas"), sel = $("#sel"), selLabel = $("#selLabel"), word = $("#pxWord"), selected = null;
  function sUnit() { var el = SHEET.pixels; return el.offsetWidth / 1328.03; }
  function boxOf(el) { var f = canvasEl.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height }; }
  function placeSel(el, instant) {
    var u = sUnit(), b;
    if (el === word || !el) { b = { x: 513.2 * u, y: 396.4 * u, w: 300.7 * u, h: 102.5 * u }; sel.classList.remove("photo"); }
    else {
      b = boxOf(el); b.x -= 2; b.y -= 2; b.w += 4; b.h += 4;
      selLabel.textContent = el.getAttribute("data-n") + "  " + Math.round(el.offsetWidth / u) + " × " + Math.round(el.offsetHeight / u);
      sel.classList.add("photo");
    }
    sel.classList.toggle("snap", !!instant);
    sel.style.left = b.x + "px"; sel.style.top = b.y + "px"; sel.style.width = b.w + "px"; sel.style.height = b.h + "px";
  }
  var zTop = 41, PHS = $$(".ph", canvasEl);
  var TILT = [-4, 3, -2, 5, -3, 2, -5, 4, -1, 3, -4, 2, -3, 5, -2, 4, -5, 1, 3, -3];
  PHS.forEach(function (ph, i) { ph.style.setProperty("--r", TILT[i % TILT.length] + "deg"); });
  PHS.forEach(function (ph, idx) {
    var dx = 0, dy = 0, sx = 0, sy = 0, on = false, moved = false, x0 = 0, y0 = 0;
    function lim() {
      var b = canvasEl.getBoundingClientRect(), r = ph.getBoundingClientRect(), L = r.left - dx, T = r.top - dy;
      return { x0: b.left - L - r.width * 0.4, x1: b.right - L - r.width * 0.6, y0: b.top - T - r.height * 0.4, y1: b.bottom - T - r.height * 0.6 };
    }
    var L = null;
    ph.addEventListener("pointerdown", function (e) {
      on = true; moved = false; x0 = e.clientX; y0 = e.clientY; sx = e.clientX - dx; sy = e.clientY - dy; L = lim(); ph.setPointerCapture(e.pointerId); ph.classList.add("grab");
      selected = ph; ph.style.zIndex = ++zTop; placeSel(ph, true); e.preventDefault();
    });
    ph.addEventListener("pointermove", function (e) {
      if (!on) return; if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 5) moved = true;
      dx = Math.min(L.x1, Math.max(L.x0, e.clientX - sx)); dy = Math.min(L.y1, Math.max(L.y0, e.clientY - sy));
      ph.style.translate = dx + "px " + dy + "px"; placeSel(ph, true);
    });
    function up(e) {
      if (!on) return; on = false; ph.classList.remove("grab"); try { ph.releasePointerCapture(e.pointerId); } catch (x) {} placeSel(ph, true);
      if (!moved && e.type === "pointerup") openLB(idx, ph);
    }
    ph.addEventListener("pointerup", up); ph.addEventListener("pointercancel", up);
    ph.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { openLB(idx, ph); e.preventDefault(); return; }
      var st = e.shiftKey ? 40 : 8, k = e.key;
      if (k === "ArrowLeft") dx -= st; else if (k === "ArrowRight") dx += st; else if (k === "ArrowUp") dy -= st; else if (k === "ArrowDown") dy += st; else return;
      L = lim(); dx = Math.min(L.x1, Math.max(L.x0, dx)); dy = Math.min(L.y1, Math.max(L.y0, dy)); ph.style.translate = dx + "px " + dy + "px"; placeSel(ph, true); e.preventDefault();
    });
    ph.addEventListener("pointerenter", function () { if (!selected) placeSel(ph); });
    ph.addEventListener("pointerleave", function () { if (!selected) placeSel(null); });
    ph.addEventListener("focus", function () { selected = ph; placeSel(ph); });
    ph.addEventListener("blur", function () { selected = null; placeSel(null); });
  });
  canvasEl.addEventListener("pointerdown", function (e) { if (!e.target.closest(".ph")) { selected = null; placeSel(null); } });
  /* ---------------------------- one photo at a time, in a polaroid, with arrows */
  var lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCap"), lbCount = $("#lbCount"), lbPola = $("#lbPola"), lbIdx = 0, lbFrom = null;
  function lbOpen() { return !lb.hidden; }
  function lbShow(i, dir) {
    lbIdx = (i + PHS.length) % PHS.length;
    var im = $("img", PHS[lbIdx]);
    lbImg.src = im.src; lbImg.alt = im.alt; lbCap.textContent = im.alt;
    lbCount.textContent = (lbIdx + 1) + " / " + PHS.length;
    if (dir && !reduced) lbPola.animate([{ opacity: 0, transform: "translateX(" + (dir * 48) + "px) rotate(" + (dir * 4) + "deg)" }, { opacity: 1, transform: "rotate(-1.5deg)" }], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" });
  }
  function openLB(i, from) {
    lbFrom = from; lb.hidden = false; lbShow(i, 0);
    if (!reduced && from) {
      var a = from.getBoundingClientRect(), b = lbPola.getBoundingClientRect();
      lbPola.animate([{ transform: "translate(" + (a.left + a.width / 2 - b.left - b.width / 2) + "px," + (a.top + a.height / 2 - b.top - b.height / 2) + "px) scale(" + (a.width / b.width) + ") rotate(0deg)" },
        { transform: "rotate(-1.5deg)" }], { duration: 560, easing: "cubic-bezier(.16,1,.3,1)" });
      $(".lb-scrim", lb).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    }
    $("#lbNext").focus({ preventScroll: true });
    if (R.soundOn()) R.chime([988], 0.05, 0.03);
  }
  function closeLB() { if (!lbOpen()) return; lb.hidden = true; if (lbFrom) lbFrom.focus({ preventScroll: true }); }
  $("#lbPrev").addEventListener("click", function () { lbShow(lbIdx - 1, -1); });
  $("#lbNext").addEventListener("click", function () { lbShow(lbIdx + 1, 1); });
  $$("[data-lbclose]", lb).forEach(function (b) { b.addEventListener("click", closeLB); });
  addEventListener("keydown", function (e) {
    if (!lbOpen()) return;
    if (e.key === "Escape") { closeLB(); e.preventDefault(); e.stopImmediatePropagation(); }
    else if (e.key === "ArrowRight") { lbShow(lbIdx + 1, 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { lbShow(lbIdx - 1, -1); e.preventDefault(); }
    else if (e.key === "Tab") {
      var f = $$("button", lb); var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); } else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); }
    }
  }, true);
  var lbx = null;
  lb.addEventListener("touchstart", function (e) { lbx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) { if (lbx === null) return; var d = e.changedTouches[0].clientX - lbx; lbx = null; if (Math.abs(d) > 48) lbShow(lbIdx + (d < 0 ? 1 : -1), d < 0 ? 1 : -1); }, { passive: true });
  var _close = R.closeSheet; R.closeSheet = function (i) { closeLB(); _close(i); };

  /* the photos fly in from the title, the way you'd paste them on a board */
  function flyPhotos() {
    if (reduced) return;
    var phs = $$(".ph", canvasEl), f = canvasEl.getBoundingClientRect(), cx = f.width / 2, cy = f.height * 0.5;
    phs.forEach(function (p, i) {
      var b = boxOf(p), fx = cx - (b.x + b.w / 2), fy = cy - (b.y + b.h / 2);
      p.animate([{ opacity: 0, transform: "translate(" + fx * 0.85 + "px," + fy * 0.85 + "px) scale(.4) rotate(" + (i % 2 ? 8 : -8) + "deg)" }, { opacity: 1, transform: "none" }],
        { duration: 900, delay: 120 + i * 40, easing: "cubic-bezier(.34,1.3,.64,1)", fill: "backwards" });
    });
  }
})();

(function () {
  "use strict";
  /* ============================================================ journal art
     Little hand-inked illustrations for the journal, drawn as inline SVG so
     they stay crisp at any size: drinks, a cassette, design tools, and the
     Palestine stickers. Each one is a die-cut sticker (the white edge and the
     shadow come from CSS). Original drawings, flat colour + ink line. */
  var INK = "#2b2a22", n = 0;
  function uid(p) { return p + (++n); }
  function svg(vb, body, label) { return '<svg viewBox="' + vb + '" role="img" aria-label="' + label + '">' + body + "</svg>"; }
  var A = {};

  A.watermelon = function () {
    var seeds = [[40, 30], [58, 44], [70, 26], [84, 40], [98, 28], [52, 22], [76, 52], [92, 50], [64, 36], [106, 38], [34, 18]]
      .map(function (s, i) { return '<ellipse cx="' + s[0] + '" cy="' + s[1] + '" rx="2.2" ry="3.6" transform="rotate(' + (i % 2 ? 18 : -14) + " " + s[0] + " " + s[1] + ')" fill="' + INK + '"/>'; }).join("");
    return svg("0 0 140 84",
      '<path d="M6 12 A64 64 0 0 0 134 12 Z" fill="#3F7D3A" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M11 12 A59 59 0 0 0 129 12 Z" fill="#9CC66D"/>' +
      '<path d="M15 12 A55 55 0 0 0 125 12 Z" fill="#F4F0DC"/>' +
      '<path d="M19 12 A51 51 0 0 0 121 12 Z" fill="#D8403A"/>' +
      '<path d="M26 16 A44 44 0 0 0 60 54" fill="none" stroke="#F06A5E" stroke-width="3" stroke-linecap="round" opacity=".7"/>' +
      seeds + '<path d="M6 12 H134" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>', "Sticker: a slice of watermelon");
  };

  A.flag = function () {
    var w = "C45 4 70 20 100 12 C115 8 125 10 132 12", band = function (y, c) {
      return '<path d="M14 ' + y + " " + w.replace(/(\d+) (\d+)/g, function (_, a, b) { return a + " " + (+b + y - 12); }) + " L132 " + (y + 20) + " C125 " + (y + 18) + " 115 " + (y + 16) + " 100 " + (y + 20) + " C70 " + (y + 28) + " 45 " + (y + 12) + " 14 " + (y + 20) + ' Z" fill="' + c + '"/>';
    };
    return svg("0 0 140 120",
      '<rect x="7" y="4" width="7" height="112" rx="3" fill="#8A5A2B" stroke="' + INK + '" stroke-width="2.2"/>' +
      '<circle cx="10.5" cy="5" r="4.5" fill="#C9A66B" stroke="' + INK + '" stroke-width="2"/>' +
      band(12, "#1F1F1C") + band(32, "#F6F2E6") + band(52, "#3D7A3D") +
      '<path d="M14 12 L64 42 L14 72 Z" fill="#C8352E"/>' +
      '<path d="M14 12 C45 4 70 20 100 12 C115 8 125 10 132 12 L132 72 C125 70 115 68 100 72 C70 80 45 64 14 72 Z" fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>',
      "Sticker: the Palestinian flag");
  };

  A.olive = function () {
    var leaves = [[34, 92, -50], [46, 78, 30], [58, 66, -40], [72, 54, 40], [84, 44, -30], [98, 34, 46], [110, 24, -20]].map(function (l, i) {
      return '<g transform="translate(' + l[0] + " " + l[1] + ") rotate(" + l[2] + ')"><path d="M0 0 C6 -8 22 -10 34 -3 C22 4 6 6 0 0 Z" fill="' + (i % 2 ? "#7E9A4A" : "#6A8440") + '" stroke="' + INK + '" stroke-width="1.8"/><path d="M2 -1 C12 -4 22 -4 30 -3" stroke="#4E6230" stroke-width="1.2" fill="none"/></g>';
    }).join("");
    var fruit = [[60, 86], [74, 78], [92, 70]].map(function (o, i) {
      return '<ellipse cx="' + o[0] + '" cy="' + o[1] + '" rx="8" ry="11" transform="rotate(' + (i ? -20 : 10) + " " + o[0] + " " + o[1] + ')" fill="' + (i === 1 ? "#55693A" : "#3E4F2A") + '" stroke="' + INK + '" stroke-width="1.8"/><ellipse cx="' + (o[0] - 3) + '" cy="' + (o[1] - 4) + '" rx="2" ry="3" fill="#fff" opacity=".45"/>';
    }).join("");
    return svg("0 0 140 120", '<path d="M16 112 C40 84 74 52 126 14" fill="none" stroke="#5B4A2E" stroke-width="4" stroke-linecap="round"/>' + leaves + fruit, "Sticker: an olive branch");
  };

  A.key = function () {
    return svg("0 0 80 160",
      '<g fill="#B07B3E" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
      '<path d="M40 6 C55 6 66 17 66 31 C66 45 55 56 40 56 C25 56 14 45 14 31 C14 17 25 6 40 6 Z M40 18 C32 18 26 24 26 31 C26 38 32 44 40 44 C48 44 54 38 54 31 C54 24 48 18 40 18 Z" fill-rule="evenodd"/>' +
      '<rect x="34" y="54" width="12" height="12" rx="2"/><rect x="36" y="64" width="8" height="78"/>' +
      '<path d="M44 112 H62 V122 H54 V130 H62 V142 H44 Z"/></g>' +
      '<circle cx="40" cy="31" r="3" fill="#E0B070"/><path d="M20 22 C24 14 32 10 40 10" stroke="#E6C08A" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M38 70 V136" stroke="#E0B070" stroke-width="1.6" opacity=".7"/>', "Sticker: the key of return");
  };

  A.keffiyeh = function () {
    var p = uid("kf");
    return svg("0 0 130 150",
      '<defs><pattern id="' + p + '" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#F5F1E4"/><path d="M0 0 H9 M0 0 V9" stroke="' + INK + '" stroke-width="1.6"/><circle cx="4.5" cy="4.5" r="1.3" fill="' + INK + '"/></pattern></defs>' +
      '<path d="M22 20 C40 6 90 6 108 20 C112 40 104 58 92 66 L98 132 L74 138 L66 72 L58 138 L34 132 L40 66 C28 58 18 40 22 20 Z" fill="url(#' + p + ')" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M38 30 C50 44 80 44 92 30 C86 46 76 52 65 52 C54 52 44 46 38 30 Z" fill="#F5F1E4" stroke="' + INK + '" stroke-width="2"/>' +
      '<g stroke="' + INK + '" stroke-width="3"><path d="M35 118 L58 122 M36 124 L58 128"/><path d="M73 122 L96 118 M73 128 L97 124"/></g>' +
      '<g stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"><path d="M36 133 v8 M41 134 v8 M46 135 v8 M51 136 v8 M56 137 v8 M76 137 v8 M81 136 v8 M86 135 v8 M91 134 v8 M96 133 v8"/></g>',
      "Sticker: a Palestinian keffiyeh scarf");
  };

  A.tea = function () {
    return svg("0 0 100 124",
      '<path d="M12 8 H88 L78 114 C78 118 74 120 70 120 H30 C26 120 22 118 22 114 Z" fill="#DCEFF2" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M16 30 H84 L76 112 C76 115 73 116 70 116 H30 C27 116 24 115 24 112 Z" fill="#B5562B"/>' +
      '<path d="M16 30 H84" stroke="#D9773F" stroke-width="3"/>' +
      '<g fill="#4F7A3A" stroke="#2E4A22" stroke-width="1.4"><path d="M50 98 C38 86 38 66 50 50 C62 66 62 86 50 98 Z"/><path d="M48 84 C32 82 24 68 26 56 C40 58 50 70 48 84 Z"/><path d="M53 76 C68 72 76 58 74 46 C60 50 52 62 53 76 Z"/></g>' +
      '<g stroke="#9BC07A" stroke-width="1" fill="none"><path d="M50 96 V54"/><path d="M47 82 L30 60"/><path d="M54 74 L71 50"/></g>' +
      '<path d="M30 14 L34 106 M70 14 L66 106" stroke="#fff" stroke-width="3" opacity=".55"/>' +
      '<ellipse cx="50" cy="8" rx="38" ry="3" fill="#fff" opacity=".6"/>', "Sticker: a glass of tea with fresh mint");
  };

  A.coffee = function () {
    var dots = "", bub = "";
    for (var i = 0; i < 24; i++) { var a = i / 24 * Math.PI * 2; dots += '<circle cx="' + (70 + Math.cos(a) * 54).toFixed(1) + '" cy="' + (70 + Math.sin(a) * 54).toFixed(1) + '" r="' + (i % 2 ? 2.4 : 3.6) + '" fill="' + (i % 3 ? "#2F5D9E" : "#C8352E") + '"/>'; }
    var bs = [[60, 58, 3], [74, 64, 2.4], [66, 76, 2], [80, 74, 3.2], [56, 72, 2.2], [70, 84, 2.6], [86, 62, 2], [62, 88, 1.8], [78, 86, 1.6], [52, 62, 1.6]];
    bs.forEach(function (b) { bub += '<circle cx="' + b[0] + '" cy="' + b[1] + '" r="' + b[2] + '" fill="#C99A68" stroke="#7A4A26" stroke-width=".8"/>'; });
    return svg("0 0 140 140",
      '<circle cx="70" cy="70" r="64" fill="#F8F5EE" stroke="' + INK + '" stroke-width="2.4"/>' +
      '<circle cx="70" cy="70" r="54" fill="none" stroke="#7FA6D6" stroke-width="7" stroke-dasharray="3 5"/>' + dots +
      '<rect x="104" y="64" width="26" height="12" rx="6" fill="#fff" stroke="' + INK + '" stroke-width="2.2"/>' +
      '<circle cx="70" cy="70" r="38" fill="#fff" stroke="' + INK + '" stroke-width="2.4"/>' +
      '<circle cx="70" cy="70" r="32" fill="#8A5A33"/><circle cx="70" cy="70" r="32" fill="none" stroke="#B9885A" stroke-width="4" opacity=".7"/>' + bub,
      "Sticker: a cup of Turkish coffee from above");
  };

  A.cassette = function () {
    var reel = function (x) { return '<circle cx="' + x + '" cy="48" r="11" fill="#E6F1F2" stroke="' + INK + '" stroke-width="2"/><circle cx="' + x + '" cy="48" r="4" fill="' + INK + '"/><path d="M' + (x - 7) + " 48 H" + (x + 7) + " M" + x + " 41 V55" + '" stroke="' + INK + '" stroke-width="1.6"/>'; };
    return svg("0 0 160 110",
      '<rect x="6" y="8" width="148" height="94" rx="10" fill="#6A5240" stroke="' + INK + '" stroke-width="2.6"/>' +
      '<rect x="18" y="18" width="124" height="56" rx="5" fill="#F1E4C2" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M18 52 H142 V69 C142 72 140 74 137 74 H23 C20 74 18 72 18 69 Z" fill="#9CC66D" opacity=".85"/>' +
      '<text x="80" y="33" text-anchor="middle" font-family="Architects Daughter,cursive" font-size="12" fill="' + INK + '">my playlist</text>' +
      '<rect x="44" y="38" width="72" height="20" rx="10" fill="#3B2E24" stroke="' + INK + '" stroke-width="2"/>' + reel(56) + reel(104) +
      '<rect x="68" y="42" width="24" height="12" rx="2" fill="#A7C9CF"/>' +
      '<path d="M36 102 L46 82 H114 L124 102" fill="#584334" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<g fill="' + INK + '"><circle cx="15" cy="16" r="2"/><circle cx="145" cy="16" r="2"/><circle cx="15" cy="94" r="2"/><circle cx="145" cy="94" r="2"/><circle cx="66" cy="94" r="3"/><circle cx="94" cy="94" r="3"/></g>',
      "Sticker: a cassette tape labelled my playlist");
  };

  A.cursor = function () {
    return svg("0 0 100 110",
      '<path d="M18 8 L18 84 L36 68 L50 98 L64 92 L50 62 L76 62 Z" fill="#FFFDF6" stroke="' + INK + '" stroke-width="3.6" stroke-linejoin="round"/>' +
      '<g stroke="#E9A23B" stroke-width="4" stroke-linecap="round"><path d="M8 14 L2 10"/><path d="M10 4 L8 -2" transform="translate(4 6)"/><path d="M28 6 L32 0"/></g>' +
      '<rect x="56" y="14" width="40" height="22" rx="11" fill="#9CC66D" stroke="' + INK + '" stroke-width="2.4"/>' +
      '<text x="76" y="30" text-anchor="middle" font-family="Architects Daughter,cursive" font-size="12" fill="' + INK + '">click!</text>',
      "Sticker: a mouse cursor saying click");
  };

  A.swatches = function () {
    var chip = function (x, r, c, hex) {
      return '<g transform="rotate(' + r + ' 70 112)"><rect x="' + x + '" y="10" width="40" height="70" rx="4" fill="#FFFDF6" stroke="' + INK + '" stroke-width="2"/><rect x="' + (x + 4) + '" y="14" width="32" height="44" rx="2" fill="' + c + '"/><text x="' + (x + 20) + '" y="72" text-anchor="middle" font-family="Special Elite,monospace" font-size="8" fill="' + INK + '">' + hex + "</text></g>";
    };
    return svg("0 0 140 100", chip(50, -24, "#7A1F2B", "#7A1F2B") + chip(50, 0, "#9CC66D", "#9CC66D") + chip(50, 24, "#F2C230", "#F2C230") +
      '<circle cx="70" cy="88" r="5" fill="#C9A66B" stroke="' + INK + '" stroke-width="2"/>', "Sticker: a fan of colour swatches");
  };

  A.pen = function () {
    return svg("0 0 150 100",
      '<path d="M14 80 C40 10 100 10 136 64" fill="none" stroke="#2F5D9E" stroke-width="3.4" stroke-linecap="round"/>' +
      '<g stroke="' + INK + '" stroke-width="1.6"><path d="M14 80 L30 30"/><path d="M136 64 L118 22"/><path d="M76 26 L46 22 M76 26 L106 30"/></g>' +
      '<g fill="#fff" stroke="' + INK + '" stroke-width="2"><rect x="8" y="74" width="12" height="12"/><rect x="130" y="58" width="12" height="12"/><rect x="70" y="20" width="12" height="12" fill="#9CC66D"/></g>' +
      '<g fill="#fff" stroke="' + INK + '" stroke-width="1.8"><circle cx="30" cy="30" r="4"/><circle cx="118" cy="22" r="4"/><circle cx="46" cy="22" r="4"/><circle cx="106" cy="30" r="4"/></g>' +
      '<g transform="translate(86 52) rotate(-30)"><path d="M0 0 L10 -22 L20 0 L14 22 H6 Z" fill="#FFFDF6" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/><circle cx="10" cy="2" r="2.6" fill="' + INK + '"/><path d="M10 -20 V0" stroke="' + INK + '" stroke-width="1.4"/><rect x="5" y="22" width="10" height="8" fill="#E9A23B" stroke="' + INK + '" stroke-width="2"/></g>',
      "Sticker: a pen tool drawing a bezier curve");
  };

  A.phone = function () {
    return svg("0 0 84 150",
      '<rect x="4" y="4" width="76" height="142" rx="14" fill="#FFFDF6" stroke="' + INK + '" stroke-width="2.8"/>' +
      '<rect x="32" y="10" width="20" height="5" rx="2.5" fill="' + INK + '"/>' +
      '<rect x="12" y="22" width="40" height="7" rx="3.5" fill="#C9D6B0"/><circle cx="68" cy="25" r="5" fill="#F1D2C8" stroke="' + INK + '" stroke-width="1.4"/>' +
      '<rect x="12" y="36" width="60" height="38" rx="6" fill="#9CC66D" opacity=".7"/><path d="M16 68 L30 52 L40 62 L50 48 L68 68 Z" fill="#6A8A3C" opacity=".7"/><circle cx="58" cy="44" r="4" fill="#F2C230"/>' +
      '<g fill="#D9D2BE"><rect x="12" y="82" width="52" height="5" rx="2.5"/><rect x="12" y="92" width="40" height="5" rx="2.5"/><rect x="12" y="102" width="46" height="5" rx="2.5"/></g>' +
      '<rect x="12" y="116" width="60" height="16" rx="8" fill="#7A1F2B"/><rect x="26" y="122" width="32" height="4" rx="2" fill="#F4EBD2"/>' +
      '<rect x="30" y="138" width="24" height="3" rx="1.5" fill="' + INK + '"/>', "Sticker: a little phone wireframe");
  };

  A.matcha = function () {
    return svg("0 0 100 130",
      '<path d="M14 26 H86 L78 118 C78 122 74 125 70 125 H30 C26 125 22 122 22 118 Z" fill="#E8F2E2" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M18 52 H82 L76 116 C76 119 73 121 70 121 H30 C27 121 24 119 24 116 Z" fill="#8DB65A"/>' +
      '<path d="M18 52 C34 60 50 46 66 54 C74 58 80 54 82 52 L80 74 C64 82 40 70 20 76 Z" fill="#F3EEDC" opacity=".95"/>' +
      '<g fill="#fff" stroke="#9FB98A" stroke-width="1.2" opacity=".9"><rect x="30" y="80" width="14" height="14" rx="3" transform="rotate(12 37 87)"/><rect x="52" y="90" width="14" height="14" rx="3" transform="rotate(-10 59 97)"/></g>' +
      '<rect x="58" y="2" width="7" height="70" rx="3.5" fill="#7A1F2B" stroke="' + INK + '" stroke-width="2" transform="rotate(10 61 37)"/>' +
      '<ellipse cx="50" cy="26" rx="36" ry="3.5" fill="#fff" opacity=".7"/>', "Sticker: an iced matcha latte");
  };

  /* little postage-stamp icons for tools (generic drawings, not the brands' logos) */
  A.icon = {
    frame: '<path d="M10 4 V40 M34 4 V40 M4 10 H40 M4 34 H40" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
    layers: '<g fill="#fff" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"><path d="M22 26 L4 18 L22 10 L40 18 Z"/><path d="M4 24 L22 32 L40 24" fill="none"/><path d="M4 30 L22 38 L40 30" fill="none"/></g>',
    nib: '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"><path d="M22 4 L36 24 L28 38 H16 L8 24 Z" fill="#fff"/><path d="M22 4 V22" /><circle cx="22" cy="24" r="3" fill="' + INK + '"/></g>',
    keys: '<g stroke="' + INK + '" stroke-width="2.2"><path d="M4 30 H40" /><path d="M12 30 l6 -6 l6 6 l-6 6 Z" fill="#F2C230"/><path d="M28 30 l5 -5 l5 5 l-5 5 Z" fill="#fff"/><path d="M8 12 C16 4 28 4 36 12" fill="none" stroke-dasharray="3 3"/></g>',
    cube: '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"><path d="M22 4 L38 13 V31 L22 40 L6 31 V13 Z" fill="#fff"/><path d="M6 13 L22 22 L38 13 M22 22 V40" fill="none"/></g>',
    click: '<path d="M10 4 V32 L17 26 L22 38 L28 35 L23 24 L33 24 Z" fill="#fff" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>',
    spark: '<path d="M22 4 L26 18 L40 22 L26 26 L22 40 L18 26 L4 22 L18 18 Z" fill="#F2C230" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/><path d="M36 4 L37.5 9 L42 10.5 L37.5 12 L36 17 L34.5 12 L30 10.5 L34.5 9 Z" fill="#fff" stroke="' + INK + '" stroke-width="1.4"/>',
    film: '<g stroke="' + INK + '" stroke-width="2.2"><rect x="6" y="8" width="32" height="28" rx="3" fill="#fff"/><path d="M6 15 H38 M6 29 H38" /><path d="M18 18 L28 22 L18 26 Z" fill="' + INK + '"/></g>',
    chat: '<path d="M6 8 H38 V30 H20 L12 38 V30 H6 Z" fill="#fff" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/><path d="M22 12 L24 18 L30 19 L24 21 L22 27 L20 21 L14 19 L20 18 Z" fill="#E9A23B"/>',
    check: '<g stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linecap="round"><rect x="5" y="6" width="10" height="10" rx="2" fill="#fff"/><path d="M7.5 11 L10 13.5 L14 8"/><rect x="5" y="26" width="10" height="10" rx="2" fill="#fff"/><path d="M20 11 H39 M20 31 H39"/></g>'
  };

  /* passport-style ink entry stamps */
  A.entry = function (top, mid, bot, color, shape) {
    var plane = '<path d="M0 0 L10 -2 L16 -10 L19 -9 L16 -1 L24 0 L27 -4 L29 -3.5 L28 1 L29 5.5 L27 6 L24 2 L16 3 L19 11 L16 12 L10 4 L0 2 Z" fill="' + color + '" transform="translate(-14 0) scale(.9)"/>';
    var frame = shape === "oval"
      ? '<ellipse cx="80" cy="50" rx="74" ry="44" fill="none" stroke="' + color + '" stroke-width="4"/><ellipse cx="80" cy="50" rx="66" ry="36" fill="none" stroke="' + color + '" stroke-width="1.6"/>'
      : shape === "circle"
        ? '<circle cx="80" cy="50" r="46" fill="none" stroke="' + color + '" stroke-width="4"/><circle cx="80" cy="50" r="38" fill="none" stroke="' + color + '" stroke-width="1.6"/>'
        : '<rect x="6" y="8" width="148" height="84" rx="8" fill="none" stroke="' + color + '" stroke-width="4"/><rect x="13" y="15" width="134" height="70" rx="4" fill="none" stroke="' + color + '" stroke-width="1.6"/>';
    /* type sized to fit inside the frame (Courier is ~0.6em wide per letter) */
    var room = shape === "circle" ? 74 : shape === "oval" ? 112 : 124;
    var fit = function (t, max) { var n = t.replace(/&[a-z]+;/g, "x").length; return Math.min(max, room / (n * 0.6 + n * 0.12)).toFixed(1); };
    return '<svg viewBox="0 0 160 100" aria-hidden="true">' + frame +
      '<text x="80" y="38" text-anchor="middle" font-family="Special Elite,monospace" font-size="' + fit(top, 16) + '" letter-spacing="1.5" fill="' + color + '">' + top + "</text>" +
      '<g transform="translate(80 54)">' + plane + "</g>" +
      '<text x="80" y="78" text-anchor="middle" font-family="Special Elite,monospace" font-size="' + fit(bot, 13) + '" letter-spacing="1.5" fill="' + color + '">' + bot + "</text>" +
      (mid ? '<text x="' + (shape === "rect" ? 120 : 112) + '" y="59" text-anchor="middle" font-family="Special Elite,monospace" font-size="11" fill="' + color + '">' + mid + "</text>" : "") + "</svg>";
  };

  /* clips */
  A.binder = '<svg viewBox="0 0 70 70" aria-hidden="true"><path d="M20 26 C14 10 22 2 35 2 C48 2 56 10 50 26" fill="none" stroke="#A9A9A2" stroke-width="3.4"/><path d="M26 26 C22 14 28 8 35 8 C42 8 48 14 44 26" fill="none" stroke="#D6D6CF" stroke-width="2"/><path d="M6 26 H64 V48 C64 52 61 54 58 54 H12 C9 54 6 52 6 48 Z" fill="#285E3A" stroke="#173823" stroke-width="2"/><path d="M8 30 H62" stroke="#3E7D53" stroke-width="2.4"/><path d="M10 54 L14 62 H56 L60 54" fill="#1F4A2D"/></svg>';
  /* a thin silver paperclip, like the one on the folder CV reference */
  A.paperclip = '<svg viewBox="0 0 30 90" aria-hidden="true"><path d="M20 24 V70 C20 80 9 80 9 70 V14 C9 3 26 3 26 14 V64" fill="none" stroke="#9EA3A6" stroke-width="3" stroke-linecap="round"/><path d="M20 24 V70 C20 80 9 80 9 70 V14 C9 3 26 3 26 14 V64" fill="none" stroke="#EEF1F2" stroke-width="1.1" stroke-linecap="round" transform="translate(-.7 -.5)"/></svg>';
  window.JART = A;
})();

(function () {
  "use strict";
  /* ============================================================ the journal
     The notebook in the meadow opens into a green work journal. Pages are
     scrapbook collage built from the data below; they turn like real paper
     (grab a page and pull, click a corner, arrow keys), and the bits on them
     can be picked up and moved, folded notes open, polaroids lift.
     One page is 800 x 1040 design units; J(n) scales them to the screen. */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var R = window.R2, reduced = R.reduced, site = $("#site");
  var root = $("#journal"); if (!root) return;
  var stage = $(".j-stage", root), slotL = $(".j-slot.l", root), slotR = $(".j-slot.r", root), leaf = $(".j-leaf", root);
  var faceF = $(".j-face.front", leaf), faceB = $(".j-face.back", leaf), underL = $(".j-under.l", root), underR = $(".j-under.r", root);
  var hintEl = $(".j-hint", root), countEl = $(".j-count", root), prevBtn = $(".j-prev", root), nextBtn = $(".j-next", root);
  var DRIVE = "https://drive.google.com/file/d/1btNfa-B7rLPgWYI5pzXkS12cbSmnBby5/view?usp=sharing";

  /* ------------------------------------------------------------ helpers */
  function J(n) { return "calc(" + n + " * var(--j))"; }
  function box(x, y, w, h, r, z) {
    return "left:" + J(x) + ";top:" + J(y) + (w != null ? ";width:" + J(w) : "") + (h != null ? ";height:" + J(h) : "") + (r ? ";--r:" + r + "deg" : "") + (z ? ";z-index:" + z : "");
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var IMG = "f/";
  function tape(x, y, w, r, kind, color) { return '<i class="j-tape ' + (kind || "") + '" data-ends="1" style="' + box(x, y, w, null, r) + (color ? ";--tc:" + color : "") + '"></i>'; }
  function pola(src, cap, alt, x, y, w, h, r, extra) {
    return '<figure class="j-pola dr" data-w="' + (w + 28) + '" style="' + box(x, y, w + 28, h + 66, r) + '"><img src="' + IMG + src + '" alt="' + esc(alt) + '" draggable="false"><figcaption' + capFit(cap, w + 16) + ">" + esc(cap) + "</figcaption></figure>" + (extra || "");
  }
  function cut(src, alt, x, y, w, h, r, cap) { return '<figure class="j-cut dr" data-w="' + w + '" data-h="' + h + '" style="' + box(x, y, w, h, r) + '"><img src="' + IMG + src + '" alt="' + esc(alt) + '" draggable="false">' + (cap ? '<figcaption class="j-cutcap"' + capFit(cap, w + 40) + ">" + esc(cap) + "</figcaption>" : "") + "</figure>"; }
  /* captions keep the 20px hand size when they fit on one line, and shrink a little (never below 15px) when they don't */
  function capFit(cap, room) { var fs = Math.max(15, Math.min(20, room / (cap.length * 0.55))); return fs < 20 ? ' style="font-size:' + J(fs.toFixed(1)) + '"' : ""; }
  function snip(html, x, y, w, r, cls, tear) { return '<div class="j-snip ' + (cls || "") + '" data-tear="' + (tear || "b") + '" style="' + box(x, y, w, null, r) + '">' + html + "</div>"; }
  function note(html, x, y, w, r, cls) { return '<p class="j-note ' + (cls || "") + '" style="' + box(x, y, w, null, r) + '">' + html + "</p>"; }
  /* hand notes are written in Architects Daughter, the journal's one handwriting face */
  function hand(t, x, y, r, size) { return '<p class="j-h" style="' + box(x, y, null, null, r) + (size ? ";font-size:" + J(Math.round(size * 0.92)) : "") + '">' + t + "</p>"; }
  function type(t, x, y, r, cls, size) { return '<p class="j-type ' + (cls || "") + '" style="' + box(x, y, null, null, r) + (size ? ";font-size:" + J(size) : "") + '">' + t + "</p>"; }
  function sticker(src, alt, x, y, w, h, r) { return '<figure class="j-stk dr" style="' + box(x, y, w, h, r) + ';transform:rotate(var(--r,0deg))"><img src="' + IMG + src + '" alt="' + esc(alt) + '" draggable="false"></figure>'; }
  function wash(x, y, w, h, c) { return '<i class="j-wash" style="' + box(x, y, w, h) + ";background:radial-gradient(closest-side," + c + ',transparent)"></i>'; }
  function rubber(t, x, y, r, size) { return '<p class="j-rubber" style="' + box(x, y, null, null, r) + (size ? ";font-size:" + J(size) : "") + '">' + t + "</p>"; }
  function stamp(src, val, nm, x, y, w, h, r) { return '<figure class="j-stamp dr" style="' + box(x, y, w, h, r) + '"><span class="in"><img src="' + IMG + src + '" alt="" draggable="false"><b class="val">' + val + '</b><b class="nm">' + nm + "</b></span></figure>"; }
  var foldN = 0;
  function fold(title, small, inner, x, y, w, h, r, fc) {
    var id = "jf" + (++foldN);
    return '<div class="j-fold" style="' + box(x, y, w, h, r) + (fc ? ";--fc:" + fc : "") + '"><div class="fi" id="' + id + '">' + inner + '</div>' +
      '<button class="ff" type="button" aria-expanded="false" aria-controls="' + id + '"><span class="o"><small>' + esc(small) + "</small>" + esc(title) + '</span><span class="i"></span></button></div>';
  }
  var DAISY = function (petal, heart) {
    var p = ""; for (var i = 0; i < 12; i++) p += '<ellipse cx="50" cy="24" rx="7.5" ry="21" transform="rotate(' + (i * 30) + ' 50 50)" fill="' + petal + '" stroke="rgba(90,80,40,.25)" stroke-width="1"/>';
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + p + '<circle cx="50" cy="50" r="13" fill="' + heart + '"/><circle cx="46" cy="46" r="4" fill="rgba(255,255,255,.35)"/></svg>';
  };
  function flower(x, y, s, r, petal, heart) { return '<figure class="j-stk dr flower" aria-label="A pressed flower" style="' + box(x, y, s, s, r) + ';transform:rotate(var(--r,0deg))">' + DAISY(petal || "#FFFDF6", heart || "#F2C230") + "</figure>"; }
  function sprig(x, y, s, r) {
    return '<figure class="j-stk dr" aria-label="A pressed leaf" style="' + box(x, y, s, s * 1.6, r) + ';transform:rotate(var(--r,0deg))"><svg viewBox="0 0 60 96" aria-hidden="true"><path d="M30 94 C30 60 30 30 30 4" stroke="#5f7d3a" stroke-width="3" fill="none"/>' +
      [[18, 24, -1], [42, 34, 1], [16, 50, -1], [44, 60, 1], [20, 74, -1]].map(function (l) { return '<path d="M30 ' + (l[1] + 6) + ' Q' + (30 + l[2] * 26) + " " + (l[1] - 4) + " " + l[0] + " " + (l[1] - 10) + " Q" + (30 + l[2] * 6) + " " + (l[1] - 6) + ' 30 ' + (l[1] + 6) + 'Z" fill="#7fa04f" stroke="#55703a" stroke-width="1"/>'; }).join("") + "</svg></figure>";
  }
  function doodle(svg, x, y, w, h, r) { return '<svg class="j-doodle" viewBox="0 0 100 100" style="' + box(x, y, w, h, r) + ';transform:rotate(var(--r,0deg))" aria-hidden="true">' + svg + "</svg>"; }
  var STAR = '<path d="M50 8 L58 40 L92 50 L58 60 L50 92 L42 60 L8 50 L42 40Z"/>';
  var CLOUD = '<path d="M20 70 Q8 70 10 56 Q12 44 26 46 Q28 28 46 30 Q58 16 72 30 Q90 30 88 50 Q96 64 82 70 Z"/>';
  var ARROW = '<path d="M8 60 Q40 20 86 40"/><path d="M70 28 L88 40 L72 54"/>';
  var HEART = '<path d="M50 84 C20 62 10 44 22 30 C32 18 46 24 50 36 C54 24 68 18 78 30 C90 44 80 62 50 84Z"/>';
  var SUN = '<circle cx="50" cy="50" r="16"/><path d="M50 14v12M50 74v12M14 50h12M74 50h12M24 24l8 8M68 68l8 8M76 24l-8 8M32 68l-8 8"/>';
  function corner(dir) { return '<button class="j-corner" type="button" data-turn="' + dir + '" aria-label="' + (dir > 0 ? "Turn to the next page" : "Turn back a page") + '"></button>'; }
  function cta(html, x, y, r, attrs) { return '<a class="j-cta" ' + attrs + ' style="' + box(x, y, null, null, r) + '">' + html + "</a>"; }
  /* ---- more paper than torn snippets: cards, receipts, tickets, tags, stamps */
  var ART = window.JART;
  /* an inked illustration sticker (die-cut white edge from CSS) */
  function art(name, x, y, w, h, r) { return '<figure class="j-stk j-art dr" style="' + box(x, y, w, h, r) + ';transform:rotate(var(--r,0deg))">' + ART[name]() + "</figure>"; }
  function clip(kind, x, y, w, r) { return '<i class="j-clip" style="' + box(x, y, w, null, r) + '">' + ART[kind] + "</i>"; }
  /* a sheet on a coloured backing sheet; kind: index | grid | kraft | holes | green */
  function card(html, x, y, w, r, kind, back) {
    return '<div class="j-card ' + (kind || "") + '" style="' + box(x, y, w, null, r) + (back ? ";--back:" + back : "") + '"><i class="bk"></i><div class="fc">' + html + "</div></div>";
  }
  function receipt(html, x, y, w, r) { return '<div class="j-receipt" style="' + box(x, y, w, null, r) + '"><div class="rc">' + html + '<div class="rc-bar" aria-hidden="true"></div></div></div>'; }
  function ticket(html, stub, x, y, w, r, color) {
    return '<div class="j-ticket" style="' + box(x, y, w, null, r) + (color ? ";--tk:" + color : "") + '"><div class="tk"><div class="tk-m">' + html + '</div><div class="tk-s">' + stub + "</div></div></div>";
  }
  function tag(html, x, y, w, r, color) { return '<div class="j-tag" style="' + box(x, y, w, null, r) + (color ? ";--tg:" + color : "") + '">' + html + "</div>"; }
  /* passport entry stamp, inked straight onto the page */
  function entry(top, mid, bot, color, shape, x, y, w, r) { return '<figure class="j-ink" style="' + box(x, y, w, w * (shape === "circle" ? 0.62 : 0.62), r) + '">' + ART.entry(top, mid, bot, color, shape) + "</figure>"; }
  /* a postage stamp with a little drawn tool icon (generic drawings, not brand logos) */
  function pstamp(icon, label, val, x, y, w, r, bg) {
    return '<figure class="j-pst dr" style="' + box(x, y, w, w * 1.16, r) + (bg ? ";--ps:" + bg : "") + '"><span class="in"><b class="v">' + val + '</b><span class="lg' + (icon.length > 1 ? " two" : "") + '">' + icon.map(function (n) { return '<img src="' + IMG + "tools/" + n + (TOOL_SVG.indexOf(n) < 0 ? ".png" : ".svg") + '" alt="" draggable="false">'; }).join("") + '</span><b class="l">' + label + "</b></span></figure>";
  }
  /* Doha's own elements, used exactly as sent (only the background is removed):
     the Palestine sticker set, cassette, mint tea, Turkish coffee, the papers */
  function kst(name, alt, x, y, w, r, cls) { return '<figure class="j-kst dr ' + (cls || "") + '" style="' + box(x, y, w, null, r) + '"><img src="' + IMG + "k-" + name + '.webp" alt="' + esc(alt) + '" draggable="false"></figure>'; }
  /* a real paper cut-out with writing on it; pad = inner text box in % [top,right,bottom,left] */
  function rpaper(name, html, x, y, w, r, pad, cls) {
    return '<figure class="j-rp ' + (cls || "") + '" style="' + box(x, y, w, null, r) + '"><img src="' + IMG + "k-" + name + '.webp" alt="" draggable="false"><div class="rp-t" style="top:' + pad[0] + "%;right:" + pad[1] + "%;bottom:" + pad[2] + "%;left:" + pad[3] + '%">' + html + "</div></figure>";
  }
  /* the open manila folder the journey is kept in; tab label + where the tab sits */
  function folder(label, tabX) { return '<div class="j-folder" aria-hidden="true"><i class="ftab" style="left:' + J(tabX) + '"><span>' + label + "</span></i></div>"; }
  /* a white sheet (with sheets under it); clip = "paperclip" | "binder" | "" */
  function sheet(html, x, y, w, r, clipKind, under, cls) {
    return '<div class="j-sheet ' + (cls || "") + '" style="' + box(x, y, w, null, r) + '">' + (under === 0 ? "" : '<i class="u1"></i>' + (under > 1 ? '<i class="u2"></i>' : "")) +
      '<div class="sh">' + html + "</div>" + (clipKind ? '<i class="sclip ' + clipKind + '">' + ART[clipKind] + "</i>" : "") + "</div>";
  }
  /* one experience entry, written like the folder CV: role, company | dates, bullets */
  function job(role, where, bs) { return '<div class="job"><p class="role">' + role + '</p><p class="where">' + where + "</p>" + (bs && bs.length ? bullets(bs, "pen") : "") + "</div>"; }
  /* a photo in a clear badge holder on a lanyard */
  function badge(src, alt, x, y, w, r) {
    return '<figure class="j-badge dr" style="' + box(x, y, w, w * 1.3, r) + '"><i class="strap"></i><i class="hook"></i><span class="sleeve"><img src="' + IMG + src + '" alt="' + esc(alt) + '" draggable="false"></span></figure>';
  }
  function bullets(items, cls) { return '<ul class="j-list ' + (cls || "") + '">' + items.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>"; }

  /* ------------------------------------------------------------ the pages */
  var CATS = ["s-cream.webp", "s-black.webp", "s-orange.webp", "s-white.webp"];
  var P = [];
  /* 0 · inside the front cover */
  P.push({ cls: "endpaper", html:
    kst("tea", "Sticker: a glass of tea with fresh mint", 100, 90, 130, -8) +
    doodle(SUN, 600, 90, 110, 110, 0) +
    card('<h4>this journal belongs to</h4><h3>Rofaida Abdel-Wahap</h3>visual &amp; product designer<br>Nasr City, Cairo, Egypt', 60, 320, 430, -2, "index holes", "#A9BC8E") +
    clip("binder", 380, 290, 70, 6) +
    note("if found, please return it<br>to the meadow&hellip; or just say hi.", 70, 640, 360, -2, "small") +
    flower(330, 820, 110, 12) + flower(90, 800, 80, -20, "#F6D9E0", "#E9A23B") + sprig(230, 860, 60, 18) +
    '<figure class="j-stk j-standee dr" style="' + box(500, 270, 250, 740, 3) + ';transform:rotate(var(--r,0deg))"><img src="' + IMG + 'p-standee.webp" alt="Rofaida, drawn as a paper standee: glasses, a patterned scarf, green shirt, burgundy trousers, white sneakers" draggable="false"></figure>' });
  /* 1 · about me: "Who is Rofaida ?", Doha's own page (Oct 24) */
  P.push({ cls: "ruled", html:
    type("Who is Rofaida ?", 64, 66, -2) +
    sticker("s-white.webp", "Sticker: a fluffy white and black cat", 596, 36, 160, 140, 7) +
    note('A designer who likes turning <b>little ideas</b> into things people can <b>feel</b>.<br>I&rsquo;m Rofaida a Product Designer with a Graphic Design background, curious about people, obsessed with details, and always looking for the little spark that makes an experience feel special.', 70, 164, 680, 0, "who") +
    tag("<h4>studied</h4>Applied Arts &middot; Advertising<br>New Cairo Academy", 64, 500, 330, -3, "#D5DFC0") +
    tag("<h4>speaks</h4>Arabic, native<br>English, fluent", 440, 510, 260, 2, "#C8DDE3") +
    sticker("s-cream.webp", "Sticker: a cream cat with blue eyes", 40, 790, 150, 160, -6) +
    sticker("s-black.webp", "Sticker: a grumpy black cat", 140, 850, 150, 160, 7) +
    fold("a small brag", "open me", "<h4>top of the class</h4>Placed 3rd in my department and in the top ten of my cohort, four years in a row.", 330, 800, 220, 180, -3, "#E6D3A8") +
    hand("Always asking<br>why?", 570, 780, -7, 30) +
    sticker("s-orange.webp", "Sticker: a ginger cat with a question mark", 610, 880, 120, 112, 6) });
  /* 2 · things I love */
  P.push({ cls: "grid", html:
    wash(60, 80, 560, 380, "rgba(156,209,109,.55)") +
    type("things I love", 64, 60, -3, "dark") +
    pola("p-matcha.webp", "matcha is a personality trait", "Cartoon of a girl in sunglasses sipping matcha", 70, 170, 220, 220, -6, tape(120, 152, 130, 8, "", "#A9BC8E")) +
    pola("p-latte.webp", "daily dose of caffeine", "A glass of iced latte in the sun", 360, 150, 160, 210, 4, tape(390, 138, 110, -4, "dots")) +
    cut("p-bread.webp", "A loaf of homemade sourdough on a cooling rack", 570, 190, 180, 180, 6, "sourdough straight out of the oven") +
    pola("p-sushi.webp", "sushi fixes everything", "A platter of sushi rolls and noodles", 80, 500, 210, 190, 3, tape(140, 488, 120, -6, "grid", "#E9C46A")) +
    pola("p-eggs.webp", "slow mornings, please", "Two fried eggs with chilli flakes in a pan", 360, 470, 190, 220, -4) +
    cut("p-bowls.webp", "Three wooden bowls of salad with green dressing", 590, 520, 170, 130, -5) +
    note("matcha, mint tea, Turkish coffee, homemade<br>sourdough and a table full of good food.", 90, 860, 520, -1, "small") +
    kst("tea", "Sticker: a glass of tea with fresh mint", 600, 670, 130, 8) + kst("coffee", "Photo: Turkish coffee in a patterned cup", -10, 380, 140, -10, "real") + kst("watermelon", "Sticker: a slice of watermelon", 590, 860, 180, -8) + doodle(HEART, 650, 60, 70, 70, 10) });
  /* 3 · little trips */
  P.push({ cls: "", html:
    wash(180, 80, 560, 460, "rgba(156,198,217,.6)") +
    type("little trips", 470, 56, 3, "sage") +
    pola("p-nile.webp", "somewhere by the Nile", "Sunset over the Nile from under a parasol", 56, 110, 210, 260, -5, tape(100, 96, 130, -8, "kraft")) +
    pola("p-bahrain.webp", "Doha after dark", "Rofaida by the water with the Doha skyline behind her", 330, 160, 180, 240, 4, tape(370, 146, 110, 6, "dots", "#9CC6D9")) +
    cut("p-ship.webp", "The bridge of a ferry named Sinai 7", 560, 170, 200, 150, -4, "just passing through") +
    doodle('<path d="M6 92 Q30 40 70 46 T96 6" stroke-dasharray="4 7"/>', 560, 330, 200, 200, 0) + sticker("p-plane.webp", "Sticker: a little white plane", 570, 380, 200, 130, -14) +
    pola("p-makkah.webp", "a place of peace", "A street in Makkah at night", 70, 520, 190, 230, 3, tape(120, 508, 110, -5, "grid", "#A9BC8E")) +
    pola("p-scarf.webp", "after-hours by the sea", "Rofaida wrapped in a scarf on a beach at night", 320, 580, 250, 180, -4) +
    entry("CAIRO", "", "EGYPT &middot; 2026", "#B0302F", "rect", 590, 530, 190, -9) +
    entry("SAUDI ARABIA", "", "MAKKAH", "#2E6B3F", "oval", 586, 680, 200, 6) +
    entry("QATAR", "", "DOHA", "#7A1F2B", "circle", 610, 830, 180, -7) +
    kst("flag", "Sticker: the Palestinian flag", 270, 20, 130, -6) + kst("olive", "Sticker: an olive branch", 10, 800, 150, 8) +
    note("a few places that stayed with me.", 200, 950, 420, -1, "small") +
    doodle(CLOUD, 40, 30, 120, 80, 0) });
  /* 4 · the little things */
  P.push({ cls: "grid", html:
    type("the little things", 64, 56, -2) +
    cut("p-night.webp", "Rofaida at her desk at night, in a hoodie and headphones, under anime posters and a lamp", 60, 150, 230, 290, -4, "currently in my own world") +
    pola("p-aot.webp", "one more episode", "Anime still of two characters in uniform", 330, 140, 170, 170, 5, tape(370, 128, 110, -6, "dots")) +
    pola("p-sketch.webp", "ideas in progress", "A hand sketching a building in watercolour", 545, 180, 190, 150, -3, tape(590, 168, 110, 5)) +
    pola("p-catlaptop.webp", "my favorite distraction", "A cat yawning in front of a laptop", 60, 500, 180, 180, -5) +
    pola("p-desk.webp", "my creative corner", "Illustration of a cosy desk with posters and a lamp", 320, 450, 290, 180, 3, tape(420, 438, 120, -3, "grid", "#9CC6D9")) +
    pola("p-catsuit.webp", "the actual boss", "A cat in a suit holding an iced coffee", 560, 700, 170, 160, 6) +
    hand("calligraphy,<br>sketches &amp;<br>too many<br>anime posters", 404, 730, -4, 24) +
    kst("keffiyeh", "Sticker: a Palestinian keffiyeh", 650, 420, 120, 6) + kst("cassette", "Sticker: a vintage cassette tape", 90, 800, 220, -6) +
    doodle(STAR, 700, 60, 50, 50, 0) + doodle(STAR, 290, 700, 34, 34, 0) });
  /* 5 · my work journey: an index of jobs; hover or tap one and its own little sheet
     slides out of the folder (Doha, Oct 24: 5 spreads at most, details on demand) */
  /* PROJECT LINKS — fill these in when Doha sends them. behance / figma = full URLs;
     site = a case-study id from cases.js (e.g. "maaliy"). Empty = shown as "coming soon". */
  var WORK = [
    { y: "2026", when: "Jul &ndash; Sep 2026", role: "Product design intern", co: "MNT-Halan",
      did: ["<b>Simplified the application flow:</b> reduced the UAE Halan Card application from an initially proposed 4&ndash;5 steps to 3, keeping applicants&rsquo; details visible throughout the process.", "<b>Made support more accessible:</b> designed an AI-first Help Center for Halan Borsa, helping users find answers to common questions in-app before reaching the call center.", "<b>Streamlined the card request experience:</b> removed an unnecessary step from the physical-card request flow and prepared a Lottie animation for developer handoff.", "<b>Improved verification feedback:</b> prototyped and animated several takes on the verification-code step, so users get clear, immediate confirmation when their code is accepted."],
      more: '<p class="hw sm">all inside an existing design system</p>', links: { site: [["MNT-Halan case study", "halan"]] } },
    { y: "2026", when: "May &ndash; Jul 2026", role: "UI/UX design intern", co: "Xperience Software Solutions",
      did: ["Translated the SRS into a client-centered structure, bringing entries, invoices, and tax records into one view instead of scattering them across the system.", "Added a tax-deadline calendar with alerts, helping accountants keep track of upcoming obligations.", "Built an RTL design system across 14+ screens and 7 roles to maintain consistency as the product grows."], links: { site: [["Maaliy case study", "maaliy"]] } },
    { y: "2025&ndash;26", when: "2025 &ndash; Jun 2026 &middot; full time", role: "Graphic designer", co: "Zain Iq Group",
      did: ["Gave the Traubi and Dalya campaigns their own visual worlds, from posts and reels to motion", "Delivered branding, packaging and photo manipulation across the group&rsquo;s brands", "Brought AI tools into the team&rsquo;s workflow for campaign visuals"],
      more: '<p class="lbl">tools there</p><p class="hw sm">Photoshop, Illustrator, After Effects, Freepik AI, Kling AI</p>', links: { be: [["Traubi campaign", "https://www.behance.net/gallery/250717001/Traubi-SocialMedia-Campaign"], ["Dalya campaign", "https://www.behance.net/gallery/250732059/Dalya-SocialMedia-Campaign"]] } },
    { y: "2023", when: "2023", role: "Design intern", co: "GRAAPHI &middot; Social Nuts &middot; Animatix",
      did: ["GRAAPHI: shaped the social presence of the agency&rsquo;s page and of clients like Mediterraneo and Land Max Magam", "Social Nuts: turned the copywriters&rsquo; ideas into campaigns for KiloKabab, Misr Italia and ARPU", "Animatix: helped run a three-day animation event, guiding visitors and supporting the instructors"],
      links: { be: [["Kilo Kabab and Breadfast", "https://www.behance.net/gallery/194862413/Socia-media-post-designs-V1"]] } },
    { y: "2021&ndash;22", when: "2021 &ndash; 22", role: "Multimedia head", co: "Microsoft Student Partners (MSP)",
      did: ["Led the student media team: planned the sessions, shared out the work and followed it through", "Taught other students the basics of design: colour, type, layout and composition", "Recognised twice for it: best social media head and best graphic design head, 2022"],
      links: {} },
    { y: "2021", when: "2021", role: "Graphic design trainee", co: "Akhbar El-Youm newspaper",
      did: ["Learned the print side of design: printing processes, magazine ads and outdoor advertising, the base for my later branding work"], links: {} }
  ];
  function wlink(kind, label, v) {
    if (!v) return '<span class="lk soon" title="link coming soon"><b>' + label + "</b><small>coming soon</small></span>";
    if (kind === "site") return '<a class="lk" href="#work/' + v + '" data-jcase="' + v + '"><b>' + label + "</b><small>open the case study</small></a>";
    return '<a class="lk" href="' + v + '" target="_blank" rel="noopener"><b>' + label + " &#8599;</b><small>" + (kind === "behance" ? "on Behance" : "in Figma") + "</small></a>";
  }
  /* links per job: site = [[label, case id]], be = [[label, Behance URL]]; a job with no links shows no "see the work" */
  function wlinks(L) {
    var h = (L.site || []).map(function (l) { return '<a class="lk" href="#work/' + l[1] + '" data-jcase="' + l[1] + '"><b>' + l[0] + "</b><small>open the case study</small></a>"; }).join("") +
      (L.be || []).map(function (l) { return '<a class="lk" href="' + l[1] + '" target="_blank" rel="noopener"><b>' + l[0] + " &#8599;</b><small>on Behance</small></a>"; }).join("");
    return h ? '<p class="lbl">see the work</p><div class="jw-links">' + h + "</div>" : "";
  }
  function wpop(w, i) {
    return '<div class="j-sheet tight jw-pop" id="jw-pop-' + i + '" data-job="' + i + '" role="region" aria-label="' + esc(w.role.replace(/&[^;]+;/g, " ")) + '">' +
      '<i class="u1"></i><div class="sh"><button class="jw-x" type="button" aria-label="Close this sheet">&times;</button>' +
      '<p class="lbl">' + w.when + "</p>" + job(w.role, w.co, []) +
      '<p class="lbl">the impact</p>' + bullets(w.did, "pen") + (w.more || "") +
      wlinks(w.links) +
      "</div></div>";
  }
  P.push({ cls: "jfolder jwork", html:
    folder("work journey", 470) +
    badge("p-wall.webp", "Photo of Rofaida in front of a wall of posters", 56, 70, 250, -3) +
    sheet('<p class="lbl">name</p><p class="hw">Rofaida Abdelwahap</p><p class="lbl">role</p><p class="hw">Product &amp; visual designer</p><p class="lbl">based in</p><p class="hw">Cairo, Egypt</p>', 40, 470, 300, 3, "", 0, "torn") +
    kst("dove", "Sticker: a white dove", 150, 860, 150, -8) +
    WORK.map(wpop).join("") +
    sheet('<h2 class="ttl">My work<br>journey</h2><p class="hw sm jw-hint">From my first design role to where I am today.<br><span class="hov">Hover over a role</span><span class="tap">Tap a role</span> to explore the work behind it.</p>' +
      '<ol class="idx jw-idx">' + WORK.map(function (w, i) {
        return '<li><button class="jw-row" type="button" data-job="' + i + '" aria-expanded="false" aria-controls="jw-pop-' + i + '"><b>' + w.y + "</b><span>" + w.role + "<small>" + w.co.replace(/ \(MSP\)/, "").replace(/ Software Solutions| newspaper/, "") + "</small></span><i aria-hidden=\"true\"></i></button></li>"; }).join("") + "</ol>",
      372, 54, 398, 1.5, "paperclip", 2, "tight jw-index") });
  /* 6 · my learning journey: every kind of design I have tried, newest first, on one sheet */
  var LEARN = [
    ["2026", "UI/UX", "ux", "Advanced UI/UX workshop", "Xperience &middot; Apr &ndash; Jun 2026", "SaaS, ERP &amp; CRM dashboards and design systems"],
    ["2025", "UI/UX", "ux", "UI/UX Design course", "Route", "Research, personas, IA, wireframes and testing"],
    ["2024", "3D design", "d3", "3D Design course (3ds Max)", "DEPI", "Building 3D models and scenes in 3ds Max"],
    ["2024", "Calligraphy", "cal", "Persian calligraphy course", "Al-Azhar", "Writing Persian script by hand"],
    ["2020&ndash;25", "Graphic design", "gd", "B.A. Applied Arts, Advertising", "New Cairo Academy", "Excellent overall, 3rd in my department"]
  ];
  P.push({ cls: "grid", html:
    type("my learning journey", 56, 50, -2) +
    note("I like trying every kind of design: <b>UI/UX</b> (2 courses), <b>3D</b>, <b>calligraphy</b> and <b>graphic design</b>. Newest first:", 60, 128, 530, -1) +
    sheet('<ol class="jl-line">' + LEARN.map(function (l) {
      return '<li><b class="yr">' + l[0] + '</b><div><span class="jl-tag ' + l[2] + '">' + l[1] + '</span><p class="role">' + l[3] + '</p><p class="where">' + l[4] + '</p><p class="what">' + l[5] + "</p></div></li>"; }).join("") + "</ol>",
      40, 262, 580, -1, "binder", 1, "tight jl-sheet") +
    pola("p-laptop.webp", "work mode", "A laptop on a video call next to an iced matcha", 612, 120, 165, 135, 6, tape(655, 108, 100, -5, "", "#A9BC8E")) +
    kst("coffee", "Photo: Turkish coffee in a patterned cup, from above", 615, 800, 175, 8, "real") +
    hand("always<br>learning", 645, 520, 6, 28) + doodle(STAR, 700, 440, 44, 44, 0) });
  /* 7 · toolbox: a sheet of postage stamps */
  var TOOL_SVG = [];   /* all stamps use the PNG logos Doha sent on Nov 4 */
  /* each stamp shows the tool's own logo (Doha's files in f/tools/); Figma and Figma Make share one stamp and one logo */
  var TOOLS = [[["figma"], "Figma &middot; Figma Make"], [["photoshop"], "Photoshop"], [["illustrator"], "Illustrator"], [["after-effects"], "After Effects"], [["blender"], "Blender"], [["3ds-max"], "3ds Max"],
    [["framer"], "Framer"], [["claude"], "Claude"], [["freepik-ai"], "Freepik AI"], [["kling-ai"], "Kling AI"], [["notion"], "Notion"], [["jira"], "Jira"]];
  var PS = ["#C8DDE3", "#F1D2C8", "#D5DFC0", "#F2DFA6"];
  P.push({ cls: "grid", html:
    type("my toolbox", 64, 56, -2, "dark") +
    TOOLS.map(function (t, i) { return pstamp(t[0], t[1], [25, 50, 10][i % 3], 60 + (i % 4) * 172, 160 + Math.floor(i / 4) * 178, 138, [-3, 2, -1, 3][(i + Math.floor(i / 4)) % 4], PS[(i + Math.floor(i / 4)) % 4]); }).join("") +
    card("<h4>what I&rsquo;m good at</h4>" + bullets(["Graphic design", "Branding &amp; identity", "Packaging", "Social media", "Typography", "Calligraphy", "Layout", "Motion graphics", "Photo manipulation", "UX research", "Design systems"], "dot two"),
      56, 720, 470, -1, "index", "#DDC293") +
    tag("<h4>languages</h4>Arabic &middot; native<br>English &middot; fluent", 548, 724, 228, 4, "#C8DDE3") +
    art("swatches", 580, 880, 150, 107, -8) });
  /* 8 · to be continued */
  P.push({ cls: "ruled", html:
    wash(100, 120, 620, 520, "rgba(231,169,160,.45)") +
    hand("to be continued&hellip;", 80, 150, -3, 58) +
    note("The next page is still blank. I&rsquo;m open to product design roles and selected freelance work, where a <b>visual eye</b> and <b>product thinking</b> meet.", 80, 300, 600, -1) +
    cta("Let&rsquo;s talk &rarr;", 90, 540, -2, 'href="#contact" data-jgo="contact"') +
    cta("My resume &#8599;", 390, 540, 2, 'href="' + DRIVE + '" target="_blank" rel="noopener"') +
    kst("olive", "Sticker: an olive branch", 60, 700, 170, -6) + kst("watermelon", "Sticker: a slice of watermelon", 280, 740, 190, 6) +
    sticker("s-orange.webp", "Sticker: a ginger cat with a question mark", 520, 720, 130, 121, -6) + kst("key", "Sticker: the key of return", 680, 650, 80, 14) });
  /* 9 · inside the back cover */
  P.push({ cls: "endpaper", html:
    hand("thanks for reading<br>my journal", 120, 300, -3, 40) +
    doodle(HEART, 520, 330, 70, 70, 8) +
    flower(170, 600, 110, 12) + flower(330, 640, 80, -20, "#F6D9E0", "#E9A23B") + sprig(450, 600, 70, 18) +
    kst("flag", "Sticker: the Palestinian flag", 540, 760, 140, -6) +
    doodle(SUN, 600, 90, 110, 110, 0) });

  var COVER = '<div class="j-cover-out" aria-label="The journal, closed. Click to open."><div class="lab"><b>work journal</b><span>Rofaida&rsquo;s<br>little notebook</span><i>work, pictures &amp; the little things</i></div><p class="tapnote">open me</p></div>';

  /* ---------------------------------------------------------- build pages */
  var seq = [], total = P.length;
  (function build() {
    var c = document.createElement("div"); c.className = "j-page cover"; c.innerHTML = COVER; seq.push(c);
    P.forEach(function (p, i) {
      var el = document.createElement("div"), side = i % 2 ? "right" : "left";
      el.className = "j-page " + side + " " + p.cls; el.setAttribute("data-p", i);
      el.innerHTML = p.html + '<span class="j-pno">' + (i ? i : "") + "</span>" + (i < total - 1 && side === "right" ? corner(1) : "") + (side === "left" ? corner(-1) : "") + (side === "right" && i === total - 1 ? "" : "");
      seq.push(el);
    });
    var blank = document.createElement("div"); blank.className = "j-page left blank"; seq.blank = blank;
    R.journalPages = seq.slice(1);   /* page p of the journal = P[p]; edit mode keys these */
  })();
  /* torn edges and tape ends, as % polygons so they scale with the page */
  function rng(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
  function tear(el, i) {
    var sides = el.getAttribute("data-tear") || "", w = el.offsetWidth || 1, h = el.offsetHeight || 1, r = rng(i * 131 + 7), pts = [];
    var dX = 7 / w * 100, dY = 7 / h * 100, n;
    function jag(d) { return (r() * 0.75 + 0.25) * d; }
    n = Math.max(6, Math.round(w / 9)); for (var k = 0; k <= n; k++) pts.push([k / n * 100, sides.indexOf("t") > -1 ? jag(dY) : 0]);
    n = Math.max(6, Math.round(h / 9)); for (k = 0; k <= n; k++) pts.push([sides.indexOf("r") > -1 ? 100 - jag(dX) : 100, k / n * 100]);
    n = Math.max(6, Math.round(w / 9)); for (k = 0; k <= n; k++) pts.push([100 - k / n * 100, sides.indexOf("b") > -1 ? 100 - jag(dY * 1.4) : 100]);
    n = Math.max(6, Math.round(h / 9)); for (k = 0; k <= n; k++) pts.push([sides.indexOf("l") > -1 ? jag(dX) : 0, 100 - k / n * 100]);
    el.style.clipPath = "polygon(" + pts.map(function (p) { return p[0].toFixed(2) + "% " + p[1].toFixed(2) + "%"; }).join(",") + ")";
  }
  function tapeEnds(el, i) {
    var w = el.offsetWidth || 1, r = rng(i * 53 + 3), d = 6 / w * 100, pts = [], n = 6, k;
    for (k = 0; k <= n; k++) pts.push([(k % 2 ? d : 0) + r() * d * 0.4, k / n * 100]);
    for (k = n; k >= 0; k--) pts.push([100 - (k % 2 ? d : 0) - r() * d * 0.4, k / n * 100]);
    el.style.clipPath = "polygon(" + pts.map(function (p) { return p[0].toFixed(2) + "% " + p[1].toFixed(2) + "%"; }).join(",") + ")";
  }
  /* pages only have a size once they are in the book, so each one is crafted
     the first time it is shown (polygons are in %, so they survive resizes) */
  function craft() {
    seq.forEach(function (pg) {
      if (pg.dataset.crafted || !pg.isConnected || pg.offsetWidth < 2) return;
      pg.dataset.crafted = "1";
      $$("[data-tear]", pg).forEach(tear);
      $$(".j-tape[data-ends]", pg).forEach(tapeEnds);
    });
  }

  /* ---------------------------------------------------------- layout */
  var single = false, s = 0, busy = false, isOpen = false, opener = null;
  function size() {
    var W = innerWidth, H = innerHeight;
    single = W < 820 || W / H < 1.05;
    root.classList.toggle("single", single);
    if (hintEl) hintEl.textContent = single ? "swipe to turn \u00b7 tap a note to read it" : "drag a corner to turn \u00b7 pick things up \u00b7 click a note to read it";
    var j = single ? Math.min(W - 28, (H - 130) * 800 / 1040) / 800 : Math.min(W * 0.88 - 60, (H - 122) * 1600 / 1040) / 1600;
    root.style.setProperty("--j", Math.max(0.2, j).toFixed(4) + "px");
  }
  function maxS() { return single ? total : Math.ceil(total / 2); }
  /* where every page goes for state s */
  function show() {
    [slotL, slotR, faceF, faceB].forEach(function (c) { while (c.firstChild) c.removeChild(c.firstChild); });
    leaf.classList.remove("on", "cover"); leaf.style.transform = ""; stage.style.transform = "";
    root.classList.remove("turning", "closing", "grabbing");
    underR.style.opacity = underL.style.opacity = "0";
    if (single) { slotR.appendChild(seq[s]); }
    else {
      if (s > 0) slotL.appendChild(seq[2 * s - 1]);
      if (2 * s < seq.length) slotR.appendChild(seq[2 * s]);
    }
    root.classList.toggle("closed", s === 0); root.classList.toggle("shut", s === 0);
    var n = maxS();
    countEl.textContent = s === 0 ? "cover" : single ? "page " + s + " of " + total : "spread " + s + " of " + n;
    prevBtn.disabled = s === 0; nextBtn.disabled = s >= n;
    $$(".j-page", root).forEach(function (pg) {
      var vis = pg.parentNode === slotL || pg.parentNode === slotR;
      pg.inert = !vis; pg.setAttribute("aria-hidden", String(!vis));
    });
    craft();
  }
  /* --------------------------------------------------- turning the leaf */
  var turnRaf = 0, tState = null;
  function frontOf(dir) {           /* pages that ride on the leaf for a turn starting now */
    /* one page at a time: the page has no back to show, so it lifts, turns
       edge-on and is gone, instead of a blank card swinging off the left edge */
    if (single) return dir > 0 ? { f: seq[s], b: null, under: seq[s + 1] } : { f: seq[s - 1], b: null, under: null };
    return dir > 0 ? { f: seq[2 * s], b: seq[2 * s + 1], under: seq[2 * s + 2] } : { f: seq[2 * s - 2], b: seq[2 * s - 1], under: seq[2 * s - 3] };
  }
  function canTurn(dir) { return dir > 0 ? s < maxS() : s > 0; }
  function begin(dir) {
    if (jw.i > -1) jwHide();
    closeReader();
    var t = frontOf(dir);
    [faceF, faceB].forEach(function (c) { while (c.firstChild) c.removeChild(c.firstChild); });
    faceF.appendChild(t.f); faceF.appendChild(curlEl(1));
    if (t.b) { faceB.appendChild(t.b); faceB.appendChild(curlEl(-1)); }
    if (dir > 0) { if (t.under) slotR.appendChild(t.under); }
    else if (single) { /* the page we're on stays put underneath */ }
    else { while (slotL.firstChild) slotL.removeChild(slotL.firstChild); if (t.under) slotL.appendChild(t.under); }
    leaf.classList.add("on");
    /* opening or closing: the book slides to its new centre while the cover
       swings (not after), and the left board only exists under the cover */
    var coverTurn = !single && ((dir > 0 && s === 0) || (dir < 0 && s === 1));
    leaf.classList.toggle("cover", coverTurn);
    if (coverTurn) { root.classList.add("shut"); root.classList.remove("closed"); }
    tState = { dir: dir, t: dir > 0 ? 0 : 1 };
    root.classList.add("turning");
    if (dir < 0 && s === 1 && !single) root.classList.add("closing");
    craft();
    paint(tState.t);
  }
  var curls = {};
  function curlEl(k) { var e = curls[k] || (curls[k] = document.createElement("i")); e.className = "j-curl"; return e; }
  function paint(t) {                  /* t: 0 = lying on the right, 1 = turned over onto the left */
    tState.t = t;
    var lift = Math.sin(Math.PI * t), tilt = lift * 4;
    leaf.style.transform = "rotateY(" + (-180 * t).toFixed(2) + "deg) rotateZ(" + (tilt * (t < 0.5 ? -1 : 1) * 0.3).toFixed(2) + "deg)";
    if (curls[1]) curls[1].style.opacity = (t < 0.5 ? lift : 0).toFixed(3);
    if (curls[-1]) curls[-1].style.opacity = (t > 0.5 ? lift * 0.8 : 0).toFixed(3);
    /* the leaf's shadow falls on the page it uncovers, hugging the leaf's
       outer edge and clipped to that page, so it never spills onto the grass */
    var w = slotR.offsetWidth, edge = Math.abs(Math.cos(Math.PI * t)) * w;
    underR.style.opacity = (t < 0.5 ? lift : 0).toFixed(3);
    underR.style.transform = "translateX(" + edge.toFixed(1) + "px)";
    underR.style.clipPath = "inset(0 " + edge.toFixed(1) + "px 0 0)";
    underL.style.opacity = (t > 0.5 ? lift * 0.9 : 0).toFixed(3);
    underL.style.transform = "translateX(" + (-edge).toFixed(1) + "px)";
    underL.style.clipPath = "inset(0 0 0 " + edge.toFixed(1) + "px)";
    /* opening/closing: the book recentres in step with the cover */
    if (leaf.classList.contains("cover")) stage.style.transform = "translateX(" + (-(1 - t) * slotR.offsetWidth / 2).toFixed(1) + "px)";
  }
  function finish(commit) {
    var dir = tState.dir;
    root.classList.remove("turning", "closing");
    underR.style.opacity = underL.style.opacity = "0";
    if (commit) s += dir;
    tState = null; show(); stage.style.transform = ""; busy = false;
    if (commit && R.soundOn && R.soundOn()) rustle();
  }
  function animate(to, quick) {
    cancelAnimationFrame(turnRaf);
    var from = tState.t, dist = Math.abs(to - from);
    if (reduced) { paint(to); finish((tState.dir > 0) === (to === 1)); return; }
    var dur = (quick ? 340 : 520) + 520 * dist, t0 = -1;
    var ez = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    busy = true;
    /* the clock starts on the first painted frame, and k never goes below 0: a
       rAF timestamp can be older than performance.now(), and a negative k sent
       the page swinging the wrong way (outwards) before it turned */
    (function step(now) {
      if (t0 < 0) t0 = now;
      var k = Math.max(0, Math.min(1, (now - t0) / dur));
      paint(from + (to - from) * ez(k));
      if (k < 1) turnRaf = requestAnimationFrame(step); else finish((tState.dir > 0) === (to === 1));
    })(performance.now());
  }
  function turn(dir, quick) {
    if (busy || tState || !canTurn(dir)) return false;
    begin(dir); animate(dir > 0 ? 1 : 0, quick); return true;
  }
  R.journalTurn = turn;
  function rustle() { return; }   /* Nov 7: no sound effects */
  function rustleOff() {
    var a = R.ctx && R.ctx(); if (!a) return;
    var len = a.sampleRate * 0.45, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * i / len), 2);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 0.7; g.gain.value = 0.07;
    src.connect(f); f.connect(g); g.connect(R.master()); src.start();
  }

  /* --------------------------------------------- grab a page and pull it */
  var drag = null, swallow = false;
  function pageDir(pg) { if (pg.parentNode === slotR) return 1; if (pg.parentNode === slotL) return -1; return 0; }
  stage.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || busy || tState) return;
    var pg = e.target.closest(".j-page"); if (!pg) return;
    if (pg.classList.contains("cover")) return;
    if (e.target.closest(".dr,.j-fold,a,button:not(.j-corner),.jw-pop.on")) return;
    var dir = pageDir(pg); if (!dir) return;
    if (single) dir = e.clientX > pg.getBoundingClientRect().left + pg.offsetWidth * 0.5 ? 1 : -1;
    if (!canTurn(dir)) return;
    drag = { dir: dir, x0: e.clientX, y0: e.clientY, on: false, id: e.pointerId, w: slotR.offsetWidth, lx: e.clientX, lt: performance.now(), v: 0 };
  });
  addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = drag.x0 - e.clientX, dy = e.clientY - drag.y0;
    if (!drag.on) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.2 || (drag.dir > 0 ? dx < 0 : dx > 0)) { drag = null; return; }
      drag.on = true; begin(drag.dir); root.classList.add("grabbing");
    }
    var now = performance.now(), dt = Math.max(8, now - drag.lt);
    drag.v = drag.v * 0.5 + ((drag.lx - e.clientX) / dt) * 0.5; drag.lx = e.clientX; drag.lt = now;
    var t = drag.dir > 0 ? dx / (drag.w * 1.6) : 1 + dx / (drag.w * 1.6);
    paint(Math.max(0, Math.min(1, t)));
    e.preventDefault();
  }, { passive: false });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; root.classList.remove("grabbing");
    if (!d.on) return;
    swallow = true; setTimeout(function () { swallow = false; }, 0);
    var t = tState.t, to;
    if (d.dir > 0) to = d.v > 0.4 ? 1 : d.v < -0.4 ? 0 : (t > 0.4 ? 1 : 0);
    else to = d.v < -0.4 ? 0 : d.v > 0.4 ? 1 : (t < 0.6 ? 0 : 1);
    animate(to, true);
  }
  addEventListener("pointerup", endDrag); addEventListener("pointercancel", endDrag);
  root.addEventListener("click", function (e) {
    if (swallow) { e.stopPropagation(); e.preventDefault(); return; }
    var c = e.target.closest(".j-corner"); if (c) { turn(+c.getAttribute("data-turn")); return; }
    if (e.target.closest(".j-cover-out")) { turn(1); return; }
    var f = e.target.closest(".j-fold .ff");
    if (f) { var fd = f.parentNode, on = !fd.classList.contains("open"); fd.classList.toggle("open", on); f.setAttribute("aria-expanded", String(on)); if (on && R.soundOn && R.soundOn()) rustle(); return; }
    var jr = e.target.closest(".jw-row");
    if (jr) { var ji = +jr.getAttribute("data-job"); if (single) { jwHide(); openReader($("#jw-pop-" + ji, root), jr); return; } if (jw.i === ji && jw.pin) jwHide(); else jwShow(ji, true); return; }
    if (e.target.closest(".jw-x")) { jwHide(); return; }
    var jc = e.target.closest("[data-jcase]");
    if (jc) { e.preventDefault(); var cid = jc.getAttribute("data-jcase"); jwHide(); close(true); R.route("works"); setTimeout(function () { if (R.openCase) R.openCase(cid); }, reduced ? 0 : 900); return; }
    if (jw.i > -1 && !e.target.closest(".jw-pop,.jw-index")) jwHide();
    var rd = e.target.closest(READABLE);
    if (rd && rd.closest(".j-slot") && !e.target.closest("a,button,input") && !(R.isEditing && R.isEditing())) { openReader(rd, rd); return; }
    var go = e.target.closest("[data-jgo]");
    if (go) { e.preventDefault(); var where = go.getAttribute("data-jgo"); close(true); R.route(where); return; }
  }, true);
  /* ------------------------------------------- read it bigger (UX pass, Oct 24)
     The collage is drawn for an 800 x 1040 page, so on phones and small laptops its
     writing is tiny. Tap or click a sheet, note, tag or card and a clean copy of it
     opens on its own at reading size (Archivo ~16px); Esc, the X or the backdrop
     close it and focus goes back where it was. On phones a job row opens its sheet
     straight in the reader. */
  var READABLE = ".j-sheet:not(.jw-index),.j-rp,.j-card,.j-tag,.j-note,.j-snip";
  var reader = document.createElement("div");
  reader.className = "j-reader"; reader.hidden = true;
  reader.setAttribute("role", "dialog"); reader.setAttribute("aria-modal", "true"); reader.setAttribute("aria-label", "Reading a note from the journal");
  reader.innerHTML = '<div class="jr-back"></div><div class="jr-card"><button class="jr-x" type="button" aria-label="Close and go back to the journal">&times;</button><div class="jr-in"></div></div>';
  root.appendChild(reader);
  var jrIn = $(".jr-in", reader), jrX = $(".jr-x", reader), jrFrom = null;
  function openReader(src, from) {
    if (!src) return;
    var c = src.cloneNode(true);
    [c].concat($$("*", c)).forEach(function (n) {
      ["id", "style", "aria-hidden", "data-eb", "data-ek", "data-ef", "data-fm", "data-eb-saved", "data-ek-saved", "data-ef-saved", "data-jx", "data-jy", "data-em", "data-tear", "contenteditable", "tabindex"].forEach(function (a) { n.removeAttribute(a); });
      if (n.classList) n.classList.remove("on", "dr", "lifted", "held", "ed-sel", "ed-hidden");
    });
    $$(".u1,.u2,.sclip,.jw-x", c).forEach(function (n) { n.remove(); });
    c.classList.add("in-reader");
    jrIn.innerHTML = ""; jrIn.appendChild(c);
    jrFrom = from || document.activeElement;
    reader.hidden = false; root.classList.add("reading");
    $(".jr-card", reader).scrollTop = 0;
    if (!reduced) {
      $(".jr-card", reader).animate([{ opacity: 0, transform: "translateY(16px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.16,1,.3,1)" });
      $(".jr-back", reader).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
    if (R.soundOn && R.soundOn()) rustle();
    jrX.focus({ preventScroll: true });
  }
  function closeReader() {
    if (reader.hidden) return;
    reader.hidden = true; root.classList.remove("reading"); jrIn.innerHTML = "";
    if (jrFrom && jrFrom.focus && jrFrom.isConnected) { try { jrFrom.focus({ preventScroll: true }); } catch (x) {} }
    jrFrom = null;
  }
  R.readerOpen = function () { return !reader.hidden; };
  jrX.addEventListener("click", closeReader);
  $(".jr-back", reader).addEventListener("click", closeReader);
  reader.addEventListener("keydown", function (e) { if (e.key === "Tab") { e.preventDefault(); jrX.focus(); } });   /* the X is the only control: keep focus in the dialog */

  /* ------------------------------------- work journey: pull out a job's sheet */
  var jw = { i: -1, pin: false, t: 0 };
  function jwShow(i, pin) {
    clearTimeout(jw.t); jw.i = i; jw.pin = !!pin;
    $$(".jw-pop", root).forEach(function (p) { p.classList.toggle("on", +p.getAttribute("data-job") === i); });
    $$(".jw-row", root).forEach(function (b) { var on = +b.getAttribute("data-job") === i; b.classList.toggle("on", on); b.setAttribute("aria-expanded", String(on)); });
    if (pin && R.soundOn && R.soundOn()) rustle();
  }
  function jwHide() {
    clearTimeout(jw.t); jw.i = -1; jw.pin = false;
    $$(".jw-pop.on", root).forEach(function (p) { p.classList.remove("on"); });
    $$(".jw-row.on", root).forEach(function (b) { b.classList.remove("on"); b.setAttribute("aria-expanded", "false"); });
  }
  R.jwState = function () { return { i: jw.i, pin: jw.pin }; };
  root.addEventListener("pointerover", function (e) {
    if (e.pointerType !== "mouse" || tState || drag) return;
    var row = e.target.closest(".jw-row");
    if (row) { var i = +row.getAttribute("data-job"); clearTimeout(jw.t); if (jw.i !== i && !jw.pin) jw.t = setTimeout(function () { jwShow(i, false); }, jw.i > -1 ? 220 : 70); return; }   /* slower switch while a sheet is open, so a diagonal move toward it does not flip to the next job */
    if (e.target.closest(".jw-pop.on,.jw-index")) { clearTimeout(jw.t); return; }
    if (jw.i > -1 && !jw.pin) { clearTimeout(jw.t); jw.t = setTimeout(jwHide, 280); }
  });
  root.addEventListener("focusin", function (e) { var row = e.target.closest(".jw-row"); if (row && e.target.matches(":focus-visible")) jwShow(+row.getAttribute("data-job"), false); });
  root.addEventListener("keydown", function (e) { if (e.key === "Escape" && !reader.hidden) { e.stopPropagation(); e.preventDefault(); closeReader(); return; } if (e.key === "Escape" && jw.i > -1) { e.stopPropagation(); e.preventDefault(); var b = $('.jw-row[data-job="' + jw.i + '"]', root); jwHide(); if (b) b.focus({ preventScroll: true }); } }, true);
  prevBtn.addEventListener("click", function () { turn(-1); });
  nextBtn.addEventListener("click", function () { turn(1); });
  $(".j-close", root).addEventListener("click", function () { close(); });
  $(".j-scrim", root).addEventListener("click", function () { close(); });

  /* ------------------------------------------ pick things up and move them */
  var held = null, zTop = 30;
  function jpx() { return parseFloat(root.style.getPropertyValue("--j")) || 1; }
  root.addEventListener("pointerdown", function (e) {
    var it = e.target.closest(".j-page .dr"); if (!it || e.button > 0 || tState) return;
    var pg = it.closest(".j-page"), pr = pg.getBoundingClientRect(), r = it.getBoundingClientRect();
    /* positions are kept in page units (J) so they hold at any screen size */
    var jp = jpx(), dx = (+it.dataset.jx || 0) * jp, dy = (+it.dataset.jy || 0) * jp;
    held = { it: it, id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: dx, dy: dy, moved: false,
      lim: { x0: pr.left - (r.left - dx) - r.width * 0.3, x1: pr.right - (r.right - dx) + r.width * 0.3, y0: pr.top - (r.top - dy) - r.height * 0.3, y1: pr.bottom - (r.bottom - dy) + r.height * 0.3 } };
    try { it.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault(); e.stopPropagation();
  }, true);
  root.addEventListener("pointermove", function (e) {
    if (!held || e.pointerId !== held.id) return;
    var mx = e.clientX - held.x0, my = e.clientY - held.y0;
    if (!held.moved && Math.abs(mx) + Math.abs(my) < 4) return;
    if (!held.moved) { held.moved = true; held.it.classList.add("held"); held.it.style.zIndex = ++zTop; held.it.classList.remove("lifted"); }
    var nx = Math.min(held.lim.x1, Math.max(held.lim.x0, held.dx + mx)), ny = Math.min(held.lim.y1, Math.max(held.lim.y0, held.dy + my));
    var jp = jpx(), jx = nx / jp, jy = ny / jp;
    held.it.dataset.jx = jx.toFixed(2); held.it.dataset.jy = jy.toFixed(2);
    held.it.style.translate = "calc(" + jx.toFixed(2) + " * var(--j)) calc(" + jy.toFixed(2) + " * var(--j))";
    if (R.isEditing && R.isEditing()) held.it.dataset.em = "1";
  });
  function drop(e) {
    if (!held || e.pointerId !== held.id) return;
    var h = held; held = null; h.it.classList.remove("held");
    if (!h.moved) {               /* a tap: polaroids lift for a closer look, stickers wiggle */
      if (h.it.classList.contains("j-pola")) { var on = !h.it.classList.contains("lifted"); $$(".j-pola.lifted", root).forEach(function (p) { p.classList.remove("lifted"); }); h.it.classList.toggle("lifted", on); if (on) h.it.style.zIndex = ++zTop; }
      else if (!reduced && h.it.animate) h.it.animate([{ rotate: "0deg" }, { rotate: "-8deg" }, { rotate: "6deg" }, { rotate: "0deg" }], { duration: 500, easing: "ease-out" });
    }
  }
  root.addEventListener("pointerup", drop); root.addEventListener("pointercancel", drop);

  /* ------------------------------------------------- open, close, keys */
  function open(at, from) {
    if (isOpen) return;
    isOpen = true; opener = from || null; opening = true;
    size(); s = 0; show();
    root.classList.add("open"); root.setAttribute("aria-hidden", "false");
    site.setAttribute("data-sheet", "journal"); $("#world").inert = true;
    craft();
    if (!reduced) stage.animate([{ opacity: 0, transform: "translateX(" + (single ? 0 : -slotR.offsetWidth / 2) + "px) translateY(60px) scale(.82) rotate(-4deg)" }, { opacity: 1, transform: "translateX(" + (single ? 0 : -slotR.offsetWidth / 2) + "px)" }],
      { duration: 650, easing: "cubic-bezier(.16,1,.3,1)" });
    setTimeout(function () {
      if (!isOpen) { opening = false; return; }
      if (!(at > 0)) { opening = false; return; }
      turn(1);
      setTimeout(function step() { if (!isOpen) { opening = false; return; } if (busy || tState) { setTimeout(step, 60); return; } if (s < at) { turn(1, true); setTimeout(step, 60); } else opening = false; }, 60);
      $(".j-close", root).focus({ preventScroll: true });
    }, reduced ? 0 : 520);
  }
  var opening = false;
  function close(instant) {
    if (!isOpen) return;
    isOpen = false; cancelAnimationFrame(turnRaf); drag = null; closeReader();
    if (tState) { tState = null; busy = false; show(); }   /* closed mid-turn: put every page back */
    $$(".j-pola.lifted", root).forEach(function (p) { p.classList.remove("lifted"); });
    var done = false;
    function fin() {
      if (done || isOpen) return; done = true;
      root.classList.remove("open"); root.setAttribute("aria-hidden", "true");
      site.removeAttribute("data-sheet"); $("#world").inert = site.getAttribute("data-mode") !== "world";
      if (!instant && opener) opener.focus({ preventScroll: true });
    }
    if (reduced || instant) { fin(); return; }
    var from = getComputedStyle(stage).transform; if (!from || from === "none") from = "translateX(0px)";
    var a = stage.animate([{ opacity: 1, transform: from }, { opacity: 0, transform: from + " translateY(60px) scale(.86) rotate(3deg)" }], { duration: 420, easing: "cubic-bezier(.7,0,.84,0)" });
    a.onfinish = fin; setTimeout(fin, 700);   /* slow frames never strand the dialog */
  }
  R.journalOpen = open; R.journalClose = close; R.journalState = function () { return { s: s, max: maxS(), single: single, open: isOpen, busy: busy || opening || !!tState }; };
  /* the notebook's two pages now open this journal */
  R.openSheet = function (kind, from) { size(); open(kind === "pixels" ? (single ? 3 : 2) : (single ? 2 : 1), from); };
  R.closeSheet = function (instant) { close(instant); };
  addEventListener("keydown", function (e) {
    if (!isOpen) return;
    if (!reader.hidden) { if (e.key === "Escape") { closeReader(); e.preventDefault(); } return; }
    if (e.key === "Escape") { if (jw.i > -1) jwHide(); else if ($(".j-pola.lifted", root)) $$(".j-pola.lifted", root).forEach(function (p) { p.classList.remove("lifted"); }); else close(); e.preventDefault(); }
    else if (e.key === "ArrowRight" || e.key === "PageDown") { turn(1); e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { turn(-1); e.preventDefault(); }
  });
  addEventListener("resize", function () { if (!isOpen) return; var was = single; size(); if (was !== single) { s = single ? (s > 0 ? 2 * s - 1 : 0) : Math.ceil(s / 2); s = Math.min(s, maxS()); }   /* stay on the same page across layouts */ if (!tState) show(); craft(); });
  /* swipe on phones */
  var sw = null;
  root.addEventListener("touchstart", function (e) { if (e.target.closest(".dr,.j-fold,a,button")) return; sw = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
  root.addEventListener("touchend", function (e) {
    if (!sw) return; var t = e.changedTouches[0], dx = t.clientX - sw[0], dy = t.clientY - sw[1]; sw = null;
    if (!drag && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var R = window.R2, reduced = R.reduced, site = $("#site");
  var layer = $("#contactPage"), prev = "world", lastFocus = null;

  /* the headphones open a line to her */
  R.openContact = function () {
    var m = site.getAttribute("data-mode");
    if (m === "contact") return;
    if (site.hasAttribute("data-sheet") && R.closeSheet) R.closeSheet(true);
    prev = m; lastFocus = document.activeElement;
    layer.classList.add("open"); layer.scrollTop = 0;
    R.setMode("contact");
    if (!reduced) {
      layer.animate([{ clipPath: "circle(0% at 74% 58%)" }, { clipPath: "circle(150% at 74% 58%)" }], { duration: 900, easing: "cubic-bezier(.7,0,.2,1)" });
      $("#talkMe").animate([{ transform: "translateX(calc(-50% + 0px)) scale(.6)", opacity: 0 }, { transform: "translateX(-50%) scale(1)", opacity: 1 }], { duration: 900, delay: 300, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "backwards" });
    }
    if (R.soundOn()) R.chime([587, 784, 988], 0.08, 0.04);
    setTimeout(function () { $("#contactClose").focus({ preventScroll: true }); }, reduced ? 0 : 300);
  };
  R.closeContact = function (instant) {
    if (!layer.classList.contains("open")) return;
    function fin() { layer.classList.remove("open"); }
    R.setMode(prev === "contact" ? "world" : prev);
    if (prev === "works") $("#worksPage").classList.add("open");
    if (reduced || instant) { fin(); return; }
    var a = layer.animate([{ clipPath: "circle(150% at 74% 58%)" }, { clipPath: "circle(0% at 74% 58%)" }], { duration: 650, easing: "cubic-bezier(.7,0,.2,1)" });
    a.onfinish = fin;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };
  $("#contactClose").addEventListener("click", function () { R.closeContact(); });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && site.getAttribute("data-mode") === "contact") { R.closeContact(); e.preventDefault(); } });

  var glass = $("#glass");
  glass.addEventListener("pointermove", function (e) {
    var r = glass.getBoundingClientRect(); glass.style.setProperty("--gx", (e.clientX - r.left) + "px"); glass.style.setProperty("--gy", (e.clientY - r.top) + "px");
  });
  $$(".t-btn[data-todo]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); R.toast(a, "Add your " + a.getAttribute("data-todo") + " here"); }); });
  var ct = $("#cairoTime");
  function tickTime() { try { ct.textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date()); } catch (e) {} }
  tickTime(); setInterval(tickTime, 30000);
  $("#talkMe").addEventListener("click", function () {
    $("#talkMe .avface").animate([{ rotate: "0deg" }, { rotate: "-12deg" }, { rotate: "9deg" }, { rotate: "-5deg" }, { rotate: "0deg" }], { duration: 900, easing: "ease-in-out" });
    if (R.soundOn()) R.chime([659.25, 783.99, 987.77], 0.1, 0.05);
  });
  var clouds = $$(".cloud", layer);
  if (!reduced) {
    var t0 = performance.now();
    (function drift(now) {
      if (layer.classList.contains("open")) {
        var s = layer.scrollTop / Math.max(1, layer.scrollHeight - innerHeight);
        clouds.forEach(function (c, i) {
          var dir = i === 1 ? -1 : 1, t = (now - t0) / 1000;
          c.style.translate = (Math.sin(t / (9 + i * 3) + i) * 26 * dir + s * 60 * dir) + "px " + (Math.sin(t / 7 + i) * 6) + "px";
        });
      }
      requestAnimationFrame(drift);
    })(t0);
  }
})();


(function () {
  "use strict";

  /* =========================================================================
     TUNING — everything you are likely to want to change lives here.
     Distances are in artwork pixels (the drawing is 1840 wide; the stage is
     scaled once), so these numbers mean the same thing at any screen size.
     ====================================================================== */
  var CFG = {
    /* --- opening & closing ---------------------------------------------- */
    openStiff:      30,     // spring stiffness of the open/close motion
    openDampOpen:   0.60,   // damping ratio while opening; <1 overshoots a
                            // little before settling, 1 = no overshoot
    openDampClose:  0.70,   // damping ratio while closing
    staggerOpen:    0.05,   // s between one chain starting and the next
    staggerClose:   0.03,
    closeDelay:     280,    // ms the cursor must be gone before it closes

    /* --- how far it opens (chain LENGTHS never change, only angles) ------ */
    spread:         0.30,   // each chain swings out by this share of its own
                            // angle from vertical, so outer chains move most
    spreadMin:      0.07,   // radians every chain moves out, even the middle ones
    spreadMax:      0.30,   // radians cap per chain
    spreadChild:    0.6,    // charms hanging off other charms open this much
    childFollow:    0.45,   // how much a child chain turns with its parent

    /* --- swing physics (each charm + its chain is one piece) ------------- */
    swingStiff:     60,     // how firmly a chain swings back to where it
                            // should be. Lower = lazier, longer swings
    swingDamp:      0.32,   // 0..1: lower = more swinging before it settles
    maxSpin:        5,      // rad/s cap on how fast any chain can swing
    maxSwing:       1.15,   // rad: furthest a chain may swing from its pose
    loopSlack:      0.75,   // the cloud's second chain may go slack (sag)
                            // to this share of its length, never longer
    webgl:          true,   // draw moving chains as one continuous ribbon
    substeps:       2,
    massFromArea:   true,   // bigger charm = heavier = slower

    /* --- the cursor ------------------------------------------------------- */
    cursorLean:     0.075,  // radians the bunch leans toward the cursor
    cursorAttract:  0.06,   // how much a charm drifts toward a nearby cursor
    cursorRadius:   380,
    cursorPush:     1.6,    // how much a passing cursor nudges the charms
    cursorMaxSpeed: 2400,

    /* --- collisions -------------------------------------------------------- */
    collideSoft:    0.25,
    collidePad:     2,

    /* --- sound ------------------------------------------------------------- */
    soundOn:        false,  // the button turns it on; never autoplays
    soundVolume:    0.16,
    soundThreshold: 230,    // impact speed (px/s) below which nothing plays
    soundMinGap:    60,

    /* --- layout ------------------------------------------------------------ */
    pad:            70,     // px of room around the drawing for the swing
    maxStageW:      1180,
    mobileCalm:     0.7
  };

  var MODEL = {"size":[1840,2304],"rings":{"silver":{"c":[708.0,736.0],"rin":100,"rout":157},"gold":{"c":[866.0,727.0],"rin":56,"rout":103}},"charms":[{"id":"design-thinking","label":"Design Thinking","x":41,"y":639,"w":571,"h":375,"area":126560,"com":[261.66473609355245,181.87100189633372],"attach":[562.0,120.0],"attachW":[603.0,759.0],"parent":"silver","hangW":[579.0,724.0],"chain":0,"z":54},{"id":"branding","label":"Branding","x":1152,"y":721,"w":606,"h":363,"area":109000,"com":[309.18852293577993,179.73877064220187],"attach":[21.67178795707173,96.25046573490658],"attachW":[1173.6717879570717,817.2504657349066],"parent":"gold","hangW":[962.1400395462242,770.7735847683678],"chain":4,"z":57},{"id":"uiux","label":"UI/UX","x":1236,"y":969,"w":405,"h":319,"area":73109,"com":[208.3201110670368,159.04799682665612],"attach":[7.9377583196665,69.09238003097721],"attachW":[1243.9377583196665,1038.0923800309772],"parent":"gold","hangW":[942.1710148481252,796.7959353820428],"chain":5,"z":67},{"id":"figma","label":"Figma","x":113,"y":1000,"w":328,"h":340,"area":71688,"com":[165.72039950898335,162.46631235353198],"attach":[208.3150016115871,26.770514176246934],"attachW":[321.3150016115871,1026.770514176247],"parent":"design-thinking","hangW":[384.31918035412093,928.7355755212421],"chain":7,"z":70},{"id":"spark","label":"Claude","x":447,"y":1020,"w":295,"h":362,"area":69450,"com":[147.68673866090717,170.34747300215986],"attach":[138.14120929343414,4.434063326123578],"attachW":[585.1412092934341,1024.4340633261236],"parent":"silver","hangW":[630.6007704167413,876.6199574814718],"chain":1,"z":72},{"id":"claude","label":"Stitch AI","x":878,"y":1037,"w":298,"h":320,"area":69539,"com":[146.37108672831073,162.30594342742916],"attach":[114.21703894325651,-2.1051339954042305],"attachW":[992.2170389432565,1034.8948660045958],"parent":"gold","hangW":[896.3855199082736,820.7838923088992],"chain":3,"z":71},{"id":"adobe","label":"Adobe","x":1126,"y":1228,"w":308,"h":321,"area":72584,"com":[155.23633307616,165.0998153863111],"attach":[105.58312518568437,11.885788783007229],"attachW":[1231.5831251856844,1239.8857887830072],"parent":"uiux","hangW":[1249.136682905694,1029.0453825314185],"chain":6,"z":90},{"id":"lightning","label":"Brono AI","x":703,"y":1253,"w":207,"h":345,"area":39208,"com":[97.0980412160784,152.13744643950213],"attach":[107.20833705021153,19.485348514565658],"attachW":[810.2083370502115,1272.4853485145657],"parent":"silver","hangW":[769.9581955176022,885.000642111264],"chain":2,"z":83},{"id":"motion","label":"Motion","x":1400,"y":1287,"w":429,"h":360,"area":78363,"com":[217.03791330092008,183.06879522223494],"attach":[48.0,10.0],"attachW":[1448.0,1297.0],"parent":"adobe","hangW":[1398.6935483870968,1273.5],"chain":11,"z":85},{"id":"cloud","label":"Daydream","x":94,"y":1334,"w":312,"h":256,"area":54600,"com":[159.04761904761904,136.3081318681318],"attach":[154.0,8.0],"attachW":[248.0,1342.0],"parent":"figma","hangW":[262.82716049382714,1324.79012345679],"chain":8,"z":83},{"id":"illustrations","label":"Illustrations","x":516,"y":1428,"w":329,"h":645,"area":108357,"com":[161.73490406711153,336.45173823564687],"attach":[78.76195835796761,21.799296043033337],"attachW":[594.7619583579676,1449.7992960430333],"parent":"spark","hangW":[627.291253571804,1344.560094993935],"chain":9,"z":107},{"id":"after-effects","label":"After Effects","x":251,"y":1639,"w":313,"h":312,"area":72497,"com":[154.88857469964273,157.431038525732],"attach":[240.32431909813636,23.42936260259853],"attachW":[491.32431909813636,1662.4293626025985],"parent":"illustrations","hangW":[533.0825768739345,1612.2931644478801],"chain":10,"z":101}],"chains":[{"id":0,"parent":"silver","child":"design-thinking","x":549,"y":698,"w":7,"h":20,"p":[579.0,724.0],"c":[603.0,759.0],"len":42.43819034784589,"strip":{"w":43,"h":36,"smin":-41.3513480737938,"tmin":-9.634632799945624},"secondary":false},{"id":1,"parent":"silver","child":"spark","x":559,"y":849,"w":123,"h":193,"p":[630.6007704167413,876.6199574814718],"c":[585.1412092934341,1024.4340633261236],"len":154.6466345711332,"strip":{"w":104,"h":211,"smin":-19.110376644313558,"tmin":-62.33284459495877},"secondary":false},{"id":2,"parent":"silver","child":"lightning","x":735,"y":873,"w":117,"h":404,"p":[769.9581955176022,885.000642111264],"c":[810.2083370502115,1272.4853485145657],"len":389.5695978767439,"strip":{"w":92,"h":421,"smin":-12.382305364320485,"tmin":-50.30610863858924},"secondary":false},{"id":3,"parent":"gold","child":"claude","x":836,"y":808,"w":202,"h":273,"p":[896.3855199082736,820.7838923088992],"c":[992.2170389432565,1034.8948660045958],"len":234.57874817952188,"strip":{"w":103,"h":319,"smin":-21.499544269663705,"tmin":-42.21761233159978},"secondary":false},{"id":4,"parent":"gold","child":"branding","x":956,"y":750,"w":236,"h":105,"p":[962.1400395462242,770.7735847683678],"c":[1173.6717879570717,817.2504657349066],"len":216.57742507040734,"strip":{"w":97,"h":257,"smin":-6.44622545344305,"tmin":-31.616143866854962},"secondary":false},{"id":5,"parent":"gold","child":"uiux","x":930,"y":779,"w":334,"h":286,"p":[942.1710148481252,796.7959353820428],"c":[1243.9377583196665,1038.0923800309772],"len":386.376942461161,"strip":{"w":108,"h":404,"smin":-4.508707044882614,"tmin":-51.93048646718758},"secondary":false},{"id":6,"parent":"uiux","child":"adobe","x":1179,"y":1012,"w":107,"h":261,"p":[1249.136682905694,1029.0453825314185],"c":[1231.5831251856844,1239.8857887830072],"len":211.5698567777667,"strip":{"w":120,"h":280,"smin":-19.88792268862271,"tmin":-54.743436658465676},"secondary":false},{"id":7,"parent":"design-thinking","child":"figma","x":304,"y":916,"w":96,"h":121,"p":[384.31918035412093,928.7355755212421],"c":[321.3150016115871,1026.770514176247],"len":116.53486918562918,"strip":{"w":104,"h":148,"smin":-20.11028910078999,"tmin":-59.48139444116677},"secondary":false},{"id":8,"parent":"figma","child":"cloud","x":245,"y":1312,"w":76,"h":63,"p":[262.82716049382714,1324.79012345679],"c":[248.0,1342.0],"len":22.716173510127877,"strip":{"w":84,"h":94,"smin":-40.778599159358635,"tmin":-63.98390043152622},"secondary":false},{"id":9,"parent":"spark","child":"illustrations","x":569,"y":1336,"w":86,"h":132,"p":[627.291253571804,1344.560094993935],"c":[594.7619583579676,1449.7992960430333],"len":110.1519154829431,"strip":{"w":89,"h":151,"smin":-12.3158897469948,"tmin":-48.70161405322699},"secondary":false},{"id":10,"parent":"illustrations","child":"after-effects","x":478,"y":1596,"w":60,"h":81,"p":[533.0825768739345,1612.2931644478801],"c":[491.32431909813636,1662.4293626025985],"len":65.24868165625412,"strip":{"w":74,"h":99,"smin":-7.426749022607051,"tmin":-39.88727232032334},"secondary":false},{"id":11,"parent":"adobe","child":"motion","x":1393,"y":1259,"w":56,"h":68,"p":[1398.6935483870968,1273.5],"c":[1448.0,1297.0],"len":54.62029083276253,"strip":{"w":76,"h":79,"smin":-12.947921714386606,"tmin":-21.936169109256163},"secondary":false},{"id":12,"parent":"spark","child":"cloud","x":348,"y":1253,"w":148,"h":172,"p":[473.90680486360293,1277.272488594593],"c":[367.2326780249599,1416.0181337318293],"len":175.01349485492486,"strip":{"w":96,"h":207,"smin":-9.718463025547319,"tmin":-49.924467823815995},"secondary":true}],"hub":{"x":402,"y":117,"w":651,"h":787}};

  /* ------------------------------------------------------------------ setup */
  var hero = document.getElementById("kcHero"), stage = document.getElementById("kcStage");
  var scaler = document.getElementById("kcScaler"), cv = document.getElementById("kcChains");
  var gl = null, ctx = null;
  var stillsEl = document.getElementById("kcStills"), partsEl = document.getElementById("kcParts");
  var kbdsEl = document.getElementById("kcKbds"), hubEl = document.getElementById("kcHub");
  var tipEl = document.getElementById("kcTip"), soundBtn = document.getElementById("kcSound");

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    CFG.openDampOpen = 1; CFG.openDampClose = 1; CFG.staggerOpen = 0.012;
    CFG.staggerClose = 0.008; CFG.cursorLean = 0; CFG.cursorAttract = 0;
    CFG.cursorPush = 0; CFG.swingDamp = 1; CFG.spread *= 0.6;
  }

  var DW = MODEL.size[0], DH = MODEL.size[1];
  scaler.style.width = DW + "px"; scaler.style.height = DH + "px";
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var RES = 0;                   // canvas pixels per artwork pixel (set in layout)
  cv.style.width = DW + "px"; cv.style.height = DH + "px";
  function sizeCanvas(scale) {
    var r = Math.min(2, Math.max(0.3, scale * DPR * 1.25));
    if (Math.abs(r - RES) < 0.01) return;
    RES = r; cv.width = Math.round(DW * RES); cv.height = Math.round(DH * RES);
  }
  var hb = MODEL.hub;
  hubEl.style.cssText = "left:" + hb.x + "px;top:" + hb.y + "px;width:" + hb.w + "px;height:" + hb.h + "px";

  function rot(x, y, c, s) { return [x * c - y * s, x * s + y * c]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* bounds of the drawing, for fitting the stage */
  var BX0 = hb.x, BY0 = hb.y, BX1 = hb.x + hb.w, BY1 = hb.y + hb.h;
  MODEL.charms.forEach(function (c) {
    BX0 = Math.min(BX0, c.x); BY0 = Math.min(BY0, c.y);
    BX1 = Math.max(BX1, c.x + c.w); BY1 = Math.max(BY1, c.y + c.h);
  });
  BX0 -= CFG.pad; BY0 -= CFG.pad * 0.4; BX1 += CFG.pad; BY1 += CFG.pad;

  /* ------------------------------------------------------------- the charms */
  var byId = {};
  var nodes = MODEL.charms.map(function (m, i) {
    var el = document.createElement("div");
    el.className = "kc-part";
    el.style.cssText = "width:" + m.w + "px;height:" + m.h + "px;z-index:" +
      (m.z || (3 + Math.round((m.y + m.h) / 20))) + ";transform-origin:" + m.attach[0] + "px " + m.attach[1] + "px";
    el.innerHTML = '<img src="keychain/k/' + m.id + '.webp" alt="" decoding="async">';
    partsEl.appendChild(el);

    var btn = document.createElement("button");
    btn.className = "kc-kbd"; btn.type = "button";
    btn.style.cssText = "width:" + m.w + "px;height:" + m.h + "px;transform-origin:" +
      m.attach[0] + "px " + m.attach[1] + "px";
    btn.setAttribute("aria-label", m.label);
    kbdsEl.appendChild(btn);

    var vx = m.attachW[0] - m.hangW[0], vy = m.attachW[1] - m.hangW[1];
    var L = Math.hypot(vx, vy);
    var n = {
      m: m, el: el, btn: btn, i: i,
      v0: [vx, vy], L: L, a0: Math.atan2(vx, vy),
      parent: null, ring: (m.parent === "gold" || m.parent === "silver") ? m.parent : null,
      o: 0, ov: 0, tgt: 0, switchAt: 0,
      ax: m.attachW[0], ay: m.attachW[1], lastAx: m.attachW[0], pax: m.attachW[0],
      th: 0, pth: 0,
      restAx: m.attachW[0], restAy: m.attachW[1],
      mass: CFG.massFromArea ? clamp(m.area / 70000, 0.55, 2.4) : 1,
      radius: 0.42 * Math.max(m.w, m.h), comx: 0, comy: 0,
      asleep: true, depth: 0
    };
    n.invMass = 1 / n.mass;
    byId[m.id] = n;
    return n;
  });
  nodes.forEach(function (n) {
    if (!n.ring) {
      n.parent = byId[n.m.parent];
      /* where this chain leaves the parent, in the parent's own frame */
      n.hangL = [n.m.hangW[0] - n.parent.m.attachW[0], n.m.hangW[1] - n.parent.m.attachW[1]];
    }
  });
  nodes.forEach(function (n) { var d = 0, p = n.parent; while (p) { d++; p = p.parent; } n.depth = d; });
  var order = nodes.slice().sort(function (a, b) { return a.depth - b.depth; });
  /* how far each chain swings out when open: proportional to its own angle */
  nodes.forEach(function (n) {
    var sgn = n.a0 >= 0 ? 1 : -1;
    var d = sgn * clamp(Math.abs(n.a0) * CFG.spread + CFG.spreadMin, 0, CFG.spreadMax);
    n.spreadA = n.ring ? d : d * CFG.spreadChild;
  });
  /* stagger: the chains nearest the middle start first */
  var byAngle = nodes.slice().sort(function (a, b) {
    return (Math.abs(a.a0) + a.depth * 0.35) - (Math.abs(b.a0) + b.depth * 0.35);
  });
  byAngle.forEach(function (n, r) {
    n.delayOpen = r * CFG.staggerOpen;
    n.delayClose = (byAngle.length - 1 - r) * CFG.staggerClose;
  });

  /* each charm's rope, from its hang point to its attach point */
  nodes.forEach(function (n) {
    var K = 1;                      // a chain is one straight piece
    n.K = K; n.segLen = n.L / K;
    n.rope = [];
    for (var k = 0; k <= K; k++) {
      var x = n.m.hangW[0] + n.v0[0] * k / K, y = n.m.hangW[1] + n.v0[1] * k / K;
      n.rope.push({ x: x, y: y, px: x, py: y, rx: x, ry: y });
    }
  });

  /* ------------------------------------------------------------- the chains
     Each chain exists twice: the exact drawn crop, shown whenever its charm is
     at rest (so the resting keychain is pixel-for-pixel the illustration), and
     a straightened strip that is bent along the rope while it moves. */
  var chains = MODEL.chains.map(function (c) {
    var img = new Image(); img.className = "kc-still"; img.alt = ""; img.decoding = "async";
    img.src = "keychain/k/chain" + c.id + ".webp";
    img.style.cssText = "left:" + c.x + "px;top:" + c.y + "px;width:" + c.w + "px;height:" + c.h + "px";
    img.style.visibility = "hidden";   /* drawn on the canvas instead: the DOM copy went unpainted in some browsers */
    img.addEventListener("load", function () { paint(); });
    stillsEl.appendChild(img);
    var strip = new Image(); strip.decoding = "async"; strip.src = "keychain/k/strip" + c.id + ".webp";
    var child = byId[c.child], par = byId[c.parent] || null;
    var ch = { c: c, img: img, strip: strip, child: child, par: par, shown: true };
    if (c.secondary) {
      /* a second chain to the same charm: both ends ride their charms */
      ch.pL = [c.p[0] - par.m.attachW[0], c.p[1] - par.m.attachW[1]];
      ch.cL = [c.c[0] - child.m.attachW[0], c.c[1] - child.m.attachW[1]];
    }
    return ch;
  });
  chains.forEach(function (ch) { if (!ch.c.secondary) ch.child.chain = ch; });

  /* ---------------------------------------------------------------- pointer */
  var ptr = { x: -9999, y: -9999, vx: 0, vy: 0, has: false, t: 0 };
  var calm = 1;

  /* where the parent's frame puts a point given in its rest frame */
  function frame(n, lx, ly) {
    var c = Math.cos(n.th), s = Math.sin(n.th);
    var d = rot(lx, ly, c, s);
    return [n.ax + d[0], n.ay + d[1]];
  }
  function hangOf(n) {
    if (n.ring) return n.m.hangW;
    return frame(n.parent, n.hangL[0], n.hangL[1]);
  }

  /* the shape this chain wants this instant */
  function target(n, h) {
    var ang = n.spreadA * n.o;
    if (n.parent) ang -= n.parent.th * CFG.childFollow;   // turn with the parent
    if (ptr.has && n.o > 0.01) {
      ang += clamp((ptr.x - h[0]) / 700, -1, 1) * CFG.cursorLean * calm * n.o *
             clamp(n.L / 420, 0.4, 1.3);
    }
    var v = rot(n.v0[0], n.v0[1], Math.cos(-ang), Math.sin(-ang));   // + = swing outward
    var tx = h[0] + v[0], ty = h[1] + v[1];
    if (ptr.has && n.o > 0.01) {
      var dx = ptr.x - tx, dy = ptr.y - ty;
      var f = Math.exp(-(dx * dx + dy * dy) / (2 * CFG.cursorRadius * CFG.cursorRadius));
      tx += dx * CFG.cursorAttract * f * n.o * calm;
      ty += dy * CFG.cursorAttract * f * n.o * calm * 0.6;
    }
    /* never let attraction stretch the chain */
    var gx = tx - h[0], gy = ty - h[1], gd = Math.hypot(gx, gy) || 1;
    tx = h[0] + gx / gd * n.L; ty = h[1] + gy / gd * n.L;
    n.restAx = tx; n.restAy = ty;
    var R = n.rope, K = n.K;
    for (var k = 0; k <= K; k++) {
      R[k].rx = h[0] + (tx - h[0]) * k / K;
      R[k].ry = h[1] + (ty - h[1]) * k / K;
    }
  }

  /* ------------------------------------------------------------- open/close */
  var T = 0;
  function setOpen(want) {
    want = want ? 1 : 0;
    if (want === T) return;
    T = want;
    var now = performance.now() / 1000;
    nodes.forEach(function (n) {
      n.switchAt = now + (T ? n.delayOpen : n.delayClose);
      n.asleep = false;
    });
    if (!T) setHot(-1);
    wake();
  }

  /* =======================================================================
     PHYSICS. Each charm and its chain swing together as one solid piece
     about the point the chain hangs from, like a pendulum. The only thing
     simulated is that angle, so the chain is always exactly connected: it
     starts at the keyring (or the charm it hangs from) and ends at the
     charm, every frame, by construction. Nothing is ever pulled apart.
     ===================================================================== */
  nodes.forEach(function (n) {
    n.phi = 0; n.om = 0; n.a0w = Math.atan2(n.v0[1], n.v0[0]);
    n.pcx = 0; n.pcy = 0;
  });
  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  /* A chain leaves its hook in the direction it was drawn (turned with
     whatever it hangs from) and meets its charm head-on, bending smoothly in
     between. Both ends therefore always sit exactly in their hooks. When it
     bends, the charm comes a touch closer so the chain keeps its exact
     length: it never stretches. */
  function hookHandle(L) { return Math.min(L / 3, Math.max(0.28 * L, 30)); }
  function cubicLen(d, a, hs) {
    var c = Math.cos(a), s = Math.sin(a), len = 0, px = 0, py = 0;
    for (var i = 1; i <= 32; i++) {
      var u = i / 32, b = 3 * u * (1 - u) * (1 - u), cc = 3 * u * u * (1 - u), e = u * u * u;
      var x = b * hs * c + cc * (d * 2 / 3) + e * d, y = b * hs * s;
      len += Math.hypot(x - px, y - py); px = x; py = y;
    }
    return len;
  }
  var SHRINK_STEP = 0.02, SHRINK_N = 90;
  function buildShrink(n) {
    var L = n.L, hs = hookHandle(L), t = new Float32Array(SHRINK_N + 1);
    for (var k = 0; k <= SHRINK_N; k++) {
      var a = k * SHRINK_STEP, lo = 0.3 * L, hi = L;
      for (var it = 0; it < 22; it++) { var d = (lo + hi) / 2; if (cubicLen(d, a, hs) > L) hi = d; else lo = d; }
      t[k] = (lo + hi) / 2 / L;
    }
    n.shrink = t;
  }
  function shrinkOf(n, a) {
    if (!n.shrink) buildShrink(n);
    var x = Math.min(Math.abs(a) / SHRINK_STEP, SHRINK_N - 1e-6), k = Math.floor(x), f = x - k;
    return n.shrink[k] * (1 - f) + n.shrink[k + 1] * f;
  }
  function hookAngle(n) { return n.a0w + (n.parent ? n.parent.th : 0); }

  /* place charm + chain from the angle */
  function pose(n) {
    var h = hangOf(n), c = Math.cos(n.phi), s = Math.sin(n.phi);
    var f = shrinkOf(n, wrap(n.a0w + n.phi - hookAngle(n)));
    var v = rot(n.v0[0], n.v0[1], c, s);
    n.ax = h[0] + v[0] * f; n.ay = h[1] + v[1] * f; n.th = n.phi;
    var co = rot(n.m.com[0] - n.m.attach[0], n.m.com[1] - n.m.attach[1], c, s);
    n.comx = n.ax + co[0]; n.comy = n.ay + co[1];
    var R = n.rope; R[0].x = h[0]; R[0].y = h[1]; R[n.K].x = n.ax; R[n.K].y = n.ay;
  }
  function propagate() { for (var i = 0; i < order.length; i++) if (!order[i].asleep) pose(order[i]); }

  /* where this chain wants to point right now (open amount, cursor) */
  function targetAngle(n, h) {
    target(n, h);
    return wrap(Math.atan2(n.restAy - h[1], n.restAx - h[0]) - n.a0w);
  }

  function step(dt, now) {
    /* cursor velocity, capped, so a flick can't throw anything around */
    var sp = Math.hypot(ptr.vx, ptr.vy) || 1e-4, cs = Math.min(sp, CFG.cursorMaxSpeed) / sp;
    var cvx = ptr.vx * cs * calm, cvy = ptr.vy * cs * calm;
    var R2 = 2 * CFG.cursorRadius * CFG.cursorRadius;

    for (var oi = 0; oi < order.length; oi++) {
      var n = order[oi];
      if (n.asleep && (!n.parent || n.parent.asleep)) continue;
      n.asleep = false;
      n.pcx = n.comx; n.pcy = n.comy;

      /* the open amount: a damped spring, staggered per chain */
      if (now >= n.switchAt) n.tgt = T;
      var w = Math.sqrt(CFG.openStiff), z = n.tgt ? CFG.openDampOpen : CFG.openDampClose;
      n.ov += (w * w * (n.tgt - n.o) - 2 * z * w * n.ov) * dt;
      n.o += n.ov * dt;

      var h = hangOf(n), goal = targetAngle(n, h);

      /* a spring toward that angle, with weight and gentle damping */
      var K = CFG.swingStiff / n.mass, C = 2 * CFG.swingDamp * Math.sqrt(K);
      var acc = K * wrap(goal - n.phi) - C * n.om;

      /* the cursor brushing past nudges the charms near it */
      if (ptr.has && n.o > 0.01 && sp > 1) {
        var rx = n.comx - h[0], ry = n.comy - h[1], r2 = rx * rx + ry * ry || 1;
        var ex = ptr.x - n.comx, ey = ptr.y - n.comy;
        var f = Math.exp(-(ex * ex + ey * ey) / R2) * n.o * CFG.cursorPush;
        acc += f * (rx * cvy * 0.5 - ry * cvx) / r2;
      }
      n.om = clamp(n.om + acc * dt, -CFG.maxSpin, CFG.maxSpin);
      n.phi = clamp(n.phi + n.om * dt, -CFG.maxSwing, CFG.maxSwing);
      pose(n);
    }

    collide(dt);
    closeLoops();

    /* settled? lock it exactly onto its pose */
    for (var oj = 0; oj < order.length; oj++) {
      var m = order[oj];
      if (m.asleep) continue;
      if (now >= m.switchAt && Math.abs(m.o - m.tgt) < 0.0015 && Math.abs(m.ov) < 0.003 &&
          !(T && ptr.has) && (!m.parent || m.parent.asleep)) {
        var g = targetAngle(m, hangOf(m));
        if (Math.abs(wrap(g - m.phi)) < 0.0015 && Math.abs(m.om) < 0.004) park(m);
      }
    }
  }

  function park(n) {
    n.o = n.tgt; n.ov = 0; n.om = 0;
    n.phi = n.tgt ? targetAngle(n, hangOf(n)) : 0;
    pose(n);
    /* closed means closed: the exact drawn position, to the pixel */
    if (n.tgt === 0 && (!n.parent || n.parent.asleep)) {
      n.phi = 0; n.th = 0; n.ax = n.m.attachW[0]; n.ay = n.m.attachW[1];
      var co = rot(n.m.com[0] - n.m.attach[0], n.m.com[1] - n.m.attach[1], 1, 0);
      n.comx = n.ax + co[0]; n.comy = n.ay + co[1];
    }
    n.asleep = true;
  }

  /* turn a charm (and everything hanging from it) by dA */
  function turnBy(n, dA) { n.phi = clamp(n.phi + dA, -CFG.maxSwing, CFG.maxSwing); }

  /* gentle bumps while open: a push on a charm turns it about its hang point */
  function related(a, b) { return a.parent === b || b.parent === a; }
  function collide(dt) {
    var hit = false;
    for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) {
      var a = nodes[i], b = nodes[j];
      if ((a.asleep && b.asleep) || related(a, b)) continue;
      var dx = b.comx - a.comx, dy = b.comy - a.comy;
      var rr = (a.radius + b.radius) * 0.62 + CFG.collidePad, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      var rel = Math.hypot((a.comx - a.pcx) - (b.comx - b.pcx), (a.comy - a.pcy) - (b.comy - b.pcy)) / Math.max(dt, 1e-4);
      if (rel > CFG.soundThreshold) clink(rel);
      var open = Math.min(a.o, b.o);
      if (open < 0.3) continue;
      var d = Math.sqrt(d2), push = (rr - d) / d * CFG.collideSoft * 0.5 * open;
      var ia = a.invMass / (a.invMass + b.invMass), ib = 1 - ia;
      var px = dx * push, py = dy * push;
      [[a, -px * ia, -py * ia], [b, px * ib, py * ib]].forEach(function (q) {
        var n = q[0];
        if (n.asleep) return;
        var h = hangOf(n), rx = n.comx - h[0], ry = n.comy - h[1], r2 = rx * rx + ry * ry || 1;
        var dA = clamp((rx * q[2] - ry * q[1]) / r2, -0.02, 0.02);
        turnBy(n, dA); n.om += dA / Math.max(dt, 1e-4) * 0.15;
      });
      hit = true;
    }
    if (hit) propagate();
  }

  /* The cloud hangs from Figma AND from Spark, which closes a loop. That
     second chain stays connected too: the charms in the loop are swung
     (never moved apart) so its two ends always fit its length. Small turns
     each step, so nothing ever jumps. */
  function closeLoops() {
    for (var i = 0; i < chains.length; i++) {
      var ch = chains[i];
      if (!ch.c.secondary) continue;
      var sides = [[ch.par, -1, 1], [ch.child, 1, 1], [ch.child.parent, 1, 0.6]];
      for (var it = 0; it < 4; it++) {
        var A = frame(ch.par, ch.pL[0], ch.pL[1]), B = frame(ch.child, ch.cL[0], ch.cL[1]);
        var dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1e-4;
        var err = d - clamp(d, ch.c.len * CFG.loopSlack, ch.c.len);
        if (Math.abs(err) < 0.05) break;
        var ux = dx / d, uy = dy / d, g = [], gg = 0;
        for (var k = 0; k < 3; k++) {
          var b = sides[k][0]; g[k] = 0;
          if (!b || b.asleep) continue;
          var H = hangOf(b), X = sides[k][1] < 0 ? A : B;
          g[k] = sides[k][1] * (ux * -(X[1] - H[1]) + uy * (X[0] - H[0]));
          gg += g[k] * g[k] * sides[k][2];
        }
        if (gg < 1e-6) break;
        for (var k2 = 0; k2 < 3; k2++) if (g[k2]) turnBy(sides[k2][0], clamp(-err * g[k2] * sides[k2][2] / gg, -0.01, 0.01));
        propagate();
      }
    }
  }

  /* ----------------------------------------------------------------- layout */
  var scale = 1, stageRect = null;
  function layout() {
    var tx, ty;
    if (stage.getAttribute("data-fit") === "full") {
      /* the stage IS the drawing's box (Figma 211:9425): 1840 x 2304 mapped 1:1 */
      scale = stage.clientWidth / DW; tx = 0; ty = 0;
    } else {
      var availW = Math.min(stage.clientWidth, CFG.maxStageW), availH = Math.max(240, stage.clientHeight);
      var bw = BX1 - BX0, bh = BY1 - BY0;
      scale = Math.min(availW / bw, availH / bh);
      tx = (stage.clientWidth - bw * scale) / 2 - BX0 * scale;
      ty = (availH - bh * scale) / 2 - BY0 * scale;
    }
    scaler.style.transform = "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) scale(" + scale + ")";
    sizeCanvas(scale);
    stageRect = scaler.getBoundingClientRect();
  }
  function toLocal(cx, cy) {
    return stageRect ? [(cx - stageRect.left) / scale, (cy - stageRect.top) / scale] : [-9999, -9999];
  }
  addEventListener("resize", function () { layout(); paint(); }, { passive: true });
  addEventListener("scroll", function () { stageRect = scaler.getBoundingClientRect(); }, { passive: true, capture: true });

  /* ------------------------------------------ is the pointer on the keychain? */
  function overKeychain(x, y) {
    var pad = T ? 60 : 18;
    if (x > hb.x - pad && x < hb.x + hb.w + pad && y > hb.y - pad && y < hb.y + hb.h + pad) return true;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], r = n.radius + pad;
      if (Math.abs(x - n.comx) < r && Math.abs(y - n.comy) < r) return true;
      var h = hangOf(n), dx = n.ax - h[0], dy = n.ay - h[1], L2 = dx * dx + dy * dy || 1;
      var t = clamp(((x - h[0]) * dx + (y - h[1]) * dy) / L2, 0, 1);
      var ex = h[0] + dx * t - x, ey = h[1] + dy * t - y;
      if (ex * ex + ey * ey < (pad + 26) * (pad + 26)) return true;
    }
    return false;
  }

  var closeTimer = 0;
  function onMove(e) {
    var p = toLocal(e.clientX, e.clientY), now = performance.now();
    var dt = Math.max(8, now - ptr.t) / 1000;
    if (ptr.has) { ptr.vx = (p[0] - ptr.x) / dt; ptr.vy = (p[1] - ptr.y) / dt; }
    ptr.x = p[0]; ptr.y = p[1]; ptr.t = now; ptr.has = true;
    if (e.pointerType !== "touch") {
      if (overKeychain(p[0], p[1])) { clearTimeout(closeTimer); closeTimer = 0; setOpen(true); }
      else if (T && !closeTimer) closeTimer = setTimeout(function () { closeTimer = 0; setOpen(false); }, CFG.closeDelay);
    }
    hitTest(p[0], p[1], e.clientX, e.clientY);
    if (T) wakeAll();
    unlockAudio();
  }
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerdown", function (e) {
    unlockAudio();
    if (e.pointerType === "touch") { var p = toLocal(e.clientX, e.clientY); setOpen(overKeychain(p[0], p[1])); }
    onMove(e);
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", function () {
    ptr.has = false; setHot(-1);
    clearTimeout(closeTimer); closeTimer = setTimeout(function () { setOpen(false); }, CFG.closeDelay);
  });
  addEventListener("blur", function () { ptr.has = false; setOpen(false); });

  var focusCount = 0;
  nodes.forEach(function (n, i) {
    n.btn.addEventListener("focus", function () { focusCount++; setOpen(true); setHot(i); });
    n.btn.addEventListener("blur", function () {
      focusCount--;
      setTimeout(function () { if (focusCount <= 0) { setHot(-1); if (!ptr.has) setOpen(false); } }, 40);
    });
  });

  /* ------------------------------------------------- alpha-accurate labels */
  var MASK = 0.25;
  nodes.forEach(function (n) {
    var img = n.el.querySelector("img");
    function build() {
      var w = Math.max(1, Math.round(n.m.w * MASK)), h = Math.max(1, Math.round(n.m.h * MASK));
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, h);
      try {
        var d = g.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
        for (var i = 0; i < w * h; i++) a[i] = d[i * 4 + 3] > 60 ? 1 : 0;
        n.mask = { a: a, w: w, h: h };
      } catch (err) { n.mask = null; }
    }
    if (img.complete && img.naturalWidth) build(); else img.addEventListener("load", build);
  });
  var hot = -1;
  function setHot(i) {
    if (i === hot) return;
    if (hot >= 0) nodes[hot].el.classList.remove("kc-hot");
    hot = i;
    if (hot >= 0) { nodes[hot].el.classList.add("kc-hot"); tipEl.textContent = nodes[hot].m.label; tipEl.classList.add("kc-on"); }
    else tipEl.classList.remove("kc-on");
  }
  function hitTest(lx, ly, cx, cy) {
    var found = -1, best = -1;
    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];
      var d = rot(lx - n.ax, ly - n.ay, Math.cos(-n.th), Math.sin(-n.th));
      var px = d[0] + n.m.attach[0], py = d[1] + n.m.attach[1];
      if (px < 0 || py < 0 || px >= n.m.w || py >= n.m.h) continue;
      if (n.mask) {
        var mx = Math.min(n.mask.w - 1, Math.floor(px * MASK)), my = Math.min(n.mask.h - 1, Math.floor(py * MASK));
        if (!n.mask.a[my * n.mask.w + mx]) continue;
      }
      var z = parseInt(n.el.style.zIndex, 10) || 0;
      if (z > best) { best = z; found = k; }
    }
    setHot(found);
    if (found >= 0) { tipEl.style.left = cx + "px"; tipEl.style.top = cy + "px"; }
  }

  /* ------------------------------------------------------------------ sound */
  var actx = null, lastSound = 0;
  function unlockAudio() {
    if (actx || !CFG.soundOn) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { actx = new AC(); if (actx.state === "suspended") actx.resume(); } catch (e) { actx = null; }
  }
  soundBtn.addEventListener("click", function () {
    CFG.soundOn = !CFG.soundOn;
    soundBtn.setAttribute("aria-pressed", String(CFG.soundOn));
    soundBtn.textContent = CFG.soundOn ? "Sound on" : "Sound off";
    if (CFG.soundOn) { unlockAudio(); clink(700); }
  });
  /* a short metallic tick, synthesised — nothing to download */
  function clink(speed) {
    return;   /* Nov 7: no sound effects */
    if (!CFG.soundOn || !actx || reduced) return;
    var nowMs = performance.now();
    if (nowMs - lastSound < CFG.soundMinGap * (0.7 + Math.random() * 0.6)) return;
    lastSound = nowMs;
    var t = actx.currentTime + Math.random() * 0.012;
    var amp = Math.min(1, (speed - CFG.soundThreshold) / 900) * CFG.soundVolume * (0.75 + Math.random() * 0.5);
    if (amp <= 0.004) return;
    var g = actx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 + Math.random() * 0.05);
    var bp = actx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 7;
    bp.frequency.value = 2300 + Math.random() * 2600;
    bp.connect(g); g.connect(actx.destination);
    var base = 1700 + Math.random() * 1500;
    [1, 2.41, 3.77].forEach(function (mul, k) {
      var o = actx.createOscillator(); o.type = k === 0 ? "triangle" : "sine";
      o.frequency.setValueAtTime(base * mul * (0.96 + Math.random() * 0.08), t);
      o.frequency.exponentialRampToValueAtTime(base * mul * 0.72, t + 0.11);
      var og = actx.createGain(); og.gain.value = [0.9, 0.5, 0.28][k];
      o.connect(og); og.connect(bp); o.start(t); o.stop(t + 0.16);
    });
  }

  /* --------------------------------------------- every chain is ONE path
     A chain is a single curve from its fixed point (the keyring, or the
     charm it hangs from) to the charm. Each frame the whole curve is
     recomputed from those two ends, then the hand-drawn chain is laid along
     it as one continuous ribbon: same width everywhere, never cut into
     pieces. While a charm swings, the top of its chain trails a little
     (a soft curve); at the charm end it always meets the charm head-on. */
  var NS = 40;
  function cub(P, u, q) {
    var a = (1 - u) * (1 - u) * (1 - u), b = 3 * u * (1 - u) * (1 - u), c = 3 * u * u * (1 - u), e = u * u * u;
    q[0] = a * P.A[0] + b * P.C1[0] + c * P.C2[0] + e * P.B[0];
    q[1] = a * P.A[1] + b * P.C1[1] + c * P.C2[1] + e * P.B[1];
    var da = 3 * (1 - u) * (1 - u), db = 6 * u * (1 - u), dc = 3 * u * u;
    var tx = da * (P.C1[0] - P.A[0]) + db * (P.C2[0] - P.C1[0]) + dc * (P.B[0] - P.C2[0]);
    var ty = da * (P.C1[1] - P.A[1]) + db * (P.C2[1] - P.C1[1]) + dc * (P.B[1] - P.C2[1]);
    var tl = Math.hypot(tx, ty);
    if (tl < 1e-6) { tx = P.B[0] - P.A[0]; ty = P.B[1] - P.A[1]; tl = Math.hypot(tx, ty) || 1; }
    q[2] = tx / tl; q[3] = ty / tl;
    return q;
  }
  var QQ = [0, 0, 0, 0];
  function measure(P) {
    var len = 0, px = P.A[0], py = P.A[1];
    P.tab[0] = 0;
    for (var i = 1; i <= NS; i++) {
      cub(P, i / NS, QQ); len += Math.hypot(QQ[0] - px, QQ[1] - py); px = QQ[0]; py = QQ[1]; P.tab[i] = len;
    }
    P.len = len;
  }
  function newPath(o) {
    return o.path || (o.path = { A: [0, 0], B: [0, 0], C1: [0, 0], C2: [0, 0], tab: new Float32Array(NS + 1), len: 0, straight: true });
  }
  function setStraight(P) {
    P.C1[0] = P.A[0] + (P.B[0] - P.A[0]) / 3; P.C1[1] = P.A[1] + (P.B[1] - P.A[1]) / 3;
    P.C2[0] = P.A[0] + (P.B[0] - P.A[0]) * 2 / 3; P.C2[1] = P.A[1] + (P.B[1] - P.A[1]) * 2 / 3;
    P.straight = true; P.len = Math.hypot(P.B[0] - P.A[0], P.B[1] - P.A[1]);
  }
  /* a charm's own chain: out of its hook at `hookA`, into the charm along
     the line to it */
  function chainPath(A, B, hookA, L, o) {
    var P = newPath(o);
    P.A[0] = A[0]; P.A[1] = A[1]; P.B[0] = B[0]; P.B[1] = B[1];
    var dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1e-4, ux = dx / d, uy = dy / d;
    var hx = Math.cos(hookA), hy = Math.sin(hookA);
    if (Math.abs(hx * uy - hy * ux) < 0.002 && hx * ux + hy * uy > 0) { setStraight(P); return P; }
    var hs = hookHandle(L);
    P.C1[0] = A[0] + hx * hs; P.C1[1] = A[1] + hy * hs;
    P.C2[0] = B[0] - ux * d / 3; P.C2[1] = B[1] - uy * d / 3;
    P.straight = false; measure(P);
    return P;
  }
  /* a chain between two charms: tight it's straight, slack it sags down
     (same length either way) */
  function quadLen(A, C, B) {
    var len = 0, px = A[0], py = A[1];
    for (var i = 1; i <= NS; i++) {
      var u = i / NS, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), e = u * u;
      var x = a * A[0] + b * C[0] + e * B[0], y = a * A[1] + b * C[1] + e * B[1];
      len += Math.hypot(x - px, y - py); px = x; py = y;
    }
    return len;
  }
  function sagPath(A, B, L, o) {
    var P = newPath(o);
    P.A[0] = A[0]; P.A[1] = A[1]; P.B[0] = B[0]; P.B[1] = B[1];
    var dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1e-4;
    if (d >= L - 0.05) { setStraight(P); return P; }
    var nx = -dy / d, ny = dx / d, want = ny >= 0 ? 1 : -1;
    if (!o.side) o.side = want;
    else if (want !== o.side && (d > L * 0.985 || Math.abs(ny) > 0.5)) o.side = want;
    nx *= o.side; ny *= o.side;
    var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, lo = 0, hi = L, C = [mx, my];
    for (var it = 0; it < 24; it++) {
      var hh = (lo + hi) / 2; C[0] = mx + nx * hh; C[1] = my + ny * hh;
      if (quadLen(A, C, B) < L) lo = hh; else hi = hh;
    }
    var hf = (lo + hi) / 2; C[0] = mx + nx * hf; C[1] = my + ny * hf;
    P.C1[0] = A[0] + (C[0] - A[0]) * 2 / 3; P.C1[1] = A[1] + (C[1] - A[1]) * 2 / 3;
    P.C2[0] = B[0] + (C[0] - B[0]) * 2 / 3; P.C2[1] = B[1] + (C[1] - B[1]) * 2 / 3;
    P.straight = false; measure(P);
    return P;
  }
  /* position + direction at arc length s (straight on past either end) */
  function pointAt(P, s, q) {
    if (P.straight) {
      var tx = P.B[0] - P.A[0], ty = P.B[1] - P.A[1], d = Math.hypot(tx, ty) || 1e-4;
      q[2] = tx / d; q[3] = ty / d; q[0] = P.A[0] + q[2] * s; q[1] = P.A[1] + q[3] * s; return q;
    }
    var T = P.tab, L = P.len, u;
    if (s <= 0) u = 0;
    else if (s >= L) u = 1;
    else {
      var lo = 0, hi = NS;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (T[mid] <= s) lo = mid; else hi = mid; }
      u = (lo + (s - T[lo]) / Math.max(1e-6, T[hi] - T[lo])) / NS;
    }
    cub(P, u, q);
    if (s < 0) { q[0] += q[2] * s; q[1] += q[3] * s; }
    else if (s > L) { q[0] += q[2] * (s - L); q[1] += q[3] * (s - L); }
    return q;
  }

  /* ---- WebGL: the drawn chain as a textured ribbon (one triangle strip) */
  var glProg = null, glBuf = null, glLoc = {}, VB = new Float32Array(4 * 2 * 512);
  function initGL() {
    if (!CFG.webgl) return false;
    try { gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true }); } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER,
      "attribute vec2 p;attribute vec2 t;uniform vec2 sz;varying vec2 v;" +
      "void main(){v=t;gl_Position=vec4(p.x/sz.x*2.0-1.0,1.0-p.y/sz.y*2.0,0.0,1.0);}"));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER,
      "precision mediump float;varying vec2 v;uniform sampler2D tx;void main(){gl_FragColor=texture2D(tx,v);}"));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl = null; return false; }
    glProg = p; gl.useProgram(p);
    glLoc.p = gl.getAttribLocation(p, "p"); glLoc.t = gl.getAttribLocation(p, "t");
    glLoc.sz = gl.getUniformLocation(p, "sz");
    glBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, glBuf);
    gl.enableVertexAttribArray(glLoc.p); gl.enableVertexAttribArray(glLoc.t);
    gl.vertexAttribPointer(glLoc.p, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(glLoc.t, 2, gl.FLOAT, false, 16, 8);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    return true;
  }
  function pow2(v) { var p = 1; while (p < v) p <<= 1; return p; }
  function stillTex(ch) {
    if (ch.stex) return ch.stex;
    var img = ch.img;
    if (!img.complete || !img.naturalWidth) return null;
    var w = img.naturalWidth, h = img.naturalHeight, pw = pow2(w), ph = pow2(h);
    var c = document.createElement("canvas"); c.width = pw; c.height = ph;
    c.getContext("2d").drawImage(img, 0, 0);
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    ch.stex = t; ch.sus = w / pw; ch.svs = h / ph;
    return t;
  }
  /* a resting chain: the exact drawn crop, one quad where it was drawn */
  function drawStill(ch) {
    var c = ch.c, img = ch.img;
    if (gl) {
      var t = stillTex(ch); if (!t) return;
      var x0 = c.x, y0 = c.y, x1 = c.x + c.w, y1 = c.y + c.h, u = ch.sus, v = ch.svs;
      VB.set([x0, y0, 0, 0, x1, y0, u, 0, x0, y1, 0, v, x1, y1, u, v], 0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.bufferData(gl.ARRAY_BUFFER, VB.subarray(0, 16), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else if (img.complete && img.naturalWidth) {
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      ctx.drawImage(img, c.x, c.y, c.w, c.h);
    }
  }
  function texFor(ch) {
    if (ch.tex) return ch.tex;
    var img = ch.strip;
    if (!img.complete || !img.naturalWidth) return null;
    /* padded to a power of two so it can be mip-mapped: crisp at any size */
    var w = img.naturalWidth, h = img.naturalHeight, pw = pow2(w), ph = pow2(h);
    var c = document.createElement("canvas"); c.width = pw; c.height = ph;
    c.getContext("2d").drawImage(img, 0, 0);
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    ch.tex = t; ch.us = w / pw; ch.vs = h / ph;
    return t;
  }
  var Q = [0, 0, 0, 0];
  /* walk the drawn chain from end to end and place each row of it on the
     path: across-the-chain stays at true width, along-the-chain follows
     the curve at true length */
  function ribbon(ch, P, L, emit) {
    var st = ch.c.strip, rows = Math.min(255, Math.max(2, Math.ceil(st.h / 3)));
    var k = P.len > L ? P.len / L : 1;
    for (var r = 0; r <= rows; r++) {
      var f = r / rows, s = (st.smin + st.h * f) * k;
      pointAt(P, s, Q);
      var nx = -Q[3], ny = Q[2];
      emit(r, f, Q[0] + nx * st.tmin, Q[1] + ny * st.tmin, Q[0] + nx * (st.tmin + st.w), Q[1] + ny * (st.tmin + st.w));
    }
    return rows;
  }
  function drawRibbonGL(ch, P, L) {
    var tex = texFor(ch); if (!tex) return;
    var us = ch.us, vs = ch.vs;
    var rows = ribbon(ch, P, L, function (r, f, lx, ly, rx, ry) {
      var o = r * 8;
      VB[o] = lx; VB[o + 1] = ly; VB[o + 2] = 0; VB[o + 3] = f * vs;
      VB[o + 4] = rx; VB[o + 5] = ry; VB[o + 6] = us; VB[o + 7] = f * vs;
    });
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.bufferData(gl.ARRAY_BUFFER, VB.subarray(0, (rows + 1) * 8), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, (rows + 1) * 2);
  }
  /* 2D fallback: thin overlapping slices along the same path */
  function drawRibbon2D(ch, P, L) {
    var img = ch.strip, st = ch.c.strip;
    if (!img.complete || !img.naturalWidth) return;
    var rows = Math.max(2, Math.ceil(st.h / 5)), k = P.len > L ? P.len / L : 1, sl = st.h / rows;
    for (var r = 0; r < rows; r++) {
      var s = (st.smin + sl * (r + 0.5)) * k;
      pointAt(P, s, Q);
      ctx.setTransform(RES * -Q[3], RES * Q[2], RES * Q[2] * k, RES * Q[3] * k, RES * Q[0], RES * Q[1]);
      ctx.drawImage(img, 0, Math.max(0, sl * r - 1), st.w, Math.min(st.h - sl * r + 1, sl + 2),
                    st.tmin, -sl * 0.5 - 1, st.w, sl + 2);
    }
  }
  function drawChains() {
    if (!gl && !ctx) { if (!initGL()) ctx = cv.getContext("2d"); }
    if (gl) {
      gl.viewport(0, 0, cv.width, cv.height); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(glLoc.sz, DW, DH);
    } else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
    for (var i = 0; i < chains.length; i++) {
      var ch = chains[i], moving = !ch.child.asleep || (ch.par && !ch.par.asleep);
      if (!moving) { drawStill(ch); continue; }
      var P;
      if (!ch.c.secondary) {
        var n = ch.child, h = hangOf(n);
        P = chainPath(h, [n.ax, n.ay], hookAngle(n), n.L, ch);
      } else {
        var a = frame(ch.par, ch.pL[0], ch.pL[1]), b = frame(ch.child, ch.cL[0], ch.cL[1]);
        P = sagPath(a, b, ch.c.len, ch);
      }
      if (gl) drawRibbonGL(ch, P, ch.c.len); else drawRibbon2D(ch, P, ch.c.len);
    }
    if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ------------------------------------------------------------------ paint */
  function paint() {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var sc = n.el.classList.contains("kc-hot") ? 1.03 : 1;
      var tr = "translate(" + (n.ax - n.m.attach[0]).toFixed(2) + "px," + (n.ay - n.m.attach[1]).toFixed(2) +
               "px) rotate(" + n.th.toFixed(4) + "rad)" + (sc !== 1 ? " scale(" + sc + ")" : "");
      n.el.style.transform = tr; n.btn.style.transform = tr;
    }
    drawChains();
  }

  /* ------------------------------------------------------------------- loop */
  var lastT = performance.now(), accT = 0, FIXED = 1 / 120, onScreen = true, looping = false;
  function anyAwake() { for (var i = 0; i < nodes.length; i++) if (!nodes[i].asleep) return true; return false; }
  function wakeAll() { for (var i = 0; i < nodes.length; i++) nodes[i].asleep = false; wake(); }
  function wake() {
    if (!onScreen || looping) return;
    looping = true; lastT = performance.now(); accT = 0; requestAnimationFrame(tick);
  }
  function tick(nowMs) {
    var dt = Math.min(0.05, (nowMs - lastT) / 1000);
    lastT = nowMs; calm = innerWidth < 700 ? CFG.mobileCalm : 1;
    accT += dt;
    var guard = 0, now = nowMs / 1000;
    while (accT >= FIXED && guard++ < 8) {
      for (var s = 0; s < CFG.substeps; s++) step(FIXED / CFG.substeps, now);
      accT -= FIXED;
    }
    ptr.vx *= 0.85; ptr.vy *= 0.85;
    paint();
    if (onScreen && anyAwake()) requestAnimationFrame(tick); else { looping = false; paint(); }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { onScreen = e.isIntersecting; if (onScreen) { layout(); paint(); wake(); } else setOpen(false); });
    }, { threshold: 0.01 }).observe(hero);
  }

  /* the works page starts hidden (zero size): measure again whenever the stage really gets a size */
  if ("ResizeObserver" in window) new ResizeObserver(function () { layout(); paint(); }).observe(stage);
  layout();
  nodes.forEach(function (n) { n.tgt = 0; });
  order.forEach(park);
  paint();
  addEventListener("load", function () { layout(); paint(); });
})();


(function () {
  "use strict";
  /* ============================================================ edit mode
     A small design tool on the page itself, for the artifact's owner (and
     anyone with edit access). In edit mode:
       - click a card, sticker, photo, label or heading to select it, or
         click a piece of text to select just that text; drag to move, the
         corner handle to resize, the top handle to rotate; the toolbar
         layers, hides or resets it;
       - click selected text again (or double-click, or "Edit text") to
         type; the toolbar sets font, size, weight, italic, colour,
         alignment, letter spacing, line height and capitals;
       - "+ Add text" drops a new text box on the page you're looking at;
       - Save publishes data/edits.json (files form of the `artifact`
         capability). The page's code never changes, so rebuilds keep the
         edits. Every saved entry remembers what it changed (its original
         words or image), so it lands on the right element if the
         structure shifts. Positions are kept in the page's own units (J in
         the notebook, U on the site), so a layout holds at any screen size. */
  var R = window.R2 = window.R2 || {};
  var EDITS = { v: 3, t: {}, b: {}, f: {}, n: {} };
  var tScopes = [], bScopes = [], notes = [];
  var SKIP = "script,style,svg,noscript,select,option,textarea,input,.j-pno,.j-corner,.ptip,.viewcur,[data-noedit],.ed-ui,.ed-note";
  var BLOCK_SCOPES = "#journal,#casePage,#sheets";
  var JSKIP = ".j-pno,.j-corner,.j-folder,.j-wash,.ed-note";
  var SITE_BLOCKS = ".face .mega,.face .ui:not(.home-ui):not(.intro-cue),.home-ui > *,.selhint";
  var FONTS = [["", "Default"], ["Archivo", "Archivo"], ["Archivo Black", "Archivo Black"], ["Archivo Narrow", "Archivo Narrow"], ["Caveat", "Caveat (handwriting)"],
    ["Patrick Hand", "Patrick Hand (notes)"], ["Special Elite", "Special Elite (typewriter)"], ["Courier Prime", "Courier Prime"], ["Architects Daughter", "Architects Daughter"], ["Homemade Apple", "Homemade Apple (script)"]];
  var COLORS = ["#2f2f2a", "#5d5c52", "#FFFEEB", "#7A1F2B", "#B0302F", "#3E7D3A", "#2F5D9E", "#C9A66B"];
  var editing = false, art = null;
  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function freshB() { return { x: 0, y: 0, s: 1, r: 0, z: null, h: 0 }; }

  /* ---------------------------------------------------------------- text */
  function hasOwnText(e) {
    for (var n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && norm(n.nodeValue).length > 1) return true;
    return false;
  }
  function collect(root, out, staticScope) {
    for (var c = root.firstElementChild; c; c = c.nextElementSibling) {
      if (c.matches(SKIP) || (staticScope && c.matches(BLOCK_SCOPES))) continue;
      if (hasOwnText(c)) out.push(c); else collect(c, out, staticScope);
    }
    return out;
  }
  function unitOf(prefix) { var c = prefix.charAt(0); return c === "j" || c === "b" ? "j" : "u"; }
  function tScope(root, prefix, staticScope) {
    var els = collect(root, [], staticScope);
    els.forEach(function (e, i) {
      e.dataset.ek = prefix + ":" + i; e.__o = norm(e.textContent); e.__h0 = e.innerHTML; e.__unit = unitOf(prefix);
      if (!e.__b) e.__b = freshB();
    });
    var s = { root: root, prefix: prefix, els: els };
    tScopes = tScopes.filter(function (x) { return x.root !== root; }); tScopes.push(s);
    function find(k, o) { var e = s.els[+k.slice(prefix.length + 1)]; if (!e || e.__o !== o) e = s.els.filter(function (x) { return x.__o === o; })[0]; return e; }
    Object.keys(EDITS.b).forEach(function (k) {           /* text moved on its own: "T" + text key */
      if (k.indexOf("T" + prefix + ":") !== 0) return;
      var v = EDITS.b[k], e = find(k.slice(1), v.o); if (!e || e.dataset.eb) return;
      e.__b = { x: v.x || 0, y: v.y || 0, s: v.s || 1, r: v.r || 0, z: v.z == null ? null : v.z, h: v.h ? 1 : 0 }; e.dataset.etSaved = k; paintBlock(e);
    });
    Object.keys(EDITS.t).forEach(function (k) {
      if (k.indexOf(prefix + ":") !== 0) return;
      var v = EDITS.t[k], e = find(k, v.o); if (e) { e.innerHTML = v.h; e.__hs = v.h; e.dataset.ekSaved = k; }
    });
    s.els.forEach(function (e) { if (e.__hs == null) e.__hs = e.__h0; });
    Object.keys(EDITS.f).forEach(function (k) {
      if (k.indexOf(prefix + ":") !== 0) return;
      var v = EDITS.f[k], e = find(k, v.o); if (e) { e.__font = v; e.dataset.efSaved = k; paintFont(e); }
    });
    return s;
  }
  function paintFont(e) {
    var f = e.__font || {}, u = "var(--" + e.__unit + ")";
    e.style.fontFamily = f.ff ? '"' + f.ff + '", ' + (/Caveat|Patrick|Homemade|Architects/.test(f.ff) ? "cursive" : /Courier|Elite/.test(f.ff) ? "monospace" : "sans-serif") : "";
    e.style.fontSize = f.fs ? "calc(" + f.fs + " * " + u + ")" : "";
    e.style.fontWeight = f.fw || "";
    e.style.fontStyle = f.fi ? "italic" : "";
    e.style.color = f.c || "";
    e.style.textAlign = f.al || "";
    e.style.letterSpacing = f.ls != null && f.ls !== "" ? f.ls + "em" : "";
    e.style.lineHeight = f.lh ? String(f.lh) : "";
    e.style.textTransform = f.tt || "";
  }

  /* -------------------------------------------------------------- blocks */
  function ident(e) {
    var im = e.tagName === "IMG" ? e : e.querySelector && e.querySelector("img");
    return im ? im.getAttribute("src") : (norm(e.textContent).slice(0, 40) || e.className);
  }
  function bScope(list, prefix, unit) {
    var els = list.filter(function (e) { return !list.some(function (o) { return o !== e && e.contains(o); }); });
    els.forEach(function (e, i) { e.dataset.eb = prefix + ":" + i; e.__bo = ident(e); e.__unit = unit; e.__b = freshB(); });
    bScopes = bScopes.filter(function (x) { return x.prefix !== prefix; }); bScopes.push({ prefix: prefix, els: els, unit: unit });
    Object.keys(EDITS.b).forEach(function (k) {
      if (k.indexOf(prefix + ":") !== 0) return;
      var v = EDITS.b[k], e = els[+k.slice(prefix.length + 1)];
      if (!e || e.__bo !== v.o) e = els.filter(function (x) { return x.__bo === v.o; })[0];
      if (!e) return;
      e.__b = { x: v.x || 0, y: v.y || 0, s: v.s || 1, r: v.r || 0, z: v.z == null ? null : v.z, h: v.h ? 1 : 0 };
      e.dataset.ebSaved = k; paintBlock(e);
    });
  }
  function paintBlock(e) {
    var b = e.__b, u = "var(--" + e.__unit + ")";
    var moved = b.x || b.y || b.s !== 1 || b.r;
    e.style.translate = b.x || b.y ? "calc(" + b.x.toFixed(2) + " * " + u + ") calc(" + b.y.toFixed(2) + " * " + u + ")" : "";
    e.style.scale = b.s !== 1 ? String(+b.s.toFixed(3)) : "";
    e.style.rotate = b.r ? b.r.toFixed(1) + "deg" : "";
    e.style.zIndex = b.z == null ? "" : String(b.z);
    if (b.z != null && getComputedStyle(e).position === "static") e.style.position = "relative";
    e.classList.toggle("ed-hidden", !!b.h);
    /* inline text can't be moved or turned; it becomes an inline block only once it is */
    if (e.dataset.ek && !e.dataset.eb && !e.dataset.en) e.style.display = moved && getComputedStyle(e).display === "inline" ? "inline-block" : (moved ? e.style.display : "");
    if (e.__unit === "j" && e.dataset.eb) { e.dataset.jx = b.x.toFixed(2); e.dataset.jy = b.y.toFixed(2); }
  }
  function syncFromJournalDrag(e) { if (e.__b && e.__unit === "j" && e.dataset.eb && e.dataset.jx != null) { e.__b.x = +e.dataset.jx || 0; e.__b.y = +e.dataset.jy || 0; } }
  function unitPx(e) {
    if (e.__unit === "j") { var j = document.getElementById("journal"); return parseFloat(j.style.getPropertyValue("--j")) || 1; }
    var p = document.createElement("i"); p.style.cssText = "position:absolute;visibility:hidden;width:calc(1000 * var(--u))";
    (e.parentNode || document.body).appendChild(p); var w = p.offsetWidth / 1000; p.remove(); return w || 1;
  }

  /* ----------------------------------------------------------- new text */
  function containerFor(where) {
    if (where.charAt(0) === "j") return (R.journalPages || [])[+where.slice(1)] || null;
    return document.querySelector('.face[data-i="' + where.slice(1) + '"]');
  }
  function makeNote(id, v) {
    var box = containerFor(v.where); if (!box) return null;
    var n = el("p", "ed-note " + (v.where.charAt(0) === "j" ? "in-j" : "in-site"), v.h || "New text");
    n.dataset.en = id; n.__unit = v.where.charAt(0) === "j" ? "j" : "u"; n.__where = v.where; n.__x0 = v.x0; n.__y0 = v.y0;
    n.style.left = "calc(" + v.x0 + " * var(--" + n.__unit + "))"; n.style.top = "calc(" + v.y0 + " * var(--" + n.__unit + "))";
    n.__b = v.b ? { x: v.b.x || 0, y: v.b.y || 0, s: v.b.s || 1, r: v.b.r || 0, z: v.b.z == null ? null : v.b.z, h: v.b.h ? 1 : 0 } : freshB();
    n.__font = v.f || {}; n.__hs = n.innerHTML;
    box.appendChild(n); paintBlock(n); paintFont(n); notes.push(n);
    return n;
  }
  function addNote() {
    var where, x0, y0, st = R.journalState ? R.journalState() : null;
    if (st && st.open) {
      var pg = document.querySelector("#journal .j-slot.r .j-page[data-p]") || document.querySelector("#journal .j-slot.l .j-page[data-p]");
      if (!pg) { toast("Turn to a page first, then add text."); return; }
      where = "j" + pg.getAttribute("data-p"); x0 = 260; y0 = 470;
    } else {
      var face = R.face ? R.face() : 0, f = containerFor("f" + face); if (!f) return;
      var r = f.getBoundingClientRect(), u = unitPx({ __unit: "u", parentNode: f });
      where = "f" + face; x0 = Math.round((r.width / 2 - 120) / u); y0 = Math.round((r.height / 2 - 30) / u);
    }
    var id = "n" + Date.now().toString(36);
    var n = makeNote(id, { where: where, x0: x0, y0: y0, h: "New text" });
    if (!n) return;
    n.dataset.nm = "1"; select(n); startTyping(n, 0, 0, true);
  }

  /* ---------------------------------------------------------------- boot */
  function boot() {
    /* blocks first: they're matched by their original words, before any saved text edit changes them */
    bScope($$(SITE_BLOCKS), "sb", "u");
    tScope(document.getElementById("site"), "s", true);
    (R.journalPages || []).forEach(function (pg, p) {
      bScope(Array.prototype.slice.call(pg.children).filter(function (c) { return !c.matches(JSKIP); }), "b" + p, "j");
      tScope(pg, "j" + p);
    });
    Object.keys(EDITS.n).forEach(function (id) { makeNote(id, EDITS.n[id]); });
  }
  R.editScope = function (root, prefix) { return tScope(root, prefix); };
  fetch("data/edits.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    .then(function (d) { if (d) EDITS = { v: 3, t: d.t || {}, b: d.b || {}, f: d.f || {}, n: d.n || {} }; boot(); });

  /* ---------------------------------------------------------- the editor */
  var pill, bar, saveBtn, msg, frame, tools, sel = null, typing = null, raf = 0;
  var HELP = "Click to select · click text twice to type · drag to move · corner to resize · top dot to rotate";
  var ICON = {
    al: '<svg viewBox="0 0 16 16"><path d="M2 3h12M2 6.5h8M2 10h12M2 13.5h8" stroke="currentColor" stroke-width="1.6"/></svg>',
    ac: '<svg viewBox="0 0 16 16"><path d="M2 3h12M4 6.5h8M2 10h12M4 13.5h8" stroke="currentColor" stroke-width="1.6"/></svg>',
    ar: '<svg viewBox="0 0 16 16"><path d="M2 3h12M6 6.5h8M2 10h12M6 13.5h8" stroke="currentColor" stroke-width="1.6"/></svg>'
  };
  function ui() {
    pill = el("button", "ed-ui ed-pill", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="1.8"/></svg><span>Edit page</span>');
    pill.type = "button"; pill.addEventListener("click", function () { setEditing(true); });
    bar = el("div", "ed-ui ed-bar", '<p class="ed-msg"></p><button type="button" class="ed-btn ghost" data-ed="add">+ Add text</button><button type="button" class="ed-btn ghost" data-ed="discard">Discard</button><button type="button" class="ed-btn" data-ed="save">Save changes</button>');
    bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Edit mode");
    msg = bar.querySelector(".ed-msg"); saveBtn = bar.querySelector('[data-ed="save"]');
    bar.addEventListener("pointerdown", function (e) { e.preventDefault(); });
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ed]"); if (!b) return;
      if (b.dataset.ed === "save") save(); else if (b.dataset.ed === "add") addNote(); else location.reload();
    });
    frame = el("div", "ed-ui ed-frame", '<i class="h-rot" data-h="rot" title="Drag to rotate"></i><i class="h-scale" data-h="scale" title="Drag to resize"></i>');
    tools = el("div", "ed-ui ed-tools",
      '<div class="row txt">' +
        '<button type="button" data-t="type" class="wide">Edit text</button>' +
        '<select data-t="ff" aria-label="Font">' + FONTS.map(function (f) { return '<option value="' + f[0] + '">' + f[1] + "</option>"; }).join("") + "</select>" +
        '<button type="button" data-t="fs-" aria-label="Smaller text">A&minus;</button><span class="fsv" aria-live="polite"></span><button type="button" data-t="fs+" aria-label="Larger text">A+</button>' +
        '<button type="button" data-t="fw" aria-label="Bold"><b>B</b></button><button type="button" data-t="fi" aria-label="Italic"><i>I</i></button><button type="button" data-t="tt" aria-label="Capitals">AA</button>' +
      "</div>" +
      '<div class="row txt">' +
        '<span class="sw">' + COLORS.map(function (c) { return '<button type="button" class="dot" data-t="c" data-v="' + c + '" style="--c:' + c + '" aria-label="Colour ' + c + '"></button>'; }).join("") +
        '<label class="dot pick" aria-label="Pick a colour"><input type="color" data-t="cp"></label></span>' +
        '<button type="button" data-t="al" data-v="left" aria-label="Align left">' + ICON.al + '</button><button type="button" data-t="al" data-v="center" aria-label="Align centre">' + ICON.ac + '</button><button type="button" data-t="al" data-v="right" aria-label="Align right">' + ICON.ar + "</button>" +
        '<button type="button" data-t="ls-" aria-label="Tighter letters">&lsaquo;A&rsaquo;</button><button type="button" data-t="ls+" aria-label="Wider letters">&lsaquo; A &rsaquo;</button>' +
        '<button type="button" data-t="lh-" aria-label="Tighter lines">&#8597;&minus;</button><button type="button" data-t="lh+" aria-label="Looser lines">&#8597;+</button>' +
      "</div>" +
      '<div class="row">' +
        '<button type="button" data-t="parent">Select card</button>' +
        '<button type="button" data-t="up">Forward</button><button type="button" data-t="down">Back</button>' +
        '<button type="button" data-t="hide">Hide</button><button type="button" data-t="reset">Reset</button>' +
      "</div>");
    tools.addEventListener("pointerdown", function (e) { e.stopPropagation(); if (e.target.tagName !== "SELECT" && e.target.tagName !== "INPUT") e.preventDefault(); });
    tools.addEventListener("click", tool);
    tools.querySelector("select").addEventListener("change", function (e) { setFont({ ff: e.target.value }); });
    tools.querySelector('input[type="color"]').addEventListener("input", function (e) { setFont({ c: e.target.value }); });
    [pill, bar, frame, tools].forEach(function (x) { document.body.appendChild(x); });
  }
  function setEditing(on) {
    editing = on; document.documentElement.classList.toggle("editing", on);
    if (!on) { stopTyping(); select(null); }
    msg.textContent = HELP;
  }
  R.isEditing = function () { return editing; };

  function isText(e) { return !!(e && (e.dataset.ek || e.dataset.en)); }
  function pick(t) {                   /* what a click lands on: text first, then its card */
    if (!t || !t.closest) return null;
    var tx = t.closest("[data-ek],[data-en]"), bl = t.closest("[data-eb]");
    if (tx && (!bl || bl.contains(tx))) return tx;
    return bl;
  }
  function select(b) {
    sel = b;
    frame.classList.toggle("on", !!b); tools.classList.toggle("on", !!b);
    if (b) { refreshTools(); if (!raf) raf = requestAnimationFrame(track); }
  }
  function track() {
    raf = 0; if (!sel) return;
    if (!sel.isConnected) { select(null); return; }
    var r = sel.getBoundingClientRect();
    frame.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px";
    var tw = tools.offsetWidth, th = tools.offsetHeight, x = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    var y = r.top - th - 30 > 64 ? r.top - th - 30 : Math.min(innerHeight - th - 8, r.bottom + 14);
    tools.style.left = x + "px"; tools.style.top = y + "px";
    raf = requestAnimationFrame(track);
  }
  function refreshTools() {
    var t = isText(sel) ? sel : null;
    tools.classList.toggle("is-text", !!t);
    var parent = t && t.parentNode && t.parentNode.closest && t.parentNode.closest("[data-eb]");
    tools.querySelector('[data-t="parent"]').hidden = !parent || parent === sel;
    tools.querySelector('[data-t="hide"]').textContent = sel.dataset.en ? "Delete" : sel.__b.h ? "Show" : "Hide";
    if (!t) return;
    var f = t.__font || {}, cs = getComputedStyle(t);
    tools.querySelector("select").value = f.ff || "";
    tools.querySelector(".fsv").textContent = Math.round(parseFloat(cs.fontSize)) + " px";
    tools.querySelector('[data-t="fw"]').classList.toggle("on", (+cs.fontWeight || 400) >= 600);
    tools.querySelector('[data-t="fi"]').classList.toggle("on", cs.fontStyle === "italic");
    tools.querySelector('[data-t="tt"]').classList.toggle("on", cs.textTransform === "uppercase");
    $$('[data-t="al"]', tools).forEach(function (b) { b.classList.toggle("on", cs.textAlign === b.dataset.v); });
    tools.querySelector('[data-t="type"]').classList.toggle("on", typing === t);
  }
  function touchB(b) { b.dataset.bm = "1"; paintBlock(b); }
  function setFont(p) {
    var t = isText(sel) ? sel : null; if (!t) return;
    t.__font = Object.assign({}, t.__font || {}, p); t.dataset.fm = "1"; paintFont(t); refreshTools();
  }
  function tool(e) {
    var b = e.target.closest("[data-t]"); if (!b || !sel || b.dataset.t === "cp" || b.tagName === "SELECT") return;
    var k = b.dataset.t, bl = sel.__b, t = isText(sel) ? sel : null, cs = t ? getComputedStyle(t) : null;
    if (k === "type" && t) { var r = t.getBoundingClientRect(); startTyping(t, r.right - 2, r.bottom - 4); }
    else if ((k === "fs+" || k === "fs-") && t) {
      var cur = parseFloat(cs.fontSize) / unitPx(t);
      setFont({ fs: Math.max(6, +(cur + (k === "fs+" ? 2 : -2)).toFixed(1)) });
    } else if (k === "fw" && t) setFont({ fw: (+cs.fontWeight || 400) >= 600 ? "400" : "700" });
    else if (k === "fi" && t) setFont({ fi: cs.fontStyle !== "italic" });
    else if (k === "tt" && t) setFont({ tt: cs.textTransform === "uppercase" ? "none" : "uppercase" });
    else if (k === "c" && t) setFont({ c: b.dataset.v });
    else if (k === "al" && t) setFont({ al: b.dataset.v });
    else if ((k === "ls+" || k === "ls-") && t) {
      var ls = (parseFloat(cs.letterSpacing) || 0) / (parseFloat(cs.fontSize) || 16);
      setFont({ ls: +(ls + (k === "ls+" ? 0.02 : -0.02)).toFixed(3) });
    } else if ((k === "lh+" || k === "lh-") && t) {
      var lh = (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2) / (parseFloat(cs.fontSize) || 16);
      setFont({ lh: Math.max(0.7, +(lh + (k === "lh+" ? 0.1 : -0.1)).toFixed(2)) });
    } else if (k === "parent") { stopTyping(); select(sel.parentNode.closest("[data-eb]")); }
    else if (k === "up" || k === "down") {
      var sib = Array.prototype.slice.call(sel.parentNode.children).map(function (c) { return parseInt(getComputedStyle(c).zIndex, 10) || 0; });
      bl.z = k === "up" ? Math.max.apply(null, sib) + 1 : Math.max(0, Math.min.apply(null, sib) - 1); touchB(sel);
    } else if (k === "hide") {
      if (sel.dataset.en) { var n = sel; stopTyping(); select(null); n.remove(); notes = notes.filter(function (x) { return x !== n; }); n.__deleted = true; deletedNotes.push(n.dataset.en); return; }
      bl.h = bl.h ? 0 : 1; touchB(sel); refreshTools();
    } else if (k === "reset") {
      sel.__b = freshB(); touchB(sel); if (t) { t.__font = {}; t.dataset.fm = "1"; paintFont(t); }
      refreshTools();
    }
  }
  var deletedNotes = [];

  /* ---- pointer: select, move, resize, rotate */
  var op = null;
  addEventListener("pointerdown", function (e) {
    if (!editing || e.button > 0) return;
    if (e.target.closest(".ed-tools,.ed-bar,.ed-pill")) return;
    if (typing && typing.contains(e.target)) { e.stopPropagation(); return; }
    var h = e.target.closest(".ed-frame [data-h]");
    var b = h ? sel : pick(e.target);
    if (!b) { stopTyping(); select(null); return; }
    e.stopPropagation(); e.preventDefault();
    var again = b === sel && isText(b) && !h;      /* a second click on selected text: type there */
    stopTyping();
    if (b !== sel) select(b);
    var r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, bl = b.__b;
    syncFromJournalDrag(b);
    op = { kind: h ? h.dataset.h : "move", b: b, x0: e.clientX, y0: e.clientY, u: unitPx(b), cx: cx, cy: cy, bx: bl.x, by: bl.y, s0: bl.s, r0: bl.r, again: again,
      d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, a0: Math.atan2(e.clientY - cy, e.clientX - cx), moved: false };
    try { (h || b).setPointerCapture(e.pointerId); } catch (x) {}
  }, true);
  addEventListener("pointermove", function (e) {
    if (!op) return;
    var dx = e.clientX - op.x0, dy = e.clientY - op.y0, bl = op.b.__b;
    if (!op.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    op.moved = true; e.stopPropagation();
    if (op.kind === "move") { bl.x = op.bx + dx / op.u; bl.y = op.by + dy / op.u; }
    else if (op.kind === "scale") bl.s = Math.max(0.2, Math.min(5, op.s0 * Math.hypot(e.clientX - op.cx, e.clientY - op.cy) / op.d0));
    else { var r = op.r0 + (Math.atan2(e.clientY - op.cy, e.clientX - op.cx) - op.a0) * 180 / Math.PI; if (!e.shiftKey) { var sn = Math.round(r / 15) * 15; if (Math.abs(r - sn) < 3) r = sn; } bl.r = r; }
    touchB(op.b);
  }, true);
  function endOp(e) {
    if (!op) return;
    e.stopPropagation();
    var o = op; op = null;
    if (o.again && !o.moved && e.type === "pointerup") startTyping(o.b, e.clientX, e.clientY);
  }
  addEventListener("pointerup", endOp, true); addEventListener("pointercancel", endOp, true);
  /* while editing, nothing selectable triggers the page (links, flips, folds) */
  addEventListener("click", function (e) {
    if (!editing || e.target.closest(".ed-ui")) return;
    if (pick(e.target) || (typing && typing.contains(e.target))) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  addEventListener("dblclick", function (e) {
    if (!editing) return;
    var t = e.target.closest("[data-ek],[data-en]"); if (!t || e.target.closest(".ed-ui")) return;
    e.preventDefault(); e.stopPropagation(); select(t); startTyping(t, e.clientX, e.clientY);
  }, true);

  /* ---- typing */
  function startTyping(t, x, y, all) {
    stopTyping(); typing = t;
    t.setAttribute("contenteditable", "true"); t.setAttribute("spellcheck", "false"); t.focus({ preventScroll: true });
    var s = getSelection(), rg = !all && document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    if (!rg || !t.contains(rg.startContainer)) { rg = document.createRange(); rg.selectNodeContents(t); if (!all) rg.collapse(false); }
    s.removeAllRanges(); s.addRange(rg);
    msg.textContent = "Typing · Enter for a new line · Esc when done";
    if (sel === t) refreshTools();
  }
  function stopTyping() {
    if (!typing) return;
    var t = typing; typing = null;
    t.removeAttribute("contenteditable"); t.removeAttribute("spellcheck"); t.blur();
    if (msg) msg.textContent = HELP;
    if (sel === t) refreshTools();
  }
  R.editType = function (t) { select(t); var r = t.getBoundingClientRect(); startTyping(t, r.right - 2, r.top + r.height / 2); };
  addEventListener("input", function (e) { if (typing && typing.contains(e.target)) typing.dataset.edDirty = "1"; }, true);
  addEventListener("paste", function (e) {
    if (!typing || !typing.contains(e.target)) return;
    e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
  }, true);
  addEventListener("keydown", function (e) {
    if (!editing) return;
    if (typing) {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); stopTyping(); }
      else if (e.key === "Enter") { e.preventDefault(); if (!document.execCommand("insertLineBreak")) document.execCommand("insertHTML", false, "<br>"); }
      return;
    }
    if (!sel || (e.target.closest && e.target.closest(".ed-tools select,.ed-tools input"))) return;
    var bl = sel.__b, n = e.shiftKey ? 10 : 1, used = true;
    if (e.key === "ArrowLeft") bl.x -= n; else if (e.key === "ArrowRight") bl.x += n;
    else if (e.key === "ArrowUp") bl.y -= n; else if (e.key === "ArrowDown") bl.y += n;
    else if (e.key === "Delete" || e.key === "Backspace") { if (sel.dataset.en) { tools.querySelector('[data-t="hide"]').click(); e.preventDefault(); e.stopPropagation(); return; } bl.h = 1; }
    else if (e.key === "Escape") select(null);
    else if (e.key === "Enter" && isText(sel)) { R.editType(sel); e.preventDefault(); e.stopPropagation(); return; }
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); if (sel) { touchB(sel); refreshTools(); } }
  }, true);

  /* ---------------------------------------------------------------- save */
  function clean(html) {
    var d = document.createElement("template"); d.innerHTML = html;
    d.content.querySelectorAll("script,style,iframe,object,embed,meta,link").forEach(function (x) { x.remove(); });
    d.content.querySelectorAll("div,p").forEach(function (x) { x.replaceWith.apply(x, [document.createElement("br")].concat(Array.prototype.slice.call(x.childNodes))); });
    d.content.querySelectorAll("font").forEach(function (x) { x.replaceWith.apply(x, Array.prototype.slice.call(x.childNodes)); });
    d.content.querySelectorAll("*").forEach(function (x) { Array.prototype.slice.call(x.attributes).forEach(function (a) { if (a.name !== "class") x.removeAttribute(a.name); }); });
    return d.innerHTML.replace(/^(<br>)+/, "");
  }
  function bOut(v, o) { return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), s: +v.s.toFixed(3), r: +v.r.toFixed(1), z: v.z, h: v.h, o: o }; }
  function isDefault(v) { return !v.x && !v.y && v.s === 1 && !v.r && v.z == null && !v.h; }
  function fontOut(v) { var o = {}; ["ff", "fs", "fw", "fi", "c", "al", "ls", "lh", "tt"].forEach(function (k) { if (v[k] != null && v[k] !== "" && v[k] !== false) o[k] = v[k]; }); return o; }
  function gather() {
    var c = JSON.parse(JSON.stringify(EDITS)), n = 0;
    tScopes.forEach(function (s) {
      s.els.forEach(function (e) {
        if (e.dataset.edDirty && e.innerHTML !== e.__hs) {
          var key = e.dataset.ekSaved || e.dataset.ek, h = clean(e.innerHTML); n++;
          if (h === e.__h0) delete c.t[key]; else c.t[key] = { h: h, o: e.__o };
        }
        if (e.dataset.fm) {
          var fk = e.dataset.efSaved || e.dataset.ek, fo = fontOut(e.__font || {}); n++;
          if (!Object.keys(fo).length) delete c.f[fk]; else { fo.o = e.__o; c.f[fk] = fo; }
        }
        if (e.dataset.bm && !e.dataset.eb) {
          var tk = e.dataset.etSaved || ("T" + e.dataset.ek); n++;
          if (isDefault(e.__b)) delete c.b[tk]; else c.b[tk] = bOut(e.__b, e.__o);
        }
      });
    });
    bScopes.forEach(function (s) {
      s.els.forEach(function (e) {
        if (!e.dataset.bm) return; n++;
        var key = e.dataset.ebSaved || e.dataset.eb;
        if (isDefault(e.__b)) delete c.b[key]; else c.b[key] = bOut(e.__b, e.__bo);
      });
    });
    notes.forEach(function (e) {
      if (!(e.dataset.nm || e.dataset.bm || e.dataset.fm || e.dataset.edDirty)) return; n++;
      c.n[e.dataset.en] = { where: e.__where, x0: e.__x0, y0: e.__y0, h: clean(e.innerHTML), b: bOut(e.__b), f: fontOut(e.__font || {}) };
    });
    deletedNotes.forEach(function (id) { if (c.n[id]) { delete c.n[id]; n++; } });
    c.v = 3;
    return { n: n, data: c };
  }
  R.editGather = gather;
  function save() {
    stopTyping();
    var g = gather();
    if (!g.n) { setEditing(false); toast("Nothing changed"); return; }
    saveBtn.disabled = true; msg.textContent = "Saving…";
    art.publish({ "data/edits.json": { content: JSON.stringify(g.data), contentType: "application/json" } }).then(function () {
      EDITS = g.data; deletedNotes = [];
      tScopes.forEach(function (s) { s.els.forEach(function (e) { if (e.dataset.edDirty) { e.__hs = e.innerHTML; delete e.dataset.edDirty; } delete e.dataset.fm; delete e.dataset.bm; }); });
      bScopes.forEach(function (s) { s.els.forEach(function (e) { delete e.dataset.bm; }); });
      notes.forEach(function (e) { ["nm", "bm", "fm", "edDirty"].forEach(function (k) { delete e.dataset[k]; }); });
      saveBtn.disabled = false; setEditing(false); toast("Saved. Everyone who opens the page now sees your changes.");
    }, function (err) {
      saveBtn.disabled = false;
      var code = err && err.code;
      msg.textContent = code === "conflict" ? "Someone saved a newer version first; the page is reloading to it."
        : code === "not_writer" || code === "not_granted" ? "This view can't save: you need edit access to this page."
        : code === "capability_disabled" ? "Saving isn't available in this view. Open the page from your claude.ai artifacts and try again."
        : code === "too_large" ? "Those changes are too large to save at once."
        : "Couldn't save just now. Your changes are still here; try Save again.";
    });
  }
  var tEl = null;
  function toast(t) {
    if (!tEl) { tEl = el("p", "ed-ui ed-toast", ""); tEl.setAttribute("role", "status"); document.body.appendChild(tEl); }
    tEl.textContent = t; tEl.classList.add("on"); clearTimeout(tEl._t); tEl._t = setTimeout(function () { tEl.classList.remove("on"); }, 3200);
  }

  /* show the Edit button only to people who can save this page */
  (function gate() {
    if (!window.claude || !window.claude.use) return;
    Promise.all([window.claude.use("artifact"), window.claude.use("user")]).then(function (r) {
      art = r[0]; var u = r[1];
      if (!art) return;
      return (u && u.canEdit ? u.canEdit() : Promise.resolve(false)).then(function (ok) { if (ok) ui(); });
    }).catch(function () {});
  })();
  R.__editTest = function (fake) { art = fake; if (!pill) ui(); };
})();
