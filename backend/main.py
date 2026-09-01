import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api

app = FastAPI()

# Enable CORS for all incoming requests (Vercel, localhost, mobile)
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

class RoomRequest(BaseModel):
    participant_name: str
    room_name: str | None = None

@app.get("/")
def health_check():
    return {"status": "ok", "message": "MeetMatrix Backend is Live!"}

@app.post("/api/create-room")
def create_room(req: RoomRequest):
    room_id = str(uuid.uuid4())[:8]
    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(req.participant_name)
        .with_name(req.participant_name)
        .with_grants(api.VideoGrants(room_join=True, room=room_id, can_publish=True, can_subscribe=True))
        .to_jwt()
    )
    return {"token": token, "server_url": LIVEKIT_URL, "room_name": room_id}

@app.post("/api/join-room")
def join_room(req: RoomRequest):
    if not req.room_name:
        raise HTTPException(status_code=400, detail="Room name is required")
    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(req.participant_name)
        .with_name(req.participant_name)
        .with_grants(api.VideoGrants(room_join=True, room=req.room_name, can_publish=True, can_subscribe=True))
        .to_jwt()
    )
    return {"token": token, "server_url": LIVEKIT_URL, "room_name": req.room_name}