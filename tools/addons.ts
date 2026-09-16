/**
 * Addon geometry, transcribed from measurements of the diep.io client.
 * The vendor tank table only names its addons, so the shapes live here.
 */
import type { Addon, AutoTurretDefinition, BarrelDefinition } from '../src/data/schema.ts';

const turretBarrel = (damage: number): BarrelDefinition => ({
  angle: 0,
  offset: 0,
  size: 55,
  width: 29.4,
  delay: 0.01,
  reload: 1,
  recoil: 0.3,
  shape: 'rect',
  projectile: {
    kind: 'bullet',
    sizeRatio: 1,
    health: 1,
    damage,
    speed: 1.2,
    scatterRate: 1,
    lifeLength: 1,
    absorbtionFactor: 1,
  },
});

/** A turret sitting on the body centre, as on Auto Gunner, Auto Trapper and Auto Smasher. */
const centredTurret: AutoTurretDefinition = {
  mountAngle: 0,
  mountDistance: 0,
  baseRadius: 25,
  barrel: turretBarrel(0.3),
};

/** One turret of an Auto 3 / Auto 5 ring: mounted off centre and limited to a 180 degree arc. */
const ringTurret = (mountAngle: number): AutoTurretDefinition => ({
  mountAngle,
  mountDistance: 0.8,
  baseRadius: 25,
  barrel: turretBarrel(0.4),
  arcLimit: Math.PI / 2,
});

const autoRing = (count: number): Addon => ({
  kind: 'autoRing',
  count,
  ringSpin: 0.005,
  turret: ringTurret(0),
});

const smasherGuard: Addon = {
  kind: 'guard',
  guards: [{ sides: 6, sizeRatio: 1.15, offsetAngle: 0, spin: 0.1 }],
};

/** Named addons as they appear in the vendor table, mapped to concrete geometry. */
export const ADDONS: Record<string, Addon[]> = {
  pronounced: [{ kind: 'pronounced', length: 50, width: 42, centerX: 40 }],
  launcher: [{ kind: 'launcher', angle: 0, length: 65.5 * Math.SQRT2, width: 33.6 }],
  smasher: [smasherGuard],
  landmine: [
    {
      kind: 'guard',
      guards: [
        { sides: 6, sizeRatio: 1.15, offsetAngle: 0, spin: 0.1 },
        { sides: 6, sizeRatio: 1.15, offsetAngle: 0, spin: 0.05 },
      ],
    },
  ],
  spike: [
    {
      kind: 'guard',
      guards: [
        { sides: 3, sizeRatio: 1.3, offsetAngle: 0, spin: 0.17 },
        { sides: 3, sizeRatio: 1.3, offsetAngle: Math.PI / 3, spin: 0.17 },
        { sides: 3, sizeRatio: 1.3, offsetAngle: Math.PI / 6, spin: 0.17 },
        { sides: 3, sizeRatio: 1.3, offsetAngle: Math.PI / 2, spin: 0.17 },
      ],
    },
  ],
  autoturret: [{ kind: 'autoTurret', turret: centredTurret }],
  autosmasher: [smasherGuard, { kind: 'autoTurret', turret: centredTurret }],
  auto3: [autoRing(3)],
  auto5: [autoRing(5)],
};

/** Addons that belong under the body rather than over it. */
export const UNDER_BODY = new Set(['launcher', 'smasher', 'landmine', 'spike', 'autosmasher']);
