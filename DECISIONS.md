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
- **Layout.** Picture on top. By default it **fills** the space
  (nearest-neighbour at a fractional scale: at phone pixel densities the odd
  pixel that is one device pixel wider can't be seen). Playtest: on a
  390x844 phone whole-number (5x) scaling left 13% of the width empty and
  made everything look small - though measured against a frame of the 1981
  game our sprites are the same size in pixels (its invaders 11-12 px on a
  16 px pitch, ours 11 on 14). Filling makes them ~15% bigger. Settings ->
  SCREEN: SHARP restores whole-number scaling (used when within 86% of the
  fit). All remaining height below the picture is the control
  panel (at least 180 CSS px). Without a touchscreen the picture is centred
  and no controls are drawn.

## The ship and the quantum shot

- **Zone.** The ship moves in 8 directions inside y 236-300 (the lowest
  ~22% of the 292-row playfield). Diagonals are not slowed down, as on 1981
  hardware. Speed 1.45 px/frame.
- **Cancel feedback.** A cancelled shot pops (a small white/yellow star at
  the point it vanished) with its own blip, distinct from the firing zap.
- **Misses.** A shot that leaves the top or is cancelled counts as a miss
  for VORG's "run of misses" taunt (5 in a row).
- **Respawn grace.** After a death the mission continues where it was, but
  the new ship blinks and is untouchable for 1.5 s, and enemy fire on
  screen is cleared at the moment of death, so a respawn can never be an
  instant second death.

## Shield Wall

- **Formation.** Our own stepped arrowhead (5 rows, 32 fighters; a sixth row
  from Commander up). The fighter is a domed robot with a visor, not an
  "invader" crab. Colour changes by screen band as the block descends.
- **Force field.** A 5-pixel-thick parabolic arch from the screen edges up
  to an apex over the centre. The ship passes through it freely (it's a
  field, not a wall), so stepping out from under it is a choice. Bombs blow
  a 2.6 px crater, your own shots a 1.3 px one, a diving fighter a 6 px one.
- **The block never lands.** It stops descending at y 196 (well above the
  player's zone) and keeps marching; losing by invasion would be unfair on
  a phone, and the pressure comes from bombs and divers instead.
- **Divers** peel off (state formation -> leaving -> attacking ->
  returning), turn cyan, aim at the field above you and explode against it;
  through a gap they reach your zone. If they miss they loop back in from
  the top to their slot.

## Sound

- **QC-1 chip** (`audio/chip.ts`): 3 square channels (adjustable duty), a
  15-bit LFSR noise channel, one global triangle vibrato, 4-bit volumes,
  ticked at 60 Hz like a game's sound driver; output summed and quantised to
  6 bits. Effects are programs for it in `content/sfx.ts` (voices with pitch
  and volume sweeps, arpeggios, melodies). All rendered at 22,050 Hz into
  buffers when audio unlocks (a few ms).
- **Laser charge** is re-rendered to each laser's exact charge length (it's
  rank-dependent), so the rising tone peaks as the beam fires.
- **Background pulse**: two alternating low thumps, at an interval that
  shrinks as enemies thin out: about 1 a second with a full wave, rising to
  at most 3.3 a second for the last enemy. (Shield Wall first beat on every
  march step, which reached ~29 a second for the last fighter; the
  playtester found that too stressful, so every mission now uses the same
  capped beat.)
- A gentle 7 kHz low-pass on the master output: a cabinet speaker, not hi-fi.
- Audio needs a user gesture on phones: the first tap unlocks it (the coin).

## VORG's voice

- **Synthesiser** (`audio/speech.ts`): Rosenberg-style glottal pulse
  (differentiated = buzzy) at a monotone 85 Hz with 4 pitch levels
  (x0.84 / 1 / 1.17 / 1.34, like the SC-01's 2-bit inflection); noise for
  aspiration and frication; 5 cascaded resonators (F1-F3 moving, F4/F5
  fixed) plus a band-pass for frication. Parameters update every 5 ms with
  short linear transitions (35% in, 25% out) - crude on purpose. Output is
  sample-held to ~11 kHz and quantised to 7 bits for the crackle.
- **Intelligibility was measured, not guessed**: every line was rendered and
  run through an offline speech recogniser (Vosk small English model).
  Tuning took word recognition from 19% to 45% (excluding the made-up word
  "VORG"): adding fixed F4/F5, smoother transitions, 20% shorter vowels, a
  lower pitch, quieter frication and damped upper formants on nasals. For a
  deliberately robotic voice that is "just about intelligible"; subtitles are
  on by default.
- **Lines**: 67 original lines across 16 triggers. `{RANK}` is spoken from
  each rank's phoneme string. High-priority triggers (mission start, death,
  promotion, game over...) wait for the current line; low-priority taunts
  (near miss, miss streak, extra life) are dropped while VORG is busy or in
  the 4 s cooldown after a line.
- **Subtitles** appear in a band under the score in play, and on the title
  cards under VORG's face, whose mouth follows the phonemes (open on vowels,
  half on most consonants, shut on M/B/P/F/V).

