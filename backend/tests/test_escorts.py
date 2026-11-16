from concurrent.futures import ThreadPoolExecutor

import pytest

from backend.tests.test_app import service
from backend.tests.test_sos import sos, headers, database


@pytest.fixture
def queue(sos):
    database('''CREATE TABLE escort_requests (
      id serial PRIMARY KEY,student_name varchar(255) NOT NULL,student_phone varchar(50) NOT NULL DEFAULT '',
      pickup varchar(255) NOT NULL,destination varchar(255) NOT NULL,notes text,
      status varchar(50) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','assigned','in_progress','completed','cancelled')),
      assigned_officer varchar(255),eta varchar(50),created_by int REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT NOW());
      CREATE TABLE patrol_sessions (id serial PRIMARY KEY,assigned_student_id int,status text,
        started_at timestamptz,ended_at timestamptz,max_duration_minutes int NOT NULL DEFAULT 300);
      CREATE TABLE starrez_config (id serial PRIMARY KEY,base_url text NOT NULL);''')
    return sos


DATA = dict(student_name='Submitted fixture',pickup='Fixture Library',destination='Fixture Residence',notes='Private test note')


def create(client, key, role='admin', sub='1'):
    response = client.post('/api/escort-requests', json=DATA, headers=headers(key,role,sub))
    assert response.status_code == 201
    return response.json()


@pytest.mark.parametrize('role,sub,name', [('student','3','Student One'),('faculty','4','Faculty One')])
def test_owner_identity_visibility_and_staff_only_actions(queue, role, sub, name):
    client,key = queue
    row = create(client,key,role,sub)
    auth = headers(key,role,sub)
    assert row['created_by'] == int(sub)
    assert row['student_name'] == name
    assert row['status'] == 'pending' and row['eta'] is None and row['assigned_officer'] is None
    assert client.get('/api/escort-requests',headers=auth).json() == [row]
    assert client.get('/api/escort-requests?user_id='+sub,headers=headers(key,'student','5')).json() == []
    assert client.get('/api/escort-requests',headers=headers(key)).json() == [row]
    assert client.patch(f'/api/escort-requests/{row["id"]}/status',json={'status':'cancelled'},headers=auth).status_code == 403
    notice = database('SELECT * FROM notifications')[0]
    assert notice['reference_type'] == 'escort_request'
    assert row['student_name'] not in notice['message'] and DATA['pickup'] not in notice['message']


@pytest.mark.parametrize('role,sub', [('admin','1'),('safety_official','2')])
def test_staff_workflow_eta_and_idempotent_retry(queue, role, sub):
    client,key = queue
    row = create(client,key,role,sub)
    auth = headers(key,role,sub)
    path = f'/api/escort-requests/{row["id"]}/status'
    assert client.patch(path,json={'status':'assigned'},headers=auth).status_code == 422
    assert client.patch(path,json={'status':'completed'},headers=auth).status_code == 409
    for status in ['assigned','in_progress','completed']:
        payload = dict(status=status,assigned_officer='Staff One',eta='Provided test estimate') if status=='assigned' else dict(status=status)
        result = client.patch(path,json=payload,headers=auth)
        assert result.status_code == 200
        assert result.json()['assigned_officer'] == 'Staff One'
        assert result.json()['eta'] == (None if status=='completed' else 'Provided test estimate')
        assert client.patch(path,json=payload,headers=auth).status_code == 200
    assert client.patch(path,json={'status':'completed','eta':'Provided test estimate'},headers=auth).status_code == 200
    assert len(database('SELECT * FROM notifications')) == 4
    assert client.patch(path,json={'status':'pending'},headers=auth).status_code == 409
    assert client.patch('/api/escort-requests/999/status',json={'status':'assigned'},headers=auth).status_code == 404
    assert client.get('/api/dashboard/stats',headers=auth).json()['pending_escorts'] == 0


