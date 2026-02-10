import { DashboardLayout } from "@/components/DashboardLayout";
import { mockBroadcastAlerts, formatTimeAgo } from "@/lib/mock-data";
import { Megaphone, AlertTriangle, CloudSnow, Info, Bell, Send, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const typeConfig = {
  emergency: { icon: AlertTriangle, className: "text-emergency bg-emergency/15" },
  weather: { icon: CloudSnow, className: "text-info bg-info/15" },
  advisory: { icon: Info, className: "text-warning bg-warning/15" },
  general: { icon: Bell, className: "text-muted-foreground bg-muted" },
};

const Broadcast = () => {
  return (
    <DashboardLayout title="Broadcast Alerts" subtitle="Send push notifications to all app users">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Send New Broadcast */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Send className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">New Broadcast</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
                Alert Type
              </label>
              <Select>
                <SelectTrigger className="bg-input border-border text-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emergency">🔴 Emergency</SelectItem>
                  <SelectItem value="weather">🌨️ Weather</SelectItem>
                  <SelectItem value="advisory">⚠️ Advisory</SelectItem>
                  <SelectItem value="general">ℹ️ General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
                Title
              </label>
              <Input className="bg-input border-border text-sm" placeholder="Alert headline..." />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
                Message
              </label>
              <Textarea className="bg-input border-border text-sm min-h-[100px]" placeholder="Full alert message..." />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
                Priority
              </label>
              <Select>
                <SelectTrigger className="bg-input border-border text-sm">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="critical">Critical (bypasses DND)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm">
              <Send className="h-4 w-4 mr-2" />
              Send Broadcast
            </Button>
          </div>
        </div>

        {/* Recent Broadcasts */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            Recent Broadcasts
          </h2>
          {mockBroadcastAlerts.map((alert) => {
            const config = typeConfig[alert.type];
            const Icon = config.icon;
            return (
              <div key={alert.id} className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", config.className)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{alert.title}</span>
                      {alert.priority === "critical" && (
                        <span className="text-[10px] font-bold uppercase bg-emergency/15 text-emergency px-1.5 py-0.5 rounded">
                          Critical
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {alert.sentBy}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTimeAgo(alert.timestamp)}
                      </span>
                      <span>→ {alert.target}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Broadcast;
