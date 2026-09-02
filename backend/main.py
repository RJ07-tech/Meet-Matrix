import os
import uuid
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api

app = FastAPI(title="MeetMatrix Backend API")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production me aap apni Vercel URL specify kar sakte hain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LiveKit Credentials from Environment
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "https://meetmatrix-xxxxxx.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret")

# In-Memory Databases
room_settings_db: Dict[str, Dict[str, Any]] = {}
scheduled_meetings_db: Dict[str, Dict[str, Any]] = {}
waiting_room_db: Dict[str, List[Dict[str, Any]]] = {}  # { room_name: [ {participant_id, name, status} ] }

# --- Pydantic Request Models ---

class TokenRequest(BaseModel):
    room_name: str
    participant_name: str
    is_host: bool = False
    role: Optional[str] = "participant"

class RoomConfig(BaseModel):
    room_id: Optional[str] = None
    waiting_mode: str = "direct"
    chat_locked: bool = False
    allow_participant_screenshare: bool = False
    allow_direct_chat: bool = False
    mute_on_entry: bool = False
    camera_off_on_entry: bool = False
    allow_whiteboard: bool = False
    allow_reactions: bool = False

class AdmitRequest(BaseModel):
    room_name: str
    participant_id: str
    action: str  # "admit" or "reject"

class KickRequest(BaseModel):
    room_name: str
    participant_identity: str

class TerminateRequest(BaseModel):
    room_name: str


# --- Core Meeting & Token Endpoints ---

@app.post("/api/create-room")
async def create_room(cfg: RoomConfig):
    rid = cfg.room_id if cfg.room_id else f"mm-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    room_settings_db[rid] = {
        "room_id": rid,
        "waiting_mode": cfg.waiting_mode,
        "chat_locked": cfg.chat_locked,
        "allow_participant_screenshare": cfg.allow_participant_screenshare,
        "allow_direct_chat": cfg.allow_direct_chat,
        "mute_on_entry": cfg.mute_on_entry,
        "camera_off_on_entry": cfg.camera_off_on_entry,
        "allow_whiteboard": cfg.allow_whiteboard,
        "allow_reactions": cfg.allow_reactions,
    }
    return {"status": "success", "room_id": rid, "settings": room_settings_db[rid]}

@app.get("/api/room-settings/{room_name}")
async def get_room_settings(room_name: str):
    if room_name in room_settings_db:
        return room_settings_db[room_name]
    # Safe defaults agar room abhi register na hua ho
    return {
        "room_id": room_name,
        "waiting_mode": "direct",
        "chat_locked": False,
        "allow_participant_screenshare": False,
        "allow_direct_chat": False,
        "mute_on_entry": False,
        "camera_off_on_entry": False,
        "allow_whiteboard": False,
        "allow_reactions": False,
    }

@app.post("/api/update-room-settings")
async def update_room_settings(data: Dict[str, Any]):
    rname = data.get("room_name")
    if not rname:
        raise HTTPException(status_code=400, detail="Missing room_name")
    if rname not in room_settings_db:
        room_settings_db[rname] = {}
    room_settings_db[rname].update(data)
    return {"status": "success", "settings": room_settings_db[rname]}

