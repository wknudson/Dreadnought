import type { BarrelDefinition, TankDefinition } from '../data/schema.ts';
import { wrapAngle } from '../core/math.ts';

/**
 * One-line descriptions of what a class actually does.
 *
 * Derived from each tank's own barrel data rather than a hand-kept table, so a
 * change to the numbers cannot leave the description lying. Nothing else tells
 * a player who has never played diep.io why Sniper differs from Machine Gun.
 */

/** Where a barrel points, in quarters. */
type Facing = 'front' | 'side' | 'rear';

function facingOf(barrel: BarrelDefinition): Facing {
  const a = Math.abs(wrapAngle(barrel.angle));
  if (a > 2.2) return 'rear';
  if (a > 0.9) return 'side';
  return 'front';
}

/**
 * A rear barrel that exists to shove the tank along rather than to hurt anyone.
 *
 * The Tri-Angle line fires these constantly; calling them guns would badly
 * misdescribe how those tanks play.
 */
const isThruster = (b: BarrelDefinition): boolean =>
  facingOf(b) === 'rear' &&
  b.projectile.kind === 'bullet' &&
  b.projectile.damage <= 0.25 &&
  b.projectile.lifeLength <= 0.6;

interface Guns {
  all: BarrelDefinition[];
  front: BarrelDefinition[];
  side: BarrelDefinition[];
  rear: BarrelDefinition[];
  thrusters: BarrelDefinition[];
}

function gunsOf(def: TankDefinition): Guns {
  const bullets = def.barrels.filter((b) => b.projectile.kind === 'bullet');
  const thrusters = bullets.filter(isThruster);
  const real = bullets.filter((b) => !isThruster(b));
  return {
    all: real,
    front: real.filter((b) => facingOf(b) === 'front'),
    side: real.filter((b) => facingOf(b) === 'side'),
    rear: real.filter((b) => facingOf(b) === 'rear'),
    thrusters,
  };
}

// Descriptions read as prose, so counts are spelled out. A description can open
// with one, and a sentence should not start with a digit.
const NUMBER_WORDS = [
  'no', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
];
const countWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/** True when the given bearings are spaced equally around the circle. */
function evenlySpaced(angles: number[]): boolean {
  if (angles.length < 3) return false;
  const step = (Math.PI * 2) / angles.length;
  const sorted = [...angles].sort((a, b) => a - b);
  return sorted.every((a, i) => {
    const next = i === sorted.length - 1 ? sorted[0]! + Math.PI * 2 : sorted[i + 1]!;
    return Math.abs(next - a - step) < 0.05;
  });
}

/** How the guns are arranged, in a few words. */
function layoutPhrase(guns: Guns): string {
  const { front, side, rear } = guns;
  const total = guns.all.length;
  if (total === 0) return '';

  // Several tanks mount their guns at equal bearings around the hull. Saying so
  // reads far better than counting how many happen to face forward.
  const bearings = [...new Set(guns.all.map((b) => Math.round(wrapAngle(b.angle) * 1000) / 1000))];
  if (evenlySpaced(bearings)) {
    const perBearing = total / bearings.length;
    if (perBearing === 2) return `${countWord(bearings.length)} pairs of guns, evenly spaced`;
    if (bearings.length >= 4) return 'Fires in every direction';
    return `${countWord(bearings.length)} guns, evenly spaced`;
  }

  if (front.length === 1 && side.length === 2 && !rear.length) {
    return 'One gun forward, one to each side';
  }

  const directions = [front.length > 0, side.length > 0, rear.length > 0].filter(Boolean).length;
  if (directions === 3) return 'Fires in every direction';
  if (side.length && rear.length) return 'Covers the sides and the rear';
  if (front.length && rear.length) {
    return front.length === 1 && rear.length === 1
      ? 'One gun forward, one behind'
      : `${countWord(front.length)} guns forward, ${countWord(rear.length)} behind`;
  }
  if (side.length && !front.length) {
    return side.length >= 4 ? 'Guns spread around the sides' : 'Guns on the flanks';
  }
  if (rear.length && !front.length) return 'Fires backwards';

  // Everything points forward from here on. Three arrangements look and play
  // very differently, and counting barrels alone would conflate them: Triple
  // Shot fans outward, Triplet sits side by side, Hunter nests one inside the next.
  if (total === 1) return 'A single barrel';
  if (side.length) return `${countWord(total)} barrels in a wide fan`;

  const sameBearing = bearings.length === 1;
  const spreadApart = Math.max(...guns.all.map((b) => Math.abs(b.offset))) > 5;
  if (sameBearing) {
    return spreadApart
      ? `${countWord(total)} barrels side by side`
      : `${countWord(total)} barrels nested one inside the next`;
  }
  if (total >= 5) return `${countWord(total)} barrels fanned out`;
  return `${countWord(total)} barrels in a fan`;
}

/**
 * The most distinctive thing about how this tank shoots.
 *
 * Rate counts only the guns pointing forward, because that is the firepower a
 * player feels. Octo Tank fires eight shots a cycle but just three of them go
 * where you are aiming.
 */
