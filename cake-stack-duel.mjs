import { boot, Net, run, check, noErrors } from "../harness.mjs";
const G = "cake-stack-duel";
const off = (p, i) => p.get(`Math.abs(players[${i}].cx - players[${i}].layers[players[${i}].layers.length-1].cx)`);
const towers = p => p.get("JSON.stringify(players.map(q=>q.layers.map(l=>[Math.round(l.cx*10),Math.round(l.w*10)])))");

export default async function () {
  // vs computer: an idle human never drops, so the computer should finish its tower (or topple on easy)
  const wins = {};
  for (const level of ["easy", "normal", "hard"]) {
    wins[level] = 0;
    for (let g = 0; g < 3; g++) {
      const net = new Net();
      const p = await boot(G, "mode=cpu&level=" + level, net);
      p.click("startBtn");
      await run([p], net, 120, () => (p.get("state") === "over" ? "stop" : 0));
      if (p.get("over.winner") === 1) wins[level]++;
      if (g === 0) { check(p.get("state") === "over", `cpu ${level}: game ends`); noErrors(p); }
    }
  }
  console.log("  info computer wins by level:", JSON.stringify(wins));
  check(wins.normal >= 2 && wins.hard >= 2, `cpu normal/hard stack all 15 layers (${wins.normal}/3, ${wins.hard}/3)`);

  // solo: Space drops your cake, the computer's tray ignores your keys
  {
    const net = new Net();
    const p = await boot(G, "mode=cpu&level=normal", net);
    p.click("startBtn");
    await run([p], net, 3);
    p.key("keydown", "Space", " ");
    check(p.get("players[0].layers.length") === 2 || p.get("players[0].done"), "cpu: Space drops your cake");
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
    check(p.get("players[0].layers.length") === 2 && p.get("players[1].layers.length") === 2, "local: A and L each drop their own cake");
    noErrors(p);
  }

  // online: both bakers play well, both screens must agree on every layer
  {
    const net = new Net(60);
    const host = await boot(G, "mode=host", net, "host");
    await run([host], net, 0.2);
    const guest = await boot(G, "join=" + host.get("FG.code"), net, "guest");
    await run([host, guest], net, 4);
    check(host.get("state") === "play" && guest.get("state") === "play", "online: both in play");
    await run([host, guest], net, 200, () => {
      if (host.get("state") === "over") return "stop";
      if (host.get("state") === "play" && off(host, 0) < 9 && !host.get("players[0].done")) host.key("keydown", "KeyA", "a");
      if (guest.get("state") === "play" && off(guest, 1) < 9 && !guest.get("players[1].done")) guest.key("keydown", "KeyL", "l");
      return 0;
    });
    await run([host, guest], net, 4);
    check(host.get("state") === "over" && guest.get("state") === "over", "online: game ends on both");
    check(towers(host) === towers(guest), "online: identical towers on both screens");
    check(host.get("over.winner") === guest.get("over.winner"), "online: same winner (" + host.get("over.winner") + ")");
    check(host.get("JSON.stringify(wins)") === guest.get("JSON.stringify(wins)"), "online: same tally");
    check(!guest.win.document.getElementById("end").classList.contains("hidden"), "online: guest sees the end screen");
    guest.click("againBtn");
    await run([host, guest], net, 5);
    check(host.get("state") === "play" && guest.get("state") === "play", "online: guest rematch restarts");
    noErrors(host, guest);
  }
}
