import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { mockIncidentReports, formatTimeAgo } from "@/lib/mock-data";
import { Clock, MapPin, Paperclip, Eye, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const priorityStyles = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/15 text-warning",
  high: "bg-emergency/15 text-emergency",
};

const Reports = () => {
  return (
    <DashboardLayout title="Incident Reports" subtitle="Campus incident reports and investigations">
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Location</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Reporter</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Priority</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockIncidentReports.map((report) => (
              <TableRow key={report.id} className="border-border hover:bg-accent/30">
                <TableCell>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(report.timestamp)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium capitalize">
                    {report.type.replace("_", " ")}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {report.location}
                  </div>
                </TableCell>
                <TableCell>
                  {report.anonymous ? (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <UserX className="h-3 w-3" /> Anonymous
                    </span>
                  ) : (
                    <span className="text-sm">{report.reporterName}</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={cn("text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full", priorityStyles[report.priority])}>
                    {report.priority}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={report.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {report.hasAttachments && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Paperclip className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
