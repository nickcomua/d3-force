import assert from "node:assert";
import { forceSimulation, forceX, forceY } from "../src/index.ts";
import { assertNodeEqual } from "./asserts.js";
import { scheduler } from "node:timers/promises";

Deno.test("forceX centers nodes", async () => {
  const x = forceX(200);
  const f = forceSimulation().force("x", x).stop();
  const a = { x: 100, y: 0 }, b = { x: 200, y: 0 }, c = { x: 300, y: 0 };
  f.nodes([a, b, c]);
  f.tick(30);
  assert(a.x > 190);
  assert(a.vx > 0);
  assert.strictEqual(b.x, 200);
  assert.strictEqual(b.vx, 0);
  assert(c.x < 210);
  assert(c.vx < 0);
  await scheduler.wait(30);
});

Deno.test("forceY centers nodes", async () => {
  const y = forceY(200);
  const f = forceSimulation().force("y", y).stop();
  const a = { y: 100, x: 0 }, b = { y: 200, x: 0 }, c = { y: 300, x: 0 };
  f.nodes([a, b, c]);
  f.tick(30);
  assert(a.y > 190);
  assert(a.vy > 0);
  assert.strictEqual(b.y, 200);
  assert.strictEqual(b.vy, 0);
  assert(c.y < 210);
  assert(c.vy < 0);
  await scheduler.wait(30);
});

Deno.test("forceX respects fixed positions", async () => {
  const x = forceX(200);
  const f = forceSimulation().force("x", x).stop();
  const a = { fx: 0, fy: 0 }, b = {}, c = {};
  f.nodes([a, b, c]);
  f.tick();
  assertNodeEqual(a, { fx: 0, fy: 0, index: 0, x: 0, y: 0, vy: 0, vx: 0 });
  await scheduler.wait(30);
});

Deno.test("forceY respects fixed positions", async () => {
  const y = forceX(200);
  const f = forceSimulation().force("y", y).stop();
  const a = { fx: 0, fy: 0 }, b = {}, c = {};
  f.nodes([a, b, c]);
  f.tick();
  assertNodeEqual(a, { fx: 0, fy: 0, index: 0, x: 0, y: 0, vy: 0, vx: 0 });
  await scheduler.wait(30);
});

Deno.test("forceX.x() accessor", async () => {
  const x = forceX().x((d) => d.x0);
  const f = forceSimulation().force("x", x).stop();
  const a = { x: 100, y: 0, x0: 300 },
    b = { x: 200, y: 0, x0: 200 },
    c = { x: 300, y: 0, x0: 100 };
  f.nodes([a, b, c]);
  f.tick(30);
  assert(a.x > 290);
  assert(a.vx > 0);
  assert.strictEqual(b.x, 200);
  assert.strictEqual(b.vx, 0);
  assert(c.x < 110);
  assert(c.vx < 0);
  await scheduler.wait(30);
});

Deno.test("forceY.y() accessor", async () => {
  const y = forceY().y((d) => d.y0);
  const f = forceSimulation().force("y", y).stop();
  const a = { y: 100, x: 0, y0: 300 },
    b = { y: 200, x: 0, y0: 200 },
    c = { y: 300, x: 0, y0: 100 };
  f.nodes([a, b, c]);
  f.tick(30);
  assert(a.y > 290);
  assert(a.vy > 0);
  assert.strictEqual(b.y, 200);
  assert.strictEqual(b.vy, 0);
  assert(c.y < 110);
  assert(c.vy < 0);
  await scheduler.wait(30);
});
