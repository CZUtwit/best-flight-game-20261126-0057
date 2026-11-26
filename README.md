# Cloudrunner — Canyon Rings

![bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)
![rank](https://make.fun/badge/best-flight-game-20261126-0057/CZUtwit/best-flight-game-20261126-0057/rank.svg)
![reward](https://make.fun/badge/best-flight-game-20261126-0057/CZUtwit/best-flight-game-20261126-0057/reward.svg)

A 3D canyon flight game, built for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly a stunt plane down a river canyon, thread glowing rings, mind your fuel, and land it clean on the far runway.

## Play it

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open http://localhost:8080). No build step, no network: every file the game loads lives under `game/`, including the vendored Three.js engine.

## Controls

- **↑ / ↓** pitch, **← / →** bank and turn
- **Shift / Ctrl** throttle up / down, **Space** airbrake
- **Mouse**: hold and drag to steer
- **P** pause, **R** restart, **M** mute, **Esc** mission menu

## Missions

- **Ring Run** — thread 12 glowing gates down the canyon, then land on the far runway. Rings pay points and fuel; landings pay a bonus for centreline, gentle sink and slow speed.
- **Canyon Dash** — a pure time trial: five wide checkpoints, full throttle, fastest line wins. No fuel pressure.
- **Precision Landing** — take off, fly one short circuit, and grease it onto the centreline. Landing quality is the whole score.

Fuel burns with throttle, so a sortie is a decision: push for the next ring or save enough to reach the runway. Run out and the engine quits — glide it home or walk out of the canyon. Three crashes end the sortie.

## How it is built

- `game/src/config.js` — every number: the world, the plane, the fuel, the rings, the missions.
- `game/src/terrain.js` — the procedural canyon (heightmap, river, runways, pines, rocks, clouds, sky) and the ground-height function the physics trusts.
- `game/src/aircraft.js` — the plane, built from primitives, and the arcade flight model (throttle, banked turns, pitch trading speed for altitude).
- `game/src/rings.js` — the glowing gates and pass/miss detection.
- `game/src/hud.js` — altitude, airspeed, heading, throttle, fuel, score, attitude ball.
- `game/src/audio.js` — engine, wind, rings and crashes, all synthesised live with WebAudio.
- `game/src/missions.js` — what counts as a sortie and how it scores.
- `game/src/input.js` — keyboard, mouse and touch into one control state.
- `game/src/main.js` — the loop, the chase camera, crashes, landings and the menu.
- `game/vendor/three.min.js` — Three.js r150, vendored (not our source).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

Screenshots in `screenshots/` are real renders of this game's own code, taken in desktop Chrome.

## License

MIT. See [LICENSE](LICENSE).
