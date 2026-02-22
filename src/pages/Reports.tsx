import { DashboardLayout } from "@/components/DashboardLayout";
import { formatTimeAgo, apiFetch } from "@/lib/api";
import { Clock, MapPin, ExternalLink, RefreshCw, AlertCircle, Link2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const Reports = () => {
  const queryClient = useQueryClient();

  const { data: starrezData, isLoading, isFetching } = useQuery({
    queryKey: ["/api/starrez/incidents"],
    queryFn: () => apiFetch("/api/starrez/incidents"),
    refetchInterval: 30000,
    retry: false,
  });

  const connected = starrezData?.connected ?? false;
  const incidents = Array.isArray(starrezData?.data) ? starrezData.data : [];
  const statusMessage = starrezData?.message || "";

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/starrez/incidents"] });
  };

  return (
    <DashboardLayout title="Incident Reports" subtitle="Powered by StarRez">
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-border flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">StarRez Integration</span>
            {connected ? (
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                <AlertCircle className="h-3 w-3 text-yellow-500" />
                Not Connected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!connected && (
              <Link to="/settings">
                <Button variant="outline" size="sm" className="text-xs gap-1" data-testid="button-configure-starrez">
                  <Link2 className="h-3.5 w-3.5" />
                  Configure
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={handleRefresh}
              disabled={isFetching}
              data-testid="button-refresh-reports"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : !connected ? (
          <div className="p-12 text-center" data-testid="text-starrez-not-configured">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">StarRez Not Configured</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
              {statusMessage || "Connect your StarRez instance to pull incident reports directly into the dashboard."}
            </p>
            <Link to="/settings">
              <Button variant="default" size="sm" data-testid="button-go-to-settings">
                Go to Settings
              </Button>
            </Link>
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground" data-testid="text-no-reports">
            No incident reports found in StarRez.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">ID</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Category</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Description</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Location</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident: any, idx: number) => (
                <TableRow key={incident.IncidentReportID || idx} className="border-border hover:bg-accent/30" data-testid={`row-report-${incident.IncidentReportID || idx}`}>
                  <TableCell>
                    <span className="text-xs font-mono text-muted-foreground">
                      #{incident.IncidentReportID || idx + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {incident.DateReported
                        ? new Date(incident.DateReported).toLocaleDateString()
                        : incident.DateCreated
                          ? new Date(incident.DateCreated).toLocaleDateString()
                          : "\u2014"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium capitalize">
                      {incident.CategoryName || incident.IncidentCategoryID || "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
                      {incident.Description || incident.Comments || "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {incident.LocationDescription || incident.RoomLocationDescription || "\u2014"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {incident.StatusName || incident.IncidentStatusEnum || "Open"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {connected && incidents.length > 0 && (
          <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
            {statusMessage}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
