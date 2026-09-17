/**
 * Simulation tests.
 *
 * The simulation never touches the DOM, so it runs in Node exactly as it runs in
 * the browser. That makes the numbers checkable: rather than eyeballing whether
 * a square "feels" like it takes two shots, we count the ticks.
 *
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Run } from '../src/sim/run.ts';
import { Tank } from '../src/sim/tank.ts';
import { Shape } from '../src/sim/shape.ts';
import { Bullet } from '../src/sim/projectiles.ts';
import { getTank } from '../src/data/tanks.ts';
import { TANKS } from '../src/data/tanks.ts';
import { XP_TABLE, MAX_LEVEL, CARD_LEVELS, bodyRadius } from '../src/data/leveling.ts';
import { emptyStats, deriveProjectileStats, barrelReloadTicks } from '../src/sim/stats.ts';
import { PERKS } from '../src/sim/perkImpl.ts';
import { statReadouts } from '../src/render/statColumn.ts';
import { vec } from '../src/core/math.ts';
import { Rng } from '../src/core/rng.ts';
import type { Intent } from '../src/core/input.ts';

const makeRun = (): Run => new Run({ seed: 1234, difficulty: 'normal', color: '#00B2E1' });

/** A run with the waves stopped, for tests about one mechanic at a time. */
function quietRun(): Run {
  const run = makeRun();
  run.waves.halt();
  for (const e of run.world.entities) if (e instanceof Shape) e.alive = false;
  return run;
}

const intent = (over: Partial<Intent> = {}): Intent => ({
  move: vec(),
  aimAngle: 0,
  aimWorld: vec(1000, 0),
  fire: false,
  secondary: false,
  autoFire: false,
  autoSpin: false,
  ...over,
});

/** Runs the simulation forward, feeding the same input every tick. */
function advance(run: Run, ticks: number, input: Intent = intent(), aim = 0): void {
  for (let i = 0; i < ticks; i++) {
    run.applyIntent(input, aim);
    run.tick();
  }
}

const bulletsIn = (run: Run): Bullet[] =>
  run.world.entities.filter((e): e is Bullet => e instanceof Bullet);

// --- Data ------------------------------------------------------------------

test('the roster is the classic fifty tanks', () => {
  assert.equal(TANKS.length, 50);
  const tiers = [1, 2, 3, 4].map((t) => TANKS.filter((d) => d.tier === t).length);
  assert.deepEqual(tiers, [1, 4, 12, 33]);
});

test('every upgrade edge resolves in both directions', () => {
  for (const def of TANKS) {
    for (const childId of def.upgradesTo) {
      const child = getTank(childId);
      assert.ok(
        child.upgradesFrom.includes(def.id),
        `${def.id} -> ${childId} is missing its reverse edge`,
      );
      assert.ok(child.tier > def.tier, `${childId} should outrank ${def.id}`);
    }
  }
});

test('the multi-parent tanks keep all their parents', () => {
  assert.deepEqual(getTank('quad-tank').upgradesFrom.sort(), ['flank-guard', 'twin']);
  assert.deepEqual(getTank('battleship').upgradesFrom.sort(), ['overseer', 'twin-flank']);
  assert.deepEqual(getTank('gunner-trapper').upgradesFrom.sort(), ['gunner', 'trapper']);
});

test('the tier-skipping tanks hang off shallow parents', () => {
  assert.deepEqual(getTank('smasher').upgradesFrom, ['tank']);
  assert.equal(getTank('smasher').unlockLevel, 30);
  assert.deepEqual(getTank('sprayer').upgradesFrom, ['machine-gun']);
  assert.equal(getTank('sprayer').unlockLevel, 45);
  assert.deepEqual(getTank('auto-tank').upgradesFrom, ['tank']);
  assert.equal(getTank('auto-tank').unlockLevel, 45);
});

test('the Smasher line drops the projectile stats and raises the rest', () => {
  const smasher = getTank('smasher');
  assert.deepEqual(smasher.hiddenStats?.sort(), [
    'bulletDamage',
    'bulletPen',
    'bulletSpeed',
    'reload',
  ]);
  assert.equal(smasher.statCaps?.maxHealth, 10);
  // Auto Smasher is the exception: it keeps all eight, all raised.
  const auto = getTank('auto-smasher');
  assert.equal(auto.hiddenStats, undefined);
  assert.equal(auto.statCaps?.bulletDamage, 10);
});

test('the Overseer branch renames its projectile stats', () => {
  assert.equal(getTank('overlord').statNames?.bulletDamage, 'Drone Damage');
  assert.equal(getTank('necromancer').statNames?.reload, 'Drone Count');
});

