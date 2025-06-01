import { scheduler } from "node:timers/promises";
import { forceCenter, forceSimulation } from "../src/index.ts";
import { assertNodeEqual } from "./asserts.js";

Deno.test("forceCenter repositions nodes", async () => {
  const center = forceCenter(0, 0);
  const f = forceSimulation().force("center", center).stop();
  const a = { x: 100, y: 0 }, b = { x: 200, y: 0 }, c = { x: 300, y: 0 };
  f.nodes([a, b, c]);
  f.tick();
  assertNodeEqual(a, { index: 0, x: -100, y: 0, vy: 0, vx: 0 });
  assertNodeEqual(b, { index: 1, x: 0, y: 0, vy: 0, vx: 0 });
  assertNodeEqual(c, { index: 2, x: 100, y: 0, vy: 0, vx: 0 });
  await scheduler.wait(30);
});

Deno.test("forceCenter respects fixed positions", async () => {
  const center = forceCenter();
  const f = forceSimulation().force("center", center).stop();
  const a = { fx: 0, fy: 0 }, b = {}, c = {};
  f.nodes([a, b, c]);
  f.tick();
  assertNodeEqual(a, { fx: 0, fy: 0, index: 0, x: 0, y: 0, vy: 0, vx: 0 });
  await scheduler.wait(30);
});
