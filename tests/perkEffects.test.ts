/**
 * Tests for the last ten perks' effects: Magnet's reach, Afterburner's gauge and
 * afterimages, the healing motes, and Fast Learner's sparks.
 *
 * Most of this is visual, so the tests hold it to two promises. It tells the
 * truth about the perk, and it leaves the simulation alone: a mote that drew
 * from the world's random stream would change what every seed plays out.
 *
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Run } from '../src/sim/run.ts';
import { Shape } from '../src/sim/shape.ts';
import { PERKS, Pickup, magnetRadius } from '../src/sim/perkImpl.ts';
import { applyDamage } from '../src/sim/physics.ts';
import { MAX_MOTES } from '../src/sim/world.ts';
import { drawPerkTellsOver, drawPerkTellsUnder } from '../src/render/perkTells.ts';
import { getTank } from '../src/data/tanks.ts';
import { vec } from '../src/core/math.ts';
import { Rng } from '../src/core/rng.ts';
import type { Intent } from '../src/core/input.ts';
import type { PerkTell } from '../src/sim/perks.ts';

const intent = (over: Partial<Intent> = {}): Intent => ({
  move: vec(),
  aimAngle: 0,
  aimWorld: vec(900, 0),
  fire: false,
  secondary: false,
  autoFire: false,
  autoSpin: false,
  ...over,
});

function perked(perks: [string, number][], seed = 1234): Run {
  const run = new Run({ seed, difficulty: 'normal', color: '#00B2E1' });
  run.waves.halt();
  for (const e of run.world.entities) if (e instanceof Shape) e.alive = false;
  for (const [id, stacks] of perks) {
    const perk = PERKS.find((p) => p.id === id);
    assert.ok(perk, `no perk called ${id}`);
    for (let i = 0; i < stacks; i++) run.takeCard({ kind: 'perk', perk });
  }
  run.tick();
  return run;
}

function ticks(run: Run, count: number, input: Intent = intent()): void {
  for (let i = 0; i < count; i++) {
    run.applyIntent(input, 0);
    run.tick();
  }
}

const gaugeOf = (run: Run, id: string): readonly number[] =>
  run.perkTells().find((t) => t.id === id)?.gauge ?? [];

test('each Magnet stack reaches further', () => {
  assert.deepEqual([1, 2, 3].map(magnetRadius), [480, 640, 800]);

  const pulled = (stacks: number): boolean => {
    const run = perked([['magnet', stacks]]);
    const orb = new Pickup(vec(run.player.pos.x + 560, run.player.pos.y), 10, run.player);
    run.world.spawn(orb);
    ticks(run, 3);
    return orb.pos.x < run.player.pos.x + 559;
  };
  assert.equal(pulled(1), false, 'an orb 560 away is out of reach at one stack');
  assert.equal(pulled(2), true, 'and inside it at two');
});

test('a dash leaves afterimages, spends the gauge, and recharges', () => {
  const run = perked([['dash', 1]]);
  assert.deepEqual(gaugeOf(run, 'dash'), [1], 'ready to start with');

  const before = run.world.deaths.length;
  ticks(run, 1, intent({ secondary: true }));
  ticks(run, 6);
  const ghosts = run.world.deaths.slice(before).filter((d) => d.ghost);
  assert.equal(ghosts.length, 5, 'five ticks of afterimage');
  assert.ok(ghosts.every((d) => d.def === run.player.def), 'each one drawn as the tank');
  assert.ok(gaugeOf(run, 'dash')[0]! < 1, 'the dash has to recharge');

  ticks(run, 60);
  assert.deepEqual(gaugeOf(run, 'dash'), [1], 'and it does');
});

test('Lifesteal sends health home as motes, a few at a time', () => {
  const run = perked([['lifesteal', 1]]);
  const square = new Shape('square', vec(run.player.pos.x + 200, run.player.pos.y), new Rng(1));
  run.world.spawn(square);
  run.tick();
  const perk = run.perks.all.find((p) => p.id === 'lifesteal')!;
  const shot = { rootOwner: () => run.player, contactDamage: 10, pos: vec(square.pos.x, square.pos.y) };
  // Six hits on one tick make one mote, not six.
  for (let i = 0; i < 6; i++) perk.onProjectileHit!(shot as never, square, run.world);
  assert.equal(run.world.motes.length, 1);
  ticks(run, 3);
  perk.onProjectileHit!(shot as never, square, run.world);
  assert.equal(run.world.motes.length, 2, 'another once three ticks have passed');

  ticks(run, 40);
  assert.equal(run.world.motes.length, 0, 'every mote arrives or expires');
});

test('motes never exceed their cap', () => {
  const run = perked([]);
  for (let i = 0; i < MAX_MOTES * 2; i++) run.world.addMote(vec(0, 900), run.player, '#85E37D', i);
  assert.equal(run.world.motes.length, MAX_MOTES);
});

test('clearing a wave with Field Repair sends a burst of motes', () => {
  const run = perked([['field-repair', 1]]);
  run.player.health = run.player.maxHealth / 2;
  run.perks.waveClear(run.world);
  assert.ok(run.world.motes.length >= 8, `a burst, got ${run.world.motes.length}`);
  assert.ok(run.world.motes.every((m) => m.target === run.player));
});

test('Fast Learner kills leave sparks for the HUD, and others leave none', () => {
  const kill = (perks: [string, number][]): number => {
    const run = perked(perks);
    const square = new Shape('square', vec(run.player.pos.x + 300, run.player.pos.y), new Rng(1));
    run.world.spawn(square);
    run.tick();
    applyDamage(run.world, square, 1000, run.player);
    return run.xpSparks.length;
  };
  assert.equal(kill([]), 0);
  assert.equal(kill([['scholar', 1]]), 1);
});

test('motes leave the simulation exactly as it would have been', () => {
  // The same seed and inputs twice, once with every mote dropped on the floor.
  // Lifesteal and Field Repair both make motes; if either reached the world's
  // random stream or moved anything, the two runs would come apart.
  const play = (dropMotes: boolean): string => {
    const run = new Run({ seed: 99, difficulty: 'normal', color: '#00B2E1' });
    for (const id of ['lifesteal', 'field-repair', 'harvest']) {
      run.takeCard({ kind: 'perk', perk: PERKS.find((p) => p.id === id)! });
    }
    if (dropMotes) run.world.addMote = () => {};
    for (let i = 0; i < 300; i++) {
      run.applyIntent(intent({ fire: true }), (i * 0.05) % (Math.PI * 2));
      run.tick();
      while (run.waitingOnChoice) {
        const next = run.pendingChoices[0]!;
        const hand = next === 'class' ? [] : run.dealHand();
        if (hand.length) run.takeCard(hand[0]!);
        else run.consumeChoice(next);
      }
    }
    const p = run.player;
    return JSON.stringify([
      p.pos.x.toFixed(6), p.pos.y.toFixed(6), p.health.toFixed(6),
      run.score, run.world.entities.length, run.world.rng.next(),
    ]);
  };
  assert.equal(play(false), play(true));
});

test('the new body tells draw without error, at every stack', () => {
  const noop = (): void => {};
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : noop),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  const run = perked([]);
  for (const def of [getTank('tank'), getTank('smasher')]) {
    run.player.upgradeTo(def);
    for (const stacks of [1, 2, 3]) {
      const tells: PerkTell[] = [
        { id: 'bulwark', stacks, gauge: [] },
        { id: 'glass-cannon', stacks, gauge: [] },
        { id: 'dash', stacks, gauge: [stacks / 3] },
        { id: 'magnet', stacks, gauge: [] },
      ];
      for (const time of [0, 17.5, 999]) {
        drawPerkTellsUnder(ctx, run.player, run.player.pos, tells, time);
        drawPerkTellsOver(ctx, run.player, run.player.pos, tells, time);
      }
    }
  }
});