## Laser Attack

- 2-3 carriers (3-4 hits each) on separate lanes, each orbited by 4-6
  escorts. Escorts swoop: break sideways, dive steering gently at you, fly a
  full vertical loop above your zone (firing a dart as the loop starts),
  then climb back to their orbit. If their carrier dies they join another,
  or circle the middle.
- **Laser fairness.** A carrier stops moving for the whole charge (so the
  warning is honest); the glow grows at the emitter with a rising tone, and
  for the last 40% of the charge a dotted line marks exactly where the beam
  will fall. Charge time is 80 frames at Cadet down to 47 at Admiral and
  never below 45 (`minLaserCharge`) at any level. Carriers prefer to charge
  when you're within 40 px of their column. Only 1 (2 from Commander) may
  charge or fire at once.
- Hitting a charging carrier cancels the laser (+400) as well as damaging it.
- If you die, any charging/firing laser stands down so the respawn is fair.

## Swarm (original, replacing the arcade's Galaxian nod)

- **Shape.** A loose cloud: home offsets on a golden-angle spiral with
  jitter inside an ellipse, so there are no rows or columns. The whole cloud
  wanders on a slow Lissajous path and each member "breathes" in and out on
  its own phase.
- **Dives.** A group of 2-4 *neighbours* in the cloud breaks off together
  (there is no flagship-and-escort structure), peels out to the side, then
  weaves down a shared centre line that drifts toward you; alternate members
  are half a cycle apart so their paths cross. Half the groups split into
  pairs below the middle of the screen, peeling apart.
- **Kamikazes** (15-30% of the swarm, a different needle sprite) predict
  where you'll be (your current velocity x time to reach your height),
  re-aim a few times in the first half second, then commit to a straight
  line. A late sidestep makes them miss.
- Distinct from Galaxian on purpose: no grid formation, no flagship with
  escorts, no wrap-around single dives, all-new sprites and colours.

## Space Warp

- The vortex is painted once (three twisting arms, dithered toward the rim)
  in the six colour-cycling pens; rotating the pen colours every 3 frames
  makes the arms turn and pour without redrawing. A pulsing eye sits at the
  centre. The rising drone loops for the whole mission.
