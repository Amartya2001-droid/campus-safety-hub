import { DashboardLayout } from "@/components/DashboardLayout";
import { Map as MapIcon, Phone, Building2, Shield } from "lucide-react";

const CampusMap = () => {
  return (
    <DashboardLayout title="Campus Map" subtitle="Live campus safety map">
      <div className="glass-card p-8 flex flex-col items-center justify-center min-h-[500px] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary mb-4">
          <MapIcon className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Interactive Campus Map</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          Real-time map showing active incidents, officer locations, emergency phones, and safe zones across the Acadia University campus.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-lg">
          {[
            { icon: Shield, label: "Active Alerts", color: "text-emergency" },
            { icon: Phone, label: "Blue Phones", color: "text-info" },
            { icon: Building2, label: "Safe Zones", color: "text-success" },
            { icon: MapIcon, label: "AED Locations", color: "text-warning" },
          ].map((item) => (
            <div key={item.label} className="glass-card p-3 text-center">
              <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          Map integration requires Google Maps API key
        </p>
      </div>
    </DashboardLayout>
  );
};

export default CampusMap;
