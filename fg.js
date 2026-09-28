/* Fun Games shared helpers: play modes, difficulty, and the peer-to-peer room link.
   Each game calls FG.setup({ start, stop, onMessage }) once. Modes come from the URL:
     ?mode=cpu&level=easy|normal|hard   play against the computer
     ?mode=local                        two players, one screen
     ?mode=host                         create an online room (shows a room code)
     ?join=CODE                         join a friend's room
*/
(function () {
  "use strict";
  var BASE = new URL("../", document.currentScript.src).href;
  var FILES = { L: "light-cycle-duel", C: "chain-reaction", M: "monkey-fruit-fight", S: "sumo-bump", B: "bee-garden", F: "frog-pond", K: "cake-stack-duel" };
  var ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  var ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }];
  var ID_PREFIX = "fungames-";
  // Optional: shared/config.js can set window.FG_PEER (own signaling server) and window.FG_ICE (extra TURN servers)
  function peerOptions() { return Object.assign({ config: { iceServers: ICE.concat(window.FG_ICE || []) } }, window.FG_PEER || {}); }

  var q = new URLSearchParams(location.search);
  var file = location.pathname.split("/").pop().replace(/\.html$/, "");
  var letter = Object.keys(FILES).filter(function (k) { return FILES[k] === file; })[0] || "X";
  var mode = q.get("join") ? "join" : q.get("mode");
  if (["cpu", "local", "host", "join"].indexOf(mode) < 0) mode = "none";
  var level = q.get("level") || store("fg-level") || "normal";
  if (["easy", "normal", "hard"].indexOf(level) < 0) level = "normal";

  var peer = null, conn = null, timer = null, pingTimer = null, gone = false, tries = 0;

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* private mode */ }
    return null;
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function newCode() {
    var c = letter;
    for (var i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return c;
  }

  var FG = window.FG = {
    mode: mode,
    level: level,
    online: mode === "host" || mode === "join",
    isHost: mode === "host",
    isGuest: mode === "join",
    role: mode === "join" ? 1 : 0,       // the host is player 1 (index 0), the guest is player 2 (index 1)
    started: false,
    connected: false,
    code: "",
    ping: 0,
    opts: null,

    /* pick a value by difficulty */
    pick: function (easy, normal, hard) { return level === "easy" ? easy : level === "hard" ? hard : normal; },
    /* index of the one human on this device, or -1 when two people share the screen */
    human: function () { return mode === "cpu" ? 0 : FG.online ? FG.role : -1; },
    mine: function (i) { var h = FG.human(); return h < 0 || h === i; },
    ai: function (i) { return mode === "cpu" && i === 1; },
    you: function (names) { var h = FG.human(); return h < 0 ? "" : "You are " + names[h]; },

    send: function (m) { if (conn && conn.open) conn.send(m); },

    setup: function (o) {
      FG.opts = o;
      buildMenu();
      buildLobby();
      var again = $("againBtn");
      if (again) again.parentNode.appendChild(homeButton());
      if (mode === "host") hostRoom();
      else if (mode === "join") joinRoom();
      if (FG.online) FG.show("lobby");
    },

    show: function (id) {
      var ov = $("overlay");
      Array.prototype.forEach.call(ov.querySelectorAll(".panel"), function (p) { p.classList.toggle("hidden", p.id !== id); });
      ov.classList.remove("hidden");
    },
    back: function () { FG.show(FG.online && !FG.started ? "lobby" : "menu"); },

    /* Start button: solo and same-screen games start right away */
    start: function () {
      if (FG.online) return;
      FG.started = true;
      FG.opts.start();
    },
    /* Play again: the host restarts for both players, the guest asks the host */
    again: function () {
      if (!FG.online) { FG.opts.start(); return; }
      if (FG.isHost) { hostBegin(); return; }
      var b = $("againBtn");
      if (b) { b.disabled = true; b.textContent = "Waiting for host..."; }
      FG.send({ t: "again" });
    }
  };

  /* ---------- body classes so each game can show only your controls ---------- */
  document.body.classList.add("fg-" + (mode === "none" ? "local" : mode === "host" || mode === "join" ? "online" : mode));
  if (FG.human() >= 0) document.body.classList.add("fg-solo", "fg-me-" + FG.human());

  /* ---------- menu ---------- */
  function homeButton() {
    var b = el("button", "big ghost", "All games");
    b.onclick = function () { location.href = BASE + "index.html"; };
    return b;
  }

  function buildMenu() {
    var menu = $("menu"), start = $("startBtn");
    if (!menu || !start) return;
    var box = el("div", "fg-mode");
    menu.insertBefore(box, start);

    if (mode === "cpu") {
      box.appendChild(el("div", "fg-line", "🤖 Solo vs Computer"));
      var chips = el("div", "fg-chips");
      ["easy", "normal", "hard"].forEach(function (l) {
        var c = el("button", "fg-chip" + (l === level ? " on" : ""), l[0].toUpperCase() + l.slice(1));
        c.onclick = function () {
          level = FG.level = l; store("fg-level", l);
          Array.prototype.forEach.call(chips.children, function (x) { x.classList.toggle("on", x === c); });
          var u = new URL(location.href); u.searchParams.set("level", l); history.replaceState(null, "", u);
        };
        chips.appendChild(c);
      });
      box.appendChild(chips);
    } else if (mode === "local") {
      box.appendChild(el("div", "fg-line", "👥 Two players, one screen"));
    } else if (mode === "none") {
      start.classList.add("hidden");
      var go = function (qs) { location.search = qs; };
      [["🤖 Play vs Computer", "?mode=cpu"], ["👥 Same screen, 2 players", "?mode=local"], ["🌐 Create an online room", "?mode=host"]].forEach(function (r) {
        var b = el("button", "big", r[0]); b.onclick = function () { go(r[1]); }; box.appendChild(b);
      });
      var input = el("input", "fg-input"); input.placeholder = "Room code"; input.maxLength = 5; input.setAttribute("aria-label", "Room code");
      var join = el("button", "big ghost", "🔗 Join with a code");
      join.onclick = function () { var c = input.value.trim().toUpperCase(); if (c.length >= 4) go("?join=" + c); else input.focus(); };
      box.appendChild(input); box.appendChild(join);
    }
    menu.appendChild(homeButton());
  }

  /* ---------- online lobby ---------- */
  function buildLobby() {
    var ov = $("overlay");
    var p = el("div", "panel hidden"); p.id = "lobby";
    p.innerHTML =
      '<h1 id="fgTitle">Play online</h1><div class="bar"></div>' +
      '<p class="sub" id="fgSub"></p>' +
      '<div class="fg-code" id="fgCode"></div>' +
      '<p class="fg-status" id="fgStatus" role="status"></p>';
    var share = el("button", "big", "Share invite link"); share.id = "fgShare";
    var copy = el("button", "big ghost", "Copy code"); copy.id = "fgCopy";
    var how = el("button", "big ghost", "How to play"); how.onclick = function () { FG.show("how"); };
    var cancel = homeButton(); cancel.textContent = "Cancel";
    if (mode === "host") { p.appendChild(share); p.appendChild(copy); }
    p.appendChild(how); p.appendChild(cancel);
    ov.appendChild(p);
    $("fgTitle").textContent = mode === "join" ? "Joining a game" : "Play online";
    $("fgSub").textContent = mode === "join" ? "Connecting to your friend's room" : "Send this code to your friend";
    share.onclick = function () { shareLink(); };
    copy.onclick = function () { copyText(FG.code, "Code copied"); };

    var gonePanel = el("div", "panel hidden"); gonePanel.id = "fgGone";
    gonePanel.innerHTML = '<h1>Connection lost</h1><div class="bar"></div><p class="sub" id="fgGoneMsg">Your friend left the game.</p>';
    gonePanel.appendChild(homeButton());
    ov.appendChild(gonePanel);

    var badge = el("div", "fg-badge hidden"); badge.id = "fgBadge";
    document.body.appendChild(badge);
  }

  function showCode(c) {
    var box = $("fgCode"); box.innerHTML = "";
    c.split("").forEach(function (ch) { box.appendChild(el("span", "fg-tile", ch)); });
  }
  function setStatus(s) { var e = $("fgStatus"); if (e) e.textContent = s; }
  function inviteUrl() { return location.origin + location.pathname + "?join=" + FG.code; }

  function copyText(text, msg) {
    var done = function () { setStatus(msg); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copy this:", text); });
    else window.prompt("Copy this:", text);
  }
  function shareLink() {
    var url = inviteUrl();
    if (navigator.share) navigator.share({ title: document.title, text: "Play " + document.title + " with me! Room " + FG.code, url: url }).catch(function () {});
    else copyText(url, "Invite link copied");
  }

  /* ---------- peer-to-peer connection ---------- */
  function withPeer(cb) {
    if (window.Peer) { cb(); return; }
    var s = document.createElement("script");
    s.src = BASE + "vendor/peerjs.min.js";
    s.onload = cb;
    s.onerror = function () { fail("Could not load the online play library."); };
    document.head.appendChild(s);
  }

  function fail(e) {
    var t = typeof e === "string" ? e : e && e.type;
    var msg = typeof e === "string" ? e :
      t === "peer-unavailable" ? "No room found with that code. Check it and try again." :
      t === "timeout" ? "Could not reach that room. Check the code, or ask your friend to create a new one." :
      "Could not reach the matchmaking server. Check your internet connection and try again.";
    setStatus(msg);
    if (FG.connected) return;
    var s = $("fgShare"), c = $("fgCopy");
    if (s) s.classList.add("hidden");
    if (c) c.classList.add("hidden");
  }

  function hostRoom() {
    setStatus("Setting up your room...");
    withPeer(function () {
      FG.code = newCode();
      peer = new window.Peer(ID_PREFIX + FG.code, peerOptions());
      peer.on("open", function () { showCode(FG.code); setStatus("Waiting for your friend to join..."); });
      peer.on("connection", function (c) { if (conn) { c.close(); return; } attach(c); });
      peer.on("error", function (e) {
        if (e && e.type === "unavailable-id" && tries++ < 5) { peer.destroy(); hostRoom(); return; }
        fail(e);
      });
    });
  }

  function joinRoom() {
    FG.code = (q.get("join") || "").toUpperCase();
    showCode(FG.code);
    setStatus("Connecting...");
    withPeer(function () {
      peer = new window.Peer(undefined, peerOptions());
      peer.on("open", function () {
        attach(peer.connect(ID_PREFIX + FG.code, { reliable: true, serialization: "json" }));
        timer = setTimeout(function () { if (!FG.connected) fail({ type: "timeout" }); }, 15000);
      });
      peer.on("error", function (e) { if (!FG.connected) fail(e); });
    });
  }

  function attach(c) {
    conn = c;
    c.on("open", onOpen);
    c.on("data", onData);
    c.on("close", onClose);
    c.on("error", onClose);
  }

  function onOpen() {
    FG.connected = true;
    clearTimeout(timer);
    pingTimer = setInterval(function () { FG.send({ t: "ping", n: performance.now() }); }, 2000);
    if (FG.isHost) {
      setStatus("Friend joined! Starting...");
      setTimeout(hostBegin, 1200);
    } else setStatus("Connected! Waiting for the host to start...");
  }

  function hostBegin() {
    if (!FG.connected || gone) return;
    FG.started = true;
    resetAgain();
    var pl = FG.opts.start();
    FG.send({ t: "start", pl: pl === undefined ? null : pl });
  }

  function resetAgain() {
    var b = $("againBtn");
    if (b) { b.disabled = false; b.textContent = "Play again"; }
  }

  function onData(m) {
    if (!m || typeof m !== "object") return;
    if (m.t === "ping") { FG.send({ t: "pong", n: m.n }); return; }
    if (m.t === "pong") { FG.ping = Math.round(performance.now() - m.n); updateBadge(); return; }
    if (m.t === "start") { FG.started = true; resetAgain(); FG.opts.start(m.pl); return; }
    if (m.t === "again") { if (FG.isHost) hostBegin(); return; }
    if (FG.opts && FG.opts.onMessage) FG.opts.onMessage(m);
  }

  function updateBadge() {
    var b = $("fgBadge");
    if (!b) return;
    b.classList.remove("hidden");
    b.textContent = "Online " + FG.ping + " ms";
  }

  function onClose() {
    if (gone) return;
    gone = true;
    clearInterval(pingTimer);
    if (FG.opts && FG.opts.stop) FG.opts.stop();
    if (!FG.connected) return;
    FG.connected = false;
    FG.show("fgGone");
  }
})();
