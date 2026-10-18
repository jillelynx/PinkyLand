# Metaprompt: Pinky Land — Fix Pass 1

## Your role
You are the same expert game team that built Pinky Land (creative director, game designer, programmer, UI designer, child-accessibility advisor). This is a **fix pass** on the existing 3D Pinky Land mode. Do not rebuild anything. Keep every working feature, the save data, and Pinky's Storybook mode exactly as they are. Make small, careful changes and test each one in the browser.

## Fixes to make

### 1. Flashlight when it gets dark
- When night falls (and in dark places), the player automatically turns on a warm flashlight that lights up the ground in front of them.
- The beam points the way the player faces, angled slightly down, with a soft, visible glow, like a real flashlight in a cozy game.
- It works for every playable character (Jacinta, Jacinta + Pinky, Pinky, Liev) and in both Earth and Pinky Land.
- The player can turn it on or off any time with the **F** key or a flashlight button on screen. If the player hasn't chosen, it turns on by itself at dusk and off at sunrise.
- The first time it turns on, show a short friendly message explaining the F key.

### 2. Compass on screen
- Add a compass strip at the top center of the screen (like many adventure games) that turns as the player looks around.
- Show **N, E, S, W** clearly (N highlighted), with smaller marks in between.
- Show a little sun ☀️ (daytime) or moon 🌙 (night) on the compass where it is in the sky, so players can see the sun rising in the east and setting in the west.
- The compass must agree with the map: north is the top of the map.

### 3. The sun rises in the East and sets in the West
- Check the day/night cycle. The sun must rise in the east, pass across the southern sky at noon, and set in the west. The moon follows the opposite path at night.
- The compass and map must use the same directions as the sun.

### 4. Outlines for missing hearts in the heart meter
- In the Kindness heart meter, hearts not earned yet should appear as clear **pink outlines** (empty hearts). Earned hearts are filled and glowing.

### 5. Buttons for the map and other menus must be clickable
- The Hint, Journal, Map, Characters, Settings and new Flashlight buttons, and the character buttons at the bottom, must all respond to a mouse or trackpad click.
- Find and remove anything invisible covering the screen that blocks clicks (for example, a full-screen fade or title layer that should let clicks pass through).

### 6. Looking around should be easy
- Clicking and dragging on the game (mouse or trackpad) must turn the camera smoothly.
- On a Mac trackpad, a **two-finger swipe left/right** turns the camera, and a two-finger swipe up/down zooms in and out (pinch also zooms).
- Keyboard: **Q** / **C** turn the camera left / right; **R** / **V** tilt it up / down.
- Add an optional **"look by just moving the mouse"** mode in Settings for players who prefer it, where Esc gives the mouse back.
- Slightly faster default turning speed. The camera still gently swings behind the player while walking.
- Update the on-screen controls help and the Settings controls list.

## Testing checklist
- Every HUD button opens its menu when clicked; dragging on the game turns the camera.
- At dawn the sun is on the east side of the compass; at dusk it is on the west side.
- The flashlight turns on at night, lights the ground ahead, follows the player's direction, and toggles with F and the button.
- The heart meter shows outlined empty hearts and filled earned hearts.
- No errors appear, saves still load, and Pinky's Storybook still works.
