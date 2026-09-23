/**
 * Perk tell tests.
 *
 * A tell is only worth drawing if it tells the truth: a shield shell for a
 * charge that is really there, a spree pip for a kill still counting, a field
 * ring at the reach that actually burns. So these check the state each perk
 * hands the renderer against what the perk does, and that the drawing itself
 * runs for every tell without a browser.
 *
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Run } from '../src/sim/run.ts';
import { Shape } from '../src/sim/shape.ts';
import { PERKS, staticFieldRadius } from '../src/sim/perkImpl.ts';
import { applyDamage } from '../src/sim/physics.ts';
import { drawPerkTellsOver, drawPerkTellsUnder } from '../src/render/perkTells.ts';
import { getTank } from '../src/data/tanks.ts';
import { vec } from '../src/core/math.ts';
import { Rng } from '../src/core/rng.ts';
import type { PerkTell } from '../src/sim/perks.ts';

/** A run with the waves stopped and the arena empty. */
function quietRun(): Run {
  const run = new Run({ seed: 1234, difficulty: 'normal', color: '#00B2E1' });
  run.waves.halt();
  for (const e of run.world.entities) if (e instanceof Shape) e.alive = false;
  run.tick();
  return run;
}

function withPerk(run: Run, id: string, stacks = 1): void {
  const perk = PERKS.find((p) => p.id === id);
  assert.ok(perk, `no perk called ${id}`);
  for (let i = 0; i < stacks; i++) run.takeCard({ kind: 'perk', perk });
}

const tellOf = (run: Run, id: string): PerkTell | undefined =>
  run.perkTells().find((t) => t.id === id);

function ticks(run: Run, count: number): void {
  for (let i = 0; i < count; i++) run.tick();
}

/** A square parked at an offset from the player, already admitted to the world. */
function squareAt(run: Run, dx: number, dy = 0, seed = 1): Shape {
  const square = new Shape('square', vec(run.player.pos.x + dx, run.player.pos.y + dy), new Rng(seed));
  run.world.spawn(square);
  run.tick();
  return square;
}

test('a shield shows a shell per charge, breaks one on a hit, and refills on a clear', () => {
  const run = quietRun();
  withPerk(run, 'shield');
  assert.deepEqual(tellOf(run, 'shield')?.gauge, [1], 'one charge to start');

  const before = run.world.deaths.length;
  applyDamage(run.world, run.player, 10, null);
  assert.deepEqual(tellOf(run, 'shield')?.gauge, [0], 'the hit spent it');
  const shatter = run.world.deaths.slice(before).find((d) => d.ring && d.sides === 6);
  assert.ok(shatter, 'and the shell that took it breaks where it can be seen');

  withPerk(run, 'shield', 2);
  run.perks.waveClear(run.world);
  assert.deepEqual(tellOf(run, 'shield')?.gauge, [3], 'a clear refills a shell per stack');
});

test('a spree shows a pip per kill, and they drain away when the killing stops', () => {
  const run = quietRun();
  withPerk(run, 'spree');
  for (let i = 0; i < 4; i++) {
    const square = squareAt(run, 300 + i * 90, 0, i + 1);
    applyDamage(run.world, square, 1000, run.player);
  }
  const live = tellOf(run, 'spree')!.gauge;
  assert.equal(live.length, 4, `four kills should show four pips, got ${live.length}`);
  assert.ok(live.every((t) => t > 0 && t <= 1), 'each pip is a fraction of its time left');
  assert.ok(live[0]! < live[3]!, 'and the oldest kill has the least left');

  ticks(run, 110);
  assert.equal(tellOf(run, 'spree')!.gauge.length, 0, 'every pip gone once the window passes');
});

test('Last Stand shows nothing at full health and beats near death', () => {
  const run = quietRun();
  withPerk(run, 'last-stand');
  run.tick();
  assert.deepEqual(tellOf(run, 'last-stand')?.gauge, [0]);

  run.player.health = run.player.maxHealth * 0.05;
  run.tick();
  assert.ok(tellOf(run, 'last-stand')!.gauge[0]! > 0.5, 'close to death it should be urgent');
});

test('the field ring is drawn at the reach the field actually burns', () => {
  const run = quietRun();
  withPerk(run, 'static-field');
  const reach = staticFieldRadius(1);
  const inside = squareAt(run, reach - 40, 0, 1);
  const outside = squareAt(run, 0, reach + 220, 2);
  ticks(run, 11);
  assert.ok(inside.health < inside.maxHealth, 'a square inside the ring is burning');
  assert.equal(outside.health, outside.maxHealth, 'one well outside it is not');
});

test('every tell draws without error, at one stack and at three', () => {
  // A stand-in canvas context: every method is a no-op and every property takes
  // whatever is set, which is all the drawing code needs to run end to end.
  const noop = (): void => {};
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : noop),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  const run = quietRun();
  for (const def of [getTank('tank'), getTank('smasher')]) {
    run.player.upgradeTo(def);
    for (const stacks of [1, 3]) {
      const tells: PerkTell[] = [
        { id: 'static-field', stacks, gauge: [] },
        { id: 'thorns', stacks, gauge: [] },
        { id: 'shield', stacks, gauge: [stacks] },
        { id: 'spree', stacks, gauge: [1, 0.6, 0.2] },
        { id: 'last-stand', stacks, gauge: [0.75] },
      ];
      for (const time of [0, 12.5, 400]) {
        drawPerkTellsUnder(ctx, run.player, run.player.pos, tells, time);
        drawPerkTellsOver(ctx, run.player, run.player.pos, tells, time);
      }
    }
  }
});
