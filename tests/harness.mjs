// Headless harness: loads a game page in jsdom with virtual time, a stub canvas,
// and an in-memory stand-in for PeerJS so two pages can play each other.
import { JSDOM, VirtualConsole } from "jsdom";
import FakeTimers from "@sinonjs/fake-timers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Virtual network: messages arrive after `latency` virtual milliseconds. */
export class Net {
  constructor(latency = 40) { this.peers = new Map(); this.q = []; this.t = 0; this.latency = latency; this.sent = 0; }
  later(ms, fn) { this.q.push({ at: this.t + ms, fn }); }
  deliver() {
    const due = this.q.filter(m => m.at <= this.t);
    this.q = this.q.filter(m => m.at > this.t);
    due.forEach(m => m.fn());
  }
}

function installPeer(win, net) {
  class Conn {
    constructor() { this.h = {}; this.open = false; this.other = null; }
    on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); }
    emit(ev, ...a) { (this.h[ev] || []).forEach(f => f(...a)); }
    send(d) {
      net.sent++;
      const o = this.other, data = JSON.parse(JSON.stringify(d));
      net.later(net.latency, () => { if (o.open) o.emit("data", data); });
    }
    close() {
      if (!this.open) return;
      this.open = false;
      const o = this.other;
      net.later(net.latency, () => { if (o.open) { o.open = false; o.emit("close"); } });
    }
  }
  class Peer {
    constructor(id, opts) {
      if (id && typeof id === "object") { opts = id; id = null; }
      this.h = {};
      const taken = id && net.peers.has(id);
      this.id = id || "anon" + Math.random().toString(36).slice(2);
      if (!taken) net.peers.set(this.id, this);
      net.later(1, () => taken ? this.emit("error", { type: "unavailable-id" }) : this.emit("open", this.id));
    }
    on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); }
    emit(ev, ...a) { (this.h[ev] || []).forEach(f => f(...a)); }
    connect(id) {
      const c = new Conn(), target = net.peers.get(id);
      net.later(net.latency, () => {
        if (!target) { this.emit("error", { type: "peer-unavailable" }); return; }
        const c2 = new Conn();
        c.other = c2; c2.other = c;
        target.emit("connection", c2);
        net.later(net.latency, () => { c.open = c2.open = true; c.emit("open"); c2.emit("open"); });
      });
      return c;
    }
    destroy() { net.peers.delete(this.id); }
  }
  win.Peer = Peer;
}

function stubBrowser(win) {
  const grad = { addColorStop() {} };
  const target = { measureText: () => ({ width: 10 }), createLinearGradient: () => grad, createRadialGradient: () => grad };
  const ctx = new Proxy(target, {
    get: (t, p) => (p in t ? t[p] : typeof p === "string" ? () => {} : undefined),
    set: (t, p, v) => { t[p] = v; return true; }
  });
  win.HTMLCanvasElement.prototype.getContext = function () { return ctx; };
  win.Element.prototype.getBoundingClientRect = function () {
    const w = parseFloat(this.style && this.style.width) || 300, h = parseFloat(this.style && this.style.height) || w;
    return { left: 0, top: 0, right: w, bottom: h, width: w, height: h };
  };
  win.Element.prototype.setPointerCapture = function () {};
}

/* Load one game page. `query` is the URL query string, for example "mode=cpu&level=hard". */
export async function boot(game, query, net, name = game) {
  const file = path.join(ROOT, "games", game + ".html");
  const errors = [];
  const vc = new VirtualConsole();
  // The sandbox has no internet, so Google Fonts requests are expected to fail; ignore those.
  const nav = [];
  vc.on("jsdomError", e => {
    const m = String((e && e.stack) || e);
    if (/Not implemented: navigation/.test(m)) nav.push(m);   // pages that redirect (hub -> game)
    else if (!/Could not load link/.test(m)) errors.push(m);
  });
  let clock;
  const dom = new JSDOM(fs.readFileSync(file, "utf8"), {
    url: pathToFileURL(file).href + (query ? "?" + query : ""),
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      clock = FakeTimers.withGlobal(win).install({
        now: 1000, toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "performance", "Date"]
      });
      stubBrowser(win);
      if (net) installPeer(win, net);
      win.addEventListener("error", e => errors.push("uncaught: " + ((e.error && e.error.stack) || e.message)));
    }
  });
  const win = dom.window;
  await new Promise(r => (win.document.readyState === "complete" ? r() : win.addEventListener("load", r)));
  return {
    name, win, clock, errors, nav,
    get: code => win.eval(code),
    key(type, code, k) { win.dispatchEvent(new win.KeyboardEvent(type, { code, key: k || code, bubbles: true })); },
    click(id) { win.document.getElementById(id).dispatchEvent(new win.MouseEvent("click", { bubbles: true })); },
    down(sel) { const e = win.document.querySelector(sel); e.dispatchEvent(new win.Event("pointerdown", { bubbles: true, cancelable: true })); },
    pointer(sel, type, x, y, id = 1) {
      const e = new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      Object.defineProperty(e, "pointerId", { value: id });
      (typeof sel === "string" ? win.document.querySelector(sel) : sel || win).dispatchEvent(e);
    }
  };
}

/* Advance every page and the network together, in 16 ms frames. */
export async function run(pages, net, seconds, each) {
  const frames = Math.round(seconds * 1000 / 16);
  for (let i = 0; i < frames; i++) {
    net.t += 16;
    pages.forEach(p => p.clock.tick(16));
    net.deliver();
    await null;   // let async/await continuations (setTimeout-based sleeps) run
    await null;
    if (each && each(i, i * 16) === "stop") return i * 16;
  }
  return seconds * 1000;
}

let failures = 0;
export function check(ok, msg) {
  console.log((ok ? "  PASS " : "  FAIL ") + msg);
  if (!ok) failures++;
}
export const failed = () => failures;
export function noErrors(...pages) {
  pages.forEach(p => check(p.errors.length === 0, p.name + ": no script errors" + (p.errors.length ? "\n      " + p.errors.slice(0, 2).join("\n      ").slice(0, 600) : "")));
}
