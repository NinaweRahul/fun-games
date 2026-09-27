# Drop Four

Turn-based. Two players alternate dropping discs into a 7-wide, 6-tall grid; a disc falls
to the lowest open spot in its column. First to line up four of their own discs —
horizontal, vertical, or diagonal — wins. A full grid with no line of four is a draw.

## State shape (host-authoritative)

```js
{
  board: [42 ints],      // row-major, 0 = empty, 1 or 2 = that player's disc
  turn: 1 | 2,
  status: "playing" | "won" | "draw",
  winner: 0 | 1 | 2,
  winningCells: [indices],
  lastMove: index,        // for the drop-in animation
  players: { "1": { name }, "2": { name } }
}
```

## Message protocol

| Direction | Message | Meaning |
|---|---|---|
| guest → host | `{ type: "join", name }` | sent once the data channel opens, before any state exists |
| guest → host | `{ type: "move", col }` | "I want to drop a disc in this column" — host validates it's actually the guest's turn |
| guest → host | `{ type: "rematch" }` | requested after a game ends |
| host → guest | `{ type: "state", doc }` | full state, sent after every change |

The host never trusts a `move` unless `doc.turn === 2` (the guest's seat) when it
arrives, so a stale or duplicate message can't jump the turn order.

## Constants worth knowing

- `ROWS = 6`, `COLS = 7` — standard connect-four dimensions.
- Room codes are 4 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0/O/1/I` to
  avoid misreads when read aloud or typed on mobile).
