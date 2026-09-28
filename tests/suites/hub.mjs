import { boot, Net, run, check, noErrors } from "../harness.mjs";

export default async function () {
  const net = new Net();
  const p = await boot("../index", "", net, "hub");
  const doc = p.win.document;
  const cards = [...doc.querySelectorAll(".card")];
  check(cards.length === 7, "hub: shows all 7 games");
  check(cards.every(c => /mode=cpu&level=normal$/.test(c.getAttribute("href"))), "hub: solo links use ?mode=cpu&level=normal");

  doc.querySelector('.chip[data-level="hard"]').click();
  check(cards.every(c => /level=hard$/.test(c.getAttribute("href"))), "hub: difficulty chip changes the links");

  doc.querySelector('.mode[data-mode="local"]').click();
  check(cards.every(c => /\?mode=local$/.test(c.getAttribute("href"))), "hub: same-screen links use ?mode=local");
  check(doc.getElementById("levels").classList.contains("hidden"), "hub: difficulty hidden outside solo");

  doc.querySelector('.mode[data-mode="online"]').click();
  check(cards.every(c => /\?mode=host$/.test(c.getAttribute("href"))), "hub: online links create a room");
  check(!doc.getElementById("join").classList.contains("hidden"), "hub: join box appears in online mode");

  const submit = code => {
    doc.getElementById("code").value = code;
    doc.getElementById("joinForm").dispatchEvent(new p.win.Event("submit", { cancelable: true, bubbles: true }));
  };
  submit("ABC");
  check(/5 letters/.test(doc.getElementById("err").textContent), "hub: short code shows a hint");
  submit("XXXXX");
  check(/doesn't look right/.test(doc.getElementById("err").textContent), "hub: unknown code shows a hint");
  submit("F7K2Q");
  await run([p], net, 1);
  check(doc.getElementById("err").textContent === "" && p.nav.length === 1, "hub: a valid code heads to the right game");

  // every link the hub can produce points at a real file
  const fs = await import("node:fs"), path = await import("node:path");
  const { ROOT } = await import("../harness.mjs");
  check(cards.every(c => fs.existsSync(path.join(ROOT, "games", c.dataset.file + ".html"))), "hub: every card points at an existing game file");

  // surprise me and mascots do not crash
  doc.querySelector(".mascots button").click();
  doc.getElementById("surprise").click();
  await run([p], net, 6);
  noErrors(p);
}
