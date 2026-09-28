import { boot, Net, run, check, noErrors } from "../harness.mjs";
const G = "frog-pond";

export default async function () {
  // vs computer: the frog on the right should catch flies while an idle human catches none
  const catches = {};
  for (const level of ["easy", "normal", "hard"]) {
    catches[level] = 0;
    for (let g = 0; g < 3; g++) {
      const net = new Net();
      const p = await boot(G, "mode=cpu&level=" + level, net);
      p.click("startBtn");
      await run([p], net, 75, () => (p.get("state") === "over" ? "stop" : 0));
      catches[level] += p.get("score[1]");
      if (g === 0) { check(p.get("state") === "over", `cpu ${level}: round ends`); noErrors(p); }
    }
  }
  console.log("  info computer points over 3 rounds:", JSON.stringify(catches));
  check(catches.hard > catches.easy, `cpu hard scores more than easy (${catches.hard} vs ${catches.easy})`);
  check(catches.easy > 0, "cpu easy still catches some flies");

  // solo human can fire with A, Space, or Enter
  {
    const net = new Net();
    const p = await boot(G, "mode=cpu&level=easy", net);
    p.click("startBtn");
    await run([p], net, 3);
    p.key("keydown", "Space", " ");
    check(p.get("!!frogs[0].tongue"), "cpu: Space fires your frog");
    noErrors(p);
  }

  // same screen
  {
    const net = new Net();
    const p = await boot(G, "mode=local", net);
    p.click("startBtn");
    await run([p], net, 3);
    p.key("keydown", "KeyA", "a");
    p.key("keydown", "KeyL", "l");
    check(p.get("!!frogs[0].tongue && !!frogs[1].tongue"), "local: A and L each fire their own frog");
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
    const flyIds = p => p.get("JSON.stringify(flies.map(f=>f.id).sort((a,b)=>a-b))");
    check(flyIds(host) === flyIds(guest), "online: same flies on both screens");
    // the guest's swing matches the host's swing within a small angle
    const dAng = Math.abs(host.get("frogs[1].angle") - guest.get("frogs[1].angle"));
    check(dAng < 0.12, "online: aim swing in sync (" + dAng.toFixed(3) + " rad)");
    guest.key("keydown", "KeyL", "l");
    await run([host, guest], net, 0.3);
    check(host.get("!!frogs[1].tongue") || host.get("frogs[1].pauseT") > 0 || host.get("score[1]") > 0, "online: guest fire reaches the host");
    // fire again and again from both sides for a whole round
    let n = 0;
    await run([host, guest], net, 80, i => {
      if (i % 40 === 0) { host.key("keydown", "KeyA", "a"); guest.key("keydown", "KeyL", "l"); n++; }
      return host.get("state") === "over" ? "stop" : 0;
    });
    await run([host, guest], net, 3);
    check(host.get("state") === "over" && guest.get("state") === "over", "online: round ends on both");
    check(host.get("JSON.stringify(score)") === guest.get("JSON.stringify(score)"), "online: scores agree " + host.get("JSON.stringify(score)"));
    check(!guest.win.document.getElementById("end").classList.contains("hidden"), "online: guest sees the end screen");
    check(host.get("document.getElementById('result').textContent") === guest.get("document.getElementById('result').textContent"), "online: same result text");
    guest.click("againBtn");
    await run([host, guest], net, 5);
    check(host.get("state") === "play" && guest.get("state") === "play" && host.get("score[0]") === 0, "online: guest rematch restarts");
    noErrors(host, guest);
  }
}
