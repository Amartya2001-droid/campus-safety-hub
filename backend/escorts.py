"""Escort queue operations against the existing Express-owned schema."""
from typing import Annotated, Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from backend.identity import STAFF, identity

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
ETA = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Status = Literal['pending', 'assigned', 'in_progress', 'completed', 'cancelled']
TRANSITIONS = {'pending': {'assigned','cancelled'}, 'assigned': {'in_progress','cancelled'},
               'in_progress': {'completed','cancelled'}, 'completed': set(), 'cancelled': set()}


class EscortCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    student_name: Text
    student_phone: Annotated[str, Field(max_length=50)] = ''
    pickup: Text
    destination: Text
    notes: Annotated[str, Field(max_length=4000)] | None = None


class EscortUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Status
    assigned_officer: Text | None = None
    eta: ETA | None = None


def register_escort_routes(app, connect, actor):
    def notify(conn, request_id, title, message, kind='info'):
        # Notifications are global in the legacy schema: do not include request PII.
        conn.execute('INSERT INTO notifications(title,message,type,reference_type,reference_id) '
                     'VALUES (%s,%s,%s,%s,%s)', (title,message,kind,'escort_request',request_id))

    @app.get('/api/escort-requests')
    def requests(user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            if who['role'] in STAFF:
                return conn.execute('SELECT * FROM escort_requests ORDER BY created_at DESC,id DESC').fetchall()
            return conn.execute('SELECT * FROM escort_requests WHERE created_by=%s ORDER BY created_at DESC,id DESC',
                                (who['id'],)).fetchall()

    @app.post('/api/escort-requests', status_code=201)
    def create_request(data: EscortCreate, user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            name = data.student_name if who['role'] in STAFF else who['name']
            row = conn.execute('INSERT INTO escort_requests(student_name,student_phone,pickup,destination,notes,created_by) '
                               'VALUES (%s,%s,%s,%s,%s,%s) RETURNING *',
                               (name,data.student_phone,data.pickup,data.destination,data.notes,who['id'])).fetchone()
            notify(conn, row['id'], 'New Escort Request', 'An escort request requires staff attention.', 'warning')
        return row

    @app.patch('/api/escort-requests/{request_id}/status')
    def update_request(request_id: Annotated[int, Field(gt=0)], data: EscortUpdate, user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            if who['role'] not in STAFF:
                raise HTTPException(403, 'Only admins and safety officials can update escort requests')
            current = conn.execute('SELECT * FROM escort_requests WHERE id=%s FOR UPDATE', (request_id,)).fetchone()
            if not current:
                raise HTTPException(404, 'Escort request not found')
            if data.status == current['status']:
                if ((data.assigned_officer is not None and data.assigned_officer != current['assigned_officer'])
                        or (data.eta is not None and data.status not in {'completed','cancelled'} and data.eta != current['eta'])):
                    raise HTTPException(409, 'Change status before changing assignment details')
                return current  # A repeated status update must not duplicate notifications.
            if data.status not in TRANSITIONS[current['status']]:
                raise HTTPException(409, 'Invalid escort status transition')
            officer = data.assigned_officer or current['assigned_officer']
            if data.status == 'assigned' and not officer:
                raise HTTPException(422, 'An assigned officer is required')
            eta = data.eta if data.eta is not None else current['eta']
            if data.status in {'completed','cancelled'}:
                eta = None  # A terminal request has no current arrival estimate.
            updated = conn.execute('UPDATE escort_requests SET status=%s,assigned_officer=%s,eta=%s WHERE id=%s RETURNING *',
                                   (data.status,officer,eta,request_id)).fetchone()
            notify(conn, request_id, f'Escort Request {data.status.replace("_", " ")}',
                   f'An escort request status changed to {data.status.replace("_", " ")}.')
        return updated
