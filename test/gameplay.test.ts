import { describe, expect, it } from "vitest";
import { defaultInputScript, judgeReachedGameplay } from "../src/ops/gameplay.js";

describe("defaultInputScript", () => {
  it("clicks the stage center first, then likely button spots, then keys", () => {
    const script = defaultInputScript(640, 480);
    expect(script[0]).toEqual({ kind: "click", x: 320, y: 240, label: "center" });
    const clicks = script.filter((a) => a.kind === "click");
    const keys = script.filter((a) => a.kind === "key");
    expect(clicks.length).toBe(3);
    expect(keys.map((k) => (k.kind === "key" ? k.key : ""))).toEqual(["Enter", "Space", "ArrowRight", "ArrowUp"]);
    // Button spots sit below center.
    expect((clicks[1] as { y: number }).y).toBeGreaterThan(240);
    expect((clicks[2] as { y: number }).y).toBeGreaterThan((clicks[1] as { y: number }).y);
  });

  it("rounds and guards tiny or odd stages", () => {
    const script = defaultInputScript(1, 1);
    expect(script[0]).toEqual({ kind: "click", x: 1, y: 1, label: "center" });
  });
});

describe("judgeReachedGameplay", () => {
  it("reaches gameplay when a static title starts animating after input", () => {
    const idle = [0.0005, 0.0005, 0.0005, 0.0005];
    const post = [0.05, 0.06, 0.055, 0.05, 0.06];
    const j = judgeReachedGameplay(idle, post);
    expect(j.reached).toBe(true);
    expect(j.idleActivity).toBeCloseTo(0.0005, 4);
    expect(j.postInputActivity).toBeGreaterThan(0.04);
  });

  it("reaches gameplay when motion clearly exceeds an already-animated title", () => {
    const idle = [0.02, 0.02, 0.02, 0.02];
    const post = [0.08, 0.09, 0.08, 0.085, 0.08];
    expect(judgeReachedGameplay(idle, post).reached).toBe(true);
  });

  it("reports boots when input does not move the stage more than the idle title", () => {
    const idle = [0.03, 0.03, 0.03, 0.03];
    const post = [0.03, 0.031, 0.029, 0.03, 0.03];
    const j = judgeReachedGameplay(idle, post);
    expect(j.reached).toBe(false);
    expect(j.reason).toMatch(/no more than the idle/i);
  });

  it("reports boots when the stage stays static after input", () => {
    const idle = [0.001, 0.001, 0.001];
    const post = [0.0005, 0.0005, 0.0005, 0.0005];
    const j = judgeReachedGameplay(idle, post);
    expect(j.reached).toBe(false);
    expect(j.reason).toMatch(/static/i);
  });

  it("reports boots on a one-off blip that does not continue", () => {
    const idle = [0.001, 0.001, 0.001];
    const post = [0.2, 0.001, 0.001, 0.001, 0.001];
    const j = judgeReachedGameplay(idle, post);
    expect(j.reached).toBe(false);
    expect(j.reason).toMatch(/did not continue|brief/i);
  });

  it("reports boots when no frames were sampled after input", () => {
    const j = judgeReachedGameplay([0.01, 0.01], []);
    expect(j.reached).toBe(false);
    expect(j.reason).toMatch(/no frames/i);
  });
});
