import os
os.environ['DATABASE_URL']='sqlite:///./test_asaba.db'
os.environ['JWT_SECRET']='test-secret'
os.environ['ADMIN_EMAIL']='admin@test.local'
os.environ['ADMIN_PASSWORD']='Test123!'
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import Base, engine, SessionLocal
from backend.models import User, Property
from backend.auth import hash_password

Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
db=SessionLocal(); db.add(User(email='admin@test.local',password_hash=hash_password('Test123!'),role='admin')); db.add(Property(name='Test Hall',kind='Event Centre',location='Asaba',capacity=100,price_per_day=100000,image='x')); db.commit(); db.close()
client=TestClient(app)

def token(): return client.post('/api/auth/login',json={'email':'admin@test.local','password':'Test123!'}).json()['access_token']
def headers(): return {'Authorization':'Bearer '+token()}

def test_health(): assert client.get('/api/health').json()=={'status':'ok'}
def test_login(): assert client.post('/api/auth/login',json={'email':'admin@test.local','password':'Test123!'}).json().get('access_token')
def test_protected_properties(): assert client.get('/api/properties').status_code==401; assert client.get('/api/properties',headers=headers()).status_code==200
def test_booking_and_overlap():
 h=headers(); body={'property_id':1,'customer_name':'Ada','customer_phone':'0800','start_at':'2026-10-01T10:00:00','end_at':'2026-10-02T10:00:00','total_amount':100000,'deposit_amount':30000,'status':'confirmed'}
 assert client.post('/api/bookings',json=body,headers=h).status_code==200
 assert client.post('/api/bookings',json={**body,'customer_name':'Ngozi'},headers=h).status_code==409
def test_deposit_validation():
 h=headers(); body={'property_id':1,'customer_name':'Bisi','customer_phone':'0800','start_at':'2026-11-01T10:00:00','end_at':'2026-11-02T10:00:00','total_amount':100000,'deposit_amount':120000,'status':'confirmed'}
 assert client.post('/api/bookings',json=body,headers=h).status_code==400


def test_pending_expiry():
 h=headers(); body={'property_id':1,'customer_name':'Expired','customer_phone':'0800','start_at':'2026-12-01T10:00:00','end_at':'2026-12-02T10:00:00','total_amount':100000,'deposit_amount':10000,'status':'pending','expires_at':'2020-01-01T00:00:00'}
 assert client.post('/api/bookings',json=body,headers=h).status_code==200
 rows=client.get('/api/bookings',headers=h).json(); assert any(x['customer_name']=='Expired' and x['status']=='expired' for x in rows)
