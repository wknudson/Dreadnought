/**
 * Arena modifiers: what the map does to a boss wave.
 *
 * Most of these guard a rule rather than a behaviour. Which waves may draw, that
 * a run never draws the same one twice, and that a modified wave buys fewer
 * enemies instead of the same enemies plus walls, are all decisions that a later
 * change could quietly undo while everything still ran.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Run } from '../src/sim/run.ts';
import { Shape } from '../src/sim/shape.ts';
import { Rng } from '../src/core/rng.ts';
import { vec } from '../src/core/math.ts';
import { TICKS_PER_SECOND } from '../src/core/loop.ts';
import {
  MODIFIERS,
  MODIFIED_WAVES,
  rollModifiers,
  type PendingMeteor,
} from '../src/sim/modifiers.ts';
import {
  BOSS_INTERVAL,
  DIFFICULTIES,
  FINAL_WAVE,
  generateWave,
  type WaveDef,
} from '../src/data/waves.ts';

const makeRun = (seed = 5): Run => new Run({ seed, difficulty: 'normal', color: '#00B2E1' });

/** Drives a run far enough for the wave layer to settle. */
function settle(run: Run, ticks = 2): void {
  for (let i = 0; i < ticks; i++) run.tick();
}

test('modifiers land on the middle boss waves and nowhere else', () => {
  for (let wave = 1; wave <= FINAL_WAVE; wave++) {
    const run = makeRun();
    run.waves.jumpTo(wave);
    settle(run);
    assert.equal(
      run.modifierName !== null,
      MODIFIED_WAVES.includes(wave),
      `wave ${wave} drew ${run.modifierName ?? 'nothing'}`,
    );
  }
});

test('the first boss is never modified, and the last keeps its own arena', () => {
  // Wave five is a player who has only just picked a class, and the run's own
  // history says something new there ends a quarter of runs on that wave alone.
  assert.ok(!MODIFIED_WAVES.includes(BOSS_INTERVAL), 'the first boss must be clean');
  // Wave twenty-five has the authored fight; a second arena would argue with it.
  assert.ok(!MODIFIED_WAVES.includes(FINAL_WAVE), 'the last boss has its own arena');
});

test('a run draws each modifier at most once', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const drawn = [...rollModifiers(new Rng(seed)).values()];
    assert.equal(drawn.length, MODIFIED_WAVES.length, `seed ${seed} drew ${drawn.length}`);
    assert.equal(new Set(drawn).size, drawn.length, `seed ${seed} repeated: ${drawn.join()}`);
  }
});

test('a seed draws the same modifiers every time', () => {
  const drawn = (seed: number): string[] =>
    MODIFIED_WAVES.map((wave) => {
      const run = makeRun(seed);
      run.waves.jumpTo(wave);
      settle(run);
      return run.modifierName ?? '';
    });
  assert.deepEqual(drawn(7), drawn(7));
  assert.ok(drawn(7).every((name) => name !== ''), 'every modified wave should name one');
});

test('a modified wave buys fewer enemies rather than the same plus walls', () => {
  const enemies = (wave: WaveDef): number =>
    wave.groups.reduce((total, group) => total + group.count, 0);

  for (const modifier of MODIFIERS) {
    assert.ok(
      modifier.budgetShare > 0 && modifier.budgetShare < 0.5,
      `${modifier.id} asks for ${modifier.budgetShare} of the wave, which is not a share`,
    );
    const plain = enemies(generateWave(10, DIFFICULTIES.normal, new Rng(3), 1));
    const paid = enemies(generateWave(10, DIFFICULTIES.normal, new Rng(3), 1 - modifier.budgetShare));
    assert.ok(paid <= plain, `${modifier.id} cost the wave nothing: ${paid} v ${plain}`);
  }
});

test('the crush closes the arena, and not to nothing', () => {
  const crush = MODIFIERS.find((m) => m.id === 'crush')!;
  const opened = crush.shape!(1000, 0);
  const closed = crush.shape!(1000, TICKS_PER_SECOND * 60);
  assert.ok(closed.x < opened.x, `expected closing, got ${closed.x} from ${opened.x}`);
  assert.ok(closed.x > 200, `closed too far, ${closed.x}`);
});

