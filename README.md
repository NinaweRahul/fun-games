# Tiny Party Club

A rebuilt set of three two-player peer-to-peer browser games. No accounts, backend, or signup: one player creates a room and shares a four-character code with the other.

## Games

| Game | Style | Core loop |
|---|---|---|
| `drop-four/` — **Berry Four** | Turn-based strategy | Drop strawberry/blueberry pieces, connect four, first to two rounds wins |
| `counter-rush/` — **Bunny Bistro** | Cooperative timed | Each player owns half the pantry; fill the shared recipe together before time expires |
| `dodgeball-arena/` — **Puffball Toss** | Real-time reflex | Move between three lanes, throw stars, dodge, first to five hits wins |

## Design changes in this rebuild

- Each game has one obvious objective visible on-screen.
- Instructions are taught in three short steps instead of long rule paragraphs.
- Controls are intentionally small and mobile-friendly.
- Important available actions are visually highlighted.
- Matches have visible goals and progress (round score, 8-order goal, first-to-5 hits).
- Each title has a distinct playful visual identity while keeping a consistent lobby flow.
- The multiplayer architecture remains host-authoritative over PeerJS/WebRTC.

## Running locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` on two browser tabs/devices.

## Deployment

The project is static and can be hosted on Vercel, Netlify, GitHub Pages, or any other static host.

## Multiplayer note

The browsers connect peer-to-peer over WebRTC using PeerJS. Some restrictive corporate/school networks may block peer-to-peer connections.
