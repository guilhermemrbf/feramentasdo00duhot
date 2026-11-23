import assert from "node:assert/strict";
import test from "node:test";
import { dashboardGreeting } from "../src/lib/dashboard-greeting.ts";

test("Dashboard greets leads by their first name in São Paulo time", () => {
  const lead = { user_metadata: { full_name: " Beatriz Silva " } };
  assert.equal(
    dashboardGreeting(new Date("2026-11-23T14:59:59Z"), lead, false),
    "Bom dia, Beatriz!",
  );
  assert.equal(
    dashboardGreeting(new Date("2026-11-23T15:00:00Z"), lead, false),
    "Boa tarde, Beatriz!",
  );
  assert.equal(
    dashboardGreeting(new Date("2026-11-23T21:00:00Z"), lead, false),
    "Boa noite, Beatriz!",
  );
  assert.equal(dashboardGreeting(new Date("2026-11-24T02:59:59Z"), null, false), "Boa noite!");
  assert.equal(dashboardGreeting(new Date("2026-11-24T03:00:00Z"), null, false), "Bom dia!");
});

test("the named owner greeting checks both the signed-in account and administrative status", () => {
  const now = new Date("2026-11-23T15:00:00Z");
  const owner = { email: "Scaleupperformance@gmail.com", user_metadata: { name: "Scale Up" } };
  assert.equal(dashboardGreeting(now, owner, true), "Boa tarde, Guilherme!");
  assert.equal(dashboardGreeting(now, owner, false), "Boa tarde, Scale!");
  assert.equal(
    dashboardGreeting(now, { user_metadata: { given_name: "Lia" } }, true),
    "Boa tarde, Lia!",
  );
  assert.equal(dashboardGreeting(now, { user_metadata: { name: " " } }, false), "Boa tarde!");
});
