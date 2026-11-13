"""SOS routes over the dashboard's existing schema; no new identity system."""
from typing import Annotated, Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Status = Literal['new', 'assigned', 'en_route', 'on_scene', 'resolved']
STAFF = {'admin', 'safety_official'}
TRANSITIONS = {
    'new': {'assigned', 'resolved'}, 'assigned': {'en_route', 'resolved'},
    'en_route': {'on_scene', 'resolved'}, 'on_scene': {'resolved'}, 'resolved': set(),
}


class SOSCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    student_name: Text
    student_phone: Annotated[str, Field(max_length=50)] = ''
    student_email: Annotated[str, Field(max_length=255)] = ''
    location: Text
    lat: Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)] | None = None
    lng: Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)] | None = None
    type: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    notes: Annotated[str, Field(max_length=4000)] | None = None

    @model_validator(mode='after')
    def coordinates_are_paired(self):
        if (self.lat is None) != (self.lng is None):
            raise ValueError('Supply both coordinates or neither')
        return self


class SOSUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Status
    assigned_officer: Text | None = None


def register_sos_routes(app, connect, actor):
    def identity(conn, user):
        try:
            user_id = int(user.sub)
        except ValueError:
            raise HTTPException(401, 'Not authenticated') from None
        row = conn.execute('SELECT id,name,email,role FROM users WHERE id=%s', (user_id,)).fetchone()
        if not row or row['role'] != user.role:
            raise HTTPException(401, 'Not authenticated')
        return row

    def notify(conn, title, message, alert_id, kind='info'):
        # Global notification feed must not disclose student names/contact/location.
        conn.execute('INSERT INTO notifications (title,message,type,reference_type,reference_id) '
                     'VALUES (%s,%s,%s,%s,%s)', (title, message, kind, 'sos_alert', alert_id))

    @app.get('/api/sos-alerts')
    def alerts(user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            if who['role'] in STAFF:
                return conn.execute('SELECT * FROM sos_alerts ORDER BY created_at DESC,id DESC').fetchall()
            return conn.execute('SELECT * FROM sos_alerts WHERE created_by=%s ORDER BY created_at DESC,id DESC',
                                (who['id'],)).fetchall()

    @app.post('/api/sos-alerts', status_code=201)
    def create_alert(data: SOSCreate, user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            name = data.student_name if who['role'] in STAFF else who['name']
            email = data.student_email if who['role'] in STAFF else who['email']
            alert = conn.execute(
                'INSERT INTO sos_alerts (student_name,student_phone,student_email,location,lat,lng,type,notes,created_by) '
                'VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *',
                (name, data.student_phone, email, data.location, data.lat, data.lng, data.type, data.notes, who['id']),
            ).fetchone()
            notify(conn, 'New SOS Alert', 'An SOS alert requires staff attention.', alert['id'], 'emergency')
        return alert

    @app.patch('/api/sos-alerts/{alert_id}/status')
    def update_alert(alert_id: Annotated[int, Field(gt=0)], data: SOSUpdate, user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            if who['role'] not in STAFF:
                raise HTTPException(403, 'Only admins and safety officials can update SOS alerts')
            # Serialize competing updates so a stale request cannot reopen a resolved alert.
            current = conn.execute('SELECT * FROM sos_alerts WHERE id=%s FOR UPDATE', (alert_id,)).fetchone()
            if not current:
                raise HTTPException(404, 'Alert not found')
            if data.status == current['status']:
                if data.assigned_officer and data.assigned_officer != current['assigned_officer']:
                    raise HTTPException(409, 'Change the status to assign an officer')
                return current  # Retry-safe: no duplicate status-change notification.
            if data.status not in TRANSITIONS[current['status']]:
                raise HTTPException(409, 'Invalid SOS status transition')
            officer = data.assigned_officer or current['assigned_officer']
            if data.status == 'assigned' and not officer:
                raise HTTPException(422, 'An assigned officer is required')
            updated = conn.execute('UPDATE sos_alerts SET status=%s,assigned_officer=%s WHERE id=%s RETURNING *',
                                   (data.status, officer, alert_id)).fetchone()
            notify(conn, f'SOS Alert {data.status.replace("_", " ")}',
                   f'An SOS alert status changed to {data.status.replace("_", " ")}.', alert_id)
        return updated
