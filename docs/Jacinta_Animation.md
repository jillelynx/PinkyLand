# Jacinta's pixel-art animation (Storybook Chapter 3)

## Where things are
- `docs/art/jacinta_sheet_friendly_source.png` and `jacinta_sheet_determined_source.png`: your original sprite sheets.
- `docs/art/jacinta_walk_run_source.png`: your second sheet (new walk and run).
- `assets/jacinta/jacinta_sheet.png`: the game-size frames (116 × 110 pixel boxes, 12 across). Rows 1–7 show her friendly face; rows 8–14 show her determined face. In each group the rows are idle, walk, crouch/duck, slide, punch & kick, run, jump. The walk always uses the friendly walk from the new sheet, and the run always uses the determined run. `jacinta_sheet.json` lists the box size and where her feet go.

## Controls (Chapter 3)
- ← → to walk, Shift to run.
- Space to jump; press Space again in the air to double jump.
- ↓ to duck. Hold ↓ and use the arrows to crawl under low logs.
- Press ↓ while moving to slide. If she ends the slide under a log, she stays low and crawls.
- Z (or J) to punch, X (or K) to kick.
- Punches, kicks, slides and crawling gently boop the friendly beetles out of the way. A punch or kick breaks the cracked boulders (or you can jump over them).

The move settings (crawl speed, slide length, how low she gets) are in `src/storybook/level3.js` under `moves`.

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

