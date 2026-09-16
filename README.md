# Dreadnought

A browser roguelike built in the visual language of diep.io: the same grey grid arena,
the same 50-tank upgrade tree, the same feel to the shooting. Wrapped around it is a
wave-based run structure. Enemies arrive in waves, every level-up offers a choice of
three cards, and class upgrades unlock at levels 15, 30 and 45. Death ends the run.

Single-player, no server, no accounts. TypeScript and Canvas 2D, built with Vite.

**Play it: https://willknudson-capbpm.github.io/Dreadnought/**

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
on its own.

## Balance

`npm run balance` plays two dozen full runs without a browser and reports how
long each took, how far it got, and how long each boss stood up. The bot is
deliberately mediocre, so its numbers are an upper bound on run length rather
than a target. It is the fastest way to tell whether a change made the game
longer, shorter, or impossible, and it found every stalling bug in the wave
system before a human ever saw one.

While playing, Shift+L grants a level, Shift+K skips to the next wave, and F2
shows a debug readout.

## Playing

Drive with WASD or the arrow keys, aim with the mouse, fire with click or space.
Right click or shift is the secondary action, which steers drones on the tanks
that have them. E holds the trigger down, C spins you, Escape pauses. On a phone
the left thumb drives and the right thumb aims and fires.

A run is twenty-five waves with a boss every fifth. Levelling deals a choice of
three cards, and at levels 15, 30 and 45 you pick a class from the real upgrade
tree. Dying ends the run; only the best wave and score survive it.

## Tank data

`src/data/tanks.generated.ts` is generated, not written by hand. The generator
(`tools/convert-tanks.ts`) reads a vendored copy of the tank geometry table and
layers the corrections in `tools/overrides/` on top, then validates that every
upgrade edge resolves and that the roster is exactly 50 tanks. Edit the overrides,
never the generated file, and run `npm run data`.

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
