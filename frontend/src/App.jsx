import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '@livekit/components-styles';
import {
    LiveKitRoom,
    VideoConference,
    formatChatMessageLinks,
} from '@livekit/components-react';
import {
    Copy, Check, Disc, Square, Download,
    PenTool, Video, Mic, Settings, UserCheck, UserX, Clock
} from 'lucide-react';
import Whiteboard from './Whiteboard';

const BACKEND_URL = 'https://meetmatrix-backend-3l9l.onrender.com';

export default function App() {
    const [inMeeting, setInMeeting] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);
    const [waitingPid, setWaitingPid] = useState(null);
    const [token, setToken] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [roomName, setRoomName] = useState('');
    const [participantName, setParticipantName] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Host Pre-Meeting Settings (Flaw 4)
    const [showSettings, setShowSettings] = useState(false);
    const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
    const [chatLocked, setChatLocked] = useState(false);

    // Host Admit List (Flaw 2)
    const [waitingList, setWaitingList] = useState([]);
    const [showAdmitModal, setShowAdmitModal] = useState(false);

    // In-Meeting Tools
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [floatingEmojis, setFloatingEmojis] = useState([]);

    // Hardware Checks
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [micEnabled, setMicEnabled] = useState(true);
    const videoPreviewRef = useRef(null);
    const previewStreamRef = useRef(null);

    // Local Recording
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    useEffect(() => {
        if (!inMeeting && !isWaiting) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((stream) => {
                    previewStreamRef.current = stream;
                    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
                })
                .catch((err) => console.log("Lobby media error:", err));
        } else {
            if (previewStreamRef.current) {
                previewStreamRef.current.getTracks().forEach(t => t.stop());
            }
        }
    }, [inMeeting, isWaiting]);

    // Polling for Waiting Participant (Flaw 2)
    useEffect(() => {
        let interval;
        if (isWaiting && waitingPid && roomName) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${BACKEND_URL}/api/check-admission/${roomName}/${waitingPid}`);
                    if (res.data.status === 'admitted') {
                        setIsWaiting(false);
                        await joinRoomDirect(roomName, participantName, false);
                    } else if (res.data.status === 'rejected') {
                        alert('Host denied your request to join.');
                        setIsWaiting(false);
                        setWaitingPid(null);
                    }
                } catch (e) {
                    console.error("Poll admission error", e);
                }
            }, 2500);
        }
        return () => clearInterval(interval);
    }, [isWaiting, waitingPid, roomName]);

    // Host Polling Waiting List (Flaw 2)
    useEffect(() => {
        let interval;
        if (inMeeting && isHost) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${BACKEND_URL}/api/waiting-list/${roomName}`);
                    setWaitingList(res.data.waiting || []);
                } catch (e) {
                    console.error("Waiting list poll error", e);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [inMeeting, isHost, roomName]);

    const handleCreateRoom = async () => {
        if (!participantName.trim()) {
            alert('Please enter your name first');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/create-room`, {
                waiting_room_enabled: waitingRoomEnabled,
                chat_locked: chatLocked,
            });
            const newRoomId = res.data.room_id;
            setRoomName(newRoomId);
            setIsHost(true);
            await joinRoomDirect(newRoomId, participantName, true);
        } catch (err) {
            alert('Failed: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Flaw 1: Validating Room Code on Join
    const handleJoinExisting = async (e) => {
        e.preventDefault();
        if (!roomName.trim() || !participantName.trim()) {
            alert('Enter Room Code and Name');
            return;
        }
        setLoading(true);
        try {
            setIsHost(false);
            const res = await axios.post(`${BACKEND_URL}/api/get-token`, {
                room_name: roomName.trim(),
                participant_name: participantName.trim(),
                is_host: false,
            });

            if (res.data.status === 'waiting') {
                setIsWaiting(true);
                setWaitingPid(res.data.participant_id);
            } else {
                setToken(res.data.token);
                setServerUrl(res.data.server_url);
                setInMeeting(true);
            }
        } catch (err) {
            alert(err.response?.data?.detail || 'Invalid Room Code or room has ended.');
        } finally {
            setLoading(false);
        }
    };

    const joinRoomDirect = async (room, name, hostFlag) => {
        const res = await axios.post(`${BACKEND_URL}/api/get-token`, {
            room_name: room,
            participant_name: name,
            is_host: hostFlag,
            role: hostFlag ? "host" : "participant",
        });
        setToken(res.data.token);
        setServerUrl(res.data.server_url);
        setInMeeting(true);
    };

    // Flaw 2: Admit / Reject Actions
    const handleAdmitAction = async (pid, action) => {
        try {
            await axios.post(`${BACKEND_URL}/api/admit-participant`, {
                room_name: roomName,
                participant_id: pid,
                action,
            });
            setWaitingList(prev => prev.filter(p => p.participant_id !== pid));
        } catch (e) {
            alert("Action failed: " + e.message);
        }
    };

    // Flaw 3: Terminate Meeting if Host Leaves
    const handleHostTermination = async () => {
        if (isRecording) stopRecording();
        if (isHost) {
            try {
                await axios.post(`${BACKEND_URL}/api/terminate-room`, { room_name: roomName });
            } catch (e) {
                console.error("Termination error", e);
            }
        }
        setInMeeting(false);
        setToken('');
        setRoomName('');
        setIsHost(false);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: 'screen' }, audio: true });
            recordedChunksRef.current = [];
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `MeetMatrix-${roomName}.webm`;
                a.click();
                setIsRecording(false);
            };
            recorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error(err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
    };

    const triggerReaction = (emoji) => {
        const id = Date.now();
        setFloatingEmojis(prev => [...prev, { id, emoji, left: Math.random() * 80 + 10 }]);
        setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2500);
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomName);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Waiting Screen View
    if (isWaiting) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090d16', color: '#fff', flexDirection: 'column' }}>
                <Clock size={48} color="#38bdf8" style={{ marginBottom: '1rem', animation: 'spin 4s linear infinite' }} />
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Waiting for the host to let you in...</h2>
                <p style={{ color: '#94a3b8' }}>Room: {roomName}</p>
            </div>
        );
    }

    // In-Meeting View
    if (inMeeting && token && serverUrl) {
        return (
            <div style={{ height: '100vh', width: '100vw', background: '#090d16', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Floating Emojis */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999 }}>
                    {floatingEmojis.map(item => (
                        <span key={item.id} style={{ position: 'absolute', bottom: '90px', left: `${item.left}%`, fontSize: '3rem', animation: 'floatUp 2.5s ease-in-out forwards' }}>
              {item.emoji}
            </span>
                    ))}
                </div>

                {/* Top Control Bar */}
                <div style={{ background: '#0f172a', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', zIndex: 1000 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '800', color: '#38bdf8' }}>Meet Matrix</span>
                        <span style={{ color: '#475569' }}>|</span>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Room: <strong>{roomName}</strong></span>
                        {isHost && <span style={{ background: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>HOST</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Host Admit Waiting Room Counter */}
                        {isHost && waitingList.length > 0 && (
                            <button onClick={() => setShowAdmitModal(true)} style={{ ...topBtnStyle, background: '#eab308', color: '#000', fontWeight: 'bold' }}>
                                <Clock size={15} /> Admit Requests ({waitingList.length})
                            </button>
                        )}

                        {/* Emojis */}
                        <div style={{ display: 'flex', gap: '4px', background: '#1e293b', padding: '3px 6px', borderRadius: '8px' }}>
                            {['👍', '❤️', '👏', '🎉', '🔥'].map(emoji => (
                                <button key={emoji} onClick={() => triggerReaction(emoji)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>
                                    {emoji}
                                </button>
                            ))}
                        </div>

                        <button onClick={() => setShowWhiteboard(!showWhiteboard)} style={topBtnStyle}><PenTool size={15} /> Whiteboard</button>
                        <button onClick={isRecording ? stopRecording : startRecording} style={{ ...topBtnStyle, background: isRecording ? '#ef4444' : '#1e293b' }}>
                            {isRecording ? <Square size={15} /> : <Disc size={15} />} {isRecording ? 'Stop Recording' : 'Record'}
                        </button>
                        {isHost && (
                            <button onClick={() => window.open(`${BACKEND_URL}/api/attendance/export/${roomName}`, '_blank')} style={topBtnStyle}>
                                <Download size={15} /> CSV
                            </button>
                        )}
                        <button onClick={copyRoomCode} style={{ ...topBtnStyle, background: copied ? '#10b981' : '#0284c7' }}>
                            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Invite'}
                        </button>
                        {isHost && (
                            <button onClick={handleHostTermination} style={{ ...topBtnStyle, background: '#ef4444' }}>
                                End Meeting for All
                            </button>
                        )}
                    </div>
                </div>

                {/* Admit Modal for Host */}
                {showAdmitModal && isHost && (
                    <div style={{ position: 'fixed', top: '70px', right: '20px', background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155', zIndex: 9999, width: '300px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#38bdf8' }}>Waiting Room Participants</h4>
                        {waitingList.length === 0 ? <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No one waiting</p> : (
                            waitingList.map(p => (
                                <div key={p.participant_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.85rem' }}>{p.name}</span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={() => handleAdmitAction(p.participant_id, 'admit')} style={{ background: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}><UserCheck size={14} /></button>
                                        <button onClick={() => handleAdmitAction(p.participant_id, 'reject')} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}><UserX size={14} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                        <button onClick={() => setShowAdmitModal(false)} style={{ width: '100%', marginTop: '8px', background: '#334155', border: 'none', color: '#fff', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>Close</button>
                    </div>
                )}

                {showWhiteboard && <Whiteboard isHost={isHost} onClose={() => setShowWhiteboard(false)} />}

                {/* LiveKit Video Stage */}
                <div style={{ flex: 1, position: 'relative' }}>
                    <LiveKitRoom
                        video={cameraEnabled}
                        audio={micEnabled}
                        token={token}
                        serverUrl={serverUrl}
                        data-lk-theme="default"
                        style={{ height: '100%' }}
                        onDisconnected={handleHostTermination}
                    >
                        <VideoConference chatMessageFormatter={formatChatMessageLinks} />
                    </LiveKitRoom>
                </div>
            </div>
        );
    }

    // Pre-Join Green Room Lobby with Host Configuration
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #1e293b 0%, #090d16 100%)', fontFamily: 'system-ui, sans-serif', color: '#fff', padding: '20px' }}>
            <div style={{ background: '#131b2e', borderRadius: '20px', width: '100%', maxWidth: '850px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', border: '1px solid #1e293b', overflow: 'hidden' }}>

                {/* Left Side: Video Preview */}
                <div style={{ padding: '2rem', background: '#0c1222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h3 style={{ fontSize: '0.95rem', color: '#94a3b8', marginBottom: '1rem' }}>Green Room Check</h3>
                    <div style={{ width: '100%', height: '220px', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                        <video ref={videoPreviewRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                        <button onClick={() => setCameraEnabled(!cameraEnabled)} style={{ ...toggleBtnStyle, background: cameraEnabled ? '#334155' : '#ef4444' }}>
                            <Video size={16} /> {cameraEnabled ? 'Camera On' : 'Camera Off'}
                        </button>
                        <button onClick={() => setMicEnabled(!micEnabled)} style={{ ...toggleBtnStyle, background: micEnabled ? '#334155' : '#ef4444' }}>
                            <Mic size={16} /> {micEnabled ? 'Mic On' : 'Mic Muted'}
                        </button>
                    </div>
                </div>

                {/* Right Side: Setup & Join */}
                <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#38bdf8', margin: 0 }}>MeetMatrix</h1>
                        <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} title="Host Settings">
                            <Settings size={20} />
                        </button>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Real-Time Video Conferencing</p>

                    {/* Host Pre-Meeting Settings (Flaw 4) */}
                    {showSettings && (
                        <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #1e293b' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '8px' }}>HOST SETTINGS</span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', marginBottom: '6px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={waitingRoomEnabled} onChange={(e) => setWaitingRoomEnabled(e.target.checked)} />
                                Enable Waiting Room (Require Host Approval)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={chatLocked} onChange={(e) => setChatLocked(e.target.checked)} />
                                Lock Chat during meeting
                            </label>
                        </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Your Name</label>
                        <input type="text" placeholder="e.g. Raj" value={participantName} onChange={(e) => setParticipantName(e.target.value)} style={inputStyle} />
                    </div>

                    <button onClick={handleCreateRoom} disabled={loading} style={primaryBtnStyle}>
                        {loading ? 'Starting Meeting...' : '⚡ Create New Meeting'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '1.2rem 0', color: '#475569' }}>
                        <hr style={{ flex: 1, borderColor: '#1e293b' }} />
                        <span style={{ padding: '0 8px', fontSize: '0.75rem' }}>OR JOIN EXISTING</span>
                        <hr style={{ flex: 1, borderColor: '#1e293b' }} />
                    </div>

                    <form onSubmit={handleJoinExisting}>
                        <input type="text" placeholder="Enter Room Code (e.g. mm-xxxx-xxxx)" value={roomName} onChange={(e) => setRoomName(e.target.value)} style={{ ...inputStyle, marginBottom: '0.8rem' }} />
                        <button type="submit" disabled={loading} style={secondaryBtnStyle}>
                            Join Meeting
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

const inputStyle = { width: '100%', padding: '10px 14px', background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };
const primaryBtnStyle = { width: '100%', padding: '12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' };
const secondaryBtnStyle = { width: '100%', padding: '10px', background: 'transparent', border: '1px solid #0284c7', color: '#38bdf8', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' };
const topBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' };
const toggleBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' };