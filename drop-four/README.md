# Berry Four

Turn-based two-player Connect-Four-inspired game. Player 1 is 🍓 and Player 2 is 🫐. Players alternate choosing a column; the berry drops to the lowest free slot. Four in a row wins the round. First player to win two rounds wins the match.

The host owns the authoritative board/match state. The guest only sends column choices and next-round requests.
