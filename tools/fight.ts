/**
 * Plays one wave on its own, many times, and reports whether it ends.
 *
 * A full sweep plays twenty-five waves to reach the fifth boss, so when most
 * runs die at wave five the late waves are measured by whatever survived, a
 * handful of times, at the cost of the whole sweep. This drops a levelled bot
 * straight onto one wave instead. A trial is then cheap enough to run dozens of,
 * and the reading does not depend on the balance of the waves in front of it —
 * which matters most while that balance is the thing being changed.
 *
 * It answers one question: does this fight end, and how long does it take. It
 * sees a wave that grinds before anyone loses to it, which is the failure a
 * win-rate sweep reports last and this reports first.
 *
 * It does NOT measure difficulty, and the output says so every time it runs. The
 * bot takes its cards at random rather than assembling a build, so this
 * population is weaker and far more varied than one that played its way here.
 * Worse, how strong it is moves with the card rate: cards are rolled per slot
 * against `perkChance`, so raising the rate spends slots on perks that would
 * have been stat points. A reading taken at one rate is not comparable to one
 * taken at another, and the population line is printed so that is hard to miss.
 *
 *   npm run finale                                  the last fight, all difficulties
 *   npm run fight -- --wave 15 --difficulty hard    one boss, one difficulty
 *   npm run fight -- --wave 15 --perk-chance 0.35,0.52
 *   npm run fight -- --wave 20 --level 38 --seeds 24
 */
import { Run } from '../src/sim/run.ts';
import { Rng } from '../src/core/rng.ts';
import { TICKS_PER_SECOND } from '../src/core/loop.ts';
import type { DifficultyId } from '../src/core/storage.ts';
import { FINAL_WAVE } from '../src/data/waves.ts';
import { MAX_LEVEL, CLASS_LEVELS } from '../src/data/leveling.ts';
import { STAT_ORDER } from '../src/data/schema.ts';
import { botTick, answerChoices, median } from './bot.ts';

/**
 * How long one fight may run before it is called stuck, in ticks.
 *
 * Six minutes. The longest boss fight a full sweep has recorded is about a
 * minute, and the last fight's closing arena takes fifty seconds on top of that,
 * so past six is not a long fight but a fight that is not resolving.
 */
const FIGHT_LIMIT = TICKS_PER_SECOND * 60 * 6;

const DEFAULT_SEEDS = [11, 22, 33, 44, 55, 66, 77, 88, 99, 111, 222, 333, 444, 555, 666, 777];
const ALL_DIFFICULTIES: DifficultyId[] = ['easy', 'normal', 'hard'];

/**
 * The level a player would plausibly arrive at a wave with.
 *
 * Pinned to the class cadence, which is the game's own statement about how far
 * along a player is: a class at fifteen, another at thirty, the last at
 * forty-five, arriving at waves five, fifteen and twenty-five. A level chosen
 * any other way makes the reading a statement about a player who does not exist.
 */
function defaultLevel(wave: number): number {
  const [first, , last] = CLASS_LEVELS as unknown as [number, number, number];
  const span = (last - first) / (FINAL_WAVE - 5);
  return Math.max(1, Math.min(MAX_LEVEL, Math.round(first + (wave - 5) * span)));
}

interface Trial {
  seed: number;
  outcome: 'cleared' | 'died' | 'STUCK';
  seconds: number;
  /** What was left of the boss, so a timeout says deadlock or grind. */
  bossLeft: number;
  /** Seconds in each arena phase, where the wave has them. */
  phaseSeconds: number[];
  culled: number;
  /** Stat points the bot's cards actually bought, which the card rate moves. */
  statPoints: number;
  perks: number;
  tank: string;
}

interface Setup {
  wave: number;
  level: number;
  difficulty: DifficultyId;
  perkChance: number | null;
}

function playFight(seed: number, setup: Setup): Trial {
  // The override is omitted rather than passed as undefined, so a run with no
  // rate to force is byte-for-byte the run the game would have made.
  const run = new Run({
    seed,
    difficulty: setup.difficulty,
    color: '#00B2E1',
    ...(setup.perkChance === null ? {} : { difficultyOverrides: { perkChance: setup.perkChance } }),
  });
  const choiceRng = new Rng(seed ^ 0x51f0d10e);

  while (run.level < setup.level) {
    run.debugGrantLevel();
    answerChoices(run, choiceRng);
  }

  const statPoints = STAT_ORDER.reduce((total, stat) => total + (run.player.points[stat] ?? 0), 0);
  run.waves.jumpTo(setup.wave);

  const phaseTicks = new Map<string, number>();
  const order: string[] = [];
  let ticks = 0;
  let culled = 0;
  let bossLeft = 0;

  // Stops when the wave is done with, not when the run is: every wave but the
  // last hands over to a breather rather than ending anything.
  while (
    !run.over &&
    run.wave === setup.wave &&
    run.waves.phase !== 'breather' &&
    ticks < FIGHT_LIMIT
  ) {
    botTick(run, choiceRng);
    ticks++;

    const finale = run.finale;
    if (finale) {
      if (!phaseTicks.has(finale.phase)) order.push(finale.phase);
      phaseTicks.set(finale.phase, (phaseTicks.get(finale.phase) ?? 0) + 1);
      culled = finale.culled;
    }
    const boss = run.world.entities.find((e) => e.alive && (e as { isBoss?: boolean }).isBoss);
    bossLeft = boss && boss.maxHealth > 0 ? boss.health / boss.maxHealth : 0;
  }

  const outcome = ticks >= FIGHT_LIMIT ? 'STUCK' : run.outcome === 'died' ? 'died' : 'cleared';

  return {
    seed,
    outcome,
    seconds: Math.round(ticks / TICKS_PER_SECOND),
    bossLeft: Math.round(bossLeft * 100),
    phaseSeconds: order.map((p) => Math.round((phaseTicks.get(p) ?? 0) / TICKS_PER_SECOND)),
    culled,
    statPoints,
    perks: run.perkSummary().length,
    tank: run.player.def.name,
  };
}

