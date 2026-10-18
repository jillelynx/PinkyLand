// Pinky's Storybook — Chapter 1: "A Pillow Is Imagined"
// Pinky wakes up on a sheet of drawing paper, crosses a crayon world, finds
// scraps of a drawing of the girl who imagined him, and reaches the edge of the paper.
// Coordinates: x to the right, y DOWN (screen style). The ground is at y = 440.

const G = 440;

export const LEVEL1 = {
  id: 1,
  title: 'Chapter 1',
  subtitle: 'A Pillow Is Imagined',
  width: 7300,
  start: { x: 200, y: G },
  // solid ground strips (each is solid from y down to the bottom of the world)
  ground: [
    { x0: -200, x1: 1000, y: G },
    { x0: 1110, x1: 2600, y: G },
    { x0: 3380, x1: 6250, y: G },
    { x0: 6420, x1: 7230, y: G },
  ],
  // solid blocks you can stand on (kind decides how they are drawn)
  blocks: [
    { x: 520, y: 405, w: 140, h: 35, kind: 'mound' },
    { x: 1280, y: 375, w: 110, h: 65, kind: 'book', color: '#7ec8ff' },
    { x: 1460, y: 320, w: 110, h: 26, kind: 'book', color: '#ffd34d' },
    { x: 1800, y: 372, w: 540, h: 68, kind: 'crayon', color: '#e8504f' },
    { x: 5450, y: 395, w: 90, h: 45, kind: 'button', color: '#9fd8ff' },
    { x: 5650, y: 380, w: 160, h: 60, kind: 'book', color: '#c9a8ff' },
    { x: 5690, y: 322, w: 100, h: 58, kind: 'book', color: '#ff9ec4' },
  ],
  // one-way platforms: you can jump up through them from below
  oneways: [
    { x: 3075, y: 330, w: 80, kind: 'lily' },
    { x: 4140, y: 250, w: 140, kind: 'scribble' },
    { x: 4330, y: 205, w: 130, kind: 'scribble' },
    { x: 4815, y: 375, w: 115, kind: 'branch' },
    { x: 4950, y: 305, w: 115, kind: 'branch' },
    { x: 4815, y: 235, w: 115, kind: 'branch' },
    { x: 4950, y: 165, w: 120, kind: 'branch' },
    { x: 4860, y: 95, w: 95, kind: 'branch' },
    { x: 6312, y: 405, w: 56, kind: 'lily' },
  ],
  // moving platforms (also one-way) — x/y move by dx/dy back and forth over `period` seconds
  movers: [
    { x: 2620, y: 418, w: 120, dx: 260, dy: 0, period: 6, phase: 0, kind: 'boat' },
    { x: 2980, y: 418, w: 120, dx: 260, dy: 0, period: 6, phase: Math.PI, kind: 'boat' },
    { x: 5130, y: 380, w: 100, dx: 0, dy: -210, period: 5, phase: 0, kind: 'cloud' },
  ],
  // bouncy marshmallow clouds
  bouncy: [
    { x: 4195, y: 416, w: 96, power: 1060 },
  ],
  // crayon rivers (falling in sends you back gently)
  water: [
    { x0: 2600, x1: 3380, y: 452 },
    { x0: 6250, x1: 6420, y: 452 },
    { x0: 1000, x1: 1110, y: 470, dry: true },
  ],
  // prickly scribble bushes
  hazards: [
    { x: 3985, y: 418, w: 70, h: 22 },
    { x: 5905, y: 418, w: 80, h: 22 },
  ],
  // fluffy dust bunnies (bounce on them!)
  bunnies: [
    { x: 3620, range: 120 },
    { x: 3860, range: 90 },
    { x: 6060, range: 120 },
  ],
  stars: [
    [330, 400], [380, 390], [430, 400], [590, 360], [760, 400], [820, 400], [880, 400],
    [1055, 360], [1335, 330], [1515, 270], [1580, 300], [1880, 330], [1960, 320], [2040, 310], [2120, 320], [2200, 330],
    [2680, 370], [2760, 360], [3000, 370], [3080, 360], [3260, 370], [3115, 290],
    [3500, 400], [3750, 400], [4245, 330], [4245, 270], [4190, 215], [4250, 210], [4370, 165], [4420, 165],
    [4870, 335], [5005, 265], [4870, 195], [5010, 125], [5180, 150], [5240, 140], [5300, 150],
    [5495, 355], [5740, 285], [6000, 400], [6340, 360], [6560, 400], [6640, 390], [6720, 400],
  ],
  // scraps of a drawing (story discoveries)
  scraps: [
    { id: 'hair', x: 3115, y: 296 },
    { id: 'hoodie', x: 4572, y: 410, hidden: true },
    { id: 'smile', x: 4907, y: 58 },
  ],
  checkpoints: [{ x: 2450 }, { x: 4720 }, { x: 6520 }],
  goal: { x: 7050 },
  paperEdge: 7200,
  // a big leafy bush in front that hides a secret
  secretBush: { x: 4495, w: 160, y: G },
  // little doodled signs that teach the controls
  signs: [
    { x: 330, kind: 'arrows' },
    { x: 880, kind: 'jump' },
    { x: 1700, kind: 'run' },
    { x: 3480, kind: 'stomp' },
    { x: 4120, kind: 'bounce' },
  ],
  // moments where Pinky wonders about something
  thoughts: [
    { x: 1760, icon: 'crayon', expr: 'wonder', time: 2.6 },
    { x: 3440, icon: '?', expr: 'sad', time: 2.6 },
    { x: 4905, y: 120, icon: 'house', expr: 'wonder', time: 3.2 },
    { x: 6480, icon: 'heart', expr: 'wonder', time: 3 },
  ],
  // short storybook lines that appear at the bottom of the screen
  captions: [
    { x: 3420, text: 'Everything was big and new. But something felt missing, too.' },
    { x: 4880, y: 140, text: 'From up high, Pinky saw a light far away…' },
    { x: 6440, text: 'The paper was ending. And beyond it, a window glowed.' },
  ],
};
