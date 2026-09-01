import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '@livekit/components-styles';
import {
    LiveKitRoom,
    GridLayout,
    ParticipantTile,
    useTracks,
    useLocalParticipant,
    RoomAudioRenderer,
    ControlBar,
    Chat,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
    Copy, Check, Disc, Square, Download,
    PenTool, Video, VideoOff, Mic, MicOff, Settings,
    UserCheck, UserX, Clock, MonitorUp, MessageSquare, PhoneOff
} from 'lucide-react';
import Whiteboard from './Whiteboard';

const BACKEND_URL = 'https://meetmatrix-backend-3l9l.onrender.com';

// Sub-Component: Custom In-Meeting Stage with Bottom Controls & Responsive Layout
function MeetingStage({ roomName, isHost, participantName, onLeave, showWhiteboard, setShowWhiteboard }) {
    const { localParticipant } = useLocalParticipant();
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    // Fetch all audio/video tracks for grid
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    const toggleMic = async () => {
        if (localParticipant) {
            await localParticipant.setMicrophoneEnabled(isMicMuted);
            setIsMicMuted(!isMicMuted);
        }
    };

    const toggleVideo = async () => {
        if (localParticipant) {
            await localParticipant.setCameraEnabled(isVideoMuted);
            setIsVideoMuted(!isVideoMuted);
        }
    };

    const toggleScreenShare = async () => {
        if (localParticipant) {
            const nextState = !isScreenSharing;
            await localParticipant.setScreenShareEnabled(nextState);
            setIsScreenSharing(nextState);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>
            <RoomAudioRenderer />

            {/* Main Grid View & Chat Sidebar */}
            <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
                <div style={{ flex: 1, height: '100%', width: '100%' }}>
                    <GridLayout tracks={tracks} style={{ height: '100%', width: '100%', objectFit: 'contain' }}>
                        <ParticipantTile />
                    </GridLayout>
                </div>

                {showChat && (
                    <div style={{ width: '320px', maxWidth: '85vw', background: '#0f172a', borderLeft: '1px solid #1e293b', height: '100%', zIndex: 50 }}>
                        <Chat />
                    </div>
                )}
            </div>

            {/* Bottom Responsive Control Bar */}
            <div style={{
                background: '#0f172a',
                borderTop: '1px solid #1e293b',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                zIndex: 100,
                flexWrap: 'wrap'
            }}>
                {/* Mic Toggle */}
                <button onClick={toggleMic} style={{ ...controlBtn, background: isMicMuted ? '#ef4444' : '#1e293b' }}>
                    {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    <span className="btn-label">{isMicMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                {/* Video Toggle */}
                <button onClick={toggleVideo} style={{ ...controlBtn, background: isVideoMuted ? '#ef4444' : '#1e293b' }}>
                    {isVideoMuted ? <VideoOff size={18} /> : <Video size={18} />}
                    <span className="btn-label">{isVideoMuted ? 'Start Video' : 'Stop Video'}</span>
                </button>

                {/* Screen Share */}
                <button onClick={toggleScreenShare} style={{ ...controlBtn, background: isScreenSharing ? '#0284c7' : '#1e293b' }}>
                    <MonitorUp size={18} />
                    <span className="btn-label">{isScreenSharing ? 'Sharing' : 'Share'}</span>
                </button>

                {/* Whiteboard */}
                <button onClick={() => setShowWhiteboard(!showWhiteboard)} style={controlBtn}>
                    <PenTool size={18} />
                    <span className="btn-label">Whiteboard</span>
                </button>

                {/* Chat */}
                <button onClick={() => setShowChat(!showChat)} style={{ ...controlBtn, background: showChat ? '#0284c7' : '#1e293b' }}>
                    <MessageSquare size={18} />
                    <span className="btn-label">Chat</span>
                </button>

                {/* Local Recording */}
                <button onClick={isRecording ? stopRecording : startRecording} style={{ ...controlBtn, background: isRecording ? '#ef4444' : '#1e293b' }}>
                    {isRecording ? <Square size={18} /> : <Disc size={18} />}
                    <span className="btn-label">{isRecording ? 'Recording' : 'Record'}</span>
                </button>

                {/* Leave/End */}
                <button onClick={onLeave} style={{ ...controlBtn, background: '#ef4444', color: '#fff' }}>
                    <PhoneOff size={18} />
                    <span className="btn-label">{isHost ? 'End All' : 'Leave'}</span>
                </button>
            </div>
        </div>
    );
}

// Master App Component
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

    // Extended Host Settings
    const [showSettings, setShowSettings] = useState(false);
    const [waitingMode, setWaitingMode] = useState('direct'); // "strict", "open", "direct"
    const [chatLocked, setChatLocked] = useState(false);
    const [screenshareLocked, setScreenshareLocked] = useState(false);

    // Host Waiting List
    const [waitingList, setWaitingList] = useState([]);
    const [showAdmitModal, setShowAdmitModal] = useState(false);

    // Modals
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [floatingEmojis, setFloatingEmojis] = useState([]);

    // Green Room Preview
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [micEnabled, setMicEnabled] = useState(true);
    const videoPreviewRef = useRef(null);
    const previewStreamRef = useRef(null);

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

    // Polling for Waiting Participant
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
                    console.error(e);
                }
            }, 2500);
        }
        return () => clearInterval(interval);
    }, [isWaiting, waitingPid, roomName]);

    // Host Polling Waiting List
    useEffect(() => {
        let interval;
        if (inMeeting && isHost) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${BACKEND_URL}/api/waiting-list/${roomName}`);
                    setWaitingList(res.data.waiting || []);
                } catch (e) {
                    console.error(e);
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
                waiting_mode: waitingMode,
                chat_locked: chatLocked,
                screenshare_locked: screenshareLocked
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
            alert(err.response?.data?.detail || 'Invalid Room Code');
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

    const handleHostTermination = async () => {
        if (isHost) {
            try {
                await axios.post(`${BACKEND_URL}/api/terminate-room`, { room_name: roomName });
            } catch (e) {
                console.error(e);
            }
        }
        setInMeeting(false);
        setToken('');
        setRoomName('');
        setIsHost(false);
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

    if (isWaiting) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090d16', color: '#fff', flexDirection: 'column', padding: '20px', textAlign: 'center' }}>
                <Clock size={48} color="#38bdf8" style={{ marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Waiting for host approval...</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Room Code: {roomName}</p>
            </div>
        );
    }

    // Active Meeting View
    if (inMeeting && token && serverUrl) {
        return (
            <div style={{ height: '100vh', width: '100vw', background: '#090d16', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Floating Emojis */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999 }}>
                    {floatingEmojis.map(item => (
                        <span key={item.id} style={{ position: 'absolute', bottom: '90px', left: `${item.left}%`, fontSize: '2.5rem', animation: 'floatUp 2.5s ease-in-out forwards' }}>
              {item.emoji}
            </span>
                    ))}
                </div>

                {/* Top Header */}
                <div style={{ background: '#0f172a', color: '#fff', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', zIndex: 1000 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '800', color: '#38bdf8', fontSize: '0.95rem' }}>MeetMatrix</span>
                        <span style={{ color: '#475569' }}>|</span>
                        <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{roomName}</span>
                        {isHost && <span style={{ background: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>HOST</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {/* Emojis */}
                        <div style={{ display: 'flex', gap: '2px', background: '#1e293b', padding: '2px 4px', borderRadius: '6px' }}>
                            {['👍', '❤️', '👏', '🎉', '🔥'].map(emoji => (
                                <button key={emoji} onClick={() => triggerReaction(emoji)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px' }}>{emoji}</button>
                            ))}
                        </div>

                        {/* Waiting List Requests */}
                        {isHost && waitingList.length > 0 && (
                            <button onClick={() => setShowAdmitModal(true)} style={{ ...topBtnStyle, background: '#eab308', color: '#000', fontWeight: 'bold' }}>
                                Admit ({waitingList.length})
                            </button>
                        )}

                        {isHost && (
                            <button onClick={() => window.open(`${BACKEND_URL}/api/attendance/export/${roomName}`, '_blank')} style={topBtnStyle}>
                                <Download size={14} /> CSV
                            </button>
                        )}

                        <button onClick={copyRoomCode} style={{ ...topBtnStyle, background: copied ? '#10b981' : '#0284c7' }}>
                            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Invite'}
                        </button>
                    </div>
                </div>

                {/* Admit Requests Modal */}
                {showAdmitModal && isHost && (
                    <div style={{ position: 'fixed', top: '50px', right: '16px', background: '#1e293b', padding: '14px', borderRadius: '10px', border: '1px solid #334155', zIndex: 9999, width: '280px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#38bdf8' }}>Waiting Room ({waitingList.length})</h4>
                        {waitingList.map(p => (
                            <div key={p.participant_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#fff' }}>{p.name}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => handleAdmitAction(p.participant_id, 'admit')} style={{ background: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer' }}><UserCheck size={14} /></button>
                                    <button onClick={() => handleAdmitAction(p.participant_id, 'reject')} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer' }}><UserX size={14} /></button>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setShowAdmitModal(false)} style={{ width: '100%', marginTop: '6px', background: '#334155', border: 'none', color: '#fff', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Close</button>
                    </div>
                )}

                {showWhiteboard && <Whiteboard isHost={isHost} onClose={() => setShowWhiteboard(false)} />}

                {/* LiveKit Integrated Room Stage */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <LiveKitRoom
                        video={cameraEnabled}
                        audio={micEnabled}
                        token={token}
                        serverUrl={serverUrl}
                        data-lk-theme="default"
                        style={{ height: '100%', width: '100%' }}
                        onDisconnected={handleHostTermination}
                    >
                        <MeetingStage
                            roomName={roomName}
                            isHost={isHost}
                            participantName={participantName}
                            onLeave={handleHostTermination}
                            showWhiteboard={showWhiteboard}
                            setShowWhiteboard={setShowWhiteboard}
                        />
                    </LiveKitRoom>
                </div>
            </div>
        );
    }

    // Pre-Meeting Lobby View (Responsive)
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #1e293b 0%, #090d16 100%)', fontFamily: 'system-ui, sans-serif', color: '#fff', padding: '16px' }}>
            <div style={{ background: '#131b2e', borderRadius: '16px', width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', border: '1px solid #1e293b', overflow: 'hidden' }}>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                    {/* Green Room Preview */}
                    <div style={{ padding: '1.5rem', background: '#0c1222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.8rem' }}>Green Room Check</h3>
                        <div style={{ width: '100%', maxWidth: '320px', height: '200px', background: '#000', borderRadius: '10px', overflow: 'hidden' }}>
                            <video ref={videoPreviewRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                            <button onClick={() => setCameraEnabled(!cameraEnabled)} style={{ ...toggleBtnStyle, background: cameraEnabled ? '#334155' : '#ef4444' }}>
                                {cameraEnabled ? <Video size={16} /> : <VideoOff size={16} />} {cameraEnabled ? 'Cam On' : 'Cam Off'}
                            </button>
                            <button onClick={() => setMicEnabled(!micEnabled)} style={{ ...toggleBtnStyle, background: micEnabled ? '#334155' : '#ef4444' }}>
                                {micEnabled ? <Mic size={16} /> : <MicOff size={16} />} {micEnabled ? 'Mic On' : 'Mic Off'}
                            </button>
                        </div>
                    </div>

                    {/* Join & Create Forms */}
                    <div style={{ padding: '1.8rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#38bdf8', margin: 0 }}>MeetMatrix</h1>
                            <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} title="Host Settings">
                                <Settings size={20} />
                            </button>
                        </div>

                        {/* Extended Pre-Meeting Settings */}
                        {showSettings && (
                            <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #1e293b' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '8px' }}>HOST MEETING SETTINGS</span>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Waiting Room Policy:</label>
                                <select
                                    value={waitingMode}
                                    onChange={(e) => setWaitingMode(e.target.value)}
                                    style={{ width: '100%', padding: '6px', background: '#131b2e', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '8px' }}
                                >
                                    <option value="direct">Direct Bypass (No Waiting Room)</option>
                                    <option value="strict">Strict (Host Must Approve)</option>
                                    <option value="open">Open Collaboration (Anyone Can Admit)</option>
                                </select>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginBottom: '4px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={chatLocked} onChange={(e) => setChatLocked(e.target.checked)} />
                                    Lock Chat on Join
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={screenshareLocked} onChange={(e) => setScreenshareLocked(e.target.checked)} />
                                    Host-Only Screen Sharing
                                </label>
                            </div>
                        )}

                        <div style={{ marginBottom: '0.8rem' }}>
                            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Your Name</label>
                            <input type="text" placeholder="e.g. Raj" value={participantName} onChange={(e) => setParticipantName(e.target.value)} style={inputStyle} />
                        </div>

                        <button onClick={handleCreateRoom} disabled={loading} style={primaryBtnStyle}>
                            {loading ? 'Starting Meeting...' : '⚡ Create New Meeting'}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#475569' }}>
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
        </div>
    );
}

const inputStyle = { width: '100%', padding: '10px 12px', background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
const primaryBtnStyle = { width: '100%', padding: '10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' };
const secondaryBtnStyle = { width: '100%', padding: '10px', background: 'transparent', border: '1px solid #0284c7', color: '#38bdf8', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' };
const topBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' };
const toggleBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' };
const controlBtn = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', fontSize: '0.7rem', cursor: 'pointer', minWidth: '55px' };