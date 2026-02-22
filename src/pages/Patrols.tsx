import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { formatTimeAgo, apiFetch, apiRequest } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Clock,
  Play,
  Square,
  Check,
  X,
  MapPin,
  Timer,
  ChevronDown,
  ChevronUp,
  Building2,
} from "lucide-react";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatMinuteDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function PatrolTimer({ startedAt, maxMinutes }: { startedAt: string; maxMinutes: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed(Date.now() - start);
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const maxMs = maxMinutes * 60 * 1000;
  const progress = Math.min((elapsed / maxMs) * 100, 100);
  const remaining = Math.max(maxMs - elapsed, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> Elapsed: {formatDuration(elapsed)}</span>
        <span>Remaining: {formatDuration(remaining)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progress > 90 ? "bg-emergency" : progress > 70 ? "bg-warning" : "bg-success"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground text-right">
        {maxMinutes / 60}h shift limit
      </p>
    </div>
  );
}

function CheckinPanel({ sessionId, isActive }: { sessionId: number; isActive: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [residence, setResidence] = useState("");

  const { data: checkins, isLoading } = useQuery({
    queryKey: ["/api/patrol-sessions", sessionId, "checkins"],
    queryFn: () => apiFetch(`/api/patrol-sessions/${sessionId}/checkins`),
    refetchInterval: 10000,
    retry: false,
  });

  const checkinList = Array.isArray(checkins) ? checkins : [];
  const openCheckin = checkinList.find((c: any) => !c.departure_at);

  const handleCheckin = async () => {
    if (!residence.trim()) return;
    try {
      await apiRequest(`/api/patrol-sessions/${sessionId}/checkins`, {
        method: "POST",
        body: JSON.stringify({ residence_name: residence.trim() }),
      });
      setResidence("");
      queryClient.invalidateQueries({ queryKey: ["/api/patrol-sessions", sessionId, "checkins"] });
      toast({ title: "Checked in", description: `Arrived at ${residence.trim()}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDepart = async (checkinId: number) => {
    try {
      await apiRequest(`/api/patrol-checkins/${checkinId}/depart`, { method: "PATCH" });
      queryClient.invalidateQueries({ queryKey: ["/api/patrol-sessions", sessionId, "checkins"] });
      toast({ title: "Departed", description: "Departure recorded" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Building2 className="h-3 w-3" /> Residence Check-ins
      </h4>

      {isActive && (
        <div className="flex gap-2">
          <Input
            placeholder="Enter residence name..."
            value={residence}
            onChange={(e) => setResidence(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheckin()}
            data-testid="input-residence-name"
          />
          <Button
            onClick={handleCheckin}
            disabled={!residence.trim()}
            data-testid="button-checkin"
          >
            <MapPin className="h-4 w-4 mr-1" /> Check In
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-20" />
      ) : checkinList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No check-ins yet</p>
      ) : (
        <div className="space-y-2">
          {checkinList.map((c: any) => {
            const arrival = new Date(c.arrival_at).getTime();
            const departure = c.departure_at ? new Date(c.departure_at).getTime() : null;
            const duration = departure ? departure - arrival : null;

            return (
              <div
                key={c.id}
                className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${!c.departure_at ? "border-success/30 bg-success/5" : "border-border"}`}
                data-testid={`checkin-${c.id}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {c.residence_name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span>Arrived: {new Date(c.arrival_at).toLocaleTimeString()}</span>
                    {c.departure_at && (
                      <span>Departed: {new Date(c.departure_at).toLocaleTimeString()}</span>
                    )}
                    {duration && (
                      <span className="font-medium text-foreground">
                        {formatMinuteDuration(duration)}
                      </span>
                    )}
                  </div>
                </div>
                {!c.departure_at && isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDepart(c.id)}
                    data-testid={`button-depart-${c.id}`}
                  >
                    Depart
                  </Button>
                )}
                {!c.departure_at && !isActive && (
                  <span className="text-xs text-muted-foreground">Auto-departed</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, isAdmin }: { session: any; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(session.status === "active");
  const [ending, setEnding] = useState(false);

  const isMySession = user?.id === session.assigned_student_id;
  const isActive = session.status === "active";

  const handleAccept = async () => {
    try {
      await apiRequest(`/api/patrol-sessions/${session.id}/accept`, { method: "PATCH" });
      queryClient.invalidateQueries({ queryKey: ["/api/patrol-sessions"] });
      toast({ title: "Patrol accepted", description: "Your patrol shift has started. You have 5 hours." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDecline = async () => {
    try {
      await apiRequest(`/api/patrol-sessions/${session.id}/decline`, { method: "PATCH" });
      queryClient.invalidateQueries({ queryKey: ["/api/patrol-sessions"] });
      toast({ title: "Patrol declined" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleEnd = async () => {
    setEnding(true);
    try {
      await apiRequest(`/api/patrol-sessions/${session.id}/end`, { method: "PATCH" });
      queryClient.invalidateQueries({ queryKey: ["/api/patrol-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Patrol ended", description: "Your patrol shift has been completed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setEnding(false);
    }
  };

  return (
    <Card data-testid={`patrol-session-${session.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{session.student_name}</span>
              <StatusBadge status={session.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {isAdmin && session.creator_name && (
                <span>Assigned by {session.creator_name}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatTimeAgo(session.requested_at)}
              </span>
              {session.notes && <span>{session.notes}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {session.status === "pending" && isMySession && (
              <>
                <Button size="sm" onClick={handleAccept} data-testid={`button-accept-${session.id}`}>
                  <Check className="h-3 w-3 mr-1" /> Accept
                </Button>
                <Button variant="outline" size="sm" onClick={handleDecline} data-testid={`button-decline-${session.id}`}>
                  <X className="h-3 w-3 mr-1" /> Decline
                </Button>
              </>
            )}
            {isActive && (isMySession || isAdmin) && (
              <Button variant="outline" size="sm" onClick={handleEnd} disabled={ending} data-testid={`button-end-${session.id}`}>
                <Square className="h-3 w-3 mr-1" /> End Shift
              </Button>
            )}
            {(isActive || session.status === "completed" || session.status === "expired") && (
              <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)} data-testid={`button-expand-${session.id}`}>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {isActive && session.started_at && (
          <PatrolTimer startedAt={session.started_at} maxMinutes={session.max_duration_minutes} />
        )}

        {expanded && (
          <CheckinPanel sessionId={session.id} isActive={isActive} />
        )}

        {(session.status === "completed" || session.status === "expired") && session.started_at && session.ended_at && !expanded && (
          <div className="text-xs text-muted-foreground">
            Shift duration: {formatMinuteDuration(new Date(session.ended_at).getTime() - new Date(session.started_at).getTime())}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Patrols() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "safety_official";

  const [studentId, setStudentId] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["/api/patrol-sessions"],
    queryFn: () => apiFetch("/api/patrol-sessions"),
    refetchInterval: 10000,
    retry: false,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiFetch("/api/users"),
    retry: false,
    enabled: isAdmin,
  });

  const sessionList = Array.isArray(sessions) ? sessions : [];
  const studentUsers = Array.isArray(users) ? users.filter((u: any) => u.role === "student") : [];

  const activeSessions = sessionList.filter((s: any) => s.status === "active");
  const pendingSessions = sessionList.filter((s: any) => s.status === "pending");
  const pastSessions = sessionList.filter((s: any) => ["completed", "expired", "declined"].includes(s.status));

  const handleCreate = async () => {
    if (!studentId) {
      toast({ title: "Missing field", description: "Please select a student", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await apiRequest("/api/patrol-sessions", {
        method: "POST",
        body: JSON.stringify({
          assigned_student_id: parseInt(studentId),
          notes: notes.trim() || undefined,
        }),
      });
      setStudentId("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/patrol-sessions"] });
      toast({ title: "Patrol assigned", description: "Student has been notified of their patrol assignment." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout title="Campus Patrol" subtitle="Track and manage patrol shifts">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {pendingSessions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                Pending Assignments ({pendingSessions.length})
              </h2>
              <div className="space-y-3">
                {pendingSessions.map((s: any) => (
                  <SessionCard key={s.id} session={s} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          )}

          {activeSessions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Play className="h-4 w-4 text-success" />
                Active Patrols ({activeSessions.length})
              </h2>
              <div className="space-y-3">
                {activeSessions.map((s: any) => (
                  <SessionCard key={s.id} session={s} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : activeSessions.length === 0 && pendingSessions.length === 0 && pastSessions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">No patrol sessions yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAdmin ? "Assign a student to start tracking campus patrols." : "You'll see your patrol assignments here."}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {pastSessions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                Past Sessions ({pastSessions.length})
              </h2>
              <div className="space-y-3">
                {pastSessions.map((s: any) => (
                  <SessionCard key={s.id} session={s} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {isAdmin && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Assign Patrol
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Student</Label>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger data-testid="select-patrol-student">
                      <SelectValue placeholder="Select a student..." />
                    </SelectTrigger>
                    <SelectContent>
                      {studentUsers.map((u: any) => (
                        <SelectItem key={u.id} value={u.id.toString()} data-testid={`option-student-${u.id}`}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea
                    placeholder="Any instructions for this patrol shift..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="resize-none text-sm"
                    rows={2}
                    data-testid="input-patrol-notes"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={creating || !studentId}
                  data-testid="button-assign-patrol"
                >
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  {creating ? "Assigning..." : "Assign Patrol Shift"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  The student will receive a notification and must accept before the shift begins. Shifts are limited to 5 hours.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Patrols</span>
                <span className="font-medium" data-testid="text-active-patrols">{activeSessions.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium" data-testid="text-pending-patrols">{pendingSessions.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium" data-testid="text-completed-patrols">
                  {pastSessions.filter((s: any) => s.status === "completed").length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expired</span>
                <span className="font-medium" data-testid="text-expired-patrols">
                  {pastSessions.filter((s: any) => s.status === "expired").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
