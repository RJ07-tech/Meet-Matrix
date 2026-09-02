import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import '@livekit/components-styles';
import {
    LiveKitRoom,
    ParticipantTile,
    useTracks,
    useLocalParticipant,
    useRemoteParticipants,
    RoomAudioRenderer,
    useRoomContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
    Copy, Check, Disc, Square, Download,
    PenTool, Video, VideoOff, Mic, MicOff, Settings,
    UserCheck, UserX, Clock, MonitorUp, MessageSquare, PhoneOff, X, Plus,
    Users, Hand, Send, Edit3, VolumeX, MoreVertical
} from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import Whiteboard from './Whiteboard';

const BACKEND_URL = 'https://meetmatrix-backend-3l9l.onrender.com';

const EMOJI_PALETTE = [
    '👍', '❤️', '👏', '🎉', '🔥', '😂',
    '😮', '🙌', '💯', '🚀', '✨', '💡',
    '😎', '🤔', '👋', '🥳', '🤝', '💪',
    '🎯', '⭐', '🎈', '🤩', '😇', '💥',
    '😍', '🙏', '⚡', '🏆', '👀', '🔥'
];

function MeetingStage({
                          roomName,
                          isHost,
                          participantName,
                          setParticipantName,
                          initialCam,
                          initialMic,
                          onLeave,
                          onTerminate,
                          showWhiteboard,
                          setShowWhiteboard,
                          allowScreenshare,
                          allowDirectChat,
                          chatLocked,
                          floatingEmojis,
                          triggerReactionBroadcast
                      }) {
    const { localParticipant } = useLocalParticipant();
    const remoteParticipants = useRemoteParticipants();
    const room = useRoomContext();

    const [isMicMuted, setIsMicMuted] = useState(!initialMic);
    const [isVideoMuted, setIsVideoMuted] = useState(!initialCam);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);

    // Raised hands map: { [identity]: boolean }
    const [raisedHandsMap, setRaisedHandsMap] = useState({});

    // Drawers
    const [showChat, setShowChat] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [activeMenuIdentity, setActiveMenuIdentity] = useState(null);

    // In-Drawer Rename State
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(participantName);

    // Chat State
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatRecipient, setChatRecipient] = useState('Everyone');

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const allTracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    const screenShareTrack = allTracks.find(t => t.source === Track.Source.ScreenShare);
    const cameraTracks = allTracks.filter(t => t.source === Track.Source.Camera);

    // Hardware sync on enter
    useEffect(() => {
        if (localParticipant) {
            localParticipant.setCameraEnabled(initialCam);
            localParticipant.setMicrophoneEnabled(initialMic);
            localParticipant.setName(participantName);
        }
    }, [localParticipant]);

    // LiveKit Network Signal Receiver
    useEffect(() => {
        if (!room) return;

        const handleDataReceived = (payload, participant) => {
            try {
                const decoded = new TextDecoder().decode(payload);
                const data = JSON.parse(decoded);

                if (data.type === 'hand_raise') {
                    setRaisedHandsMap(prev => ({
                        ...prev,
                        [participant.identity]: data.raised
                    }));
                } else if (data.type === 'reaction') {
                    triggerReactionBroadcast(data.emoji, false);
                } else if (data.type === 'chat') {
                    if (data.recipient === 'Everyone' || data.recipient === localParticipant?.identity || participant.identity === localParticipant?.identity) {
                        setChatMessages(prev => [...prev, {
                            sender: participant.name || participant.identity,
                            text: data.text,
                            recipient: data.recipient,
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }]);
                    }
                } else if (data.type === 'force_mute' && data.targetIdentity === localParticipant?.identity) {
                    localParticipant.setMicrophoneEnabled(false);
                    setIsMicMuted(true);
                    alert("The Host has muted your microphone.");
                } else if (data.type === 'kick_user' && data.targetIdentity === localParticipant?.identity) {
                    alert("You were removed from the meeting by the Host.");
                    onLeave();
                }
            } catch (err) {
                console.error("Signal reception error:", err);
            }
        };

        room.on('dataReceived', handleDataReceived);
        return () => room.off('dataReceived', handleDataReceived);
    }, [room, localParticipant, onLeave, triggerReactionBroadcast]);

    const toggleMic = async () => {
        if (localParticipant) {
            const targetState = isMicMuted;
            await localParticipant.setMicrophoneEnabled(targetState);
            setIsMicMuted(!targetState);
        }
    };

    const toggleVideo = async () => {
        if (localParticipant) {
            const targetState = isVideoMuted;
            await localParticipant.setCameraEnabled(targetState);
            setIsVideoMuted(!targetState);
        }
    };

    const toggleScreenShare = async () => {
        if (!isHost && !allowScreenshare) {
            alert("Screen sharing is restricted by the Host.");
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert("Screen sharing is supported on PC/Laptop desktop browsers.");
            return;
        }
        if (localParticipant) {
            const nextState = !isScreenSharing;
            await localParticipant.setScreenShareEnabled(nextState);
            setIsScreenSharing(nextState);
        }
    };

    const toggleHandRaise = () => {
        if (!localParticipant || !room) return;
        const nextState = !isHandRaised;
        setIsHandRaised(nextState);

        setRaisedHandsMap(prev => ({
            ...prev,
            [localParticipant.identity]: nextState
        }));

        const payload = JSON.stringify({ type: 'hand_raise', raised: nextState });
        room.localParticipant.publishData(
            new TextEncoder().encode(payload),
            { reliable: true }
        );
    };

    const handleSaveName = () => {
        if (!editNameValue.trim() || !localParticipant) return;
        localParticipant.setName(editNameValue.trim());
        setParticipantName(editNameValue.trim());
        setIsEditingName(false);
    };

    const handleHostMute = (identity) => {
        if (!isHost || !room) return;
        const payload = JSON.stringify({ type: 'force_mute', targetIdentity: identity });
        room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
        setActiveMenuIdentity(null);
    };

    const handleHostKick = async (identity) => {
        if (!isHost) return;
        if (window.confirm("Remove this participant from the meeting?")) {
            try {
                const payload = JSON.stringify({ type: 'kick_user', targetIdentity: identity });
                room?.localParticipant?.publishData(new TextEncoder().encode(payload), { reliable: true });

                await axios.post(`${BACKEND_URL}/api/kick-participant`, {
                    room_name: roomName,
                    participant_identity: identity
                });
            } catch (err) {
                console.log("Kick API fallback handled");
            }
            setActiveMenuIdentity(null);
        }
    };

    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !room) return;
        if (chatLocked && !isHost) {
            alert("Chat has been locked by the Host.");
            return;
        }

        const messageData = {
            type: 'chat',
            text: chatInput.trim(),
            recipient: chatRecipient
        };

        room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify(messageData)),
            { reliable: true }
        );

        setChatMessages(prev => [...prev, {
            sender: 'You',
            text: chatInput.trim(),
            recipient: chatRecipient,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        setChatInput('');
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert("Screen recording is supported on PC/Laptop browsers.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: true });
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
            console.log("Recording cancelled:", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
    };

    const allPeers = [
        { identity: localParticipant?.identity, name: `${participantName} (You)`, isHost, isSelf: true, isHandRaised: !!raisedHandsMap[localParticipant?.identity] },
        ...remoteParticipants.map(p => ({
            identity: p.identity,
            name: p.name || p.identity,
            isHost: false,
            isSelf: false,
            isHandRaised: !!raisedHandsMap[p.identity]
        }))
    ];

    const getGridClass = () => {
        if (cameraTracks.length <= 1) return 'matrix-grid-1';
        if (cameraTracks.length === 2) return 'matrix-grid-2';
        return 'matrix-grid-multi';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
            <RoomAudioRenderer />

            {/* In-Meeting Floating Emojis Across Peers */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999 }}>
                {floatingEmojis.map(item => (
                    <span key={item.id} className="floating-emoji-item" style={{ left: `${item.left}%` }}>
                        {item.emoji}
                    </span>
                ))}
            </div>

            <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', minHeight: 0 }}>

                {/* SAFE VIDEO STAGE */}
                <div style={{ flex: 1, height: '100%', width: '100%', position: 'relative' }}>
                    {screenShareTrack ? (
                        <div className="stage-focus-container">
                            <div className="stage-screenshare-main">
                                <ParticipantTile trackRef={screenShareTrack} />
                            </div>

                            <div className="stage-camera-strip">
                                {cameraTracks.map(track => {
                                    const peerId = track.participant?.identity;
                                    const hasHandRaised = !!raisedHandsMap[peerId];
                                    return (
                                        <div key={track.publication?.trackSid || peerId} style={{ position: 'relative', height: '100%' }}>
                                            {hasHandRaised && <div className="video-hand-badge">✋ Raised</div>}
                                            <ParticipantTile trackRef={track} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className={`matrix-stage-grid ${getGridClass()}`}>
                            {cameraTracks.map(track => {
                                const peerId = track.participant?.identity;
                                const hasHandRaised = !!raisedHandsMap[peerId];
                                return (
                                    <div key={track.publication?.trackSid || peerId} className="video-tile-wrapper">
                                        {hasHandRaised && <div className="video-hand-badge">✋ Hand Raised</div>}
                                        <ParticipantTile trackRef={track} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Participants Drawer with 3-Dot Menu & Rename Option */}
                {showParticipants && (
                    <div style={sideDrawerStyle}>
                        <div style={drawerHeaderStyle}>
                            <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Participants ({allPeers.length})</span>
                            <button onClick={() => { setShowParticipants(false); setActiveMenuIdentity(null); }} style={drawerCloseBtn}><X size={16} /></button>
                        </div>

                        <div style={{ padding: '8px', overflowY: 'auto', flex: 1 }}>
                            {allPeers.map(p => (
                                <div key={p.identity} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px', borderBottom: '1px solid #1e293b' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                                            {p.name.charAt(0).toUpperCase()}
                                        </div>

                                        {p.isSelf && isEditingName ? (
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%' }}>
                                                <input
                                                    type="text"
                                                    value={editNameValue}
                                                    onChange={(e) => setEditNameValue(e.target.value)}
                                                    style={{ background: '#090d16', border: '1px solid #38bdf8', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', width: '90px' }}
                                                />
                                                <button onClick={handleSaveName} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}><Check size={12} /></button>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.82rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {p.name} {p.isHandRaised && <span title="Hand Raised" style={{ marginLeft: '4px' }}>✋</span>}
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                        {p.isSelf && !isEditingName && (
                                            <button onClick={() => setIsEditingName(true)} style={drawerActionBtn} title="Rename self">
                                                <Edit3 size={13} />
                                            </button>
                                        )}

                                        {isHost && !p.isSelf && (
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    onClick={() => setActiveMenuIdentity(activeMenuIdentity === p.identity ? null : p.identity)}
                                                    style={drawerActionBtn}
                                                >
                                                    <MoreVertical size={14} />
                                                </button>

                                                {activeMenuIdentity === p.identity && (
                                                    <div style={contextMenuStyle}>
                                                        <button onClick={() => handleHostMute(p.identity)} style={contextMenuItemStyle}>
                                                            <VolumeX size={14} color="#f59e0b" /> Mute Audio
                                                        </button>
                                                        <button onClick={() => handleHostKick(p.identity)} style={{ ...contextMenuItemStyle, color: '#ef4444' }}>
                                                            <UserX size={14} color="#ef4444" /> Remove User
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Chat Drawer */}
                {showChat && (
                    <div style={sideDrawerStyle}>
                        <div style={drawerHeaderStyle}>
                            <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>In-Meeting Chat</span>
                            <button onClick={() => setShowChat(false)} style={drawerCloseBtn}><X size={16} /></button>
                        </div>

                        {allowDirectChat && (
                            <div style={{ padding: '6px 12px', background: '#090d16', borderBottom: '1px solid #1e293b' }}>
                                <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Send to:</label>
                                <select
                                    value={chatRecipient}
                                    onChange={(e) => setChatRecipient(e.target.value)}
                                    style={{ width: '100%', padding: '4px 8px', background: '#131b2e', border: '1px solid #334155', color: '#38bdf8', borderRadius: '4px', fontSize: '0.75rem' }}
                                >
                                    <option value="Everyone">Everyone (Public)</option>
                                    {remoteParticipants.map(p => (
                                        <option key={p.identity} value={p.identity}>Direct: {p.name || p.identity}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {chatMessages.length === 0 ? (
                                <div style={{ color: '#64748b', fontSize: '0.75rem', textAlign: 'center', marginTop: '40px' }}>No messages yet. Send a message to get started!</div>
                            ) : (
                                chatMessages.map((msg, i) => (
                                    <div key={i} style={{ background: msg.recipient !== 'Everyone' ? '#1e1b4b' : '#1e293b', padding: '8px 10px', borderRadius: '8px', border: msg.recipient !== 'Everyone' ? '1px solid #818cf8' : 'none' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '0.7rem', color: '#94a3b8' }}>
                                            <span style={{ fontWeight: '700', color: msg.sender === 'You' ? '#38bdf8' : '#f8fafc' }}>
                                                {msg.sender} {msg.recipient !== 'Everyone' && <span style={{ color: '#a78bfa' }}>[Direct]</span>}
                                            </span>
                                            <span>{msg.time}</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#e2e8f0', wordBreak: 'break-word' }}>{msg.text}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={handleSendChat} style={{ padding: '8px 12px', background: '#090d16', borderTop: '1px solid #1e293b', display: 'flex', gap: '6px' }}>
                            <input
                                type="text"
                                value={chatInput}
                                placeholder={chatLocked && !isHost ? "Chat locked by host" : `Message ${chatRecipient}...`}
                                disabled={chatLocked && !isHost}
                                onChange={(e) => setChatInput(e.target.value)}
                                style={{ flex: 1, padding: '8px 10px', background: '#131b2e', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', outline: 'none' }}
                            />
                            <button type="submit" disabled={chatLocked && !isHost} style={{ background: '#0284c7', border: 'none', color: '#fff', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer' }}>
                                <Send size={14} />
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Mobile Horizontal Dock */}
            <div className="mobile-control-bar" style={bottomBarStyle}>
                <button onClick={toggleMic} style={{ ...controlBtn, background: isMicMuted ? '#ef4444' : '#1e293b' }}>
                    {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>{isMicMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                <button onClick={toggleVideo} style={{ ...controlBtn, background: isVideoMuted ? '#ef4444' : '#1e293b' }}>
                    {isVideoMuted ? <VideoOff size={18} /> : <Video size={18} />}
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>{isVideoMuted ? 'Start Video' : 'Stop Video'}</span>
                </button>

                <button
                    onClick={toggleHandRaise}
                    style={{ ...controlBtn, background: isHandRaised ? '#eab308' : '#1e293b', color: isHandRaised ? '#000' : '#fff' }}
                    title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
                >
                    <Hand size={18} />
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>{isHandRaised ? 'Lower' : 'Raise'}</span>
                </button>

                <button
                    onClick={toggleScreenShare}
                    style={{ ...controlBtn, background: isScreenSharing ? '#0284c7' : '#1e293b', opacity: (!isHost && !allowScreenshare) ? 0.4 : 1 }}
                >
                    <MonitorUp size={18} />
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>Share</span>
                </button>

                <button onClick={() => setShowWhiteboard(!showWhiteboard)} style={controlBtn}>
                    <PenTool size={18} />
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>Board</span>
                </button>

                <button onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }} style={{ ...controlBtn, background: showParticipants ? '#0284c7' : '#1e293b' }}>
                    <Users size={18} />
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>People</span>
                </button>

                <button onClick={() => { setShowChat(!showChat); setShowParticipants(false); }} style={{ ...controlBtn, background: showChat ? '#0284c7' : '#1e293b' }}>
                    <MessageSquare size={18} />
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>Chat</span>
                </button>

                <button onClick={isRecording ? stopRecording : startRecording} className="mobile-hide" style={{ ...controlBtn, background: isRecording ? '#ef4444' : '#1e293b' }}>
                    {isRecording ? <Square size={18} /> : <Disc size={18} />}
                    <span style={{ fontSize: '0.65rem' }}>{isRecording ? 'Rec' : 'Record'}</span>
                </button>

                {isHost ? (
                    <button onClick={onTerminate} style={{ ...controlBtn, background: '#ef4444', color: '#fff' }}>
                        <PhoneOff size={18} />
                        <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>End</span>
                    </button>
                ) : (
                    <button onClick={onLeave} style={{ ...controlBtn, background: '#e11d48', color: '#fff' }}>
                        <PhoneOff size={18} />
                        <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>Leave</span>
                    </button>
                )}
            </div>

            {showWhiteboard && (
                <Whiteboard
                    isHost={isHost}
                    onClose={() => setShowWhiteboard(false)}
                    localParticipant={localParticipant}
                />
            )}
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

    const [showPreSettingsModal, setShowPreSettingsModal] = useState(false);
    const [waitingMode, setWaitingMode] = useState('direct');
    const [chatLocked, setChatLocked] = useState(false);
    const [allowScreenshare, setAllowScreenshare] = useState(true);
    const [allowDirectChat, setAllowDirectChat] = useState(true);

    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [micEnabled, setMicEnabled] = useState(true);
    const videoPreviewRef = useRef(null);
    const previewStreamRef = useRef(null);

    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('meetmatrix_user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [authAction, setAuthAction] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [floatingEmojis, setFloatingEmojis] = useState([]);
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const activeRoomRef = useRef(null);

    // Host Reload / Tab Close Detection: Auto-terminate for all
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (inMeeting && isHost && roomName) {
                const payload = JSON.stringify({ room_name: roomName });
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon(`${BACKEND_URL}/api/terminate-room`, blob);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [inMeeting, isHost, roomName]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        if (roomParam) setRoomName(roomParam);
    }, []);

    useEffect(() => {
        if (!inMeeting && !isWaiting) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((stream) => {
                    previewStreamRef.current = stream;
                    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
                })
                .catch((err) => console.log("Green room device notice:", err));
        } else {
            if (previewStreamRef.current) {
                previewStreamRef.current.getTracks().forEach(t => t.stop());
            }
        }
    }, [inMeeting, isWaiting]);

    const toggleLobbyCam = () => {
        if (previewStreamRef.current) {
            const videoTrack = previewStreamRef.current.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = !cameraEnabled;
        }
        setCameraEnabled(!cameraEnabled);
    };

    const toggleLobbyMic = () => {
        if (previewStreamRef.current) {
            const audioTrack = previewStreamRef.current.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = !micEnabled;
        }
        setMicEnabled(!micEnabled);
    };

    const triggerGoogleAuth = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                setLoading(true);
                const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });

                const userData = {
                    name: userInfo.data.name,
                    email: userInfo.data.email,
                    picture: userInfo.data.picture,
                };

                localStorage.setItem('meetmatrix_user', JSON.stringify(userData));
                setUser(userData);
                setParticipantName(userData.name);

                if (authAction === 'create') {
                    setShowPreSettingsModal(true);
                } else if (authAction === 'join') {
                    await proceedJoin(userData.name);
                }
            } catch (err) {
                alert("Google Verification Failed: " + err.message);
            } finally {
                setLoading(false);
            }
        },
        onError: () => {
            alert("Sign-In cancelled.");
            setLoading(false);
        }
    });

    const handleStartCreateMeeting = () => {
        if (user) {
            setParticipantName(user.name);
            setShowPreSettingsModal(true);
        } else {
            setAuthAction('create');
            triggerGoogleAuth();
        }
    };

    const handleConfirmAndLaunchRoom = async () => {
        setShowPreSettingsModal(false);
        setLoading(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/create-room`, {
                waiting_mode: waitingMode,
                chat_locked: chatLocked,
                allow_participant_screenshare: allowScreenshare
            });
            const newRoomId = res.data.room_id;
            const hostDisplayName = participantName || user?.name || 'Host';

            setRoomName(newRoomId);
            setIsHost(true);

            const tokenRes = await axios.post(`${BACKEND_URL}/api/get-token`, {
                room_name: newRoomId,
                participant_name: hostDisplayName,
                is_host: true,
                role: "host"
            });

            setToken(tokenRes.data.token);
            setServerUrl(tokenRes.data.server_url);
            setInMeeting(true);
        } catch (e) {
            console.error("Launch Error:", e);
            alert("Create room failed: " + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    };

    const proceedJoin = async (nameToUse) => {
        setIsHost(false);
        setLoading(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/get-token`, {
                room_name: roomName.trim(),
                participant_name: nameToUse,
                is_host: false,
                role: "participant"
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
            alert(err.response?.data?.detail || "Could not join room");
        } finally {
            setLoading(false);
        }
    };

    const handleJoinClick = (e) => {
        e.preventDefault();
        if (!roomName.trim()) {
            alert("Please enter a room code.");
            return;
        }
        if (user) {
            setParticipantName(user.name);
            proceedJoin(user.name);
        } else {
            setAuthAction('join');
            triggerGoogleAuth();
        }
    };

    const triggerReactionBroadcast = useCallback((emoji, broadcast = true) => {
        const baseId = Date.now() + Math.random();
        setFloatingEmojis(prev => [...prev, { id: baseId, emoji, left: Math.random() * 60 + 20 }]);
        setShowEmojiPicker(false);

        if (broadcast && activeRoomRef.current?.localParticipant) {
            const payload = JSON.stringify({ type: 'reaction', emoji });
            activeRoomRef.current.localParticipant.publishData(
                new TextEncoder().encode(payload),
                { reliable: false }
            );
        }

        setTimeout(() => {
            setFloatingEmojis(prev => prev.filter(e => e.id !== baseId));
        }, 2600);
    }, []);

    const handleTerminateMeeting = async () => {
        if (window.confirm("End meeting for everyone?")) {
            try {
                await axios.post(`${BACKEND_URL}/api/terminate-room`, { room_name: roomName });
            } catch (err) {
                console.error(err);
            }
            setInMeeting(false);
            setToken('');
            setRoomName('');
        }
    };

    const copyInviteLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/?room=${roomName}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (inMeeting && token && serverUrl) {
        return (
            <div style={{ height: '100dvh', width: '100vw', background: '#090d16', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header */}
                <div className="mobile-header" style={headerBarStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ fontWeight: '800', color: '#38bdf8', fontSize: '0.85rem' }}>MeetMatrix</span>
                        <span style={{ color: '#475569' }}>|</span>
                        <span className="mobile-room-pill" style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>{roomName}</span>
                        {isHost && <span style={{ background: '#0284c7', color: '#fff', padding: '1px 4px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' }}>HOST</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: '2px', background: '#1e293b', padding: '1px 3px', borderRadius: '6px', alignItems: 'center' }}>
                            {['👍', '❤️'].map(e => (
                                <button key={e} onClick={() => triggerReactionBroadcast(e, true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '1px' }}>{e}</button>
                            ))}
                            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: '#334155', border: 'none', color: '#38bdf8', borderRadius: '4px', padding: '2px', cursor: 'pointer' }}><Plus size={11} /></button>
                        </div>

                        {showEmojiPicker && (
                            <div className="emoji-popover">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8' }}>REACTIONS</span>
                                    <button onClick={() => setShowEmojiPicker(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={14} /></button>
                                </div>
                                <div className="emoji-grid">
                                    {EMOJI_PALETTE.map((e, idx) => (
                                        <button key={`${e}-${idx}`} onClick={() => triggerReactionBroadcast(e, true)} className="emoji-tile">{e}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isHost && (
                            <button onClick={() => window.open(`${BACKEND_URL}/api/attendance/export/${roomName}`, '_blank')} className="mobile-hide" style={topBtnStyle}>
                                <Download size={12} /> CSV
                            </button>
                        )}

                        <button onClick={copyInviteLink} style={{ ...topBtnStyle, padding: '4px 6px', background: copied ? '#10b981' : '#0284c7' }}>
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            <span className="mobile-hide">{copied ? 'Copied' : 'Invite'}</span>
                        </button>
                    </div>
                </div>

                {/* Safe LiveKit Stage */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                    <LiveKitRoom
                        video={cameraEnabled}
                        audio={micEnabled}
                        token={token}
                        serverUrl={serverUrl}
                        data-lk-theme="default"
                        style={{ height: '100%', width: '100%' }}
                        onConnected={(roomInstance) => { activeRoomRef.current = roomInstance; }}
                        onDisconnected={() => { setInMeeting(false); setToken(''); }}
                    >
                        <MeetingStage
                            roomName={roomName}
                            isHost={isHost}
                            participantName={participantName}
                            setParticipantName={setParticipantName}
                            initialCam={cameraEnabled}
                            initialMic={micEnabled}
                            onLeave={() => { setInMeeting(false); setToken(''); }}
                            onTerminate={handleTerminateMeeting}
                            showWhiteboard={showWhiteboard}
                            setShowWhiteboard={setShowWhiteboard}
                            allowScreenshare={allowScreenshare}
                            allowDirectChat={allowDirectChat}
                            chatLocked={chatLocked}
                            floatingEmojis={floatingEmojis}
                            triggerReactionBroadcast={triggerReactionBroadcast}
                        />
                    </LiveKitRoom>
                </div>
            </div>
        );
    }

    // Lobby
    return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #1e293b 0%, #090d16 100%)', color: '#f8fafc', padding: '12px' }}>

            {showPreSettingsModal && (
                <div style={modalBackdropStyle}>
                    <div style={modalCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#38bdf8' }}>Meeting Configuration</h3>
                            <button onClick={() => setShowPreSettingsModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                            <div>
                                <label style={settingLabelStyle}>Waiting Room Entry Policy</label>
                                <select value={waitingMode} onChange={(e) => setWaitingMode(e.target.value)} style={selectInputStyle}>
                                    <option value="direct">Direct Bypass (Instant Join)</option>
                                    <option value="strict">Strict (Host Approval Required)</option>
                                    <option value="open">Open Collaboration</option>
                                </select>
                            </div>

                            <label style={checkboxRowStyle}>
                                <input type="checkbox" checked={allowScreenshare} onChange={(e) => setAllowScreenshare(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                <span>Allow Participants to Share Screen</span>
                            </label>

                            <label style={checkboxRowStyle}>
                                <input type="checkbox" checked={allowDirectChat} onChange={(e) => setAllowDirectChat(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                <span>Allow 1-on-1 Direct Chat Between Participants</span>
                            </label>

                            <label style={checkboxRowStyle}>
                                <input type="checkbox" checked={chatLocked} onChange={(e) => setChatLocked(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                <span>Lock Chat by Default</span>
                            </label>
                        </div>

                        <button onClick={handleConfirmAndLaunchRoom} style={primaryBtnStyle}>
                            🚀 Launch Meeting Now
                        </button>
                    </div>
                </div>
            )}

            <div style={{ background: '#131b2e', borderRadius: '16px', width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', border: '1px solid #1e293b', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

                    {/* Green Room Preview */}
                    <div style={{ padding: '1.5rem', background: '#0c1222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <h3 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.8rem' }}>Green Room Preview</h3>
                        <div style={{ width: '100%', maxWidth: '320px', height: '190px', background: '#000', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                            <video ref={videoPreviewRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            {!cameraEnabled && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090d16', color: '#64748b', fontSize: '0.85rem' }}>
                                    Camera is turned off
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                            <button onClick={toggleLobbyCam} style={{ ...toggleBtnStyle, background: cameraEnabled ? '#334155' : '#ef4444' }}>
                                {cameraEnabled ? <Video size={15} /> : <VideoOff size={15} />} {cameraEnabled ? 'Cam On' : 'Cam Off'}
                            </button>
                            <button onClick={toggleLobbyMic} style={{ ...toggleBtnStyle, background: micEnabled ? '#334155' : '#ef4444' }}>
                                {micEnabled ? <Mic size={15} /> : <MicOff size={15} />} {micEnabled ? 'Mic On' : 'Mic Off'}
                            </button>
                        </div>
                    </div>

                    {/* Controls */}
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#38bdf8', marginBottom: '1rem' }}>MeetMatrix</h1>

                        {user && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '6px 12px', borderRadius: '20px', marginBottom: '12px', border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    {user.picture ? <img src={user.picture} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%' }} /> : <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0284c7' }} />}
                                    <span style={{ fontSize: '0.8rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
                                </div>
                                <button onClick={() => { localStorage.removeItem('meetmatrix_user'); setUser(null); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer' }}>Switch</button>
                            </div>
                        )}

                        <button onClick={handleStartCreateMeeting} disabled={loading} style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {!user && <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" style={{ width: '16px', height: '16px' }} />}
                            {user ? `⚡ Configure & Create Meeting` : `Sign in & Create Meeting`}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#475569' }}>
                            <hr style={{ flex: 1, borderColor: '#1e293b' }} />
                            <span style={{ padding: '0 8px', fontSize: '0.7rem' }}>OR JOIN EXISTING</span>
                            <hr style={{ flex: 1, borderColor: '#1e293b' }} />
                        </div>

                        <form onSubmit={handleJoinClick}>
                            <input type="text" placeholder="Enter Room Code (e.g. mm-xxxx-xxxx)" value={roomName} onChange={(e) => setRoomName(e.target.value)} style={{ ...inputStyle, marginBottom: '0.8rem' }} />
                            <button type="submit" disabled={loading} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {!user && <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" style={{ width: '16px', height: '16px' }} />}
                                {user ? `Join Meeting as ${user.name.split(' ')[0]}` : `Sign in & Join Meeting`}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

const inputStyle = { width: '100%', padding: '10px 12px', background: '#090d16', border: '1px solid #334155', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
const primaryBtnStyle = { width: '100%', padding: '11px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' };
const secondaryBtnStyle = { width: '100%', padding: '10px', background: 'transparent', border: '1px solid #0284c7', color: '#38bdf8', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' };
const topBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '5px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '500' };
const toggleBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff', border: 'none', padding: '7px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' };
const controlBtn = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '6px 10px', borderRadius: '8px', fontSize: '0.65rem', cursor: 'pointer', minWidth: '46px', fontWeight: '500' };
const bottomBarStyle = { background: '#0f172a', borderTop: '1px solid #334155', padding: '8px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', zIndex: 100, flexShrink: 0 };
const headerBarStyle = { background: '#0f172a', color: '#f8fafc', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', zIndex: 1000, flexShrink: 0 };
const sideDrawerStyle = { width: '320px', maxWidth: '85vw', background: '#0f172a', borderLeft: '1px solid #334155', height: '100%', zIndex: 50, position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column' };
const drawerHeaderStyle = { padding: '12px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const drawerCloseBtn = { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' };
const drawerActionBtn = { background: 'transparent', border: 'none', color: '#94a3b8', padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center' };
const contextMenuStyle = { position: 'absolute', right: 0, top: '26px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '4px', zIndex: 999, minWidth: '130px', boxShadow: '0 8px 16px rgba(0,0,0,0.5)' };
const contextMenuItemStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' };
const modalBackdropStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };
const modalCardStyle = { background: '#131b2e', border: '1px solid #38bdf8', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px rgba(0,0,0,0.7)' };
const settingLabelStyle = { fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '600' };
const selectInputStyle = { width: '100%', padding: '8px', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '0.8rem' };
const checkboxRowStyle = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', color: '#f8fafc' };