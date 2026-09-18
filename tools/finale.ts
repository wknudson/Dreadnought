/**
 * Plays the last fight on its own, many times.
 *
 * The full harness does reach wave twenty-five — about ten times in a thirty-six
 * seed sweep on normal — so the finale is not unobserved. But those ten are the
 * strongest quarter of runs, they cost a whole sweep to collect, and the sweep
 * reports one number for the fight: how long it took. A phase that never ends,
 * or a cull that never fires, looks from up there like a fight that ran long.
 *
 * This drops a levelled bot straight onto the last wave instead. One wave per
 * seed rather than twenty-five makes each trial cheap enough to run dozens of,
 * and it keeps working whatever the balance of the twenty-four waves in front of
 * it happens to be, which is the part that matters while that balance is moving.
 *
 * What it is looking for, in order: a fight that never ends, a phase that never
 * ends, and culls that never fire. The first two are the failure the wave layer
 * has produced before; the third would mean the fight is running with its
 * mechanic switched off and nobody noticing.
 *
 * What it is NOT: a difficulty measurement. The bot arrives here with forty-four
 * randomly taken cards rather than with a build that survived twenty-four waves,
 * so this population is weaker and far more varied than the one that reaches the
 * Overlord by playing. That makes it a better stall test and a worse balance
 * test. For how hard the fight is, read the full harness.
 *
 * Run with: npm run finale
 */
import { Run } from '../src/sim/run.ts';
import { Rng } from '../src/core/rng.ts';
import { TICKS_PER_SECOND } from '../src/core/loop.ts';
import type { DifficultyId } from '../src/core/storage.ts';
import { FINAL_WAVE } from '../src/data/waves.ts';
import { MAX_LEVEL } from '../src/data/leveling.ts';
import { botTick, answerChoices, median } from './bot.ts';

/**
 * How long one fight may run before it is called stuck, in ticks.
 *
 * Six minutes. The longest boss fight the full harness has recorded is about a
 * minute, and the Vise takes fifty seconds to close on top of that, so anything
 * past six is not a long fight but a fight that is not resolving.
 */
const FIGHT_LIMIT = TICKS_PER_SECOND * 60 * 6;

interface Trial {
  seed: number;
  difficulty: DifficultyId;
  outcome: string;
  /** Seconds the whole fight took. */
  seconds: number;
  /** Seconds spent in each phase, in order. */
  phaseSeconds: number[];
  /** Drones the walls swept away. */
  culled: number;
  /** How far the phases got, so a fight that ended early is not read as a pass. */
  phasesSeen: number;
  /**
   * What was left of the boss when the fight ended.
   *
   * The difference between a deadlock and a grind, which the outcome alone does
   * not say: a fight cut off at the limit with the boss at 30% was resolving
   * slowly, and one cut off at 95% was not resolving at all.
   */
  bossLeft: number;
  tank: string;
}

function playFinale(seed: number, difficulty: DifficultyId): Trial {
  const run = new Run({ seed, difficulty, color: '#00B2E1' });
  const choiceRng = new Rng(seed ^ 0x51f0d10e);

  // A real build rather than a bare level-45 hull: the cards and the class are
  // what the fight meets, and they are taken the same way the full harness takes
  // them so the two harnesses are at least describing the same kind of player.
  while (run.level < MAX_LEVEL) {
    run.debugGrantLevel();
    answerChoices(run, choiceRng);
  }

  run.waves.jumpTo(FINAL_WAVE);

  const phaseTicks = new Map<string, number>();
  const order: string[] = [];
  let ticks = 0;
  let culled = 0;
  let bossLeft = 0;

  while (!run.over && ticks < FIGHT_LIMIT) {
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

  return {
    seed,
    difficulty,
    outcome: ticks >= FIGHT_LIMIT ? 'STUCK' : run.outcome,
    seconds: Math.round(ticks / TICKS_PER_SECOND),
    phaseSeconds: order.map((p) => Math.round((phaseTicks.get(p) ?? 0) / TICKS_PER_SECOND)),
    culled,
    phasesSeen: order.length,
    bossLeft: Math.round(bossLeft * 100),
    tank: run.player.def.name,
  };
}

function main(): void {
  const seeds = [11, 22, 33, 44, 55, 66, 77, 88, 99, 111, 222, 333, 444, 555, 666, 777];
  const difficulties: DifficultyId[] = ['easy', 'normal', 'hard'];
  const all: Trial[] = [];

  for (const difficulty of difficulties) {
    console.log(`\n=== ${difficulty} ===`);
    for (const seed of seeds) {
      const t = playFinale(seed, difficulty);
      all.push(t);
      const phases = t.phaseSeconds.length ? t.phaseSeconds.join(' / ') : 'none';
      console.log(
        `  seed ${String(t.seed).padStart(3)}  ${t.outcome.padEnd(5)}  ` +
          `${String(t.seconds).padStart(3)}s  phases ${phases.padEnd(14)} ` +
          `culled ${String(t.culled).padStart(3)}  ${t.tank}`,
      );
    }

    const group = all.filter((t) => t.difficulty === difficulty);
    const resolved = group.filter((t) => t.outcome !== 'STUCK');
    const won = group.filter((t) => t.outcome === 'won');
    console.log(
      `  -> resolved ${resolved.length}/${group.length}` +
        `, won ${won.length}/${group.length}` +
        `, median fight ${median(group.map((t) => t.seconds))}s` +
        `, median culled ${median(group.map((t) => t.culled))}`,
    );
  }

  // The three things this harness exists to catch, stated plainly.
  const stuck = all.filter((t) => t.outcome === 'STUCK');
  const reachedVise = all.filter((t) => t.phasesSeen >= 3);
  const culledNothing = all.filter((t) => t.phasesSeen >= 2 && t.culled === 0);

  console.log('');
  if (stuck.length) {
    console.log(`FAIL: ${stuck.length}/${all.length} fights hit the six-minute limit.`);
    for (const t of stuck) {
      console.log(
        `  ${t.difficulty} seed ${t.seed}: reached phase ${t.phasesSeen} of 3, ` +
          `boss still on ${t.bossLeft}% — ` +
          `${t.bossLeft > 60 ? 'not resolving' : 'resolving, but too slowly'}`,
      );
    }
  } else {
    console.log(`Every one of ${all.length} fights resolved inside six minutes.`);
  }

  console.log(
    `Reached the Vise in ${reachedVise.length}/${all.length}; ` +
      `median fight ${median(all.map((t) => t.seconds))}s across all difficulties.`,
  );

  // Not a failure. The bot never baits the swarm anywhere on purpose, so a cull
  // that catches nothing usually means the drones happened to be near the middle
  // when the walls moved. It is reported because a run of zeroes across every
  // single fight would mean the cull had stopped firing altogether, and that is
  // the one way this mechanic can break without anything else looking wrong.
  const culledSomething = all.filter((t) => t.culled > 0).length;
  console.log(
    `Culls caught something in ${culledSomething}/${all.length} fights ` +
      `(${culledNothing.length} passed a wall and caught nothing, which a bot that ` +
      `never baits is expected to do; zero across the board would mean it is broken).`,
  );

  if (stuck.length) process.exitCode = 1;
}

main();
