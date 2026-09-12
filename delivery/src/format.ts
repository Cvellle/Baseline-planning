import { formatMoney, DisplayUnit, DisplayCurrency } from "@baseline/domain";

export function getUnitOptions(currency: DisplayCurrency): { value: DisplayUnit; label: string }[] {
  return [
    { value: "hours", label: "Hours" },
    { value: "personMonths", label: "Person-months" },
    { value: "percent", label: "% of capacity" },
    { value: "cost", label: `Cost (${currency})` },
  ];
}

/** Display formatting per unit; cost is rendered in the Shell's currency. */
export function fmt(value: number, unit: DisplayUnit, currency: DisplayCurrency): string {
  if (value === 0) return "";
  if (unit === "cost") return formatMoney(value, currency); // value is EUR
  if (unit === "percent") return value.toFixed(1) + "%";
  return value.toFixed(2);
}
