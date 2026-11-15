"""Resolve a signed gateway actor against current dashboard account data."""
from fastapi import HTTPException

STAFF = {'admin', 'safety_official'}


def identity(conn, user):
    try:
        user_id = int(user.sub)
    except ValueError:
        raise HTTPException(401, 'Not authenticated') from None
    row = conn.execute('SELECT id,name,email,role FROM users WHERE id=%s', (user_id,)).fetchone()
    if not row or row['role'] != user.role:
        raise HTTPException(401, 'Not authenticated')
    return row
