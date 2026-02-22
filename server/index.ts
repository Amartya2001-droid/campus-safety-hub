import express from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import {
  initDb, findUserByEmailAndRole, findUserById, getAllUsers, pool,
  getSOSAlerts, createSOSAlert, updateSOSAlertStatus,
  getEscortRequests, createEscortRequest, updateEscortStatus,
  getBroadcastAlerts, createBroadcastAlert,
  getNotifications, getUnreadNotificationCount, createNotification, markNotificationsRead, markNotificationRead,
  getStarrezConfig, upsertStarrezConfig,
  getPatrolSessions, createPatrolSession, acceptPatrolSession, declinePatrolSession,
  endPatrolSession, getPatrolCheckins, createPatrolCheckin, departPatrolCheckin, getActivePatrolCount,
  getCampusLocations, createCampusLocation, updateCampusLocation, deleteCampusLocation,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

declare module "express-session" {
  interface SessionData {
    userId: number;
    starrezPassword: string;
  }
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

async function start() {
  await initDb();

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());

  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  const PgStore = ConnectPgSimple(session);

  app.use(
    session({
      store: new PgStore({
        pool: pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "acadia-safe-dev-secret-change-in-prod",
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        httpOnly: true,
        sameSite: "none" as const,
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.post("/api/login", async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ message: "Email, password, and role are required" });
    }
    const user = await findUserByEmailAndRole(email, role);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    req.session.userId = user.id;
    req.session.starrezPassword = password;
    const { password_hash, ...safeUser } = user;
    return res.json(safeUser);
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });

  app.get("/api/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await findUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    return res.json(user);
  });

  app.get("/api/users", requireAuth, async (_req, res) => {
    const users = await getAllUsers();
    return res.json(users);
  });

  app.get("/api/sos-alerts", requireAuth, async (_req, res) => {
    const alerts = await getSOSAlerts();
    return res.json(alerts);
  });

  app.post("/api/sos-alerts", requireAuth, async (req, res) => {
    const { student_name, student_phone, student_email, location, lat, lng, type, notes } = req.body;
    if (!student_name || !location) {
      return res.status(400).json({ message: "Student name and location are required" });
    }
    const alert = await createSOSAlert({
      student_name, student_phone, student_email, location, lat, lng, type, notes,
      created_by: req.session.userId,
    });
    await createNotification({
      title: "New SOS Alert",
      message: `${student_name} triggered an SOS from ${location}`,
      type: "emergency",
      reference_type: "sos_alert",
      reference_id: alert.id,
    });
    return res.status(201).json(alert);
  });

  app.patch("/api/sos-alerts/:id/status", requireAuth, async (req, res) => {
    const { status, assigned_officer } = req.body;
    const alert = await updateSOSAlertStatus(parseInt(req.params.id as string), status, assigned_officer);
    if (!alert) return res.status(404).json({ message: "Alert not found" });
    if (status !== "new") {
      await createNotification({
        title: `SOS Alert ${status.replace("_", " ")}`,
        message: `Alert for ${alert.student_name} is now ${status.replace("_", " ")}`,
        type: "info",
        reference_type: "sos_alert",
        reference_id: alert.id,
      });
    }
    return res.json(alert);
  });

  app.get("/api/escort-requests", requireAuth, async (_req, res) => {
    const requests = await getEscortRequests();
    return res.json(requests);
  });

  app.post("/api/escort-requests", requireAuth, async (req, res) => {
    const { student_name, student_phone, pickup, destination, notes } = req.body;
    if (!student_name || !pickup || !destination) {
      return res.status(400).json({ message: "Student name, pickup, and destination are required" });
    }
    const request = await createEscortRequest({
      student_name, student_phone, pickup, destination, notes,
      created_by: req.session.userId,
    });
    await createNotification({
      title: "New Escort Request",
      message: `${student_name} needs escort from ${pickup} to ${destination}`,
      type: "warning",
      reference_type: "escort_request",
      reference_id: request.id,
    });
    return res.status(201).json(request);
  });

  app.patch("/api/escort-requests/:id/status", requireAuth, async (req, res) => {
    const { status, assigned_officer, eta } = req.body;
    const request = await updateEscortStatus(parseInt(req.params.id as string), status, assigned_officer, eta);
    if (!request) return res.status(404).json({ message: "Request not found" });
    return res.json(request);
  });

  app.get("/api/starrez/config", requireAuth, async (_req, res) => {
    const config = await getStarrezConfig();
    return res.json(config || { base_url: "" });
  });

  app.post("/api/starrez/config", requireAuth, async (req, res) => {
    const { base_url } = req.body;
    if (!base_url) {
      return res.status(400).json({ message: "StarRez base URL is required" });
    }
    const normalizedUrl = base_url.replace(/\/+$/, "");
    const config = await upsertStarrezConfig(normalizedUrl);
    return res.json(config);
  });

  app.get("/api/starrez/incidents", requireAuth, async (req, res) => {
    const config = await getStarrezConfig();
    if (!config || !config.base_url) {
      return res.json({ connected: false, data: [], message: "StarRez is not configured. Add your StarRez URL in Settings." });
    }
    const user = await findUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });

    const starrezPass = req.session.starrezPassword;
    if (!starrezPass) {
      return res.json({ connected: false, data: [], message: "Please log out and log back in so your credentials can be used for StarRez." });
    }

    try {
      const starrezUrl = `${config.base_url}/services/select/IncidentReport`;
      const credentials = Buffer.from(`${user.email}:${starrezPass}`).toString("base64");

      const response = await fetch(starrezUrl, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) {
          return res.json({ connected: false, data: [], message: "StarRez authentication failed. Check your credentials." });
        }
        return res.json({ connected: false, data: [], message: `StarRez returned error ${status}. Check your URL and try again.` });
      }

      const data = await response.json();
      const incidents = Array.isArray(data) ? data : [];
      return res.json({ connected: true, data: incidents, message: `${incidents.length} reports loaded from StarRez` });
    } catch (error: any) {
      if (error.cause?.code === "ENOTFOUND" || error.cause?.code === "ECONNREFUSED") {
        return res.json({ connected: false, data: [], message: "Cannot reach StarRez server. Check your URL." });
      }
      return res.json({ connected: false, data: [], message: `Connection error: ${error.message}` });
    }
  });

  app.get("/api/starrez/test", requireAuth, async (req, res) => {
    const config = await getStarrezConfig();
    if (!config || !config.base_url) {
      return res.json({ success: false, message: "StarRez URL not configured" });
    }
    const user = await findUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });

    const starrezPass = req.session.starrezPassword;
    if (!starrezPass) {
      return res.json({ success: false, message: "Please log out and log back in so your credentials can be used for StarRez." });
    }

    try {
      const starrezUrl = `${config.base_url}/services/select/IncidentReport?_top=1`;
      const credentials = Buffer.from(`${user.email}:${starrezPass}`).toString("base64");

      const response = await fetch(starrezUrl, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Accept": "application/json",
        },
      });

      if (response.ok) {
        return res.json({ success: true, message: "Connected to StarRez successfully" });
      }
      if (response.status === 401 || response.status === 403) {
        return res.json({ success: false, message: "Authentication failed - check credentials" });
      }
      return res.json({ success: false, message: `StarRez returned status ${response.status}` });
    } catch (error: any) {
      return res.json({ success: false, message: `Cannot reach StarRez: ${error.message}` });
    }
  });

  app.get("/api/broadcast-alerts", requireAuth, async (_req, res) => {
    const alerts = await getBroadcastAlerts();
    return res.json(alerts);
  });

  app.post("/api/broadcast-alerts", requireAuth, async (req, res) => {
    const { type, title, message, priority, target } = req.body;
    if (!type || !title || !message) {
      return res.status(400).json({ message: "Type, title, and message are required" });
    }
    const user = await findUserById(req.session.userId!);
    const alert = await createBroadcastAlert({
      type, title, message, priority, target,
      sent_by: user?.name || "System",
      created_by: req.session.userId,
    });
    await createNotification({
      title: `Broadcast: ${title}`,
      message: message.substring(0, 200),
      type: priority === "critical" ? "emergency" : "info",
      reference_type: "broadcast_alert",
      reference_id: alert.id,
    });
    return res.status(201).json(alert);
  });

  app.get("/api/notifications", requireAuth, async (_req, res) => {
    const notifications = await getNotifications();
    return res.json(notifications);
  });

  app.get("/api/notifications/count", requireAuth, async (_req, res) => {
    const count = await getUnreadNotificationCount();
    return res.json({ count });
  });

  app.post("/api/notifications/read-all", requireAuth, async (_req, res) => {
    await markNotificationsRead();
    return res.json({ message: "All notifications marked as read" });
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await markNotificationRead(parseInt(req.params.id as string));
    return res.json({ message: "Notification marked as read" });
  });

  app.get("/api/patrol-sessions", requireAuth, async (req, res) => {
    const user = await findUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });
    const sessions = await getPatrolSessions(user.role, user.id);
    return res.json(sessions);
  });

  app.post("/api/patrol-sessions", requireAuth, async (req, res) => {
    const user = await findUserById(req.session.userId!);
    if (!user || (user.role !== "admin" && user.role !== "safety_official")) {
      return res.status(403).json({ message: "Only admins and safety officials can create patrol sessions" });
    }
    const { assigned_student_id, notes } = req.body;
    if (!assigned_student_id || typeof assigned_student_id !== "number") {
      return res.status(400).json({ message: "Valid student selection is required" });
    }
    const student = await findUserById(assigned_student_id);
    if (!student || student.role !== "student") {
      return res.status(400).json({ message: "Selected user must be a student" });
    }
    const session = await createPatrolSession(user.id, assigned_student_id, notes);
    await createNotification({
      title: "Campus Patrol Assignment",
      message: `You have been assigned a campus patrol shift by ${user.name}`,
      type: "info",
      reference_type: "patrol_session",
      reference_id: session.id,
    });
    return res.status(201).json(session);
  });

  app.patch("/api/patrol-sessions/:id/accept", requireAuth, async (req, res) => {
    const session = await acceptPatrolSession(parseInt(req.params.id as string), req.session.userId!);
    if (!session) return res.status(404).json({ message: "Session not found or not pending" });
    return res.json(session);
  });

  app.patch("/api/patrol-sessions/:id/decline", requireAuth, async (req, res) => {
    const session = await declinePatrolSession(parseInt(req.params.id as string), req.session.userId!);
    if (!session) return res.status(404).json({ message: "Session not found or not pending" });
    return res.json(session);
  });

  app.patch("/api/patrol-sessions/:id/end", requireAuth, async (req, res) => {
    const user = await findUserById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });
    const sessionId = parseInt(req.params.id as string);
    const sessions = await getPatrolSessions(user.role, user.id);
    const target = sessions.find((s: any) => s.id === sessionId && s.status === "active");
    if (!target) return res.status(404).json({ message: "Session not found or not active" });
    if (user.role !== "admin" && user.role !== "safety_official" && user.id !== target.assigned_student_id) {
      return res.status(403).json({ message: "Not authorized to end this session" });
    }
    const session = await endPatrolSession(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found or not active" });
    return res.json(session);
  });

  app.get("/api/patrol-sessions/:id/checkins", requireAuth, async (req, res) => {
    const checkins = await getPatrolCheckins(parseInt(req.params.id as string));
    return res.json(checkins);
  });

  app.post("/api/patrol-sessions/:id/checkins", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const sessionId = parseInt(req.params.id as string);
    const { residence_name, notes } = req.body;
    if (!residence_name || typeof residence_name !== "string" || !residence_name.trim()) {
      return res.status(400).json({ message: "Residence name is required" });
    }
    const user = await findUserById(userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const sessions = await getPatrolSessions(user.role, userId);
    const target = sessions.find((s: any) => s.id === sessionId && s.status === "active");
    if (!target) return res.status(404).json({ message: "Session not found or not active" });
    if (target.assigned_student_id !== userId) {
      return res.status(403).json({ message: "Only the assigned student can check in" });
    }
    const checkin = await createPatrolCheckin(sessionId, residence_name.trim(), notes);
    return res.status(201).json(checkin);
  });

  app.patch("/api/patrol-checkins/:id/depart", requireAuth, async (req, res) => {
    const checkin = await departPatrolCheckin(parseInt(req.params.id as string));
    if (!checkin) return res.status(404).json({ message: "Checkin not found or already departed" });
    return res.json(checkin);
  });

  app.get("/api/campus-locations", requireAuth, async (_req, res) => {
    const locations = await getCampusLocations();
    return res.json(locations);
  });

  app.post("/api/campus-locations", requireAuth, async (req, res) => {
    const user = await findUserById(req.session.userId!);
    if (!user || (user.role !== "admin" && user.role !== "safety_official")) {
      return res.status(403).json({ message: "Only admins and safety officials can manage locations" });
    }
    const { name, type, lat, lng, description } = req.body;
    if (!name || !type || lat == null || lng == null) {
      return res.status(400).json({ message: "Name, type, lat, and lng are required" });
    }
    const validTypes = ["blue_phone", "safe_zone", "aed", "building", "parking"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid location type" });
    }
    const location = await createCampusLocation({ name, type, lat, lng, description });
    return res.status(201).json(location);
  });

  app.patch("/api/campus-locations/:id", requireAuth, async (req, res) => {
    const user = await findUserById(req.session.userId!);
    if (!user || (user.role !== "admin" && user.role !== "safety_official")) {
      return res.status(403).json({ message: "Only admins and safety officials can manage locations" });
    }
    const { name, type, lat, lng, description } = req.body;
    const validTypes = ["blue_phone", "safe_zone", "aed", "building", "parking"];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid location type" });
    }
    if (lat !== undefined && (typeof lat !== "number" || isNaN(lat))) {
      return res.status(400).json({ message: "Latitude must be a valid number" });
    }
    if (lng !== undefined && (typeof lng !== "number" || isNaN(lng))) {
      return res.status(400).json({ message: "Longitude must be a valid number" });
    }
    const location = await updateCampusLocation(parseInt(req.params.id as string), { name, type, lat, lng, description });
    if (!location) return res.status(404).json({ message: "Location not found" });
    return res.json(location);
  });

  app.delete("/api/campus-locations/:id", requireAuth, async (req, res) => {
    const user = await findUserById(req.session.userId!);
    if (!user || (user.role !== "admin" && user.role !== "safety_official")) {
      return res.status(403).json({ message: "Only admins and safety officials can manage locations" });
    }
    const deleted = await deleteCampusLocation(parseInt(req.params.id as string));
    if (!deleted) return res.status(404).json({ message: "Location not found" });
    return res.json({ success: true });
  });

  app.get("/api/map/live-data", requireAuth, async (_req, res) => {
    const [alerts, patrols] = await Promise.all([
      pool.query("SELECT id, student_name, location, lat, lng, type, status, created_at FROM sos_alerts WHERE status != 'resolved' AND lat IS NOT NULL AND lng IS NOT NULL"),
      pool.query(`SELECT ps.id, ps.status, ps.started_at, u.name as student_name,
        (SELECT pc.residence_name FROM patrol_checkins pc WHERE pc.session_id = ps.id AND pc.departure_at IS NULL ORDER BY pc.arrival_at DESC LIMIT 1) as current_residence
        FROM patrol_sessions ps JOIN users u ON ps.assigned_student_id = u.id WHERE ps.status = 'active'`),
    ]);
    return res.json({
      active_alerts: alerts.rows,
      active_patrols: patrols.rows,
    });
  });

  app.get("/api/dashboard/stats", requireAuth, async (_req, res) => {
    const [alerts, escorts, activePatrols] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM sos_alerts WHERE status != 'resolved'"),
      pool.query("SELECT COUNT(*) as count FROM escort_requests WHERE status = 'pending'"),
      getActivePatrolCount(),
    ]);

    const config = await getStarrezConfig();
    const starrezConnected = !!(config && config.base_url);

    return res.json({
      active_alerts: parseInt(alerts.rows[0].count),
      pending_escorts: parseInt(escorts.rows[0].count),
      starrez_connected: starrezConnected,
      active_patrols: activePatrols,
    });
  });

  if (isProduction) {
    const distPath = path.resolve(__dirname, "..", "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(5000, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:5000 (${isProduction ? "production" : "development"})`);
  });
}

start().catch(console.error);
