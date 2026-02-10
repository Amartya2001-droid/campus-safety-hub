import { DashboardLayout } from "@/components/DashboardLayout";
import { Settings as SettingsIcon } from "lucide-react";

const SettingsPage = () => {
  return (
    <DashboardLayout title="Settings" subtitle="System configuration and preferences">
      <div className="glass-card p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
          <SettingsIcon className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Settings</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Configure alert sounds, auto-assignment rules, shift schedules, escalation policies, and integrations.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