@pytest.mark.parametrize('state', ['pending','assigned','in_progress'])
def test_staff_can_cancel_without_reopening(queue, state):
    client,key = queue
    row = create(client,key)
    path = f'/api/escort-requests/{row["id"]}/status'
    auth = headers(key)
    if state != 'pending':
        assert client.patch(path,json={'status':'assigned','assigned_officer':'Staff One'},headers=auth).status_code == 200
    if state == 'in_progress':
        assert client.patch(path,json={'status':state},headers=auth).status_code == 200
    result = client.patch(path,json={'status':'cancelled'},headers=auth)
    assert result.status_code == 200 and result.json()['eta'] is None
    assert client.patch(path,json={'status':'assigned'},headers=auth).status_code == 409


@pytest.mark.parametrize('change', [{'student_name':' '},{'pickup':''},{'destination':'x'*256},
    {'student_phone':'x'*51},{'notes':'x'*4001},{'created_by':5},{'status':'completed'},{'eta':'Invented'}])
def test_invalid_creates_do_not_write(queue, change):
    client,key = queue
    assert client.post('/api/escort-requests',json=DATA | change,headers=headers(key)).status_code == 422
    assert database('SELECT * FROM escort_requests') == []
    assert database('SELECT * FROM notifications') == []


def test_invalid_updates_and_stale_identities(queue):
    client,key = queue
    assert client.get('/api/escort-requests').status_code == 401
    assert client.post('/api/escort-requests',json=DATA).status_code == 401
    for auth in [headers(key,sub='999'),headers(key,sub='bad'),headers(key,'admin','3')]:
        assert client.get('/api/escort-requests',headers=auth).status_code == 401
    row = create(client,key)
    path = f'/api/escort-requests/{row["id"]}/status'
    for payload in [{'status':'unknown'},{'status':'assigned','assigned_officer':' '},
                    {'status':'assigned','eta':'x'*51},{'status':'assigned','created_by':5}]:
        assert client.patch(path,json=payload,headers=headers(key)).status_code == 422
    assert database('SELECT status FROM escort_requests')[0]['status'] == 'pending'


def test_notification_failure_rolls_back_create_and_status(queue):
    client,key = queue
    database('''CREATE FUNCTION reject_escort_notice() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected notification failure'; END $$;
      CREATE TRIGGER reject_escort_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_escort_notice()''')
    assert client.post('/api/escort-requests',json=DATA,headers=headers(key)).status_code == 503
    assert database('SELECT * FROM escort_requests') == []
    database('DROP TRIGGER reject_escort_notice ON notifications')
    row = create(client,key)
    database('CREATE TRIGGER reject_escort_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_escort_notice()')
    result = client.patch(f'/api/escort-requests/{row["id"]}/status',json={'status':'assigned','assigned_officer':'Staff One'},headers=headers(key))
    assert result.status_code == 503
    assert result.json() == {'message':'Safety data temporarily unavailable'}
    assert database('SELECT status FROM escort_requests')[0]['status'] == 'pending'
    assert len(database('SELECT * FROM notifications')) == 1


def test_competing_start_and_cancel_cannot_reopen_terminal_request(queue):
    client,key = queue
    row = create(client,key)
    path = f'/api/escort-requests/{row["id"]}/status'
    auth = headers(key)
    assert client.patch(path,json={'status':'assigned','assigned_officer':'Staff One'},headers=auth).status_code == 200
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(lambda state: client.patch(path,json={'status':state},headers=auth).status_code,
                              ['in_progress','cancelled']))
    assert codes in [[200,200],[409,200]]
    assert database('SELECT status FROM escort_requests')[0]['status'] == 'cancelled'


def test_missing_schema_is_not_an_empty_queue(sos):
    client,key = sos
    result = client.get('/api/escort-requests',headers=headers(key))
    assert result.status_code == 503
    assert result.json() == {'message':'Safety data temporarily unavailable'}
