import { DisplayUnit } from "./types.js";
import { personMonthHours } from "./rates.js";

/**
 * The canonical stored unit is HOURS (see types.ts). Everything else is a
 * conversion at the edges. Context needed varies by unit:
 *  - personMonths needs weeklyHours + workingDaysInMonth
 *  - percent needs the same (100% == 1 person-month for that person/month)
 *  - cost needs the cell's blended rate for the month
 */
export interface ConversionContext {
  weeklyHours: number;
  workingDaysInMonth: number;
  /** required only when converting to/from "cost" */
  blendedRatePerHour?: number;
}

export function hoursToUnit(hours: number, unit: DisplayUnit, ctx: ConversionContext): number {
  if (unit === "hours") return hours;

  const pmHours = personMonthHours(ctx.weeklyHours, ctx.workingDaysInMonth);

  if (unit === "personMonths") return pmHours === 0 ? 0 : hours / pmHours;
  if (unit === "percent") return pmHours === 0 ? 0 : (hours / pmHours) * 100;
  if (unit === "cost") {
    if (ctx.blendedRatePerHour === undefined) {
      throw new Error("blendedRatePerHour is required to convert hours -> cost");
    }
    return hours * ctx.blendedRatePerHour;
  }
  throw new Error(`Unknown unit: ${unit}`);
}

export function unitToHours(value: number, unit: DisplayUnit, ctx: ConversionContext): number {
  if (unit === "hours") return value;

  const pmHours = personMonthHours(ctx.weeklyHours, ctx.workingDaysInMonth);

  if (unit === "personMonths") return value * pmHours;
  if (unit === "percent") return (value / 100) * pmHours;
  if (unit === "cost") {
    if (ctx.blendedRatePerHour === undefined) {
      throw new Error("blendedRatePerHour is required to convert cost -> hours");
    }
    if (ctx.blendedRatePerHour === 0) return 0;
    return value / ctx.blendedRatePerHour;
  }
  throw new Error(`Unknown unit: ${unit}`);
}

/** Fixed display precision per the spec: hours 2dp, PM 2dp, % 1dp, cost 2dp. */
export const DISPLAY_PRECISION: Record<DisplayUnit, number> = {
  hours: 2,
  personMonths: 2,
  percent: 1,
  cost: 2,
};

export function roundForDisplay(value: number, unit: DisplayUnit): number {
  const dp = DISPLAY_PRECISION[unit];
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}
