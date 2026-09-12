/**
 * Largest-remainder distribution.
 *
 * Problem: rounding each cell independently to `decimals` places, then
 * summing the rounded cells, does not in general equal the rounded total
 * of the exact sum (classic apportionment problem). The spec requires the
 * displayed total to equal the sum of the displayed cells exactly, with
 * only a 0.01 floating-point tolerance (not a rounding budget).
 *
 * This function rounds `values` to `decimals` places such that they sum
 * exactly to round(sum(values), decimals).
 */
export function largestRemainderRound(values: number[], decimals = 2): number[] {
  const factor = 10 ** decimals;
  const exactTotal = values.reduce((a, b) => a + b, 0);
  const targetTotalUnits = Math.round(exactTotal * factor);

  const scaled = values.map((v) => v * factor);
  const floored = scaled.map((v) => Math.floor(v));
  const remainders = scaled.map((v, i) => ({ i, remainder: v - floored[i] }));

  let flooredSum = floored.reduce((a, b) => a + b, 0);
  let deficit = targetTotalUnits - flooredSum;

  // Distribute the remaining units to the entries with the largest
  // fractional remainder first.
  remainders.sort((a, b) => b.remainder - a.remainder);

  const resultUnits = [...floored];
  for (let k = 0; k < remainders.length && deficit > 0; k++) {
    resultUnits[remainders[k].i] += 1;
    deficit--;
  }
  // If exactTotal rounded down relative to floors (deficit negative — can
  // happen with negative values), pull back from smallest remainders.
  for (let k = remainders.length - 1; k >= 0 && deficit < 0; k--) {
    resultUnits[remainders[k].i] -= 1;
    deficit++;
  }

  return resultUnits.map((u) => u / factor);
}
