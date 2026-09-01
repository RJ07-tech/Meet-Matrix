import { useState } from 'react';
import axios from 'axios';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  VideoConference,
  formatChatMessageLinks,
} from '@livekit/components-react';
import { Copy, Check } from 'lucide-react';

const BACKEND_URL = 'https://meetmatrix-backend-319l.onrender.com';

export default function App() {
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [roomName, setRoomName] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [loading, setLoading] = useState(false);
  const [inMeeting, setInMeeting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreateRoom = async () => {
    if (!participantName.trim()) {
      alert('Please enter your name first');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/create-room`);
      const newRoomId = res.data.room_id;
      setRoomName(newRoomId);
      await joinRoom(newRoomId, participantName, true);
    } catch (err) {
      alert('Failed to create room: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinExisting = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || !participantName.trim()) {
      alert('Enter both Room Code and your Name');
      return;
    }
    setLoading(true);
    try {
      await joinRoom(roomName, participantName, false);
    } catch (err) {
      alert('Failed to join room: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (room, name, hostFlag) => {
    const res = await axios.post(`${BACKEND_URL}/api/get-token`, {
      room_name: room,
      participant_name: name,
      is_host: hostFlag,
    });
    setToken(res.data.token);
    setServerUrl(res.data.server_url);
    setInMeeting(true);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- YAHAN ADD HOTA HAI YE BLOCK ---
  if (inMeeting && token && serverUrl) {
    return (
        <div style={{ height: '100vh', width: '100vw', background: '#111', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top Meeting Info Bar */}
          <div style={{
            background: '#1e293b',
            color: '#fff',
            padding: '10px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #334155',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>Meet Matrix</span>
              <span style={{ color: '#64748b' }}>|</span>
              <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Room Code: <strong>{roomName}</strong></span>
            </div>

            <button
                onClick={copyRoomCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: copied ? '#16a34a' : '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied Code!' : 'Copy Code'}
            </button>
          </div>

          {/* LiveKit Video Stage */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <LiveKitRoom
                video={true}
                audio={true}
                token={token}
                serverUrl={serverUrl}
                data-lk-theme="default"
                style={{ height: '100%' }}
                onDisconnected={() => {
                  setInMeeting(false);
                  setToken('');
                  setRoomName('');
                }}
            >
              <VideoConference chatMessageFormatter={formatChatMessageLinks} />
            </LiveKitRoom>
          </div>
        </div>
    );
  }

  // Lobby UI (Create/Join Screen)
  return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        fontFamily: 'system-ui, sans-serif',
        color: '#fff'
      }}>
        <div style={{
          background: '#1e293b',
          padding: '2.5rem',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          width: '100%',
          maxWidth: '420px',
          border: '1px solid #334155'
        }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '0.5rem', color: '#38bdf8' }}>
            Meet Matrix
          </h1>
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Real-Time Video Conferencing
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#cbd5e1' }}>
              Your Name
            </label>
            <input
                type="text"
                placeholder="e.g. Raj"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  background: '#0f172a',
                  color: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
            />
          </div>

          <button
              onClick={handleCreateRoom}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.8rem',
                borderRadius: '8px',
                border: 'none',
                background: '#0284c7',
                color: '#fff',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '1.5rem'
              }}
          >
            {loading ? 'Starting...' : 'Create New Meeting'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#64748b' }}>
            <hr style={{ flex: 1, borderColor: '#334155' }} />
            <span style={{ padding: '0 0.5rem', fontSize: '0.8rem' }}>OR JOIN EXISTING</span>
            <hr style={{ flex: 1, borderColor: '#334155' }} />
          </div>

          <form onSubmit={handleJoinExisting}>
            <div style={{ marginBottom: '1rem' }}>
              <input
                  type="text"
                  placeholder="Enter Room Code"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
              />
            </div>
            <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  background: 'transparent',
                  color: '#38bdf8',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
            >
              Join Meeting
            </button>
          </form>
        </div>
      </div>
  );
}