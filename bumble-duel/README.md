# Bumble Duel

Real-time. Two bees fly around a garden and try to land a sting on each other. Each
round opens with a short "get ready" window where nobody can be hit yet, so neither bee
gets sniped before the player even has control. One hit ends the duel.

Bumble Duel also has a **Single Player** mode against a wild bee AI, which the other
three games don't have — no second device needed to try it out.

## State shape (split-authority)

There's no single authoritative game state like the turn-based games. Each client is
authoritative only for its own bee:

```js
ship = {
  id: 1 | 2,
  color: "white" | "red",
  x, y, angle, speed,
  alive: true | false,
  controlledBy: "local" | "ai" | "remote"
}
```

The local client simulates its own bee from keyboard input (or AI logic in Single
Player) and broadcasts its position about 15 times a second. It also decides, on its
own, whether one of the *other* bee's in-flight stings has hit *it* — never whether its
own sting hit the other bee. That call belongs to whichever client actually controls the
bee being checked, so both sides can never disagree about who died.

## Message protocol

| Direction | Message | Meaning |
|---|---|---|
| host → guest | `{ type: "matched" }` | sent once the guest's connection opens; starts the round on both sides |
| either → other | `{ type: "pos", x, y, angle, thrusting }` | "here's where my bee is now," sent on an interval |
| either → other | `{ type: "sting", x, y, vx, vy, angle, owner, color }` | "I just fired," so the other client renders the same sting locally |
| either → other | `{ type: "hit" }` | "my own bee just died" — the receiver marks its *remote* bee (the sender's) as dead and wins the round |
| either → other | `{ type: "rematch" }` | requested after a round ends |

Because each client only ever declares *its own* bee dead, and tells the other side when
that happens, there's no case where both sides think they won or both think they lost.

## Single Player difficulty

The wild bee AI is deliberately imperfect, tuned to be beatable: it turns and
accelerates well below the player's max, only fires when its aim is already tight, waits
out the round's grace period before attempting to fire at all, and has noticeably wobbly
aim that only re-settles every 0.7-1.7 seconds. Relevant constants near the top of
`index.html`: `AI_TURN_FACTOR`, `AI_SPEED_FACTOR`, `AI_FIRE_COOLDOWN`, `AI_AIM_REQUIRED`,
and the jitter magnitude inside `updateAI()`. Lower `AI_TURN_FACTOR`/`AI_SPEED_FACTOR` or
raise `AI_FIRE_COOLDOWN`/jitter to make it easier; move them the other way for harder.

## Constants worth knowing

- Room codes are 4 numeric digits (`0000`-`9999`), unlike the letter-based codes the
  other games use — Bumble Duel's own `randomCode()` generates these separately.
- `ROUND_GRACE = 2.2` seconds — no sting can land on either bee until this elapses, and
  the AI won't even attempt to fire before then either.
- `STING_MAX = 3` stings per bee in the air at once; each lasts under a second
  (`STING_LIFETIME = 0.9`).
