import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getToken } from "firebase/messaging";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  auth,
  db,
  functions,
  getFirebaseErrorMessage,
  getMessagingClient,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { logEvent } from "@/lib/observability";

export interface IncidentInput {
  title: string;
  location: string;
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
}

function ensureFirebase() {
  if (!isFirebaseConfigured || !auth || !db || !functions) {
    throw new Error("Firebase is not configured. Add environment variables first.");
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  ensureFirebase();
  return createUserWithEmailAndPassword(auth!, email, password);
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  ensureFirebase();
  return signInWithEmailAndPassword(auth!, email, password);
}

export async function signOutCurrentUser() {
  ensureFirebase();
  return signOut(auth!);
}

export async function createIncidentReport(input: IncidentInput) {
  ensureFirebase();

  const user = auth!.currentUser;
  if (!user) {
    throw new Error("Sign in before creating incident reports.");
  }

  const incidentsRef = collection(db!, "incidents");
  const payload = {
    ...input,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    status: "open",
  };

  const created = await addDoc(incidentsRef, payload);
  logEvent({
    level: "info",
    message: "incident_created",
    context: { incidentId: created.id, severity: input.severity },
  });
  return created;
}

export async function fetchRecentIncidents() {
  ensureFirebase();

  const incidentsRef = collection(db!, "incidents");
  const incidentsQuery = query(incidentsRef, orderBy("createdAt", "desc"), limit(5));
  const snapshot = await getDocs(incidentsQuery);

  const incidents = snapshot.docs.map((entry) => ({
    id: entry.id,
    ...entry.data(),
  }));
  logEvent({
    level: "info",
    message: "incidents_fetched",
    context: { count: incidents.length },
  });
  return incidents;
}

export async function requestEscortAssignment(location: string, notes: string) {
  ensureFirebase();

  const user = auth!.currentUser;
  if (!user) {
    throw new Error("Sign in before requesting escorts.");
  }

  const callable = httpsCallable(functions!, "assignEscort");
  const response = await callable({ location, notes });
  logEvent({ level: "info", message: "escort_assignment_requested", context: { location } });
  return response.data as { requestId: string; status: string };
}

export async function triggerBroadcastNotification(title: string, body: string) {
  ensureFirebase();

  const user = auth!.currentUser;
  if (!user) {
    throw new Error("Sign in before sending broadcast notifications.");
  }

  const callable = httpsCallable(functions!, "sendBroadcastNotification");
  const response = await callable({ title, body });
  logEvent({ level: "info", message: "broadcast_triggered", context: { title } });
  return response.data as { sentCount: number };
}

export async function registerMessagingToken(vapidPublicKey: string) {
  ensureFirebase();

  const user = auth!.currentUser;
  if (!user) {
    throw new Error("Sign in before enabling push notifications.");
  }

  const messaging = await getMessagingClient();
  if (!messaging) {
    throw new Error("Cloud Messaging is not supported in this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission is required.");
  }

  const token = await getToken(messaging, {
    vapidKey: vapidPublicKey,
    serviceWorkerRegistration: await navigator.serviceWorker.register("/firebase-messaging-sw.js"),
  });

  if (!token) {
    throw new Error("Failed to receive push token.");
  }

  const tokenRef = doc(db!, "users", user.uid, "tokens", token);
  await setDoc(tokenRef, { createdAt: serverTimestamp(), platform: navigator.userAgent }, { merge: true });
  logEvent({
    level: "info",
    message: "messaging_token_registered",
    context: { uid: user.uid, tokenPrefix: token.slice(0, 12) },
  });

  return token;
}

export function getErrorMessage(error: unknown) {
  const message = getFirebaseErrorMessage(error);
  logEvent({ level: "error", message: "firebase_service_error", context: { message } });
  return message;
}
