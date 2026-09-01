import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api

app = FastAPI(title="MeetMatrix Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LIVEKIT_API_KEY = "API5gebW5oiHEeP"
LIVEKIT_API_SECRET = "WUzLWNzVmCd4QmnJf9THhR11oKfcp1eghJp24IOG0RwA"
# Use explicit 127.0.0.1 instead of localhost for WebRTC handshake
LIVEKIT_URL = "wss://meet-matrix-596bpvlh.livekit.cloud"

class TokenRequest(BaseModel):
    room_name: str
    participant_name: str
    is_host: bool = False

@app.get("/")
def root():
    return {"message": "MeetMatrix Backend is Live!"}

@app.post("/api/create-room")
def create_room():
    room_id = str(uuid.uuid4())[:8]
    return {"room_id": room_id}

@app.post("/api/get-token")
def get_token(req: TokenRequest):
    try:
        # Generate token with full join permissions
        grant = api.VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        )
        token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(req.participant_name)
            .with_name(req.participant_name)
            .with_grants(grant)
        )

        return {
            "token": token.to_jwt(),
            "server_url": LIVEKIT_URL
        }
    except Exception as e:
        print(f"Token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))