# Design decisions

Running log of choices made where the spec left room, and of hardware facts
checked against documentation.

## Hardware, verified

- **Resolution.** The arcade board's video chip (the Bally "Astrocade"
  chipset, as used by Gorf and Wizard of Wor) draws a high-resolution picture
  of **320 x 204** at 2 bits per pixel; MAME lists the full raster including
  borders as 352 x 240. Gorf's monitor is mounted vertically, so the visible
  picture is **204 x 320 portrait**. Our framebuffer is exactly that:
  `FB_W = 204`, `FB_H = 320`.
  Sources: Wikipedia "Bally Astrocade"; 8bitworkshop Astrocade platform notes;
  pixelatedarcade.com Gorf tech specs.
- **Palette behaviour.** Each pixel picks one of 4 colour registers; there are
  two register sets split at a programmable horizontal position (so up to 8
  colours on a line). Registers index a 256-colour master palette, and games
  rewrote them on a horizontal-blank interrupt to change colours line by line.
  We model this as: a 256-colour master palette (32 hues x 8 brightness), a
  framebuffer of 32 *pens*, and a separate pen-to-colour table for every
  scanline, built each frame from data (`content/looks.ts`). We allow 32 pens
  rather than 4-8 so sprites can keep their own colours; the banding and
  per-line tricks are what give the look.
- **Sound chip.** The board's "Custom I/O" sound section has a master
  oscillator, three square-wave tone generators (A, B, C), a hardware vibrato
  (speed and depth), and a noise generator that can be mixed in or modulate
  the master oscillator, with 4-bit volumes. Source: MAME `astrocde.cpp`
  register notes; 8bitworkshop. Our chip (`audio/chip.ts`) is our own design
  in that spirit: 3 square channels with sweeps, a noise channel, global
  vibrato, 4-bit volumes and a slight bit-crush.
- **Speech.** Gorf used a Votrax SC-01: a phoneme-based speech chip with 64
  phonemes and 4 pitch levels per phoneme. Our synthesiser is our own
  formant design driven by phoneme strings with 4 pitch levels to match.

## Controls

- **Debug key.** The spec asks for both WASD movement and "D for debug". Plain
  D moves right; **Shift+D** (or the backquote key) toggles the debug overlay.
  Three fingers on the touchscreen at once also toggles it.
- **Layout.** Picture on top, integer-scaled when the integer size is at least
  86% of the best fit; otherwise nearest-neighbour at the best fractional
  scale (small phones). All remaining height below the picture is the control
  panel (at least 180 CSS px). Without a touchscreen the picture is centred
  and no controls are drawn.
