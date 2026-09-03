import os
import uuid
from typing import Optional, Dict, Any, List, Set
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api
from livekit.api import AccessToken, VideoGrants

app = FastAPI(title="MeetMatrix Backend High-Performance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "https://meetmatrix-xxxxxx.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret")

room_settings_db: Dict[str, Dict[str, Any]] = {}
scheduled_meetings_db: Dict[str, Dict[str, Any]] = {}
waiting_room_db: Dict[str, List[Dict[str, Any]]] = {}
kicked_participants_db: Dict[str, Set[str]] = {}

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
    action: str

class KickRequest(BaseModel):
    room_name: str
    participant_identity: str
    participant_name: Optional[str] = None

class TerminateRequest(BaseModel):
    room_name: str

class LeaveRequest(BaseModel):
    room_name: str
    participant_name: str

@app.post("/api/create-room")
async def create_room(cfg: RoomConfig):
    rid = cfg.room_id if cfg.room_id else f"mm-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    room_settings_db[rid] = cfg.dict()
    room_settings_db[rid]["room_id"] = rid
    if rid not in kicked_participants_db:
        kicked_participants_db[rid] = set()
    return {"status": "success", "room_id": rid, "settings": room_settings_db[rid]}

@app.get("/api/room-settings/{room_name}")
async def get_room_settings(room_name: str):
    if room_name in room_settings_db:
        return room_settings_db[room_name]
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

    clean_name = req.participant_name.replace("(Host)", "").replace("(Co-Host)", "").strip().lower()
    is_banned = clean_name in kicked_participants_db.get(req.room_name, set())

    # Point 1 & 2: Strict ya Open me admission zaruri hai, aur banned user kabhi direct join nahi ho sakta
    must_wait = (waiting_mode in ["strict", "open"] or is_banned) and not req.is_host

    if must_wait:
        current_list = waiting_room_db.get(req.room_name, [])
        admitted_record = next(
            (p for p in current_list if p.get("name", "").replace("(Host)", "").replace("(Co-Host)", "").strip().lower() == clean_name and p.get("status") == "admitted"),
            None
        )

        if not admitted_record:
            new_pid = str(uuid.uuid4())
            if req.room_name not in waiting_room_db:
                waiting_room_db[req.room_name] = []

            existing = next((p for p in waiting_room_db[req.room_name] if p.get("name", "").strip().lower() == clean_name), None)
            if not existing:
                waiting_room_db[req.room_name].append({
                    "participant_id": new_pid,
                    "name": req.participant_name,
                    "status": "waiting"
                })
            else:
                new_pid = existing["participant_id"]
                existing["status"] = "waiting"

            return {
                "status": "waiting",
                "participant_id": new_pid,
                "message": "Host approval required"
            }

    try:
        grants = VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        )

        token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
            .with_identity(f"{req.participant_name}_{uuid.uuid4().hex[:4]}") \
            .with_name(req.participant_name) \
            .with_grants(grants)

        jwt_token = token.to_jwt()

        if req.room_name in kicked_participants_db and clean_name in kicked_participants_db[req.room_name]:
            kicked_participants_db[req.room_name].remove(clean_name)

        return {
            "status": "success",
            "token": jwt_token,
            "server_url": LIVEKIT_URL
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
            if req.action == "admit" and req.room_name in kicked_participants_db:
                kicked_participants_db[req.room_name].discard(p.get("name", "").strip().lower())
            return {"status": "success", "action": req.action}
    raise HTTPException(status_code=404, detail="Participant not found")

@app.get("/api/check-admission/{room_name}/{participant_id}")
async def check_admission(room_name: str, participant_id: str):
    r_list = waiting_room_db.get(room_name, [])
    for p in r_list:
        if p.get("participant_id") == participant_id:
            return {"status": p.get("status", "waiting")}
    return {"status": "not_found"}

# Invalidate admission when participant leaves or gets kicked
@app.post("/api/participant-leave")
async def participant_leave(req: LeaveRequest):
    clean = req.participant_name.replace("(Host)", "").replace("(Co-Host)", "").strip().lower()
    if req.room_name in waiting_room_db:
        for p in waiting_room_db[req.room_name]:
            if p.get("name", "").strip().lower() == clean:
                p["status"] = "waiting"
    return {"status": "cleared"}

@app.post("/api/kick-participant")
async def kick_participant(req: KickRequest):
    if req.room_name not in kicked_participants_db:
        kicked_participants_db[req.room_name] = set()

    clean_target = (req.participant_name or "").replace("(Host)", "").replace("(Co-Host)", "").strip().lower()
    if clean_target:
        kicked_participants_db[req.room_name].add(clean_target)

    if req.room_name in waiting_room_db:
        for p in waiting_room_db[req.room_name]:
            if p.get("name", "").strip().lower() == clean_target:
                p["status"] = "rejected"

    try:
        lk_api = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await lk_api.room.remove_participant(
            api.RoomParticipantIdentity(
                room=req.room_name,
                identity=req.participant_identity
            )
        )
        await lk_api.aclose()
        return {"status": "success"}
    except Exception as e:
        return {"status": "acknowledged", "detail": str(e)}

@app.post("/api/terminate-room")
async def terminate_room(req: TerminateRequest):
    try:
        lk_api = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await lk_api.room.delete_room(api.DeleteRoomRequest(room=req.room_name))
        await lk_api.aclose()
    except Exception:
        pass

    room_settings_db.pop(req.room_name, None)
    waiting_room_db.pop(req.room_name, None)
    kicked_participants_db.pop(req.room_name, None)
    return {"status": "terminated"}

@app.get("/health")
async def health():
    return {"status": "healthy"}