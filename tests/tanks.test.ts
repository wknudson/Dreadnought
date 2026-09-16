/**
 * The non-bullet tanks: drones, traps, turrets, missiles, minions and the
 * Smasher line. Each has behaviour a screenshot cannot confirm, so it is
 * measured here instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Run } from '../src/sim/run.ts';
import { Shape } from '../src/sim/shape.ts';
import { Projectile } from '../src/sim/projectiles.ts';
import { getTank } from '../src/data/tanks.ts';
import { Rng } from '../src/core/rng.ts';
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

/** A run as the given class, at max level, in an arena cleared of stray shapes. */
function runAs(tankId: string, seed = 7): Run {
  const run = new Run({ seed, difficulty: 'normal', color: '#00B2E1' });
  // A still arena: these tests are about one tank's weapons, not about surviving.
  run.waves.halt();
  for (const e of run.world.entities) if (e instanceof Shape) e.alive = false;
  run.addXp(30000);
  run.player.upgradeTo(getTank(tankId));
  run.player.pos = vec(0, 0);
  return run;
}

function advance(run: Run, ticks: number, input = intent(), aim = 0): void {
  for (let i = 0; i < ticks; i++) {
    run.applyIntent(input, aim);
    run.tick();
  }
}

const projectiles = (run: Run, kind?: string): Projectile[] =>
  run.world.entities.filter(
    (e): e is Projectile => e instanceof Projectile && (!kind || e.projectileKind === kind),
  );

// --- Drones ----------------------------------------------------------------

test('a drone tank builds up to its cap and no further', () => {
  const run = runAs('overlord');
  advance(run, 500);
  const drones = projectiles(run, 'drone');
  assert.equal(drones.length, 8, 'Overlord commands eight drones');

  advance(run, 200);
  assert.equal(projectiles(run, 'drone').length, 8, 'and does not exceed them');
});

test('a fleet wiped out is rebuilt', () => {
  const run = runAs('overlord');
  advance(run, 500);
  assert.equal(projectiles(run, 'drone').length, 8);

  // Every drone dies at once, as it might against a boss.
  for (const d of projectiles(run, 'drone')) d.alive = false;
  advance(run, 500);
  assert.equal(
    projectiles(run, 'drone').length,
    8,
    'losing the fleet must free the spawners that made it',
  );
});

test('drones fly to the cursor and away from it', () => {
  const run = runAs('overlord');
  advance(run, 500);
  const drones = projectiles(run, 'drone');
  assert.ok(drones.length > 0);

  advance(run, 150, intent({ fire: true, aimWorld: vec(1200, 0) }));
  const steered = drones.filter((d) => d.alive);
  const meanX = steered.reduce((s, d) => s + d.pos.x, 0) / steered.length;
  assert.ok(meanX > 700, `drones should gather at the cursor, mean x was ${meanX}`);

  advance(run, 150, intent({ secondary: true, aimWorld: vec(-1200, 0) }));
  const pushed = drones.filter((d) => d.alive);
  const meanX2 = pushed.reduce((s, d) => s + d.pos.x, 0) / pushed.length;
  assert.ok(meanX2 > meanX, `repelling should drive them the other way, got ${meanX2}`);
});

test('idle drones hold a loose ring around their owner', () => {
  const run = runAs('overseer');
  advance(run, 600);
  const drones = projectiles(run, 'drone');
  assert.ok(drones.length >= 4);
  for (const d of drones) {
    const distance = Math.hypot(d.pos.x, d.pos.y);
    assert.ok(distance < 700, `an idle drone wandered ${distance} away`);
  }
});

test('drones die with the tank that made them', () => {
  const run = runAs('overlord');
  advance(run, 400);
  assert.ok(projectiles(run, 'drone').length > 0);
  run.player.alive = false;
  advance(run, 5);
  assert.equal(projectiles(run, 'drone').length, 0);
});

// --- Necromancer -----------------------------------------------------------

