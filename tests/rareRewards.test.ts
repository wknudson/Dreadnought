/**
 * Rare perks as boss rewards.
 *
 * Level-ups deal stats and uncommon perks; a cleared boss wave deals a hand of
 * rares. These hold the run to that: no rare from a level-up however the cards
 * fall, one reward for each boss but the last, and a reward hand that stays
 * rare through a reroll and answers its own choice rather than a level's.
 *
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Run } from '../src/sim/run.ts';
import { Shape } from '../src/sim/shape.ts';
import { PERKS } from '../src/sim/perkImpl.ts';
import { dealCards, HAND_SIZE } from '../src/data/cards.ts';
import { BOSS_INTERVAL, DIFFICULTIES, FINAL_WAVE } from '../src/data/waves.ts';
import { Rng } from '../src/core/rng.ts';

const makeRun = (seed = 1234): Run => new Run({ seed, difficulty: 'normal', color: '#00B2E1' });

const rarities = (hand: ReturnType<typeof dealCards>): string[] =>
  hand.map((c) => (c.kind === 'perk' ? c.perk.rarity : c.kind));

test('a level-up never deals a rare perk', () => {
  const run = makeRun();
  // Every perk hand the level-up pool can make, many times over, at Hard's
  // higher perk rate so perk slots come up as often as they ever do.
  for (let seed = 0; seed < 400; seed++) {
    const hand = dealCards({
      kind: 'level',
      def: run.player.def,
      points: run.player.points,
      perks: run.perks,
      host: run,
      difficulty: DIFFICULTIES.hard,
      rng: new Rng(seed),
    });
    assert.ok(!rarities(hand).includes('rare'), `seed ${seed} dealt ${rarities(hand).join(',')}`);
  }
});

test('each boss but the last pays one rare hand', () => {
  const run = makeRun();
  const rewards: number[] = [];
  for (let wave = 1; wave <= FINAL_WAVE; wave++) {
    run.waves.jumpTo(wave);
    // Let the whole wave arrive, boss included, then clear it and see what the
    // clear queued.
    let guard = 0;
    while (run.waves.phase === 'incoming' && guard++ < 400) run.tick();
    run.pendingChoices.length = 0;
    // Clear on every tick, since a spawn joins the world a tick after release.
    guard = 0;
    while (run.waves.phase === 'fighting' && guard++ < 50) {
      for (const e of run.world.entities) if (e.team === 'enemy') e.alive = false;
      run.tick();
    }
    const rares = run.pendingChoices.filter((c) => c === 'rare').length;
    if (rares) rewards.push(wave);
    assert.ok(rares <= 1, `wave ${wave} queued ${rares} rare hands`);
    if (run.outcome !== 'alive') break;
  }
  const expected = [];
  for (let w = BOSS_INTERVAL; w < FINAL_WAVE; w += BOSS_INTERVAL) expected.push(w);
  assert.deepEqual(rewards, expected);
});

test('a rare hand is all rares, never twice the same', () => {
  const run = makeRun();
  for (let seed = 0; seed < 50; seed++) {
    const hand = dealCards({
      kind: 'rare',
      def: run.player.def,
      points: run.player.points,
      perks: run.perks,
      host: run,
      difficulty: DIFFICULTIES.normal,
      rng: new Rng(seed),
    });
    assert.equal(hand.length, HAND_SIZE);
    assert.deepEqual(rarities(hand), ['rare', 'rare', 'rare'], `seed ${seed}`);
    const ids = hand.map((c) => (c.kind === 'perk' ? c.perk.id : ''));
    assert.equal(new Set(ids).size, ids.length, `seed ${seed} repeated a perk`);
  }
});

test('once every rare is maxed, a boss still pays something', () => {
  const run = makeRun();
  for (const perk of PERKS) {
    if (perk.rarity !== 'rare') continue;
    for (let i = 0; i < perk.maxStacks; i++) run.takeCard({ kind: 'perk', perk });
  }
  const hand = run.dealHand('rare');
  assert.equal(hand.length, HAND_SIZE, 'the hand is never empty');
  assert.ok(!rarities(hand).includes('rare'), 'and it falls back to what is left');
});

test('a rare hand answers the rare choice, and a reroll keeps it rare', () => {
  const run = makeRun();
  for (const e of run.world.entities) if (e instanceof Shape) e.alive = false;
  run.pendingChoices.length = 0;
  run.pendingChoices.push('rare', 'card');
  run.grantReroll();

  const first = run.dealHand();
  assert.equal(run.handKind, 'rare', 'the queue front decides the hand');
  assert.deepEqual(rarities(first), ['rare', 'rare', 'rare']);

  assert.equal(run.reroll(), true);
  assert.deepEqual(rarities(run.hand), ['rare', 'rare', 'rare'], 'a reroll stays rare');

  run.takeCard(run.hand[0]!);
  assert.deepEqual(run.pendingChoices, ['card'], 'taking it clears the reward, not the level-up');
});

/** Plays a wave in, then clears it, the way the boss-reward tests need. */
function clearWave(run: Run, wave: number): void {
  run.waves.jumpTo(wave);
  let guard = 0;
  while (run.waves.phase === 'incoming' && guard++ < 400) run.tick();
  guard = 0;
  while (run.waves.phase === 'fighting' && guard++ < 50) {
    for (const e of run.world.entities) if (e.team === 'enemy') e.alive = false;
    run.tick();
  }
}

test('a boss hand takes the place of the next level-up card', () => {
  const run = makeRun();
  run.pendingChoices.length = 0;
  clearWave(run, 5);
  assert.deepEqual(run.pendingChoices, ['rare']);
  run.pendingChoices.length = 0;

  // Level two would pay a card, but the boss already paid it.
  run.debugGrantLevel();
  assert.equal(run.level, 2);
  assert.deepEqual(run.pendingChoices, [], 'the next level-up card is the one replaced');

  run.debugGrantLevel();
  assert.deepEqual(run.pendingChoices, ['card'], 'and the one after is paid as usual');
});

test('a level-up card already waiting when the boss falls is the one replaced', () => {
  const run = makeRun();
  run.pendingChoices.length = 0;
  run.pendingChoices.push('card');
  clearWave(run, 5);
  assert.deepEqual(run.pendingChoices, ['rare'], 'the waiting card became the reward');
  run.pendingChoices.length = 0;
  run.debugGrantLevel();
  assert.deepEqual(run.pendingChoices, ['card'], 'so nothing further is owed');
});
