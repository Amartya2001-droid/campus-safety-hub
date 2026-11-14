"""Read-only summary over the existing Express-owned tables."""
from fastapi import Depends

from backend.identity import STAFF, identity


SUMMARY = '''
SELECT
  (SELECT count(*) FROM sos_alerts
    WHERE status <> 'resolved' AND (%(staff)s OR created_by = %(user_id)s)) AS active_alerts,
  (SELECT count(*) FROM escort_requests
    WHERE status = 'pending' AND (%(staff)s OR created_by = %(user_id)s)) AS pending_escorts,
  (SELECT count(*) FROM patrol_sessions
    WHERE status = 'active' AND ended_at IS NULL AND started_at <= CURRENT_TIMESTAMP
      AND max_duration_minutes > 0
      AND started_at + max_duration_minutes * INTERVAL '1 minute' > CURRENT_TIMESTAMP
      AND (%(staff)s OR assigned_student_id = %(user_id)s)) AS active_patrols,
  COALESCE((SELECT btrim(base_url) <> '' FROM starrez_config ORDER BY id LIMIT 1), false) AS starrez_configured
'''


def register_dashboard_routes(app, connect, actor):
    @app.get('/api/dashboard/stats')
    def stats(user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            # One SQL statement gives all counts a consistent PostgreSQL snapshot.
            # Expired patrols are excluded without mutating their workflow on a GET.
            return conn.execute(SUMMARY, {'staff': who['role'] in STAFF, 'user_id': who['id']}).fetchone()
