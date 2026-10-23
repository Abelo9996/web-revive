import type { GameplayAction, GameplayJudgment } from "../types.js";

/**
 * A short, generic input script to get a game off its title screen. Most old
 * web games start on a menu that waits for a click or a confirm key. We click
 * the stage center (which also gives the player keyboard focus), then the spots
 * where a "Play" button usually sits (lower-center, then lower third), then
 * press the keys games most often use to start or move. There is no per-game
 * knowledge here; it is the same sequence every time, judged by what the stage
 * does in response. Pure, so the sequence is unit-testable.
 */
export function defaultInputScript(width: number, height: number): GameplayAction[] {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const cx = Math.round(w / 2);
  return [
    { kind: "click", x: cx, y: Math.round(h / 2), label: "center" },
    { kind: "click", x: cx, y: Math.round(h * 0.62), label: "play-area" },
    { kind: "click", x: cx, y: Math.round(h * 0.78), label: "lower-menu" },
    { kind: "key", key: "Enter" },
    { kind: "key", key: "Space" },
    { kind: "key", key: "ArrowRight" },
    { kind: "key", key: "ArrowUp" },
  ];
}

// Below this fraction of pixels changing between two frames, a stage is treated
// as static (screenshot and anti-alias noise lives here).
const STATIC_FLOOR = 0.002;
// Post-input motion must beat the idle baseline by this factor to count as more
// than the title screen's own looping animation.
const OVER_IDLE_GAIN = 1.8;

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

/**
 * Decide whether the input script reached gameplay, as opposed to a game that
 * merely boots and animates its title. The inputs are per-frame activity
 * values (the fraction of pixels that changed since the previous frame): one
 * run sampled before any input (the idle baseline) and one sampled after the
 * input script. Gameplay is called only when the stage both keeps changing and
 * changes clearly more than the idle title did; a one-off blip or motion no
 * greater than the idle loop is reported as "boots". Pure.
 */
export function judgeReachedGameplay(idle: number[], post: number[]): GameplayJudgment {
  const idleActivity = round4(mean(idle));
  const postInputActivity = round4(mean(post));

  if (post.length === 0) {
    return { reached: false, reason: "No frames were sampled after the input script.", idleActivity, postInputActivity };
  }
  if (postInputActivity <= STATIC_FLOOR) {
    return {
      reached: false,
      reason: "The stage stayed static after input; still on the title screen or not responding to generic input.",
      idleActivity,
      postInputActivity,
    };
  }

  const overIdleThreshold = Math.max(idleActivity * OVER_IDLE_GAIN, STATIC_FLOOR * 2);
  const activeFrames = post.filter((v) => v > Math.max(idleActivity, STATIC_FLOOR)).length;
  const sustained = activeFrames >= Math.ceil(post.length / 2);

  if (postInputActivity < overIdleThreshold) {
    return {
      reached: false,
      reason: "The stage kept animating but no more than the idle title screen did; treated as boots, not gameplay.",
      idleActivity,
      postInputActivity,
    };
  }
  if (!sustained) {
    return {
      reached: false,
      reason: "Input caused a brief change that did not continue; treated as boots, not sustained gameplay.",
      idleActivity,
      postInputActivity,
    };
  }
  return {
    reached: true,
    reason: "Sustained stage change after input, clearly above the idle title animation.",
    idleActivity,
    postInputActivity,
  };
}
