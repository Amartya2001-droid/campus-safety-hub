import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { formatTimeAgo, apiRequest, fetchEscortRequests } from "@/lib/api";
import { Clock, MapPin, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const Escorts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isStaff = user?.role === "admin" || user?.role === "safety_official";
  const queryClient = useQueryClient();
  const { data: escortsData, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/escort-requests", user?.id, user?.role],
    enabled: !!user,
    queryFn: fetchEscortRequests,
    refetchInterval: 10000,
    retry: false,
  });
  const escorts = Array.isArray(escortsData) ? escortsData : [];

  const updateStatus = useMutation({
    mutationFn: ({ id, status, assigned_officer, eta }: { id: number; status: string; assigned_officer?: string; eta?: string }) =>
      apiRequest(`/api/escort-requests/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, assigned_officer, eta }),
      }),
    onError: (error: Error) => toast({ title: "Unable to update escort", description: error.message, variant: "destructive" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/escort-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  return (
    <DashboardLayout title="Escort Requests" subtitle="SafeWalk escort queue management">
      {isError ? (
        <div role="alert" className="glass-card p-4">Escort requests unavailable. <Button onClick={() => refetch()}>Retry</Button></div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : escorts.length === 0 ? (
        <div className="glass-card p-12 text-center text-sm text-muted-foreground" data-testid="text-no-escorts">
          No escort requests yet. Requests will appear here in real time.
        </div>
      ) : (
        <div className="space-y-3">
          {escorts.map((escort) => (
            <div key={escort.id} className="glass-card p-4 hover:border-primary/30 transition-colors" data-testid={`card-escort-${escort.id}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/15 text-warning text-sm font-bold shrink-0">
                    {escort.student_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold">{escort.student_name}</span>
                      <StatusBadge status={escort.status} />
                      {escort.eta && (
                        <span className="text-[11px] bg-info/15 text-info px-2 py-0.5 rounded-full">
                          ETA: {escort.eta}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {escort.pickup}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {escort.destination}
                      </span>
                    </div>
                    {escort.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 italic">"{escort.notes}"</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTimeAgo(escort.created_at)}
                      </span>
                      {escort.assigned_officer && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {escort.assigned_officer}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {isStaff && escort.status === "pending" && (
                    <Button
                      size="sm"
                      disabled={updateStatus.isPending}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                      data-testid={`button-assign-escort-${escort.id}`}
                      onClick={() => updateStatus.mutate({ id: escort.id, status: "assigned", assigned_officer: user.name })}
                    >
                      Assign Officer
                    </Button>
                  )}
                  {isStaff && escort.status === "assigned" && (
                    <Button
                      size="sm"
                      disabled={updateStatus.isPending}
                      className="text-xs"
                      data-testid={`button-start-escort-${escort.id}`}
                      onClick={() => updateStatus.mutate({ id: escort.id, status: "in_progress" })}
                    >
                      Start Escort
                    </Button>
                  )}
                  {isStaff && escort.status === "in_progress" && (
                    <Button
                      size="sm"
                      disabled={updateStatus.isPending}
                      variant="outline"
                      className="text-xs border-success/30 text-success"
                      data-testid={`button-complete-escort-${escort.id}`}
                      onClick={() => updateStatus.mutate({ id: escort.id, status: "completed" })}
                    >
                      Mark Completed
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Escorts;
