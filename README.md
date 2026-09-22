# Dreadnought

A browser roguelike built in the visual language of diep.io: the same grey grid arena,
the same 50-tank upgrade tree, the same feel to the shooting. Wrapped around it is a
wave-based run structure. Enemies arrive in waves, every level-up offers a choice of
three cards, and class upgrades unlock at levels 15, 30 and 45. Death ends the run.

Single-player, no server, no accounts. TypeScript and Canvas 2D, built with Vite.

**Play it: https://wknudson.github.io/Dreadnought/**

Works with a mouse and keyboard or with two thumbs on a phone.

## Running it

```
npm install
npm run dev
```

To check everything at once, which regenerates the tank table, runs the tests
and builds:

```
npm run check
```

Other scripts: `npm run build` (typecheck then bundle), `npm run preview`,
`npm run typecheck`, `npm test`, and `npm run data` to regenerate the tank table
on its own. `npm run balance`, `npm run fight` and `npm run finale` are the
headless harnesses described under Balance.

The dev server honours `PORT`, so more than one checkout can run one at a time.
Vite takes 5173 by default; set `PORT` for a second worktree, or let
`.claude/launch.json` (which sets `autoPort`) pick a free one.

## Balance

`npm run balance` plays two dozen full runs without a browser and reports how
long each took, how far it got, and how long each boss stood up. The bot is
deliberately mediocre, so its numbers are an upper bound on run length rather
than a target. It is the fastest way to tell whether a change made the game
longer, shorter, or impossible, and it found every stalling bug in the wave
system before a human ever saw one.

`npm run fight` drops a levelled bot straight onto a single wave and plays it
many times, which is the cheap way to ask whether one boss fight ends and how
long it takes. `npm run finale` is the same thing pointed at wave 25. It reports
the median of cleared fights separately from all trials, and exits non-zero if
any fight hits the six-minute limit. Flags, all optional:

| flag | meaning | default |
|---|---|---|
| `--wave N` | the wave to play, 1 to 25 | 25 |
| `--level N` | the bot's level, 1 to 45 | follows the class cadence: 15 at wave 5 up to 45 at wave 25 |
| `--difficulty D[,D]` | `easy`, `normal`, `hard`, or `all` | `all` |
| `--perk-chance R[,R]` | card perk rate(s), 0 to 1 | each difficulty's own |
| `--seeds N` | how many seeds, 1 to 512 | 16 |
| `--modifier M[,M]` | `crush`, `tide`, `meteors`, `none`, or `each` | whatever the wave rolls |

```
npm run fight -- --wave 15 --difficulty hard
npm run fight -- --wave 20 --modifier each
```

Neither harness measures difficulty for a person. The bot takes its cards at
random, so it is weaker and more varied than someone choosing a build, and its
strength moves with the perk rate: readings taken at different rates are not
comparable. The header of `tools/fight.ts` says more.

While playing, Shift+L grants a level, Shift+K skips to the next wave, and F2
shows a debug readout. These are not limited to dev builds; they work on the
live site too.

## Playing

Drive with WASD or the arrow keys, aim with the mouse, fire with click or space.
Right click or shift is the secondary action, which steers drones on the tanks
that have them. E holds the trigger down, C spins you, Escape pauses. On a phone
the left thumb drives and the right thumb aims and fires.

The bottom left corner carries your eight stats: how many points each has, what
that currently buys, and how much of it the run has added. The perks you have
taken stack above them, and hovering one explains what it does.

A run is twenty-five waves with a boss every fifth. From wave 4, enemy tanks
from the same upgrade tree join the polygons, spawning within two levels of you
rather than at a level fixed by the wave. Levelling deals a choice of three
cards, and at levels 15, 30 and 45 you pick a class from the real upgrade tree. Dying ends the run; only the best wave and score survive it.

Easy, Normal and Hard are picked on the title screen and each keeps its own
best. They change how many enemies a wave buys, how tough they are and how
hard they hit, how long the break between waves is, and how much experience
kills pay. Hard also deals perks more often than stat cards.

The arena starts small and widens after each boss. Waves 10 and 15 each draw an
arena modifier from three, never the same one twice in a run: **The Crush**
closes the room steadily, **The Tide** leans it between wide and tall before
settling narrow, and **Meteors** drops warned blasts across the floor. A
modifier is paid for out of the wave's enemy budget, so it changes the fight
rather than adding to it. The bot never dodges, so the harnesses cannot judge
Meteors; playtesting is what decides whether it stays.

The last boss, the Fallen Overlord, has an authored arena of its own
(`src/sim/finale.ts`). At two thirds and one third of its health the room
reshapes, from a wide corridor (The Hall) to a tall one (The Well), and in the
last third (The Vise) it closes in.

Winning a run marks every tank it passed through in the codex, so a win as
the Overlord also marks the Overseer, Sniper and Basic Tank on the way there.
Each mark keeps the hardest difficulty it was won on, shown as a bronze, silver
or gold medal on the tank tree. Dying or giving up marks nothing. The codex
never makes a run easier; what it unlocks is tank colours, a new one at 3, 8,
15, 25, 40 and all 50 tanks won, and the title screen shows how far it has come.

The Tank Tree button on the title screen opens the whole upgrade tree as a
radial map. Drag to pan, scroll or pinch to zoom, and click a tank to see its
stats and a spinning preview.

Every run has a seed, shown on the death screen. Adding `?seed=` to the URL
replays one: a number is used as is, and any word is hashed into one.

## Tank data

`src/data/tanks.generated.ts` is generated, not written by hand. The generator
(`tools/convert-tanks.ts`) reads a vendored copy of the tank geometry table and
layers the corrections in `tools/overrides/` on top, then validates that every
upgrade edge resolves and that the roster is exactly 50 tanks. Edit the overrides,
never the generated file, and run `npm run data`.

## Deploying

Every push to `main` builds and publishes the site through
`.github/workflows/deploy.yml`. The workflow regenerates the tank table, then
builds with `GH_PAGES=1`, which makes `vite.config.ts` serve from
`/Dreadnought/` rather than the root.

## Credits

Tank geometry is derived from the data table published by the
[diepcustom](https://github.com/ABCxFF/diepcustom) project, with rendering and
physics constants from [diepindepth](https://github.com/ABCxFF/diepindepth) and
the [diep.io wiki](https://diepio.fandom.com/). Only numeric facts were taken;
no code from those projects is reproduced here.

Dreadnought is a fan project and is not affiliated with or endorsed by the makers
of diep.io.

## License

[AGPL-3.0-only](LICENSE).
