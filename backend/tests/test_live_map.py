import pytest

from backend.tests.test_app import service
from backend.tests.test_sos import sos, headers, database
from backend.tests.test_dashboard import summary


@pytest.fixture
def map_service(summary):
    database('''CREATE TABLE patrol_checkins (id serial PRIMARY KEY,session_id int REFERENCES patrol_sessions(id),
      residence_name text,arrival_at timestamptz NOT NULL DEFAULT NOW(),departure_at timestamptz)''')
    return summary


def get(client, key, role='admin', sub='1'):
    return client.get('/api/map/live-data', headers=headers(key, role, sub))


def seed():
    database('''INSERT INTO sos_alerts(student_name,location,created_by,status,lat,lng,student_phone,notes) VALUES
      ('Owner three','Fixture',3,'new',45,-64,'private contact','private notes'),
      ('Owner four','Fixture',4,'assigned',45,-64,'private contact','private notes'),
      ('Owner five','Fixture',5,'en_route',45,-64,'private contact','private notes'),
      ('Legacy','Fixture',NULL,'on_scene',45,-64,'private contact','private notes'),
      ('Resolved','Fixture',3,'resolved',45,-64,'','');
      INSERT INTO patrol_sessions(assigned_student_id,status,started_at,ended_at,max_duration_minutes) VALUES
      (3,'active',NOW()-INTERVAL '10 minutes',NULL,300),
      (4,'active',NOW()-INTERVAL '10 minutes',NULL,300),
      (5,'active',NOW()-INTERVAL '10 minutes',NULL,300),
      (3,'active',NOW()-INTERVAL '6 hours',NULL,300),
      (3,'active',NOW()+INTERVAL '1 hour',NULL,300),
      (3,'active',NOW()-INTERVAL '10 minutes',NOW(),300),
      (3,'active',NULL,NULL,300),
      (3,'completed',NOW()-INTERVAL '10 minutes',NOW(),300),
      (3,'pending',NOW()-INTERVAL '10 minutes',NULL,300),
      (3,'active',NOW()-INTERVAL '10 minutes',NULL,0);
      INSERT INTO patrol_checkins(session_id,residence_name,arrival_at,departure_at) VALUES
      (1,'Older',NOW()-INTERVAL '3 minutes',NULL),
      (1,'Same time older ID',NOW()-INTERVAL '2 minutes',NULL),
      (1,'Current residence',NOW()-INTERVAL '2 minutes',NULL),
      (1,'Departed',NOW()-INTERVAL '1 minute',NOW()),
      (1,'Future',NOW()+INTERVAL '1 minute',NULL),
      (1,'Before shift',NOW()-INTERVAL '11 minutes',NULL);''')


def test_empty_arrays_are_valid(map_service):
    client, key = map_service
    result = get(client, key)
    assert result.status_code == 200
    assert result.json() == {'active_alerts':[], 'active_patrols':[]}


@pytest.mark.parametrize('role,sub,alerts,patrols', [
    ('admin','1',{1,2,3,4},{1,2,3}), ('safety_official','2',{1,2,3,4},{1,2,3}),
    ('student','3',{1},{1}), ('faculty','4',{2},{2}), ('student','5',{3},{3}),
])
def test_role_scopes_filters_and_minimal_projection(map_service, role, sub, alerts, patrols):
    client, key = map_service
    seed()
    before = database('SELECT * FROM patrol_sessions ORDER BY id')
    row = get(client, key, role, sub).json()
    assert {x['id'] for x in row['active_alerts']} == alerts
    assert {x['id'] for x in row['active_patrols']} == patrols
    assert [x['id'] for x in row['active_alerts']] == sorted(alerts, reverse=True)
    for alert in row['active_alerts']:
        assert set(alert) == {'id','student_name','location','lat','lng','type','status','created_at'}
    for patrol in row['active_patrols']:
        assert set(patrol) == {'id','student_name','status','started_at','current_residence'}
    assert 'private contact' not in str(row)
    assert 'private notes' not in str(row)
    assert database('SELECT * FROM patrol_sessions ORDER BY id') == before
    stats = client.get('/api/dashboard/stats', headers=headers(key, role, sub)).json()
    assert len(row['active_patrols']) == stats['active_patrols']


def test_latest_valid_open_checkin_is_deterministic(map_service):
    client, key = map_service
    seed()
    patrols = {x['id']:x for x in get(client, key).json()['active_patrols']}
    assert patrols[1]['current_residence'] == 'Current residence'
    assert patrols[2]['current_residence'] is None
    assert patrols[1]['student_name'] == 'Student One'


@pytest.mark.parametrize('lat,lng', [(91,0),(-91,0),(0,181),(0,-181),(float('nan'),0),
    (float('inf'),0),(0,float('-inf')),(None,0),(0,None)])
def test_legacy_unusable_coordinates_never_reach_map(map_service, lat, lng):
    client, key = map_service
    database("INSERT INTO sos_alerts(student_name,location,created_by,lat,lng) VALUES ('Legacy','Fixture',3,%s,%s)", (lat,lng))
    assert get(client, key).json()['active_alerts'] == []
    # The alert still needs attention even when it cannot be placed on a map.
    assert client.get('/api/dashboard/stats', headers=headers(key)).json()['active_alerts'] == 1


def test_authentication_current_role_and_scope_cannot_be_spoofed(map_service):
    client, key = map_service
    seed()
    assert client.get('/api/map/live-data').status_code == 401
    for auth in [headers(key, sub='999'),headers(key, sub='bad'),headers(key, 'admin','3')]:
        assert client.get('/api/map/live-data', headers=auth).status_code == 401
    normal = get(client, key, 'student','3').json()
    assert client.get('/api/map/live-data?user_id=5&role=admin', headers=headers(key,'student','3')).json() == normal
    database("UPDATE users SET role='faculty' WHERE id=3")
    assert get(client, key, 'student','3').status_code == 401


def test_committed_resolution_and_departure_are_visible(map_service):
    client, key = map_service
    seed()
    assert client.patch('/api/sos-alerts/1/status', json={'status':'resolved'}, headers=headers(key)).status_code == 200
    database('UPDATE patrol_checkins SET departure_at=NOW() WHERE session_id=1')
    row = get(client, key).json()
    assert 1 not in {x['id'] for x in row['active_alerts']}
    assert next(x for x in row['active_patrols'] if x['id'] == 1)['current_residence'] is None


def test_missing_schema_is_not_an_empty_success(summary):
    client, key = summary
    result = get(client, key)
    assert result.status_code == 503
    assert result.json() == {'message':'Safety data temporarily unavailable'}
