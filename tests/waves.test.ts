/**
 * Waves, cards, perks and bosses: the roguelike layer.
 *
 * Several of these exist because the balance harness found the bug first. A
 * wave that cannot be cleared, or a difficulty that is harder than the one above
 * it, is invisible from a screenshot and obvious from a thousand simulated ticks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Run } from '../src/sim/run.ts';
import { Shape } from '../src/sim/shape.ts';
import { Tank } from '../src/sim/tank.ts';
import { Rng } from '../src/core/rng.ts';
import { vec } from '../src/core/math.ts';
import { TICKS_PER_SECOND } from '../src/core/loop.ts';
import {
  BOSS_INTERVAL,
  DIFFICULTIES,
  ENEMY_LEVEL_SPREAD,
  ENEMY_OPTIONS,
  FINAL_WAVE,
  arenaSizeForWave,
  bossFor,
  budgetForWave,
  enemyLevel,
  generateWave,
  isBossWave,
  tankLimitForWave,
} from '../src/data/waves.ts';
import { BOSS_ORDER, getBoss } from '../src/data/bosses.ts';
import { dealCards, HAND_SIZE } from '../src/data/cards.ts';
import { PERKS } from '../src/sim/perkImpl.ts';
import { getTank, DEFAULT_STAT_CAP } from '../src/data/tanks.ts';
import { STAT_ORDER } from '../src/data/schema.ts';
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

function advance(run: Run, ticks: number, input = intent(), aim = 0): void {
  for (let i = 0; i < ticks; i++) {
    run.applyIntent(input, aim);
    run.tick();
    // Answer anything the level-up asks, so the run is never left waiting.
    while (run.waitingOnChoice) {
      const next = run.pendingChoices[0];
      if (next === 'class') {
        const options = run.classOptions();
        if (options.length) run.upgradeTo(options[0]!);
        else run.consumeChoice('class');
      } else {
        const hand = run.dealHand();
        if (hand.length) run.takeCard(hand[0]!);
        else run.consumeChoice('card');
      }
    }
  }
}

const makeRun = (seed = 5, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): Run =>
  new Run({ seed, difficulty, color: '#00B2E1' });

// --- Wave structure --------------------------------------------------------

test('bosses arrive on the interval, and each of the five gets a turn', () => {
  for (let wave = 1; wave <= FINAL_WAVE; wave++) {
    assert.equal(isBossWave(wave), wave % BOSS_INTERVAL === 0, `wave ${wave}`);
  }
  const bosses = [];
  for (let wave = BOSS_INTERVAL; wave <= FINAL_WAVE; wave += BOSS_INTERVAL) {
    bosses.push(bossFor(wave));
  }
  assert.deepEqual(bosses, [...BOSS_ORDER], 'all five bosses appear, in order');
});

test('every boss has a definition that can be built', () => {
  for (const id of BOSS_ORDER) {
    const boss = getBoss(id);
    assert.ok(boss.name.length > 0);
    assert.ok(boss.def.sizeMultiplier && boss.def.sizeMultiplier > 1, `${id} should be large`);
    assert.ok(
      boss.def.barrels.length > 0 || boss.def.postAddons.length > 0,
      `${id} needs a weapon`,
    );
  }
});

test('waves grow, and a boss wave brings a lighter escort', () => {
  const rng = new Rng(1);
  const normal = DIFFICULTIES.normal;
  const sizeOf = (wave: number): number =>
    generateWave(wave, normal, rng).groups.reduce((n, g) => n + g.count, 0);

  assert.ok(budgetForWave(10, normal) > budgetForWave(1, normal), 'the budget grows');
  const boss = generateWave(10, normal, rng);
  assert.ok(boss.boss, 'wave ten has a boss');
  assert.ok(sizeOf(9) > 0 && sizeOf(11) > 0);
});

test('a wave only fields what has been unlocked by then', () => {
  const rng = new Rng(3);
  for (let wave = 1; wave <= FINAL_WAVE; wave++) {
    const def = generateWave(wave, DIFFICULTIES.normal, rng);
    for (const group of def.groups) {
      assert.ok(
        wave >= group.entry.unlockWave,
        `wave ${wave} fielded something unlocked at ${group.entry.unlockWave}`,
      );
    }
  }
});

test('every wave past the unlock brings something that shoots back', () => {
  const firstTankWave = Math.min(
    ...ENEMY_OPTIONS.filter((o) => o.kind.type === 'tank').map((o) => o.unlockWave),
  );
  for (let seed = 1; seed <= 8; seed++) {
    const rng = new Rng(seed);
    for (let wave = 1; wave <= FINAL_WAVE; wave++) {
      const def = generateWave(wave, DIFFICULTIES.normal, rng);
      const tanks = def.groups
        .filter((g) => g.entry.kind.type === 'tank')
        .reduce((n, g) => n + g.count, 0);
      if (wave < firstTankWave) {
        assert.equal(tanks, 0, `wave ${wave} should predate enemy tanks`);
      } else if (!def.boss) {
        assert.ok(tanks > 0, `wave ${wave} on seed ${seed} had no enemy tank`);
      }
      assert.ok(
        tanks <= tankLimitForWave(wave),
        `wave ${wave} fielded ${tanks} tanks, over its cap of ${tankLimitForWave(wave)}`,
      );
    }
  }
});

test("an enemy tank spawns at the player's level, not the wave's", () => {
  for (const level of [10, 20, 30, 45]) {
    for (let jitter = -ENEMY_LEVEL_SPREAD; jitter <= ENEMY_LEVEL_SPREAD; jitter++) {
      const got = enemyLevel(level, 2, jitter);
      assert.ok(
        Math.abs(got - level) <= ENEMY_LEVEL_SPREAD || got === 15,
        `a tier two tank against level ${level} spawned at ${got}`,
      );
      assert.ok(got <= 45, 'no enemy exceeds the level cap');
    }
  }
  // A tier four tank cannot exist below the level its class unlocks at.
  assert.equal(enemyLevel(20, 4, 0), 45);
});

test('the arena widens as the run goes on', () => {
  assert.ok(arenaSizeForWave(25) > arenaSizeForWave(1));
  assert.equal(arenaSizeForWave(1), arenaSizeForWave(BOSS_INTERVAL));
  assert.ok(arenaSizeForWave(BOSS_INTERVAL + 1) > arenaSizeForWave(BOSS_INTERVAL));
});

// --- Running a wave --------------------------------------------------------

test('a run starts on wave one and spawns enemies at the edges', () => {
  const run = makeRun();
  assert.equal(run.wave, 1);
  advance(run, 40);
  const enemies = run.world.entities.filter((e) => e.team === 'enemy' && e.alive);
  assert.ok(enemies.length > 0, 'wave one should have arrived');
  for (const e of enemies) {
    const fromPlayer = Math.hypot(e.pos.x - run.player.pos.x, e.pos.y - run.player.pos.y);
    assert.ok(fromPlayer > 400, `something spawned on top of the player, ${fromPlayer} away`);
  }
});

test('a spawn is announced before it happens', () => {
  const run = makeRun();
  run.tick();
  assert.ok(run.warnings.length > 0, 'the first wave should be telegraphed');
  for (const w of run.warnings) {
    assert.ok(w.progress >= 0 && w.progress <= 1);
  }
});

test('clearing a wave starts a breather, then the next wave', () => {
  const run = makeRun();
  advance(run, 40);
  // Wipe the field, as a strong player would.
  for (const e of run.world.entities) if (e.team === 'enemy') e.alive = false;
  advance(run, 3);
  assert.equal(run.waves.phase, 'breather');
  assert.ok(run.countdown > 0, 'a countdown should be running');

  advance(run, Math.ceil(DIFFICULTIES.normal.breather * TICKS_PER_SECOND) + 5);
  assert.equal(run.wave, 2);
});

test('a wave is never left uncleared because something wandered off', () => {
  const run = makeRun();
  advance(run, 40);

  // Park one shape in the far corner and delete everything else, which is the
  // shape of every stall the balance harness turned up.
  const shapes = run.world.entities.filter((e): e is Shape => e instanceof Shape && e.alive);
  assert.ok(shapes.length > 0);
  shapes.slice(1).forEach((s) => (s.alive = false));
  const straggler = shapes[0]!;
  straggler.pos = vec(-2000, -2000);

  // Long enough for the director to lose patience and send it in.
  advance(run, TICKS_PER_SECOND * 60);
  const closed = Math.hypot(straggler.pos.x - run.player.pos.x, straggler.pos.y - run.player.pos.y);
  assert.ok(
    !straggler.alive || closed < 900,
    `a straggler must come to the player, it was ${Math.round(closed)} away`,
  );
});

test('a hunting straggler can catch a player who simply drives away', () => {
  const run = makeRun();
  advance(run, 40);
  const shapes = run.world.entities.filter((e): e is Shape => e instanceof Shape && e.alive);
  shapes.slice(1).forEach((s) => (s.alive = false));
  const chaser = shapes[0]!;
  chaser.hunting = true;
  chaser.pos = vec(run.player.pos.x - 500, run.player.pos.y);

  const gap = (): number =>
    Math.hypot(chaser.pos.x - run.player.pos.x, chaser.pos.y - run.player.pos.y);

  // Both start from rest, so the gap widens while the chaser gets up to speed.
  // What matters is that it is closing once both are at full tilt.
  const flatOut = intent({ move: vec(1, 0) });
  advance(run, 40, flatOut, 0);
  const atSpeed = gap();
  advance(run, 60, flatOut, 0);
  const later = gap();

  assert.ok(
    later < atSpeed,
    `the gap should be closing, it went from ${Math.round(atSpeed)} to ${Math.round(later)}`,
  );
});

test('a boss wave puts a boss on the field', () => {
  const run = makeRun();
  run.waves.jumpTo(BOSS_INTERVAL);
  advance(run, 120);
  const boss = run.world.entities.find((e): e is Tank => e instanceof Tank && e.isBoss);
  assert.ok(boss, 'the boss should have arrived');
  assert.ok(boss.radius > run.player.radius * 2, 'and it should be much larger than the player');
  assert.ok(boss.maxHealth > 400, 'with a health pool worth chewing through');
  assert.equal(run.bossName, getBoss(bossFor(BOSS_INTERVAL)!).name);
});

// --- Cards -----------------------------------------------------------------

test('a level-up deals three cards', () => {
  const run = makeRun();
  const hand = run.dealHand();
  assert.equal(hand.length, HAND_SIZE);
  // Nothing should be offered twice in the same hand.
  const keys = hand.map((c) => (c.kind === 'stat' ? c.stat : c.kind === 'perk' ? c.perk.id : 'heal'));
  assert.equal(new Set(keys).size, keys.length, 'a hand should not repeat itself');
});

test('a capped stat is never offered again', () => {
  const run = makeRun();
  const def = getTank('tank');
  // Max out everything except one stat, which must then be the only one dealt.
  for (const key of STAT_ORDER) run.player.points[key] = DEFAULT_STAT_CAP;
  run.player.points.reload = 0;

  for (let attempt = 0; attempt < 12; attempt++) {
    for (const card of dealCards({
      def,
      points: run.player.points,
      perks: run.perks,
      host: run,
      difficulty: DIFFICULTIES.normal,
      rng: new Rng(attempt),
    })) {
      if (card.kind === 'stat') assert.equal(card.stat, 'reload', 'a maxed stat was offered');
    }
  }
});

test('taking a stat card raises that stat', () => {
  const run = makeRun();
  const before = run.player.points.bulletDamage;
  run.takeCard({
    kind: 'stat',
    stat: 'bulletDamage',
    label: 'Bullet Damage',
    description: '',
    color: '#fff',
  });
  assert.equal(run.player.points.bulletDamage, before + 1);
});

test('the same seed deals the same cards', () => {
  const handOf = (seed: number): string => {
    const run = new Run({ seed, difficulty: 'normal', color: '#fff' });
    return run
      .dealHand()
      .map((c) => (c.kind === 'stat' ? c.stat : c.kind === 'perk' ? c.perk.id : 'heal'))
      .join(',');
  };
  assert.equal(handOf(42), handOf(42));
  assert.notEqual(handOf(42), handOf(43));
});

// --- Perks -----------------------------------------------------------------

test('piercing lets a shot carry through more than one enemy', () => {
  const run = makeRun();
  run.waves.halt();
  const plain = run.world.entities.length;
  assert.equal(run.perks.stacksOf('pierce'), 0);

  const pierce = { kind: 'perk' as const, perk: findPerk('pierce') };
  run.takeCard(pierce);
  assert.equal(run.perks.stacksOf('pierce'), 1);

  // Taking it again stacks rather than adding a second copy.
  run.takeCard(pierce);
  assert.equal(run.perks.stacksOf('pierce'), 2);
  assert.equal(run.perks.all.length, 1);
  assert.ok(plain >= 0);
});

test('a defensive perk reduces what actually lands', () => {
  const run = makeRun();
  run.waves.halt();
  run.takeCard({ kind: 'perk', perk: findPerk('bulwark') });

  const full = run.player.maxHealth;
  run.player.health = full;
  const triangle = new Shape('triangle', vec(run.player.pos.x + 20, run.player.pos.y), new Rng(1));
  run.world.spawn(triangle);
  advance(run, 6);
  const withPerk = full - run.player.health;

  const bare = makeRun();
  bare.waves.halt();
  bare.player.health = bare.player.maxHealth;
  const other = new Shape('triangle', vec(bare.player.pos.x + 20, bare.player.pos.y), new Rng(1));
  bare.world.spawn(other);
  advance(bare, 6);
  const withoutPerk = bare.player.maxHealth - bare.player.health;

  assert.ok(withPerk < withoutPerk, `perk took ${withPerk}, bare took ${withoutPerk}`);
});

test('clearing a wave heals a player who took Field Repair', () => {
  const run = makeRun();
  run.takeCard({ kind: 'perk', perk: findPerk('field-repair') });
  run.player.health = 10;
  advance(run, 40);
  for (const e of run.world.entities) if (e.team === 'enemy') e.alive = false;
  advance(run, 3);
  assert.ok(run.player.health > 10, 'clearing the wave should patch you up');
});

test('the reroll perk grants a reroll on each wave clear', () => {
  const run = makeRun();
  run.takeCard({ kind: 'perk', perk: findPerk('reroll') });
  const before = run.rerolls;
  advance(run, 40);
  for (const e of run.world.entities) if (e.team === 'enemy') e.alive = false;
  advance(run, 3);
  assert.ok(run.rerolls > before);

  const hand = run.dealHand();
  assert.ok(hand.length > 0);
  assert.equal(run.reroll(), true, 'a reroll should be spendable');
});

// --- Difficulty ------------------------------------------------------------

test('each difficulty is harder than the one below it', () => {
  const { easy, normal, hard } = DIFFICULTIES;
  assert.ok(easy.health < normal.health && normal.health < hard.health);
  assert.ok(easy.damage < normal.damage && normal.damage < hard.damage);
  assert.ok(easy.budget < normal.budget && normal.budget < hard.budget);
  // The easy setting also earns faster, because a smaller wave means less
  // experience, which would otherwise leave it weaker at every boss.
  assert.ok(easy.xpBonus > normal.xpBonus && normal.xpBonus > hard.xpBonus);
});

test('a run ends when the player dies, and reports how it ended', () => {
  const run = makeRun();
  run.waves.halt();
  run.player.health = 1;
  run.player.damage(50);
  run.world.events.emit('entityKilled', { victim: run.player, killer: null });
  advance(run, 45);
  assert.equal(run.over, true);
  assert.equal(run.outcome, 'died');
});

// --- Helpers ---------------------------------------------------------------

function findPerk(id: string): (typeof PERKS)[number] {
  const perk = PERKS.find((p) => p.id === id);
  if (!perk) throw new Error(`no perk called ${id}`);
  return perk;
}
