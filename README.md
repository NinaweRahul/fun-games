# Fun Games

Seven tiny two-player games in one cute front page. Play the computer, share one screen, or send a friend a room code and play from two different devices. Works on phones, tablets and laptops. No accounts, no build step, no backend.

| Game | What you do |
| --- | --- |
| Light Cycle Duel | Leave a glowing trail and box your rival in |
| Chain Reaction | Add orbs, trigger chain explosions, take over the board |
| Monkey Fruit Fight | Sling bananas, coconuts and berries across the jungle |
| Sumo Bump | Shove a penguin off the shrinking ice |
| Bee Garden | Paint the flowers your color before time runs out |
| Frog Pond | Time your tongue to snag the flies |
| Cake Stack Duel | Stack the tallest, wobbliest cake first |

## Three ways to play

| Mode | How it works |
| --- | --- |
| Solo (vs computer) | Pick Easy, Normal or Hard on the front page. You are player 1. |
| Same screen | Two people share one device. Every game shows both players' controls. |
| Online | One player picks a game and taps to create a room, then shares the 5-letter room code or the invite link. The other player types the code on the front page (or opens the link). |

Room codes start with a letter that identifies the game (`L` Light Cycle, `C` Chain Reaction, `M` Monkey, `S` Sumo, `B` Bee, `F` Frog, `K` Cake), so the front page can send a friend to the right game from the code alone.

## Run it

Any static file server works. From this folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works for solo and same-screen play. Online play needs the page to be served over `http://localhost` or `https://`.

## Deploy

It is a plain static site, so there is nothing to build.

- **Vercel**: import the repo, choose the "Other" framework preset, leave the build command empty and the output directory as the repo root.
- **GitHub Pages**: Settings, Pages, deploy from the `main` branch, root folder.

Use `https` for anything you share. Browsers only allow clipboard copy and the share sheet on secure pages.

## How online play works

- Players connect directly to each other with WebRTC, using [PeerJS](https://peerjs.com) (vendored in `vendor/`). The free public PeerJS server only introduces the two devices; game data does not pass through it.
- The host is player 1 and runs the game. The guest is player 2. Turn-based games (Chain Reaction, Monkey Fruit Fight) send just the moves and both screens play them out identically. Real-time games (Sumo Bump, Bee Garden, Frog Pond) stream the host's game state to the guest about 25 to 30 times a second. Light Cycle Duel streams each move, and Cake Stack Duel sends each drop.
- A small badge in the corner shows the connection delay in milliseconds.
- Connections use free public STUN servers. Some strict networks (certain schools, offices and mobile carriers) block direct connections. If a friend cannot connect, add a TURN relay in `shared/config.js`. The same file lets you point at your own PeerJS server.

## Controls

| Game | Keyboard | Touch |
| --- | --- | --- |
| Light Cycle Duel | P1 arrow keys, P2 `A` `D` | Joystick |
| Chain Reaction | Click or tap a cell | Tap |
| Monkey Fruit Fight | Drag back from anywhere and release | Drag |
| Sumo Bump | P1 `WASD` + `Space`, P2 arrows + `Enter` | Joystick + Dash |
| Bee Garden | P1 `WASD`, P2 arrows | Joystick |
| Frog Pond | P1 `A`, P2 `L` | Tongue button |
| Cake Stack Duel | P1 `A`, P2 `L` | Drop button or tap the screen |

In solo and online play you always get one set of controls. Either key set works, and `Space` or `Enter` also fire and drop.

## URL parameters

Every game page accepts these, so you can link straight to a mode:

- `?mode=cpu&level=easy|normal|hard`
- `?mode=local`
- `?mode=host` creates a room
- `?join=CODE` joins a room

## Project layout

```
index.html          front page
games/              one self-contained HTML file per game
shared/fg.js        modes, difficulty, room codes and the peer-to-peer link
shared/fg.css       styles for the mode picker and lobby
shared/config.js    optional TURN / signaling server settings
vendor/             PeerJS 1.5.4 (MIT)
tests/              headless and real-browser tests
```

### Adding a game

Load `../shared/config.js` and `../shared/fg.js`, then call `FG.setup({ start, stop, onMessage })`. Use `FG.mine(i)`, `FG.ai(i)`, `FG.pick(easy, normal, hard)` and `FG.send(msg)` to handle who controls each player, computer difficulty and online messages. The existing games are the best reference. Then add a card to `GAMES` in `index.html` and a letter to `FILES` in `shared/fg.js`.

## Tests

```bash
cd tests
npm install
npm test            # every game in solo, same-screen and simulated online play
npm test frog-pond  # one game
```

The suites run each game headlessly with virtual time, including two pages talking through an in-memory stand-in for PeerJS. `tests/e2e/online.py` is an optional check that opens two real Chromium pages and connects them over WebRTC (setup steps are at the top of that file).

## License

PeerJS is MIT licensed (`vendor/PEERJS-LICENSE`). Add your own license for the rest of the code.
