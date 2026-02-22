import { cn } from "@/lib/utils";

type StatusType =
  | "new" | "assigned" | "en_route" | "on_scene" | "resolved"
  | "pending" | "in_progress" | "completed" | "cancelled"
  | "under_review" | "closed"
  | "active" | "declined" | "expired";

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  new: { label: "New", className: "bg-emergency/15 text-emergency border-emergency/30" },
  assigned: { label: "Assigned", className: "bg-warning/15 text-warning border-warning/30" },
  en_route: { label: "En Route", className: "bg-warning/15 text-warning border-warning/30" },
  on_scene: { label: "On Scene", className: "bg-info/15 text-info border-info/30" },
  resolved: { label: "Resolved", className: "bg-success/15 text-success border-success/30" },
  pending: { label: "Pending", className: "bg-warning/15 text-warning border-warning/30" },
  in_progress: { label: "In Progress", className: "bg-info/15 text-info border-info/30" },
  completed: { label: "Completed", className: "bg-success/15 text-success border-success/30" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-border" },
  under_review: { label: "Under Review", className: "bg-warning/15 text-warning border-warning/30" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground border-border" },
  active: { label: "Active", className: "bg-success/15 text-success border-success/30" },
  declined: { label: "Declined", className: "bg-muted text-muted-foreground border-border" },
  expired: { label: "Expired", className: "bg-warning/15 text-warning border-warning/30" },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        config.className,
        className
      )}
    >
      <span className={cn(
        "status-dot",
        status === "new" && "bg-emergency animate-pulse-emergency",
        status === "assigned" && "bg-warning",
        status === "en_route" && "bg-warning",
        status === "on_scene" && "bg-info",
        status === "resolved" && "bg-success",
        status === "pending" && "bg-warning",
        status === "in_progress" && "bg-info",
        status === "completed" && "bg-success",
        status === "cancelled" && "bg-muted-foreground",
        status === "under_review" && "bg-warning",
        status === "closed" && "bg-muted-foreground",
        status === "active" && "bg-success",
        status === "declined" && "bg-muted-foreground",
        status === "expired" && "bg-warning",
      )} />
      {config.label}
    </span>
  );
}
