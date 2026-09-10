import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getWorkingDaysInMonth, personMonthHours } from "@baseline/domain";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, "..", "data", "baseline-seed.json");
// Written to on every mutation so data survives a container restart, not
// just a browser reload. Kept separate from the seed so re-seeding is easy
// (just delete this file).
const STATE_PATH = path.join(__dirname, "..", "data", ".state.json");

function loadInitialState() {
  if (existsSync(STATE_PATH)) {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  }

  const seed = JSON.parse(readFileSync(SEED_PATH, "utf-8"));
  const employeesById = Object.fromEntries(seed.employees.map((e) => [e.id, e]));

  // Seed "amount" is expressed in person-months (per the spec's Fig. 4
  // example). Convert once, at load time, into the canonical stored unit
  // (hours), because working-days-per-month varies and we don't want to
  // recompute this on every read.
  const allocations = seed.allocations.map((a) => {
    const employee = employeesById[a.employeeId];
    const [year, month1] = a.month.split("-").map(Number);
    const workingDays = getWorkingDaysInMonth(year, month1);
    const pmHours = personMonthHours(employee.weeklyHours, workingDays);
    return {
      id: a.id,
      breakdownItemId: a.breakdownItemId,
      employeeId: a.employeeId,
      month: a.month,
      hours: a.amount * pmHours,
      updatedAt: 0, // monotonic counter, used for "most recently edited" (R5)
    };
  });

  return {
    employees: seed.employees,
    rateRecords: seed.rateRecords,
    projects: seed.projects,
    breakdownItems: seed.breakdownItems,
    allocations,
    _nextUpdateCounter: allocations.length + 1,
  };
}

let state = loadInitialState();

// Static fixture metadata (grid horizon, etc). Not part of mutable state --
// always read fresh from the seed so it survives a persisted .state.json
// that predates this field.
const meta = JSON.parse(readFileSync(SEED_PATH, "utf-8")).meta ?? {};

export function getMeta() {
  return meta;
}

function persist() {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function getState() {
  return state;
}

export function nextUpdateCounter() {
  return state._nextUpdateCounter++;
}

export function save() {
  persist();
}

export function resetToSeed() {
  if (existsSync(STATE_PATH)) {
    unlinkSync(STATE_PATH);
  }
  state = loadInitialState();
  persist();
  return state;
}
