import { useState } from "react";
import { BreakdownItem } from "./api";
import { ActionResult } from "./useDeliveryData";
import { AddItemForm } from "./AddItemForm";

interface Handlers {
  onAddChild: (parentId: string | null, name: string) => Promise<ActionResult>;
  onRename: (item: BreakdownItem, name: string) => Promise<void>;
  onMove: (item: BreakdownItem, parentId: string | null) => Promise<ActionResult>;
  onDelete: (item: BreakdownItem) => Promise<ActionResult>;
}

interface Props extends Handlers {
  items: BreakdownItem[];
  parentId: string | null;
  depth: number;
  selectedItemId: string | null;
  isLeaf: (id: string) => boolean;
  onSelect: (id: string) => void;
}

/** All items, in tree order, each tagged with its depth -- used for the move dropdown. */
function flattenItems(items: BreakdownItem[], parentId: string | null = null, depth = 0): { item: BreakdownItem; depth: number }[] {
  return items
    .filter((i) => i.parentId === parentId)
    .flatMap((item) => [{ item, depth }, ...flattenItems(items, item.id, depth + 1)]);
}

/** Excludes an item and its whole subtree, so you can't move something under itself. */
function moveCandidates(items: BreakdownItem[], excludeId: string): { item: BreakdownItem; depth: number }[] {
  let excluded = [excludeId];
  let grew = true;
  while (grew) {
    grew = false;
    for (const i of items) {
      if (i.parentId && excluded.includes(i.parentId) && !excluded.includes(i.id)) {
        excluded = [...excluded, i.id];
        grew = true;
      }
    }
  }
  return flattenItems(items).filter(({ item }) => !excluded.includes(item.id));
}

export function BreakdownTree({ items, parentId, depth, selectedItemId, isLeaf, onSelect, ...handlers }: Props) {
  const nodes = items.filter((i) => i.parentId === parentId);
  return (
    <>
      {nodes.map((item) => (
        <TreeRow
          key={item.id}
          item={item}
          items={items}
          depth={depth}
          selectedItemId={selectedItemId}
          isLeaf={isLeaf}
          onSelect={onSelect}
          {...handlers}
        />
      ))}
    </>
  );
}

function TreeRow({
  item,
  items,
  depth,
  selectedItemId,
  isLeaf,
  onSelect,
  onAddChild,
  onRename,
  onMove,
  onDelete,
}: { item: BreakdownItem; items: BreakdownItem[]; depth: number; selectedItemId: string | null; isLeaf: (id: string) => boolean; onSelect: (id: string) => void } & Handlers) {
  const [action, setAction] = useState<null | "rename" | "move" | "delete" | "addChild">(null);
  const [renameValue, setRenameValue] = useState(item.name);
  const [moveTarget, setMoveTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAction(null);
    setError(null);
    setRenameValue(item.name);
    setMoveTarget("");
  }

  async function submitRename() {
    if (!renameValue.trim() || renameValue.trim() === item.name) return reset();
    await onRename(item, renameValue.trim());
    reset();
  }

  async function submitMove() {
    const result = await onMove(item, moveTarget === "" ? null : moveTarget);
    if (!result.ok) return setError(result.message);
    reset();
  }

  async function submitDelete() {
    const result = await onDelete(item);
    if (!result.ok) return setError(result.message);
    reset();
  }

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 4px",
          background: item.id === selectedItemId ? "#eef" : "transparent",
        }}
      >
        {action === "rename" ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") reset();
            }}
            onBlur={submitRename}
            style={{ flex: 1 }}
          />
        ) : (
          <span
            onClick={() => isLeaf(item.id) && onSelect(item.id)}
            style={{ cursor: isLeaf(item.id) ? "pointer" : "default", flex: 1 }}
          >
            {isLeaf(item.id) ? "•" : "▾"} {item.name}
          </span>
        )}

        {action === "delete" ? (
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 12 }}>
            Delete?
            <button onClick={submitDelete}>Yes</button>
            <button onClick={reset}>No</button>
          </span>
        ) : action === "move" ? (
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <select autoFocus value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} style={{ maxWidth: 160 }}>
              <option value="">— Top level —</option>
              {moveCandidates(items, item.id).map(({ item: c, depth: d }) => (
                <option key={c.id} value={c.id}>
                  {"—".repeat(d)} {c.name}
                </option>
              ))}
            </select>
            <button onClick={submitMove}>Move</button>
            <button onClick={reset}>Cancel</button>
          </span>
        ) : action === "addChild" ? (
          <AddItemForm onAdd={(name) => onAddChild(item.id, name)} onDone={reset} />
        ) : action === null ? (
          <>
            <button onClick={() => setAction("addChild")} title="Add child">
              +
            </button>
            <button onClick={() => setAction("rename")} title="Rename">
              ✎
            </button>
            <button onClick={() => setAction("move")} title="Move under another item">
              ⤴
            </button>
            <button onClick={() => setAction("delete")} title="Delete">
              ×
            </button>
          </>
        ) : null}
      </div>
      {error && <div style={{ fontSize: 11, color: "#a11", marginLeft: 4 }}>{error}</div>}
      <BreakdownTree
        items={items}
        parentId={item.id}
        depth={depth + 1}
        selectedItemId={selectedItemId}
        isLeaf={isLeaf}
        onSelect={onSelect}
        onAddChild={onAddChild}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
      />
    </div>
  );
}
