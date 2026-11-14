import pytest

from backend.tests.test_app import service
from backend.tests.test_sos import sos, headers, database


@pytest.fixture
def summary(sos):
    database('''CREATE TABLE escort_requests (id serial PRIMARY KEY,created_by int,status text);
      CREATE TABLE patrol_sessions (id serial PRIMARY KEY,assigned_student_id int,status text,
        started_at timestamptz,ended_at timestamptz,max_duration_minutes int NOT NULL DEFAULT 300);
      CREATE TABLE starrez_config (id serial PRIMARY KEY,base_url text NOT NULL);''')
    return sos


def get(client, key, role='admin', sub='1'):
    return client.get('/api/dashboard/stats', headers=headers(key, role, sub))


def seed():
    database('''INSERT INTO sos_alerts(student_name,location,created_by,status) VALUES
      ('Fixture','Test',3,'new'),('Fixture','Test',3,'resolved'),
      ('Fixture','Test',4,'assigned'),('Fixture','Test',4,'on_scene'),
      ('Fixture','Test',5,'new'),('Fixture','Test',NULL,'new'),('Fixture','Test',1,'new');
      INSERT INTO escort_requests(created_by,status) VALUES (3,'pending'),(3,'completed'),
      (4,'pending'),(4,'pending'),(4,'assigned'),(5,'pending'),(NULL,'pending');
      INSERT INTO patrol_sessions(assigned_student_id,status,started_at,ended_at,max_duration_minutes) VALUES
      (3,'active',NOW()-INTERVAL '1 minute',NULL,300),
      (4,'active',NOW()-INTERVAL '1 minute',NULL,300),
      (4,'active',NOW()-INTERVAL '1 minute',NULL,300),
      (5,'active',NOW()-INTERVAL '1 minute',NULL,300),
      (3,'active',NOW()-INTERVAL '6 hours',NULL,300),
      (3,'pending',NULL,NULL,300),
      (3,'completed',NOW()-INTERVAL '1 minute',NOW(),300),
      (3,'active',NOW()-INTERVAL '1 minute',NOW(),300),
      (3,'active',NOW()+INTERVAL '1 hour',NULL,300),
      (3,'active',NULL,NULL,300),
      (3,'active',NOW()-INTERVAL '1 minute',NULL,-1);''')


def test_empty_summary_uses_typed_zero_values(summary):
    client, key = summary
    result = get(client, key)
    assert result.status_code == 200
    assert result.json() == dict(active_alerts=0,pending_escorts=0,active_patrols=0,starrez_configured=False)
    assert type(result.json()['active_alerts']) is int
    assert type(result.json()['starrez_configured']) is bool


@pytest.mark.parametrize('role,sub,expected', [('admin','1',(6,5,4)),
    ('safety_official','2',(6,5,4)), ('student','3',(1,1,1)), ('faculty','4',(2,2,2)),
    ('student','5',(1,1,1))])
def test_counts_are_role_scoped_and_exclude_inactive_rows(summary, role, sub, expected):
    client, key = summary
    seed()
    before = database('SELECT id,status,ended_at FROM patrol_sessions ORDER BY id')
    row = get(client, key, role, sub).json()
    assert (row['active_alerts'],row['pending_escorts'],row['active_patrols']) == expected
    assert database('SELECT id,status,ended_at FROM patrol_sessions ORDER BY id') == before


def test_configuration_is_not_a_claim_of_connectivity(summary):
    client, key = summary
    database("INSERT INTO starrez_config(base_url) VALUES ('   ')")
    assert get(client, key).json()['starrez_configured'] is False
    database("INSERT INTO starrez_config(base_url) VALUES ('https://unused.example.invalid')")
    assert get(client, key).json()['starrez_configured'] is False  # same first-row convention as Express
    database("UPDATE starrez_config SET base_url='https://unused.example.invalid' WHERE id=1")
    row = get(client, key).json()
    assert row['starrez_configured'] is True
    assert 'starrez_connected' not in row
    assert 'unused.example.invalid' not in str(row)


def test_summary_tracks_committed_workflow_changes(summary):
    client, key = summary
    created = client.post('/api/sos-alerts', json={'student_name':'Fixture','location':'Test'}, headers=headers(key))
    assert created.status_code == 201
    assert get(client, key).json()['active_alerts'] == 1
    assert client.patch(f'/api/sos-alerts/{created.json()["id"]}/status', json={'status':'resolved'}, headers=headers(key)).status_code == 200
    assert get(client, key).json()['active_alerts'] == 0
    database("INSERT INTO escort_requests(created_by,status) VALUES (1,'pending')")
    assert get(client, key).json()['pending_escorts'] == 1
    database("UPDATE escort_requests SET status='assigned'")
    assert get(client, key).json()['pending_escorts'] == 0


def test_authentication_and_current_database_role_are_required(summary):
    client, key = summary
    assert client.get('/api/dashboard/stats').status_code == 401
    assert get(client, key, sub='999').status_code == 401
    assert get(client, key, sub='not-an-id').status_code == 401
    assert get(client, key, 'admin','3').status_code == 401
    database("UPDATE users SET role='faculty' WHERE id=3")
    assert get(client, key, 'student','3').status_code == 401
    assert get(client, key, 'faculty','3').status_code == 200


def test_missing_schema_is_an_error_not_a_zero_summary(sos):
    client, key = sos
    result = get(client, key)
    assert result.status_code == 503
    assert result.json() == {'message':'Safety data temporarily unavailable'}
