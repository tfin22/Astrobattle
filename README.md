# Quantum Cadet

An arcade homage to Gorf (1981), for phones in portrait. Five missions, one
shot at a time, and VORG - the Vast Orbital Robot Garrison - talking at you
the whole way. All art, sound, speech and text are original.

## Play

Open `dist/index.html` on a phone (or any browser). It's one self-contained
file: no install, no server, works offline. Left thumb moves, right thumb
fires; tap the title screen to insert a coin.

Desktop keys: arrows/WASD move, Space or Z fire, P pause, 5 coin, 1 start,
Shift+D debug overlay.

## Develop

```sh
npm install
npm run dev      # Vite on your LAN (vite --host) for phone testing
npm test         # Vitest
npm run build    # dist/index.html (single file, < 2 MB) + optional PWA files
```

Served over https, `dist/` also installs as an app (manifest, offline
service worker, icons). Opened as a lone file it simply runs.

## Where things live

- `src/game/` - the simulation: pure logic, seeded RNG, 60 Hz fixed step,
  replayable from seed + inputs. One file per mission in `missions/`.
- `src/content/` - everything that's data: sprites, missions and attack
  patterns, ranks, scoring, VORG's lines (as phonemes), sound effects,
  colour looks, fonts.
- `src/tuning.ts` - every tuning number in one place.
- `src/render/` - the 204x320 indexed framebuffer, per-scanline colour,
  and the views. `src/audio/` - the QC-1 sound chip and VORG's formant
  voice. `src/platform/` - input, storage, device APIs.
- `DECISIONS.md` - design choices and the hardware facts they're based on.

## Debug

Three fingers on the screen (or Shift+D): FPS, sprite count, hitboxes, enemy
states, invincibility, skip to any mission at any rank, make VORG say any
line, sprite viewer, and the seed.

`scripts/` has the headless checks used during development: screenshots and
contact sheets, a real-touch test at 390x844, a throttled performance test
of the busiest moment, an offline test, and a renderer for VORG's lines.