- Warplings spawn at the centre (always >= 100 px from the player's zone),
  spin fast near the middle and slower further out while their radius grows
  ever faster. Three sizes: small (r < 22, hitbox 4 px, 200 pts), medium
  (100), large (r > 56, hitbox 11 px, 150 - the risky ones). They fire darts
  once beyond r = 55, and never from below the ship.
- Escapes aren't free: any that leave the screen go back into the vortex,
  so the mission ends only when every one has been shot. From Lieutenant up
  they spiral both ways.

## Flagship

- The flagship (61x13) slides between the edges at 0.5 px/frame (x rank
  speed), bombing from its hull and launching up to 2-4 fighters that weave
  down at you and leave off the bottom.
- The hull is 15 columns x 4-7 rows (by rank) of 4x3 blocks under the body.
  A shot removes exactly one block. The reactor (11 px wide) sits in a notch
  in the body's underside behind the middle three columns; anything else
  that reaches the body just clinks off. Because the ship drifts, you must
  lead your shots to keep digging the same column.
- Hull damage is kept when you lose a ship (the mission object survives the
  death; only the player respawns).
- **The big one**: on a reactor hit everything else explodes, then three
  stages over ~4.3 s - fireballs at the reactor, chain explosions along the
  hull with the ship shaking, then a screen-filling blast of four expanding
  colour-cycled rings and 90 sparks - over the long falling boom and a long
  haptic rumble. Then the promotion card and the next loop.
- **Photosensitivity**: the screen flashes only a handful of times, softly
  (grey, dark red, dark orange, dim yellow), never strobing.

## The loop, modes and scores

- **Flow**: title card (mission name, the next rank to earn, a VORG line
  with his face; FIRE skips after 2/3 s) -> mission -> "MISSION COMPLETE" +
  bonus (500 x level) -> next card. The Flagship's reactor -> explosion ->
  "PROMOTED" card -> Shield Wall again, one rank up.
- **Extra ships**: at 10,000 then every 30,000 (not in practice or demo).
- **Free play**: when the last ship goes, CONTINUE? counts down 10 s; FIRE
  continues from the start of the current mission with the score reset to
  zero. A game that has continued is never eligible for the table; one
  that ends without continuing is, like arcade.
- **Practice**: any mission at any rank already reached (stored in
  `qc.progress`), one mission only, nothing saved.
- **High scores**: top 10 in `qc.scores` (versioned `{ v: 1, data }`), each
  with initials and the rank reached. Ties go below the existing entry.
  Initials: stick up/down cycles A-Z and . - ! * space, FIRE confirms each
  letter, left goes back; tapping above/below a letter also works. It
  auto-saves after 45 s.
- **Settings** (`qc.settings`): ships 3-5, hold to fire, stick or d-pad,
  sound, volume, subtitles, CRT, bezel, haptics, and a two-tap reset.

## Juice, display and performance

- **Display layers.** The 204x320 picture is its own small canvas; the
  browser's compositor scales it (CSS size = integer multiple in device
  pixels, `image-rendering: pixelated`). A transparent canvas above holds
  the thumb controls, bezel and debug drawings and is only redrawn when they
  change. CRT mode adds a tiny bloom canvas (screen-blended, smoothed by the
  compositor) and a static scanline + vignette layer, with rounded corners.
  Measured in headless Chromium with the CPU throttled 4x at the busiest
  moment (flagship exploding over 36 swarmers and 7 bombs at Admiral): 60
  fps without CRT, ~56 with; our own work is ~1.4 ms a frame.
- **Attract loop**: title (rainbow per-scanline logo) -> VORG's face
  speaking a line -> high scores -> a demo (the AI pilot plays each mission
  for 8 s from a fixed seed, invincible, silent) -> score advance table.
  Any tap inserts a coin. Speech can only start after the first tap on
  phones, so the attract VORG page shows his line as text until then.
- **PWA**: the build writes `manifest.webmanifest` (fullscreen, portrait),
  `sw.js` (cache-first, refreshed in the background) and 192/512 icons drawn
  from VORG's face sprite. These only matter when the game is served over
  https; `index.html` alone is the whole game.
- **Haptics**: 8 ms tick per shot, a firm triple pulse on death, a long
  rumble for the flagship. Off in settings, and silently absent on iOS.
- **Wake lock** while playing (re-acquired after the tab comes back).
- **Patterns as data**: each mission's flight-path numbers (swing sizes,
  loop turn rates, weave widths, breathing, spiral growth) live in
  `content/missions.ts` under `pattern`; speeds and rates in `tuning.ts`.

## Difficulty (after playtest round 1)

- The playtester found round 1 easy, so that tuning is now **Easy**, and
  **Normal** (the new default) and **Hard** step up from it. Difficulty
  multiplies the rank scaling in `tuning.ts` (`difficulty` table):
  Normal = enemies 12% faster, 35% more fire, 25% more dives, lasers charge
  15% quicker, warp spawns 15% sooner, one more hull row; Hard = 25% / 75% /
  50% / 28% / 28% / two more rows, and a shorter respawn grace. The laser
  minimum warning (45 frames) still holds at every level.
- Measured with the AI pilot (ships lost per full loop, 16 runs a mission):
  Cadet 3.1 / 4.8 / 5.9, Commander 10.1 / 13.5 / 17.7 (Easy / Normal / Hard).
  `scripts/difficulty-probe.ts` reruns this.
- **High scores** keep one table; each entry is tagged with its difficulty
  (EASY / HARD shown beside it, Normal unmarked). Scores saved before this
  change have no tag and count as Easy, which is what they were played on.
