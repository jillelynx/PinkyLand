// Pinky's Storybook — Chapter 3: "Jacinta the Explorer"
// Now YOU are Jacinta! With Pinky tucked in her backpack, she explores a pixel-art
// jungle: mossy ground, giant trees, a river with leaf rafts, floating grassy
// islands and the great Rainbow Falls. Three torn pieces of a treasure map show
// the way. Drawn in chunky pixel art (see pixelJungle.js).
// Coordinates: x to the right, y DOWN (screen style). The ground is at y = 440.

const G = 440;

export const LEVEL3 = {
  id: 3,
  title: 'Chapter 3',
  subtitle: 'Jacinta the Explorer',
  theme: 'pixel',
  hero: 'Jacinta',
  intro: 'arrive',
  openCaption: 'Jacinta tucked Pinky into her backpack, tied on her cape, and stepped into the Whispering Jungle.',
  resumeCaption: 'Jacinta checked her map and kept exploring…',
  retryCaption: 'Jacinta brushed off her knees, fixed her cape, and tried again!',
  stompTip: 'Boing! The beetle giggled, tucked in, and rolled away. 🐞',
  // Jacinta is taller than Pinky, so her body box is bigger
  physics: { w: 28, h: 64, jump: 820, walk: 205, run: 340 },
  // Jacinta's explorer moves: duck (hold Down), crawl (duck + arrows), slide (Down while
  // moving), punch (Z / J) and kick (X / K). Ducking and sliding make her body box lower.
  moves: { crawl: 75, duckH: 38, slideH: 30, slideTime: 0.55, slideSpeed: 400, slideMin: 180, slideFriction: 430 },
  // cracked boulders: a punch or kick breaks them (you can also jump over)
  breakables: [
    { x: 430, y: 384, w: 52, h: 56, kind: 'boulder' },
    { x: 4785, y: 384, w: 52, h: 56, kind: 'boulder' },
  ],
  width: 7700,
  start: { x: 170, y: G },
  scrapStyle: 'map',
  scrapLines: {
    1: 'A torn piece of an old treasure map! It shows a river… and a tiny drawing of a waterfall.',
    2: 'Another piece of the map! A trail winds past a giant tree. “Pinky, we’re getting close!”',
    3: 'The last piece! A rainbow over the waterfall… and a little pink heart drawn behind it.',
  },
  ending: {
    x: 7420, y: G, pan: false,
    first: 'At last: the Rainbow Falls! Jacinta held up her map pieces to the misty light…',
    reveal: {
      all: 'The map was complete! Behind the Rainbow Falls, X marks a glowing pink door…',
      some: (n) => `The pieces she found showed part of the trail… (${n} of 3). Maybe there’s more to explore.`,
    },
    last: '“Pinky,” Jacinta whispered, “I think that’s the door to Pinky Land.” Pinky wiggled with joy in her backpack.',
    next: 'More chapters coming soon!',
  },
  ground: [
    { x0: -200, x1: 1080, y: G },
    { x0: 1200, x1: 1560, y: G },
    { x0: 2330, x1: 3600, y: G },
    { x0: 3820, x1: 5060, y: G },
    { x0: 5980, x1: 6420, y: G },
    { x0: 6600, x1: 7900, y: G },
  ],
  // solid blocks (kind: stone = mossy rock, log = fallen log, stump)
  blocks: [
    // low logs: duck and crawl, or slide, to get underneath
    { x: 730, y: 300, w: 110, h: 94, kind: 'lowlog' },
    { x: 2860, y: 300, w: 190, h: 94, kind: 'lowlog' },
    { x: 520, y: 390, w: 110, h: 50, kind: 'stone' },
    { x: 905, y: 400, w: 150, h: 40, kind: 'log' },
    { x: 1330, y: 380, w: 90, h: 60, kind: 'stump' },
    { x: 4560, y: 396, w: 150, h: 44, kind: 'log' },
    { x: 5100, y: 380, w: 120, h: 60, kind: 'stone' },
    { x: 5240, y: 320, w: 120, h: 120, kind: 'stone' },
    { x: 5380, y: 260, w: 150, h: 180, kind: 'stone' },
    { x: 7000, y: 396, w: 120, h: 44, kind: 'stone' },
  ],
  // one-way platforms (jump up through them): floating grassy islands and tree branches
  oneways: [
    { x: 1700, y: 320, w: 120, kind: 'island' },
    { x: 1860, y: 190, w: 110, kind: 'island' },
    { x: 2080, y: 280, w: 130, kind: 'island' },
    { x: 3430, y: 230, w: 130, kind: 'branch' },
    { x: 3640, y: 180, w: 140, kind: 'branch' },
    { x: 3640, y: 360, w: 120, kind: 'island' },
    { x: 4040, y: 370, w: 120, kind: 'branch' },
    { x: 4190, y: 300, w: 120, kind: 'branch' },
    { x: 4040, y: 230, w: 120, kind: 'branch' },
    { x: 4190, y: 160, w: 120, kind: 'branch' },
    { x: 4080, y: 92, w: 140, kind: 'island' },
    { x: 5785, y: 220, w: 140, kind: 'island' },
    { x: 6480, y: 400, w: 70, kind: 'lily' },
  ],
  // moving platforms: leaf rafts on the river and a vine-hung lift
  movers: [
    { x: 1580, y: 418, w: 120, dx: 300, dy: 0, period: 6, phase: 0, kind: 'raft' },
    { x: 1950, y: 418, w: 120, dx: 300, dy: 0, period: 6, phase: Math.PI, kind: 'raft' },
    { x: 5600, y: 300, w: 100, dx: 0, dy: -150, period: 5, phase: 0, kind: 'lift' },
  ],
  // giant bouncy mushrooms
  bouncy: [
    { x: 3330, y: 404, w: 90, power: 1120 },
  ],
  water: [
    { x0: 1560, x1: 2330, y: 452 },
    { x0: 6420, x1: 6600, y: 452 },
    { x0: 1080, x1: 1200, y: 470, dry: true },
    { x0: 3600, x1: 3820, y: 470, dry: true },
    { x0: 5060, x1: 5980, y: 470, dry: true },
  ],
  // thorny brambles
  hazards: [
    { x: 3120, y: 414, w: 76, h: 26 },
    { x: 6250, y: 414, w: 80, h: 26 },
    { x: 6800, y: 414, w: 70, h: 26 },
  ],
  // friendly round beetles (bounce on them!)
  bunnies: [
    { x: 2620, range: 90, kind: 'beetle' },
    { x: 2980, range: 110, kind: 'beetle' },
    { x: 4380, range: 120, kind: 'beetle' },
    { x: 6150, range: 80, kind: 'beetle' },
    { x: 7200, range: 90, kind: 'beetle' },
  ],
  stars: [
    [330, 400], [380, 400], [456, 340], [575, 350], [700, 400], [760, 400],
    [945, 360], [1140, 360], [1375, 340], [1480, 400],
    [1640, 380], [1760, 280], [1915, 150], [2000, 380], [2145, 240], [2260, 380],
    [2460, 400], [2520, 400], [2905, 418], [2955, 418], [3005, 418], [3000, 400], [3240, 400],
    [3375, 300], [3375, 230], [3495, 190], [3710, 140], [3700, 320],
    [4100, 330], [4250, 260], [4100, 190], [4250, 120],
    [4440, 400], [4635, 355], [4800, 400], [4880, 400],
    [5160, 340], [5300, 280], [5455, 220], [5650, 200], [5895, 180],
    [6060, 400], [6200, 400], [6515, 360], [6700, 400], [6900, 400], [7060, 350], [7140, 400],
  ],
  // pieces of the treasure map
  scraps: [
    { id: 'map1', x: 1915, y: 120 },
    { id: 'map2', x: 4150, y: 58 },
    { id: 'map3', x: 4900, y: 410, hidden: true },
  ],
  checkpoints: [{ x: 2420 }, { x: 4770 }, { x: 6050 }],
  goal: { x: 7380 },
  paperEdge: 7520,
  // a big fern clump in front that hides a secret
  secretBush: { x: 4840, w: 150, y: G },
  // the giant climbing tree behind the branches
  bigTree: { x: 4160, w: 34, top: 110 },
  signs: [
    { x: 250, kind: 'arrows' },
    { x: 355, kind: 'punch' },
    { x: 672, kind: 'duck' },
    { x: 1460, kind: 'double' },
    { x: 2560, kind: 'stomp' },
    { x: 2790, kind: 'slide' },
    { x: 3270, kind: 'bounce' },
  ],
  thoughts: [],
  captions: [
    { x: 1500, text: 'A wide river! Leaf rafts drifted back and forth across it.' },
    { x: 3880, text: 'The biggest tree Jacinta had ever seen. The map said: “Climb!”' },
    { x: 5040, text: 'Mossy cliffs, and a vine lift creaking in the breeze…' },
    { x: 6600, text: 'Jacinta could hear it now: the roar of the Rainbow Falls.' },
  ],
};