// --- Levelling -------------------------------------------------------------

test('levels arrive on the published experience table', () => {
  const run = makeRun();
  assert.equal(run.level, 1);
  run.addXp(3);
  assert.equal(run.level, 1, 'three experience is one short of level two');
  run.addXp(1);
  assert.equal(run.level, 2, 'level two costs four experience');
  run.addXp(XP_TABLE[15]! - run.xp);
  assert.equal(run.level, 15);
});

test('a level-up queues exactly the choices it earns', () => {
  const run = makeRun();
  run.addXp(4);
  assert.deepEqual(run.pendingChoices, ['card'], 'level two pays a card');

  const fresh = makeRun();
  fresh.addXp(XP_TABLE[15]!);
  // Levels 2 to 15 pay fourteen cards. Level 15 also opens the class choice,
  // queued ahead of its own card so the card can be spent on the new tank.
  assert.equal(fresh.pendingChoices.filter((c) => c === 'card').length, 14);
  const classAt = fresh.pendingChoices.indexOf('class');
  assert.equal(classAt, fresh.pendingChoices.length - 2);
  assert.equal(fresh.pendingChoices[classAt + 1], 'card');
});

test('cards are paid at thirty-three levels, as diep.io pays stat points', () => {
  assert.equal(CARD_LEVELS.size, 33);
  assert.ok(CARD_LEVELS.has(2) && CARD_LEVELS.has(28) && CARD_LEVELS.has(45));
  assert.ok(!CARD_LEVELS.has(29), 'level 29 pays nothing');
  assert.ok(!CARD_LEVELS.has(31), 'past 28 only every third level pays');
});

test('a tank grows one percent per level', () => {
  const run = makeRun();
  const start = run.player.radius;
  run.addXp(XP_TABLE[MAX_LEVEL]!);
  assert.equal(run.level, MAX_LEVEL);
  const expected = bodyRadius(MAX_LEVEL) / bodyRadius(1);
  assert.ok(Math.abs(run.player.radius / start - expected) < 1e-9);
  assert.ok(run.player.radius > start * 1.5);
});

// --- Firing ----------------------------------------------------------------

test('the Basic Tank fires on its published reload', () => {
  const run = makeRun();
  const period = barrelReloadTicks(emptyStats(), getTank('tank').barrels[0]!);
  assert.equal(Math.round(period), 15, 'fifteen ticks is six tenths of a second');

  // A barrel starts loaded, so the first shot leaves on the first tick. It
  // becomes visible one tick later, when the spawn queue is admitted.
  advance(run, 2, intent({ fire: true }));
  assert.equal(bulletsIn(run).length, 1, 'the first shot leaves immediately');
  advance(run, 13, intent({ fire: true }));
  assert.equal(bulletsIn(run).length, 1, 'still reloading');
  advance(run, 2, intent({ fire: true }));
  assert.equal(bulletsIn(run).length, 2, 'the second arrives fifteen ticks later');
});

test('firing shoves the tank backwards', () => {
  const run = makeRun();
  run.player.pos = vec(0, 0);
  // Aim right, so recoil should push left.
  advance(run, 2, intent({ fire: true }), 0);
  assert.ok(run.player.vel.x < 0, `recoil should be leftward, got ${run.player.vel.x}`);
});

test("Twin's two barrels alternate rather than firing together", () => {
  const run = makeRun();
  run.player.upgradeTo(getTank('twin'));
  const period = barrelReloadTicks(emptyStats(), getTank('twin').barrels[0]!);

  advance(run, 2, intent({ fire: true }));
  assert.equal(bulletsIn(run).length, 1, 'one barrel leads');
  // The second barrel starts half a period short of ready, so it follows.
  advance(run, Math.ceil(period / 2), intent({ fire: true }));
  assert.equal(bulletsIn(run).length, 2, 'the other follows half a cycle later');
});

test('Triple Shot fires all three barrels at once', () => {
  const run = makeRun();
  run.player.upgradeTo(getTank('triple-shot'));
  advance(run, 2, intent({ fire: true }));
  assert.equal(bulletsIn(run).length, 3);
});

test('bullets expire rather than leaving the arena', () => {
  const run = makeRun();
  run.world.arena = { halfSize: 300, targetHalfSize: 300 };
  run.player.pos = vec(0, 0);
  advance(run, 2, intent({ fire: true }));
  assert.equal(bulletsIn(run).length, 1);
  advance(run, 40);
  assert.equal(bulletsIn(run).length, 0, 'the bullet should be gone');
});

