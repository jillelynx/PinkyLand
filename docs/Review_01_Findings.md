# Pinky Land — Review 01: findings, plan and what was fixed

## How the game is built (what was inspected)
- **Engine:** Three.js (web), bundled with esbuild into `game/pinkyland.js`. Post-processing: bloom + a colour-grade pass (`src/core/engine.js`).
- **World:** procedural height-map terrain (`src/world/terrain.js`), one water plane at height 0 with a depth-tinted shader (`src/world/water.js`), instanced grass/trees/bushes (`src/world/vegetation.js`).
- **Physics:** custom, no physics engine. `src/world/world.js` holds round/box colliders and ground height; `src/core/player.js` moves the player and pushes it out of colliders.
- **Animals:** glTF birds/fox/horse flying or running on fixed loops (`src/world/creatures.js`), hand-built pets and songbirds (`src/world/pets.js`).
- **Camera:** third-person orbit (`src/core/cameraRig.js`).

## Findings
| # | Issue (what the player sees) | Evidence / root cause | File / system | Fix | Priority / risk |
|---|---|---|---|---|---|
| 1 | You walk straight through people, Pinkies and pets | Confirmed by test: player got 0.01 m from Dot. Characters had **no collision body at all**; only trees, rocks and houses did | `world.js`, `level.js addNPC` | Every character (and Buddy, Gil, Joe) gets a soft round body that moves with it. Followers walking with you, and Buddy while he trots after you, are left out so they can't shove you | High / low |
| 2 | Swimming up the pond walls and the waterfall cliff | Confirmed: swimming into the cliff for 10 s ended **on top of the cliff** (y = 10.3). The swim code lifted you to the sea floor every frame, and walking snapped you to the ground, so any slope, however steep, could be climbed | `player.js` | New steep-ground check: ground steeper than ~50° that rises above your feet is a wall. You slide along it instead of climbing. Movement is also split into small steps so speed or a slow frame can't skip past things | High / medium (tested for trapping) |
| 3 | Swimming to the "edge of the world" | Confirmed: you could swim to 148 m and hit an invisible wall far out at sea | `player.js`, `pinkyland.js`, `earth.js` | A gentle current starts just past the island and eases you back (with a message), so there's no hard invisible wall. Earth has the same thing near the edge of the neighbourhood | High / low |
| 4 | Flamingos and parrots dipping into hills and grass | Confirmed: lowest bird was 0.26 m **below** the ground. Flyers used one fixed height no matter what was under them | `creatures.js addFlyers` | Birds keep a safe height above the ground and look ahead, so they rise smoothly before a hill | High / low |
| 5 | Songbirds disappear into the grass when they land | From the code: they landed on random ground spots; the grass is 4× taller than the bird | `pets.js Songbirds` | They land on the sidewalk, garden paths and fence posts, where the grass is cut and you can see them | Medium / low |
| 6 | Camera can end up inside a hill or pond wall, so you see through the world | From the code: the "stay underwater" camera rule could push the camera back down into the bank | `cameraRig.js` | If ground is between the camera and the player, the camera moves in closer, then eases back out | Medium / low |
| 7 | Trees look like crumpled paper | **A bug, not an art choice.** Leaf normals were recomputed after the mesh was split into separate triangles, so every triangle was lit flat | `vegetation.js` | Soft rounded normals per leaf blob plus the whole canopy, shady inside and sunny on top, and a slight colour difference per tree | High / low |
| 8 | Image looks milky and washed out | Bloom picked up ordinary bright grass (threshold 0.82); strong sun plus sky light blew out pale greens | `engine.js`, `sky.js` | Bloom only on real highlights, slightly lower exposure and sun, and a gentle colour/contrast grade | Medium / low |
| 9 | Rainbow-coloured smear at the pond edge; cliff is a blurry purple blob | Terrain colours (beach sand, pink meadow, lavender rock) were blended over a few metres of bank. The terrain mesh is coarse (~1.5 m), so they smeared | `pinkyland.js` colours, `terrain.js` shader | Mossy/earthy pond banks, layered stone on steep faces (drawn per pixel), and soft mottling everywhere | Medium / low |
| 10 | Big dark spiky grass on a pale floor | Wide blades with a dark base on a very light ground colour | `vegetation.js`, `pinkyland.js` | Thinner blades, lighter base colour, deeper ground colour | Medium / low |

## Staged plan
1. **Movement, collisions, water, edges** — done in this pass (#1–#6).
2. **Biggest visual weaknesses** — started in this pass (#7–#10). Next: water edge and shallows, cloud shapes, pillow (little Pinky) backs reading as plain slabs, and pale ground near the camp.
3. **Animation and feel** — next: characters turn to face you when you walk up; smoother landing and turning; birds bank and glide; a camera that frames the view ahead while you explore.

## Verification (automated play-tests run in the build environment)
- Walking into Dot, Pip, Button, Grandpa Puff, Maya, Mr. Hughes, Mrs. Rosa, Buddy, Gil and Joe from 8 directions, at walking speed and running at 120, 60 and 20 frames per second: **0 overlaps**. No back-and-forth jitter when you keep pushing. You can still talk to everyone.
- Running into tree trunks at 120/60/20/12 fps: **0 pass-throughs**.
- Pond: swimming out in 36 directions, you can **climb out everywhere** except the waterfall wall. You are never inside the ground, and you never swim up a wall. Walking back in from 29 directions **always starts swimming**.
- The waterfall cliff stops you at its base. The cape on the clifftop can still be reached on foot by the side slope (a route-following bot got there in 15 s).
- Swimming out to sea for 50 s in three directions: you're gently stopped at about 132 m and the message appears.
- Birds over 2 minutes of flight: lowest is 5.8 m above ground or water (before: 0.26 m inside a hill). Songbirds landed on sidewalks, paths or fence posts 283 out of 283 times.
- Full Earth kindness chapter, the portal, the campfire, the tent, swimming and the cape all still work.
