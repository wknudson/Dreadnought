/**
 * The bot both harnesses play with.
 *
 * Deliberately mediocre: it kites at a fixed distance, fires constantly, and
 * never dodges. A competent player will clear faster, so its numbers are an
 * upper bound on how long something takes rather than a target.
 *
 * It lives here rather than inside one harness because two copies of a bot are
 * two different games. A finale that terminates under a bot that dodges tells
 * you nothing about a full run measured with one that does not.
 */
import type { Run } from '../src/sim/run.ts';
import type { Rng } from '../src/core/rng.ts';
import { vec } from '../src/core/math.ts';

/**
 * Takes whatever the level-up is asking for, at random.
 *
 * Random rather than best-first so different seeds explore different builds; a
 * harness where every run takes the same card measures one build many times.
 */
export function answerChoices(run: Run, rng: Rng): void {
  while (run.waitingOnChoice) {
    const next = run.pendingChoices[0];
    if (next === 'class') {
      const options = run.classOptions();
      if (options.length) run.upgradeTo(rng.pick(options));
      else run.consumeChoice('class');
    } else {
      const hand = run.dealHand();
      if (hand.length) run.takeCard(rng.pick(hand));
      else run.consumeChoice(next!);
    }
  }
}

/** The nearest thing worth shooting, ignoring shots already in flight. */
function nearestEnemy(run: Run): { pos: { x: number; y: number }; distance: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const e of run.world.entities) {
    if (!e.alive || e.team !== 'enemy' || e.kind === 'projectile') continue;
    const d = Math.hypot(e.pos.x - run.player.pos.x, e.pos.y - run.player.pos.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = e.pos;
    }
  }
  return best ? { pos: best, distance: bestDistance } : null;
}

/** Answers any pending choice, then drives one tick of the simulation. */
export function botTick(run: Run, choiceRng: Rng): void {
  answerChoices(run, choiceRng);

  const target = nearestEnemy(run);
  const aim = target
    ? Math.atan2(target.pos.y - run.player.pos.y, target.pos.x - run.player.pos.x)
    : 0;
  const distance = target?.distance ?? Number.POSITIVE_INFINITY;
  // Back off when crowded, close when out of reach, circle in between.
  const heading = distance < 450 ? aim + Math.PI : distance > 900 ? aim : aim + Math.PI / 2;

  run.applyIntent(
    {
      move: target ? vec(Math.cos(heading), Math.sin(heading)) : vec(),
      aimAngle: aim,
      aimWorld: vec(
        run.player.pos.x + Math.cos(aim) * 800,
        run.player.pos.y + Math.sin(aim) * 800,
      ),
      fire: true,
      secondary: false,
      autoFire: true,
      autoSpin: false,
    },
    aim,
  );
  run.tick();
}

export const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};