function runBlock(setup: Setup, seeds: number[]): Trial[] {
  const rate = setup.perkChance === null ? 'default' : setup.perkChance.toFixed(2);
  console.log(`\n=== wave ${setup.wave}, ${setup.difficulty}, level ${setup.level}, perkChance ${rate} ===`);

  const trials = seeds.map((seed) => playFight(seed, setup));
  for (const t of trials) {
    const phases = t.phaseSeconds.length ? `  phases ${t.phaseSeconds.join('/')}` : '';
    const culled = t.culled ? `  culled ${t.culled}` : '';
    console.log(
      `  seed ${String(t.seed).padStart(3)}  ${t.outcome.padEnd(7)}  ` +
        `${String(t.seconds).padStart(3)}s  boss left ${String(t.bossLeft).padStart(3)}%` +
        `${phases}${culled}  ${t.tank}`,
    );
  }

  const stuck = trials.filter((t) => t.outcome === 'STUCK');
  const cleared = trials.filter((t) => t.outcome === 'cleared');
  console.log(
    `  -> resolved ${trials.length - stuck.length}/${trials.length}` +
      `, cleared ${cleared.length}/${trials.length}` +
      `, median ${median(trials.map((t) => t.seconds))}s`,
  );
  // The population, every time, because it is what the reading is about.
  console.log(
    `     population: median ${median(trials.map((t) => t.statPoints))} stat points and ` +
      `${median(trials.map((t) => t.perks))} perks from ${setup.level} levels ` +
      `at perkChance ${rate} — termination only, not difficulty.`,
  );
  return trials;
}

function parseArgs(argv: string[]): {
  wave: number;
  level: number | null;
  difficulties: DifficultyId[];
  rates: (number | null)[];
  seeds: number[];
} {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : null;
  };

  const wave = Number(get('--wave') ?? FINAL_WAVE);
  if (!Number.isInteger(wave) || wave < 1 || wave > FINAL_WAVE) {
    throw new Error(`--wave must be between 1 and ${FINAL_WAVE}`);
  }

  const levelRaw = get('--level');
  const level = levelRaw === null ? null : Number(levelRaw);
  if (level !== null && (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL)) {
    throw new Error(`--level must be between 1 and ${MAX_LEVEL}`);
  }

  const difficultyRaw = get('--difficulty');
  const difficulties =
    difficultyRaw === null || difficultyRaw === 'all'
      ? ALL_DIFFICULTIES
      : (difficultyRaw.split(',') as DifficultyId[]);
  for (const d of difficulties) {
    if (!ALL_DIFFICULTIES.includes(d)) throw new Error(`unknown difficulty ${d}`);
  }

  const rateRaw = get('--perk-chance');
  const rates: (number | null)[] =
    rateRaw === null ? [null] : rateRaw.split(',').map((r) => Number(r));
  for (const r of rates) {
    if (r !== null && !(r >= 0 && r <= 1)) throw new Error('--perk-chance must be 0 to 1');
  }

  const count = Number(get('--seeds') ?? DEFAULT_SEEDS.length);
  const seeds = DEFAULT_SEEDS.slice(0, Math.max(1, Math.min(count, DEFAULT_SEEDS.length)));

  return { wave, level, difficulties, rates, seeds };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const level = args.level ?? defaultLevel(args.wave);
  const all: Trial[] = [];

  for (const difficulty of args.difficulties) {
    for (const perkChance of args.rates) {
      all.push(...runBlock({ wave: args.wave, level, difficulty, perkChance }, args.seeds));
    }
  }

  const stuck = all.filter((t) => t.outcome === 'STUCK');
  console.log('');
  if (stuck.length) {
    console.log(`FAIL: ${stuck.length}/${all.length} fights hit the six-minute limit.`);
    for (const t of stuck) {
      console.log(
        `  seed ${t.seed}: boss still on ${t.bossLeft}% — ` +
          `${t.bossLeft > 60 ? 'not resolving' : 'resolving, but too slowly'}`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log(`Every one of ${all.length} fights resolved inside six minutes.`);
  }

  const withPhases = all.filter((t) => t.phaseSeconds.length > 0);
  if (withPhases.length) {
    const reachedLast = withPhases.filter((t) => t.phaseSeconds.length >= 3).length;
    const caught = withPhases.filter((t) => t.culled > 0).length;
    console.log(
      `Arena phases ran in ${withPhases.length} fights, reaching the last in ${reachedLast}. ` +
        `Culls caught something in ${caught} — a bot that never baits is expected to miss, ` +
        `but zero across the board would mean the cull had stopped firing.`,
    );
  }
}

main();
