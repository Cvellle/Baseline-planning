import { describe, it, expect } from "vitest";
import { convertFromEur, convertToEur, formatMoney } from "../src/currency.js";

describe("display currency", () => {
  it("EUR is the identity", () => {
    expect(convertFromEur(7880, "EUR")).toBe(7880);
    expect(convertToEur(7880, "EUR")).toBe(7880);
    expect(formatMoney(7880, "EUR")).toBe("€7,880.00");
  });

  it("converts and round-trips through another currency", () => {
    const usd = convertFromEur(7880, "USD");
    expect(usd).toBeCloseTo(8510.4, 4);
    expect(convertToEur(usd, "USD")).toBeCloseTo(7880, 6);
    expect(formatMoney(7880, "USD")).toBe("$8,510.40");
  });
});
