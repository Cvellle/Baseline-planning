import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { Employee } from "../src/types.js";

const seedPath = fileURLToPath(new URL("../../api/data/baseline-seed.json", import.meta.url));
const employees: Employee[] = JSON.parse(readFileSync(seedPath, "utf-8")).employees;

// weeklyHours is 40, 32 or 20 -- see the brief's data model (§3.2).
const VALID_WEEKLY_HOURS = [40, 32, 20];

describe("employees seed data", () => {
  it("has 60 employees", () => {
    expect(employees.length).toBe(60);
  });

  it("every employee has a valid weeklyHours and a non-empty name", () => {
    for (const e of employees) {
      expect(VALID_WEEKLY_HOURS).toContain(e.weeklyHours);
      expect(e.name.length).toBeGreaterThan(0);
    }
  });

  it("every employee id is unique", () => {
    const ids = employees.map((e) => e.id);
    const uniqueIds = ids.filter((id, i) => ids.indexOf(id) === i);
    expect(uniqueIds.length).toBe(ids.length);
  });
});