test('a Necromancer raises the squares it kills, and they die like squares', () => {
  const run = runAs('necromancer');
  run.player.points.bodyDamage = 7;
  // Raised squares take damage in full, so at zero Drone Health they die to the
  // first thing they touch. Any real Necromancer invests here, so the test does.
  run.player.points.bulletPen = 7;
  run.player.refresh();

  for (let wave = 0; wave < 5; wave++) {
    // Re-centre first: ramming a square knocks the tank back, and the next one
    // has to appear within reach of it rather than where it used to be.
    run.player.pos = vec(0, 0);
    run.player.vel = vec(0, 0);
    run.world.spawn(new Shape('square', vec(40, 0), new Rng(wave)));
    advance(run, 25);
  }

  const raised = projectiles(run, 'necroDrone');
  assert.ok(raised.length >= 3, `expected a fleet, got ${raised.length}`);
  assert.equal(
    raised[0]!.incomingDamageScale,
    1,
    'a raised square takes full damage, unlike every other projectile',
  );
});

test('a tank that does not claim squares raises nothing', () => {
  const run = runAs('overlord');
  run.player.points.bodyDamage = 7;
  run.player.refresh();
  for (let wave = 0; wave < 4; wave++) {
    run.player.pos = vec(0, 0);
    run.player.vel = vec(0, 0);
    run.world.spawn(new Shape('square', vec(40, 0), new Rng(wave)));
    advance(run, 25);
  }
  assert.equal(projectiles(run, 'necroDrone').length, 0);
});

// --- Traps -----------------------------------------------------------------

test('traps are thrown a short way and then stay put', () => {
  const run = runAs('trapper');
  advance(run, 3, intent({ fire: true }));
  const trap = projectiles(run, 'trap')[0];
  assert.ok(trap, 'a trap should have been laid');

  advance(run, 60);
  const resting = vec(trap.pos.x, trap.pos.y);
  assert.ok(resting.x > 60, `the trap should carry forward, stopped at ${resting.x}`);

  advance(run, 60);
  const drift = Math.hypot(trap.pos.x - resting.x, trap.pos.y - resting.y);
  assert.ok(drift < 1, `a settled trap should not wander, moved ${drift}`);
  assert.equal(trap.alive, true, 'and it should still be there');
});

test('traps outlast the shots that placed them', () => {
  const run = runAs('trapper');
  advance(run, 200, intent({ fire: true }));
  const count = projectiles(run, 'trap').length;
  assert.ok(count >= 5, `a Trapper should accumulate traps, had ${count}`);
});

test('Tri-Trapper lays in three directions at once', () => {
  const run = runAs('tri-trapper');
  advance(run, 40, intent({ fire: true }));
  const traps = projectiles(run, 'trap');
  assert.ok(traps.length >= 3);
  // Three launchers 120 degrees apart put traps on every side of the tank.
  const bearings = traps.map((t) => Math.atan2(t.pos.y, t.pos.x));
  const spread = Math.max(...bearings) - Math.min(...bearings);
  assert.ok(spread > 2, `expected traps all round, bearings spanned ${spread}`);
});

// --- Turrets ---------------------------------------------------------------

test('an auto turret finds a target and shoots it without being aimed', () => {
  const run = runAs('auto-3');
  assert.equal(run.player.turrets.length, 3);

  // Something to shoot at, well off the direction the hull faces.
  run.world.spawn(new Shape('pentagon', vec(0, -400), new Rng(1)));
  advance(run, 60, intent({ fire: false }), 0);

  assert.ok(projectiles(run, 'bullet').length > 0, 'the turrets should have opened fire');
});

test('Auto 5 mounts five turrets, Auto Smasher one over its guard', () => {
  assert.equal(runAs('auto-5').player.turrets.length, 5);
  const smasher = runAs('auto-smasher');
  assert.equal(smasher.player.turrets.length, 1);
  assert.equal(smasher.player.def.barrels.length, 0, 'the hull itself has no guns');
});

test('turrets are rebuilt when the class changes', () => {
  const run = runAs('auto-3');
  assert.equal(run.player.turrets.length, 3);
  run.player.upgradeTo(getTank('auto-5'));
  assert.equal(run.player.turrets.length, 5);
  run.player.upgradeTo(getTank('tank'));
  assert.equal(run.player.turrets.length, 0);
});

