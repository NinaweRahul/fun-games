# Tiny Party Club — Solo + Friends Edition

Six small browser games. Every game can now be started immediately in **Solo** mode or played with a friend using the existing 4-character PeerJS room-code flow.

## Modes

- **Berry Four** — solo versus Berry Bot; multiplayer best-of-three.
- **Puffball Toss** — solo versus a lane-changing/tossing Cloud Bot; multiplayer versus.
- **Lily Leap** — solo with a helper frog that reads the safe-pad pattern; multiplayer co-op.
- **Honey Flight** — solo with an AI bee companion that seeks flowers and avoids nearby hazards; multiplayer co-op.
- **Kitten Cleanup** — solo with an AI kitten that chases falling toys and sorts carried items; multiplayer co-op.
- **Penguin Delivery** — solo two-round challenge against an AI rider/saboteur; multiplayer role-swapping duel.

The solo modes reuse the same game state and rules as multiplayer rather than branching into separate implementations.

## Running locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Technical direction

This edition intentionally keeps the current no-build browser architecture so it is immediately deployable and testable. The next engine migration should happen only after the game loops are validated: Phaser + TypeScript + Vite for animation/physics/scene management, with an authoritative server such as Colyseus considered for polished real-time multiplayer.
