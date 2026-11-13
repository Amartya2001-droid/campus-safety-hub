"""Campus safety service. Express authenticates users; this service authorizes signed actors."""

import os
from contextlib import asynccontextmanager
from typing import Annotated, Literal

import jwt
import psycopg
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg.rows import dict_row
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Role = Literal["admin", "safety_official", "student", "faculty"]
LocationType = Literal["blue_phone", "safe_zone", "aed", "building", "parking"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Latitude = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
Longitude = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]
Description = Annotated[str, Field(max_length=2000)]


class Actor(BaseModel):
    sub: str
    role: Role


class LocationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name
    type: LocationType
    lat: Latitude
    lng: Longitude
    description: Description | None = None


class LocationPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Name | None = None
    type: LocationType | None = None
    lat: Latitude | None = None
    lng: Longitude | None = None
    description: Description | None = None


SCHEMA = """
CREATE TABLE IF NOT EXISTS campus_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('blue_phone','safe_zone','aed','building','parking')),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


def create_app() -> FastAPI:
    secret = os.environ.get("SECRET_KEY", "")
    if (len(secret.strip()) < 32 or secret != secret.strip()
            or secret in {"acadia-safe-secret-key-2024", "acadia-safe-dev-secret-change-in-prod"}
            or len(set(secret)) < 8):
        raise RuntimeError("SECRET_KEY must be a privately generated key of at least 32 characters")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

    def connect():
        return psycopg.connect(database_url, row_factory=dict_row, connect_timeout=5)

    @asynccontextmanager
    async def lifespan(_app):
        with connect() as conn:
            conn.execute(SCHEMA)
        yield

    app = FastAPI(title="Acadia Safe Dashboard API", lifespan=lifespan)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request, _error):
        # Preserve the existing frontend's error contract; never echo input/token values.
        return JSONResponse(status_code=422, content={"message": "Invalid request data"})

    @app.exception_handler(psycopg.Error)
    async def database_error(_request, _error):
        return JSONResponse(status_code=503, content={"message": "Safety data temporarily unavailable"})

    @app.exception_handler(HTTPException)
    async def http_error(_request, error):
        return JSONResponse(status_code=error.status_code, content={"message": error.detail})

    def actor(request: Request) -> Actor:
        authorization = request.headers.get("authorization", "")
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, "Not authenticated")
        try:
            payload = jwt.decode(
                authorization[7:], secret, algorithms=["HS256"],
                audience="campus-map", issuer="acadia-dashboard",
                options={"require": ["sub", "role", "exp", "iat", "aud", "iss"]},
            )
            if payload["exp"] - payload["iat"] > 60:
                raise ValueError("Token lifetime exceeds limit")
            return Actor.model_validate(payload)
        except (jwt.PyJWTError, ValueError, TypeError):
            raise HTTPException(401, "Not authenticated") from None

    def writer(user: Annotated[Actor, Depends(actor)]) -> Actor:
        if user.role not in {"admin", "safety_official"}:
            raise HTTPException(403, "Only admins and safety officials can manage locations")
        return user

    @app.get("/api/health")
    def health():
        with connect() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "service": "campus-safety"}

    @app.get("/api/campus-locations")
    def locations(_user: Annotated[Actor, Depends(actor)]):
        with connect() as conn:
            return conn.execute("SELECT * FROM campus_locations ORDER BY type, name, id").fetchall()

    @app.post("/api/campus-locations", status_code=201)
    def create_location(data: LocationCreate, _user: Annotated[Actor, Depends(writer)]):
        with connect() as conn:
            return conn.execute(
                "INSERT INTO campus_locations (name,type,lat,lng,description) "
                "VALUES (%s,%s,%s,%s,%s) RETURNING *",
                (data.name, data.type, data.lat, data.lng, data.description),
            ).fetchone()

    @app.patch("/api/campus-locations/{location_id}")
    def update_location(location_id: Annotated[int, Field(gt=0)], data: LocationPatch,
                        _user: Annotated[Actor, Depends(writer)]):
        changes = data.model_dump(exclude_unset=True)
        if not changes or any(value is None for key, value in changes.items() if key != "description"):
            raise HTTPException(422, "Provide non-null location fields; only description can be cleared")
        # Column names come exclusively from the closed Pydantic model, not user input.
        from psycopg import sql
        assignments = sql.SQL(", ").join(
            sql.SQL("{} = %s").format(sql.Identifier(key)) for key in changes
        )
        with connect() as conn:
            row = conn.execute(
                sql.SQL("UPDATE campus_locations SET {} WHERE id = %s RETURNING *").format(assignments),
                (*changes.values(), location_id),
            ).fetchone()
        if row is None:
            raise HTTPException(404, "Location not found")
        return row

    @app.delete("/api/campus-locations/{location_id}")
    def delete_location(location_id: Annotated[int, Field(gt=0)],
                        _user: Annotated[Actor, Depends(writer)]):
        with connect() as conn:
            row = conn.execute("DELETE FROM campus_locations WHERE id = %s RETURNING id",
                               (location_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Location not found")
        return {"success": True}

    from backend.sos import register_sos_routes
    register_sos_routes(app, connect, actor)
    return app
