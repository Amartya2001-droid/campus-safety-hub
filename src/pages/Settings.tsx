import { DashboardLayout } from "@/components/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  createIncidentReport,
  fetchRecentIncidents,
  getErrorMessage,
  registerMessagingToken,
  requestEscortAssignment,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
  triggerBroadcastNotification,
} from "@/lib/firebase-services";
import { isFirebaseConfigured, missingFirebaseKeys } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const SettingsPage = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [incidentTitle, setIncidentTitle] = useState("Suspicious activity near library");
  const [incidentLocation, setIncidentLocation] = useState("North Library Gate");
  const [incidentSummary, setIncidentSummary] = useState("Crowd gathering near entry checkpoint.");
  const [escortNotes, setEscortNotes] = useState("Need escort to Parking Lot B after late shift.");
  const [broadcastBody, setBroadcastBody] = useState("Emergency drill starts in 15 minutes.");
  const [vapidPublicKey, setVapidPublicKey] = useState(import.meta.env.VITE_FIREBASE_VAPID_PUBLIC_KEY ?? "");
  const [incidentsPreview, setIncidentsPreview] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const runAction = async (action: () => Promise<void>) => {
    setSubmitting(true);
    try {
      await action();
    } catch (error) {
      toast({
        title: "Action failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Settings" subtitle="System configuration and preferences">
      <div className="space-y-6">
        {!isFirebaseConfigured && (
          <Alert>
            <AlertTitle>Firebase is not configured yet</AlertTitle>
            <AlertDescription>
              Add missing Vite env vars: {missingFirebaseKeys.join(", ")}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Auth</CardTitle>
            <CardDescription>Create account, sign in, and sign out with Firebase Authentication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="officer@campus.edu"
                type="email"
              />
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                type="password"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={submitting || loading}
                onClick={() =>
                  runAction(async () => {
                    await signUpWithEmail(email, password);
                    toast({ title: "Account created" });
                  })
                }
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign up"}
              </Button>
              <Button
                variant="secondary"
                disabled={submitting || loading}
                onClick={() =>
                  runAction(async () => {
                    await signInWithEmail(email, password);
                    toast({ title: "Signed in" });
                  })
                }
              >
                Sign in
              </Button>
              <Button
                variant="outline"
                disabled={submitting || loading || !user}
                onClick={() =>
                  runAction(async () => {
                    await signOutCurrentUser();
                    toast({ title: "Signed out" });
                  })
                }
              >
                Sign out
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Current user: {loading ? "Checking session..." : user?.email ?? "Not signed in"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Firestore + Functions</CardTitle>
            <CardDescription>Write incidents to Firestore and invoke callable Cloud Functions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={incidentTitle} onChange={(event) => setIncidentTitle(event.target.value)} placeholder="Incident title" />
              <Input value={incidentLocation} onChange={(event) => setIncidentLocation(event.target.value)} placeholder="Incident location" />
            </div>
            <Textarea
              value={incidentSummary}
              onChange={(event) => setIncidentSummary(event.target.value)}
              placeholder="Incident summary"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={submitting || !user}
                onClick={() =>
                  runAction(async () => {
                    await createIncidentReport({
                      title: incidentTitle,
                      location: incidentLocation,
                      summary: incidentSummary,
                      severity: "medium",
                    });
                    toast({ title: "Incident saved to Firestore" });
                  })
                }
              >
                Write incident
              </Button>
              <Button
                variant="secondary"
                disabled={submitting || !user}
                onClick={() =>
                  runAction(async () => {
                    const incidents = await fetchRecentIncidents();
                    setIncidentsPreview(incidents.map((entry) => `${entry.title ?? "Untitled"} (${entry.id})`));
                    toast({ title: `Loaded ${incidents.length} incidents` });
                  })
                }
              >
                Read incidents
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Textarea
                value={escortNotes}
                onChange={(event) => setEscortNotes(event.target.value)}
                placeholder="Escort request notes"
              />
              <Textarea
                value={broadcastBody}
                onChange={(event) => setBroadcastBody(event.target.value)}
                placeholder="Broadcast message"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={submitting || !user}
                onClick={() =>
                  runAction(async () => {
                    const result = await requestEscortAssignment(incidentLocation, escortNotes);
                    toast({ title: `Escort request ${result.status}`, description: result.requestId });
                  })
                }
              >
                Call `assignEscort`
              </Button>
              <Button
                variant="outline"
                disabled={submitting || !user}
                onClick={() =>
                  runAction(async () => {
                    const result = await triggerBroadcastNotification("Campus Safety Broadcast", broadcastBody);
                    toast({ title: `Broadcast sent to ${result.sentCount} devices` });
                  })
                }
              >
                Call `sendBroadcastNotification`
              </Button>
            </div>
            {incidentsPreview.length > 0 && (
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium mb-2">Recent incidents</p>
                <ul className="space-y-1 text-muted-foreground">
                  {incidentsPreview.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Cloud Messaging</CardTitle>
            <CardDescription>Register browser push token and store it under <code>users/{"{uid}"}/tokens</code>.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={vapidPublicKey}
              onChange={(event) => setVapidPublicKey(event.target.value)}
              placeholder="Firebase Web Push certificate key (VAPID)"
            />
            <Button
              disabled={submitting || !user || !vapidPublicKey}
              onClick={() =>
                runAction(async () => {
                  const token = await registerMessagingToken(vapidPublicKey);
                  toast({
                    title: "Push token registered",
                    description: `${token.slice(0, 18)}...`,
                  });
                })
              }
            >
              Enable push notifications
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