@app.post("/api/get-token")
async def get_token(req: TokenRequest):
    cfg = room_settings_db.get(req.room_name, {})
    waiting_mode = cfg.get("waiting_mode", "direct")

    # Strict check: agar participant host nahi hai aur strict approval mode hai
    if waiting_mode == "strict" and not req.is_host:
        # Check if already admitted
        current_list = waiting_room_db.get(req.room_name, [])
        admitted_record = next(
            (p for p in current_list if p.get("name") == req.participant_name and p.get("status") == "admitted"),
            None
        )

        if not admitted_record:
            # Register in waiting lobby
            new_pid = str(uuid.uuid4())
            if req.room_name not in waiting_room_db:
                waiting_room_db[req.room_name] = []

            # Prevent duplicates
            existing = next((p for p in waiting_room_db[req.room_name] if p.get("name") == req.participant_name), None)
            if not existing:
                waiting_room_db[req.room_name].append({
                    "participant_id": new_pid,
                    "name": req.participant_name,
                    "status": "waiting"
                })
            else:
                new_pid = existing["participant_id"]

            return {
                "status": "waiting",
                "participant_id": new_pid,
                "message": "Waiting for host approval"
            }

    # Generate LiveKit Access Token
    try:
        grant = api.VideoGrant(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        )

        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
            .with_identity(f"{req.participant_name}_{uuid.uuid4().hex[:4]}") \
            .with_name(req.participant_name) \
            .with_grants(grant)

        jwt_token = token.to_jwt()

        return {
            "status": "success",
            "token": jwt_token,
            "server_url": LIVEKIT_URL
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Waiting Room Lobby Management ---

@app.get("/api/waiting-list/{room_name}")
async def get_waiting_list(room_name: str):
    pending = [
        p for p in waiting_room_db.get(room_name, [])
        if p.get("status") == "waiting"
    ]
    return {"waiting": pending}

@app.post("/api/admit-participant")
async def admit_participant(req: AdmitRequest):
    r_list = waiting_room_db.get(req.room_name, [])
    for p in r_list:
        if p.get("participant_id") == req.participant_id:
            p["status"] = "admitted" if req.action == "admit" else "rejected"
            return {"status": "success", "action": req.action}
    raise HTTPException(status_code=404, detail="Participant not found in waiting lobby")

@app.get("/api/check-admission/{room_name}/{participant_id}")
async def check_admission(room_name: str, participant_id: str):
    r_list = waiting_room_db.get(room_name, [])
    for p in r_list:
        if p.get("participant_id") == participant_id:
            return {"status": p.get("status", "waiting")}
    return {"status": "not_found"}


# --- Meeting Scheduling Endpoints ---

@app.post("/api/schedule-meeting")
async def schedule_meeting(data: Dict[str, Any]):
    rid = data.get("room_id") or f"mm-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    data["room_id"] = rid
    scheduled_meetings_db[rid] = data

    # Pre-register room settings so direct link / scheduled start works seamlessly
    room_settings_db[rid] = {
        "room_id": rid,
        "waiting_mode": data.get("waiting_mode", "direct"),
        "chat_locked": data.get("chat_locked", False),
        "allow_participant_screenshare": data.get("allow_participant_screenshare", False),
        "allow_direct_chat": data.get("allow_direct_chat", False),
        "allow_whiteboard": data.get("allow_whiteboard", False),
        "allow_reactions": data.get("allow_reactions", False),
    }
    return {"status": "success", "room_id": rid, "meeting": data}

@app.get("/api/scheduled-meetings")
async def list_scheduled_meetings():
    return {"meetings": list(scheduled_meetings_db.values())}

@app.delete("/api/scheduled-meetings/{room_id}")
async def delete_scheduled_meeting(room_id: str):
    if room_id in scheduled_meetings_db:
        del scheduled_meetings_db[room_id]
        return {"status": "deleted"}
    return {"status": "not_found"}


# --- Moderation & Room Lifecycle ---

@app.post("/api/kick-participant")
async def kick_participant(req: KickRequest):
    try:
        lk_api = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await lk_api.room.remove_participant(
            api.RoomParticipantIdentity(
                room=req.room_name,
                identity=req.participant_identity
            )
        )
        await lk_api.aclose()
        return {"status": "success", "message": "Participant removed from LiveKit room"}
    except Exception as e:
        # Fallback agar participant already disconnect ho chuka ho
        return {"status": "acknowledged", "detail": str(e)}

@app.post("/api/terminate-room")
async def terminate_room(req: TerminateRequest):
    try:
        lk_api = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await lk_api.room.delete_room(api.DeleteRoomRequest(room=req.room_name))
        await lk_api.aclose()
    except Exception as e:
        print(f"Room delete error (or already closed): {e}")

    # Cleanup backend memory
    if req.room_name in room_settings_db:
        del room_settings_db[req.room_name]
    if req.room_name in waiting_room_db:
        del waiting_room_db[req.room_name]

    return {"status": "terminated"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}