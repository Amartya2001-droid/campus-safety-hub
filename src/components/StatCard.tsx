import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: "default" | "emergency" | "warning" | "success" | "info";
}

const variantStyles = {
  default: "border-border",
  emergency: "border-emergency/30 emergency-glow",
  warning: "border-warning/30",
  success: "border-success/30",
  info: "border-info/30",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  emergency: "bg-emergency/15 text-emergency",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
};

export function StatCard({ label, value, icon: Icon, trend, variant = "default" }: StatCardProps) {
  return (
    <div className={cn("glass-card p-4", variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </p>
          <p className={cn(
            "text-3xl font-bold mt-1 tracking-tight",
            variant === "emergency" && "text-emergency",
            variant === "warning" && "text-warning",
            variant === "success" && "text-success",
            variant === "info" && "text-info",
            variant === "default" && "text-foreground",
          )}>
            {value}
          </p>
          {trend && (
            <p className="text-[11px] text-muted-foreground mt-1">{trend}</p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconVariantStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
