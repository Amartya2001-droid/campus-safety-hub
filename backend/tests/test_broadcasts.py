import pytest

from backend.tests.test_app import service
from backend.tests.test_sos import sos, headers, database


@pytest.fixture
def feed(sos):
    database('''CREATE TABLE broadcast_alerts (id serial PRIMARY KEY,
      type varchar(50) NOT NULL CHECK(type IN ('emergency','weather','advisory','general')),
      title varchar(255) NOT NULL,message text NOT NULL,sent_by varchar(255) NOT NULL,
      priority varchar(20) NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','critical')),
      target varchar(255) NOT NULL DEFAULT 'All Users',created_by int REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT NOW())''')
    return sos


DATA = dict(type='general',title='Fixture announcement',message='Dashboard test fixture')


@pytest.mark.parametrize('role,sub,name', [('admin','1','Staff One'),('safety_official','2','Staff Two')])
def test_staff_publish_uses_database_author_and_atomic_notice(feed, role, sub, name):
    client,key = feed
    response = client.post('/api/broadcast-alerts',json=DATA,headers=headers(key,role,sub))
    assert response.status_code == 201
    row = response.json()
    assert row['sent_by'] == name and row['created_by'] == int(sub)
    assert row['priority'] == 'normal' and row['target'] == 'All Users'
    assert 'delivered' not in row and 'delivery_count' not in row
    notice = database('SELECT * FROM notifications')[0]
    assert notice['reference_type'] == 'broadcast_alert' and notice['reference_id'] == row['id']
    assert notice['type'] == 'info'
    assert client.get('/api/broadcast-alerts',headers=headers(key,role,sub)).json() == [row]


@pytest.mark.parametrize('kind', ['emergency','weather','advisory','general'])
@pytest.mark.parametrize('priority', ['normal','critical'])
def test_supported_types_and_priority_are_stored_classification_only(feed, kind, priority):
    client,key = feed
    result = client.post('/api/broadcast-alerts',json=DATA | {'type':kind,'priority':priority},headers=headers(key))
    assert result.status_code == 201
    assert result.json()['type'] == kind and result.json()['priority'] == priority
    assert database('SELECT type FROM notifications')[0]['type'] == ('emergency' if priority=='critical' else 'info')


@pytest.mark.parametrize('role,sub', [('student','3'),('faculty','4')])
def test_authenticated_readers_cannot_publish(feed, role, sub):
    client,key = feed
    assert client.post('/api/broadcast-alerts',json=DATA,headers=headers(key)).status_code == 201
    auth = headers(key,role,sub)
    assert len(client.get('/api/broadcast-alerts',headers=auth).json()) == 1
    assert client.post('/api/broadcast-alerts',json=DATA,headers=auth).status_code == 403
    assert len(database('SELECT * FROM broadcast_alerts')) == 1
    assert len(database('SELECT * FROM notifications')) == 1


@pytest.mark.parametrize('change', [{'type':'unknown'},{'priority':'unknown'},{'title':' '},{'message':''},
    {'title':'x'*241},{'message':'x'*4001},{'sent_by':'Forged'},{'created_by':5},
    {'target':'Faculty'},{'delivery_count':100}])
def test_invalid_or_forged_publish_does_not_write(feed, change):
    client,key = feed
    assert client.post('/api/broadcast-alerts',json=DATA | change,headers=headers(key)).status_code == 422
    assert database('SELECT * FROM broadcast_alerts') == [] and database('SELECT * FROM notifications') == []


def test_authentication_and_current_role_are_required(feed):
    client,key = feed
    assert client.get('/api/broadcast-alerts').status_code == 401
    assert client.post('/api/broadcast-alerts',json=DATA).status_code == 401
    for auth in [headers(key,sub='999'),headers(key,sub='bad'),headers(key,'admin','3')]:
        assert client.get('/api/broadcast-alerts',headers=auth).status_code == 401
        assert client.post('/api/broadcast-alerts',json=DATA,headers=auth).status_code == 401


def test_legacy_targeted_records_do_not_become_campus_wide(feed):
    client,key = feed
    database("""INSERT INTO broadcast_alerts(type,title,message,sent_by,target) VALUES
      ('general','Public fixture','Public','Staff One','All Users'),
      ('general','Legacy targeted fixture','Restricted fixture','Staff One','Faculty')""")
    assert [row['id'] for row in client.get('/api/broadcast-alerts',headers=headers(key)).json()] == [2,1]
    for role,sub in [('student','3'),('faculty','4')]:
        rows = client.get('/api/broadcast-alerts?target=Faculty',headers=headers(key,role,sub)).json()
        assert [row['id'] for row in rows] == [1]


def test_notification_failure_rolls_back_publication(feed):
    client,key = feed
    database('''CREATE FUNCTION reject_broadcast_notice() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected notification failure'; END $$;
      CREATE TRIGGER reject_broadcast_notice BEFORE INSERT ON notifications
      FOR EACH ROW EXECUTE FUNCTION reject_broadcast_notice()''')
    result = client.post('/api/broadcast-alerts',json=DATA,headers=headers(key))
    assert result.status_code == 503
    assert result.json() == {'message':'Safety data temporarily unavailable'}
    assert database('SELECT * FROM broadcast_alerts') == [] and database('SELECT * FROM notifications') == []


def test_text_boundaries_fit_existing_notification_columns(feed):
    client,key = feed
    result = client.post('/api/broadcast-alerts',json=DATA | {'title':' t'+'x'*239+' ','message':'m'*4000,'priority':'critical'},headers=headers(key))
    assert result.status_code == 201
    notice = database('SELECT * FROM notifications')[0]
    assert len(result.json()['title']) == 240
    assert len(notice['title']) <= 255 and len(notice['message']) == 200


def test_missing_schema_is_not_an_empty_feed(sos):
    client,key = sos
    result = client.get('/api/broadcast-alerts',headers=headers(key))
    assert result.status_code == 503 and result.json() == {'message':'Safety data temporarily unavailable'}
