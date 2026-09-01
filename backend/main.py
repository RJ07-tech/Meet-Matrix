import os
import uuid
import csv
import io
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api

app = FastAPI(title="MeetMatrix Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://meet-matrix-596bpvlh.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "API5gebW5oiHEeP")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "WUzLWNzVmCd4QmnJf9THhR11oKfcp1eghJp24IOG0RwA")

active_rooms: Dict[str, Dict] = {}
attendance_db: Dict[str, List[Dict]] = {}
waiting_rooms: Dict[str, List[Dict]] = {}

class CreateRoomRequest(BaseModel):
    waiting_mode: str = "direct"  # "strict", "open", "direct"
    chat_locked: bool = False
    allow_participant_screenshare: bool = True

class UpdateSettingsRequest(BaseModel):
    room_name: str
    chat_locked: Optional[bool] = None
    allow_participant_screenshare: Optional[bool] = None
    waiting_mode: Optional[str] = None

class TokenRequest(BaseModel):
    room_name: str
    participant_name: str
    is_host: bool = False
    role: Optional[str] = "participant"

class AdmitActionRequest(BaseModel):
    room_name: str
    participant_id: str
    action: str

class TerminateRequest(BaseModel):
    room_name: str

class LeaveRequest(BaseModel):
    room_name: str
    participant_name: str

@app.get("/")
def health_check():
    return {"status": "ok", "service": "MeetMatrix Core Backend"}

@app.post("/api/create-room")
def create_room(config: CreateRoomRequest):
    room_id = f"mm-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    active_rooms[room_id] = {
        "created_at": datetime.utcnow().isoformat(),
        "waiting_mode": config.waiting_mode,
        "chat_locked": config.chat_locked,
        "allow_participant_screenshare": config.allow_participant_screenshare,
        "is_active": True
    }
    attendance_db[room_id] = []
    waiting_rooms[room_id] = []
    return {"room_id": room_id, "config": active_rooms[room_id]}

@app.get("/api/room-settings/{room_name}")
def get_room_settings(room_name: str):
    if room_name not in active_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    return active_rooms[room_name]

@app.post("/api/update-room-settings")
def update_room_settings(req: UpdateSettingsRequest):
    if req.room_name not in active_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    if req.chat_locked is not None:
        active_rooms[req.room_name]["chat_locked"] = req.chat_locked
    if req.allow_participant_screenshare is not None:
        active_rooms[req.room_name]["allow_participant_screenshare"] = req.allow_participant_screenshare
    if req.waiting_mode is not None:
        active_rooms[req.room_name]["waiting_mode"] = req.waiting_mode
    return {"status": "updated", "config": active_rooms[req.room_name]}

@app.post("/api/get-token")
def get_token(req: TokenRequest):
    if req.room_name not in active_rooms or not active_rooms[req.room_name]["is_active"]:
        raise HTTPException(status_code=404, detail="Invalid Room Code or Meeting has ended.")

    room_conf = active_rooms[req.room_name]
    p_id = str(uuid.uuid4())[:8]

    if room_conf["waiting_mode"] in ["strict", "open"] and not req.is_host:
        existing = next((p for p in waiting_rooms[req.room_name] if p["name"] == req.participant_name and p["status"] == "admitted"), None)
        if not existing:
            waiting_rooms[req.room_name].append({
                "participant_id": p_id,
                "name": req.participant_name,
                "status": "waiting"
            })
            return {"status": "waiting", "participant_id": p_id, "waiting_mode": room_conf["waiting_mode"]}

    try:
        grants = api.VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
            room_admin=req.is_host,
            room_record=req.is_host
        )

        token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(f"{req.participant_name}_{p_id}")
            .with_name(req.participant_name)
            .with_metadata(f'{{"role": "{req.role}", "is_host": {str(req.is_host).lower()}}}')
            .with_ttl(timedelta(hours=6))
            .with_grants(grants)
            .to_jwt()
        )

        attendance_db[req.room_name].append({
            "name": req.participant_name,
            "join_time": datetime.utcnow(),
            "leave_time": None
        })

        return {"status": "joined", "token": token, "server_url": LIVEKIT_URL, "config": room_conf}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/waiting-list/{room_name}")
def get_waiting_list(room_name: str):
    return {"waiting": [p for p in waiting_rooms.get(room_name, []) if p["status"] == "waiting"]}

@app.get("/api/check-admission/{room_name}/{participant_id}")
def check_admission(room_name: str, participant_id: str):
    p = next((x for x in waiting_rooms.get(room_name, []) if x["participant_id"] == participant_id), None)
    if not p:
        return {"status": "not_found"}
    return {"status": p["status"]}

@app.post("/api/admit-participant")
def admit_participant(req: AdmitActionRequest):
    if req.room_name in waiting_rooms:
        for p in waiting_rooms[req.room_name]:
            if p["participant_id"] == req.participant_id:
                p["status"] = "admitted" if req.action == "admit" else "rejected"
                return {"status": "success", "action": req.action}
    raise HTTPException(status_code=404, detail="Participant not found")

@app.post("/api/leave-room")
def leave_room(req: LeaveRequest):
    records = attendance_db.get(req.room_name, [])
    for rec in reversed(records):
        if rec["name"] == req.participant_name and rec["leave_time"] is None:
            rec["leave_time"] = datetime.utcnow()
            break
    return {"status": "left"}

@app.post("/api/terminate-room")
async def terminate_room(req: TerminateRequest):
    if req.room_name in active_rooms:
        active_rooms[req.room_name]["is_active"] = False
        try:
            lk_client = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            await lk_client.room.delete_room(api.DeleteRoomRequest(room=req.room_name))
            await lk_client.aclose()
        except Exception as e:
            print("LiveKit room deletion:", str(e))
        return {"status": "terminated"}
    raise HTTPException(status_code=404, detail="Room not found")

@app.get("/api/attendance/export/{room_name}")
def export_attendance(room_name: str):
    records = attendance_db.get(room_name, [])
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Participant Name", "Join Time (UTC)", "Leave Time (UTC)", "Total Duration (Minutes)"])
    for r in records:
        join_str = r["join_time"].strftime("%Y-%m-%d %H:%M:%S")
        leave_str = r["leave_time"].strftime("%Y-%m-%d %H:%M:%S") if r["leave_time"] else "Active/Terminated"
        duration = round((r["leave_time"] - r["join_time"]).total_seconds() / 60, 2) if r["leave_time"] else "N/A"
        writer.writerow([r["name"], join_str, leave_str, duration])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance-{room_name}.csv"}
    )