// --- Missiles and minions --------------------------------------------------

test('a Skimmer missile spins and fires as it travels', () => {
  const run = runAs('skimmer');
  advance(run, 30, intent({ fire: true }));
  const missile = projectiles(run, 'skimmer')[0];
  assert.ok(missile, 'a missile should be in flight');

  const facing = missile.angle;
  advance(run, 20);
  assert.notEqual(missile.angle, facing, 'the missile should be spinning');
  assert.ok(projectiles(run, 'bullet').length > 0, 'and shedding bullets as it goes');
});

test('a Rocketeer rocket waits before lighting its thruster', () => {
  const run = runAs('rocketeer');
  advance(run, 3, intent({ fire: true }));
  const rocket = projectiles(run, 'rocket')[0];
  assert.ok(rocket, 'a rocket should be in flight');

  // The rocket has almost no speed of its own; the recoil of the thruster on its
  // tail is what drives it, and that only lights after a short delay.
  assert.equal(projectiles(run, 'bullet').length, 0, 'the thruster has not lit yet');

  advance(run, 25);
  assert.ok(projectiles(run, 'bullet').length > 0, 'and then it burns');

  // Once lit it keeps the rocket moving instead of letting friction stop it.
  const before = vec(rocket.pos.x, rocket.pos.y);
  advance(run, 12);
  const travelled = Math.hypot(rocket.pos.x - before.x, rocket.pos.y - before.y);
  assert.ok(travelled > 60, `the thruster should keep it going, moved ${travelled}`);
});

test('Factory minions carry guns of their own', () => {
  const run = runAs('factory');
  run.world.spawn(new Shape('pentagon', vec(500, 0), new Rng(2)));
  advance(run, 150, intent({ fire: true }));

  const minions = projectiles(run, 'minion');
  assert.ok(minions.length > 0, 'the factory should have built minions');
  assert.ok(minions[0]!.carriedDef, 'a minion is drawn as a tank, so it needs a definition');
  assert.ok(projectiles(run, 'bullet').length > 0, 'and they should be shooting');
});

test('Battleship swarm drones expire rather than piling up forever', () => {
  const run = runAs('battleship');
  advance(run, 120, intent({ fire: true }));
  const first = projectiles(run, 'swarm').length;
  assert.ok(first > 0, 'the swarm should be out');

  advance(run, 400);
  const later = projectiles(run, 'swarm').length;
  assert.ok(later < 200, `the swarm must stay bounded, reached ${later}`);
});

// --- The Smasher line ------------------------------------------------------

test('the Smasher line has no guns but hurts on contact', () => {
  for (const id of ['smasher', 'landmine', 'spike']) {
    const run = runAs(id);
    advance(run, 60, intent({ fire: true }));
    assert.equal(projectiles(run).length, 0, `${id} should fire nothing`);
    assert.ok(run.player.contactDamage > 0, `${id} should still hurt what it touches`);
  }
});

test('Spike hits harder on contact than a plain Smasher', () => {
  const smasher = runAs('smasher');
  const spike = runAs('spike');
  smasher.player.points.bodyDamage = 5;
  spike.player.points.bodyDamage = 5;
  smasher.player.refresh();
  spike.player.refresh();
  assert.ok(
    spike.player.contactDamage > smasher.player.contactDamage,
    'the spikes are the whole point of the class',
  );
});

test('an invisible tank fades when it holds still and shows when it moves', () => {
  const run = runAs('stalker');
  advance(run, 120);
  assert.ok(run.player.opacity < 0.2, `a still Stalker should vanish, was ${run.player.opacity}`);

  advance(run, 40, intent({ move: vec(1, 0) }));
  assert.ok(run.player.opacity > 0.3, `moving should give it away, was ${run.player.opacity}`);
});

test('a Manager stays hidden even while shooting', () => {
  const run = runAs('manager');
  advance(run, 200, intent({ fire: true }));
  assert.ok(run.player.opacity < 0.2, 'firing does not reveal a Manager');
});
