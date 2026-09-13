import type { CSSProperties } from "react";

/** Shared fixed size for the buttons in the leaf grid (edit) view, so action buttons of
 * differing label length (icons vs. "+ Root item") all line up the same. */
export const btn: CSSProperties = {
  width: 84,
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  padding: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: "0 0 auto",
};

/** Small square style for icon-only buttons (single glyph, no text label). */
export const iconBtn: CSSProperties = {
  ...btn,
  width: 24,
  height: 24,
};