test('the tide leans both ways without ever growing the arena', () => {
  const tide = MODIFIERS.find((m) => m.id === 'tide')!;
  const widths: number[] = [];
  const heights: number[] = [];
  for (let t = 0; t < TICKS_PER_SECOND * 30; t += 5) {
    const shape = tide.shape!(1000, t);
    widths.push(shape.x);
    heights.push(shape.y);
  }

  // It changes shape rather than just size: each axis leads at some point.
  assert.ok(Math.max(...widths) > Math.min(...widths) * 1.3, 'the tide should lean');
  assert.ok(Math.max(...heights) > Math.min(...heights) * 1.3, 'on both axes');

  // And never hands room back beyond the square the wave would have had. A wall
  // that grows un-corners a player who is being chased, and the arena running
  // out of room is what ends a fight against a build that kites.
  assert.ok(Math.max(...widths) <= 1000, `the tide grew the arena to ${Math.max(...widths)}`);
  assert.ok(Math.max(...heights) <= 1000, `the tide grew the arena to ${Math.max(...heights)}`);
});

test('the tide stops moving once a wave has overstayed', () => {
  const tide = MODIFIERS.find((m) => m.id === 'tide')!;
  // Past the director's patience it must be still, or a fight that is already
  // running long keeps being handed somewhere new to retreat to.
  const late = [50, 60, 75, 90, 120].map((seconds) =>
    tide.shape!(1000, TICKS_PER_SECOND * seconds),
  );
  for (const shape of late) {
    assert.equal(shape.x, late[0]!.x, 'the settled tide should not move');
    assert.equal(shape.x, shape.y, 'and should be square');
  }
  assert.ok(late[0]!.x < 1000, 'it settles narrow rather than back at full size');
});

test('a meteor waits before it lands, then hurts what it lands on', () => {
  const run = makeRun();
  const meteors = MODIFIERS.find((m) => m.id === 'meteors')!;
  const pending: PendingMeteor[] = [];
  const base = {
    world: run.world,
    player: run.player,
    rng: new Rng(4),
    wave: 10,
    damageScale: 1,
    warnings: [],
    meteors: pending,
  };

  // One interval brings a meteor, and it must still be in the air.
  for (let t = 1; t <= TICKS_PER_SECOND * 4; t++) meteors.tick!({ ...base, ticks: t });
  assert.equal(pending.length, 1, 'a meteor should be waiting rather than landed');

  const at = { ...pending[0]!.at };
  const victim = new Shape('square', vec(at.x, at.y), new Rng(1));
  run.world.spawn(victim);
  run.tick();
  const before = victim.health;

  // Past its warning, it lands.
  for (let t = 1; t <= TICKS_PER_SECOND * 2; t++) meteors.tick!({ ...base, ticks: 1000 + t });
  assert.ok(victim.health < before, `a meteor should hurt what it lands on, ${victim.health}`);
});

test('a cleared wave leaves the arena square and nothing in the air', () => {
  const run = makeRun();
  // A level-one tank does not survive the wave-ten boss, and this is about what
  // the wave layer leaves behind rather than about winning the fight.
  run.player.incomingDamageScale = 0;
  run.waves.jumpTo(MODIFIED_WAVES[0]!);

  // The boss arrives behind a warning ring, and the wave is not clearable until
  // everything it means to send has actually been sent.
  for (let i = 0; i < 600 && run.waves.remaining === 0; i++) settle(run, 1);
  settle(run, TICKS_PER_SECOND);
  assert.ok(run.modifierName, 'the wave should have drawn one');

  // Killed as it arrives rather than once: a wave releases its groups over time,
  // so a single sweep just clears the field for the next batch.
  for (let i = 0; i < 2000 && run.waves.phase !== 'breather'; i++) {
    for (const e of run.world.entities) if (e.team === 'enemy') e.alive = false;
    settle(run, 1);
  }
  assert.equal(run.waves.phase, 'breather', 'the wave never cleared');

  assert.equal(run.modifierName, null, 'a cleared wave keeps no modifier');
  const target = run.world.arena.targetHalf;
  assert.equal(target.x, target.y, `the breather should be square, got ${target.x}x${target.y}`);
  assert.equal(run.waves.warnings().length, 0, 'no meteor should outlive its wave');
});