// --- Damage and experience -------------------------------------------------

test('two Basic shots kill a square, and the kill pays what a square is worth', () => {
  const run = makeRun();
  // A still arena, so only the square under test can be hit or killed.
  run.waves.halt();
  for (const e of run.world.entities) if (e instanceof Shape) e.alive = false;
  run.tick();

  run.player.pos = vec(0, 0);
  const square = new Shape('square', vec(260, 0), new Rng(7));
  run.world.spawn(square);
  assert.equal(square.maxHealth, 10);

  const stats = deriveProjectileStats(emptyStats(), getTank('tank').barrels[0]!, 1);
  assert.equal(stats.damage, 7, 'a Basic bullet does seven damage');

  advance(run, 60, intent({ fire: true }), 0);

  assert.equal(square.alive, false, 'the square should be destroyed');
  // Score is the raw value so runs stay comparable between difficulties, while
  // experience carries the difficulty bonus that keeps the easy setting easy.
  assert.equal(run.score, 10, 'a square is worth ten points');
  assert.equal(run.xp, 10 * run.difficulty.xpBonus, 'and ten experience before the bonus');
});

test('a pentagon survives far longer than a square', () => {
  const run = quietRun();
  run.tick();
  const pentagon = new Shape('pentagon', vec(300, 0), new Rng(9));
  run.world.spawn(pentagon);
  run.player.pos = vec(0, 0);

  advance(run, 60, intent({ fire: true }), 0);
  assert.ok(pentagon.health < pentagon.maxHealth, 'it should be taking hits');
  assert.equal(pentagon.alive, true, 'one hundred health is not falling in sixty ticks');
});

test('shapes damage the player on contact', () => {
  const run = makeRun();
  const before = run.player.health;
  const triangle = new Shape('triangle', vec(30, 0), new Rng(3));
  run.world.spawn(triangle);
  advance(run, 5);
  assert.ok(run.player.health < before, 'ramming a triangle should hurt');
});

test('a killed player ends the run once the explosion finishes', () => {
  const run = makeRun();
  run.player.health = 1;
  run.player.damage(5);
  run.world.events.emit('entityKilled', { victim: run.player, killer: null });
  assert.equal(run.player.alive, false);
  assert.equal(run.over, false, 'the run lingers so the explosion can play');
  advance(run, 45);
  assert.equal(run.over, true);
});

// --- Movement --------------------------------------------------------------

test('a tank accelerates toward a terminal speed, not past it', () => {
  const run = makeRun();
  // Room to run: otherwise the far wall stops it before it tops out.
  run.world.arena = { halfSize: 40000, targetHalfSize: 40000 };
  run.player.pos = vec(0, 0);
  const input = intent({ move: vec(1, 0) });
  advance(run, 120, input, 0);

  // Measure ground covered rather than the velocity field, which is sampled
  // after friction has already been taken off and so reads a tenth low.
  const from = run.player.pos.x;
  advance(run, 10, input, 0);
  const perTick = (run.player.pos.x - from) / 10;
  const terminal = run.player.derived.acceleration * 10;

  assert.ok(perTick > terminal * 0.98, `expected about ${terminal}, covered ${perTick}`);
  assert.ok(perTick <= terminal * 1.01, `should not exceed ${terminal}, covered ${perTick}`);
});

test('a tank reaches most of its speed within half a second', () => {
  const run = makeRun();
  run.world.arena = { halfSize: 40000, targetHalfSize: 40000 };
  const input = intent({ move: vec(1, 0) });
  // Twelve ticks is a little under half a second at the 25 Hz simulation rate.
  advance(run, 12, input, 0);
  const speed = Math.hypot(run.player.vel.x, run.player.vel.y);
  const terminal = run.player.derived.acceleration * 9;
  assert.ok(speed > terminal * 0.7, `sluggish: ${speed} of ${terminal}`);
});

test('a tank coasts to a halt after the keys are released', () => {
  const run = makeRun();
  run.world.arena = { halfSize: 40000, targetHalfSize: 40000 };
  advance(run, 40, intent({ move: vec(1, 0) }), 0);
  const top = Math.hypot(run.player.vel.x, run.player.vel.y);
  assert.ok(top > 20, `expected to be up to speed, got ${top}`);

  // Ten percent goes every tick, so momentum is mostly spent inside a second
  // but the last of it trails off. That slide is the feel we are matching.
  advance(run, 20, intent(), 0);
  const drifting = Math.hypot(run.player.vel.x, run.player.vel.y);
  assert.ok(drifting < top * 0.15, `should have shed most speed, at ${drifting}`);

  advance(run, 80, intent(), 0);
  assert.equal(run.player.vel.x, 0, 'and eventually stop dead');
});

