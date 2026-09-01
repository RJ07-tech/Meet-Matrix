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
    Chat,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
    Copy, Check, Disc, Square, Download,
    PenTool, Video, VideoOff, Mic, MicOff, Settings,
    UserCheck, UserX, Clock, MonitorUp, MessageSquare, PhoneOff, X, Plus
} from 'lucide-react';
import Whiteboard from './Whiteboard';

const BACKEND_URL = 'https://meetmatrix-backend-3l9l.onrender.com';

const EMOJI_PALETTE = [
    '👍', '❤️', '👏', '🎉', '🔥', '😂', '😮', '🙌',
    '💯', '🚀', '✨', '💡', '😎', '🤔', '👋', '🥳',
    '🤝', '💪', '🎯', '⭐', '🎈', '🤩', '😇', '💥'
];

function MeetingStage({
                          roomName,
                          isHost,
                          participantName,
                          onLeave,
                          onTerminate,
                          showWhiteboard,
                          setShowWhiteboard,
                          allowScreenshare,
                          chatLocked
                      }) {
    const { localParticipant } = useLocalParticipant();
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

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
        if (!isHost && !allowScreenshare) {
            alert("Screen sharing has been disabled by the host for participants.");
            return;
        }
        if (localParticipant) {
            const nextState = !isScreenSharing;
            await localParticipant.setScreenShareEnabled(nextState);
            setIsScreenSharing(nextState);
        }
    };

    // Dedicated Content Recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always", displaySurface: "browser" },
                audio: true
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
            console.error("Recording error:", err);
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

            <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
                <div style={{ flex: 1, height: '100%', width: '100%' }}>
                    <GridLayout tracks={tracks} style={{ height: '100%', width: '100%' }}>
                        <ParticipantTile />
                    </GridLayout>
                </div>

                {showChat && (
                    <div style={{ width: '320px', maxWidth: '85vw', background: '#0f172a', borderLeft: '1px solid #334155', height: '100%', zIndex: 50 }}>
                        {chatLocked && !isHost ? (
                            <div style={{ padding: '24px', color: '#cbd5e1', textAlign: 'center', fontSize: '0.9rem' }}>
                                Chat has been locked by the host.
                            </div>
                        ) : (
                            <Chat />
                        )}
                    </div>
                )}
            </div>

            {/* Responsive In-Meeting Bottom Controls */}
            <div style={{
                background: '#0f172a',
                borderTop: '1px solid #334155',
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '10px',
                zIndex: 100,
                flexWrap: 'wrap'
            }}>
                <button onClick={toggleMic} style={{ ...controlBtn, background: isMicMuted ? '#ef4444' : '#1e293b' }}>
                    {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    <span className="btn-label">{isMicMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                <button onClick={toggleVideo} style={{ ...controlBtn, background: isVideoMuted ? '#ef4444' : '#1e293b' }}>
                    {isVideoMuted ? <VideoOff size={18} /> : <Video size={18} />}
                    <span className="btn-label">{isVideoMuted ? 'Start Video' : 'Stop Video'}</span>
                </button>

                <button
                    onClick={toggleScreenShare}
                    style={{
                        ...controlBtn,
                        background: isScreenSharing ? '#0284c7' : '#1e293b',
                        opacity: (!isHost && !allowScreenshare) ? 0.4 : 1,
                        cursor: (!isHost && !allowScreenshare) ? 'not-allowed' : 'pointer'
                    }}
                    title={(!isHost && !allowScreenshare) ? 'Screen share disabled by host' : 'Share Screen'}
                >
                    <MonitorUp size={18} />
                    <span className="btn-label">{isScreenSharing ? 'Sharing' : 'Share'}</span>
                </button>

                <button onClick={() => setShowWhiteboard(!showWhiteboard)} style={controlBtn}>
                    <PenTool size={18} />
                    <span className="btn-label">Whiteboard</span>
                </button>

                <button onClick={() => setShowChat(!showChat)} style={{ ...controlBtn, background: showChat ? '#0284c7' : '#1e293b' }}>
                    <MessageSquare size={18} />
                    <span className="btn-label">Chat</span>
                </button>

                <button onClick={isRecording ? stopRecording : startRecording} style={{ ...controlBtn, background: isRecording ? '#ef4444' : '#1e293b' }}>
                    {isRecording ? <Square size={18} /> : <Disc size={18} />}
                    <span className="btn-label">{isRecording ? 'Recording' : 'Record'}</span>
                </button>

                {isHost ? (
                    <button onClick={onTerminate} style={{ ...controlBtn, background: '#ef4444', color: '#fff' }}>
                        <PhoneOff size={18} />
                        <span className="btn-label">End Meeting</span>
                    </button>
                ) : (
                    <button onClick={onLeave} style={{ ...controlBtn, background: '#e11d48', color: '#fff' }}>
                        <PhoneOff size={18} />
                        <span className="btn-label">Leave</span>
                    </button>
                )}
            </div>
        </div>
    );
}

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

    // Settings State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [waitingMode, setWaitingMode] = useState('direct');
    const [chatLocked, setChatLocked] = useState(false);
    const [allowScreenshare, setAllowScreenshare] = useState(true);

    // Waiting Requests
    const [waitingList, setWaitingList] = useState([]);
    const [showAdmitModal, setShowAdmitModal] = useState(false);

    // Emojis & Palette Dropdown
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [floatingEmojis, setFloatingEmojis] = useState([]);

    // Whiteboard Modal
    const [showWhiteboard, setShowWhiteboard] = useState(false);

    // Green Room Preview
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [micEnabled, setMicEnabled] = useState(true);
    const videoPreviewRef = useRef(null);
    const previewStreamRef = useRef(null);

    // Parse invite URL param on load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        if (roomParam) {
            setRoomName(roomParam);
        }
    }, []);

    useEffect(() => {
        if (!inMeeting && !isWaiting) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((stream) => {
                    previewStreamRef.current = stream;
                    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
                })
                .catch((err) => console.log("Lobby stream notice:", err));
        } else {
            if (previewStreamRef.current) {
                previewStreamRef.current.getTracks().forEach(t => t.stop());
            }
        }
    }, [inMeeting, isWaiting]);

    // Sync settings periodically
    useEffect(() => {
        let interval;
        if (inMeeting && roomName) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${BACKEND_URL}/api/room-settings/${roomName}`);
                    setAllowScreenshare(res.data.allow_participant_screenshare);
                    setChatLocked(res.data.chat_locked);
                    setWaitingMode(res.data.waiting_mode);
                } catch (e) {
                    console.error(e);
                }
            }, 4000);
        }
        return () => clearInterval(interval);
    }, [inMeeting, roomName]);

    // Polling for admitted participants
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
                        alert('The host declined your admission request.');
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

    // Host polling waiting room
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
                allow_participant_screenshare: allowScreenshare
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
                if (res.data.config) {
                    setAllowScreenshare(res.data.config.allow_participant_screenshare);
                    setChatLocked(res.data.config.chat_locked);
                }
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
        if (res.data.config) {
            setAllowScreenshare(res.data.config.allow_participant_screenshare);
            setChatLocked(res.data.config.chat_locked);
        }
        setInMeeting(true);
    };

    const handleUpdateLiveSettings = async (updates) => {
        try {
            await axios.post(`${BACKEND_URL}/api/update-room-settings`, {
                room_name: roomName,
                ...updates
            });
        } catch (e) {
            alert("Settings update failed: " + e.message);
        }
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
        if (window.confirm("Are you sure you want to end the meeting for all participants?")) {
            try {
                await axios.post(`${BACKEND_URL}/api/terminate-room`, { room_name: roomName });
            } catch (e) {
                console.error(e);
            }
            setInMeeting(false);
            setToken('');
            setRoomName('');
            setIsHost(false);
        }
    };

    const handleParticipantLeave = async () => {
        try {
            await axios.post(`${BACKEND_URL}/api/leave-room`, { room_name: roomName, participant_name: participantName });
        } catch (e) {
            console.error(e);
        }
        setInMeeting(false);
        setToken('');
        setRoomName('');
        setIsHost(false);
    };

    const triggerReaction = (emoji) => {
        const id = Date.now();
        setFloatingEmojis(prev => [...prev, { id, emoji, left: Math.random() * 80 + 10 }]);
        setShowEmojiPicker(false);
        setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2500);
    };

    // Full Clickable Invite URL Link Copy
    const copyInviteLink = () => {
        const fullInviteLink = `${window.location.origin}/?room=${roomName}`;
        navigator.clipboard.writeText(fullInviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isWaiting) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090d16', color: '#f8fafc', flexDirection: 'column', padding: '20px', textAlign: 'center' }}>
                <Clock size={48} color="#38bdf8" style={{ marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: '#f8fafc' }}>Waiting for host approval...</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Room: {roomName}</p>
                <button onClick={() => setIsWaiting(false)} style={{ marginTop: '1rem', background: '#ef4444', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
            </div>
        );
    }

    if (inMeeting && token && serverUrl) {
        return (
            <div style={{ height: '100vh', width: '100vw', background: '#090d16', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Floating Emojis Overlay */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999 }}>
                    {floatingEmojis.map(item => (
                        <span key={item.id} style={{ position: 'absolute', bottom: '90px', left: `${item.left}%`, fontSize: '2.8rem', animation: 'floatUp 2.5s ease-in-out forwards' }}>
              {item.emoji}
            </span>
                    ))}
                </div>

                {/* Top Header */}
                <div style={{ background: '#0f172a', color: '#f8fafc', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', zIndex: 1000 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '800', color: '#38bdf8', fontSize: '1rem' }}>MeetMatrix</span>
                        <span style={{ color: '#64748b' }}>|</span>
                        <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>Room: <strong>{roomName}</strong></span>
                        {isHost && <span style={{ background: '#0284c7', color: '#ffffff', padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>HOST</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
                        {/* Quick Emojis + Expand Button */}
                        <div style={{ display: 'flex', gap: '4px', background: '#1e293b', padding: '2px 6px', borderRadius: '8px', alignItems: 'center', border: '1px solid #334155' }}>
                            {['👍', '❤️', '👏', '🎉', '🔥'].map(emoji => (
                                <button key={emoji} onClick={() => triggerReaction(emoji)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '2px' }}>
                                    {emoji}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                style={{ background: '#334155', border: 'none', color: '#38bdf8', borderRadius: '4px', padding: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                title="More Emojis"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {/* Extended Emoji Dropdown */}
                        {showEmojiPicker && (
                            <div style={{
                                position: 'absolute',
                                top: '40px',
                                right: '180px',
                                background: '#1e293b',
                                border: '1px solid #38bdf8',
                                borderRadius: '10px',
                                padding: '10px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(6, 1fr)',
                                gap: '8px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                                zIndex: 9999
                            }}>
                                {EMOJI_PALETTE.map(e => (
                                    <button
                                        key={e}
                                        onClick={() => triggerReaction(e)}
                                        style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: '4px' }}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* In-Meeting Host Settings */}
                        {isHost && (
                            <button onClick={() => setShowSettingsModal(true)} style={topBtnStyle}>
                                <Settings size={14} /> Settings
                            </button>
                        )}

                        {/* Waiting List Requests */}
                        {isHost && waitingList.length > 0 && (
                            <button onClick={() => setShowAdmitModal(true)} style={{ ...topBtnStyle, background: '#eab308', color: '#0f172a', fontWeight: 'bold' }}>
                                Admit ({waitingList.length})
                            </button>
                        )}

                        {isHost && (
                            <button onClick={() => window.open(`${BACKEND_URL}/api/attendance/export/${roomName}`, '_blank')} style={topBtnStyle}>
                                <Download size={14} /> CSV
                            </button>
                        )}

                        {/* Copy Full Link Button */}
                        <button onClick={copyInviteLink} style={{ ...topBtnStyle, background: copied ? '#10b981' : '#0284c7' }}>
                            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Link Copied!' : 'Copy Link'}
                        </button>
                    </div>
                </div>

                {/* High-Contrast Host Settings Modal */}
                {showSettingsModal && isHost && (
                    <div style={{
                        position: 'fixed',
                        top: '55px',
                        right: '16px',
                        background: '#1e293b',
                        padding: '18px',
                        borderRadius: '12px',
                        border: '2px solid #38bdf8',
                        boxShadow: '0 20px 30px rgba(0,0,0,0.7)',
                        zIndex: 9999,
                        width: '320px',
                        color: '#f8fafc'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#38bdf8', fontWeight: '700' }}>Meeting Settings</h4>
                            <button onClick={() => setShowSettingsModal(false)} style={{ background: 'transparent', border: 'none', color: '#f8fafc', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', marginBottom: '12px', cursor: 'pointer', color: '#f8fafc', fontWeight: '500' }}>
                            <input
                                type="checkbox"
                                checked={allowScreenshare}
                                onChange={(e) => {
                                    setAllowScreenshare(e.target.checked);
                                    handleUpdateLiveSettings({ allow_participant_screenshare: e.target.checked });
                                }}
                                style={{ width: '16px', height: '16px', accentColor: '#38bdf8' }}
                            />
                            Allow Participants to Screen Share
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', marginBottom: '12px', cursor: 'pointer', color: '#f8fafc', fontWeight: '500' }}>
                            <input
                                type="checkbox"
                                checked={chatLocked}
                                onChange={(e) => {
                                    setChatLocked(e.target.checked);
                                    handleUpdateLiveSettings({ chat_locked: e.target.checked });
                                }}
                                style={{ width: '16px', height: '16px', accentColor: '#38bdf8' }}
                            />
                            Lock Chat for Participants
                        </label>

                        <div style={{ marginTop: '12px' }}>
                            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Waiting Room Mode:</label>
                            <select
                                value={waitingMode}
                                onChange={(e) => {
                                    setWaitingMode(e.target.value);
                                    handleUpdateLiveSettings({ waiting_mode: e.target.value });
                                }}
                                style={{ width: '100%', padding: '8px', background: '#090d16', border: '1px solid #475569', color: '#ffffff', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '500' }}
                            >
                                <option value="direct">Direct Bypass</option>
                                <option value="strict">Strict (Host Approval)</option>
                                <option value="open">Open Collaboration</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Admit Requests Modal */}
                {showAdmitModal && isHost && (
                    <div style={{ position: 'fixed', top: '55px', right: '16px', background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #475569', zIndex: 9999, width: '290px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#38bdf8' }}>Waiting Room ({waitingList.length})</h4>
                        {waitingList.map(p => (
                            <div key={p.participant_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{p.name}</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={() => handleAdmitAction(p.participant_id, 'admit')} style={{ background: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}><UserCheck size={14} /></button>
                                    <button onClick={() => handleAdmitAction(p.participant_id, 'reject')} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}><UserX size={14} /></button>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setShowAdmitModal(false)} style={{ width: '100%', marginTop: '6px', background: '#334155', border: 'none', color: '#fff', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Close</button>
                    </div>
                )}

                {/* Fixed Whiteboard */}
                {showWhiteboard && <Whiteboard isHost={isHost} onClose={() => setShowWhiteboard(false)} />}

                {/* LiveKit Video Stage */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <LiveKitRoom
                        video={cameraEnabled}
                        audio={micEnabled}
                        token={token}
                        serverUrl={serverUrl}
                        data-lk-theme="default"
                        style={{ height: '100%', width: '100%' }}
                        onDisconnected={isHost ? handleHostTermination : handleParticipantLeave}
                    >
                        <MeetingStage
                            roomName={roomName}
                            isHost={isHost}
                            participantName={participantName}
                            onLeave={handleParticipantLeave}
                            onTerminate={handleHostTermination}
                            showWhiteboard={showWhiteboard}
                            setShowWhiteboard={setShowWhiteboard}
                            allowScreenshare={allowScreenshare}
                            chatLocked={chatLocked}
                        />
                    </LiveKitRoom>
                </div>
            </div>
        );
    }

    // Pre-Meeting Lobby
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #1e293b 0%, #090d16 100%)', fontFamily: 'system-ui, sans-serif', color: '#f8fafc', padding: '16px' }}>
            <div style={{ background: '#131b2e', borderRadius: '16px', width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', border: '1px solid #1e293b', overflow: 'hidden' }}>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                    {/* Green Room Preview */}
                    <div style={{ padding: '1.5rem', background: '#0c1222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.8rem' }}>Green Room Preview</h3>
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

                    {/* Join Form */}
                    <div style={{ padding: '1.8rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#38bdf8', margin: 0 }}>MeetMatrix</h1>
                            <button onClick={() => setShowSettingsModal(!showSettingsModal)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }} title="Host Settings">
                                <Settings size={20} />
                            </button>
                        </div>

                        {/* Pre-Meeting Host Settings */}
                        {showSettingsModal && (
                            <div style={{ background: '#090d16', padding: '14px', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #334155', color: '#f8fafc' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '8px' }}>HOST MEETING SETTINGS</span>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Waiting Room Policy:</label>
                                <select
                                    value={waitingMode}
                                    onChange={(e) => setWaitingMode(e.target.value)}
                                    style={{ width: '100%', padding: '6px', background: '#131b2e', border: '1px solid #475569', color: '#ffffff', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '10px' }}
                                >
                                    <option value="direct">Direct Bypass (No Waiting Room)</option>
                                    <option value="strict">Strict (Host Approval)</option>
                                    <option value="open">Open Collaboration</option>
                                </select>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', marginBottom: '8px', cursor: 'pointer', color: '#f8fafc' }}>
                                    <input type="checkbox" checked={allowScreenshare} onChange={(e) => setAllowScreenshare(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    Allow Participant Screen Sharing
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', color: '#f8fafc' }}>
                                    <input type="checkbox" checked={chatLocked} onChange={(e) => setChatLocked(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    Lock Chat on Join
                                </label>
                            </div>
                        )}

                        <div style={{ marginBottom: '0.8rem' }}>
                            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Your Name</label>
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

const inputStyle = { width: '100%', padding: '10px 12px', background: '#090d16', border: '1px solid #334155', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
const primaryBtnStyle = { width: '100%', padding: '10px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' };
const secondaryBtnStyle = { width: '100%', padding: '10px', background: 'transparent', border: '1px solid #0284c7', color: '#38bdf8', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' };
const topBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '500' };
const toggleBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' };
const controlBtn = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', fontSize: '0.7rem', cursor: 'pointer', minWidth: '55px', fontWeight: '500' };