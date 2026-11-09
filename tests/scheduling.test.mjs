import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDateInZone, zonedDateTimeToIso } from "../src/lib/scheduling.ts";

test("calendar shortcuts use the workspace day even across midnight UTC and month boundaries", () => {
  const now = new Date("2026-12-01T01:00:00Z");
  assert.equal(calendarDateInZone("America/Sao_Paulo", 0, now), "2026-11-30");
  assert.equal(calendarDateInZone("America/Sao_Paulo", 1, now), "2026-12-01");
  assert.equal(calendarDateInZone("Asia/Tokyo", 0, now), "2026-12-01");
});

test("scheduled local times convert using the workspace timezone", () => {
  assert.equal(
    zonedDateTimeToIso("2026-10-17", "09:00", "America/Bahia"),
    "2026-10-17T12:00:00.000Z",
  );
  assert.equal(zonedDateTimeToIso("2026-10-17", "09:00", "UTC"), "2026-10-17T09:00:00.000Z");
});

test("schedule rejects a local time that does not exist during a DST transition", () => {
  assert.throws(
    () => zonedDateTimeToIso("2026-03-08", "02:30", "America/New_York"),
    /horário não existe/i,
  );
});
