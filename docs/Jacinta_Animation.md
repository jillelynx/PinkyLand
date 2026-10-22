# Jacinta's pixel-art animation (Storybook Chapter 3)

## Where things are
- `docs/art/jacinta_sheet_friendly_source.png` and `jacinta_sheet_determined_source.png`: your original sprite sheets.
- `assets/jacinta/jacinta_sheet.png`: the game-size frames (98 × 110 pixel boxes, 8 across). Rows 1–5 show her friendly face; rows 6–10 show the same poses with her determined face. In each group the rows are idle, walk, crouch, run, jump. `jacinta_sheet.json` lists the box size and where her feet go.
- `src/storybook/jacintaSheet.js`: the same picture packed inside the game, plus the **easy settings**.
- `src/storybook/pixelJungle.js` → `pickFrame()`: chooses her frame and face.
- `docs/tools/build_jacinta_sheet.py`: rebuilds the game frames if you replace the source sheets.

## Changing speed
In `src/storybook/jacintaSheet.js`:
- `idle.fps` sets how fast the idle loop plays (6 frames per second).
- `walk.stepPx` / `run.stepPx` set how many game pixels she travels for each new leg frame. Raise the number for slower, longer steps and lower it for quicker steps. These are matched to her stride so her feet don't slide.
- `landFrameTime` sets how long each landing frame shows.

Her actual walking and running speeds are in `src/storybook/level3.js` → `physics: { walk, run }`.

## Switching expressions
She shows her **determined** face when:
- she's running,
- she's doing a double jump,
- a beetle or brambles are just ahead,
- she has just been bumped.

The rest of the time her face is **friendly**. `determinedHold` sets how long the determined face lingers afterward. To change the rules, edit the `reason` lines in `pickFrame()`.

## Frames not used yet
The slide row and the punch/kick row of your sheets aren't in the game yet, because Chapter 3 has no slide or attack move. They can be added along with those moves.
