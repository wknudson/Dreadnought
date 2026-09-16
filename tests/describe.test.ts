/**
 * The class descriptions are generated from barrel data, so they can drift as
 * the data changes. These tests hold them to being present, distinct and true.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TANKS, getTank } from '../src/data/tanks.ts';
import { describeTank } from '../src/ui/describe.ts';

test('every tank has a description', () => {
  for (const def of TANKS) {
    const text = describeTank(def);
    assert.ok(text.length > 8, `${def.id} has no real description`);
    assert.match(text, /^[A-Z]/, `${def.id} does not start with a capital: ${text}`);
    assert.match(text, /\.$/, `${def.id} does not end in a full stop: ${text}`);
  }
});

test('no two tanks share a description', () => {
  const byText = new Map<string, string[]>();
  for (const def of TANKS) {
    const text = describeTank(def);
    const names = byText.get(text) ?? [];
    names.push(def.name);
    byText.set(text, names);
  }
  const clashes = [...byText].filter(([, names]) => names.length > 1);
  assert.deepEqual(
    clashes.map(([, names]) => names.join(' = ')),
    [],
    'these tanks read identically and would be indistinguishable in the upgrade panel',
  );
});

test('descriptions name the mechanic that defines the tank', () => {
  const cases: [string, RegExp][] = [
    ['smasher', /no guns/i],
    ['spike', /spikes/i],
    ['landmine', /fades from sight/i],
    ['stalker', /invisible/i],
    ['predator', /right click/i],
    ['ranger', /further than any other/i],
    ['overlord', /drones/i],
    ['necromancer', /squares it kills/i],
    ['factory', /minion/i],
    ['battleship', /swarm/i],
    ['trapper', /traps/i],
    ['skimmer', /missiles/i],
    ['rocketeer', /rockets/i],
    ['auto-5', /turrets/i],
    ['machine-gun', /spray/i],
    ['sniper', /long range/i],
    ['annihilator', /largest shell/i],
    ['booster', /thrusters/i],
  ];
  for (const [id, pattern] of cases) {
    assert.match(describeTank(getTank(id)), pattern, `${id} should mention its defining trait`);
  }
});

test('a tank without guns is never described as firing', () => {
  for (const def of TANKS) {
    if (def.barrels.length > 0) continue;
    const text = describeTank(def);
    assert.doesNotMatch(text, /barrel|fires/i, `${def.id} has no barrels but says: ${text}`);
  }
});
