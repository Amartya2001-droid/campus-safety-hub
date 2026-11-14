from concurrent.futures import ThreadPoolExecutor
import os

import psycopg
import pytest
from psycopg.rows import dict_row

from backend.tests.test_app import service, authorization


@pytest.fixture
def sos(service):
    client, key = service
    # Express owns these existing tables. These isolated fixture tables model that boundary;
    # the gateway smoke also exercises the real Express-created schema.
    with psycopg.connect(os.environ['DATABASE_URL']) as conn:
        conn.execute('''CREATE TABLE users (id int PRIMARY KEY,name text,email text,role text);
          INSERT INTO users VALUES (1,'Staff One','staff@example.invalid','admin'),
          (2,'Staff Two','safety@example.invalid','safety_official'),
          (3,'Student One','student@example.invalid','student'),
          (4,'Faculty One','faculty@example.invalid','faculty'),
          (5,'Student Two','other@example.invalid','student');
          CREATE TABLE sos_alerts (
            id serial PRIMARY KEY,student_name varchar(255) NOT NULL,
            student_phone varchar(50) NOT NULL DEFAULT '',student_email varchar(255) NOT NULL DEFAULT '',
            location varchar(255) NOT NULL,lat double precision,lng double precision,type varchar(100),
            status varchar(50) NOT NULL DEFAULT 'new' CHECK(status IN ('new','assigned','en_route','on_scene','resolved')),
            assigned_officer varchar(255),notes text,created_by int REFERENCES users(id),
            created_at timestamptz NOT NULL DEFAULT NOW());
          CREATE TABLE notifications (id serial PRIMARY KEY,title varchar(255),message text,type varchar(50),
            read boolean NOT NULL DEFAULT false,reference_type varchar(50),reference_id int,
            created_at timestamptz NOT NULL DEFAULT NOW());''')
    yield client, key


def headers(key, role='admin', sub='1'):
    return authorization(key, role, sub=sub)


DATA = dict(student_name='Submitted Person', student_email='submitted@example.invalid',
            location='Fixture Library', lat=45.087, lng=-64.366, notes='Test fixture')


def database(sql, params=()):
    with psycopg.connect(os.environ['DATABASE_URL'], row_factory=dict_row) as conn:
        result = conn.execute(sql, params)
        return result.fetchall() if result.description else []


@pytest.mark.parametrize('role,sub', [('student','3'), ('faculty','4')])
def test_owner_identity_and_visibility(sos, role, sub):
    client, key = sos
    owner = headers(key, role, sub)
    other = headers(key, 'student', '5')
    created = client.post('/api/sos-alerts', json=DATA, headers=owner)
    assert created.status_code == 201
    row = created.json()
    assert row['created_by'] == int(sub)
    assert row['student_name'] in {'Student One','Faculty One'}
    assert row['student_email'] != DATA['student_email']
    assert client.get('/api/sos-alerts', headers=owner).json() == [row]
    assert client.get('/api/sos-alerts', headers=other).json() == []
    assert client.get('/api/sos-alerts', headers=headers(key)).json() == [row]
    assert client.patch(f'/api/sos-alerts/{row["id"]}/status', json={'status':'resolved'}, headers=owner).status_code == 403
    note = database('SELECT * FROM notifications')[0]
    assert note['reference_id'] == row['id']
    assert DATA['location'] not in note['message']
    assert row['student_name'] not in note['message']


@pytest.mark.parametrize('role,sub', [('admin','1'), ('safety_official','2')])
def test_staff_workflow_and_retry_idempotence(sos, role, sub):
    client, key = sos
    auth = headers(key, role, sub)
    row = client.post('/api/sos-alerts', json=DATA, headers=auth).json()
    path = f'/api/sos-alerts/{row["id"]}/status'
    assert row['student_name'] == DATA['student_name']
    assert client.patch(path, json={'status':'assigned'}, headers=auth).status_code == 422
    assert client.patch(path, json={'status':'en_route'}, headers=auth).status_code == 409
    for status in ['assigned','en_route','on_scene','resolved']:
        payload = dict(status=status, assigned_officer='Staff One') if status == 'assigned' else dict(status=status)
        changed = client.patch(path, json=payload, headers=auth)
        assert changed.status_code == 200
        assert changed.json()['status'] == status
        assert changed.json()['assigned_officer'] == 'Staff One'
    assert len(database('SELECT * FROM notifications')) == 5
    assert client.patch(path, json={'status':'resolved'}, headers=auth).status_code == 200
    assert len(database('SELECT * FROM notifications')) == 5
    assert client.patch(path, json={'status':'new'}, headers=auth).status_code == 409
    assert client.patch('/api/sos-alerts/999/status', json={'status':'resolved'}, headers=auth).status_code == 404


@pytest.mark.parametrize('change', [{'lat':91}, {'lat':None}, {'lng':181}, {'lat':'NaN'},
                                    {'student_name':' '}, {'location':''}, {'notes':'x'*4001},
                                    {'created_by':5}, {'status':'resolved'}])
def test_invalid_alerts_never_write(sos, change):
    client, key = sos
    assert client.post('/api/sos-alerts', json=DATA | change, headers=headers(key)).status_code == 422
    assert database('SELECT * FROM sos_alerts') == []
    assert database('SELECT * FROM notifications') == []


def test_unauthenticated_and_stale_identities(sos):
    client, key = sos
    assert client.get('/api/sos-alerts').status_code == 401
    assert client.post('/api/sos-alerts', json=DATA).status_code == 401
    for auth in [headers(key, sub='999'), headers(key, sub='not-an-id'), headers(key, 'admin', '3')]:
        assert client.get('/api/sos-alerts', headers=auth).status_code == 401


def test_notification_failure_rolls_back_create_and_update(sos):
    client, key = sos
    auth = headers(key)
    database('''CREATE FUNCTION reject_notice() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected notification failure'; END $$;
      CREATE TRIGGER reject_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_notice()''')
    failed = client.post('/api/sos-alerts', json=DATA, headers=auth)
    assert failed.status_code == 503
    assert failed.json() == {'message':'Safety data temporarily unavailable'}
    assert database('SELECT * FROM sos_alerts') == []
    database('DROP TRIGGER reject_notice ON notifications')
    row = client.post('/api/sos-alerts', json=DATA, headers=auth).json()
    database('CREATE TRIGGER reject_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_notice()')
    assert client.patch(f'/api/sos-alerts/{row["id"]}/status', json={'status':'resolved'}, headers=auth).status_code == 503
    assert database('SELECT status FROM sos_alerts')[0]['status'] == 'new'
    assert len(database('SELECT * FROM notifications')) == 1


def test_competing_updates_cannot_reopen_resolved_alert(sos):
    client, key = sos
    auth = headers(key)
    row = client.post('/api/sos-alerts', json=DATA, headers=auth).json()
    path = f'/api/sos-alerts/{row["id"]}/status'
    assert client.patch(path, json={'status':'assigned','assigned_officer':'Staff One'}, headers=auth).status_code == 200
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda status: client.patch(path, json={'status':status}, headers=auth).status_code,
                                ['en_route','resolved']))
    assert results in [[200,200],[409,200]]
    assert database('SELECT status FROM sos_alerts')[0]['status'] == 'resolved'


def test_missing_express_schema_returns_generic_unavailable(service):
    client, key = service
    result = client.get('/api/sos-alerts', headers=headers(key))
    assert result.status_code == 503
    assert result.json() == {'message':'Safety data temporarily unavailable'}
