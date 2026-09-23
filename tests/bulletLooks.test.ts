/**
 * Bullet look tests.
 *
 * The marks on a bullet read its `ProjectileMods`, so what matters is that the
 * mods say what the shot really is: Heavy Rounds leaves its stacks where the
 * renderer can see them, only the player's shots carry any mods at all, a
 * seeking shot keeps a short tail and nothing else does, and the charges that
 * Piercing and Ricochet count down are the ones actually being spent.
 *
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Run } from '../src/sim/run.ts';
import { Shape } from '../src/sim/shape.ts';
import { Tank, idleIntent, type Controller } from '../src/sim/tank.ts';
import { Bullet, TRAIL_LENGTH, noMods } from '../src/sim/projectiles.ts';
import { PERKS } from '../src/sim/perkImpl.ts';
import { drawMarkedBullet, hasMarks, noseLength } from '../src/render/bulletLooks.ts';
import { getTank } from '../src/data/tanks.ts';
import { vec } from '../src/core/math.ts';
import type { Intent } from '../src/core/input.ts';

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

/** A run with the waves stopped and the arena empty, holding the given perks. */
function perked(perks: [string, number][]): Run {
  const run = new Run({ seed: 1234, difficulty: 'normal', color: '#00B2E1' });
  run.waves.halt();
  for (const e of run.world.entities) if (e instanceof Shape) e.alive = false;
  for (const [id, stacks] of perks) {
    const perk = PERKS.find((p) => p.id === id);
    assert.ok(perk, `no perk called ${id}`);
    for (let i = 0; i < stacks; i++) run.takeCard({ kind: 'perk', perk });
  }
  return run;
}

const playerShots = (run: Run): Bullet[] =>
  run.world.entities.filter((e): e is Bullet => e instanceof Bullet && e.rootOwner() === run.player);

/** Fires until one shot is out, then lets go of the trigger. */
function fireOnce(run: Run): Bullet {
  let guard = 0;
  while (!playerShots(run).length && guard++ < 20) {
    run.applyIntent(intent({ fire: true }), 0);
    run.tick();
  }
  const shot = playerShots(run)[0];
  assert.ok(shot, 'the tank fired something');
  return shot;
}

function ticks(run: Run, count: number): void {
  for (let i = 0; i < count; i++) {
    run.applyIntent(intent(), 0);
    run.tick();
  }
}

test('a Heavy Rounds shot carries its stacks where the renderer can see them', () => {
  assert.equal(fireOnce(perked([])).mods.heavy, 0);
  const shot = fireOnce(perked([['heavy-rounds', 3]]));
  assert.equal(shot.mods.heavy, 3);
  assert.ok(hasMarks(shot), 'and so it is drawn with marks');
});

test('only the player’s shots carry mods, so enemy fire is never marked', () => {
  const run = perked([['heavy-rounds', 2], ['pierce', 1], ['explosive', 1]]);
  const trigger: Controller = { tick: () => ({ ...idleIntent(), fire: true }) };
  const enemy = new Tank(getTank('twin'), 20, trigger, '#F14E54');
  enemy.team = 'enemy';
  enemy.pos = vec(run.player.pos.x + 900, run.player.pos.y + 900);
  enemy.prevPos = vec(enemy.pos.x, enemy.pos.y);
  run.world.spawn(enemy);
  ticks(run, 30);

  const theirs = run.world.entities.filter((e): e is Bullet => e instanceof Bullet && e.rootOwner() === enemy);
  assert.ok(theirs.length > 0, 'the enemy should have fired');
  for (const shot of theirs) {
    assert.deepEqual(shot.mods, noMods(), 'an enemy shot has no perks behind it');
    assert.equal(hasMarks(shot), false);
  }
});

test('a seeking shot keeps a short tail, and a plain one keeps none', () => {
  const plain = perked([]);
  const plainShot = fireOnce(plain);
  ticks(plain, 10);
  assert.equal(plainShot.trail.length, 0);

  const run = perked([['homing', 1]]);
  const shot = fireOnce(run);
  const start = shot.trail.length;
  ticks(run, 3);
  assert.equal(shot.trail.length, start + 3, 'one point per tick while it flies');
  ticks(run, 10);
  assert.equal(shot.trail.length, TRAIL_LENGTH, 'and never more than the tail holds');
  const [newest, next] = [shot.trail[0]!, shot.trail[1]!];
  assert.notDeepEqual(newest, next, 'each point is a different place');
});

test('the charges Piercing and Ricochet count down are the ones being spent', () => {
  const run = perked([['pierce', 2]]);
  const shot = fireOnce(run);
  assert.equal(shot.mods.pierce, 2);
  const fresh = noseLength(shot.radius, shot.mods.pierce);
  shot.damage(shot.maxHealth * 4);
  assert.equal(shot.mods.pierce, 1, 'a killing blow spends a charge instead');
  assert.ok(shot.alive);
  assert.ok(noseLength(shot.radius, shot.mods.pierce) < fresh, 'and the nose it draws gets shorter');
  assert.equal(noseLength(shot.radius, 0), 0, 'with no charges left there is no nose');

  const bouncing = perked([['ricochet', 2]]);
  const ball = fireOnce(bouncing);
  assert.equal(ball.mods.bounces, 2);
  // Put it just short of the right-hand wall, flying at it.
  const wall = bouncing.world.inset(ball.radius).x;
  ball.pos = vec(wall - 1, ball.pos.y);
  ball.prevPos = vec(ball.pos.x, ball.pos.y);
  ticks(bouncing, 3);
  assert.equal(ball.mods.bounces, 1, 'hitting a wall spends a bounce');
  assert.ok(ball.alive, 'and the shot carries on');
});

test('every mark draws without error, alone and all together', () => {
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

  const all: [string, number][] = [
    ['pierce', 3],
    ['ricochet', 2],
    ['homing', 3],
    ['explosive', 3],
    ['heavy-rounds', 4],
    ['split-shot', 2],
  ];
  const sets: [string, number][][] = [...all.map((p) => [[p[0], 1]] as [string, number][]), all];
  for (const perks of sets) {
    const run = perked(perks);
    const shot = fireOnce(run);
    ticks(run, 4);
    assert.ok(hasMarks(shot), `${perks.map((p) => p[0]).join('+')} should mark the shot`);
    drawMarkedBullet(ctx, shot, shot.pos, shot.angle, shot.deathColor, 1.5);
  }
});
