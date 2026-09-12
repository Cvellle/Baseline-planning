import express from "express";
import cors from "cors";
import {
  getWorkingDaysInMonth,
  computeMonthCost,
  checkCapacity,
  computeRollup,
} from "@baseline/domain";
import { getState, save, nextUpdateCounter, resetToSeed, getMeta } from "./store.js";
import { sseHandler, broadcast } from "./events.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------- events --
app.get("/api/events", sseHandler);

// ------------------------------------------------------------------ meta --
// Grid horizon and other fixture metadata, so front ends don't hardcode it.
app.get("/api/meta", (req, res) => {
  res.json(getMeta());
});

/** Inclusive list of "YYYY-MM" strings from `from` to `to`. */
function monthRange(from, to) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const out = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

// ------------------------------------------------------------- employees --
app.get("/api/employees", (req, res) => {
  res.json(getState().employees);
});

// -------------------------------------------------------------- projects --
app.get("/api/projects", (req, res) => {
  res.json(getState().projects);
});

// ------------------------------------------------------- breakdown roll-up --
/**
 * Figure 5's multi-level view for one project: every breakdown item as a
 * row, the grid-horizon months as columns, plus a reconciling Total column
 * and project-total row. All the arithmetic (rate splitting, unit
 * conversion, largest-remainder rounding so parents == sum of children)
 * lives in @baseline/domain's computeRollup.
 *
 * Query: ?unit=hours|personMonths|percent|cost  (default hours)
 */
app.get("/api/projects/:projectId/rollup", (req, res) => {
  const unit = req.query.unit || "hours";
  if (!["hours", "personMonths", "percent", "cost"].includes(unit)) {
    return res.status(400).json({ error: `unknown unit: ${unit}` });
  }

  const state = getState();
  const project = state.projects.find((p) => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "unknown project" });

  const items = state.breakdownItems.filter((i) => i.projectId === req.params.projectId);
  const horizon = getMeta().gridHorizon ?? { from: "2026-04", to: "2027-03" };
  const months = monthRange(horizon.from, horizon.to);

  const result = computeRollup({
    items,
    allocations: state.allocations,
    employees: state.employees,
    rates: state.rateRecords,
    months,
    unit,
  });
  res.json(result);
});

// --------------------------------------------------------------- rates ---
app.get("/api/employees/:employeeId/rates", (req, res) => {
  const rates = getState().rateRecords.filter((r) => r.employeeId === req.params.employeeId);
  res.json(rates);
});

app.post("/api/employees/:employeeId/rates", (req, res) => {
  const { validFrom, hourlyCost } = req.body;
  if (!validFrom || typeof hourlyCost !== "number") {
    return res.status(400).json({ error: "validFrom and hourlyCost are required" });
  }
  const state = getState();
  const id = `rate-${Date.now()}`;
  state.rateRecords.push({ id, employeeId: req.params.employeeId, validFrom, hourlyCost });
  save();
  broadcast("rate.changed", { employeeId: req.params.employeeId });
  res.status(201).json({ id });
});

app.put("/api/rates/:rateId", (req, res) => {
  const state = getState();
  const rate = state.rateRecords.find((r) => r.id === req.params.rateId);
  if (!rate) return res.status(404).json({ error: "not found" });
  if (req.body.validFrom !== undefined) rate.validFrom = req.body.validFrom;
  if (req.body.hourlyCost !== undefined) rate.hourlyCost = req.body.hourlyCost;
  save();
  broadcast("rate.changed", { employeeId: rate.employeeId });
  res.json(rate);
});

app.delete("/api/rates/:rateId", (req, res) => {
  const state = getState();
  const idx = state.rateRecords.findIndex((r) => r.id === req.params.rateId);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  const [removed] = state.rateRecords.splice(idx, 1);
  save();
  broadcast("rate.changed", { employeeId: removed.employeeId });
  res.status(204).end();
});

// -------------------------------------------------------- breakdown tree --
app.get("/api/breakdown-items", (req, res) => {
  const { projectId } = req.query;
  const items = getState().breakdownItems.filter((i) => !projectId || i.projectId === projectId);
  res.json(items);
});

