# Bunny Bistro

Cooperative timed game. A recipe has four ingredient slots, with two ingredients sourced from each player's pantry. A player's currently needed ingredients glow. Tapping a valid ingredient fills one matching slot immediately.

Players begin with 60 seconds. Every completed order scores one point and adds 5 seconds. The visible target is 8 orders.

The host owns the timer, recipe, score, and completed-slot state. The guest sends ingredient-prep actions.