test('the arena wall stops the player', () => {
  const run = makeRun();
  run.world.arena = { halfSize: 500, targetHalfSize: 500 };
  advance(run, 200, intent({ move: vec(1, 0) }), 0);
  assert.ok(
    run.player.pos.x <= 500 - run.player.radius + 0.001,
    `player at ${run.player.pos.x} escaped the wall`,
  );
});

// --- Class upgrades --------------------------------------------------------

test('upgrading rebuilds the barrels and refunds stranded points', () => {
  const run = makeRun();
  run.addXp(XP_TABLE[30]!);
  assert.equal(run.player.def.barrels.length, 1);

  run.player.points.bulletDamage = 5;
  run.player.points.maxHealth = 2;
  const refunded = run.player.upgradeTo(getTank('smasher'));

  assert.equal(run.player.def.barrels.length, 0, 'Smasher has no barrels');
  assert.equal(run.player.points.bulletDamage, 0, 'a dropped stat is zeroed');
  assert.equal(run.player.points.maxHealth, 2, 'a kept stat is untouched');
  assert.equal(refunded, 5, 'the five stranded points come back');
});

test('the class offer is gated on level', () => {
  const run = makeRun();
  run.addXp(XP_TABLE[15]!);
  const atFifteen = run.classOptions();
  assert.deepEqual(atFifteen.sort(), ['flank-guard', 'machine-gun', 'sniper', 'twin']);
  assert.ok(!atFifteen.includes('smasher'), 'Smasher waits for level thirty');

  run.addXp(XP_TABLE[30]! - run.xp);
  assert.ok(run.classOptions().includes('smasher'));
});

test('a tank with a wider field factor sees more of the arena', () => {
  const basic = new Tank(getTank('tank'), 45, { tick: () => ({ moveX: 0, moveY: 0, aimAngle: 0, fire: false, secondary: false }) }, '#fff');
  const ranger = new Tank(getTank('ranger'), 45, { tick: () => ({ moveX: 0, moveY: 0, aimAngle: 0, fire: false, secondary: false }) }, '#fff');
  assert.ok(ranger.fieldOfView() < basic.fieldOfView(), 'a lower field of view shows more');
});

// --- Determinism -----------------------------------------------------------

test('the same seed produces the same run', () => {
  const positions = (seed: number): string => {
    const run = new Run({ seed, difficulty: 'normal', color: '#fff' });
    advance(run, 50, intent({ move: vec(1, 0.4), fire: true }), 0.3);
    return run.world.entities
      .map((e) => `${e.constructor.name}:${e.pos.x.toFixed(3)},${e.pos.y.toFixed(3)}`)
      .join('|');
  };
  assert.equal(positions(99), positions(99), 'one seed, one outcome');
  assert.notEqual(positions(99), positions(100), 'different seeds should diverge');
});

test('turning down a class keeps the offer open until the next tier', () => {
  const run = makeRun();
  run.addXp(XP_TABLE[15]!);
  assert.equal(run.nextClassLevel(), 30, 'the next chance is level thirty');

  // Refusing at fifteen is how Smasher is reached, so it must cost nothing now.
  run.consumeChoice('class');
  assert.equal(run.player.def.id, 'tank');

  run.addXp(XP_TABLE[30]! - run.xp);
  const options = run.classOptions();
  assert.ok(options.includes('smasher'), 'staying Basic is what unlocks Smasher');
  assert.ok(options.includes('twin'), 'and the ordinary choices are still there');
  assert.equal(run.nextClassLevel(), 45);
});

test('the level key advances exactly one level', () => {
  const run = makeRun();
  run.debugGrantLevel();
  assert.equal(run.level, 2);
  run.debugGrantLevel();
  assert.equal(run.level, 3);
  for (let i = 0; i < 60; i++) run.debugGrantLevel();
  assert.equal(run.level, MAX_LEVEL, 'and stops at the cap');
});


// --- Perks reaching the simulation -----------------------------------------

/**
 * The shot a tank fires with these perks taken.
 *
 * Perks hook the simulation in two places that no event passes through: the
 * stats a projectile is built with, and the stats a tank derives. Both were
 * unreachable once, and nothing above would have noticed.
 */