app.post("/api/breakdown-items", (req, res) => {
  const { projectId, parentId, name } = req.body;
  if (!projectId || !name) return res.status(400).json({ error: "projectId and name are required" });
  const state = getState();

  // R4: a parent's numbers are derived from its children, so a node cannot
  // hold both children and its own allocations. We take the "refuse the
  // insertion" resolution (the spec allows either that or moving the
  // allocation down) -- never silent loss.
  if (parentId) {
    const parentHasAllocations = state.allocations.some((a) => a.breakdownItemId === parentId);
    if (parentHasAllocations) {
      return res.status(409).json({
        error:
          "cannot add a child under an item that has its own allocations -- " +
          "move or clear those allocations first (a parent's effort is derived from its children)",
      });
    }
  }

  const id = `wbs-${Date.now()}`;
  state.breakdownItems.push({ id, projectId, parentId: parentId ?? null, name });
  save();
  broadcast("breakdown.changed", { projectId });
  res.status(201).json({ id });
});

/** Is `candidateAncestorId` the item itself or one of its descendants? */
function wouldCreateCycle(items, itemId, candidateParentId) {
  if (candidateParentId === null) return false;
  let cursor = candidateParentId;
  while (cursor) {
    if (cursor === itemId) return true;
    cursor = items.find((i) => i.id === cursor)?.parentId ?? null;
  }
  return false;
}

app.patch("/api/breakdown-items/:id", (req, res) => {
  const state = getState();
  const item = state.breakdownItems.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "not found" });

  if (req.body.parentId !== undefined) {
    const newParentId = req.body.parentId;
    if (newParentId !== null) {
      const parent = state.breakdownItems.find((i) => i.id === newParentId);
      if (!parent) return res.status(400).json({ error: "target parent does not exist" });
      if (parent.projectId !== item.projectId) {
        return res.status(400).json({ error: "cannot move an item to a different project" });
      }
      if (state.allocations.some((a) => a.breakdownItemId === newParentId)) {
        return res.status(409).json({ error: "target parent has its own allocations (see R4)" });
      }
    }
    if (wouldCreateCycle(state.breakdownItems, item.id, newParentId)) {
      return res.status(409).json({ error: "that move would put the item inside its own subtree" });
    }
    item.parentId = newParentId;
  }
  if (req.body.name !== undefined) item.name = req.body.name;

  save();
  broadcast("breakdown.changed", { projectId: item.projectId });
  res.json(item);
});

app.delete("/api/breakdown-items/:id", (req, res) => {
  const state = getState();
  const idx = state.breakdownItems.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  const hasChildren = state.breakdownItems.some((i) => i.parentId === req.params.id);
  if (hasChildren) {
    return res.status(409).json({ error: "cannot delete an item that still has children" });
  }
  const [removed] = state.breakdownItems.splice(idx, 1);
  state.allocations = state.allocations.filter((a) => a.breakdownItemId !== removed.id);
  save();
  broadcast("breakdown.changed", { projectId: removed.projectId });
  res.status(204).end();
});

// ------------------------------------------------------------ allocations --
app.get("/api/allocations", (req, res) => {
  const { employeeId, breakdownItemId, month } = req.query;
  const allocations = getState().allocations.filter(
    (a) =>
      (!employeeId || a.employeeId === employeeId) &&
      (!breakdownItemId || a.breakdownItemId === breakdownItemId) &&
      (!month || a.month === month)
  );
  res.json(allocations);
});

/**
 * Body: { hours: number } -- canonical unit. Front ends convert whatever
 * display unit the user typed into hours before calling this (see
 * @baseline/domain's unitToHours), so the API never has to know about
 * display units at all.
 */
app.put("/api/allocations/:id", (req, res) => {
  const { hours } = req.body;
  if (typeof hours !== "number") return res.status(400).json({ error: "hours (number) is required" });

  const state = getState();
  let allocation = state.allocations.find((a) => a.id === req.params.id);
  if (!allocation) {
    // allow creating a cell by PUT-ing a fresh id, e.g. "new-<breakdownItemId>-<employeeId>-<month>"
    const { breakdownItemId, employeeId, month } = req.body;
    if (!breakdownItemId || !employeeId || !month) {
      return res.status(404).json({ error: "allocation not found and insufficient data to create one" });
    }
    allocation = { id: req.params.id, breakdownItemId, employeeId, month, hours: 0, updatedAt: 0 };
    state.allocations.push(allocation);
  }

  allocation.hours = hours;
  allocation.updatedAt = nextUpdateCounter();
  save();
  broadcast("allocation.changed", {
    employeeId: allocation.employeeId,
    month: allocation.month,
    breakdownItemId: allocation.breakdownItemId,
  });
  res.json(allocation);
});

