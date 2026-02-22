import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest, formatTimeAgo } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Phone, Shield, Heart, Building2, Car, AlertTriangle,
  ShieldCheck, Layers, Plus, Trash2, Eye, EyeOff, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";

const ACADIA_CENTER: [number, number] = [45.0870, -64.3660];
const DEFAULT_ZOOM = 16;

function createSvgIcon(color: string, svgPath: string) {
  return L.divIcon({
    className: "custom-map-marker",
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

const SVG_PATHS = {
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  parking: '<rect x="2" y="2" width="20" height="20" rx="4"/><text x="12" y="17" text-anchor="middle" fill="white" stroke="none" font-size="14" font-weight="bold">P</text>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};

const ICONS: Record<string, L.DivIcon> = {
  blue_phone: createSvgIcon("#3b82f6", SVG_PATHS.phone),
  safe_zone: createSvgIcon("#22c55e", SVG_PATHS.shield),
  aed: createSvgIcon("#f59e0b", SVG_PATHS.heart),
  building: createSvgIcon("#6366f1", SVG_PATHS.building),
  parking: createSvgIcon("#8b5cf6", SVG_PATHS.parking),
  alert: createSvgIcon("#ef4444", SVG_PATHS.alert),
};

const TYPE_LABELS: Record<string, string> = {
  blue_phone: "Emergency Blue Phones",
  safe_zone: "Safe Zones",
  aed: "AED Locations",
  building: "Buildings",
  parking: "Parking",
};

const TYPE_ICONS: Record<string, any> = {
  blue_phone: Phone,
  safe_zone: Shield,
  aed: Heart,
  building: Building2,
  parking: Car,
};

const TYPE_COLORS: Record<string, string> = {
  blue_phone: "text-blue-500",
  safe_zone: "text-green-500",
  aed: "text-amber-500",
  building: "text-indigo-500",
  parking: "text-violet-500",
};

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface CampusLocation {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  description: string | null;
}

interface LiveAlert {
  id: number;
  student_name: string;
  location: string;
  lat: number;
  lng: number;
  type: string | null;
  status: string;
  created_at: string;
}

interface LivePatrol {
  id: number;
  student_name: string;
  status: string;
  started_at: string;
  current_residence: string | null;
}

const CampusMap = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.role === "safety_official";

  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    blue_phone: true,
    safe_zone: true,
    aed: true,
    building: true,
    parking: false,
    alerts: true,
    patrols: true,
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "", type: "blue_phone", lat: "", lng: "", description: "",
  });

  const { data: locationsRaw } = useQuery({
    queryKey: ["/api/campus-locations"],
    queryFn: () => apiFetch("/api/campus-locations"),
    retry: false,
  });
  const locations: CampusLocation[] = Array.isArray(locationsRaw) ? locationsRaw : [];

  const { data: liveDataRaw } = useQuery({
    queryKey: ["/api/map/live-data"],
    queryFn: () => apiFetch("/api/map/live-data"),
    refetchInterval: 10000,
    retry: false,
  });
  const liveData = liveDataRaw && typeof liveDataRaw === "object" && !Array.isArray(liveDataRaw) ? liveDataRaw as { active_alerts: LiveAlert[]; active_patrols: LivePatrol[] } : null;

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/campus-locations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campus-locations"] });
      setShowAddForm(false);
      setNewLocation({ name: "", type: "blue_phone", lat: "", lng: "", description: "" });
      toast({ title: "Location added to campus map" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/campus-locations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campus-locations"] });
      toast({ title: "Location removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleLayer = (key: string) => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddLocation = () => {
    const lat = parseFloat(newLocation.lat);
    const lng = parseFloat(newLocation.lng);
    if (!newLocation.name.trim() || isNaN(lat) || isNaN(lng)) {
      toast({ title: "Please fill in name, latitude, and longitude", variant: "destructive" });
      return;
    }
    addMutation.mutate({ name: newLocation.name.trim(), type: newLocation.type, lat, lng, description: newLocation.description.trim() || null });
  };

  const filteredLocations = useMemo(
    () => locations.filter((loc) => visibleLayers[loc.type]),
    [locations, visibleLayers]
  );

  const activeAlerts = liveData?.active_alerts || [];
  const activePatrols = liveData?.active_patrols || [];

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const loc of locations) {
      counts[loc.type] = (counts[loc.type] || 0) + 1;
    }
    return counts;
  }, [locations]);

  return (
    <DashboardLayout title="Campus Map" subtitle="Live campus safety map — Acadia University">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-72 space-y-4 shrink-0">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Map Layers</h3>
            </div>
            <div className="space-y-1">
              {Object.entries(TYPE_LABELS).map(([key, label]) => {
                const Icon = TYPE_ICONS[key];
                return (
                  <button
                    key={key}
                    onClick={() => toggleLayer(key)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                      visibleLayers[key] ? "bg-accent/60 font-medium" : "text-muted-foreground hover:bg-accent/30"
                    }`}
                    data-testid={`toggle-layer-${key}`}
                  >
                    {visibleLayers[key] ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    <Icon className={`h-3.5 w-3.5 ${TYPE_COLORS[key]}`} />
                    <span className="flex-1 text-left">{label}</span>
                    <span className="text-xs text-muted-foreground">{stats[key] || 0}</span>
                  </button>
                );
              })}
              <div className="border-t border-border my-2" />
              <button
                onClick={() => toggleLayer("alerts")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  visibleLayers.alerts ? "bg-accent/60 font-medium" : "text-muted-foreground hover:bg-accent/30"
                }`}
                data-testid="toggle-layer-alerts"
              >
                {visibleLayers.alerts ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                <span className="flex-1 text-left">Active Alerts</span>
                <span className="text-xs text-red-500 font-bold">{activeAlerts.length}</span>
              </button>
              <button
                onClick={() => toggleLayer("patrols")}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  visibleLayers.patrols ? "bg-accent/60 font-medium" : "text-muted-foreground hover:bg-accent/30"
                }`}
                data-testid="toggle-layer-patrols"
              >
                {visibleLayers.patrols ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="flex-1 text-left">Active Patrols</span>
                <span className="text-xs text-emerald-500 font-bold">{activePatrols.length}</span>
              </button>
            </div>
          </div>

          {visibleLayers.alerts && activeAlerts.length > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold">Active Alerts</h3>
              </div>
              <div className="space-y-2">
                {activeAlerts.map((a) => (
                  <div key={a.id} className="text-xs p-2 bg-red-500/10 rounded-md border border-red-500/20" data-testid={`map-alert-${a.id}`}>
                    <div className="font-medium">{a.student_name}</div>
                    <div className="text-muted-foreground">{a.location}</div>
                    <div className="flex items-center justify-between mt-1">
                      <StatusBadge status={a.status as any} />
                      <span className="text-muted-foreground">{formatTimeAgo(a.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleLayers.patrols && activePatrols.length > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold">Active Patrols</h3>
              </div>
              <div className="space-y-2">
                {activePatrols.map((p) => (
                  <div key={p.id} className="text-xs p-2 bg-emerald-500/10 rounded-md border border-emerald-500/20" data-testid={`map-patrol-${p.id}`}>
                    <div className="font-medium">{p.student_name}</div>
                    {p.current_residence && (
                      <div className="text-muted-foreground">At: {p.current_residence}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Manage Locations</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(!showAddForm)}
                  data-testid="button-toggle-add-location"
                >
                  {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              {showAddForm && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={newLocation.name}
                      onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                      placeholder="e.g. Blue Phone - Library"
                      className="h-8 text-sm"
                      data-testid="input-location-name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={newLocation.type} onValueChange={(v) => setNewLocation({ ...newLocation, type: v })}>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-location-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blue_phone">Emergency Blue Phone</SelectItem>
                        <SelectItem value="safe_zone">Safe Zone</SelectItem>
                        <SelectItem value="aed">AED Location</SelectItem>
                        <SelectItem value="building">Building</SelectItem>
                        <SelectItem value="parking">Parking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Latitude</Label>
                      <Input
                        value={newLocation.lat}
                        onChange={(e) => setNewLocation({ ...newLocation, lat: e.target.value })}
                        placeholder="45.0875"
                        className="h-8 text-sm"
                        data-testid="input-location-lat"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Longitude</Label>
                      <Input
                        value={newLocation.lng}
                        onChange={(e) => setNewLocation({ ...newLocation, lng: e.target.value })}
                        placeholder="-64.3652"
                        className="h-8 text-sm"
                        data-testid="input-location-lng"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={newLocation.description}
                      onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                      placeholder="Optional description"
                      className="text-sm min-h-[60px]"
                      data-testid="input-location-description"
                    />
                  </div>
                  <Button
                    onClick={handleAddLocation}
                    disabled={addMutation.isPending}
                    className="w-full h-8 text-sm"
                    data-testid="button-add-location"
                  >
                    {addMutation.isPending ? "Adding..." : "Add Location"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 glass-card overflow-hidden" style={{ minHeight: "600px" }}>
          <MapContainer
            center={ACADIA_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%", minHeight: "600px", borderRadius: "0.5rem" }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {filteredLocations.map((loc) => (
              <Marker key={`loc-${loc.id}`} position={[loc.lat, loc.lng]} icon={ICONS[loc.type]}>
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <div className="font-semibold mb-1">{loc.name}</div>
                    <div className="text-xs text-gray-500 capitalize mb-1">{loc.type.replace("_", " ")}</div>
                    {loc.description && <div className="text-xs text-gray-600">{loc.description}</div>}
                    {isAdmin && (
                      <button
                        onClick={() => deleteMutation.mutate(loc.id)}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        data-testid={`button-delete-location-${loc.id}`}
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {visibleLayers.alerts && activeAlerts.map((alert) => (
              <Marker key={`alert-${alert.id}`} position={[alert.lat, alert.lng]} icon={ICONS.alert}>
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <div className="font-semibold text-red-600 mb-1">SOS Alert</div>
                    <div className="text-xs"><strong>Student:</strong> {alert.student_name}</div>
                    <div className="text-xs"><strong>Location:</strong> {alert.location}</div>
                    {alert.type && <div className="text-xs"><strong>Type:</strong> {alert.type}</div>}
                    <div className="text-xs capitalize"><strong>Status:</strong> {alert.status}</div>
                    <div className="text-xs text-gray-500 mt-1">{formatTimeAgo(alert.created_at)}</div>
                  </div>
                </Popup>
              </Marker>
            ))}

          </MapContainer>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CampusMap;
