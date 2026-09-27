# Party Games

Three small two-player games, each played by two people on separate devices with no
account, backend, or signup — just a room code. Built for a "make a multiplayer game"
challenge; documented here so the approach is easy to reuse or extend.

**Live demo:** _add your Vercel URL here after deploying_

| Game | Type | What it is |
|---|---|---|
| [`drop-four/`](./drop-four) | Turn-based | Connect-four-style: drop discs, get four in a row |
| [`counter-rush/`](./counter-rush) | Co-op, timed | Two players share a kitchen counter to plate orders before time runs out |
| [`dodgeball-arena/`](./dodgeball-arena) | Real-time | Move, dodge, and throw — three hits and you're out |

Each game is a single self-contained `index.html` (styles and script inline) that shares
one vendored copy of [PeerJS](https://peerjs.com/) at [`vendor/peerjs.min.js`](./vendor/peerjs.min.js).

## How the multiplayer works

There's no server holding game state — the two players' browsers connect **directly** to
each other over WebRTC. PeerJS handles the handshake through its free public broker
(`0.peerjs.com`), which only helps two browsers find each other; once connected, all game
data flows peer-to-peer.

One player is the **host** (whoever clicks "Start a new game"), and the other is the
**guest** (whoever enters the room code):

- The room code (4 letters) *is* the host's PeerJS id, e.g. `dropfour-party-ABCD`. Each
  game uses its own prefix so the three games' rooms never collide.
- The host holds the authoritative game state in memory and is the only one who mutates
  it. The guest sends *action* messages (`{type: "move", col: 3}`, `{type: "throw", ...}`);
  the host applies them, then broadcasts the full state (`{type: "state", doc: {...}}`)
  back over the data channel. Both clients render from whatever state they last received.
- This keeps the logic simple (no conflict resolution, no partial updates) at the cost of
  the host being a single point of failure: if the host's tab closes, the match ends. See
  each game's own README for its specific message protocol.

Nothing persists. Closing a tab ends the match; there's no reconnect and no matchmaking
beyond the room code.

## Running locally

No build step, no dependencies to install. From this folder:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080` in two browser tabs (or two devices on the same
network, using your machine's LAN IP instead of `localhost`) to play against yourself
while testing.

## Deploying

Static files, so any static host works. Using [Vercel](https://vercel.com):

```
npx vercel login      # first time only — confirms via a link sent to your email
npx vercel --prod      # run from this folder; auto-detects a static site, no config needed
```

Or drag this whole folder onto [vercel.com/new](https://vercel.com/new) if you'd rather
not use a terminal.

Once deployed, `your-url.vercel.app/` shows the game picker, and each game also has its
own path, e.g. `your-url.vercel.app/drop-four/`.

## A real limitation

Peer-to-peer connections don't work on every network — some school and corporate wifi
blocks the kind of connection WebRTC needs. Test on the actual network both players will
use before relying on it for something time-sensitive (like a submission deadline).

## Project structure

```
party-games/
├── index.html              # game picker / landing page
├── vendor/
│   └── peerjs.min.js       # PeerJS, vendored so there's no CDN dependency
├── drop-four/
│   ├── index.html
│   └── README.md
├── counter-rush/
│   ├── index.html
│   └── README.md
└── dodgeball-arena/
    ├── index.html
    └── README.md
```

## License

MIT — see [LICENSE](./LICENSE).
