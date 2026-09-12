import { useEffect, useMemo, useState } from "react";
import { api, Employee, RateRecord, CapacityFlag } from "./api";

/**
 * Owns all of People's server state (employee list, the open employee's
 * rate history, cross-project capacity flags) and keeps it live over SSE:
 * a rate changing elsewhere refreshes the open employee, and any allocation
 * edit in Delivery can change who is oversubscribed here (R5).
 */
export function usePeopleData() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rates, setRates] = useState<RateRecord[]>([]);
  const [capacityFlags, setCapacityFlags] = useState<CapacityFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listEmployees().then((list) => {
      setEmployees(list);
      setLoading(false);
    });
    api.listCapacityFlags().then(setCapacityFlags);
  }, []);

  useEffect(() => {
    return api.subscribe((msg) => {
      if (msg.type === "rate.changed" && selectedId && msg.payload.employeeId === selectedId) {
        api.listRates(selectedId).then(setRates);
      }
      if (msg.type === "allocation.changed" || msg.type === "reset") {
        api.listCapacityFlags().then(setCapacityFlags);
      }
    });
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) api.listRates(selectedId).then(setRates);
  }, [selectedId]);

  // employeeId -> that person's over-capacity months (R5: oversubscribed in People)
  const overByEmployee = useMemo(() => {
    const map = new Map<string, CapacityFlag[]>();
    for (const f of capacityFlags) {
      const list = map.get(f.employeeId) ?? [];
      list.push(f);
      map.set(f.employeeId, list);
    }
    return map;
  }, [capacityFlags]);

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  const selectedOver = selectedId ? overByEmployee.get(selectedId) ?? [] : [];

  async function addRate(validFrom: string, hourlyCost: number) {
    if (!selectedId) return;
    await api.addRate(selectedId, validFrom, hourlyCost);
    setRates(await api.listRates(selectedId));
  }

  async function editRate(rate: RateRecord, hourlyCost: number) {
    if (!selectedId) return;
    await api.updateRate(rate.id, { hourlyCost });
    setRates(await api.listRates(selectedId));
  }

  async function deleteRate(rate: RateRecord) {
    if (!selectedId) return;
    await api.deleteRate(rate.id);
    setRates(await api.listRates(selectedId));
  }

  return {
    employees,
    loading,
    selectedId,
    setSelectedId,
    selected,
    rates,
    overByEmployee,
    selectedOver,
    addRate,
    editRate,
    deleteRate,
  };
}
