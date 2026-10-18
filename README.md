# Pinky Land 🩷

A cozy 3D exploration game about Jacinta, her pillow friend Pinky, and Liev.

## How to play

**Double-click `index.html`.** It opens in your web browser (Safari or Chrome) and the game starts. You don't need the internet or anything else installed.

- If the game ever looks slow, open **Settings (Esc)** and set **Graphics quality** to Medium.
- Your progress saves automatically in the browser you play in.
  (If you switch from Safari to Chrome, it starts fresh there.)

The title screen has two games:

- **Pinky Land**: the cozy 3D adventure (described below).
- **Pinky's Storybook**: a 2.5D side-scrolling platformer where Pinky searches for the girl who imagined him. It saves separately, so playing one never changes the other.

## Controls (Pinky Land)

| What | Keys |
|---|---|
| Move | W A S D or arrow keys |
| Run | Hold Shift |
| Jump / double jump | Space (press again in the air) |
| Glide (after finding the Sky Cape) | Hold Space while falling |
| Swim up / dive down | Space / Shift |
| Look around | Click and drag on the game, two-finger swipe left/right on a trackpad, or Q / C (R / V tilt up/down). Settings also has a "look by just moving the mouse" option. |
| Zoom | Two-finger swipe up/down, pinch, mouse scroll, or + / − |
| Flashlight | F (turns on by itself when it gets dark) |
| Talk / pick up | E |
| Switch character | Tab, or 1 2 3 4 |
| Hint · Journal · Map | H · J · M |
| Settings | Esc |

A game controller also works (left stick moves, right stick looks, A jumps).

## What's in this first version

- **Intro:** a crayon drawing of Jacinta and Pinky that draws itself while the story is told.
- **Chapter 1, Earth:** Jacinta's neighborhood and park. You light up 5 kindness hearts to open the magic door:
  1. Help Maya, who fell off her bike, by getting a bandage from Mr. Hughes.
  2. Hug Oliver, who is new and lonely.
  3. Stand up (kindly) for Sam when Brock takes his ball, or get a grown-up to help.
  4. Carry Mango the hurt parrot home to Mrs. Rosa.
  5. Pick up the litter in the park.
- **Chapter 2, Pinky Land:** a flower meadow, Sparkle Pond with lily pads and fish, Rainbow Falls, Cloud Steps to bounce up, Grandpa Puff (a giant bouncy pinky), a coral reef, a cozy camp with a campfire and tent, foxes, horses, flamingos, storks, parrots, butterflies and fireflies.
- Day and night (a full day takes 20 minutes), sunrises, sunsets, stars and fireflies.
- A journal, a map that fills in as you explore, a hint button, music and nature sounds.

## Pinky's Storybook (2.5D platformer)

**Chapter 1: A Pillow Is Imagined.** Pinky is drawn into being on a sheet of drawing paper. He crosses a crayon world of giant pencils, a fallen crayon, storybooks and a giant button. He rides paper boats across a crayon river, bounces on a marshmallow cloud, climbs a tree, and gently bounces on dust bunnies (they just sneeze and roll away). Three torn scraps of a drawing slowly show a curly-haired girl in a pink hoodie, hugging a pink pillow. One scrap is hidden behind a bush. At the edge of the paper, Pinky sees a faraway glowing window and decides to find her.

| What | Keys |
|---|---|
| Walk | ← → (or A / D) |
| Run | Hold Shift |
| Jump | Space (hold for a higher jump) |
| Back to checkpoint | R |
| Pause | Esc |

Pinky has 3 hearts. Falling in the river or bumping a thorny bush costs one heart; he floats back to safe ground. If the hearts run out, he goes back to the last star checkpoint with full hearts. There's no "game over."

## For grown-ups who want to change things

The game is written in JavaScript using the Three.js 3D library.

- `src/`: the game's code (open it with any text editor)
  - `src/characters/style.js`: colors for Jacinta, Liev and the other kids
  - `src/characters/pinky.js` and `faces.js`: Pinky's shape, color and face
  - `src/scenes/earth.js`: Chapter 1 (the neighborhood and the kindness quests)
  - `src/scenes/pinkyland.js`: Chapter 2 (Pinky Land)
  - `src/storybook/`: Pinky's Storybook (`level1.js` is the level layout; `storybook.js` is the movement and story)
- `game/pinkyland.js`: the finished, bundled game that `index.html` loads. **Don't edit this file directly.**

After changing anything in `src/`, rebuild the bundle. This needs Node.js (free from nodejs.org). In Terminal, inside this folder, run:

```
npm install
npm run build
```

`docs/PinkyLand_Metaprompt.md` is the design brief the game is built from.
