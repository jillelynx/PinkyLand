// Pinky's Storybook — Chapter 2: "The Big House"
// Pinky follows the glowing window to a garden, climbs in through the open
// kitchen window, crosses a giant house (counters, sofa, bookshelf, toys, stairs)
// and finds three torn pieces of a door sign that spell the girl's name.
// Coordinates: x to the right, y DOWN (screen style). The ground is at y = 440.

const G = 440;
const UP = 260; // the upstairs floor

export const LEVEL2 = {
  id: 2,
  title: 'Chapter 2',
  subtitle: 'The Big House',
  theme: 'house',
  intro: 'arrive',
  openCaption: 'Pinky followed the glowing window all night long… until he reached a garden full of flowers.',
  width: 8000,
  start: { x: 160, y: G },
  indoorX: 3120,
  window: { x0: 2960, x1: 3120, y: 200 },
  // morning light: soft peach sunrise to a bright blue day
  sky: { top: ['#8fb0ff', '#5fa8f0'], bottom: ['#ffd2b8', '#e2f3ff'], stars: 0 },
  scrapStyle: 'name',
  scrapLines: {
    1: 'A torn piece of a door sign! It says “JA”… Pinky turned it over and over.',
    2: 'Another piece: “CIN”. These letters must make a word. A name?',
    3: 'The last piece: “TA”. Pinky’s heart went thump-thump-thump.',
  },
  ending: {
    x: 7880, y: UP, pan: false,
    first: 'At the top of the stairs was a door with a sign on it. Pinky held up his pieces…',
    reveal: { all: 'J – A – C – I – N – T – A. Jacinta! Her name was JACINTA!', some: (n) => `The pieces he found filled in part of the name… (${n} of 3). Maybe there’s more to discover.` },
    last: 'But Jacinta’s room was empty. Through the window, Pinky could see children playing in the park…',
    next: 'Chapter 3: The Park — coming soon!',
  },
  ground: [
    { x0: -200, x1: 900, y: G },
    { x0: 1060, x1: 1900, y: G },
    { x0: 2060, x1: 3100, y: G },
    { x0: 3100, x1: 4720, y: G, kind: 'tile' },
    { x0: 4720, x1: 8200, y: G, kind: 'floor' },
  ],
  blocks: [
    // the garden
    { x: 380, y: 370, w: 90, h: 70, kind: 'pot', color: '#ff8fb8' },
    { x: 600, y: 330, w: 110, h: 110, kind: 'pot', color: '#ffe27a' },
    { x: 1200, y: 380, w: 120, h: 60, kind: 'crate' },
    { x: 1340, y: 320, w: 120, h: 120, kind: 'crate' },
    { x: 1480, y: 260, w: 120, h: 180, kind: 'crate' },
    // the brick wall under the open kitchen window
    { x: 2960, y: 200, w: 160, h: 240, kind: 'wall' },
    // the kitchen
    { x: 3120, y: 240, w: 760, h: 200, kind: 'counter' },
    { x: 3330, y: 172, w: 60, h: 68, kind: 'jar', color: '#9fd8ff' },
    { x: 4040, y: 240, w: 560, h: 200, kind: 'counter' },
    { x: 4300, y: 172, w: 60, h: 68, kind: 'jar', color: '#ffb3cf' },
    { x: 3890, y: 330, w: 70, h: 110, kind: 'stool', color: '#ffe08a' },
    { x: 4640, y: 330, w: 80, h: 110, kind: 'stool', color: '#9fd8ff' },
    // the living room
    { x: 4900, y: 330, w: 420, h: 110, kind: 'sofa' },
    { x: 5780, y: 380, w: 60, h: 60, kind: 'toyblock' },
    { x: 5860, y: 320, w: 60, h: 120, kind: 'toyblock' },
    { x: 5940, y: 260, w: 60, h: 180, kind: 'toyblock' },
    // stairs up to the bedroom
    { x: 6380, y: 410, w: 70, h: 30, kind: 'stair' },
    { x: 6450, y: 380, w: 70, h: 60, kind: 'stair' },
    { x: 6520, y: 350, w: 70, h: 90, kind: 'stair' },
    { x: 6590, y: 320, w: 70, h: 120, kind: 'stair' },
    { x: 6660, y: 290, w: 70, h: 150, kind: 'stair' },
    { x: 6730, y: 260, w: 70, h: 180, kind: 'stair' },
    { x: 6800, y: UP, w: 1400, h: 180, kind: 'floor' },
    { x: 7480, y: 200, w: 260, h: 60, kind: 'bed' },
  ],
  oneways: [
    { x: 1640, y: 300, w: 200, kind: 'rail' },
    { x: 2150, y: 360, w: 120, kind: 'leaf' },
    { x: 2300, y: 290, w: 120, kind: 'leaf' },
    { x: 2450, y: 220, w: 130, kind: 'flower' },
    { x: 3470, y: 110, w: 230, kind: 'shelf' },
    { x: 3950, y: 160, w: 120, kind: 'shelf' },
    { x: 5345, y: 250, w: 150, kind: 'shelf' },
    { x: 5525, y: 170, w: 150, kind: 'shelf' },
    { x: 5345, y: 90, w: 150, kind: 'shelf' },
    { x: 7240, y: 80, w: 150, kind: 'shelf' },
  ],
  movers: [
    { x: 1920, y: 430, w: 110, dx: 20, dy: 0, period: 3, phase: 0, kind: 'leafboat' },
    { x: 7130, y: 240, w: 90, dx: 0, dy: -150, period: 5, phase: 0, kind: 'balloon' },
  ],
  bouncy: [
    { x: 2780, y: 416, w: 110, power: 1150, kind: 'mushroom' },
    { x: 3560, y: 200, w: 70, power: 1000, kind: 'toaster' },
    { x: 5200, y: 330, w: 110, power: 1100, kind: 'cushion' },
  ],
  water: [
    { x0: 900, x1: 1060, y: 452 },
    { x0: 1900, x1: 2060, y: 452 },
  ],
  hazards: [
    { x: 2190, y: 418, w: 60, h: 22, kind: 'thistle' },
    { x: 6030, y: 418, w: 90, h: 22, kind: 'toybricks' },
    { x: 7030, y: UP - 22, w: 60, h: 22, kind: 'toybricks' },
  ],
  bunnies: [
    { x: 1130, range: 50, kind: 'snail' },
    { x: 2560, range: 80, kind: 'snail' },
    { x: 4790, range: 60 },
  ],
  stars: [
    [260, 400], [310, 400], [425, 330], [655, 290], [655, 240], [760, 400], [980, 360],
    [1260, 340], [1400, 280], [1540, 220], [1690, 260], [1760, 250], [1830, 260], [1980, 360],
    [2210, 320], [2360, 250], [2515, 140], [2620, 400], [2835, 300], [2835, 230],
    [3200, 200], [3360, 130], [3520, 70], [3600, 70], [3680, 70], [3925, 290], [4010, 120],
    [4150, 200], [4450, 200], [4680, 290],
    [4960, 290], [5060, 290], [5255, 200], [5420, 210], [5600, 130], [5810, 340], [5890, 280], [5970, 220],
    [6170, 400], [6485, 340], [6625, 280], [6765, 220], [6950, 220], [7175, 150], [7600, 160], [7700, 160],
  ],
  scraps: [
    { id: 'JA', x: 2515, y: 182 },
    { id: 'CIN', x: 5420, y: 52 },
    { id: 'TA', x: 7315, y: 42 },
  ],
  checkpoints: [{ x: 2120 }, { x: 4720 }, { x: 6880, y: UP }],
  goal: { x: 7820, y: UP },
  paperEdge: 7950,
  secretBush: { x: 2600, w: 120, y: G },
  signs: [
    { x: 250, kind: 'double' },
    { x: 2700, kind: 'bounce', y: G },
  ],
  thoughts: [
    { x: 1000, icon: 'house', expr: 'wonder', time: 2.6 },
    { x: 3300, y: 260, icon: '?', expr: 'wonder', time: 2.6 },
    { x: 5400, icon: 'girl', expr: 'wonder', time: 3 },
    { x: 6900, y: UP + 20, icon: 'heart', expr: 'wonder', time: 3 },
  ],
  captions: [
    { x: 2850, text: 'The window was open, just a little — just enough for a pillow.' },
    { x: 3200, y: 260, text: 'Inside, everything was ENORMOUS. Pinky had never seen a kitchen before!' },
    { x: 4900, text: 'The house smelled like cookies and crayons. Someone happy lived here.' },
    { x: 6400, text: 'Up the stairs… there was a door with a name on it. But some letters were missing.' },
  ],
  // the rooms seen behind the play path
  rooms: [
    { key: 'kitchen', x0: 3120, x1: 4720, base: '#f7f3ea', dot: '#cde9dc', kind: 'tile', decor: [{ type: 'window', x: 3650, y: 4.6, curtain: '#ffe08a' }, { type: 'clock', x: 4300, y: 5.2 }, { type: 'drawing', x: 4500, y: 2.8, color: '#e0457b' }] },
    { key: 'living', x0: 4720, x1: 6800, base: '#fff1dc', dot: '#f6dcbc', kind: 'stripes', decor: [{ type: 'picture', x: 5100, y: 4.3 }, { type: 'window', x: 5800, y: 3.6, curtain: '#9fd8ff' }, { type: 'plant', x: 4800 }, { type: 'bookcase', x: 5330, w: 380, h: 7.4, rows: [3.3, 4.7, 6.1] }, { type: 'picture', x: 6300, y: 4.5, bg: '#d6ecff' }] },
    { key: 'bedroom', x0: 6800, x1: 8200, y0: UP, base: '#ffe1ee', dot: '#ffc2db', kind: 'stars', decor: [{ type: 'door', x: 6950, color: '#b48aff' }, { type: 'window', x: 7600, y: 3.4, view: 'park', curtain: '#ffb3cf' }, { type: 'drawing', x: 7250, y: 3.4 }, { type: 'drawing', x: 7900, y: 2.6, color: '#3f9a3a' }] },
  ],
};
