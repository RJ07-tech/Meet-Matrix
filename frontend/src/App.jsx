import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '@livekit/components-styles';
import {
    LiveKitRoom,
    VideoConference,
    formatChatMessageLinks,
} from '@livekit/components-react';
import {
    Copy, Check, Disc, Square, Users, Download,
    Smile, PenTool, Video, Mic, ShieldAlert, MonitorUp
} from 'lucide-react';
import Whiteboard from './Whiteboard';

const BACKEND_URL = 'https://meetmatrix-backend-3l9l.onrender.com';

export default function App() {
    // Navigation & Meeting State
    const [inMeeting, setInMeeting] = useState(false);
    const [token, setToken] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [roomName, setRoomName] = useState('');
    const [participantName, setParticipantName] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Feature Modals
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [floatingEmojis, setFloatingEmojis] = useState([]);

    // Green Room Hardware Previews
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [micEnabled, setMicEnabled] = useState(true);
    const videoPreviewRef = useRef(null);
    const previewStreamRef = useRef(null);

    // Local Recording State (Module 6)
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    // Green Room Preview Initializer
    useEffect(() => {
        if (!inMeeting) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((stream) => {
                    previewStreamRef.current = stream;
                    if (videoPreviewRef.current) {
                        videoPreviewRef.current.srcObject = stream;
                    }
                })
                .catch((err) => console.log("Device access denied in lobby:", err));
        } else {
            if (previewStreamRef.current) {
                previewStreamRef.current.getTracks().forEach(track => track.stop());
            }
        }
    }, [inMeeting]);

    // Module 1: Create Instant Meeting Room
    const handleCreateRoom = async () => {
        if (!participantName.trim()) {
            alert('Please enter your name');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/create-room`);
            const newRoomId = res.data.room_id;
            setRoomName(newRoomId);
            setIsHost(true);
            await joinMeetingRoom(newRoomId, participantName, true);
        } catch (err) {
            alert('Error: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Join Existing Meeting
    const handleJoinExisting = async (e) => {
        e.preventDefault();
        if (!roomName.trim() || !participantName.trim()) {
            alert('Enter Room Code and Name');
            return;
        }
        setLoading(true);
        try {
            setIsHost(false);
            await joinMeetingRoom(roomName, participantName, false);
        } catch (err) {
            alert('Error: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    const joinMeetingRoom = async (room, name, hostFlag) => {
        const res = await axios.post(`${BACKEND_URL}/api/get-token`, {
            room_name: room,
            participant_name: name,
            is_host: hostFlag,
            role: hostFlag ? "host" : "participant"
        });
        setToken(res.data.token);
        setServerUrl(res.data.server_url);
        setInMeeting(true);
    };

    // Module 6: Zero-Cost Client-Side Local Recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' },
                audio: true,
            });

            recordedChunksRef.current = [];
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `MeetMatrix-${roomName}-${Date.now()}.webm`;
                a.click();
                window.URL.revokeObjectURL(url);
                setIsRecording(false);
            };

            recorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Recording start error:", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
    };

    // Module 3: Floating Emoji Reaction Sender
    const triggerReaction = (emoji) => {
        const id = Date.now();
        setFloatingEmojis(prev => [...prev, { id, emoji, left: Math.random() * 80 + 10 }]);
        setTimeout(() => {
            setFloatingEmojis(prev => prev.filter(e => e.id !== id));
        }, 2000);
    };

    // Module 6: Export Attendance
    const downloadAttendance = () => {
        window.open(`${BACKEND_URL}/api/attendance/export/${roomName}`, '_blank');
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomName);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // --- IN-MEETING VIEW ---
    if (inMeeting && token && serverUrl) {
        return (
            <div style={{ height: '100vh', width: '100vw', background: '#090d16', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Top Floating Reaction Canvas */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 99 }}>
                    {floatingEmojis.map(item => (
                        <span key={item.id} style={{
                            position: 'absolute',
                            bottom: '80px',
                            left: `${item.left}%`,
                            fontSize: '2.5rem',
                            animation: 'floatUp 2s ease-in-out forwards',
                        }}>
              {item.emoji}
            </span>
                    ))}
                </div>

                {/* Meeting Header Bar */}
                <div style={{
                    background: '#131b2e',
                    color: '#fff',
                    padding: '10px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #1e293b',
                    zIndex: 10
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: '800', color: '#38bdf8', fontSize: '1.1rem' }}>Meet Matrix</span>
                        <span style={{ color: '#475569' }}>|</span>
                        <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>Room: <strong>{roomName}</strong></span>
                        {isHost && <span style={{ background: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>HOST</span>}
                    </div>

                    {/* Action Tools */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Reactions */}
                        <div style={{ display: 'flex', gap: '4px', background: '#1e293b', padding: '4px 8px', borderRadius: '8px' }}>
                            {['👍', '❤️', '👏', '🎉', '🔥'].map(emoji => (
                                <button key={emoji} onClick={() => triggerReaction(emoji)} style={emojiBtnStyle}>{emoji}</button>
                            ))}
                        </div>

                        {/* Whiteboard Toggle */}
                        <button onClick={() => setShowWhiteboard(!showWhiteboard)} style={toolBtnStyle}>
                            <PenTool size={16} /> Whiteboard
                        </button>

                        {/* Local Recording */}
                        <button onClick={isRecording ? stopRecording : startRecording} style={{ ...toolBtnStyle, background: isRecording ? '#ef4444' : '#1e293b' }}>
                            {isRecording ? <Square size={16} /> : <Disc size={16} />}
                            {isRecording ? 'Stop Recording' : 'Record'}
                        </button>

                        {/* Attendance CSV (Host Only) */}
                        {isHost && (
                            <button onClick={downloadAttendance} style={toolBtnStyle}>
                                <Download size={16} /> Attendance CSV
                            </button>
                        )}

                        {/* Copy Room Link */}
                        <button onClick={copyRoomCode} style={{ ...toolBtnStyle, background: copied ? '#10b981' : '#0284c7' }}>
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Copied' : 'Invite'}
                        </button>
                    </div>
                </div>

                {/* LiveKit Video Stage + Whiteboard Modal */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    {showWhiteboard && (
                        <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 50 }}>
                            <Whiteboard isHost={isHost} />
                        </div>
                    )}

                    <LiveKitRoom
                        video={cameraEnabled}
                        audio={micEnabled}
                        token={token}
                        serverUrl={serverUrl}
                        data-lk-theme="default"
                        style={{ height: '100%' }}
                        onDisconnected={() => {
                            if (isRecording) stopRecording();
                            axios.post(`${BACKEND_URL}/api/attendance/leave`, {
                                room_name: roomName,
                                participant_name: participantName,
                                action: "leave"
                            }).catch(() => {});
                            setInMeeting(false);
                            setToken('');
                        }}
                    >
                        <VideoConference chatMessageFormatter={formatChatMessageLinks} />
                    </LiveKitRoom>
                </div>
            </div>
        );
    }

    // --- MODULE 1: PRE-JOIN GREEN ROOM LOBBY ---
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at top, #1e293b 0%, #090d16 100%)',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#fff',
            padding: '20px'
        }}>
            <div style={{
                background: '#131b2e',
                borderRadius: '20px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                width: '100%',
                maxWidth: '850px',
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                border: '1px solid #1e293b',
                overflow: 'hidden'
            }}>

                {/* Left Side: Green Room Preview */}
                <div style={{ padding: '2rem', background: '#0c1222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h3 style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '1rem' }}>Green Room Device Check</h3>
                    <div style={{ width: '100%', height: '240px', background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                        <video ref={videoPreviewRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    {/* Toggle Mic / Camera state */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
                        <button
                            onClick={() => setCameraEnabled(!cameraEnabled)}
                            style={{ ...toggleBtnStyle, background: cameraEnabled ? '#334155' : '#ef4444' }}
                        >
                            <Video size={18} /> {cameraEnabled ? 'Camera On' : 'Camera Off'}
                        </button>
                        <button
                            onClick={() => setMicEnabled(!micEnabled)}
                            style={{ ...toggleBtnStyle, background: micEnabled ? '#334155' : '#ef4444' }}
                        >
                            <Mic size={18} /> {micEnabled ? 'Mic On' : 'Mic Muted'}
                        </button>
                    </div>
                </div>

                {/* Right Side: Join & Create Forms */}
                <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#38bdf8', marginBottom: '0.2rem' }}>MeetMatrix</h1>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Production Video Conferencing</p>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Display Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Raj"
                            value={participantName}
                            onChange={(e) => setParticipantName(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <button onClick={handleCreateRoom} disabled={loading} style={primaryBtnStyle}>
                        {loading ? 'Initializing SFU...' : '⚡ Instant New Meeting'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '1.2rem 0', color: '#475569' }}>
                        <hr style={{ flex: 1, borderColor: '#1e293b' }} />
                        <span style={{ padding: '0 8px', fontSize: '0.75rem' }}>OR ENTER CODE</span>
                        <hr style={{ flex: 1, borderColor: '#1e293b' }} />
                    </div>

                    <form onSubmit={handleJoinExisting}>
                        <input
                            type="text"
                            placeholder="Enter Room Code"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            style={{ ...inputStyle, marginBottom: '0.8rem' }}
                        />
                        <button type="submit" disabled={loading} style={secondaryBtnStyle}>
                            Join Room
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}

const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: '#090d16',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box'
};

const primaryBtnStyle = {
    width: '100%',
    padding: '12px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer'
};

const secondaryBtnStyle = {
    width: '100%',
    padding: '10px',
    background: 'transparent',
    border: '1px solid #0284c7',
    color: '#38bdf8',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer'
};

const toolBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#1e293b',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: 'pointer'
};

const toggleBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#fff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    cursor: 'pointer'
};

const emojiBtnStyle = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.1rem',
    padding: '2px 4px'
};