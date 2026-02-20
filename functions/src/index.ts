import { initializeApp } from "firebase-admin/app";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

initializeApp();

const callableDefaults = {
  region: "northamerica-northeast1",
  enforceAppCheck: true,
};

type Role = "admin" | "student";

function getRole(request: { auth?: { token?: Record<string, unknown> | null } | null }): Role | null {
  const role = request.auth?.token?.role;
  if (role === "admin" || role === "student") {
    return role;
  }

  return null;
}

function requireRole(
  request: { auth?: { token?: Record<string, unknown> | null; uid?: string | null } | null },
  allowedRoles: Role[],
) {
  const role = getRole(request);
  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError("permission-denied", `Requires role: ${allowedRoles.join(", ")}`);
  }
}

function baseLogContext(request: { auth?: { uid?: string | null } | null; data?: unknown }) {
  return {
    uid: request.auth?.uid ?? null,
    hasPayload: Boolean(request.data),
  };
}

export const assignEscort = onCall(callableDefaults, async (request) => {
  const { FieldValue, getFirestore } = await import("firebase-admin/firestore");
  const db = getFirestore();
  logger.info("assign_escort_started", baseLogContext(request));

  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  requireRole(request, ["admin", "student"]);

  const location = request.data?.location;
  const notes = request.data?.notes;

  if (typeof location !== "string" || location.trim().length < 3) {
    throw new HttpsError("invalid-argument", "location must be at least 3 characters.");
  }

  if (typeof notes !== "string" || notes.trim().length < 5) {
    throw new HttpsError("invalid-argument", "notes must be at least 5 characters.");
  }

  const escortRequestRef = db.collection("escortRequests").doc();
  await escortRequestRef.set({
    location: location.trim(),
    notes: notes.trim(),
    status: "pending",
    requesterUid: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  logger.info("Escort request created", { requestId: escortRequestRef.id, uid: request.auth.uid });

  return {
    requestId: escortRequestRef.id,
    status: "pending",
  };
});

export const sendBroadcastNotification = onCall(callableDefaults, async (request) => {
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getMessaging } = await import("firebase-admin/messaging");
  const db = getFirestore();
  const messaging = getMessaging();
  logger.info("broadcast_notification_started", baseLogContext(request));

  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  requireRole(request, ["admin"]);

  const title = request.data?.title;
  const body = request.data?.body;

  if (typeof title !== "string" || title.trim().length < 3) {
    throw new HttpsError("invalid-argument", "title must be at least 3 characters.");
  }

  if (typeof body !== "string" || body.trim().length < 5) {
    throw new HttpsError("invalid-argument", "body must be at least 5 characters.");
  }

  const tokenDocs = await db.collectionGroup("tokens").get();
  const tokens = tokenDocs.docs.map((entry) => entry.id).filter(Boolean);

  if (tokens.length === 0) {
    return { sentCount: 0 };
  }

  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: title.trim(),
      body: body.trim(),
    },
    data: {
      type: "broadcast",
      senderUid: request.auth.uid,
    },
  });

  logger.info("Broadcast push sent", {
    uid: request.auth.uid,
    requested: tokens.length,
    success: result.successCount,
    failed: result.failureCount,
  });

  return {
    sentCount: result.successCount,
  };
});
