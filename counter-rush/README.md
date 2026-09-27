# Counter Rush

Co-operative, timed. Each order needs two ingredients from Player 1's counter and two
from Player 2's — so neither player can complete an order alone. A player "prepares" an
ingredient from their own side onto a shared 4-slot pass counter; either player can then
tap a slot to plate it against the current order. Completing an order scores a point and
adds 7 seconds to the clock. The match ends when the 90-second timer runs out.

## State shape (host-authoritative)

```js
{
  status: "playing" | "over",
  players: { "1": { name }, "2": { name } },
  score: number,
  counter: [{ id, type }],           // up to 4 items on the shared pass counter
  order: { need: [4 types], have: [types already plated] },
  endsAt: timestamp                   // ms; remaining time = endsAt - Date.now()
}
```

Ingredient `type` is one of `bun`, `patty`, `tomato` (Player 1's counter) or `lettuce`,
`cheese`, `sauce` (Player 2's counter). Orders are generated as a multiset — 2 random
picks from each side — via `newOrder()`.

## Message protocol

| Direction | Message | Meaning |
|---|---|---|
| guest → host | `{ type: "join", name }` | sent once connected |
| guest → host | `{ type: "prepare", ingType }` | "put this ingredient on the counter" — host checks it belongs to the sender's side and there's a free slot |
| guest → host | `{ type: "serve", item }` | "plate this counter item" — either player can serve any item |
| guest → host | `{ type: "rematch" }` | requested after time runs out |
| host → guest | `{ type: "state", doc }` | full state, sent after every change |

The timer is **not** ticked over the network — both clients compute `endsAt - Date.now()`
locally every 250ms and only the host writes `status: "over"` once it actually hits zero,
which then propagates via the next `state` broadcast.

## Constants worth knowing

- `DURATION = 90000` (90s starting clock), `BONUS = 7000` (7s per completed order).
- The pass counter caps at 4 items; prepare buttons disable when it's full.
