from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import re
import firebase_admin
from firebase_admin import credentials, firestore as firebase_firestore

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ==================== FIREBASE ADMIN (Dashboard bridge) ====================

_firebase_app = None
_firestore_client = None

def get_firestore_client():
    """Lazy-init Firebase Admin. Returns None gracefully if not configured."""
    global _firebase_app, _firestore_client
    if _firestore_client is not None:
        return _firestore_client
    try:
        sa_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
        if not sa_json or not sa_json.strip():
            logging.getLogger(__name__).warning(
                "FIREBASE_SERVICE_ACCOUNT_JSON not set; Dashboard bridge disabled"
            )
            return None
        cred = credentials.Certificate(json.loads(sa_json))
        _firebase_app = firebase_admin.initialize_app(cred, name='dashboard_bridge')
        _firestore_client = firebase_firestore.client(_firebase_app)
        logging.getLogger(__name__).info("Firebase Admin SDK initialized for Dashboard bridge")
        return _firestore_client
    except Exception as e:
        logging.getLogger(__name__).error(f"Firebase Admin init failed: {e}")
        return None

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'acadia_safe')]

# Create the main app
app = FastAPI(title="Acadia Safe API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'acadia-safe-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str
    profile_photo: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    created_at: datetime

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

class TrustedContact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    relationship: Optional[str] = None

class TrustedContactCreate(BaseModel):
    name: str
    phone: str
    relationship: Optional[str] = None

class IncidentCreate(BaseModel):
    incident_type: str
    location_lat: float
    location_lng: float
    location_name: Optional[str] = None
    description: str
    photos: Optional[List[str]] = []
    is_anonymous: bool = False
    wants_contact: bool = False
    contact_phone: Optional[str] = None

class Incident(BaseModel):
    id: str
    user_id: Optional[str] = None
    incident_type: str
    location_lat: float
    location_lng: float
    location_name: Optional[str] = None
    description: str
    photos: Optional[List[str]] = []
    is_anonymous: bool
    wants_contact: bool
    contact_phone: Optional[str] = None
    status: str = "pending"
    created_at: datetime

class EscortRequestCreate(BaseModel):
    pickup_lat: float
    pickup_lng: float
    pickup_name: Optional[str] = None
    destination_lat: float
    destination_lng: float
    destination_name: Optional[str] = None
    notes: Optional[str] = None

class EscortRequest(BaseModel):
    id: str
    user_id: str
    pickup_lat: float
    pickup_lng: float
    pickup_name: Optional[str] = None
    destination_lat: float
    destination_lng: float
    destination_name: Optional[str] = None
    notes: Optional[str] = None
    status: str = "pending"
    officer_name: Optional[str] = None
    officer_photo: Optional[str] = None
    estimated_wait: int = 10
    created_at: datetime

class SOSAlert(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_phone: str
    location_lat: float
    location_lng: float
    alert_type: Optional[str] = None
    status: str = "active"
    created_at: datetime

class SOSAlertCreate(BaseModel):
    location_lat: float
    location_lng: float
    alert_type: Optional[str] = None

class FriendWalkCreate(BaseModel):
    contact_ids: List[str]
    duration_minutes: int
    location_lat: float
    location_lng: float

class FriendWalk(BaseModel):
    id: str
    user_id: str
    contact_ids: List[str]
    start_time: datetime
    duration_minutes: int
    end_time: datetime
    current_lat: float
    current_lng: float
    status: str = "active"

class FriendWalkUpdate(BaseModel):
    location_lat: float
    location_lng: float

class CampusAlert(BaseModel):
    id: str
    alert_type: str  # emergency, advisory, info
    title: str
    message: str
    created_at: datetime
    is_read: bool = False

class CampusLocation(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    location_type: str  # emergency_phone, aed, safe_building, security_office, parking
    lat: float
    lng: float

# ==================== AUTH HELPERS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def validate_acadia_email(email: str) -> bool:
    """Validate that email is from @acadiau.ca domain"""
    return email.lower().endswith("@acadiau.ca")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/signup")
async def signup(user: UserCreate):
    # Validate Acadia email
    if not validate_acadia_email(user.email):
        raise HTTPException(status_code=400, detail="Only @acadiau.ca emails are allowed")
    
    # Check if user exists
    existing = await db.users.find_one({"email": user.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "full_name": user.full_name,
        "email": user.email.lower(),
        "phone": user.phone,
        "password_hash": get_password_hash(user.password),
        "profile_photo": None,
        "emergency_contact_name": None,
        "emergency_contact_phone": None,
        "trusted_contacts": [],
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(user_doc)
    
    # Create token
    token = create_access_token({"sub": user_id})
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "full_name": user.full_name,
            "email": user.email.lower(),
            "phone": user.phone
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user["id"]})
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "phone": user["phone"],
            "profile_photo": user.get("profile_photo"),
            "emergency_contact_name": user.get("emergency_contact_name"),
            "emergency_contact_phone": user.get("emergency_contact_phone")
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "full_name": current_user["full_name"],
        "email": current_user["email"],
        "phone": current_user["phone"],
        "profile_photo": current_user.get("profile_photo"),
        "emergency_contact_name": current_user.get("emergency_contact_name"),
        "emergency_contact_phone": current_user.get("emergency_contact_phone")
    }

@api_router.put("/auth/profile")
async def update_profile(update: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user["id"]})
    return {
        "id": updated_user["id"],
        "full_name": updated_user["full_name"],
        "email": updated_user["email"],
        "phone": updated_user["phone"],
        "profile_photo": updated_user.get("profile_photo"),
        "emergency_contact_name": updated_user.get("emergency_contact_name"),
        "emergency_contact_phone": updated_user.get("emergency_contact_phone")
    }

# ==================== TRUSTED CONTACTS ====================

@api_router.get("/contacts", response_model=List[TrustedContact])
async def get_trusted_contacts(current_user: dict = Depends(get_current_user)):
    return current_user.get("trusted_contacts", [])

@api_router.post("/contacts", response_model=TrustedContact)
async def add_trusted_contact(contact: TrustedContactCreate, current_user: dict = Depends(get_current_user)):
    new_contact = TrustedContact(
        name=contact.name,
        phone=contact.phone,
        relationship=contact.relationship
    )
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$push": {"trusted_contacts": new_contact.dict()}}
    )
    return new_contact

