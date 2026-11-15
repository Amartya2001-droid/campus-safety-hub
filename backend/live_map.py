"""Authorized, read-only map overlays from existing dashboard records."""
from fastapi import Depends

from backend.identity import STAFF, identity


LIVE_MAP = '''
SELECT
  COALESCE((SELECT jsonb_agg(alert ORDER BY alert.created_at DESC, alert.id DESC)
    FROM (SELECT a.id,a.student_name,a.location,a.lat,a.lng,a.type,a.status,a.created_at
      FROM sos_alerts a
      WHERE a.status <> 'resolved' AND a.lat BETWEEN -90 AND 90 AND a.lng BETWEEN -180 AND 180
        AND (%(staff)s OR a.created_by = %(user_id)s)) alert), '[]'::jsonb) AS active_alerts,
  COALESCE((SELECT jsonb_agg(patrol ORDER BY patrol.started_at DESC, patrol.id DESC)
    FROM (SELECT ps.id,ps.status,ps.started_at,u.name AS student_name,
      (SELECT pc.residence_name FROM patrol_checkins pc
        WHERE pc.session_id = ps.id AND pc.departure_at IS NULL
          AND pc.arrival_at >= ps.started_at AND pc.arrival_at <= CURRENT_TIMESTAMP
        ORDER BY pc.arrival_at DESC,pc.id DESC LIMIT 1) AS current_residence
      FROM patrol_sessions ps JOIN users u ON u.id = ps.assigned_student_id
      WHERE ps.status = 'active' AND ps.ended_at IS NULL AND ps.started_at <= CURRENT_TIMESTAMP
        AND ps.max_duration_minutes > 0
        AND ps.started_at + ps.max_duration_minutes * INTERVAL '1 minute' > CURRENT_TIMESTAMP
        AND (%(staff)s OR ps.assigned_student_id = %(user_id)s)) patrol), '[]'::jsonb) AS active_patrols
'''


def register_live_map_routes(app, connect, actor):
    @app.get('/api/map/live-data')
    def live_data(user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            # Both overlays come from one PostgreSQL statement/snapshot, without workflow writes.
            return conn.execute(LIVE_MAP, {'staff': who['role'] in STAFF, 'user_id': who['id']}).fetchone()
