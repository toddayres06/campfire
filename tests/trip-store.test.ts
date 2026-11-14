import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  initialTrip,
  validateTrip,
  readTrip,
  writeTrip,
  states,
} from "../lib/trip-store";

test("starter itinerary is a valid backup with fifty unique collection states", () => {
  assert.equal(validateTrip(structuredClone(initialTrip)).version, 1);
  assert.equal(states.length, 50);
  assert.equal(new Set(states).size, 50);
});
test("rejects incomplete backups rather than replacing a trip", () => {
  for (const value of [
    null,
    {},
    { version: 2 },
    { ...initialTrip, journey: { legs: [] } },
  ])
    assert.throws(() => validateTrip(value));
});
test("rejects unsafe photos and non-finite coordinates in imports", () => {
  const trip = structuredClone(initialTrip);
  trip.memories = [
    {
      id: "test",
      title: "Photo",
      place: "Conroe",
      state: "Texas",
      date: "2026-11-13",
      note: "",
      photo: "javascript:alert(1)",
    },
  ];
  assert.throws(() => validateTrip(trip));
  trip.memories = [];
  trip.journey.legs[0].destinations[0].coordinates = [Infinity, 30];
  assert.throws(() => validateTrip(trip));
});
test("rejects work logs that cannot produce a valid hourly comparison", () => {
  const trip = structuredClone(initialTrip);
  trip.shifts = [
    {
      id: "s",
      city: "Conroe",
      platform: "Test",
      date: "2026-11-13",
      hours: 0,
      earned: 100,
      fuel: 20,
    },
  ];
  assert.throws(() => validateTrip(trip));
  trip.shifts[0].hours = 4;
  trip.shifts[0].fuel = -1;
  assert.throws(() => validateTrip(trip));
});
test("persists and restores memories, photo bytes, collections, and shifts together", async () => {
  const trip = structuredClone(initialTrip);
  trip.memories = [
    {
      id: "m",
      title: "Sunset",
      place: "Conroe",
      state: "Texas",
      date: "2026-11-13",
      note: "A quiet evening",
      photo: "data:image/jpeg;base64,dGVzdA==",
    },
  ];
  trip.collected = ["Texas"];
  trip.shifts = [
    {
      id: "s",
      city: "Conroe",
      platform: "Test",
      date: "2026-11-13",
      hours: 4,
      earned: 100,
      fuel: 20,
    },
  ];
  await writeTrip(trip);
  assert.deepEqual(await readTrip(), trip);
  const exported = JSON.stringify(await readTrip());
  assert.deepEqual(validateTrip(JSON.parse(exported)), trip);
  await writeTrip(structuredClone(initialTrip));
  assert.deepEqual(await readTrip(), initialTrip);
});

test('corrupt saved data rejects cleanly and can be recovered with a valid backup', async () => {
  await writeTrip({version: 1} as typeof initialTrip);
  await assert.rejects(readTrip(), /could not be read/);
  await writeTrip(structuredClone(initialTrip));
  assert.deepEqual(await readTrip(), initialTrip);
});
