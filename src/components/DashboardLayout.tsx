import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatTimeAgo, apiRequest, apiFetch } from "@/lib/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ["/api/notifications/count"],
    queryFn: () => apiFetch("/api/notifications/count"),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: notifications } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => apiFetch("/api/notifications"),
    refetchInterval: 10000,
    retry: false,
  });

  const notificationList = Array.isArray(notifications) ? notifications : [];

  const unreadCount = countData?.count ?? 0;

  const markAllRead = async () => {
    await apiRequest("/api/notifications/read-all", { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const typeColors: Record<string, string> = {
    emergency: "bg-emergency",
    warning: "bg-warning",
    info: "bg-info",
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between gap-2 border-b border-border px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground" data-testid="button-sidebar-toggle" />
              <div>
                <h1 className="text-sm font-semibold text-foreground">{title}</h1>
                {subtitle && (
                  <p className="text-[11px] text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative text-muted-foreground" data-testid="button-notifications">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emergency text-[10px] font-bold text-emergency-foreground px-1" data-testid="text-notification-count">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
                    <h3 className="text-sm font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={markAllRead} data-testid="button-mark-all-read">
                        Mark all read
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="max-h-80">
                    {notificationList.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        No notifications yet
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {notificationList.slice(0, 20).map((n: any) => (
                          <div
                            key={n.id}
                            className={`p-3 text-sm ${!n.read ? "bg-accent/30" : ""}`}
                            data-testid={`notification-${n.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`mt-1 flex h-2 w-2 shrink-0 rounded-full ${typeColors[n.type] || "bg-muted-foreground"}`} />
                              <div className="min-w-0">
                                <p className="font-medium text-xs">{n.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">{formatTimeAgo(n.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
