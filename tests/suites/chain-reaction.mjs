import { boot, Net, run, check, noErrors } from "../harness.mjs";
const G = "chain-reaction";

// tap a board cell the way a finger would
function tap(p, r, c) {
  const w = p.get("cv.getBoundingClientRect().width"), h = p.get("cv.getBoundingClientRect().height");
  p.pointer("#cv", "pointerdown", (c * 60 + 30) * w / 360, (r * 60 + 30) * h / 540);
}
function legal(p, who) {
  const out = [];
  const cells = JSON.parse(p.get("JSON.stringify(cells)"));
  cells.forEach((row, r) => row.forEach((x, c) => { if (x.p === -1 || x.p === who) out.push([r, c]); }));
  return out;
}
const board = p => p.get("JSON.stringify(cells)");

export default async function () {
  // vs computer: a random human against each level
  const wins = {};
  for (const level of ["easy", "normal", "hard"]) {
    wins[level] = 0;
    for (let g = 0; g < 3; g++) {
      const net = new Net();
      const p = await boot(G, "mode=cpu&level=" + level, net);
      p.click("startBtn");
      await run([p], net, 400, () => {
        if (p.get("state") !== "play") return "stop";
        if (!p.get("busy") && p.get("turn") === 0) { const l = legal(p, 0); const m = l[Math.floor(Math.random() * l.length)]; tap(p, m[0], m[1]); }
        return 0;
      });
      if (p.get("state") === "over" && p.get("orbs()[1]") > 0) wins[level]++;
      if (g === 0) { check(p.get("state") === "over", `cpu ${level}: game ends`); noErrors(p); }
    }
  }
  check(wins.hard >= 2, `cpu hard beats a random player (${wins.hard}/3)`);
  check(wins.normal >= 2, `cpu normal beats a random player (${wins.normal}/3)`);
  console.log("  info wins by level:", JSON.stringify(wins));

  // the human cannot tap on the computer's turn
  {
    const net = new Net();
    const p = await boot(G, "mode=cpu&level=normal", net);
    p.click("startBtn");
    tap(p, 4, 3);
    await run([p], net, 0.05);
    const before = board(p);
    tap(p, 0, 0);   // computer's turn (or animating)
    check(board(p) === before, "cpu: taps are ignored while it is the computer's turn");
    noErrors(p);
  }

  // same screen
  {
    const net = new Net();
    const p = await boot(G, "mode=local", net);
    p.click("startBtn");
    tap(p, 4, 3); await run([p], net, 1);
    tap(p, 0, 0); await run([p], net, 1);
    check(p.get("cells[4][3].p") === 0 && p.get("cells[0][0].p") === 1, "local: players alternate");
    noErrors(p);
  }

  // online: two pages, lockstep moves
  {
    const net = new Net(60);
    const host = await boot(G, "mode=host", net, "host");
    await run([host], net, 0.2);
    const code = host.get("FG.code");
    const guest = await boot(G, "join=" + code, net, "guest");
    await run([host, guest], net, 3);
    check(host.get("state") === "play" && guest.get("state") === "play", "online: game started on both");
    // guest tries to move on the host's turn
    tap(guest, 8, 5); await run([host, guest], net, 1);
    check(host.get("cells[8][5].n") === 0 && guest.get("cells[8][5].n") === 0, "online: guest cannot move on host's turn");
    let moves = 0;
    await run([host, guest], net, 600, () => {
      if (host.get("state") !== "play") return "stop";
      if (host.get("busy") || guest.get("busy")) return 0;
      const t = host.get("turn");
      if (t !== guest.get("turn")) return 0;
      const mover = t === 0 ? host : guest;
      const l = legal(mover, t); const m = l[Math.floor(Math.random() * l.length)];
      tap(mover, m[0], m[1]); moves++;
      return 0;
    });
    await run([host, guest], net, 4);
    check(host.get("state") === "over" && guest.get("state") === "over", `online: game over on both after ${moves} moves`);
    check(board(host) === board(guest), "online: both boards identical");
    check(host.get("score[0]") === guest.get("score[0]") && host.get("score[1]") === guest.get("score[1]"), "online: scores agree");
    host.click("againBtn");
    await run([host, guest], net, 2);
    check(host.get("state") === "play" && guest.get("state") === "play" && host.get("moves[0]") === 0, "online: host rematch restarts both");
    noErrors(host, guest);
  }
}
