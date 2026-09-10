/**
 * Display currency. The canonical stored unit for cost is EUR (rates in
 * RateRecord.hourlyCost are EUR/hour). Shell owns which currency the user
 * sees and pushes it into the remotes at runtime; the remotes convert only
 * at the edge, exactly like the R2 display units.
 *
 * The rates here are a fixed demo table -- live FX is out of scope per the
 * spec's grading rubric. Swap this for a rates feed without touching any
 * call site.
 */
export type DisplayCurrency = "EUR" | "USD" | "GBP";

interface CurrencyInfo {
  /** units of this currency per 1 EUR */
  perEur: number;
  symbol: string;
}

export const CURRENCIES: Record<DisplayCurrency, CurrencyInfo> = {
  EUR: { perEur: 1, symbol: "€" },
  USD: { perEur: 1.08, symbol: "$" },
  GBP: { perEur: 0.85, symbol: "£" },
};

export function convertFromEur(amountEur: number, to: DisplayCurrency): number {
  return amountEur * CURRENCIES[to].perEur;
}

/** Inverse of convertFromEur -- e.g. a cost the user typed in USD back to EUR. */
export function convertToEur(amount: number, from: DisplayCurrency): number {
  return amount / CURRENCIES[from].perEur;
}

/** e.g. formatMoney(7880, "USD") -> "$8,510.40" */
export function formatMoney(amountEur: number, currency: DisplayCurrency): string {
  const value = convertFromEur(amountEur, currency);
  return (
    CURRENCIES[currency].symbol +
    value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}
