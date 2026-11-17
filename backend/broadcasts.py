"""Campus-wide dashboard feed publishing; no device push delivery is implied."""
from typing import Annotated, Literal

from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints

from backend.identity import STAFF, identity


class BroadcastCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    type: Literal['emergency','weather','advisory','general']
    title: Annotated[str, StringConstraints(strip_whitespace=True,min_length=1,max_length=240)]
    message: Annotated[str, StringConstraints(strip_whitespace=True,min_length=1,max_length=4000)]
    priority: Literal['normal','critical'] = 'normal'
    target: Literal['All Users'] = 'All Users'


def register_broadcast_routes(app, connect, actor):
    @app.get('/api/broadcast-alerts')
    def broadcasts(user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            if who['role'] in STAFF:
                return conn.execute('SELECT * FROM broadcast_alerts ORDER BY created_at DESC,id DESC').fetchall()
            # Old data may contain targeted messages. Do not widen their intended audience.
            return conn.execute("SELECT * FROM broadcast_alerts WHERE target='All Users' ORDER BY created_at DESC,id DESC").fetchall()

    @app.post('/api/broadcast-alerts', status_code=201)
    def publish(data: BroadcastCreate, user=Depends(actor)):
        with connect() as conn:
            who = identity(conn, user)
            if who['role'] not in STAFF:
                raise HTTPException(403, 'Only admins and safety officials can publish broadcasts')
            row = conn.execute('INSERT INTO broadcast_alerts(type,title,message,sent_by,priority,target,created_by) '
                               'VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *',
                               (data.type,data.title,data.message,who['name'],data.priority,data.target,who['id'])).fetchone()
            conn.execute('INSERT INTO notifications(title,message,type,reference_type,reference_id) '
                         'VALUES (%s,%s,%s,%s,%s)',
                         (f'Broadcast: {data.title}',data.message[:200],
                          'emergency' if data.priority=='critical' else 'info','broadcast_alert',row['id']))
        return row