@api_router.delete("/contacts/{contact_id}")
async def delete_trusted_contact(contact_id: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"trusted_contacts": {"id": contact_id}}}
    )
    return {"message": "Contact deleted"}

# ==================== SOS ALERTS ====================

@api_router.post("/sos", response_model=SOSAlert)
async def create_sos_alert(alert: SOSAlertCreate, current_user: dict = Depends(get_current_user)):
    sos_id = str(uuid.uuid4())
    now = datetime.utcnow()
    sos_doc = {
        "id": sos_id,
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "user_phone": current_user["phone"],
        "location_lat": alert.location_lat,
        "location_lng": alert.location_lng,
        "alert_type": alert.alert_type,
        "status": "active",
        "created_at": now
    }
    await db.sos_alerts.insert_one(sos_doc)
    logger.info(f"SOS Alert created: {sos_id} by {current_user['full_name']}")

    # Mirror to Firestore so Dashboard sees it in real-time
    try:
        fs = get_firestore_client()
        if fs is not None:
            firestore_alert = {
                "studentName": current_user["full_name"],
                "studentEmail": current_user.get("email", ""),
                "studentPhone": current_user["phone"],
                "location": f"{alert.location_lat:.4f}, {alert.location_lng:.4f}",
                "latitude": alert.location_lat,
                "longitude": alert.location_lng,
                "status": "new",
                "createdAt": now.isoformat() + "Z",
                "alertType": alert.alert_type or "sos",
                "campusSosId": sos_id,
                "assignedTo": None,
                "assignedToName": None,
            }
            fs.collection("alerts").document(sos_id).set(firestore_alert)
            logger.info(f"SOS {sos_id} mirrored to Firestore")
    except Exception as e:
        logger.error(f"Firestore mirror failed for SOS {sos_id}: {e}")
        # Non-blocking — student still gets success response

    return SOSAlert(**sos_doc)

