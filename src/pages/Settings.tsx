import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle2, XCircle, Link2, TestTube2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  safety_official: "Safety Official",
  student: "Student",
  faculty: "Faculty",
};

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [starrezUrl, setStarrezUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: config } = useQuery({
    queryKey: ["/api/starrez/config"],
    queryFn: () => apiFetch("/api/starrez/config"),
    retry: false,
  });

  useEffect(() => {
    if (config?.base_url) {
      setStarrezUrl(config.base_url);
    }
  }, [config]);

  const handleSave = async () => {
    if (!starrezUrl.trim()) {
      toast({ title: "URL required", description: "Please enter your StarRez instance URL", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/api/starrez/config", {
        method: "POST",
        body: JSON.stringify({ base_url: starrezUrl.trim() }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/starrez/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/starrez/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "StarRez configuration saved" });
      setTestResult(null);
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiFetch("/api/starrez/test");
      setTestResult(result);
      if (result?.success) {
        toast({ title: "Connection successful", description: result.message });
      } else {
        toast({ title: "Connection failed", description: result?.message || "Unknown error", variant: "destructive" });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <DashboardLayout title="Settings" subtitle="System configuration and integrations">
      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-lg">Account</CardTitle>
                <CardDescription>Your current session information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium" data-testid="text-settings-name">{user.name}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium" data-testid="text-settings-email">{user.email}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Role</span>
                  <Badge variant="outline" data-testid="text-settings-role">{roleLabels[user.role] || user.role}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not signed in</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  StarRez Integration
                </CardTitle>
                <CardDescription>
                  Connect to your StarRez instance to pull incident reports. Your portal login credentials are used automatically.
                </CardDescription>
              </div>
              {config?.base_url && (
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Configured
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">StarRez REST API URL</label>
              <Input
                value={starrezUrl}
                onChange={(e) => setStarrezUrl(e.target.value)}
                placeholder="https://yourinstitution.starrezhousing.com/StarRezREST"
                data-testid="input-starrez-url"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Usually looks like: https://yourinstitution.starrezhousing.com/StarRezREST
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleSave}
                disabled={saving || !starrezUrl.trim()}
                data-testid="button-save-starrez"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Configuration
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || !config?.base_url}
                data-testid="button-test-starrez"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <TestTube2 className="h-4 w-4 mr-1" />}
                Test Connection
              </Button>
            </div>

            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${testResult.success ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}
                data-testid="text-test-result"
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="rounded-md border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">How it works</p>
              <p>Your portal credentials are used to authenticate with StarRez automatically.</p>
              <p>Incident reports are fetched in real-time from StarRez's REST API and displayed in the Reports page.</p>
              <p>No reports are stored locally - everything comes directly from StarRez.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
