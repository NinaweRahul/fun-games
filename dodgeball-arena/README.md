# Ricochet Arena

Real-time. Move with the on-screen d-pad (or arrow keys / WASD) and throw in whichever
direction you last moved (Space or the Throw button). Balls bounce off the arena walls
and disappear after ~4 seconds or 6 bounces. Getting hit costs a heart; lose all three
and you lose the round. A green diamond spawns periodically and grants a one-hit shield
to whoever picks it up.

This is the one game where naive "send every position update through the host" would add
visible lag, so movement and game state are split into two separate channels.

## Split authority model

- **Movement is not authoritative.** Each player simulates their *own* avatar locally at
  60fps and broadcasts their position ~15 times/second (`{ type: "pos", x, y }`) directly
  to the other peer. There's no validation — this is a friendly game, not a competitive
  one, so trusting the client's own position keeps movement completely lag-free.
- **Everything else is host-authoritative**, same pattern as the other two games: balls,
  power-ups, hearts, and win/loss all live in the host's `game` object. The host runs a
  20Hz physics tick (`hostTick`) that moves balls, checks collisions against both
  players' latest known positions, spawns power-ups, and checks for a win — then
  broadcasts the whole `game` object every tick.
- **Throws go through the host.** A guest's throw is sent as `{ type: "throw", x, y, dx,
  dy }`; the host spawns the actual ball server-side (so both players see the same ball,
  not two different simulations of it).

## State shape (host-authoritative `game` object)

```js
{
  status: "playing" | "over",
  hp: { 1: 0-3, 2: 0-3 },
  shield: { 1: bool, 2: bool },
  balls: [{ id, owner, x, y, vx, vy, bounces, bornAt }],
  powerup: { x, y } | null,
  nextPowerupAt: timestamp,
  winner: 0 | 1 | 2,
  pos: { 1: {x,y}, 2: {x,y} }   // mirrors the "pos" messages, used by hostTick for collisions
}
```

Arena coordinates are logical units, `0-100` × `0-60` (a fixed 5:3 space), not pixels —
rendering just maps them to `%` so the whole thing scales to any screen size.

## Message protocol

| Direction | Message | Rate |
|---|---|---|
| both ways | `{ type: "pos", seat, x, y }` | ~15/s, continuous while playing |
| guest → host | `{ type: "join", name }` | once, on connect |
| guest → host | `{ type: "throw", x, y, dx, dy }` | on each throw (client-side 450ms cooldown) |
| guest → host | `{ type: "rematch" }` | after a round ends |
| host → guest | `{ type: "matched", name }` | once, right after the guest joins |
| host → guest | `{ type: "state", game }` | ~20/s, the host's physics tick |

## Constants worth knowing

- `PLAYER_SPEED = 48` units/s, `BALL_SPEED = 92` units/s — tune these together if you
  change the arena size, since they're in the same logical-unit space as `W`/`H`.
- `START_HP = 3`, `THROW_COOLDOWN = 450`ms, `POWERUP_INTERVAL = 6000`ms.
