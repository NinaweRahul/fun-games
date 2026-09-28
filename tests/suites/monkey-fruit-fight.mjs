import { boot, Net, run, check, noErrors } from "../harness.mjs";
const G = "monkey-fruit-fight";

// pull back and let go, like a finger would: `deg` is the throw angle above the horizon, `power` 0..1
function throwFruit(p, side, deg, power) {
  const s = p.get("scale()"), L = power * 110 * s, a = deg * Math.PI / 180;
  const dir = side === 0 ? 1 : -1;
  const dx = -Math.cos(a) * dir * L, dy = Math.sin(a) * L;
  p.pointer("body", "pointerdown", 50, 50, 7);
  p.pointer("body", "pointermove", 50 + dx, 50 + dy, 7);
  p.pointer("body", "pointerup", 50 + dx, 50 + dy, 7);
}
const randThrow = (p, side) => throwFruit(p, side, 25 + Math.random() * 50, 0.5 + Math.random() * 0.5);

export default async function () {
  // vs computer
  const wins = {};
  for (const level of ["easy", "hard"]) {
    wins[level] = 0;
    for (let g = 0; g < 3; g++) {
      const net = new Net();
      const p = await boot(G, "mode=cpu&level=" + level, net);
      p.click("startBtn");
      let pending = false;
      await run([p], net, 900, () => {
        const st = p.get("state");
        if (st === "over") return "stop";
        if (st !== "aim") pending = false;
        if (st === "aim" && p.get("turn") === 0 && !pending) { pending = true; randThrow(p, 0); }
        return 0;
      });
      const over = p.get("state") === "over";
      if (over && p.get("mk[0].hp") <= 0) wins[level]++;
      if (g === 0) { check(over, `cpu ${level}: game ends`); noErrors(p); }
    }
  }
  check(wins.hard >= 2, `cpu hard beats a random thrower (${wins.hard}/3)`);
  console.log("  info computer wins by level:", JSON.stringify(wins));

  // human cannot throw on the computer's turn; fruit buttons lock
  {
    const net = new Net();
    const p = await boot(G, "mode=cpu&level=normal", net);
    p.click("startBtn");
    randThrow(p, 0);
    await run([p], net, 0.5);
    const before = p.get("proj.length");
    p.get("state = 'aim'"); // pretend it is aim time but computer's turn
    p.get("turn = 1");
    randThrow(p, 1);
    check(p.get("proj.length") === before, "cpu: human input is ignored on the computer's turn");
    noErrors(p);
  }

  // same screen
  {
    const net = new Net();
    const p = await boot(G, "mode=local", net);
    p.click("startBtn");
    randThrow(p, 0);
    await run([p], net, 6);
    check(p.get("turn") === 1 && p.get("state") === "aim", "local: turn passes to the second monkey");
    randThrow(p, 1);
    await run([p], net, 6);
    check(p.get("turn") === 0, "local: and back again");
    noErrors(p);
  }

  // online
  {
    const net = new Net(60);
    const host = await boot(G, "mode=host", net, "host");
    await run([host], net, 0.2);
    const guest = await boot(G, "join=" + host.get("FG.code"), net, "guest");
    await run([host, guest], net, 3);
    const same = (code) => host.get(code) === guest.get(code);
    check(host.get("state") === "aim" && guest.get("state") === "aim", "online: both start in aim");
    check(same("JSON.stringify(Array.from(h))"), "online: same terrain");
    check(same("wind"), "online: same wind");
    // guest must not throw on the host's turn
    throwFruit(guest, 1, 45, 0.8);
    await run([host, guest], net, 0.3);
    check(host.get("proj.length") === 0 && guest.get("proj.length") === 0, "online: guest cannot throw on host's turn");
    let pending = false, turns = 0;
    await run([host, guest], net, 900, () => {
      const hs = host.get("state"), gs = guest.get("state");
      if (hs === "over" && gs === "over") return "stop";
      if (hs !== "aim") pending = false;
      if (hs === "aim" && gs === "aim" && host.get("turn") === guest.get("turn") && !pending) {
        pending = true; turns++;
        const t = host.get("turn");
        randThrow(t === 0 ? host : guest, t);
      }
      return 0;
    });
    await run([host, guest], net, 3);
    check(host.get("state") === "over" && guest.get("state") === "over", `online: game over on both after ${turns} turns`);
    check(same("JSON.stringify(mk.map(m=>m.hp))"), "online: hearts agree");
    check(same("JSON.stringify(Array.from(h))"), "online: terrain agrees after every crater");
    check(same("JSON.stringify(score)"), "online: scores agree");
    host.click("againBtn");
    await run([host, guest], net, 3);
    check(host.get("state") === "aim" && guest.get("state") === "aim" && same("JSON.stringify(Array.from(h))"), "online: rematch gives both a fresh, identical board");
    noErrors(host, guest);
  }
}