- **Fix found while measuring**: the Flagship's fighters steered at you all
  the way down with the same weave every time, so standing still at one spot
  was always hit at one speed and never at another. Each fighter now starts
  its weave at a random point and stops steering below y 190, so a late
  sidestep always works (as with the Swarm's kamikazes).

## Playtest round 1 changes

- **Force field (corrected to match the original).** Footage and write-ups
  of the 1981 game show the field switches *off* briefly whenever you fire,
  so your shot gets out; only enemy fire wears it away. Ours now does the
  same: firing drops the field for 16 frames (it vanishes - the flicker
  seen in footage), during which your shot passes and so do bombs and
  divers. Rapid firing keeps your cover down: that's the trade. This
  replaces "your own shots eat holes in it" from the spec.
- **The quark/quantum cancel stays.** The original's shot really does vanish
  when you fire again (its "quark laser"), and it's the spec's feature #1.
  Hold-to-fire in Settings gives a never-cancelling alternative.
- **Thinning.** As in the original, the fewer enemies left, the faster and
  angrier they get, in Shield Wall, Laser Attack, Swarm and Space Warp (not
  the Flagship): speed x(1 + 0.6 c^2) and fire rate x(1 + 1.2 c^2), where c
  is the fraction cleared, so the last one is ~1.6x faster and fires 2.2x as
  often. Combined enemy speed (rank x difficulty x thinning) is capped at
  2x base so the last enemy stays shootable at any rank.
- **Opening scroll.** Attract mode now runs a story crawl after the title
  (our own text, `content/story.ts`), in banded amber, ending on the rank
  ladder.
- **Bug found by the new tests:** a Shield Wall diver could return to a
  formation slot past the screen edge, where the block flipped direction
  every step without moving, so the last fighter could be stuck off screen.
  The march now measures the block from every surviving fighter's slot and
  only turns at the edge it's heading for.

## The name: VORF26

- At the playtester's request the game is now called **VORF26** (title
  screens, menu, scroll, marquee, page title, app name). "Quantum Cadet"
  lives on as the first rank, and VORG is still the villain. The name lives
  in `content/text.ts` (`GAME_TITLE`).
- The opening scroll now begins with the frame story: VORF26 is a hidden
  treasure, a cabinet lost for decades and rediscovered in 2026, and
  switching it on catapulted its discoverer - you - into its world. The
  original story (VORG, your orders, the rank ladder) follows, ending on
  "the only way out is through VORG". The title page adds "LOST FOR
  DECADES. FOUND IN 2026."

## Voice clean-up (playtest: "hissy", "jumps in volume")

- Measured per sound class against the average vowel: S/SH/F were +3.8 dB
  (natural speech has them ~8-12 dB *under* the vowels), voiced fricatives
  and affricates ~0 dB, T/K/P bursts spiking, and the output stage
  soft-clipped (tanh) then crushed to 7 bits - the pumping and grit heard
  as "compression".
- Now: frication at 0.4 (S/SH -8 dB), stop bursts at 55%, and the output
  stage is DC removal -> a mild leveller (~1.6:1 envelope follower, 8 ms
  attack, 90 ms release, gain limited to 0.55-1.8x) -> 4.8 kHz low-pass
  (like the old chip's output filter) -> 11 kHz sample-hold for the grain
  -> 5.2 kHz smoothing -> 8-bit quantise. No clipping anywhere.
- High-frequency hiss index (first-difference energy / energy) 0.52 -> 0.04.
  Recogniser word score 45% -> 48%. `scripts/speech-levels.ts` re-measures;
  `tests/voice-quality.test.ts` guards the balance and hiss.

## Screen shapes

- **Monitors / desktop (no touch):** the picture runs full height in the
  middle with black either side, like the 1981 cabinet's vertical monitor.
  The bezel setting tints the side bars and adds trim.
- **Touchscreens held sideways (tablets, phones in a browser):** handheld
  layout - picture full height in the middle, the stick's area is the whole
  left side, FIRE the whole right side (each at least 150 CSS px). Before
  this the controls sat underneath, which left a phone held sideways with a
  tiny picture.
- **Phones upright:** unchanged - picture on top, controls below.
- **Settings -> Orientation: Portrait / Landscape.** Portrait (the spec's
  default) or landscape is locked when the game goes fullscreen, where the
  device allows it (Android Chrome); changing it while fullscreen applies
  at once. Where locking isn't supported (iOS, or not fullscreen) the
  layout just follows how the device is held.
