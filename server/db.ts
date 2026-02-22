import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface DbUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "safety_official" | "student" | "faculty";
  password_hash: string;
}

export type SafeUser = Omit<DbUser, "password_hash">;

export interface SOSAlert {
  id: number;
  student_name: string;
  student_phone: string;
  student_email: string;
  location: string;
  lat: number | null;
  lng: number | null;
  type: string | null;
  status: string;
  assigned_officer: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
}

export interface EscortRequest {
  id: number;
  student_name: string;
  student_phone: string;
  pickup: string;
  destination: string;
  notes: string | null;
  status: string;
  assigned_officer: string | null;
  eta: string | null;
  created_by: number | null;
  created_at: string;
}

export interface StarrezConfig {
  id: number;
  base_url: string;
  updated_at: string;
}

export interface BroadcastAlert {
  id: number;
  type: string;
  title: string;
  message: string;
  sent_by: string;
  priority: string;
  target: string;
  created_by: number | null;
  created_at: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  reference_type: string | null;
  reference_id: number | null;
  created_at: string;
}

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'safety_official', 'student', 'faculty')),
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sos_alerts (
      id SERIAL PRIMARY KEY,
      student_name VARCHAR(255) NOT NULL,
      student_phone VARCHAR(50) NOT NULL DEFAULT '',
      student_email VARCHAR(255) NOT NULL DEFAULT '',
      location VARCHAR(255) NOT NULL,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      type VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'en_route', 'on_scene', 'resolved')),
      assigned_officer VARCHAR(255),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS escort_requests (
      id SERIAL PRIMARY KEY,
      student_name VARCHAR(255) NOT NULL,
      student_phone VARCHAR(50) NOT NULL DEFAULT '',
      pickup VARCHAR(255) NOT NULL,
      destination VARCHAR(255) NOT NULL,
      notes TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
      assigned_officer VARCHAR(255),
      eta VARCHAR(50),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS starrez_config (
      id SERIAL PRIMARY KEY,
      base_url VARCHAR(500) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS broadcast_alerts (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL CHECK (type IN ('emergency', 'weather', 'advisory', 'general')),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      sent_by VARCHAR(255) NOT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'critical')),
      target VARCHAR(255) NOT NULL DEFAULT 'All Users',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'info',
      read BOOLEAN NOT NULL DEFAULT false,
      reference_type VARCHAR(50),
      reference_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS patrol_sessions (
      id SERIAL PRIMARY KEY,
      created_by INTEGER REFERENCES users(id),
      assigned_student_id INTEGER NOT NULL REFERENCES users(id),
      status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'completed', 'expired')),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      accepted_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      max_duration_minutes INTEGER NOT NULL DEFAULT 300,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS patrol_checkins (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES patrol_sessions(id) ON DELETE CASCADE,
      residence_name VARCHAR(255) NOT NULL,
      arrival_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      departure_at TIMESTAMPTZ,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS campus_locations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('blue_phone', 'safe_zone', 'aed', 'building', 'parking')),
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query("SELECT COUNT(*) as count FROM users");
  if (parseInt(rows[0].count) === 0) {
    const hash = await bcrypt.hash("password", 10);
    await pool.query(
      `INSERT INTO users (name, email, role, password_hash) VALUES
        ($1, $2, 'admin', $3),
        ($4, $5, 'safety_official', $6),
        ($7, $8, 'student', $9),
        ($10, $11, 'faculty', $12)`,
      [
        "Amartya Karmakar", "amartyakarmakar@gmail.com", hash,
        "Safety Officer", "amartyakarmakar@gmail.com", hash,
        "Student User", "amartyakarmakar@gmail.com", hash,
        "Faculty Member", "amartyakarmakar@gmail.com", hash,
      ]
    );
    console.log("Seeded 4 default users");
  }

  const locCount = await pool.query("SELECT COUNT(*) as count FROM campus_locations");
  if (parseInt(locCount.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO campus_locations (name, type, lat, lng, description) VALUES
        -- University Avenue buildings
        ('Elliott Hall', 'building', 45.08745, -64.36930, '6 University Avenue'),
        ('Huggins Science Hall / Huestis Innovation Pavilion', 'building', 45.08735, -64.36870, '12 University Avenue - Science labs and innovation space'),
        ('University Hall', 'building', 45.08725, -64.36810, '15 University Avenue - Main academic building'),
        ('Horton Hall', 'building', 45.08710, -64.36750, '18 University Avenue'),
        ('Rhodes Hall', 'building', 45.08695, -64.36690, '21 University Avenue'),
        ('Patterson Hall', 'building', 45.08680, -64.36630, '24 University Avenue'),
        ('Carnegie Hall', 'building', 45.08665, -64.36570, '27 University Avenue'),
        ('Emmerson Hall', 'building', 45.08650, -64.36510, '31 University Avenue'),
        ('K.C. Irving Centre', 'building', 45.08670, -64.36450, '32 University Avenue'),
        ('Clark Commons', 'building', 45.08690, -64.36390, '37 University Avenue'),
        ('Roy Jodrey Hall', 'building', 45.08720, -64.36340, '39 University Avenue - Residence'),
        ('Christofor Hall', 'building', 45.08750, -64.36300, '41 University Avenue - Residence'),
        ('Eaton House', 'building', 45.08780, -64.36260, '43 University Avenue - Residence'),
        ('Irving Support Centre', 'building', 45.08770, -64.36200, '50 University Avenue'),
        ('DeWolfe House / Welkaquit Centre', 'building', 45.08800, -64.36160, '52 University Avenue'),
        ('Cutten House', 'building', 45.08830, -64.36120, '55 University Avenue'),

        -- Acadia Street buildings
        ('Wong International Centre', 'building', 45.08820, -64.36680, '27 Acadia Street'),
        ('Vaughan Memorial Library', 'building', 45.08780, -64.36720, '50 Acadia Street - Main campus library'),
        ('Hayward House', 'building', 45.08800, -64.36750, '31/33 Acadia Street'),
        ('Manning Memorial Chapel', 'building', 45.08740, -64.36780, '45 Acadia Street'),

        -- Highland Avenue buildings
        ('Beveridge Arts Centre', 'building', 45.08900, -64.36500, '10 Highland Avenue - Arts and performance venue'),
        ('Department of Community Development', 'building', 45.08870, -64.36520, '24 Highland Avenue'),
        ('Students'' Centre (SUB)', 'building', 45.08840, -64.36550, '30 Highland Avenue - Old and New SUB'),
        ('Acadia Divinity College', 'building', 45.08800, -64.36580, '38 Highland Avenue'),
        ('Wheelock Dining Hall / Campus Bookstore', 'building', 45.08760, -64.36610, '44 Highland Avenue - Dining and bookstore'),
        ('SOK Outdoor Activity Centre', 'building', 45.08720, -64.36640, '48 Highland Avenue'),
        ('Crowell Tower', 'building', 45.08680, -64.36670, '60 Highland Avenue - Residence'),

        -- Crowell Drive buildings
        ('Whitman House', 'building', 45.08830, -64.36830, '18 Crowell Drive - Residence / Access Control'),
        ('Seminary House', 'building', 45.08790, -64.36870, '22 Crowell Drive - Residence'),
        ('Raymond House', 'building', 45.08770, -64.36820, '23 Crowell Drive'),
        ('Fountain Commons', 'building', 45.08730, -64.36810, '26 Crowell Drive'),
        ('Chipman House', 'building', 45.08700, -64.36850, '35 Crowell Drive - Residence'),
        ('Willett House', 'building', 45.08660, -64.36870, '38 Crowell Drive'),

        -- Horton Avenue buildings
        ('Godfrey House', 'building', 45.08880, -64.36440, '3 Horton Avenue'),
        ('Bancroft House', 'building', 45.08860, -64.36460, '7 Horton Avenue'),
        ('Harvey Denton Hall', 'building', 45.08840, -64.36480, '12 Horton Avenue'),
        ('Dennis House', 'building', 45.08810, -64.36510, '22 Horton Avenue - Residence'),
        ('Chase Court', 'building', 45.08790, -64.36530, '24 Horton Avenue - Residence'),

        -- Elm Avenue buildings
        ('Central Heating Plant', 'building', 45.08700, -64.36900, '20 Elm Avenue'),
        ('DeWolfe Building', 'building', 45.08670, -64.36930, '24 Elm Avenue - Wolfville Farmers'' Market'),

        -- Main Street buildings
        ('Festival Theatre', 'building', 45.08520, -64.36700, '504 Main Street'),
        ('Alumni Hall / Wu Welcome Centre', 'building', 45.08490, -64.36600, '512 Main Street'),
        ('Acadia Athletics Complex', 'building', 45.08460, -64.36470, '550 Main Street - Athletics and recreation'),

        -- Westwood Avenue buildings
        ('Academic Building', 'building', 45.08550, -64.36350, '11 Westwood Avenue'),
        ('University Faculty Club', 'building', 45.08580, -64.36380, '17 Westwood Avenue'),
        ('War Memorial House', 'building', 45.08540, -64.36400, '23 Westwood Avenue - Residence'),
        ('Biology Building', 'building', 45.08600, -64.36420, '33 Westwood Avenue'),

        -- Park Street
        ('Residential (6 Park St)', 'building', 45.08620, -64.36350, '6 Park Street'),
        ('Residential (8 Park St)', 'building', 45.08610, -64.36360, '8 Park Street'),

        -- Additional campus buildings
        ('Residential (56)', 'building', 45.08850, -64.36200, '56 - Residential'),
        ('Residence (58)', 'building', 45.08870, -64.36180, '58 - Residence'),
        ('Robbie Roscoe Services Building', 'building', 45.08920, -64.36250, '61 - Physical Plant'),
        ('Service Building Garage', 'building', 45.08910, -64.36220, '67 - Service Building Garage'),

        -- Safety & Security
        ('Safety & Security Office', 'safe_zone', 45.08835, -64.36545, '30 Highland Avenue - Students'' Centre'),
        ('Student Health Centre', 'safe_zone', 45.08810, -64.36760, 'Campus student health services'),
        ('Access Control', 'safe_zone', 45.08828, -64.36828, '18 Crowell Drive - Whitman House'),

        -- AED Locations (from map symbols)
        ('AED - University Hall', 'aed', 45.08723, -64.36808, 'Automated External Defibrillator at University Hall'),
        ('AED - Vaughan Library', 'aed', 45.08778, -64.36718, 'AED at Vaughan Memorial Library'),
        ('AED - Students'' Centre', 'aed', 45.08838, -64.36548, 'AED at Students'' Centre (SUB)'),
        ('AED - Wheelock Dining Hall', 'aed', 45.08758, -64.36608, 'AED at Wheelock Dining Hall'),
        ('AED - Athletics Complex', 'aed', 45.08458, -64.36468, 'AED at Acadia Athletics Complex'),
        ('AED - Huggins Science Hall', 'aed', 45.08733, -64.36868, 'AED at Huggins Science Hall'),
        ('AED - K.C. Irving Centre', 'aed', 45.08668, -64.36448, 'AED at K.C. Irving Centre'),
        ('AED - Cutten House', 'aed', 45.08828, -64.36118, 'AED at Cutten House'),
        ('AED - Seminary House', 'aed', 45.08788, -64.36868, 'AED at Seminary House'),

        -- Parking areas (from map legend)
        ('Permit Parking - University Ave', 'parking', 45.08750, -64.36920, '24 Hour Permit Parking'),
        ('Permit Parking - Highland Ave', 'parking', 45.08890, -64.36540, 'Permit Parking / No Overnight'),
        ('Accessible Parking - Library', 'parking', 45.08776, -64.36730, 'Accessible Parking near Vaughan Library'),
        ('Free Parking - Main St', 'parking', 45.08510, -64.36650, 'Free Parking / No Overnight'),
        ('Meter Parking - Acadia St', 'parking', 45.08810, -64.36700, 'Metered parking on Acadia Street'),
        ('Permit Parking - Crowell Dr', 'parking', 45.08750, -64.36860, '24 Hour Permit Parking'),
        ('Residence Parking - Horton Ave', 'parking', 45.08820, -64.36500, 'Residence parking area'),

        -- Emergency Blue Phones
        ('Blue Phone - Library', 'blue_phone', 45.08785, -64.36715, 'Emergency phone near Vaughan Library entrance'),
        ('Blue Phone - Athletics', 'blue_phone', 45.08465, -64.36475, 'Emergency phone near Athletics Complex'),
        ('Blue Phone - Cutten House', 'blue_phone', 45.08835, -64.36125, 'Emergency phone near Cutten House'),
        ('Blue Phone - Seminary House', 'blue_phone', 45.08795, -64.36875, 'Emergency phone near Seminary House'),
        ('Blue Phone - Highland Ave', 'blue_phone', 45.08845, -64.36555, 'Emergency phone on Highland Avenue'),
        ('Blue Phone - University Ave', 'blue_phone', 45.08685, -64.36635, 'Emergency phone on University Avenue')
    `);
    console.log("Seeded campus locations");
  }
}

export async function findUserByEmailAndRole(email: string, role: string): Promise<DbUser | null> {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE email = $1 AND role = $2 LIMIT 1",
    [email, role]
  );
  return rows[0] || null;
}

export async function findUserById(id: number): Promise<SafeUser | null> {
  const { rows } = await pool.query(
    "SELECT id, name, email, role FROM users WHERE id = $1 LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

export async function getAllUsers(): Promise<SafeUser[]> {
  const { rows } = await pool.query("SELECT id, name, email, role FROM users");
  return rows;
}

export async function getSOSAlerts(): Promise<SOSAlert[]> {
  const { rows } = await pool.query("SELECT * FROM sos_alerts ORDER BY created_at DESC");
  return rows;
}

export async function createSOSAlert(data: Partial<SOSAlert>): Promise<SOSAlert> {
  const { rows } = await pool.query(
    `INSERT INTO sos_alerts (student_name, student_phone, student_email, location, lat, lng, type, status, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [data.student_name, data.student_phone || '', data.student_email || '', data.location, data.lat, data.lng, data.type, data.status || 'new', data.notes, data.created_by]
  );
  return rows[0];
}

export async function updateSOSAlertStatus(id: number, status: string, assignedOfficer?: string): Promise<SOSAlert | null> {
  const { rows } = await pool.query(
    `UPDATE sos_alerts SET status = $1, assigned_officer = COALESCE($2, assigned_officer) WHERE id = $3 RETURNING *`,
    [status, assignedOfficer || null, id]
  );
  return rows[0] || null;
}

export async function getEscortRequests(): Promise<EscortRequest[]> {
  const { rows } = await pool.query("SELECT * FROM escort_requests ORDER BY created_at DESC");
  return rows;
}

export async function createEscortRequest(data: Partial<EscortRequest>): Promise<EscortRequest> {
  const { rows } = await pool.query(
    `INSERT INTO escort_requests (student_name, student_phone, pickup, destination, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.student_name, data.student_phone || '', data.pickup, data.destination, data.notes, data.created_by]
  );
  return rows[0];
}

export async function updateEscortStatus(id: number, status: string, assignedOfficer?: string, eta?: string): Promise<EscortRequest | null> {
  const { rows } = await pool.query(
    `UPDATE escort_requests SET status = $1, assigned_officer = COALESCE($2, assigned_officer), eta = COALESCE($3, eta) WHERE id = $4 RETURNING *`,
    [status, assignedOfficer || null, eta || null, id]
  );
  return rows[0] || null;
}

export async function getStarrezConfig(): Promise<StarrezConfig | null> {
  const { rows } = await pool.query("SELECT * FROM starrez_config ORDER BY id LIMIT 1");
  return rows[0] || null;
}

export async function upsertStarrezConfig(baseUrl: string): Promise<StarrezConfig> {
  const existing = await getStarrezConfig();
  if (existing) {
    const { rows } = await pool.query(
      "UPDATE starrez_config SET base_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [baseUrl, existing.id]
    );
    return rows[0];
  }
  const { rows } = await pool.query(
    "INSERT INTO starrez_config (base_url) VALUES ($1) RETURNING *",
    [baseUrl]
  );
  return rows[0];
}

export async function getBroadcastAlerts(): Promise<BroadcastAlert[]> {
  const { rows } = await pool.query("SELECT * FROM broadcast_alerts ORDER BY created_at DESC");
  return rows;
}

export async function createBroadcastAlert(data: Partial<BroadcastAlert>): Promise<BroadcastAlert> {
  const { rows } = await pool.query(
    `INSERT INTO broadcast_alerts (type, title, message, sent_by, priority, target, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.type, data.title, data.message, data.sent_by, data.priority || 'normal', data.target || 'All Users', data.created_by]
  );
  return rows[0];
}

export async function getNotifications(): Promise<Notification[]> {
  const { rows } = await pool.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50");
  return rows;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { rows } = await pool.query("SELECT COUNT(*) as count FROM notifications WHERE read = false");
  return parseInt(rows[0].count);
}

export async function createNotification(data: Partial<Notification>): Promise<Notification> {
  const { rows } = await pool.query(
    `INSERT INTO notifications (title, message, type, reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.title, data.message, data.type || 'info', data.reference_type, data.reference_id]
  );
  return rows[0];
}

export async function markNotificationsRead(): Promise<void> {
  await pool.query("UPDATE notifications SET read = true WHERE read = false");
}

export async function markNotificationRead(id: number): Promise<void> {
  await pool.query("UPDATE notifications SET read = true WHERE id = $1", [id]);
}

export interface PatrolSession {
  id: number;
  created_by: number | null;
  assigned_student_id: number;
  status: string;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  max_duration_minutes: number;
  notes: string | null;
  student_name?: string;
  student_email?: string;
  creator_name?: string;
}

export interface PatrolCheckin {
  id: number;
  session_id: number;
  residence_name: string;
  arrival_at: string;
  departure_at: string | null;
  notes: string | null;
}

export async function autoExpirePatrols(): Promise<void> {
  await pool.query(
    `UPDATE patrol_sessions SET status = 'expired', ended_at = NOW()
     WHERE status = 'active' AND started_at + (max_duration_minutes || ' minutes')::INTERVAL < NOW()`
  );
}

export async function getPatrolSessions(role: string, userId: number): Promise<PatrolSession[]> {
  await autoExpirePatrols();
  if (role === "admin" || role === "safety_official") {
    const { rows } = await pool.query(
      `SELECT ps.*, u.name AS student_name, u.email AS student_email, c.name AS creator_name
       FROM patrol_sessions ps
       JOIN users u ON ps.assigned_student_id = u.id
       LEFT JOIN users c ON ps.created_by = c.id
       ORDER BY ps.requested_at DESC`
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT ps.*, u.name AS student_name, u.email AS student_email, c.name AS creator_name
     FROM patrol_sessions ps
     JOIN users u ON ps.assigned_student_id = u.id
     LEFT JOIN users c ON ps.created_by = c.id
     WHERE ps.assigned_student_id = $1
     ORDER BY ps.requested_at DESC`,
    [userId]
  );
  return rows;
}

export async function createPatrolSession(createdBy: number, studentId: number, notes?: string): Promise<PatrolSession> {
  const { rows } = await pool.query(
    `INSERT INTO patrol_sessions (created_by, assigned_student_id, notes)
     VALUES ($1, $2, $3) RETURNING *`,
    [createdBy, studentId, notes || null]
  );
  return rows[0];
}

export async function acceptPatrolSession(sessionId: number, studentId: number): Promise<PatrolSession | null> {
  const { rows } = await pool.query(
    `UPDATE patrol_sessions SET status = 'active', accepted_at = NOW(), started_at = NOW()
     WHERE id = $1 AND assigned_student_id = $2 AND status = 'pending' RETURNING *`,
    [sessionId, studentId]
  );
  return rows[0] || null;
}

export async function declinePatrolSession(sessionId: number, studentId: number): Promise<PatrolSession | null> {
  const { rows } = await pool.query(
    `UPDATE patrol_sessions SET status = 'declined'
     WHERE id = $1 AND assigned_student_id = $2 AND status = 'pending' RETURNING *`,
    [sessionId, studentId]
  );
  return rows[0] || null;
}

export async function endPatrolSession(sessionId: number): Promise<PatrolSession | null> {
  await pool.query(
    `UPDATE patrol_checkins SET departure_at = NOW()
     WHERE session_id = $1 AND departure_at IS NULL`,
    [sessionId]
  );
  const { rows } = await pool.query(
    `UPDATE patrol_sessions SET status = 'completed', ended_at = NOW()
     WHERE id = $1 AND status = 'active' RETURNING *`,
    [sessionId]
  );
  return rows[0] || null;
}

export async function getPatrolCheckins(sessionId: number): Promise<PatrolCheckin[]> {
  const { rows } = await pool.query(
    `SELECT * FROM patrol_checkins WHERE session_id = $1 ORDER BY arrival_at ASC`,
    [sessionId]
  );
  return rows;
}

export async function createPatrolCheckin(sessionId: number, residenceName: string, notes?: string): Promise<PatrolCheckin> {
  await pool.query(
    `UPDATE patrol_checkins SET departure_at = NOW()
     WHERE session_id = $1 AND departure_at IS NULL`,
    [sessionId]
  );
  const { rows } = await pool.query(
    `INSERT INTO patrol_checkins (session_id, residence_name, notes)
     VALUES ($1, $2, $3) RETURNING *`,
    [sessionId, residenceName, notes || null]
  );
  return rows[0];
}

export async function departPatrolCheckin(checkinId: number): Promise<PatrolCheckin | null> {
  const { rows } = await pool.query(
    `UPDATE patrol_checkins SET departure_at = NOW()
     WHERE id = $1 AND departure_at IS NULL RETURNING *`,
    [checkinId]
  );
  return rows[0] || null;
}

export interface CampusLocation {
  id: number;
  name: string;
  type: "blue_phone" | "safe_zone" | "aed" | "building" | "parking";
  lat: number;
  lng: number;
  description: string | null;
  created_at: string;
}

export async function getCampusLocations(): Promise<CampusLocation[]> {
  const { rows } = await pool.query("SELECT * FROM campus_locations ORDER BY type, name");
  return rows;
}

export async function createCampusLocation(data: Omit<CampusLocation, "id" | "created_at">): Promise<CampusLocation> {
  const { rows } = await pool.query(
    `INSERT INTO campus_locations (name, type, lat, lng, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.name, data.type, data.lat, data.lng, data.description || null]
  );
  return rows[0];
}

export async function updateCampusLocation(id: number, data: Partial<CampusLocation>): Promise<CampusLocation | null> {
  const { rows } = await pool.query(
    `UPDATE campus_locations SET name = COALESCE($1, name), type = COALESCE($2, type),
     lat = COALESCE($3, lat), lng = COALESCE($4, lng), description = COALESCE($5, description)
     WHERE id = $6 RETURNING *`,
    [data.name, data.type, data.lat, data.lng, data.description, id]
  );
  return rows[0] || null;
}

export async function deleteCampusLocation(id: number): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM campus_locations WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

export async function getActivePatrolCount(): Promise<number> {
  await autoExpirePatrols();
  const { rows } = await pool.query("SELECT COUNT(*) as count FROM patrol_sessions WHERE status = 'active'");
  return parseInt(rows[0].count);
}

export { pool };
