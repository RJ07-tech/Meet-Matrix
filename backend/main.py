import os
import uuid
from datetime import timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api

app = FastAPI()

# Allow Vercel frontend and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://meet-matrix.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "*",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
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
    try:
        room_id = str(uuid.uuid4())[:8]
        token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(req.participant_name)
            .with_name(req.participant_name)
            .with_ttl(timedelta(hours=6))
            .with_grants(api.VideoGrants(room_join=True, room=room_id, can_publish=True, can_subscribe=True))
            .to_jwt()
        )
        return {"token": token, "server_url": LIVEKIT_URL, "room_name": room_id}
    except Exception as e:
        print(f"Error in create_room: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/join-room")
def join_room(req: RoomRequest):
    if not req.room_name:
        raise HTTPException(status_code=400, detail="Room name is required")
    try:
        token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(req.participant_name)
            .with_name(req.participant_name)
            .with_ttl(timedelta(hours=6))
            .with_grants(api.VideoGrants(room_join=True, room=req.room_name, can_publish=True, can_subscribe=True))
            .to_jwt()
        )
        return {"token": token, "server_url": LIVEKIT_URL, "room_name": req.room_name}
    except Exception as e:
        print(f"Error in join_room: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))