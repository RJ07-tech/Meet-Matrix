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

# In-Memory Storage for Attendance & Room Metadata
# Structure: { room_id: [ {"name": str, "join_time": datetime, "leave_time": Optional[datetime]} ] }
attendance_db: Dict[str, List[Dict]] = {}
room_settings: Dict[str, Dict] = {}

class TokenRequest(BaseModel):
    room_name: str
    participant_name: str
    is_host: bool = False
    role: Optional[str] = "participant" # host, co-host, participant

class AttendanceRecord(BaseModel):
    room_name: str
    participant_name: str
    action: str # "join" or "leave"

@app.get("/")
def health_check():
    return {"status": "ok", "service": "MeetMatrix Core Backend"}

# Module 1: Anti-Brute Force UUIDv4 Room Generation
@app.post("/api/create-room")
def create_room():
    room_id = f"mm-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:4]}"
    room_settings[room_id] = {
        "created_at": datetime.utcnow().isoformat(),
        "chat_locked": False,
        "room_locked": False,
        "waiting_mode": "direct" # strict, open, direct
    }
    attendance_db[room_id] = []
    return {"room_id": room_id}

# Module 2 & 5: LiveKit Token Generation with Granular Permissions
@app.post("/api/get-token")
def get_token(req: TokenRequest):
    try:
        grants = api.VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
            room_admin=req.is_host or req.role == "co-host",
            room_record=req.is_host
        )

        token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(f"{req.participant_name}_{uuid.uuid4().hex[:4]}")
            .with_name(req.participant_name)
            .with_metadata(f'{{"role": "{req.role}"}}')
            .with_ttl(timedelta(hours=6))
            .with_grants(grants)
            .to_jwt()
        )

        # Track Attendance Join
        if req.room_name not in attendance_db:
            attendance_db[req.room_name] = []

        attendance_db[req.room_name].append({
            "name": req.participant_name,
            "join_time": datetime.utcnow(),
            "leave_time": None
        })

        return {"token": token, "server_url": LIVEKIT_URL}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Module 6: Attendance Logging & CSV Export
@app.post("/api/attendance/leave")
def log_leave(data: AttendanceRecord):
    records = attendance_db.get(data.room_name, [])
    for rec in reversed(records):
        if rec["name"] == data.participant_name and rec["leave_time"] is None:
            rec["leave_time"] = datetime.utcnow()
            break
    return {"status": "recorded"}

@app.get("/api/attendance/export/{room_name}")
def export_attendance(room_name: str):
    records = attendance_db.get(room_name, [])
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Participant Name", "Join Time (UTC)", "Leave Time (UTC)", "Total Duration (Minutes)"])

    for r in records:
        join_str = r["join_time"].strftime("%Y-%m-%d %H:%M:%S")
        leave_str = r["leave_time"].strftime("%Y-%m-%d %H:%M:%S") if r["leave_time"] else "Active/Abrupt Exit"

        if r["leave_time"]:
            duration = round((r["leave_time"] - r["join_time"]).total_seconds() / 60, 2)
        else:
            duration = "N/A"

        writer.writerow([r["name"], join_str, leave_str, duration])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance-{room_name}.csv"}
    )