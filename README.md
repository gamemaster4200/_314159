# OMG I have a tasty algorithm

## Very Short Version

This is a one-screen Pi Day card: a glowing pie, a pulse, a little noise, and a bass line nudged around by the digits of pi.

## Longer Version

Open the page, tap once, and the whole thing wakes up. The circle starts breathing, the slices begin to shimmer, particles drift around the rim, and the sound turns the scene into a small performance instead of a static postcard.

It is meant to feel festive first and mathematical second, but the math is real. Random and Quasi change how the field organizes itself. Pi Series lets harmonic sums sharpen the rim until the shape starts to feel assembled instead of merely drawn.

## For People Who Enjoy Breaking Their Brains

There is a quiet structural game underneath the glow. Quasi mode leans on low-discrepancy placement. Pi Series uses partial sums of odd harmonics around the circle. The bass pulse walks through digits of pi, using one digit for pitch motion and the next for duration motion. It is still a toy, but it is a toy that knows exactly why it looks alive.

## How To Open / How To Play / What To Try

Open `index.html` in a browser.

Tap or click the scene once to start audio.

Try these first:

- `Mode: Pi Series`
- `Order: 7`
- `Noise Type: Band`
- `Pulse: a little above halfway`
- `Beat Length` and `Beat Pitch`: small moves are enough

Then switch between `Random`, `Quasi`, and `Pi Series` and watch how the same circle starts behaving like three different kinds of thought.

## Short Tech Note

Pure static frontend. No server. No build step. No libraries. Just `index.html`, `style.css`, `script.js`, Canvas 2D, and Web Audio API.
