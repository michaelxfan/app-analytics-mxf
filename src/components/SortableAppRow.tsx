"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderApps } from "@/app/actions/order";
import { StatusBadge, PriorityBadge, DormantBadge } from "@/components/Badges";

export interface SortableRow {
  id: string;
  app_slug: string;
  app_name: string;
  app_url: string | null;
  github_repo_url: string | null;
  category: string | null;
  status: "active" | "experimental" | "paused" | "deprecated";
  priority: "P0" | "P1" | "P2" | "P3";
  events_week: number;
  events_thirty: number;
  usage_pct: number;
  weekly_change: number;
  thirty_change: number;
  last_used: string | null;
  is_dormant: boolean;
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function delta(n: number): string {
  if (n === 0) return "±0";
  return n > 0 ? `+${n}` : `${n}`;
}

function Row({ row }: { row: SortableRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? "var(--surface-muted)" : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ width: 28, padding: "12px 4px 12px 12px" }}>
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          style={{
            cursor: "grab",
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
            touchAction: "none",
          }}
        >
          ⋮⋮
        </button>
      </td>
      <td>
        <Link
          href={`/apps/${row.app_slug}`}
          className="link"
          style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text-primary)" }}
        >
          {row.app_name}
        </Link>
        {row.is_dormant && <span style={{ marginLeft: 8 }}><DormantBadge /></span>}
        <div className="tiny" style={{ marginTop: 2 }}>
          {row.app_url && <a href={row.app_url} target="_blank" rel="noreferrer" className="link">site</a>}
          {row.app_url && row.github_repo_url && <span> · </span>}
          {row.github_repo_url && <a href={row.github_repo_url} target="_blank" rel="noreferrer" className="link">repo</a>}
        </div>
      </td>
      <td className="tiny">{row.category ?? "—"}</td>
      <td><StatusBadge status={row.status} /></td>
      <td><PriorityBadge priority={row.priority} /></td>
      <td className="tabular" style={{ textAlign: "right" }}>
        {row.events_week}
        <div className="tiny">{delta(row.weekly_change)}</div>
      </td>
      <td className="tabular" style={{ textAlign: "right" }}>
        {row.events_thirty}
        <div className="tiny">{delta(row.thirty_change)}</div>
      </td>
      <td className="tabular" style={{ textAlign: "right" }}>{Math.round(row.usage_pct)}%</td>
      <td className="tiny">{fmtDate(row.last_used)}</td>
    </tr>
  );
}

export default function SortableAppTable({ rows: initial }: { rows: SortableRow[] }) {
  const [rows, setRows] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(rows, oldIndex, newIndex);
    setRows(next);
    setSaveError(null);
    startTransition(async () => {
      const result = await reorderApps(next.map((r) => r.id));
      if (!result.ok) {
        setSaveError(result.error);
      }
    });
  }

  return (
    <div>
      {saveError && (
        <div className="tiny" style={{ color: "var(--bad-text)", padding: "6px 12px", background: "var(--bad-bg)" }}>
          Save failed: {saveError}
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className="portfolio">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>App</th>
              <th>Category</th>
              <th>Status</th>
              <th>Pri</th>
              <th className="tabular" style={{ textAlign: "right" }}>7d</th>
              <th className="tabular" style={{ textAlign: "right" }}>30d</th>
              <th className="tabular" style={{ textAlign: "right" }}>Usage %</th>
              <th>Last used</th>
            </tr>
          </thead>
          <tbody style={{ opacity: isPending ? 0.7 : 1, transition: "opacity 0.15s" }}>
            <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              {rows.map((row) => <Row key={row.id} row={row} />)}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}
