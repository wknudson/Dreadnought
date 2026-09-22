/**
 * Codex tests.
 *
 * The codex outlives every run, so a mistake in it is one the player carries
 * forward: a mark that goes down, a win that credits too little, or a corrupt
 * save that takes the title screen with it. All of it is pure, so it is checked
 * here directly rather than through storage.
 *
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  colorsUnlockedBetween,
  isColorUnlocked,
  markWin,
  markedCount,
  nextColorUnlock,
  sanitizeCodex,
} from '../src/core/codex.ts';
import { PLAYER_COLORS } from '../src/data/colors.ts';
import { TANKS, ROOT_TANK_ID } from '../src/data/tanks.ts';
import { Run } from '../src/sim/run.ts';

test('a win marks every tank on the path, not only the last', () => {
  const path = [ROOT_TANK_ID, 'sniper', 'overseer', 'overlord'];
  const { codex, changed } = markWin({}, path, 'normal');
  for (const id of path) assert.equal(codex[id], 'normal', `${id} should be marked`);
  assert.deepEqual(changed, path);
  assert.equal(markedCount(codex), 4);
});

test('a mark only ever moves up', () => {
  const hard = markWin({}, [ROOT_TANK_ID, 'twin'], 'hard').codex;
  const after = markWin(hard, [ROOT_TANK_ID, 'twin'], 'easy');
  assert.equal(after.codex[ROOT_TANK_ID], 'hard', 'an easy win must not lower a hard mark');
  assert.deepEqual(after.changed, [], 'and nothing moved, so nothing is reported');

  const raised = markWin(markWin({}, [ROOT_TANK_ID], 'easy').codex, [ROOT_TANK_ID], 'normal');
  assert.equal(raised.codex[ROOT_TANK_ID], 'normal');
  assert.deepEqual(raised.changed, [ROOT_TANK_ID]);
});

test('marking a win leaves the codex it was given alone', () => {
  const before = { [ROOT_TANK_ID]: 'easy' } as const;
  markWin(before, [ROOT_TANK_ID, 'twin'], 'hard');
  assert.deepEqual(before, { [ROOT_TANK_ID]: 'easy' });
});

test('a corrupt save reads as an empty codex rather than breaking', () => {
  assert.deepEqual(sanitizeCodex(undefined), {});
  assert.deepEqual(sanitizeCodex('twin'), {});
  assert.deepEqual(sanitizeCodex(['twin']), {});
  assert.deepEqual(
    sanitizeCodex({ [ROOT_TANK_ID]: 'hard', twin: 'impossible', 'not-a-tank': 'easy', sniper: 3 }),
    { [ROOT_TANK_ID]: 'hard' },
    'only known tanks with a real difficulty survive',
  );
});

test('the colour thresholds climb, and the last needs every tank', () => {
  const thresholds = PLAYER_COLORS.flatMap((c) => (c.unlockAt === undefined ? [] : [c.unlockAt]));
  assert.ok(thresholds.length > 0, 'some colours should be earned');
  for (let i = 1; i < thresholds.length; i++) {
    assert.ok(thresholds[i]! > thresholds[i - 1]!, `threshold ${thresholds[i]} should climb`);
  }
  assert.equal(thresholds.at(-1), TANKS.length, 'the last colour is for finishing the codex');
  assert.ok(PLAYER_COLORS.some((c) => isColorUnlocked(c, 0)), 'a new player has colours to pick');
});

test('the next colour is the nearest threshold ahead, and none at the end', () => {
  const thresholds = PLAYER_COLORS.flatMap((c) => (c.unlockAt === undefined ? [] : [c.unlockAt]));
  const first = Math.min(...thresholds);
  assert.equal(nextColorUnlock(0), first);
  assert.equal(nextColorUnlock(first - 1), first);
  assert.ok((nextColorUnlock(first) ?? Infinity) > first, 'reaching a threshold moves past it');
  assert.equal(nextColorUnlock(TANKS.length), null);
});

test('a run remembers every class it took, starting from Basic', () => {
  const run = new Run({ seed: 1234, difficulty: 'normal', color: '#00B2E1' });
  assert.deepEqual(run.classPath, [ROOT_TANK_ID]);
  run.upgradeTo('sniper');
  run.upgradeTo('overseer');
  // Choosing the class you already are is not a step.
  run.upgradeTo('overseer');
  assert.deepEqual(run.classPath, [ROOT_TANK_ID, 'sniper', 'overseer']);
});

test('a win names the colours it crossed, and only those', () => {
  const thresholds = PLAYER_COLORS.flatMap((c) => (c.unlockAt === undefined ? [] : [c.unlockAt]));
  const [first, second] = [thresholds[0]!, thresholds[1]!];
  assert.deepEqual(colorsUnlockedBetween(first, first), [], 'no change, nothing unlocked');
  assert.deepEqual(
    colorsUnlockedBetween(first - 1, first).map((c) => c.unlockAt),
    [first],
    'landing exactly on a threshold unlocks it',
  );
  assert.deepEqual(
    colorsUnlockedBetween(first, first + 1).map((c) => c.unlockAt),
    [],
    'a colour already open is not unlocked again',
  );
  assert.deepEqual(
    colorsUnlockedBetween(0, second).map((c) => c.unlockAt),
    [first, second],
    'one big win can cross two',
  );
  assert.ok(colorsUnlockedBetween(0, 0).length === 0, 'the free colours never count as unlocks');
});
