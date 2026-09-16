// GENERATED FILE - do not edit.
// Produced by tools/convert-tanks.ts from tools/vendor/TankDefinitions.json
// plus the corrections in tools/overrides/. Run "npm run data" to regenerate.

import type { TankDefinition } from './schema.ts';
export const GENERATED_TANKS: readonly TankDefinition[] = [
  {
    id: "tank",
    name: "Tank",
    tier: 1,
    unlockLevel: 0,
    upgradesTo: [
      "twin",
      "sniper",
      "machine-gun",
      "flank-guard",
      "smasher",
      "auto-tank"
    ],
    upgradesFrom: [],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "flank-guard",
    name: "Flank Guard",
    tier: 2,
    unlockLevel: 15,
    upgradesTo: [
      "tri-angle",
      "quad-tank",
      "twin-flank",
      "auto-3"
    ],
    upgradesFrom: [
      "tank"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 3.141593,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "machine-gun",
    name: "Machine Gun",
    tier: 2,
    unlockLevel: 15,
    upgradesTo: [
      "destroyer",
      "gunner",
      "sprayer"
    ],
    upgradesFrom: [
      "tank"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 0.5,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.7,
          speed: 1,
          scatterRate: 3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "sniper",
    name: "Sniper",
    tier: 2,
    unlockLevel: 15,
    upgradesTo: [
      "assassin",
      "overseer",
      "hunter",
      "trapper"
    ],
    upgradesFrom: [
      "tank"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 110,
        width: 42,
        delay: 0,
        reload: 1.5,
        recoil: 3,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1.5,
          scatterRate: 0.3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "twin",
    name: "Twin",
    tier: 2,
    unlockLevel: 15,
    upgradesTo: [
      "triple-shot",
      "quad-tank",
      "twin-flank"
    ],
    upgradesFrom: [
      "tank"
    ],
    barrels: [
      {
        angle: 0,
        offset: -26,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 0.75,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 26,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 0.75,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "assassin",
    name: "Assassin",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "ranger",
      "stalker"
    ],
    upgradesFrom: [
      "sniper"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 120,
        width: 42,
        delay: 0,
        reload: 2,
        recoil: 3,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1.5,
          scatterRate: 0.3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.8,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "auto-3",
    name: "Auto 3",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "auto-5",
      "auto-gunner"
    ],
    upgradesFrom: [
      "flank-guard"
    ],
    barrels: [],
    preAddons: [],
    postAddons: [
      {
        kind: "autoRing",
        count: 3,
        ringSpin: 0.005,
        turret: {
          mountAngle: 0,
          mountDistance: 0.8,
          baseRadius: 25,
          barrel: {
            angle: 0,
            offset: 0,
            size: 55,
            width: 29.4,
            delay: 0.01,
            reload: 1,
            recoil: 0.3,
            shape: "rect",
            projectile: {
              kind: "bullet",
              sizeRatio: 1,
              health: 1,
              damage: 0.4,
              speed: 1.2,
              scatterRate: 1,
              lifeLength: 1,
              absorbtionFactor: 1
            }
          },
          arcLimit: 1.5707963267948966
        }
      }
    ],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "destroyer",
    name: "Destroyer",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "hybrid",
      "annihilator",
      "skimmer",
      "rocketeer",
      "glider"
    ],
    upgradesFrom: [
      "machine-gun"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 71.4,
        delay: 0,
        reload: 4,
        recoil: 15,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 2,
          damage: 3,
          speed: 0.7,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 0.1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "gunner",
    name: "Gunner",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "auto-gunner",
      "gunner-trapper",
      "streamliner"
    ],
    upgradesFrom: [
      "machine-gun"
    ],
    barrels: [
      {
        angle: 0,
        offset: -32,
        size: 65,
        width: 25.2,
        delay: 0.5,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.5,
          damage: 0.5,
          speed: 1.1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 32,
        size: 65,
        width: 25.2,
        delay: 0.75,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.5,
          damage: 0.5,
          speed: 1.1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: -17,
        size: 85,
        width: 25.2,
        delay: 0,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.5,
          damage: 0.5,
          speed: 1.1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 17,
        size: 85,
        width: 25.2,
        delay: 0.25,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.5,
          damage: 0.5,
          speed: 1.1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "hunter",
    name: "Hunter",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "predator",
      "streamliner"
    ],
    upgradesFrom: [
      "sniper"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 110,
        width: 42,
        delay: 0,
        reload: 2.5,
        recoil: 0.3,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.75,
          speed: 1.4,
          scatterRate: 0.3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 56.7,
        delay: 0.2,
        reload: 2.5,
        recoil: 0.3,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.75,
          speed: 1.4,
          scatterRate: 0.3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.85,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "overseer",
    name: "Overseer",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "overlord",
      "necromancer",
      "manager",
      "overtrapper",
      "battleship",
      "factory"
    ],
    upgradesFrom: [
      "sniper"
    ],
    barrels: [
      {
        angle: -1.570796,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 2,
          damage: 0.7,
          speed: 0.8,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 4,
          controllable: true
        }
      },
      {
        angle: 1.570796,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 2,
          damage: 0.7,
          speed: 0.8,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 4,
          controllable: true
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    statNames: {
      bulletDamage: "Drone Damage",
      bulletPen: "Drone Health",
      bulletSpeed: "Drone Speed"
    }
  },
  {
    id: "quad-tank",
    name: "Quad Tank",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "octo-tank",
      "auto-5"
    ],
    upgradesFrom: [
      "twin",
      "flank-guard"
    ],
    barrels: [
      {
        angle: 3.141593,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.75,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -1.570796,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.75,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 1.570796,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.75,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.75,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "smasher",
    name: "Smasher",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "landmine",
      "auto-smasher",
      "spike"
    ],
    upgradesFrom: [
      "tank"
    ],
    barrels: [],
    preAddons: [
      {
        kind: "guard",
        guards: [
          {
            sides: 6,
            sizeRatio: 1.15,
            offsetAngle: 0,
            spin: 0.1
          }
        ]
      }
    ],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    statCaps: {
      moveSpeed: 10,
      bodyDamage: 10,
      maxHealth: 10,
      regen: 10
    },
    hiddenStats: [
      "reload",
      "bulletDamage",
      "bulletPen",
      "bulletSpeed"
    ]
  },
  {
    id: "trapper",
    name: "Trapper",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "tri-trapper",
      "gunner-trapper",
      "overtrapper",
      "mega-trapper",
      "auto-trapper"
    ],
    upgradesFrom: [
      "sniper"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 60,
        width: 42,
        delay: 0,
        reload: 1.5,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "trap",
          sizeRatio: 0.8,
          health: 2,
          damage: 1,
          speed: 2,
          scatterRate: 1,
          lifeLength: 8,
          absorbtionFactor: 1
        },
        cap: "trapLauncher"
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "tri-angle",
    name: "Tri-Angle",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "booster",
      "fighter"
    ],
    upgradesFrom: [
      "flank-guard"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 3.665191,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 2.5,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.2,
          speed: 1,
          scatterRate: 1,
          lifeLength: 0.5,
          absorbtionFactor: 1
        }
      },
      {
        angle: 2.617994,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 2.5,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.2,
          speed: 1,
          scatterRate: 1,
          lifeLength: 0.5,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "triple-shot",
    name: "Triple Shot",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "triplet",
      "penta-shot",
      "spread-shot"
    ],
    upgradesFrom: [
      "twin"
    ],
    barrels: [
      {
        angle: -0.785398,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.7,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0.785398,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.7,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.7,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "twin-flank",
    name: "Twin Flank",
    tier: 3,
    unlockLevel: 30,
    upgradesTo: [
      "triple-twin",
      "battleship"
    ],
    upgradesFrom: [
      "twin",
      "flank-guard"
    ],
    barrels: [
      {
        angle: 0,
        offset: -26,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 26,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 3.141593,
        offset: -26,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 3.141593,
        offset: 26,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "annihilator",
    name: "Annihilator",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "destroyer"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 96.6,
        delay: 0,
        reload: 4,
        recoil: 17,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 2.4,
          damage: 3,
          speed: 0.7,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 0.05
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "auto-5",
    name: "Auto 5",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "quad-tank",
      "auto-3"
    ],
    barrels: [],
    preAddons: [],
    postAddons: [
      {
        kind: "autoRing",
        count: 5,
        ringSpin: 0.005,
        turret: {
          mountAngle: 0,
          mountDistance: 0.8,
          baseRadius: 25,
          barrel: {
            angle: 0,
            offset: 0,
            size: 55,
            width: 29.4,
            delay: 0.01,
            reload: 1,
            recoil: 0.3,
            shape: "rect",
            projectile: {
              kind: "bullet",
              sizeRatio: 1,
              health: 1,
              damage: 0.4,
              speed: 1.2,
              scatterRate: 1,
              lifeLength: 1,
              absorbtionFactor: 1
            }
          },
          arcLimit: 1.5707963267948966
        }
      }
    ],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "auto-gunner",
    name: "Auto Gunner",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "gunner",
      "auto-3"
    ],
    barrels: [
      {
        angle: 0,
        offset: -32,
        size: 65,
        width: 25.2,
        delay: 0.5,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.45,
          damage: 0.5,
          speed: 1.1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 32,
        size: 65,
        width: 25.2,
        delay: 0.75,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.45,
          damage: 0.5,
          speed: 1.1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: -17,
        size: 85,
        width: 25.2,
        delay: 0,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.45,
          damage: 0.5,
          speed: 1.1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 17,
        size: 85,
        width: 25.2,
        delay: 0.25,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.45,
          damage: 0.5,
          speed: 1.1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [
      {
        kind: "autoTurret",
        turret: {
          mountAngle: 0,
          mountDistance: 0,
          baseRadius: 25,
          barrel: {
            angle: 0,
            offset: 0,
            size: 55,
            width: 29.4,
            delay: 0.01,
            reload: 1,
            recoil: 0.3,
            shape: "rect",
            projectile: {
              kind: "bullet",
              sizeRatio: 1,
              health: 1,
              damage: 0.3,
              speed: 1.2,
              scatterRate: 1,
              lifeLength: 1,
              absorbtionFactor: 1
            }
          }
        }
      }
    ],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "auto-smasher",
    name: "Auto Smasher",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "smasher"
    ],
    barrels: [],
    preAddons: [
      {
        kind: "guard",
        guards: [
          {
            sides: 6,
            sizeRatio: 1.15,
            offsetAngle: 0,
            spin: 0.1
          }
        ]
      }
    ],
    postAddons: [
      {
        kind: "autoTurret",
        turret: {
          mountAngle: 0,
          mountDistance: 0,
          baseRadius: 25,
          barrel: {
            angle: 0,
            offset: 0,
            size: 55,
            width: 29.4,
            delay: 0.01,
            reload: 1,
            recoil: 0.3,
            shape: "rect",
            projectile: {
              kind: "bullet",
              sizeRatio: 1,
              health: 1,
              damage: 0.3,
              speed: 1.2,
              scatterRate: 1,
              lifeLength: 1,
              absorbtionFactor: 1
            }
          }
        }
      }
    ],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    statCaps: {
      moveSpeed: 10,
      reload: 10,
      bulletDamage: 10,
      bulletPen: 10,
      bulletSpeed: 10,
      bodyDamage: 10,
      maxHealth: 10,
      regen: 10
    }
  },
  {
    id: "auto-tank",
    name: "Auto Tank",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "tank"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [
      {
        kind: "autoTurret",
        turret: {
          mountAngle: 0,
          mountDistance: 0,
          baseRadius: 25,
          barrel: {
            angle: 0,
            offset: 0,
            size: 55,
            width: 29.4,
            delay: 0.01,
            reload: 1,
            recoil: 0.3,
            shape: "rect",
            projectile: {
              kind: "bullet",
              sizeRatio: 1,
              health: 1,
              damage: 0.3,
              speed: 1.2,
              scatterRate: 1,
              lifeLength: 1,
              absorbtionFactor: 1
            }
          }
        }
      }
    ],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "auto-trapper",
    name: "Auto Trapper",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "trapper"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 60,
        width: 42,
        delay: 0,
        reload: 1.5,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "trap",
          sizeRatio: 0.8,
          health: 2,
          damage: 1,
          speed: 2,
          scatterRate: 1,
          lifeLength: 8,
          absorbtionFactor: 1
        },
        cap: "trapLauncher"
      }
    ],
    preAddons: [],
    postAddons: [
      {
        kind: "autoTurret",
        turret: {
          mountAngle: 0,
          mountDistance: 0,
          baseRadius: 25,
          barrel: {
            angle: 0,
            offset: 0,
            size: 55,
            width: 29.4,
            delay: 0.01,
            reload: 1,
            recoil: 0.3,
            shape: "rect",
            projectile: {
              kind: "bullet",
              sizeRatio: 1,
              health: 1,
              damage: 0.3,
              speed: 1.2,
              scatterRate: 1,
              lifeLength: 1,
              absorbtionFactor: 1
            }
          }
        }
      }
    ],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "battleship",
    name: "Battleship",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "overseer",
      "twin-flank"
    ],
    barrels: [
      {
        angle: 1.570796,
        offset: -20,
        size: 75,
        width: 29.4,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "trapezoidBase",
        projectile: {
          kind: "swarm",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.15,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1.2,
          absorbtionFactor: 1,
          controllable: false
        }
      },
      {
        angle: 4.712389,
        offset: -20,
        size: 75,
        width: 29.4,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "trapezoidBase",
        projectile: {
          kind: "swarm",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.15,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1.2,
          absorbtionFactor: 1,
          controllable: false
        }
      },
      {
        angle: 1.570796,
        offset: 20,
        size: 75,
        width: 29.4,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "trapezoidBase",
        projectile: {
          kind: "swarm",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.15,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1.2,
          absorbtionFactor: 1,
          controllable: true
        }
      },
      {
        angle: 4.712389,
        offset: 20,
        size: 75,
        width: 29.4,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "trapezoidBase",
        projectile: {
          kind: "swarm",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.15,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1.2,
          absorbtionFactor: 1,
          controllable: true
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "booster",
    name: "Booster",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "tri-angle"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 3.926991,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0.66,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.2,
          speed: 1,
          scatterRate: 1,
          lifeLength: 0.5,
          absorbtionFactor: 1
        }
      },
      {
        angle: 2.356194,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0.66,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.2,
          speed: 1,
          scatterRate: 1,
          lifeLength: 0.5,
          absorbtionFactor: 1
        }
      },
      {
        angle: 3.665191,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0.33,
        reload: 1,
        recoil: 2.5,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.2,
          speed: 1,
          scatterRate: 1,
          lifeLength: 0.5,
          absorbtionFactor: 1
        }
      },
      {
        angle: 2.617994,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0.33,
        reload: 1,
        recoil: 2.5,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.2,
          speed: 1,
          scatterRate: 1,
          lifeLength: 0.5,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "factory",
    name: "Factory",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "overseer"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 3,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "minion",
          sizeRatio: 1,
          health: 4,
          damage: 0.7,
          speed: 0.56,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 6,
          controllable: true,
          barrels: [
            {
              angle: 0,
              offset: 0,
              size: 85,
              width: 50.4,
              delay: 0,
              reload: 1,
              recoil: 1,
              shape: "rect",
              projectile: {
                kind: "bullet",
                sizeRatio: 1,
                health: 0.4,
                damage: 0.4,
                speed: 0.8,
                scatterRate: 1,
                lifeLength: 1,
                absorbtionFactor: 1
              }
            }
          ]
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 4,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    statNames: {
      bulletDamage: "Drone Damage",
      bulletPen: "Drone Health",
      bulletSpeed: "Drone Speed"
    }
  },
  {
    id: "fighter",
    name: "Fighter",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "tri-angle"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 1.570796,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0,
        reload: 1.5,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.8,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -1.570796,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0,
        reload: 1.5,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.8,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 3.665191,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 2.5,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.2,
          speed: 1,
          scatterRate: 1,
          lifeLength: 0.5,
          absorbtionFactor: 1
        }
      },
      {
        angle: 2.617994,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 2.5,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.2,
          speed: 1,
          scatterRate: 1,
          lifeLength: 0.5,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "glider",
    name: "Glider",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "destroyer"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 80,
        width: 56.7,
        delay: 0,
        reload: 4,
        recoil: 0.3,
        shape: "trapezoidBase",
        projectile: {
          kind: "glider",
          sizeRatio: 1,
          health: 3,
          damage: 1,
          speed: 0.3,
          scatterRate: 0,
          lifeLength: 1.3,
          absorbtionFactor: 0.1,
          startupDelay: 10,
          barrels: [
            {
              angle: 2.8623399732707,
              offset: 0,
              size: 70,
              width: 36,
              delay: 0,
              reload: 0.35,
              recoil: 1.6,
              shape: "trapezoidMuzzle",
              projectile: {
                kind: "bullet",
                sizeRatio: 1,
                health: 0.6,
                damage: 0.6,
                speed: 0.5,
                scatterRate: 1,
                lifeLength: 0.25,
                absorbtionFactor: 1
              }
            },
            {
              angle: 3.4208453339091,
              offset: 0,
              size: 70,
              width: 36,
              delay: 0,
              reload: 0.35,
              recoil: 1.6,
              shape: "trapezoidMuzzle",
              projectile: {
                kind: "bullet",
                sizeRatio: 1,
                health: 0.6,
                damage: 0.6,
                speed: 0.5,
                scatterRate: 1,
                lifeLength: 0.25,
                absorbtionFactor: 1
              }
            }
          ]
        }
      }
    ],
    preAddons: [
      {
        kind: "launcher",
        angle: 3.141592653589793,
        length: 92.63095419887,
        width: 33.6
      }
    ],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "gunner-trapper",
    name: "Gunner Trapper",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "gunner",
      "trapper"
    ],
    barrels: [
      {
        angle: 0,
        offset: -16,
        size: 75,
        width: 21,
        delay: 0.66,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.5,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 16,
        size: 75,
        width: 21,
        delay: 0.33,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.5,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 3.141593,
        offset: 0,
        size: 60,
        width: 54.6,
        delay: 0,
        reload: 3,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "trap",
          sizeRatio: 0.8,
          health: 2,
          damage: 1,
          speed: 2,
          scatterRate: 1,
          lifeLength: 8,
          absorbtionFactor: 1
        },
        cap: "trapLauncher"
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "hybrid",
    name: "Hybrid",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "destroyer"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 71.4,
        delay: 0,
        reload: 4,
        recoil: 15,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 2.4,
          damage: 3,
          speed: 0.7,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 0.1
        }
      },
      {
        angle: 3.141593,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 1.4,
          damage: 0.7,
          speed: 1,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 2,
          controllable: false
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "landmine",
    name: "Landmine",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "smasher"
    ],
    barrels: [],
    preAddons: [
      {
        kind: "guard",
        guards: [
          {
            sides: 6,
            sizeRatio: 1.15,
            offsetAngle: 0,
            spin: 0.1
          },
          {
            sides: 6,
            sizeRatio: 1.15,
            offsetAngle: 0,
            spin: 0.05
          }
        ]
      }
    ],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {
      invisible: true
    },
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    invisibility: {
      fadeRate: 0.003,
      moveRate: 0.16,
      shootRate: 0,
      damageAmount: 0.2
    },
    statCaps: {
      moveSpeed: 10,
      bodyDamage: 10,
      maxHealth: 10,
      regen: 10
    },
    hiddenStats: [
      "reload",
      "bulletDamage",
      "bulletPen",
      "bulletSpeed"
    ]
  },
  {
    id: "manager",
    name: "Manager",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "overseer"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 3,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 2,
          damage: 0.7,
          speed: 0.8,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 8,
          controllable: true
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {
      invisible: true
    },
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    invisibility: {
      fadeRate: 0.03,
      moveRate: 0.08,
      shootRate: 0,
      damageAmount: 0.2
    },
    statNames: {
      bulletDamage: "Drone Damage",
      bulletPen: "Drone Health",
      bulletSpeed: "Drone Speed"
    }
  },
  {
    id: "mega-trapper",
    name: "Mega Trapper",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "trapper"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 60,
        width: 54.6,
        delay: 0,
        reload: 3.3,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "trap",
          sizeRatio: 1.28,
          health: 3.2,
          damage: 1.6,
          speed: 2,
          scatterRate: 1,
          lifeLength: 8,
          absorbtionFactor: 1
        },
        cap: "trapLauncher"
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "necromancer",
    name: "Necromancer",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "overseer"
    ],
    barrels: [
      {
        angle: -1.570796,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "necroDrone",
          sizeRatio: 1,
          health: 2,
          damage: 0.42,
          speed: 0.72,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          controllable: true
        }
      },
      {
        angle: 1.570796,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "necroDrone",
          sizeRatio: 1,
          health: 2,
          damage: 0.42,
          speed: 0.72,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          controllable: true
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {
      necroCapture: true
    },
    sides: 4,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    statNames: {
      reload: "Drone Count",
      bulletDamage: "Drone Damage",
      bulletPen: "Drone Health",
      bulletSpeed: "Drone Speed"
    }
  },
  {
    id: "octo-tank",
    name: "Octo Tank",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "quad-tank"
    ],
    barrels: [
      {
        angle: -0.785398,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0.785398,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -2.356194,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 2.356194,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 3.141593,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -1.570796,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 1.570796,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.65,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "overlord",
    name: "Overlord",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "overseer"
    ],
    barrels: [
      {
        angle: -1.570796,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 2,
          damage: 0.7,
          speed: 0.8,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 2,
          controllable: true
        }
      },
      {
        angle: 1.570796,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 2,
          damage: 0.7,
          speed: 0.8,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 2,
          controllable: true
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 2,
          damage: 0.7,
          speed: 0.8,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 2,
          controllable: true
        }
      },
      {
        angle: 3.141593,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 2,
          damage: 0.7,
          speed: 0.8,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 2,
          controllable: true
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    statNames: {
      bulletDamage: "Drone Damage",
      bulletPen: "Drone Health",
      bulletSpeed: "Drone Speed"
    }
  },
  {
    id: "overtrapper",
    name: "Overtrapper",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "overseer",
      "trapper"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 60,
        width: 42,
        delay: 0,
        reload: 1.5,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "trap",
          sizeRatio: 0.8,
          health: 2,
          damage: 1,
          speed: 2,
          scatterRate: 1,
          lifeLength: 8,
          absorbtionFactor: 1
        },
        cap: "trapLauncher"
      },
      {
        angle: 2.094395,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 1.4,
          damage: 0.7,
          speed: 1,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 2,
          controllable: true
        }
      },
      {
        angle: 4.18879,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0,
        reload: 6,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "drone",
          sizeRatio: 1,
          health: 1.4,
          damage: 0.7,
          speed: 1,
          scatterRate: 1,
          lifeLength: -1,
          absorbtionFactor: 1,
          maxCount: 2,
          controllable: false
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "penta-shot",
    name: "Penta Shot",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "triple-shot"
    ],
    barrels: [
      {
        angle: -0.785398,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0.66,
        reload: 1,
        recoil: 0.7,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.5,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0.785398,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0.66,
        reload: 1,
        recoil: 0.7,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.5,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -0.392699,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0.33,
        reload: 1,
        recoil: 0.7,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.5,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0.392699,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0.33,
        reload: 1,
        recoil: 0.7,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.5,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 110,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 0.7,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.5,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "predator",
    name: "Predator",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "hunter"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 110,
        width: 42,
        delay: 0,
        reload: 3,
        recoil: 0.3,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.75,
          speed: 1.4,
          scatterRate: 0.3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 56.7,
        delay: 0.2,
        reload: 3,
        recoil: 0.3,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.75,
          speed: 1.4,
          scatterRate: 0.3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 80,
        width: 71.4,
        delay: 0.4,
        reload: 3,
        recoil: 0.3,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.75,
          speed: 1.4,
          scatterRate: 0.3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.85,
    flags: {
      zoom: true
    },
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "ranger",
    name: "Ranger",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "assassin"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 120,
        width: 42,
        delay: 0,
        reload: 2,
        recoil: 3,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1.5,
          scatterRate: 0.3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [
      {
        kind: "pronounced",
        length: 50,
        width: 42,
        centerX: 40
      }
    ],
    fieldFactor: 0.7,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "rocketeer",
    name: "Rocketeer",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "destroyer"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 80,
        width: 52.5,
        delay: 0,
        reload: 4,
        recoil: 3,
        shape: "trapezoidBase",
        projectile: {
          kind: "rocket",
          sizeRatio: 1,
          health: 5,
          damage: 1,
          speed: 0.3,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 0.1,
          startupDelay: 15,
          barrels: [
            {
              angle: 3.141592653589793,
              offset: 0,
              size: 70,
              width: 36,
              delay: 0,
              reload: 0.15,
              recoil: 3.3,
              shape: "trapezoidMuzzle",
              projectile: {
                kind: "bullet",
                sizeRatio: 1,
                health: 0.3,
                damage: 0.6,
                speed: 1.5,
                scatterRate: 5,
                lifeLength: 0.1,
                absorbtionFactor: 1
              }
            }
          ]
        }
      }
    ],
    preAddons: [
      {
        kind: "launcher",
        angle: 0,
        length: 92.63098833543773,
        width: 33.6
      }
    ],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "skimmer",
    name: "Skimmer",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "destroyer"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 80,
        width: 71.4,
        delay: 0,
        reload: 4,
        recoil: 3,
        shape: "rect",
        projectile: {
          kind: "skimmer",
          sizeRatio: 1,
          health: 3,
          damage: 1,
          speed: 0.5,
          scatterRate: 1,
          lifeLength: 1.3,
          absorbtionFactor: 0.1,
          spinRate: 0.1,
          barrels: [
            {
              angle: 0,
              offset: 0,
              size: 70,
              width: 42,
              delay: 0,
              reload: 0.35,
              recoil: 0,
              shape: "rect",
              projectile: {
                kind: "bullet",
                sizeRatio: 1,
                health: 0.3,
                damage: 0.6,
                speed: 1.1,
                scatterRate: 1,
                lifeLength: 0.25,
                absorbtionFactor: 1
              }
            },
            {
              angle: 3.141592653589793,
              offset: 0,
              size: 70,
              width: 42,
              delay: 0,
              reload: 0.35,
              recoil: 0,
              shape: "rect",
              projectile: {
                kind: "bullet",
                sizeRatio: 1,
                health: 0.3,
                damage: 0.6,
                speed: 1.1,
                scatterRate: 1,
                lifeLength: 0.25,
                absorbtionFactor: 1
              }
            }
          ]
        }
      }
    ],
    preAddons: [
      {
        kind: "launcher",
        angle: 0,
        length: 92.63098833543773,
        width: 33.6
      }
    ],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "spike",
    name: "Spike",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "smasher"
    ],
    barrels: [],
    preAddons: [
      {
        kind: "guard",
        guards: [
          {
            sides: 3,
            sizeRatio: 1.3,
            offsetAngle: 0,
            spin: 0.17
          },
          {
            sides: 3,
            sizeRatio: 1.3,
            offsetAngle: 1.0471975511965976,
            spin: 0.17
          },
          {
            sides: 3,
            sizeRatio: 1.3,
            offsetAngle: 0.5235987755982988,
            spin: 0.17
          },
          {
            sides: 3,
            sizeRatio: 1.3,
            offsetAngle: 1.5707963267948966,
            spin: 0.17
          }
        ]
      }
    ],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    statCaps: {
      moveSpeed: 10,
      bodyDamage: 10,
      maxHealth: 10,
      regen: 10
    },
    hiddenStats: [
      "reload",
      "bulletDamage",
      "bulletPen",
      "bulletSpeed"
    ]
  },
  {
    id: "sprayer",
    name: "Sprayer",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "machine-gun"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 110,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 0,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.1,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 0.5,
        recoil: 1,
        shape: "trapezoidMuzzle",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.7,
          speed: 1,
          scatterRate: 3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "spread-shot",
    name: "Spread Shot",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "triple-shot"
    ],
    barrels: [
      {
        angle: 1.308997,
        offset: 0,
        size: 65,
        width: 29.4,
        delay: 0.833325,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -1.308997,
        offset: 0,
        size: 65,
        width: 29.4,
        delay: 0.833325,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 1.047198,
        offset: 0,
        size: 71,
        width: 29.4,
        delay: 0.666675,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -1.047198,
        offset: 0,
        size: 71,
        width: 29.4,
        delay: 0.666675,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0.785398,
        offset: 0,
        size: 77,
        width: 29.4,
        delay: 0.5,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -0.785398,
        offset: 0,
        size: 77,
        width: 29.4,
        delay: 0.5,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0.523599,
        offset: 0,
        size: 83,
        width: 29.4,
        delay: 0.333325,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -0.523599,
        offset: 0,
        size: 83,
        width: 29.4,
        delay: 0.333325,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0.261799,
        offset: 0,
        size: 89,
        width: 29.4,
        delay: 0.166675,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -0.261799,
        offset: 0,
        size: 89,
        width: 29.4,
        delay: 0.166675,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 0.55,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 2,
        recoil: 0.1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "stalker",
    name: "Stalker",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "assassin"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 120,
        width: 42,
        delay: 0,
        reload: 2,
        recoil: 3,
        shape: "trapezoidBase",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 1,
          damage: 1,
          speed: 1.5,
          scatterRate: 0.3,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.8,
    flags: {
      invisible: true
    },
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1,
    invisibility: {
      fadeRate: 0.03,
      moveRate: 0.08,
      shootRate: 0.23,
      damageAmount: 0.2
    }
  },
  {
    id: "streamliner",
    name: "Streamliner",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "hunter",
      "gunner"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 110,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.2,
          speed: 1.1,
          scatterRate: 0.3,
          lifeLength: 0.8,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 100,
        width: 42,
        delay: 0.2,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.2,
          speed: 1.1,
          scatterRate: 0.3,
          lifeLength: 0.8,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 90,
        width: 42,
        delay: 0.4,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.2,
          speed: 1.1,
          scatterRate: 0.3,
          lifeLength: 0.8,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 80,
        width: 42,
        delay: 0.6,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.2,
          speed: 1.1,
          scatterRate: 0.3,
          lifeLength: 0.8,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 70,
        width: 42,
        delay: 0.8,
        reload: 1,
        recoil: 0.2,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 0.7,
          health: 1,
          damage: 0.2,
          speed: 1.1,
          scatterRate: 0.3,
          lifeLength: 0.8,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.85,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "tri-trapper",
    name: "Tri-Trapper",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "trapper"
    ],
    barrels: [
      {
        angle: 0,
        offset: 0,
        size: 60,
        width: 42,
        delay: 0,
        reload: 1.5,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "trap",
          sizeRatio: 0.8,
          health: 2,
          damage: 1,
          speed: 2,
          scatterRate: 1,
          lifeLength: 3.2,
          absorbtionFactor: 1
        },
        cap: "trapLauncher"
      },
      {
        angle: 2.094395,
        offset: 0,
        size: 60,
        width: 42,
        delay: 0,
        reload: 1.5,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "trap",
          sizeRatio: 0.8,
          health: 2,
          damage: 1,
          speed: 2,
          scatterRate: 1,
          lifeLength: 3.2,
          absorbtionFactor: 1
        },
        cap: "trapLauncher"
      },
      {
        angle: 4.18879,
        offset: 0,
        size: 60,
        width: 42,
        delay: 0,
        reload: 1.5,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "trap",
          sizeRatio: 0.8,
          health: 2,
          damage: 1,
          speed: 2,
          scatterRate: 1,
          lifeLength: 3.2,
          absorbtionFactor: 1
        },
        cap: "trapLauncher"
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 0.9,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "triple-twin",
    name: "Triple Twin",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "twin-flank"
    ],
    barrels: [
      {
        angle: 0,
        offset: -26,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 26,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 2.094395,
        offset: -26,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 2.094395,
        offset: 26,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -2.094395,
        offset: -26,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: -2.094395,
        offset: 26,
        size: 95,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.9,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  },
  {
    id: "triplet",
    name: "Triplet",
    tier: 4,
    unlockLevel: 45,
    upgradesTo: [],
    upgradesFrom: [
      "triple-shot"
    ],
    barrels: [
      {
        angle: 0,
        offset: -26,
        size: 80,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 0.5,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.7,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 26,
        size: 80,
        width: 42,
        delay: 0.5,
        reload: 1,
        recoil: 0.5,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.7,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      },
      {
        angle: 0,
        offset: 0,
        size: 95,
        width: 42,
        delay: 0,
        reload: 1,
        recoil: 0.5,
        shape: "rect",
        projectile: {
          kind: "bullet",
          sizeRatio: 1,
          health: 0.7,
          damage: 0.6,
          speed: 1,
          scatterRate: 1,
          lifeLength: 1,
          absorbtionFactor: 1
        }
      }
    ],
    preAddons: [],
    postAddons: [],
    fieldFactor: 1,
    flags: {},
    sides: 1,
    absorbtionFactor: 1,
    speedMultiplier: 1
  }
];
