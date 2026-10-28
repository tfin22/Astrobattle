import { Framebuffer } from './render/framebuffer';
import { Display } from './render/display';
import { InputManager } from './platform/input';
import { FixedLoop } from './core/loop';
import { buildLineMap } from './render/colours';
import { LOOKS } from './content/looks';
import { PEN } from './palette';

// Milestone 1 test scene: framebuffer, palette bands, input and the loop.
const canvas = document.getElementById('screen') as HTMLCanvasElement;
const display = new Display(canvas);
const input = new InputManager(canvas);
display.touch = matchMedia('(pointer: coarse)').matches;
display.resize();
input.layout = display.layout;
window.addEventListener('resize', () => {
  display.resize();
  input.layout = display.layout;
});
const fb = new Framebuffer();
let x = 102;
let y = 270;
let frame = 0;
const loop = new FixedLoop({
  step() {
    const i = input.sample();
    x += i.mx * 1.5;
    y += i.my * 1.5;
    frame++;
  },
  render() {
    fb.clear();
    for (let p = 0; p < 32; p++) fb.rect((p % 8) * 25 + 2, 30 + Math.floor(p / 8) * 20, 22, 16, p);
    fb.textCentered('QUANTUM CADET', 102, 140, PEN.HUD2);
    fb.textCentered('MILESTONE 1', 102, 156, PEN.WHITE, 'small');
    fb.rect(x - 4, y - 4, 8, 8, PEN.PLAYER);
    buildLineMap(fb.lineMap, LOOKS.attract, frame);
    display.present(fb, input, true);
  },
});
loop.start();
