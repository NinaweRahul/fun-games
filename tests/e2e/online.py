"""Real-browser check of online play: two Chromium pages connect over WebRTC through a local PeerJS server.

Setup (once):   pip install playwright && playwright install chromium
                cd tests && npm install && npm install --no-save peer
Run:            cd tests && node -e "require('peer').PeerServer({port:9000,path:'/',host:'0.0.0.0'})" &
                python3 e2e/online.py            # every game, or:  python3 e2e/online.py frog-pond
"""
import functools, http.server, json, pathlib, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
GAMES = ["light-cycle-duel", "chain-reaction", "monkey-fruit-fight", "sumo-bump", "bee-garden", "frog-pond", "cake-stack-duel"]
INIT = "window.FG_PEER={host:'127.0.0.1',port:9000,path:'/',secure:false};"   # point the page at the local server

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
handler.log_message = lambda *a, **k: None
threading.Thread(target=http.server.ThreadingHTTPServer(("127.0.0.1", 8125), handler).serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:8125/games/"

failed = 0
with sync_playwright() as p:
    browser = p.chromium.launch(args=["--disable-features=WebRtcHideLocalIpsWithMdns"])
    for game in sys.argv[1:] or GAMES:
        errors = []
        ctx = [browser.new_context(viewport={"width": 420, "height": 800}, has_touch=True, is_mobile=True) for _ in range(2)]
        for c in ctx: c.add_init_script(INIT)
        host, guest = (c.new_page() for c in ctx)
        host.on("pageerror", lambda e: errors.append("host: " + str(e)))
        guest.on("pageerror", lambda e: errors.append("guest: " + str(e)))
        host.goto(BASE + game + ".html?mode=host")
        host.wait_for_function("FG.code && FG.code.length === 5", timeout=8000)
        code = host.evaluate("FG.code")
        guest.goto(BASE + game + ".html?join=" + code)
        try:
            guest.wait_for_function("FG.connected", timeout=10000)
            host.wait_for_function("FG.connected", timeout=5000)
            connected = True
        except Exception:
            connected = False
        host.wait_for_timeout(4500)
        started = all(pg.evaluate("document.getElementById('overlay').classList.contains('hidden')") for pg in (host, guest))
        ok = connected and started and not errors
        failed += not ok
        print(("PASS " if ok else "FAIL ") + game, json.dumps({"code": code, "connected": connected, "started": started, "errors": errors}))
        for c in ctx: c.close()
    browser.close()
sys.exit(1 if failed else 0)
