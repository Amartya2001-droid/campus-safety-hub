export interface SOSAlert {
  id: string;
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  photo: string;
  location: string;
  coordinates: { lat: number; lng: number };
  timestamp: Date;
  status: "new" | "assigned" | "en_route" | "on_scene" | "resolved";
  assignedOfficer?: string;
  type?: string;
  notes?: string;
}

export interface EscortRequest {
  id: string;
  studentName: string;
  studentPhone: string;
  pickup: string;
  destination: string;
  notes?: string;
  timestamp: Date;
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
  assignedOfficer?: string;
  eta?: string;
}

export interface IncidentReport {
  id: string;
  type: "suspicious_activity" | "theft" | "harassment" | "hazard" | "other";
  location: string;
  description: string;
  reporterName: string | null;
  anonymous: boolean;
  timestamp: Date;
  status: "new" | "under_review" | "closed";
  priority: "low" | "medium" | "high";
  hasAttachments: boolean;
}

export interface BroadcastAlert {
  id: string;
  type: "emergency" | "weather" | "advisory" | "general";
  title: string;
  message: string;
  sentBy: string;
  timestamp: Date;
  priority: "normal" | "critical";
  target: string;
}

export const mockSOSAlerts: SOSAlert[] = [
  {
    id: "SOS-001",
    studentName: "Sarah Mitchell",
    studentPhone: "(902) 555-0142",
    studentEmail: "s.mitchell@acadiau.ca",
    photo: "",
    location: "Behind Wheelock Hall",
    coordinates: { lat: 45.0875, lng: -64.3668 },
    timestamp: new Date(Date.now() - 3 * 60000),
    status: "new",
    type: "Unsafe person",
  },
  {
    id: "SOS-002",
    studentName: "James Cooper",
    studentPhone: "(902) 555-0198",
    studentEmail: "j.cooper@acadiau.ca",
    photo: "",
    location: "Parking Lot C",
    coordinates: { lat: 45.0882, lng: -64.3655 },
    timestamp: new Date(Date.now() - 12 * 60000),
    status: "assigned",
    assignedOfficer: "Officer Davis",
    type: "Medical",
  },
  {
    id: "SOS-003",
    studentName: "Emily Zhang",
    studentPhone: "(902) 555-0167",
    studentEmail: "e.zhang@acadiau.ca",
    photo: "",
    location: "University Ave near Library",
    coordinates: { lat: 45.0869, lng: -64.3671 },
    timestamp: new Date(Date.now() - 45 * 60000),
    status: "en_route",
    assignedOfficer: "Officer Thompson",
    type: "Threat",
  },
  {
    id: "SOS-004",
    studentName: "Marcus Bell",
    studentPhone: "(902) 555-0123",
    studentEmail: "m.bell@acadiau.ca",
    photo: "",
    location: "Chipman Hall, Room 204",
    coordinates: { lat: 45.0878, lng: -64.3662 },
    timestamp: new Date(Date.now() - 120 * 60000),
    status: "resolved",
    assignedOfficer: "Officer Williams",
    type: "Medical",
    notes: "Student had an allergic reaction. Paramedics called.",
  },
];

export const mockEscortRequests: EscortRequest[] = [
  {
    id: "ESC-001",
    studentName: "Olivia Park",
    studentPhone: "(902) 555-0155",
    pickup: "Vaughan Library",
    destination: "Christofor Hall",
    notes: "Wearing a blue jacket",
    timestamp: new Date(Date.now() - 5 * 60000),
    status: "pending",
  },
  {
    id: "ESC-002",
    studentName: "Daniel Kim",
    studentPhone: "(902) 555-0177",
    pickup: "K.C. Irving Centre",
    destination: "Crowell Tower",
    timestamp: new Date(Date.now() - 15 * 60000),
    status: "assigned",
    assignedOfficer: "Officer Martinez",
    eta: "5 min",
  },
  {
    id: "ESC-003",
    studentName: "Aisha Patel",
    studentPhone: "(902) 555-0188",
    pickup: "BAC Building",
    destination: "Seminary House",
    notes: "Has mobility issues, please be patient",
    timestamp: new Date(Date.now() - 25 * 60000),
    status: "in_progress",
    assignedOfficer: "Officer Chen",
  },
];

export const mockIncidentReports: IncidentReport[] = [
  {
    id: "RPT-001",
    type: "suspicious_activity",
    location: "Behind Wheelock Hall",
    description: "Unknown individual loitering near the back entrance for over an hour. Not a student.",
    reporterName: null,
    anonymous: true,
    timestamp: new Date(Date.now() - 30 * 60000),
    status: "new",
    priority: "high",
    hasAttachments: true,
  },
  {
    id: "RPT-002",
    type: "theft",
    location: "Vaughan Library, 2nd Floor",
    description: "Laptop stolen from study desk while student was away briefly.",
    reporterName: "Tyler Brooks",
    anonymous: false,
    timestamp: new Date(Date.now() - 2 * 3600000),
    status: "under_review",
    priority: "medium",
    hasAttachments: false,
  },
  {
    id: "RPT-003",
    type: "hazard",
    location: "Main Walkway near SUB",
    description: "Large ice patch on the walkway. Several students have slipped.",
    reporterName: "Prof. Anderson",
    anonymous: false,
    timestamp: new Date(Date.now() - 4 * 3600000),
    status: "under_review",
    priority: "medium",
    hasAttachments: true,
  },
  {
    id: "RPT-004",
    type: "harassment",
    location: "Student Union Building",
    description: "Verbal harassment incident in the cafeteria area.",
    reporterName: null,
    anonymous: true,
    timestamp: new Date(Date.now() - 6 * 3600000),
    status: "closed",
    priority: "high",
    hasAttachments: false,
  },
];

export const mockBroadcastAlerts: BroadcastAlert[] = [
  {
    id: "BCA-001",
    type: "weather",
    title: "Winter Storm Warning",
    message: "Environment Canada has issued a winter storm warning. Classes after 3pm are cancelled. Campus buildings remain open as warming centres.",
    sentBy: "Eden Jordan",
    timestamp: new Date(Date.now() - 2 * 3600000),
    priority: "critical",
    target: "All Users",
  },
  {
    id: "BCA-002",
    type: "advisory",
    title: "Suspicious Person Reported",
    message: "A suspicious individual has been reported near the BAC building. Please be aware of your surroundings and report any concerns to Security.",
    sentBy: "Eden Jordan",
    timestamp: new Date(Date.now() - 5 * 3600000),
    priority: "normal",
    target: "All Users",
  },
  {
    id: "BCA-003",
    type: "general",
    title: "Fire Drill - Patterson Hall",
    message: "A scheduled fire drill will take place at Patterson Hall tomorrow at 2:00 PM. Please evacuate promptly when the alarm sounds.",
    sentBy: "Officer Davis",
    timestamp: new Date(Date.now() - 24 * 3600000),
    priority: "normal",
    target: "Patterson Hall",
  },
];

export const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
};