@api_router.put("/sos/{sos_id}/cancel")
async def cancel_sos_alert(sos_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.sos_alerts.update_one(
        {"id": sos_id, "user_id": current_user["id"]},
        {"$set": {"status": "cancelled"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="SOS alert not found")

    # Sync resolved status to Firestore so Dashboard updates in real-time
    try:
        fs = get_firestore_client()
        if fs is not None:
            doc_ref = fs.collection("alerts").document(sos_id)
            if doc_ref.get().exists:
                doc_ref.update({
                    "status": "resolved",
                    "resolvedByCampusApp": True,
                    "updatedAt": datetime.utcnow().isoformat() + "Z"
                })
    except Exception as e:
        logger.error(f"Firestore cancel sync failed for SOS {sos_id}: {e}")

    return {"message": "SOS alert cancelled"}

@api_router.get("/sos/active")
async def get_active_sos(current_user: dict = Depends(get_current_user)):
    sos = await db.sos_alerts.find_one({
        "user_id": current_user["id"],
        "status": "active"
    }, {"_id": 0})
    return sos

# ==================== INCIDENTS ====================

@api_router.post("/incidents", response_model=Incident)
async def create_incident(incident: IncidentCreate, current_user: dict = Depends(get_current_user)):
    incident_id = str(uuid.uuid4())
    incident_doc = {
        "id": incident_id,
        "user_id": None if incident.is_anonymous else current_user["id"],
        "incident_type": incident.incident_type,
        "location_lat": incident.location_lat,
        "location_lng": incident.location_lng,
        "location_name": incident.location_name,
        "description": incident.description,
        "photos": incident.photos or [],
        "is_anonymous": incident.is_anonymous,
        "wants_contact": incident.wants_contact,
        "contact_phone": incident.contact_phone,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    await db.incidents.insert_one(incident_doc)
    logger.info(f"Incident reported: {incident_id}")
    return Incident(**incident_doc)

@api_router.get("/incidents/my", response_model=List[Incident])
async def get_my_incidents(current_user: dict = Depends(get_current_user)):
    incidents = await db.incidents.find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return [Incident(**inc) for inc in incidents]

@api_router.get("/incidents/{incident_id}", response_model=Incident)
async def get_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    incident = await db.incidents.find_one({"id": incident_id})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return Incident(**incident)

# ==================== ESCORT REQUESTS ====================

@api_router.post("/escorts", response_model=EscortRequest)
async def create_escort_request(request: EscortRequestCreate, current_user: dict = Depends(get_current_user)):
    # Check for existing active request
    existing = await db.escort_requests.find_one({
        "user_id": current_user["id"],
        "status": {"$in": ["pending", "assigned"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active escort request")
    
    request_id = str(uuid.uuid4())
    request_doc = {
        "id": request_id,
        "user_id": current_user["id"],
        "pickup_lat": request.pickup_lat,
        "pickup_lng": request.pickup_lng,
        "pickup_name": request.pickup_name,
        "destination_lat": request.destination_lat,
        "destination_lng": request.destination_lng,
        "destination_name": request.destination_name,
        "notes": request.notes,
        "status": "pending",
        "officer_name": None,
        "officer_photo": None,
        "estimated_wait": 10,
        "created_at": datetime.utcnow()
    }
    await db.escort_requests.insert_one(request_doc)
    logger.info(f"Escort request created: {request_id}")
    return EscortRequest(**request_doc)

@api_router.get("/escorts/active")
async def get_active_escort(current_user: dict = Depends(get_current_user)):
    request = await db.escort_requests.find_one({
        "user_id": current_user["id"],
        "status": {"$in": ["pending", "assigned"]}
    }, {"_id": 0})
    return request

@api_router.put("/escorts/{request_id}/cancel")
async def cancel_escort_request(request_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.escort_requests.update_one(
        {"id": request_id, "user_id": current_user["id"]},
        {"$set": {"status": "cancelled"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Escort request not found")
    return {"message": "Escort request cancelled"}

# Mock assign officer (for demo)
@api_router.put("/escorts/{request_id}/assign")
async def assign_officer(request_id: str):
    await db.escort_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "assigned",
            "officer_name": "Officer John",
            "officer_photo": None,
            "estimated_wait": 5
        }}
    )
    return {"message": "Officer assigned"}

# ==================== FRIEND WALK ====================

@api_router.post("/friend-walk", response_model=FriendWalk)
async def start_friend_walk(walk: FriendWalkCreate, current_user: dict = Depends(get_current_user)):
    # Check for existing active walk
    existing = await db.friend_walks.find_one({
        "user_id": current_user["id"],
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active Friend Walk")
    
    walk_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    walk_doc = {
        "id": walk_id,
        "user_id": current_user["id"],
        "contact_ids": walk.contact_ids,
        "start_time": start_time,
        "duration_minutes": walk.duration_minutes,
        "end_time": start_time + timedelta(minutes=walk.duration_minutes),
        "current_lat": walk.location_lat,
        "current_lng": walk.location_lng,
        "status": "active"
    }
    await db.friend_walks.insert_one(walk_doc)
    logger.info(f"Friend walk started: {walk_id}")
    return FriendWalk(**walk_doc)

@api_router.get("/friend-walk/active")
async def get_active_friend_walk(current_user: dict = Depends(get_current_user)):
    walk = await db.friend_walks.find_one({
        "user_id": current_user["id"],
        "status": "active"
    }, {"_id": 0})
    return walk

@api_router.put("/friend-walk/{walk_id}/update")
async def update_friend_walk_location(walk_id: str, update: FriendWalkUpdate, current_user: dict = Depends(get_current_user)):
    await db.friend_walks.update_one(
        {"id": walk_id, "user_id": current_user["id"]},
        {"$set": {"current_lat": update.location_lat, "current_lng": update.location_lng}}
    )
    return {"message": "Location updated"}

@api_router.put("/friend-walk/{walk_id}/extend")
async def extend_friend_walk(walk_id: str, minutes: int = 15, current_user: dict = Depends(get_current_user)):
    walk = await db.friend_walks.find_one({"id": walk_id, "user_id": current_user["id"]})
    if not walk:
        raise HTTPException(status_code=404, detail="Friend walk not found")
    
    new_end = walk["end_time"] + timedelta(minutes=minutes)
    await db.friend_walks.update_one(
        {"id": walk_id},
        {"$set": {"end_time": new_end, "duration_minutes": walk["duration_minutes"] + minutes}}
    )
    return {"message": "Walk extended", "new_end_time": new_end}

@api_router.put("/friend-walk/{walk_id}/complete")
async def complete_friend_walk(walk_id: str, current_user: dict = Depends(get_current_user)):
    await db.friend_walks.update_one(
        {"id": walk_id, "user_id": current_user["id"]},
        {"$set": {"status": "completed"}}
    )
    return {"message": "Friend walk completed"}

# ==================== CAMPUS ALERTS ====================

@api_router.get("/alerts", response_model=List[CampusAlert])
async def get_campus_alerts():
    # Primary: read broadcasts from Firestore (written by Dashboard)
    fs = get_firestore_client()
    if fs is not None:
        try:
            docs = (
                fs.collection("broadcasts")
                .order_by("createdAt", direction=firebase_firestore.Query.DESCENDING)
                .limit(50)
                .stream()
            )
            type_map = {
                "emergency": "emergency",
                "advisory": "advisory",
                "information": "info",
                "all_clear": "info",
            }
            result = []
            for doc in docs:
                data = doc.to_dict()
                try:
                    created_at = datetime.fromisoformat(
                        data.get("createdAt", "").replace("Z", "+00:00")
                    )
                except (ValueError, AttributeError):
                    created_at = datetime.utcnow()
                result.append(CampusAlert(
                    id=doc.id,
                    alert_type=type_map.get(data.get("type", "information"), "info"),
                    title=data.get("title", "Campus Alert"),
                    message=data.get("message", ""),
                    created_at=created_at,
                    is_read=False,
                ))
            return result
        except Exception as e:
            logger.error(f"Firestore broadcast read failed, falling back to MongoDB: {e}")

    # Fallback: original MongoDB campus_alerts
    alerts = await db.campus_alerts.find().sort("created_at", -1).to_list(50)
    return [CampusAlert(**alert) for alert in alerts]

@api_router.get("/alerts/{alert_id}", response_model=CampusAlert)
async def get_alert(alert_id: str):
    alert = await db.campus_alerts.find_one({"id": alert_id})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return CampusAlert(**alert)

# ==================== CAMPUS LOCATIONS ====================

@api_router.get("/locations", response_model=List[CampusLocation])
async def get_campus_locations(location_type: Optional[str] = None):
    query = {}
    if location_type:
        query["location_type"] = location_type
    locations = await db.campus_locations.find(query).to_list(100)
    return [CampusLocation(**loc) for loc in locations]

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Seed initial data for the app"""
    
    # Seed campus alerts
    alerts = [
        {
            "id": str(uuid.uuid4()),
            "alert_type": "emergency",
            "title": "Campus Lockdown Drill",
            "message": "This is a scheduled campus lockdown drill. Please follow all standard lockdown procedures. This drill will last approximately 30 minutes.",
            "created_at": datetime.utcnow() - timedelta(hours=2),
            "is_read": False
        },
        {
            "id": str(uuid.uuid4()),
            "alert_type": "advisory",
            "title": "Suspicious Activity Reported",
            "message": "Suspicious activity has been reported near the Science building. Campus security is investigating. Please remain vigilant and report any unusual activity.",
            "created_at": datetime.utcnow() - timedelta(days=1),
            "is_read": False
        },
        {
            "id": str(uuid.uuid4()),
            "alert_type": "info",
            "title": "Winter Weather Advisory",
            "message": "Environment Canada has issued a winter storm warning. Classes may be affected. Check your email for updates on campus closures.",
            "created_at": datetime.utcnow() - timedelta(days=2),
            "is_read": False
        }
    ]
    
    # Clear existing alerts and add new ones
    await db.campus_alerts.delete_many({})
    await db.campus_alerts.insert_many(alerts)
    
    # Seed campus locations
    locations = [
        {"id": str(uuid.uuid4()), "name": "Acadia Security Office", "description": "Main campus security headquarters. Open 24/7.", "location_type": "security_office", "lat": 45.0875, "lng": -64.3665},
        {"id": str(uuid.uuid4()), "name": "BAC Emergency Phone", "description": "Emergency phone outside Beveridge Arts Centre", "location_type": "emergency_phone", "lat": 45.0880, "lng": -64.3670},
        {"id": str(uuid.uuid4()), "name": "Library Emergency Phone", "description": "Emergency phone at main library entrance", "location_type": "emergency_phone", "lat": 45.0870, "lng": -64.3660},
        {"id": str(uuid.uuid4()), "name": "SUB Emergency Phone", "description": "Emergency phone at Student Union Building", "location_type": "emergency_phone", "lat": 45.0885, "lng": -64.3675},
        {"id": str(uuid.uuid4()), "name": "Patterson Hall AED", "description": "AED located in main lobby of Patterson Hall", "location_type": "aed", "lat": 45.0865, "lng": -64.3655},
        {"id": str(uuid.uuid4()), "name": "Library AED", "description": "AED located at library front desk", "location_type": "aed", "lat": 45.0871, "lng": -64.3661},
        {"id": str(uuid.uuid4()), "name": "Athletic Centre AED", "description": "AED located at athletic centre entrance", "location_type": "aed", "lat": 45.0860, "lng": -64.3680},
        {"id": str(uuid.uuid4()), "name": "Library", "description": "Vaughan Memorial Library - 24/7 access during exams", "location_type": "safe_building", "lat": 45.0870, "lng": -64.3660},
        {"id": str(uuid.uuid4()), "name": "Student Union Building", "description": "SUB - Open until midnight daily", "location_type": "safe_building", "lat": 45.0885, "lng": -64.3675},
        {"id": str(uuid.uuid4()), "name": "KC Irving Centre", "description": "Environmental Science Centre - Card access after hours", "location_type": "safe_building", "lat": 45.0878, "lng": -64.3668},
        {"id": str(uuid.uuid4()), "name": "Main Parking Lot", "description": "Main campus parking - Well lit, security patrols", "location_type": "parking", "lat": 45.0882, "lng": -64.3658},
        {"id": str(uuid.uuid4()), "name": "Residence Parking", "description": "Residence parking lot - Permit required", "location_type": "parking", "lat": 45.0868, "lng": -64.3672}
    ]
    
    await db.campus_locations.delete_many({})
    await db.campus_locations.insert_many(locations)
    
    return {"message": "Data seeded successfully", "alerts": len(alerts), "locations": len(locations)}

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Acadia Safe API", "status": "healthy"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
