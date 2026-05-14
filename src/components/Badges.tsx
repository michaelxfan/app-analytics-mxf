import { AppPriority, AppStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: AppStatus }) {
  const cls = `badge badge-${status}`;
  return <span className={cls}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: AppPriority }) {
  return <span className="badge badge-priority">{priority}</span>;
}

export function DormantBadge() {
  return <span className="badge badge-dormant">dormant</span>;
}
