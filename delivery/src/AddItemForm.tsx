import { useState } from "react";
import { ActionResult } from "./useDeliveryData";

interface Props {
  placeholder?: string;
  onAdd: (name: string) => Promise<ActionResult>;
  onDone: () => void;
}

/** Inline replacement for `prompt("Name?")` -- an input + Save/Cancel, with the error shown next to it instead of alert(). */
export function AddItemForm({ placeholder = "Item name", onAdd, onDone }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const result = await onAdd(name.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone();
  }

  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <input
        autoFocus
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onDone();
        }}
        style={{ width: 140 }}
      />
      <button onClick={submit} disabled={busy || !name.trim()}>
        Add
      </button>
      <button onClick={onDone}>Cancel</button>
      {error && <span style={{ color: "#a11", fontSize: 11 }}>{error}</span>}
    </span>
  );
}
