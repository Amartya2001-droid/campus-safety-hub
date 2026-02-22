# Acadia Safe - Security Portal

## Overview
A campus security operations dashboard built with React, TypeScript, Vite, and Express. Migrated from Lovable to Replit. Features role-based authentication with PostgreSQL backend and StarRez integration for incident reports.

## Recent Changes
- 2026-02-20: Interactive Campus Map
  - Leaflet-based interactive map centered on Acadia University
  - campus_locations table with seeded Acadia buildings, blue phones, AEDs, safe zones, parking
  - Layer toggles for each location type + live alerts + active patrols
  - Admin/safety officials can add/remove map locations
  - Live data overlay: active SOS alerts and active patrols on map
  - Side panel shows active alerts/patrols summaries
  - API endpoints: GET/POST/PATCH/DELETE /api/campus-locations, GET /api/map/live-data
- 2026-02-20: Campus Patrol Tracking Feature
  - New patrol_sessions and patrol_checkins database tables
  - Admins/safety officials can assign patrol shifts to students
  - Students accept/decline patrol assignments with notification
  - Active patrol timer with 5-hour shift limit and auto-expiry
  - Residence check-in/check-out tracking with time-per-residence reports
  - Dashboard stat card shows active patrol count (replaced "Resolved Today")
  - New Campus Patrol page (src/pages/Patrols.tsx) with role-based UI
  - Sidebar link added for Campus Patrol
- 2026-02-20: StarRez Integration for Incident Reports
  - Removed built-in incident reports system (Acadia uses StarRez for report management)
  - Added StarRez REST API proxy (server/index.ts) - /api/starrez/* endpoints
  - StarRez config stored in starrez_config table (base URL)
  - User's portal credentials (stored in session) used to authenticate with StarRez API
  - Reports page shows data pulled directly from StarRez IncidentReport table
  - Settings page has StarRez URL configuration + connection test
  - Dashboard shows StarRez connection status instead of report count
- 2026-02-20: Added backend authentication system
  - Express server with session-based auth (server/index.ts, server/db.ts)
  - PostgreSQL database with users table (roles: admin, safety_official, student, faculty)
  - Login page with email/password/role selection
  - Sidebar shows logged-in user with logout button
  - Default user: amartyakarmakar@gmail.com / password (seeded for all 4 roles)
- 2026-02-20: Migrated from Lovable to Replit environment
  - Updated Vite config to serve on port 5000 with allowedHosts enabled
  - Removed lovable-tagger plugin dependency from Vite config

## Project Architecture
- **Frontend**: React 18 + TypeScript + Vite (src/)
- **Backend**: Express + PostgreSQL (server/)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Auth**: Session-based (express-session + bcryptjs)
- **StarRez**: REST API proxy via backend (user credentials from session)
- **Routing**: React Router v6
- **State**: TanStack React Query (10s polling, retry: false)
- **Charts**: Recharts

### Directory Structure
- `src/` - Frontend application source
  - `components/` - Reusable UI components
  - `pages/` - Page-level components (Index, Login, SOSAlerts, Escorts, Reports, Patrols, Broadcast, CampusMap, Settings)
  - `contexts/` - React context providers (AuthContext)
  - `hooks/` - Custom React hooks
  - `lib/` - Utility functions and API helpers
- `server/` - Backend server
  - `index.ts` - Express server with Vite middleware, API routes, and StarRez proxy
  - `db.ts` - PostgreSQL connection, schema, and query helpers
- `public/` - Static assets

### Database Tables
- `users` - User accounts with bcrypt hashed passwords
- `sos_alerts` - Emergency SOS alerts with status tracking
- `escort_requests` - Safe escort request queue
- `starrez_config` - StarRez instance URL configuration
- `broadcast_alerts` - Campus-wide broadcast notifications
- `notifications` - System notifications for the bell icon
- `patrol_sessions` - Campus patrol shift assignments and tracking
- `patrol_checkins` - Residence check-in/out logs per patrol session
- `campus_locations` - Map points of interest (blue phones, safe zones, AEDs, buildings, parking)

### StarRez Integration
- Base URL stored in `starrez_config` table
- User's password stored in session during login for API auth
- Backend proxies requests to StarRez REST API (Basic Auth)
- Endpoints: GET /api/starrez/config, POST /api/starrez/config, GET /api/starrez/incidents, GET /api/starrez/test

## User Preferences
- Default login: amartyakarmakar@gmail.com / password
- Roles: admin, safety_official, student, faculty
- Reports managed via StarRez (not built-in)

## Development
- Run: `npx tsx server/index.ts` (starts Express server with Vite middleware on port 5000)
- Build: `npm run build` (outputs to `dist/`)
- Deployment: Autoscale with `npx tsx server/index.ts`