/**
 * Cost + capacity for one employee/month, computed server-side using the
 * shared @baseline/domain package. This is the "Delivery asks People for a
 * computed cost" half of the architecture decision (see README) -- exposed
 * here so either app (or a future third one) can call it without
 * duplicating rate-splitting logic.
 */
app.get("/api/employees/:employeeId/months/:month/cost", (req, res) => {
  const { employeeId, month } = req.params;
  const { breakdownItemId } = req.query;
  const state = getState();

  const employee = state.employees.find((e) => e.id === employeeId);
  if (!employee) return res.status(404).json({ error: "employee not found" });

  const rates = state.rateRecords.filter((r) => r.employeeId === employeeId);
  const [year, month1] = month.split("-").map(Number);

  const allocationsThisMonth = state.allocations.filter(
    (a) => a.employeeId === employeeId && a.month === month
  );
  const relevant = breakdownItemId
    ? allocationsThisMonth.filter((a) => a.breakdownItemId === breakdownItemId)
    : allocationsThisMonth;
  const hoursForBreakdown = relevant.reduce((sum, a) => sum + a.hours, 0);

  const breakdown = computeMonthCost(employee.weeklyHours, rates, year, month1, hoursForBreakdown);
  const capacity = checkCapacity(
    employee.weeklyHours,
    getWorkingDaysInMonth(year, month1),
    allocationsThisMonth // cross-project: ALL allocations for this employee/month
  );

  res.json({ breakdown, capacity: withCausingDetail(state, capacity) });
});

/**
 * R5: name the assignment that caused an over-capacity month -- the most
 * recently edited allocation contributing to it -- with enough context for
 * Delivery to show it even when it lives on another project's breakdown item.
 */
function withCausingDetail(state, capacity) {
  if (!capacity.isOverCapacity || !capacity.causingAllocationId) return capacity;
  const alloc = state.allocations.find((a) => a.id === capacity.causingAllocationId);
  if (!alloc) return capacity;
  const item = state.breakdownItems.find((i) => i.id === alloc.breakdownItemId);
  const project = item && state.projects.find((p) => p.id === item.projectId);
  return {
    ...capacity,
    causing: {
      allocationId: alloc.id,
      breakdownItemId: alloc.breakdownItemId,
      breakdownItemName: item?.name ?? alloc.breakdownItemId,
      projectName: project?.name ?? null,
      month: alloc.month,
      hours: alloc.hours,
    },
  };
}

/**
 * Every (employee, month) in the grid horizon that is over capacity, so
 * People can flag oversubscribed people without asking cell-by-cell.
 * Capacity is cross-project: it sums an employee's allocations across ALL
 * breakdown items, including projects not currently open (R5).
 */
app.get("/api/capacity", (req, res) => {
  const state = getState();
  const horizon = getMeta().gridHorizon ?? { from: "2026-04", to: "2027-03" };
  const months = monthRange(horizon.from, horizon.to);

  const flags = [];
  for (const employee of state.employees) {
    for (const month of months) {
      const [year, month1] = month.split("-").map(Number);
      const allocationsThisMonth = state.allocations.filter(
        (a) => a.employeeId === employee.id && a.month === month
      );
      if (allocationsThisMonth.length === 0) continue;
      const capacity = checkCapacity(
        employee.weeklyHours,
        getWorkingDaysInMonth(year, month1),
        allocationsThisMonth
      );
      if (capacity.isOverCapacity) {
        flags.push({
          employeeId: employee.id,
          month,
          totalAllocatedHours: capacity.totalAllocatedHours,
          capacityHours: capacity.capacityHours,
          ...withCausingDetail(state, capacity).causing,
        });
      }
    }
  }
  res.json(flags);
});

// ------------------------------------------------------------------ misc --
app.post("/api/reset", (req, res) => {
  const state = resetToSeed();
  broadcast("reset", {});
  res.json({ ok: true, employees: state.employees.length });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`);
});
