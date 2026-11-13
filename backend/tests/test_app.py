import os
import secrets
import subprocess
import sys
import time
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import jwt
import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql

from backend.app import create_app


@pytest.fixture
def service(monkeypatch):
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("Set TEST_DATABASE_URL to a disposable PostgreSQL database")
    schema = "test_" + secrets.token_hex(8)
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query["options"] = f"-csearch_path={schema}"
    isolated_url = urlunsplit(parts._replace(query=urlencode(query)))
    key = secrets.token_urlsafe(48)
    monkeypatch.setenv("DATABASE_URL", isolated_url)
    monkeypatch.setenv("SECRET_KEY", key)
    try:
        with TestClient(create_app()) as client:
            yield client, key
    finally:
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def authorization(key, role="admin", **overrides):
    now = int(time.time())
    payload = dict(sub="123", role=role, iat=now, exp=now + 30,
                   aud="campus-map", iss="acadia-dashboard")
    payload.update(overrides)
    return {"Authorization": "Bearer " + jwt.encode(payload, key, algorithm="HS256")}


LOCATION = dict(name="Test Library", type="building", lat=45.087, lng=-64.366,
                description="Test fixture, not an operational safety location")


@pytest.mark.parametrize("key", [None, "", " ", "short", "x" * 64,
                                 "acadia-safe-dev-secret-change-in-prod"])
def test_refuses_to_start_without_private_key(key):
    env = dict(os.environ)
    env.pop("SECRET_KEY", None)
    if key is not None:
        env["SECRET_KEY"] = key
    result = subprocess.run([sys.executable, "-c", "from backend.app import create_app; create_app()"],
                            env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert "SECRET_KEY must be" in result.stderr


def test_requires_database_url(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", secrets.token_urlsafe(48))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_URL is required"):
        create_app()


def test_health_and_authentication(service):
    client, key = service
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/campus-locations").status_code == 401
    assert client.get("/api/campus-locations", headers={"Authorization": "Bearer malformed"}).status_code == 401
    for headers in [authorization(secrets.token_urlsafe(48)),
                    authorization(key, exp=int(time.time()) - 1),
                    authorization(key, aud="wrong"), authorization(key, iss="wrong"),
                    authorization(key, role="superuser"),
                    authorization(key, exp=int(time.time()) + 1000)]:
        assert client.get("/api/campus-locations", headers=headers).status_code == 401
    missing_exp = dict(sub="1", role="admin", iat=int(time.time()), aud="campus-map", iss="acadia-dashboard")
    assert client.get("/api/campus-locations", headers={"Authorization": "Bearer " + jwt.encode(missing_exp, key, algorithm="HS256")}).status_code == 401


@pytest.mark.parametrize("role", ["student", "faculty"])
def test_readers_cannot_write(service, role):
    client, key = service
    headers = authorization(key, role)
    assert client.get("/api/campus-locations", headers=headers).json() == []
    assert client.post("/api/campus-locations", json=LOCATION, headers=headers).status_code == 403
    assert client.patch("/api/campus-locations/1", json={"name": "Changed"}, headers=headers).status_code == 403
    assert client.delete("/api/campus-locations/1", headers=headers).status_code == 403


@pytest.mark.parametrize("role", ["admin", "safety_official"])
def test_crud_persists_across_app_restart(service, role):
    client, key = service
    headers = authorization(key, role)
    created = client.post("/api/campus-locations", json=LOCATION, headers=headers)
    assert created.status_code == 201
    row = created.json()
    assert row.items() >= LOCATION.items()
    assert row["created_at"]
    path = f'/api/campus-locations/{row["id"]}'
    patch = {"name": "Updated ' ; --", "description": None, "lat": 0.0}
    updated = client.patch(path, json=patch, headers=headers)
    assert updated.status_code == 200
    assert updated.json().items() >= patch.items()
    with TestClient(create_app()) as restarted:
        persisted = restarted.get("/api/campus-locations", headers=headers).json()
        assert persisted == [updated.json()]
    assert client.delete(path, headers=headers).json() == {"success": True}
    assert client.get("/api/campus-locations", headers=headers).json() == []
    assert client.delete(path, headers=headers).status_code == 404
    assert client.patch(path, json={"name": "Missing"}, headers=headers).status_code == 404


@pytest.mark.parametrize("change", [{"lat": 91}, {"lng": -181}, {"name": "   "},
                                    {"type": "unknown"}, {"description": "x" * 2001},
                                    {"created_at": "forged"}])
def test_invalid_locations_are_not_written(service, change):
    client, key = service
    headers = authorization(key)
    result = client.post("/api/campus-locations", json=LOCATION | change, headers=headers)
    assert result.status_code == 422
    assert "message" in result.json()
    assert client.get("/api/campus-locations", headers=headers).json() == []


def test_patch_validation(service):
    client, key = service
    headers = authorization(key)
    row = client.post("/api/campus-locations", json=LOCATION, headers=headers).json()
    for patch in [{}, {"name": None}, {"lat": None}, {"lat": "NaN"}, {"lng": "Infinity"}, {"id": 9}]:
        assert client.patch(f'/api/campus-locations/{row["id"]}', json=patch, headers=headers).status_code == 422
    assert client.get("/api/campus-locations", headers=headers).json() == [row]
