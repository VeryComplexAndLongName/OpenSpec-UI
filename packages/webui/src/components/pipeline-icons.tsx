// The Pipeline's small drawings (the-pipeline-cards-wear-metro): a mark for
// each kind of fact a card states, and the glyphs of its controls.
//
// Every one is decoration. It is hidden from assistive technology and never
// carries a fact on its own: the words beside it do (ADR 0032).

import type { CardDetailKind } from "@openspec-ui/core/browser";

function Glyph({ d, className, filled = false }: { d: string[]; className?: string; filled?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

/** The mark for a kind of fact. */
const DETAIL_PATHS: Record<CardDetailKind, string[]> = {
  task: ["M9 11l3 3 8-8", "M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  waiting: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 8v5", "M12 16.5v.5"],
  activity: ["M3 12h4l3-8 4 16 3-8h4"],
  whose: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"],
  stop: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9 9h6v6H9z"],
  tasks: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.9"],
  "last-run": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  where: ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  "waiting-on": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  alongside: ["M5 12h14", "M13 6l6 6-6 6"],
  collision: ["M18 6L6 18", "M6 6l12 12"],
  worktree: ["M12 3l9 16H3z", "M12 10v4", "M12 17v.5"],
};

export function DetailIcon({ kind }: { kind: CardDetailKind }) {
  return <Glyph className="openspec-pipeline-node-detail-icon" d={DETAIL_PATHS[kind]} />;
}

export function ChevronIcon({ up }: { up: boolean }) {
  return <Glyph className="openspec-pipeline-glyph" d={[up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"]} />;
}

export function ForwardIcon() {
  return <Glyph className="openspec-pipeline-glyph" d={["M5 12h14", "M13 6l6 6-6 6"]} />;
}

export function PlayIcon() {
  return <Glyph className="openspec-pipeline-glyph" filled d={["M7 4.5v15l12.5-7.5z"]} />;
}

export function StopIcon() {
  return <Glyph className="openspec-pipeline-glyph" filled d={["M6.5 5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11A1.5 1.5 0 0 1 6.5 5z"]} />;
}

export function CopyIcon() {
  return <Glyph className="openspec-pipeline-glyph" d={["M11 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z", "M5 15V5a2 2 0 0 1 2-2h8"]} />;
}

export function MinusIcon() {
  return <Glyph className="openspec-pipeline-glyph" d={["M5 12h14"]} />;
}

export function PlusIcon() {
  return <Glyph className="openspec-pipeline-glyph" d={["M5 12h14", "M12 5v14"]} />;
}

export function RefreshIcon() {
  return <Glyph className="openspec-pipeline-glyph" d={["M20 11a8 8 0 0 0-14.9-3.5", "M4 4v4h4", "M4 13a8 8 0 0 0 14.9 3.5", "M20 20v-4h-4"]} />;
}

export function CheckIcon() {
  return <Glyph className="openspec-pipeline-glyph" d={["M5 12l5 5 9-10"]} />;
}

export function CrossIcon() {
  return <Glyph className="openspec-pipeline-glyph" d={["M18 6L6 18", "M6 6l12 12"]} />;
}

export function HintIcon() {
  return <Glyph d={["M9 18h6", "M10 21h4", "M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"]} />;
}
