/**
 * Plays the game without a browser, to see how long a run actually takes.
 *
 * The bot is deliberately mediocre: it kites at a fixed distance, fires
 * constantly, and never dodges. A competent player will clear faster, so treat
 * these numbers as an upper bound on run length rather than a target.
 *
 * Run with: npm run balance
 */
import { Run } from '../src/sim/run.ts';
import { Rng } from '../src/core/rng.ts';
import { TICKS_PER_SECOND } from '../src/core/loop.ts';
import { botTick, median } from './bot.ts';
import type { DifficultyId } from '../src/core/storage.ts';
import { FINAL_WAVE } from '../src/data/waves.ts';

interface Result {
  seed: number;
  difficulty: DifficultyId;
  outcome: string;
  wave: number;
  level: number;
  tank: string;
  score: number;
  minutes: number;
  /** Seconds spent on each boss wave. */
  bossTimes: number[];
  perks: number;
}

/** Roughly forty minutes, after which a run is called stuck rather than long. */
const TICK_LIMIT = TICKS_PER_SECOND * 60 * 40;

function playOne(seed: number, difficulty: DifficultyId): Result {
  const run = new Run({ seed, difficulty, color: '#00B2E1' });
  const choiceRng = new Rng(seed ^ 0x5bf03635);
  const waveAt = new Map<number, number>();
  let ticks = 0;

  while (!run.over && ticks < TICK_LIMIT) {
    botTick(run, choiceRng);
    ticks++;
    if (!waveAt.has(run.wave)) waveAt.set(run.wave, ticks);
  }

  const bossTimes: number[] = [];
  for (let wave = 5; wave <= FINAL_WAVE; wave += 5) {
    const from = waveAt.get(wave);
    const to = waveAt.get(wave + 1);
    if (from !== undefined && to !== undefined) {
      bossTimes.push(Math.round((to - from) / TICKS_PER_SECOND));
    }
  }

  return {
    seed,
    difficulty,
    outcome: ticks >= TICK_LIMIT ? 'stuck' : run.outcome,
    wave: run.wave,
    level: run.level,
    tank: run.player.def.name,
    score: Math.round(run.score),
    minutes: Number((ticks / TICKS_PER_SECOND / 60).toFixed(1)),
    bossTimes,
    perks: run.perkSummary().length,
  };
}

function main(): void {
  const seeds = [11, 22, 33, 44, 55, 66, 77, 88];
  const difficulties: DifficultyId[] = ['easy', 'normal', 'hard'];
  const all: Result[] = [];

  for (const difficulty of difficulties) {
    console.log(`\n=== ${difficulty} ===`);
    for (const seed of seeds) {
      const r = playOne(seed, difficulty);
      all.push(r);
      const bosses = r.bossTimes.length ? r.bossTimes.join(', ') : 'none reached';
      console.log(
        `  seed ${String(seed).padStart(3)}  ${r.outcome.padEnd(5)}  ` +
          `wave ${String(r.wave).padStart(2)}  lvl ${String(r.level).padStart(2)}  ` +
          `${String(r.minutes).padStart(5)} min  perks ${r.perks}  ` +
          `boss fights: ${bosses.padEnd(24)} ${r.tank}`,
      );
    }

    const group = all.filter((r) => r.difficulty === difficulty);
    const wins = group.filter((r) => r.outcome === 'won');
    const bossSeconds = group.flatMap((r) => r.bossTimes);
    console.log(
      `  -> won ${wins.length}/${group.length}` +
        `, median run ${median(group.map((r) => r.minutes))} min` +
        `, median wave reached ${median(group.map((r) => r.wave))}` +
        `, median boss fight ${median(bossSeconds)}s`,
    );
  }

  const stuck = all.filter((r) => r.outcome === 'stuck');
  if (stuck.length) {
    console.log(`\nWARNING: ${stuck.length} run(s) hit the time limit without finishing.`);
  }
}

main();
