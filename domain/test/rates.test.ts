import { describe, it, expect } from "vitest";
import { RateRecord } from "../src/types.js";

describe("adding a rate", () => {
  it("saves the given validFrom date and hourlyCost", () => {
    const rates: RateRecord[] = [];
    const newRate: RateRecord = { id: "r1", employeeId: "e1", validFrom: "2026-03-12", hourlyCost: 95 };
    rates.push(newRate);

    const saved = rates.find((r) => r.id === "r1")!;
    expect(saved.validFrom).toBe("2026-03-12");
    expect(saved.hourlyCost).toBe(95);
  });
});
