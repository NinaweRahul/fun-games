import { boot, Net, run, check, noErrors } from "../harness.mjs";
const G = "sumo-bump";
const pos = p => JSON.parse(p.get("JSON.stringify(pens.map(x=>[x.x,x.y]))"));

export default async function () {
  // vs computer: the computer should beat someone who just stands there
  const wins = {};
  for (const level of ["easy", "normal", "hard"]) {
    wins[level] = 0;
    for (let g = 0; g < 3; g++) {
      const net = new Net();
      const p = await boot(G, "mode=cpu&level=" + level, net);
      p.click("startBtn");
      await run([p], net, 240, () => (p.get("state") === "over" ? "stop" : 0));
      if (p.get("state") === "over" && p.get("score[1]") >= 2) wins[level]++;
      if (g === 0) {
        check(p.get("state") === "over", `cpu ${level}: match ends`);
        noErrors(p);
      }
    }
  }
  console.log("  info computer wins by level:", JSON.stringify(wins));
  check(wins.normal >= 2 && wins.hard >= 2, `cpu normal/hard beat an idle player (${wins.normal}/3, ${wins.hard}/3)`);

  // the computer must not drive itself into the sea while the human also plays
  {
    const net = new Net();
    const p = await boot(G, "mode=cpu&level=hard", net);
    p.click("startBtn");
    let dashes = 0;
    await run([p], net, 120, (i) => {
      if (i % 40 === 0) { p.key("keydown", "KeyD", "d"); }
      if (i % 90 === 0) { p.key("keydown", "Space", " "); dashes++; p.key("keyup", "KeyD", "d"); p.key("keyup", "KeyA", "a"); p.key("keydown", i % 180 === 0 ? "KeyA" : "KeyW", "a"); }
      return p.get("state") === "over" ? "stop" : 0;
    });
    check(p.get("state") === "over", "cpu hard: active human, match ends");
    noErrors(p);
  }

  // same screen
  {
    const net = new Net();
    const p = await boot(G, "mode=local", net);
    p.click("startBtn");
    await run([p], net, 3);
    const a = pos(p);
    p.key("keydown", "KeyD", "d");        // orange, right
    p.key("keydown", "ArrowUp", "ArrowUp"); // blue, up
    await run([p], net, 0.6);
    const b = pos(p);
    check(b[0][0] > a[0][0] + 10, "local: WASD moves orange");
    check(b[1][1] < a[1][1] - 10, "local: arrows move blue");
    noErrors(p);
  }

  // online
  {
    const net = new Net(50);
    const host = await boot(G, "mode=host", net, "host");
    await run([host], net, 0.2);
    const guest = await boot(G, "join=" + host.get("FG.code"), net, "guest");
    await run([host, guest], net, 5);
    check(host.get("state") === "play" && guest.get("state") === "play", "online: both in play");
    const near = () => { const h = pos(host), g = pos(guest); return h.every((v, i) => Math.hypot(v[0] - g[i][0], v[1] - g[i][1]) < 40); };
    host.key("keydown", "KeyD", "d");
    guest.key("keydown", "ArrowLeft", "ArrowLeft");
    await run([host, guest], net, 0.8);
    const before = pos(host);
    check(before[1][0] < 400, "online: guest steering moves the blue penguin on the host (x=" + before[1][0].toFixed(0) + ")");
    check(near(), "online: guest view follows the host " + JSON.stringify(pos(host).map(v => v.map(Math.round))) + " vs " + JSON.stringify(pos(guest).map(v => v.map(Math.round))));
    guest.key("keydown", "Enter", "Enter");
    await run([host, guest], net, 0.5);
    check(host.get("pens[1].cd") > 0, "online: guest dash reaches the host");
    host.key("keyup", "KeyD", "d");   // a perfectly balanced shoving match only ends in draws; let the guest win
    let drift = 0;
    await run([host, guest], net, 200, () => { if (!near()) drift++; return host.get("state") === "over" ? "stop" : 0; });
    await run([host, guest], net, 3);
    check(host.get("state") === "over" && guest.get("state") === "over", "online: match ends on both");
    check(!guest.win.document.getElementById("end").classList.contains("hidden"), "online: guest sees the end screen");
    check(guest.get("document.getElementById('result').textContent") === host.get("document.getElementById('result').textContent"), "online: same result text");
    check(host.get("JSON.stringify(score)") === guest.get("JSON.stringify(score)"), "online: scores agree");
    console.log("  info frames out of sync (>40px):", drift);
    guest.click("againBtn");
    await run([host, guest], net, 4);
    check(host.get("state") !== "over" && guest.get("state") !== "over" && host.get("score[0]") === 0, "online: guest rematch restarts the match");
    noErrors(host, guest);
  }
}
