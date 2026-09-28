import { boot, Net, run, check, noErrors } from "../harness.mjs";
const G = "light-cycle-duel";

export default async function () {
  // vs computer: an idle human hits the wall, the computer should still be alive at the end
  for (const level of ["easy", "normal", "hard"]) {
    const net = new Net();
    const p = await boot(G, "mode=cpu&level=" + level, net);
    p.click("startBtn");
    await run([p], net, 40, () => (p.get("state") === "over" ? "stop" : 0));
    const over = p.get("state") === "over";
    check(over, `cpu ${level}: round ends`);
    if (level !== "easy") check(p.get("score[1]") === 1, `cpu ${level}: computer beats an idle player`);
    check(p.get("document.body.className").includes("fg-solo"), `cpu ${level}: solo controls shown`);
    noErrors(p);
  }

  // computer vs computer style stress: the human steers randomly, the computer must survive long enough to be interesting
  {
    const net = new Net();
    const p = await boot(G, "mode=cpu&level=hard", net);
    p.click("startBtn");
    let turns = 0;
    await run([p], net, 60, i => {
      if (i % 20 === 0) { const k = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"][Math.floor(Math.random() * 4)]; p.key("keydown", k, k); turns++; }
      return p.get("state") === "over" ? "stop" : 0;
    });
    check(p.get("state") === "over", "cpu hard: random human ends the round");
    noErrors(p);
  }

  // same screen
  {
    const net = new Net();
    const p = await boot(G, "mode=local", net);
    p.click("startBtn");
    await run([p], net, 3, () => 0);
    p.key("keydown", "ArrowUp", "ArrowUp");
    p.key("keydown", "KeyS", "s");
    await run([p], net, 1, () => 0);
    check(p.get("bikes[0].d") === 0, "local: Up arrow sends cyan north");
    check(p.get("bikes[1].d") === 2, "local: S sends orange south");
    p.key("keydown", "ArrowDown", "ArrowDown");   // straight back the way it came: ignored
    await run([p], net, 0.5, () => 0);
    check(p.get("bikes[0].d") === 0, "local: cyan cannot reverse into itself");
    p.key("keydown", "ArrowRight", "ArrowRight");
    await run([p], net, 0.5, () => 0);
    check(p.get("bikes[0].d") === 1, "local: Right arrow sends cyan east");
    // two quick presses inside one game tick both count: Up then Left from heading east -> north, then west
    p.key("keydown", "ArrowUp", "ArrowUp");
    p.key("keydown", "ArrowLeft", "ArrowLeft");
    await run([p], net, 0.6, () => 0);
    check(p.get("bikes[0].d") === 3, "local: Up then Left pressed together gives north then west");
    noErrors(p);
  }

  // online: host + guest
  {
    const net = new Net(40);
    const host = await boot(G, "mode=host", net, "host");
    await run([host], net, 0.2);
    const code = host.get("FG.code");
    check(/^L[A-Z2-9]{4}$/.test(code), "host: got a room code (" + code + ")");
    const guest = await boot(G, "join=" + code, net, "guest");
    await run([host, guest], net, 3);
    check(host.get("FG.connected") && guest.get("FG.connected"), "both sides connected");
    check(host.get("state") !== "menu" && guest.get("state") !== "menu", "game started on both");
    await run([host, guest], net, 8, () => (host.get("state") === "play" ? "stop" : 0));
    await run([host, guest], net, 1);
    const hb = JSON.parse(host.get("JSON.stringify(bikes.map(b=>[b.x,b.y,b.d]))"));
    const gb = JSON.parse(guest.get("JSON.stringify(bikes.map(b=>[b.x,b.y,b.d]))"));
    const near = hb.every((b, i) => Math.abs(b[0] - gb[i][0]) + Math.abs(b[1] - gb[i][1]) <= 3);
    check(near, "guest bikes track the host " + JSON.stringify(hb) + " vs " + JSON.stringify(gb));
    // guest steers orange (moving west) south
    guest.key("keydown", "ArrowDown", "ArrowDown");
    await run([host, guest], net, 1);
    check(host.get("bikes[1].d") === 2, "guest steering reaches the host");
    check(guest.get("bikes[1].d") === 2, "guest sees its own turn");
    await run([host, guest], net, 60, () => (host.get("state") === "over" ? "stop" : 0));
    await run([host, guest], net, 2);
    check(host.get("state") === "over" && guest.get("state") === "over", "round ends on both sides");
    check(host.get("score[0]") === guest.get("score[0]") && host.get("score[1]") === guest.get("score[1]"), "scores agree");
    // rematch requested by the guest
    guest.click("againBtn");
    await run([host, guest], net, 4);
    check(host.get("state") !== "over" && guest.get("state") !== "over", "guest can request a rematch");
    noErrors(host, guest);
  }

  // bad code
  {
    const net = new Net();
    const g = await boot(G, "join=LZZZZ", net, "lonely");
    await run([g], net, 1);
    check(/No room found/.test(g.get('document.getElementById("fgStatus").textContent')), "join with a wrong code shows a clear message");
    noErrors(g);
  }
}
