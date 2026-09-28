import { boot, Net, run, check, noErrors } from "../harness.mjs";
const G = "bee-garden";
const counts = p => p.get("counts()");

export default async function () {
  // vs computer: an idle human should lose to the computer bee on every level except maybe easy
  const wins = {};
  for (const level of ["easy", "normal", "hard"]) {
    wins[level] = 0;
    for (let g = 0; g < 3; g++) {
      const net = new Net();
      const p = await boot(G, "mode=cpu&level=" + level, net);
      p.click("startBtn");
      await run([p], net, 80, () => (p.get("state") === "over" ? "stop" : 0));
      await run([p], net, 2);
      const n = counts(p);
      if (n[1] > n[0]) wins[level]++;
      if (g === 0) {
        check(p.get("state") === "over", `cpu ${level}: round ends after the timer`);
        check(n[1] > 5, `cpu ${level}: the computer bee paints flowers (${n[1]})`);
        noErrors(p);
      }
    }
  }
  console.log("  info computer wins by level:", JSON.stringify(wins));
  check(wins.normal >= 2 && wins.hard >= 2, `cpu normal/hard beat an idle player (${wins.normal}/3, ${wins.hard}/3)`);

  // same screen
  {
    const net = new Net();
    const p = await boot(G, "mode=local", net);
    p.click("startBtn");
    await run([p], net, 3);
    const a = JSON.parse(p.get("JSON.stringify(bees.map(b=>[b.x,b.y]))"));
    p.key("keydown", "KeyD", "d");
    p.key("keydown", "ArrowUp", "ArrowUp");
    await run([p], net, 0.6);
    const b = JSON.parse(p.get("JSON.stringify(bees.map(b=>[b.x,b.y]))"));
    check(b[0][0] > a[0][0] + 10, "local: WASD moves honey");
    check(b[1][1] < a[1][1] - 10, "local: arrows move buzz");
    noErrors(p);
  }

  // online
  {
    const net = new Net(50);
    const host = await boot(G, "mode=host", net, "host");
    await run([host], net, 0.2);
    const guest = await boot(G, "join=" + host.get("FG.code"), net, "guest");
    await run([host, guest], net, 1.5);
    const same = c => host.get(c) === guest.get(c);
    check(same("JSON.stringify(flowers.map(f=>[f.x,f.y]))"), "online: identical flower positions");
    await run([host, guest], net, 4);
    check(host.get("state") === "play" && guest.get("state") === "play", "online: both in play");
    host.key("keydown", "KeyD", "d");
    guest.key("keydown", "ArrowLeft", "ArrowLeft");
    guest.key("keydown", "ArrowUp", "ArrowUp");
    await run([host, guest], net, 4);
    const hb = JSON.parse(host.get("JSON.stringify(bees.map(b=>[b.x,b.y]))"));
    const gb = JSON.parse(guest.get("JSON.stringify(bees.map(b=>[b.x,b.y]))"));
    check(hb[1][0] < 640 && hb[1][1] < 300, "online: guest steering moves the blue bee on the host " + JSON.stringify(hb[1].map(Math.round)));
    check(hb.every((v, i) => Math.hypot(v[0] - gb[i][0], v[1] - gb[i][1]) < 45), "online: guest view follows the host");
    await run([host, guest], net, 80, () => (host.get("state") === "over" ? "stop" : 0));
    await run([host, guest], net, 3);
    check(host.get("state") === "over" && guest.get("state") === "over", "online: round ends on both");
    check(same("JSON.stringify(flowers.map(f=>f.c))"), "online: same flower colors at the end");
    check(same("JSON.stringify(counts())"), "online: same counts " + counts(host));
    check(!guest.win.document.getElementById("end").classList.contains("hidden"), "online: guest sees the end screen");
    check(same("document.getElementById('result').textContent"), "online: same result text");
    guest.click("againBtn");
    await run([host, guest], net, 5);
    check(host.get("state") === "play" && guest.get("state") === "play", "online: guest rematch restarts");
    noErrors(host, guest);
  }
}
