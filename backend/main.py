import os
import uuid
from datetime import timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api

app = FastAPI()

# Enable CORS for all domains
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

class TokenRequest(BaseModel):
    room_name: str
    participant_name: str
    is_host: bool = False

@app.get("/")
def health_check():
    return {"status": "ok", "message": "MeetMatrix Backend is Live!"}

@app.post("/api/create-room")
def create_room():
    # 8-character unique room ID
    room_id = str(uuid.uuid4())[:8]
    return {"room_id": room_id}

@app.post("/api/get-token")
def get_token(req: TokenRequest):
    try:
        token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(req.participant_name)
            .with_name(req.participant_name)
            .with_ttl(timedelta(hours=6))
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=req.room_name,
                    can_publish=True,
                    can_subscribe=True,
                    room_admin=req.is_host
                )
            )
            .to_jwt()
        )
        return {"token": token, "server_url": LIVEKIT_URL}
    except Exception as e:
        print(f"Error generating token: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))