function firstShot(perkIds: string[]): Bullet {
  const run = quietRun();
  for (const id of perkIds) {
    const perk = PERKS.find((p) => p.id === id);
    if (!perk) throw new Error(`no perk called ${id}`);
    run.takeCard({ kind: 'perk', perk });
  }
  advance(run, 3, intent({ fire: true }));
  const bullet = bulletsIn(run)[0];
  assert.ok(bullet, 'the tank fired something');
  return bullet;
}

test('a bullet perk reaches the shot it modifies', () => {
  const plain = firstShot([]);
  const buffed = firstShot(['heavy-rounds', 'pierce', 'homing', 'ricochet']);

  assert.equal(buffed.contactDamage, plain.contactDamage * 1.25, 'Heavy Rounds hits harder');
  assert.equal(buffed.maxHealth, plain.maxHealth * 1.5, 'Piercing Rounds survives longer');
  assert.ok(buffed.mods.homing > 0, 'Seeking Rounds steers');
  assert.equal(buffed.mods.bounces, 1, 'Ricochet bounces once');
  assert.equal(buffed.mods.pierce, 1, 'and one enemy may be passed through');
});

test('a piercing charge carries a shot through a killing blow', () => {
  const shot = firstShot(['pierce']);
  const full = shot.maxHealth;

  assert.equal(shot.damage(full * 4), false, 'the charge is spent instead of the shot');
  assert.ok(shot.alive);
  assert.equal(shot.mods.pierce, 0);
  assert.equal(shot.health, full, 'and it leaves the enemy whole');

  assert.equal(shot.damage(full * 4), true, 'with no charges left it breaks up');
  assert.equal(shot.alive, false);
});

test('a perk that changes reload reaches the barrels', () => {
  const plain = quietRun();
  advance(plain, 26, intent({ fire: true }));
  assert.equal(bulletsIn(plain).length, 2, 'two shots on the usual fifteen-tick period');

  // Counted rather than calculated: the point of this hook is that the barrel
  // itself asks, and a formula agreeing with a formula would not show that.
  const hasted = quietRun();
  hasted.perks.add({
    id: 'test-autoloader',
    stacks: 1,
    modifyStats: (stats) => {
      stats.reloadScale *= 0.5;
    },
  });
  hasted.player.refresh();

  advance(hasted, 26, intent({ fire: true }));
  assert.equal(bulletsIn(hasted).length, 4, 'twice as many once the period is halved');
});

test('a stat perk reaches the tank it belongs to', () => {
  const run = quietRun();
  const before = run.player.maxHealth;
  run.perks.add({
    id: 'test-plating',
    stacks: 1,
    modifyStats: (stats) => {
      stats.maxHealth *= 2;
    },
  });

  run.player.refresh();
  assert.equal(run.player.maxHealth, before * 2);
});


// --- The stat column -------------------------------------------------------

const readout = (run: Run, key: string) => {
  const row = statReadouts(run.player).find((r) => r.key === key);
  assert.ok(row, `the column lists ${key}`);
  return row;
};

test('the stat column reports what the points actually bought', () => {
  const run = quietRun();
  const fresh = readout(run, 'bulletDamage');
  assert.equal(fresh.points, 0);
  assert.equal(fresh.gainFraction, 0, 'nothing spent is nothing gained');

  // Bullet damage is 7 + 3 a point, so three points is sixteen.
  run.player.points.bulletDamage = 3;
  run.player.refresh();
  const spent = readout(run, 'bulletDamage');
  assert.equal(spent.points, 3);
  assert.ok(Math.abs(spent.gainFraction - (16 / 7 - 1)) < 1e-9, 'and the gain says so');
});

test('the stat column counts perks as well as points', () => {
  const run = quietRun();
  const perk = PERKS.find((p) => p.id === 'heavy-rounds');
  assert.ok(perk);
  run.takeCard({ kind: 'perk', perk });

  // A quarter more damage, bought with no points at all.
  assert.ok(Math.abs(readout(run, 'bulletDamage').gainFraction - 0.25) < 1e-9);
  assert.equal(readout(run, 'bulletDamage').points, 0);
});

test('the stat column drops the stats a tank does not have', () => {
  const run = quietRun();
  assert.equal(statReadouts(run.player).length, 8);

  // The Smasher line trades every gun for a shell, and its four bullet stats
  // with them. Listing stats that cannot be raised would be a lie.
  run.upgradeTo('smasher');
  const keys = statReadouts(run.player).map((r) => r.key);
  assert.equal(keys.length, 4);
  assert.ok(!keys.includes('bulletDamage'));
  assert.ok(keys.includes('bodyDamage'));
});