function feelPhrase(guns: Guns): string {
  const forward = guns.front.length ? guns.front : guns.all;
  if (!forward.length) return '';

  const rate = forward.reduce((sum, b) => sum + 1 / b.reload, 0);
  const damage = Math.max(...forward.map((b) => b.projectile.damage));
  const scatter = Math.max(...forward.map((b) => b.projectile.scatterRate));
  const speed = Math.max(...forward.map((b) => b.projectile.speed));
  const reload = Math.min(...forward.map((b) => b.reload));

  // Ordered by which trait a player notices first.
  if (damage >= 2.5) {
    // Both Destroyer and Annihilator hit for the same damage; the barrel bore
    // is what actually distinguishes them, and it is what you see.
    const bore = Math.max(...forward.map((b) => b.width));
    return bore >= 90
      ? 'firing the largest shell in the game'
      : 'each shell hits enormously hard';
  }
  if (scatter >= 2.5) return 'spraying wide and fast';
  if (rate >= 4.5) return 'a torrent of small shots';
  if (speed >= 1.4 && scatter <= 0.5) return 'accurate at long range';
  if (reload >= 3) return 'one heavy shot at a time';
  if (rate >= 2.5) return 'a heavy rate of fire';
  if (rate >= 1.8) return 'a quick rate of fire';
  if (damage <= 0.35) return 'weak shots, but endless';
  return '';
}

/** Drones, traps, minions and missiles: what the tank has besides guns. */
function extras(def: TankDefinition): string[] {
  const out: string[] = [];
  const of = (kind: string): BarrelDefinition[] =>
    def.barrels.filter((b) => b.projectile.kind === kind);

  const necro = of('necroDrone');
  if (necro.length) out.push('turns the squares it kills into a swarm of its own');

  const drones = of('drone');
  if (drones.length) {
    const cap = drones.reduce((n, b) => n + (b.projectile.maxCount ?? 0), 0);
    const steerable = drones.some((b) => b.projectile.controllable);
    const count = cap > 0 ? `${countWord(cap)} drones` : 'drones';
    const steering = steerable ? `${count} you steer with the cursor` : `${count} that defend on their own`;
    // More spawners means the same fleet is rebuilt faster after a fight.
    const pace = drones.length >= 4 ? ', replaced quickly from four spawners' : '';
    out.push(`${steering}${pace}`);
  }

  if (of('swarm').length) out.push('an endless swarm that regrows as it dies');
  if (of('minion').length) {
    const cap = of('minion')[0]?.projectile.maxCount ?? 0;
    out.push(`${cap ? countWord(cap) : 'several'} minion tanks that shoot for you`);
  }

  const traps = of('trap');
  if (traps.length) {
    const biggest = Math.max(...traps.map((b) => b.projectile.sizeRatio * b.width));
    const life = Math.min(...traps.map((b) => b.projectile.lifeLength));

    let phrase: string;
    if (biggest >= 65) phrase = 'traps as big as the tank itself';
    else if (traps.length >= 3) phrase = 'traps in three directions';
    else if (traps.length === 1 && facingOf(traps[0]!) === 'rear') phrase = 'traps dropped behind you';
    else phrase = 'traps that sit where you drop them';

    if (life <= 4) phrase += ', though they fade quickly';
    out.push(phrase);
  }

  if (of('skimmer').length) out.push('missiles that spin, firing as they go');
  if (of('rocket').length) out.push('rockets that build speed as they fly');
  if (of('glider').length) out.push('missiles that glide in on their own thrust');

  const turrets = def.postAddons.reduce(
    (n, a) => n + (a.kind === 'autoRing' ? a.count : a.kind === 'autoTurret' ? 1 : 0),
    0,
  );
  if (turrets) {
    out.push(
      turrets === 1 ? 'an auto turret that aims itself' : `${countWord(turrets)} self-aiming turrets`,
    );
  }

  return out;
}

/** True for the Smasher line, which trades every gun for a spinning shell. */
function guardShape(def: TankDefinition): string | null {
  const guard = def.preAddons.find((a) => a.kind === 'guard');
  if (!guard || guard.kind !== 'guard') return null;
  if (def.id === 'spike') return 'a ring of spikes that shreds on contact';
  if (guard.guards.length > 1) return 'two shells turning at different speeds';
  return 'a spinning shell that takes the hits';
}

function sentence(parts: string[]): string {
  if (!parts.length) return 'A tank.';
  return `${parts.join('. ')}.`;
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)!}`;
}

const capitalise = (s: string): string => s[0]!.toUpperCase() + s.slice(1);

/** A sentence describing the class, for the upgrade panel and the tree. */
export function describeTank(def: TankDefinition): string {
  const bits: string[] = [];
  const guns = gunsOf(def);
  const guard = guardShape(def);
  const rest = extras(def);

  if (guard && !guns.all.length && !rest.length) {
    // The pure ramming tanks: nothing to say about guns they do not have.
    const hidden = def.flags.invisible ? ' Fades from sight while it waits.' : '';
    return `No guns at all, just ${guard}.${hidden}`;
  }

  const layout = layoutPhrase(guns);
  const feel = feelPhrase(guns);
  if (layout) bits.push(capitalise(feel ? `${layout}, ${feel}` : layout));
  else if (feel) bits.push(capitalise(feel));

  if (guns.thrusters.length) {
    // The count is the whole difference between Tri-Angle and Booster.
    const n = countWord(guns.thrusters.length);
    bits.push(
      capitalise(
        guns.thrusters.length >= 4
          ? `${n} rear thrusters make it the fastest thing on the field`
          : `${n} rear thrusters shove it forward`,
      ),
    );
  }

  if (guard) rest.unshift(guard);
  if (rest.length) {
    const joined = joinList(rest);
    bits.push(bits.length ? `Plus ${joined}` : capitalise(joined));
  }

  if (def.flags.invisible) bits.push('Turns invisible when it holds still');
  if (def.flags.zoom) bits.push('Right click to see further ahead');
  else if (def.fieldFactor <= 0.75) bits.push('Sees further than any other tank');
  else if (def.fieldFactor <= 0.85) bits.push('Sees a long way');

  return sentence(bits);
}
