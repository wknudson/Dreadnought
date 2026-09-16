# Dreadnought

A browser roguelike built in the visual language of diep.io: the same grey grid arena,
the same 50-tank upgrade tree, the same feel to the shooting. Wrapped around it is a
wave-based run structure. Enemies arrive in waves, every level-up offers a choice of
three cards, and class upgrades unlock at levels 15, 30 and 45. Death ends the run.

Single-player, no server, no accounts. TypeScript and Canvas 2D, built with Vite.

## Running it

```
npm install
npm run dev
```

Other scripts: `npm run build` (typecheck then bundle), `npm run preview`,
`npm run typecheck`, and `npm run data` to regenerate the tank table.

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
