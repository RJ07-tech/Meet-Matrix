import os
import uuid
import csv
import io
from datetime import datetime
from typing import Optional, Dict, Any, List, Set
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api
from livekit.api import AccessToken, VideoGrants

app = FastAPI(title="MeetMatrix Backend API")

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

# In-memory data structures
room_settings_db: Dict[str, Dict[str, Any]] = {}
scheduled_meetings_db: Dict[str, Dict[str, Any]] = {}
waiting_room_db: Dict[str, List[Dict[str, Any]]] = {}
banned_participants_db: Dict[str, Set[str]] = {}

# Attendance tracker: { room_name: [ { name, identity, join_time, leave_time, was_on_hold } ] }
attendance_db: Dict[str, List[Dict[str, Any]]] = {}

class TokenRequest(BaseModel):
    room_name: str
    participant_name: str
    is_host: bool = False
    role: Optional[str] = "participant"

class RoomConfig(BaseModel):
    room_id: Optional[str] = None
    waiting_mode: str = "direct"
    chat_locked: bool = False
    mic_locked: bool = False  # Permanent Mic Lock
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

class AttendanceUpdateRequest(BaseModel):
    room_name: str
    participant_name: str
    participant_identity: Optional[str] = None
    was_on_hold: Optional[bool] = False
    action: str  # "join", "leave", "hold_update"


@app.post("/api/create-room")
async def create_room(cfg: RoomConfig):
    rid = cfg.room_id if cfg.room_id else f"mm-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    room_settings_db[rid] = cfg.dict()
    room_settings_db[rid]["room_id"] = rid
    room_settings_db[rid]["mic_locked"] = cfg.mic_locked
    if rid not in banned_participants_db:
        banned_participants_db[rid] = set()
    if rid not in attendance_db:
        attendance_db[rid] = []
    return {"status": "success", "room_id": rid, "settings": room_settings_db[rid]}


@app.get("/api/room-settings/{room_name}")
async def get_room_settings(room_name: str):
    return room_settings_db.get(room_name, {
        "room_id": room_name,
        "waiting_mode": "direct",
        "chat_locked": False,
        "mic_locked": False,
        "allow_participant_screenshare": False,
        "allow_direct_chat": False,
        "mute_on_entry": False,
        "camera_off_on_entry": False,
        "allow_whiteboard": False,
        "allow_reactions": False,
    })


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
    clean_name = req.participant_name.strip().lower()
    is_banned = clean_name in banned_participants_db.get(req.room_name, set())

    must_wait = (waiting_mode == "strict" or is_banned) and not req.is_host

    if must_wait:
        current_list = waiting_room_db.get(req.room_name, [])
        admitted_record = next(
            (p for p in current_list if p.get("name", "").strip().lower() == clean_name and p.get("status") == "admitted"),
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
                "message": "Waiting for host admission"
            }

    try:
        grants = VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        )

        pid = f"{req.participant_name}_{uuid.uuid4().hex[:4]}"
        token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
            .with_identity(pid) \
            .with_name(req.participant_name) \
            .with_grants(grants)

        jwt_token = token.to_jwt()

        # Track join in attendance
        if req.room_name not in attendance_db:
            attendance_db[req.room_name] = []

        existing_att = next((a for a in attendance_db[req.room_name] if a["name"] == req.participant_name), None)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if not existing_att:
            attendance_db[req.room_name].append({
                "name": req.participant_name,
                "identity": pid,
                "is_host": req.is_host,
                "join_time": now_str,
                "leave_time": "Active",
                "was_on_hold": "No"
            })
        else:
            existing_att["leave_time"] = "Active"

        if req.room_name in banned_participants_db and clean_name in banned_participants_db[req.room_name]:
            banned_participants_db[req.room_name].remove(clean_name)

        return {
            "status": "success",
            "token": jwt_token,
            "server_url": LIVEKIT_URL,
            "mute_on_entry": cfg.get("mute_on_entry", False),
            "camera_off_on_entry": cfg.get("camera_off_on_entry", False),
            "mic_locked": cfg.get("mic_locked", False)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/attendance/update")
async def update_attendance(req: AttendanceUpdateRequest):
    if req.room_name not in attendance_db:
        attendance_db[req.room_name] = []

    records = attendance_db[req.room_name]
    rec = next((r for r in records if r["name"] == req.participant_name), None)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if rec:
        if req.action == "leave":
            rec["leave_time"] = now_str
        elif req.action == "hold_update" and req.was_on_hold:
            rec["was_on_hold"] = "Yes (Detected Away/On-Hold)"
    elif req.action == "join":
        records.append({
            "name": req.participant_name,
            "identity": req.participant_identity or "Unknown",
            "is_host": False,
            "join_time": now_str,
            "leave_time": "Active",
            "was_on_hold": "No"
        })
    return {"status": "success"}


@app.get("/api/attendance/export/{room_name}")
async def export_attendance(room_name: str):
    records = attendance_db.get(room_name, [])
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Meeting Attendance Report", f"Room: {room_name}", f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
    writer.writerow([])
    writer.writerow(["Participant Name", "Role", "Join Time", "Leave Time", "Status / Away Detected"])

    if not records:
        writer.writerow(["No participants recorded", "-", "-", "-", "-"])
    else:
        for r in records:
            role = "Host" if r.get("is_host") else "Participant"
            writer.writerow([
                r.get("name", "Unknown"),
                role,
                r.get("join_time", "-"),
                r.get("leave_time", "Active"),
                r.get("was_on_hold", "No")
            ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance-{room_name}.csv"}
    )


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
            if req.action == "admit" and req.room_name in banned_participants_db:
                banned_participants_db[req.room_name].discard(p.get("name", "").strip().lower())
            return {"status": "success", "action": req.action}
    raise HTTPException(status_code=404, detail="Participant not found")


@app.get("/api/check-admission/{room_name}/{participant_id}")
async def check_admission(room_name: str, participant_id: str):
    r_list = waiting_room_db.get(room_name, [])
    for p in r_list:
        if p.get("participant_id") == participant_id:
            return {"status": p.get("status", "waiting")}
    return {"status": "not_found"}


@app.post("/api/schedule-meeting")
async def schedule_meeting(data: Dict[str, Any]):
    rid = data.get("room_id") or f"mm-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    data["room_id"] = rid
    scheduled_meetings_db[rid] = data
    room_settings_db[rid] = {
        "room_id": rid,
        "waiting_mode": data.get("waiting_mode", "direct"),
        "chat_locked": data.get("chat_locked", False),
        "mic_locked": data.get("mic_locked", False),
        "allow_participant_screenshare": data.get("allow_participant_screenshare", False),
        "allow_direct_chat": data.get("allow_direct_chat", False),
        "allow_whiteboard": data.get("allow_whiteboard", False),
        "allow_reactions": data.get("allow_reactions", False),
        "mute_on_entry": data.get("mute_on_entry", False),
        "camera_off_on_entry": data.get("camera_off_on_entry", False),
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


@app.post("/api/kick-participant")
async def kick_participant(req: KickRequest):
    if req.room_name not in banned_participants_db:
        banned_participants_db[req.room_name] = set()

    clean_target = (req.participant_name or "").replace("(Host)", "").replace("(Co-Host)", "").strip().lower()
    if clean_target:
        banned_participants_db[req.room_name].add(clean_target)

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
    banned_participants_db.pop(req.room_name, None)
    return {"status": "terminated"}


@app.get("/health")
async def health():
    return {"status": "healthy"}