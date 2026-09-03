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
    Users, Hand, Send, Edit3, VolumeX, MoreVertical, Smile, Shield, ShieldCheck,
    Calendar, Trash2, Sliders, Play, DoorOpen, PauseCircle, AlertTriangle
} from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import Whiteboard from './Whiteboard';

const BACKEND_URL = 'https://meetmatrix-backend-3l9l.onrender.com';

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
                          setAllowScreenshare,
                          allowDirectChat,
                          setAllowDirectChat,
                          chatLocked,
                          setChatLocked,
                          waitingMode,
                          setWaitingMode,
                          allowWhiteboard,
                          setAllowWhiteboard,
                          allowReactions,
                          setAllowReactions
                      }) {
    const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();
    const remoteParticipants = useRemoteParticipants();
    const room = useRoomContext();

    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [raisedHandsMap, setRaisedHandsMap] = useState({});
    const [holdParticipantsMap, setHoldParticipantsMap] = useState({});

    const [coHostsMap, setCoHostsMap] = useState({});
    const [waitingList, setWaitingList] = useState([]);
    const [showAdmitModal, setShowAdmitModal] = useState(false);

    const [showChat, setShowChat] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [showInMeetingSettings, setShowInMeetingSettings] = useState(false);
    const [activeMenuIdentity, setActiveMenuIdentity] = useState(null);

    const [floatingEmojis, setFloatingEmojis] = useState([]);

    const [quickEmojis, setQuickEmojis] = useState(() => {
        try {
            const saved = localStorage.getItem('meetmatrix_quick_emojis');
            return saved ? JSON.parse(saved) : ['👍', '❤️', '👏', '🔥', '🎉'];
        } catch {
            return ['👍', '❤️', '👏', '🔥', '🎉'];
        }
    });

    const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
    const [activeSlotToReplace, setActiveSlotToReplace] = useState(0);
    const activeSlotRef = useRef(activeSlotToReplace);

    const selectSlot = (idx) => {
        activeSlotRef.current = idx;
        setActiveSlotToReplace(idx);
    };

    const handleEmojiSelectedForSlot = useCallback((emojiData) => {
        const targetIdx = activeSlotRef.current;
        setQuickEmojis(prev => {
            if (prev[targetIdx] === emojiData.emoji) return prev;
            const updated = [...prev];
            updated[targetIdx] = emojiData.emoji;
            return updated;
        });
        setIsCustomizeOpen(false);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('meetmatrix_quick_emojis', JSON.stringify(quickEmojis));
        } catch (e) {}
    }, [quickEmojis]);

    const [showChatEmojiPicker, setShowChatEmojiPicker] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(participantName);

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatRecipient, setChatRecipient] = useState('Everyone');

    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const isCoHost = Boolean(coHostsMap[localParticipant?.identity]);
    const isEffectiveModerator = isHost || isCoHost;

    const allTracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    const screenShareTrack = allTracks.find(t => t.source === Track.Source.ScreenShare);
    const cameraTracks = allTracks.filter(t => t.source === Track.Source.Camera);

    // Mute on entry and Camera setup
    useEffect(() => {
        if (!localParticipant) return;
        localParticipant.setName(participantName);

        // Respect mute on entry flag
        if (!initialMic) {
            localParticipant.setMicrophoneEnabled(false).catch(() => {});
        }
        if (!initialCam) {
            localParticipant.setCameraEnabled(false).catch(() => {});
        }
    }, [localParticipant, initialCam, initialMic, participantName]);

    // Track user hold and log to backend attendance
    useEffect(() => {
        if (!room || !localParticipant) return;

        const handleVisibilityChange = () => {
            if (localParticipant.isScreenShareEnabled) return;

            const isHidden = document.visibilityState === 'hidden';
            setHoldParticipantsMap(prev => ({
                ...prev,
                [localParticipant.identity]: isHidden
            }));

            const payload = JSON.stringify({
                type: 'user_hold_status',
                identity: localParticipant.identity,
                isOnHold: isHidden
            });
            room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });

            if (isHidden) {
                axios.post(`${BACKEND_URL}/api/attendance/update`, {
                    room_name: roomName,
                    participant_name: participantName,
                    was_on_hold: true,
                    action: "hold_update"
                }).catch(() => {});
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [room, localParticipant, roomName, participantName]);

    // Live Room Settings Sync
    useEffect(() => {
        let interval;
        if (roomName) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${BACKEND_URL}/api/room-settings/${roomName}`);
                    if (res.data) {
                        setAllowScreenshare(Boolean(res.data.allow_participant_screenshare));
                        setChatLocked(Boolean(res.data.chat_locked));
                        setWaitingMode(res.data.waiting_mode || 'direct');
                        if (res.data.allow_reactions !== undefined) setAllowReactions(Boolean(res.data.allow_reactions));
                        if (res.data.allow_whiteboard !== undefined) setAllowWhiteboard(Boolean(res.data.allow_whiteboard));
                        if (res.data.allow_direct_chat !== undefined) setAllowDirectChat(Boolean(res.data.allow_direct_chat));
                    }
                } catch (e) {}
            }, 1200);
        }
        return () => clearInterval(interval);
    }, [roomName, setAllowScreenshare, setChatLocked, setWaitingMode, setAllowReactions, setAllowWhiteboard, setAllowDirectChat]);

    // Waiting List Poller
    useEffect(() => {
        let interval;
        if (isEffectiveModerator && roomName && waitingMode === 'strict') {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${BACKEND_URL}/api/waiting-list/${roomName}`);
                    const pending = res.data.waiting || [];
                    setWaitingList(pending);

                    if (pending.length > 0 && screenShareTrack) {
                        setShowAdmitModal(true);
                    }
                } catch (e) {}
            }, 800);
        }
        return () => clearInterval(interval);
    }, [isEffectiveModerator, roomName, screenShareTrack, waitingMode]);

    useEffect(() => {
        if (!localParticipant) return;
        const syncShareStatus = () => {
            setIsScreenSharing(Boolean(localParticipant.isScreenShareEnabled));
        };
        syncShareStatus();
        localParticipant.on('trackPublished', syncShareStatus);
        localParticipant.on('trackUnpublished', syncShareStatus);
        localParticipant.on('localTrackUnpublished', syncShareStatus);

        return () => {
            localParticipant.off('trackPublished', syncShareStatus);
            localParticipant.off('trackUnpublished', syncShareStatus);
            localParticipant.off('localTrackUnpublished', syncShareStatus);
        };
    }, [localParticipant, allTracks]);

    const renderLocalFloatingEmoji = (emoji, sender) => {
        const baseId = Date.now() + Math.random();
        setFloatingEmojis(prev => [...prev, { id: baseId, emoji, sender, left: Math.random() * 50 + 25 }]);
        setTimeout(() => {
            setFloatingEmojis(prev => prev.filter(e => e.id !== baseId));
        }, 2800);
    };

    useEffect(() => {
        if (!room) return;

        const handleDataReceived = (payload, participant) => {
            try {
                const decoded = new TextDecoder().decode(payload);
                const data = JSON.parse(decoded);

                if (data.type === 'settings_update') {
                    if (data.allow_participant_screenshare !== undefined) setAllowScreenshare(data.allow_participant_screenshare);
                    if (data.chat_locked !== undefined) setChatLocked(data.chat_locked);
                    if (data.waiting_mode !== undefined) setWaitingMode(data.waiting_mode);
                    if (data.allow_reactions !== undefined) setAllowReactions(data.allow_reactions);
                    if (data.allow_whiteboard !== undefined) setAllowWhiteboard(data.allow_whiteboard);
                    if (data.allow_direct_chat !== undefined) setAllowDirectChat(data.allow_direct_chat);
                } else if (data.type === 'user_hold_status') {
                    setHoldParticipantsMap(prev => ({
                        ...prev,
                        [data.identity]: data.isOnHold
                    }));
                } else if (data.type === 'co_host_update') {
                    setCoHostsMap(prev => ({ ...prev, [data.targetIdentity]: data.isCoHost }));
                } else if (data.type === 'reaction') {
                    if (allowReactions) {
                        renderLocalFloatingEmoji(data.emoji, data.sender || participant.name || 'User');
                    }
                } else if (data.type === 'hand_raise') {
                    setRaisedHandsMap(prev => ({ ...prev, [participant.identity]: data.raised }));
                } else if (data.type === 'chat') {
                    const isForMe = data.recipient === 'Everyone' ||
                        data.recipient === localParticipant?.identity ||
                        participant.identity === localParticipant?.identity ||
                        (data.recipient === 'HostOnly' && isEffectiveModerator);

                    if (isForMe) {
                        setChatMessages(prev => [...prev, {
                            sender: participant.name || participant.identity,
                            text: data.text,
                            recipient: data.recipient,
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }]);
                    }
                } else if (data.type === 'force_mute' && data.targetIdentity === localParticipant?.identity) {
                    if (!isHost) {
                        localParticipant.setMicrophoneEnabled(false);
                    }
                } else if (data.type === 'mute_all') {
                    // Direct Instant Mute for all non-hosts (Zero Dialogs)
                    if (!isHost) {
                        localParticipant.setMicrophoneEnabled(false);
                    }
                } else if (data.type === 'kick_user' && data.targetIdentity === localParticipant?.identity) {
                    if (!isHost) {
                        alert("You were removed from the meeting.");
                        onLeave();
                    }
                }
            } catch (err) {}
        };

        room.on('dataReceived', handleDataReceived);
        return () => room.off('dataReceived', handleDataReceived);
    }, [room, localParticipant, onLeave, setAllowScreenshare, setChatLocked, setWaitingMode, setAllowReactions, setAllowWhiteboard, setAllowDirectChat, allowReactions, isEffectiveModerator, isHost]);

    const triggerReactionBroadcast = (emoji) => {
        if (!allowReactions) {
            alert("Emoji reactions are disabled.");
            return;
        }
        const sender = participantName || localParticipant?.name || 'You';
        renderLocalFloatingEmoji(emoji, sender);

        if (room?.localParticipant) {
            const payload = JSON.stringify({ type: 'reaction', emoji, sender });
            room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: false });
        }
    };

    const handleChatEmojiPicked = (emojiData) => {
        setChatInput(prev => prev + emojiData.emoji);
        setShowChatEmojiPicker(false);
    };

    const toggleVideo = async () => {
        if (!localParticipant) return;
        try {
            await localParticipant.setCameraEnabled(!isCameraEnabled, { facingMode: 'user' });
        } catch (err) {}
    };

    const toggleMic = async () => {
        if (!localParticipant) return;
        try {
            await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
        } catch (err) {}
    };

    const toggleScreenShare = async () => {
        if (!isEffectiveModerator && !allowScreenshare) {
            alert("Screen sharing is restricted by Host.");
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert("Screen sharing supported on desktop browsers.");
            return;
        }
        if (localParticipant) {
            const nextState = !isScreenSharing;
            try {
                await localParticipant.setScreenShareEnabled(nextState);
                setIsScreenSharing(nextState);
            } catch (e) {
                setIsScreenSharing(Boolean(localParticipant.isScreenShareEnabled));
            }
        }
    };

    const toggleHandRaise = () => {
        if (!localParticipant || !room) return;
        const nextState = !isHandRaised;
        setIsHandRaised(nextState);

        setRaisedHandsMap(prev => ({ ...prev, [localParticipant.identity]: nextState }));

        const payload = JSON.stringify({ type: 'hand_raise', raised: nextState });
        room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    };

    const handleSaveName = () => {
        if (!editNameValue.trim() || !localParticipant) return;
        localParticipant.setName(editNameValue.trim());
        setParticipantName(editNameValue.trim());
        setIsEditingName(false);
    };

    const handleHostMute = (identity) => {
        if (!isEffectiveModerator || !room) return;
        const payload = JSON.stringify({ type: 'force_mute', targetIdentity: identity });
        room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
        setActiveMenuIdentity(null);
    };

    // Direct Instant Mute All (No alerts, zero delay)
    const handleMuteAll = () => {
        if (!isEffectiveModerator || !room) return;
        const payload = JSON.stringify({ type: 'mute_all' });
        room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    };

    const handleHostKick = async (identity, targetName, targetIsHost) => {
        if (targetIsHost) {
            alert("Host cannot be removed!");
            return;
        }
        if (!isEffectiveModerator) return;
        if (window.confirm(`Remove ${targetName || 'user'}?`)) {
            try {
                const payload = JSON.stringify({ type: 'kick_user', targetIdentity: identity });
                room?.localParticipant?.publishData(new TextEncoder().encode(payload), { reliable: true });

                await axios.post(`${BACKEND_URL}/api/kick-participant`, {
                    room_name: roomName,
                    participant_identity: identity,
                    participant_name: targetName
                });
            } catch (err) {}
            setActiveMenuIdentity(null);
        }
    };

    const handleToggleCoHost = (identity) => {
        if (!isHost || !room) return;
        const nextStatus = !coHostsMap[identity];
        setCoHostsMap(prev => ({ ...prev, [identity]: nextStatus }));

        const payload = JSON.stringify({
            type: 'co_host_update',
            targetIdentity: identity,
            isCoHost: nextStatus
        });
        room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
        setActiveMenuIdentity(null);
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
            alert("Admission error: " + e.message);
        }
    };

    const handleLeaveMeeting = async () => {
        try {
            await axios.post(`${BACKEND_URL}/api/attendance/update`, {
                room_name: roomName,
                participant_name: participantName,
                action: "leave"
            });
        } catch (e) {}
        onLeave();
    };

    const handleUpdateLiveRoomSettings = async (updates) => {
        try {
            await axios.post(`${BACKEND_URL}/api/update-room-settings`, {
                room_name: roomName,
                ...updates
            });

            if (room?.localParticipant) {
                const payload = JSON.stringify({
                    type: 'settings_update',
                    ...updates
                });
                room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
            }
        } catch (e) {}
    };

    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !room) return;
        if (chatLocked && !isEffectiveModerator && chatRecipient !== 'HostOnly') {
            alert("Chat locked. Select 'Host Only'.");
            return;
        }

        const messageData = {
            type: 'chat',
            text: chatInput.trim(),
            recipient: chatRecipient
        };

        room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(messageData)), { reliable: true });

        setChatMessages(prev => [...prev, {
            sender: 'You',
            text: chatInput.trim(),
            recipient: chatRecipient,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        setChatInput('');
        setShowChatEmojiPicker(false);
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert("Recording supported on PC browsers.");
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
        } catch (err) {}
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
    };

    // Participants list
    const allPeers = [
        {
            identity: localParticipant?.identity,
            name: `${participantName} (You)`,
            isHost: isHost,
            isCoHost: isCoHost,
            isSelf: true,
            isOnHold: !!holdParticipantsMap[localParticipant?.identity],
            isHandRaised: !!raisedHandsMap[localParticipant?.identity]
        },
        ...remoteParticipants.map(p => ({
            identity: p.identity,
            name: p.name || p.identity,
            isHost: !isHost && (p.identity?.includes('Host') || p.name?.includes('Host')),
            isCoHost: Boolean(coHostsMap[p.identity]),
            isSelf: false,
            isOnHold: !!holdParticipantsMap[p.identity],
            isHandRaised: !!raisedHandsMap[p.identity]
        }))
    ];

    const getGridClass = () => {
        if (cameraTracks.length <= 1) return 'matrix-grid-1';
        if (cameraTracks.length === 2) return 'matrix-grid-2';
        return 'matrix-grid-multi';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative', overflow: 'hidden', background: '#090d16' }}>
            <RoomAudioRenderer />

            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 99999 }}>
                {floatingEmojis.map(item => (
                    <div key={item.id} className="floating-emoji-item" style={{ left: `${item.left}%` }}>
                        <span className="floating-emoji-icon">{item.emoji}</span>
                        <span className="floating-emoji-sender">{item.sender}</span>
                    </div>
                ))}
            </div>

            {/* Header Bar */}
            <div className="mobile-header" style={headerBarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontWeight: '900', letterSpacing: '0.5px', background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '0.92rem' }}>MeetMatrix</span>
                    <span style={{ color: '#334155' }}>|</span>
                    <span className="mobile-room-pill" style={{ fontSize: '0.72rem', color: '#94a3b8', background: '#1e293b', padding: '2px 8px', borderRadius: '12px', border: '1px solid #334155' }}>{roomName}</span>
                    {isHost && <span style={{ background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: '800' }}>HOST</span>}
                    {!isHost && isCoHost && (
                        <span style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: '800' }}>CO-HOST</span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
                    {allowReactions && (
                        <div style={{ display: 'flex', gap: '3px', background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(8px)', padding: '3px 6px', borderRadius: '10px', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {quickEmojis.map((e, idx) => (
                                <button
                                    key={`${e}-${idx}`}
                                    onClick={() => triggerReactionBroadcast(e)}
                                    title="React"
                                    style={interactiveEmojiBtn}
                                >
                                    {e}
                                </button>
                            ))}

                            <button
                                onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
                                style={editChipBtn}
                                title="Edit Emojis"
                            >
                                <Edit3 size={11} /> {isCustomizeOpen ? 'Done' : 'Edit'}
                            </button>
                        </div>
                    )}

                    {isCustomizeOpen && allowReactions && (
                        <div style={{ position: 'absolute', top: '44px', right: 0, zIndex: 99999, boxShadow: '0 20px 40px rgba(0,0,0,0.85)', borderRadius: '12px', overflow: 'hidden', background: '#0f172a', border: '1px solid #334155' }}>
                            <div style={{ padding: '8px 10px', borderBottom: '1px solid #334155' }}>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Select Slot to Replace:</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {quickEmojis.map((em, i) => (
                                        <button
                                            key={i}
                                            onClick={() => selectSlot(i)}
                                            style={{
                                                flex: 1,
                                                padding: '6px',
                                                background: activeSlotToReplace === i ? '#0284c7' : '#1e293b',
                                                border: activeSlotToReplace === i ? '2px solid #38bdf8' : '1px solid #334155',
                                                color: '#fff',
                                                borderRadius: '6px',
                                                fontSize: '0.9rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {em}
                                            <span style={{ display: 'block', fontSize: '0.55rem', color: activeSlotToReplace === i ? '#fff' : '#94a3b8' }}>#{i + 1}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <EmojiPicker
                                key={activeSlotToReplace}
                                onEmojiClick={handleEmojiSelectedForSlot}
                                theme={Theme.DARK}
                                width={310}
                                height={340}
                                searchDisabled={false}
                                previewConfig={{ showPreview: false }}
                            />
                        </div>
                    )}

                    {/* People Button */}
                    <button
                        onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }}
                        style={{ ...topBtnStyle, background: showParticipants ? '#0284c7' : '#1e293b', color: '#fff' }}
                        title="View Participants"
                    >
                        <Users size={14} />
                        <span>People ({allPeers.length})</span>
                    </button>

                    {/* Lobby Button: Only shown if not in direct bypass */}
                    {isEffectiveModerator && waitingMode !== 'direct' && (
                        <button
                            onClick={() => setShowAdmitModal(!showAdmitModal)}
                            style={{
                                ...topBtnStyle,
                                background: waitingList.length > 0 ? '#eab308' : '#1e293b',
                                color: waitingList.length > 0 ? '#0f172a' : '#cbd5e1',
                                fontWeight: waitingList.length > 0 ? '900' : '600'
                            }}
                            title="Lobby Admission Requests"
                        >
                            <DoorOpen size={14} />
                            <span>Lobby{waitingList.length > 0 ? ` (${waitingList.length})` : ''}</span>
                        </button>
                    )}

                    {isHost && (
                        <button
                            onClick={() => setShowInMeetingSettings(!showInMeetingSettings)}
                            style={topBtnStyle}
                            title="Host Security Settings"
                        >
                            <Settings size={14} />
                        </button>
                    )}

                    {/* Attendance Export Button */}
                    {isHost && (
                        <button
                            onClick={() => {
                                window.location.href = `${BACKEND_URL}/api/attendance/export/${roomName}`;
                            }}
                            className="mobile-hide"
                            style={topBtnStyle}
                            title="Download CSV Attendance Report"
                        >
                            <Download size={12} /> CSV
                        </button>
                    )}

                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?room=${roomName}`); alert("Invite Copied!"); }} style={{ ...topBtnStyle, background: '#0284c7', color: '#fff' }}>
                        <Copy size={12} />
                        <span className="mobile-hide">Invite</span>
                    </button>
                </div>
            </div>

            {/* Waiting Requests Modal */}
            {showAdmitModal && isEffectiveModerator && (
                <div style={{ position: 'fixed', top: '55px', right: '14px', background: 'rgba(15, 23, 42, 0.96)', backdropFilter: 'blur(16px)', padding: '14px', borderRadius: '14px', border: '2px solid #eab308', boxShadow: '0 25px 50px rgba(0,0,0,0.85)', zIndex: 99999, width: '300px', color: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={16} color="#eab308" />
                            <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#eab308', fontWeight: '800' }}>Waiting Requests ({waitingList.length})</h4>
                        </div>
                        <button onClick={() => setShowAdmitModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16} /></button>
                    </div>

                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                        {waitingList.length === 0 ? (
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '10px 0', textAlign: 'center' }}>No participants waiting in lobby.</p>
                        ) : (
                            waitingList.map(p => (
                                <div key={p.participant_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', borderBottom: '1px solid #334155', background: '#090d16', borderRadius: '6px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.82rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px', fontWeight: '600' }}>
                                        {p.name}
                                    </span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={() => handleAdmitAction(p.participant_id, 'admit')}
                                            style={{ background: '#10b981', border: 'none', color: '#fff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: '700' }}
                                        >
                                            <UserCheck size={13} /> Admit
                                        </button>
                                        <button
                                            onClick={() => handleAdmitAction(p.participant_id, 'reject')}
                                            style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: '700' }}
                                        >
                                            <UserX size={13} /> Deny
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Host Security Live Controls */}
            {showInMeetingSettings && isHost && (
                <div style={{ position: 'fixed', top: '55px', right: '14px', background: 'rgba(30, 41, 59, 0.95)', backdropFilter: 'blur(16px)', padding: '16px', borderRadius: '14px', border: '2px solid #38bdf8', boxShadow: '0 25px 50px rgba(0,0,0,0.85)', zIndex: 99999, width: '310px', color: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#38bdf8', fontWeight: '800' }}>Host Security Controls</h4>
                        <button onClick={() => setShowInMeetingSettings(false)} style={{ background: 'transparent', border: 'none', color: '#f8fafc', cursor: 'pointer' }}><X size={16} /></button>
                    </div>

                    {/* Direct Instant Mute All */}
                    <button
                        onClick={handleMuteAll}
                        style={{ width: '100%', background: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        <VolumeX size={14} /> Mute All Participants Instantly
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '12px' }}>
                        <label style={checkboxRowStyle}>
                            <input
                                type="checkbox"
                                checked={allowScreenshare}
                                onChange={(e) => {
                                    setAllowScreenshare(e.target.checked);
                                    handleUpdateLiveRoomSettings({ allow_participant_screenshare: e.target.checked });
                                }}
                                style={{ accentColor: '#38bdf8' }}
                            />
                            <span>Allow Participant Screen Sharing</span>
                        </label>

                        <label style={checkboxRowStyle}>
                            <input
                                type="checkbox"
                                checked={chatLocked}
                                onChange={(e) => {
                                    setChatLocked(e.target.checked);
                                    handleUpdateLiveRoomSettings({ chat_locked: e.target.checked });
                                }}
                                style={{ accentColor: '#38bdf8' }}
                            />
                            <span>Lock Public Chat</span>
                        </label>

                        <label style={checkboxRowStyle}>
                            <input
                                type="checkbox"
                                checked={allowDirectChat}
                                onChange={(e) => {
                                    setAllowDirectChat(e.target.checked);
                                    handleUpdateLiveRoomSettings({ allow_direct_chat: e.target.checked });
                                }}
                                style={{ accentColor: '#38bdf8' }}
                            />
                            <span>Allow 1-on-1 Direct Chat</span>
                        </label>

                        <label style={checkboxRowStyle}>
                            <input
                                type="checkbox"
                                checked={allowWhiteboard}
                                onChange={(e) => {
                                    setAllowWhiteboard(e.target.checked);
                                    handleUpdateLiveRoomSettings({ allow_whiteboard: e.target.checked });
                                }}
                                style={{ accentColor: '#38bdf8' }}
                            />
                            <span>Enable Whiteboard</span>
                        </label>

                        <label style={checkboxRowStyle}>
                            <input
                                type="checkbox"
                                checked={allowReactions}
                                onChange={(e) => {
                                    setAllowReactions(e.target.checked);
                                    handleUpdateLiveRoomSettings({ allow_reactions: e.target.checked });
                                }}
                                style={{ accentColor: '#38bdf8' }}
                            />
                            <span>Allow Emoji Reactions</span>
                        </label>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: '700' }}>Waiting Room Mode:</label>
                        <select
                            value={waitingMode}
                            onChange={(e) => {
                                setWaitingMode(e.target.value);
                                handleUpdateLiveRoomSettings({ waiting_mode: e.target.value });
                            }}
                            style={{ width: '100%', padding: '7px', background: '#090d16', border: '1px solid #475569', color: '#fff', borderRadius: '6px', fontSize: '0.8rem' }}
                        >
                            <option value="direct">Direct Bypass (Instant Entry)</option>
                            <option value="strict">Strict (Host Approval Required)</option>
                            <option value="open">Open Collaboration</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Video Viewport */}
            <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
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
                                    const isOnHold = !!holdParticipantsMap[peerId];
                                    return (
                                        <div key={track.publication?.trackSid || peerId} style={{ position: 'relative', height: '100%' }}>
                                            {isOnHold && !isScreenSharing && <div className="video-hold-badge"><PauseCircle size={12} /> ON HOLD</div>}
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
                                const isOnHold = !!holdParticipantsMap[peerId];
                                return (
                                    <div key={track.publication?.trackSid || peerId} className="video-tile-wrapper">
                                        {isOnHold && !isScreenSharing && (
                                            <div className="video-hold-badge">
                                                <PauseCircle size={14} /> AWAY / ON HOLD
                                            </div>
                                        )}
                                        {hasHandRaised && <div className="video-hand-badge">✋ Hand Raised</div>}
                                        <ParticipantTile trackRef={track} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Participants Drawer */}
                {showParticipants && (
                    <div style={sideDrawerStyle}>
                        <div style={drawerHeaderStyle}>
                            <span style={{ fontWeight: '800', fontSize: '0.88rem' }}>Participants ({allPeers.length})</span>
                            <button onClick={() => setShowParticipants(false)} style={drawerCloseBtn}><X size={16} /></button>
                        </div>

                        <div style={{ padding: '8px', overflowY: 'auto', flex: 1 }}>
                            {allPeers.map(p => (
                                <div key={p.identity} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px', borderBottom: '1px solid #1e293b' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: p.isHost ? '#0284c7' : p.isCoHost ? '#059669' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 'bold', flexShrink: 0 }}>
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
                                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                <span style={{ fontSize: '0.82rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {p.name} {p.isHandRaised && <span title="Hand Raised" style={{ marginLeft: '4px' }}>✋</span>}
                                                    {p.isOnHold && !isScreenSharing && <span style={{ color: '#eab308', fontSize: '0.7rem', marginLeft: '6px', fontWeight: '700' }}>(On Hold)</span>}
                                                </span>
                                                <span style={{ fontSize: '0.65rem', color: p.isHost ? '#38bdf8' : p.isCoHost ? '#34d399' : '#94a3b8', fontWeight: '800' }}>
                                                    {p.isHost ? '👑 HOST' : p.isCoHost ? '🛡️ CO-HOST' : 'PARTICIPANT'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                        {p.isSelf && !isEditingName && (
                                            <button onClick={() => setIsEditingName(true)} style={drawerActionBtn} title="Rename">
                                                <Edit3 size={13} />
                                            </button>
                                        )}

                                        {isEffectiveModerator && !p.isSelf && !p.isHost && (
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    onClick={() => setActiveMenuIdentity(activeMenuIdentity === p.identity ? null : p.identity)}
                                                    style={drawerActionBtn}
                                                >
                                                    <MoreVertical size={14} />
                                                </button>

                                                {activeMenuIdentity === p.identity && (
                                                    <div style={contextMenuStyle}>
                                                        {isHost && (
                                                            <button onClick={() => handleToggleCoHost(p.identity)} style={contextMenuItemStyle}>
                                                                {p.isCoHost ? <Shield size={14} color="#ef4444" /> : <ShieldCheck size={14} color="#10b981" />}
                                                                {p.isCoHost ? 'Revoke Co-Host' : 'Make Co-Host'}
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleHostMute(p.identity)} style={contextMenuItemStyle}>
                                                            <VolumeX size={14} color="#f59e0b" /> Mute Audio
                                                        </button>
                                                        <button onClick={() => handleHostKick(p.identity, p.name, p.isHost)} style={{ ...contextMenuItemStyle, color: '#ef4444' }}>
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
                            <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>In-Meeting Chat</span>
                            <button onClick={() => setShowChat(false)} style={drawerCloseBtn}><X size={16} /></button>
                        </div>

                        <div style={{ padding: '6px 12px', background: '#090d16', borderBottom: '1px solid #1e293b' }}>
                            <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Send to:</label>
                            <select
                                value={chatRecipient}
                                onChange={(e) => setChatRecipient(e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', background: '#131b2e', border: '1px solid #334155', color: '#38bdf8', borderRadius: '6px', fontSize: '0.75rem' }}
                            >
                                <option value="Everyone">Everyone (Public)</option>
                                <option value="HostOnly">🛡️ Host Only (Private)</option>
                                {allowDirectChat && remoteParticipants.map(p => (
                                    <option key={p.identity} value={p.identity}>Direct: {p.name || p.identity}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {chatMessages.length === 0 ? (
                                <div style={{ color: '#64748b', fontSize: '0.75rem', textAlign: 'center', marginTop: '40px' }}>No messages yet. Say hello! 👋</div>
                            ) : (
                                chatMessages.map((msg, i) => (
                                    <div key={i} style={{ background: msg.recipient === 'HostOnly' ? '#451a03' : msg.recipient !== 'Everyone' ? '#1e1b4b' : '#1e293b', padding: '8px 10px', borderRadius: '8px', border: msg.recipient === 'HostOnly' ? '1px solid #f59e0b' : msg.recipient !== 'Everyone' ? '1px solid #818cf8' : 'none' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '0.7rem', color: '#94a3b8' }}>
                                            <span style={{ fontWeight: '700', color: msg.sender === 'You' ? '#38bdf8' : '#f8fafc' }}>
                                                {msg.sender} {msg.recipient === 'HostOnly' ? <span style={{ color: '#f59e0b' }}>[Host Only]</span> : msg.recipient !== 'Everyone' && <span style={{ color: '#a78bfa' }}>[Direct]</span>}
                                            </span>
                                            <span>{msg.time}</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#e2e8f0', wordBreak: 'break-word' }}>{msg.text}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {showChatEmojiPicker && (
                            <div style={{ position: 'absolute', bottom: '60px', right: '10px', zIndex: 99999 }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', background: '#0f172a', padding: '4px' }}>
                                    <button onClick={() => setShowChatEmojiPicker(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={14} /></button>
                                </div>
                                <EmojiPicker
                                    onEmojiClick={handleChatEmojiPicked}
                                    theme={Theme.DARK}
                                    width={290}
                                    height={330}
                                    searchDisabled={false}
                                    previewConfig={{ showPreview: false }}
                                />
                            </div>
                        )}

                        <form onSubmit={handleSendChat} style={{ padding: '8px 12px', background: '#090d16', borderTop: '1px solid #1e293b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setShowChatEmojiPicker(!showChatEmojiPicker)}
                                style={{ background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                title="Insert emoji into chat"
                            >
                                <Smile size={18} />
                            </button>
                            <input
                                type="text"
                                value={chatInput}
                                placeholder={chatLocked && !isEffectiveModerator && chatRecipient !== 'HostOnly' ? "Public chat locked. Select 'Host Only'" : `Message ${chatRecipient}...`}
                                onChange={(e) => setChatInput(e.target.value)}
                                style={{ flex: 1, padding: '8px 10px', background: '#131b2e', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', outline: 'none' }}
                            />
                            <button type="submit" style={{ background: '#0284c7', border: 'none', color: '#fff', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer' }}>
                                <Send size={14} />
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="mobile-control-bar" style={bottomBarStyle}>
                <button onClick={toggleMic} style={{ ...controlBtn, background: !isMicrophoneEnabled ? '#ef4444' : '#1e293b' }}>
                    {!isMicrophoneEnabled ? <MicOff size={18} /> : <Mic size={18} />}
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>{!isMicrophoneEnabled ? 'Unmute' : 'Mute'}</span>
                </button>

                <button onClick={toggleVideo} style={{ ...controlBtn, background: !isCameraEnabled ? '#ef4444' : '#1e293b' }}>
                    {!isCameraEnabled ? <VideoOff size={18} /> : <Video size={18} />}
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>{!isCameraEnabled ? 'Start Video' : 'Stop Video'}</span>
                </button>

                {!isHost && (
                    <button
                        onClick={toggleHandRaise}
                        style={{ ...controlBtn, background: isHandRaised ? '#eab308' : '#1e293b', color: isHandRaised ? '#000' : '#fff' }}
                        title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
                    >
                        <Hand size={18} />
                        <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>{isHandRaised ? 'Lower' : 'Raise'}</span>
                    </button>
                )}

                <button
                    onClick={toggleScreenShare}
                    style={{ ...controlBtn, background: isScreenSharing ? '#0284c7' : '#1e293b', opacity: (!isEffectiveModerator && !allowScreenshare) ? 0.4 : 1 }}
                >
                    <MonitorUp size={18} />
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>{isScreenSharing ? 'Sharing' : 'Share'}</span>
                </button>

                {(allowWhiteboard || isEffectiveModerator) && (
                    <button onClick={() => setShowWhiteboard(!showWhiteboard)} style={{ ...controlBtn, background: showWhiteboard ? '#0284c7' : '#1e293b' }}>
                        <PenTool size={18} />
                        <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>Board</span>
                    </button>
                )}

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
                    <button onClick={handleLeaveMeeting} style={{ ...controlBtn, background: '#e11d48', color: '#fff' }}>
                        <PhoneOff size={18} />
                        <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>Leave</span>
                    </button>
                )}
            </div>

            {showWhiteboard && (
                <Whiteboard
                    isModerator={isEffectiveModerator}
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
    const [isInviteFlow, setIsInviteFlow] = useState(false);

    // Initial mute states from room configuration
    const [initialMuteAudio, setInitialMuteAudio] = useState(false);
    const [initialMuteVideo, setInitialMuteVideo] = useState(false);

    const [showPreSettingsModal, setShowPreSettingsModal] = useState(false);
    const [waitingMode, setWaitingMode] = useState('direct');
    const [chatLocked, setChatLocked] = useState(false);
    const [allowScreenshare, setAllowScreenshare] = useState(false);
    const [allowDirectChat, setAllowDirectChat] = useState(false);
    const [muteOnEntry, setMuteOnEntry] = useState(false);
    const [cameraOffOnEntry, setCameraOffOnEntry] = useState(false);
    const [allowWhiteboard, setAllowWhiteboard] = useState(false);
    const [allowReactions, setAllowReactions] = useState(false);

    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleTitle, setScheduleTitle] = useState('');
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduleDuration, setScheduleDuration] = useState(30);

    const [scheduledMeetings, setScheduledMeetings] = useState(() => {
        try {
            const saved = localStorage.getItem('meetmatrix_scheduled');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [micEnabled, setMicEnabled] = useState(true);
    const videoPreviewRef = useRef(null);
    const previewStreamRef = useRef(null);
    const isJoiningRef = useRef(false);

    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('meetmatrix_user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [authAction, setAuthAction] = useState(null);
    const [showWhiteboard, setShowWhiteboard] = useState(false);

    const stopLobbyPreviewTracks = () => {
        isJoiningRef.current = true;
        if (previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach(t => t.stop());
            previewStreamRef.current = null;
        }
        if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = null;
        }
    };

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
        if (roomParam) {
            setRoomName(roomParam);
            setIsInviteFlow(true);
        }
    }, []);

    // Fast Waiting Admission Lock
    useEffect(() => {
        let interval;
        if (isWaiting && waitingPid && roomName) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${BACKEND_URL}/api/check-admission/${roomName}/${waitingPid}`);
                    if (res.data.status === 'admitted') {
                        setIsWaiting(false);
                        const currentName = user ? user.name : participantName;
                        await joinRoomDirect(roomName, currentName, false);
                    } else if (res.data.status === 'rejected') {
                        alert('Host denied your request to enter.');
                        setIsWaiting(false);
                        setWaitingPid(null);
                    }
                } catch (e) {}
            }, 800);
        }
        return () => clearInterval(interval);
    }, [isWaiting, waitingPid, roomName, user, participantName]);

    useEffect(() => {
        if (!inMeeting && !isWaiting && !isJoiningRef.current) {
            navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: true
            })
                .then((stream) => {
                    if (isJoiningRef.current) {
                        stream.getTracks().forEach(t => t.stop());
                        return;
                    }
                    previewStreamRef.current = stream;
                    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
                })
                .catch(() => {});
        } else {
            stopLobbyPreviewTracks();
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
                } else if (authAction === 'schedule') {
                    setShowScheduleModal(true);
                } else if (authAction === 'join' || isInviteFlow) {
                    await proceedJoin(userData.name);
                }
            } catch (err) {
                alert("Google verification error: " + err.message);
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

    const handleStartScheduleMeeting = () => {
        if (user) {
            setShowScheduleModal(true);
        } else {
            setAuthAction('schedule');
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
                allow_participant_screenshare: allowScreenshare,
                allow_direct_chat: allowDirectChat,
                mute_on_entry: muteOnEntry,
                camera_off_on_entry: cameraOffOnEntry,
                allow_whiteboard: allowWhiteboard,
                allow_reactions: allowReactions
            });
            const newRoomId = res.data.room_id;
            const hostDisplayName = `${participantName || user?.name || 'Host'} (Host)`;

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

            stopLobbyPreviewTracks();
            setInMeeting(true);
        } catch (e) {
            alert("Create room failed: " + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveScheduleMeeting = async (e) => {
        e.preventDefault();
        if (!scheduleDate || !scheduleTime) {
            alert("Pick Date and Time.");
            return;
        }
        setLoading(true);
        try {
            const generatedRoomId = `mm-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;
            const newScheduled = {
                room_id: generatedRoomId,
                title: scheduleTitle.trim() || 'Scheduled Meeting',
                scheduled_date: scheduleDate,
                scheduled_time: scheduleTime,
                duration_mins: scheduleDuration,
                host_name: user?.name || 'Host',
                host_email: user?.email || null,
                waiting_mode: waitingMode,
                chat_locked: chatLocked,
                allow_participant_screenshare: allowScreenshare,
                allow_direct_chat: allowDirectChat,
                allow_whiteboard: allowWhiteboard,
                allow_reactions: allowReactions,
                mute_on_entry: muteOnEntry,
                camera_off_on_entry: cameraOffOnEntry
            };

            await axios.post(`${BACKEND_URL}/api/schedule-meeting`, newScheduled);

            const updatedList = [newScheduled, ...scheduledMeetings];
            setScheduledMeetings(updatedList);
            localStorage.setItem('meetmatrix_scheduled', JSON.stringify(updatedList));

            setShowScheduleModal(false);
            setScheduleTitle('');
            alert(`Meeting scheduled! Room Code: ${generatedRoomId}`);
        } catch (err) {
            alert("Scheduling failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteScheduledMeeting = async (roomId) => {
        try {
            await axios.delete(`${BACKEND_URL}/api/scheduled-meetings/${roomId}`);
        } catch (e) {}
        const filtered = scheduledMeetings.filter(m => m.room_id !== roomId);
        setScheduledMeetings(filtered);
        localStorage.setItem('meetmatrix_scheduled', JSON.stringify(filtered));
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
                // Respect mute_on_entry from backend
                if (res.data.mute_on_entry) {
                    setInitialMuteAudio(true);
                    setMicEnabled(false);
                }
                if (res.data.camera_off_on_entry) {
                    setInitialMuteVideo(true);
                    setCameraEnabled(false);
                }

                stopLobbyPreviewTracks();
                setInMeeting(true);
            }
        } catch (err) {
            alert(err.response?.data?.detail || "Could not join room");
        } finally {
            setLoading(false);
        }
    };

    const joinRoomDirect = async (room, name, hostFlag) => {
        const res = await axios.post(`${BACKEND_URL}/api/get-token`, {
            room_name: room,
            participant_name: hostFlag ? `${name} (Host)` : name,
            is_host: hostFlag,
            role: hostFlag ? "host" : "participant",
        });
        setToken(res.data.token);
        setServerUrl(res.data.server_url);

        if (!hostFlag) {
            if (res.data.mute_on_entry) {
                setInitialMuteAudio(true);
                setMicEnabled(false);
            }
            if (res.data.camera_off_on_entry) {
                setInitialMuteVideo(true);
                setCameraEnabled(false);
            }
        }

        stopLobbyPreviewTracks();
        setInMeeting(true);
    };

    const handleJoinClick = (e) => {
        e?.preventDefault();
        if (!roomName.trim()) {
            alert("Enter a room code.");
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

    const handleTerminateMeeting = async () => {
        if (window.confirm("End meeting for everyone?")) {
            try {
                await axios.post(`${BACKEND_URL}/api/terminate-room`, { room_name: roomName });
            } catch (err) {}
            setInMeeting(false);
            setToken('');
            setRoomName('');
        }
    };

    if (isWaiting) {
        return (
            <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090d16', color: '#f8fafc', flexDirection: 'column', padding: '20px', textAlign: 'center' }}>
                <Clock size={48} color="#38bdf8" style={{ marginBottom: '1.2rem', animation: 'pulse 2s infinite' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.5rem' }}>Waiting for Host to Admit You...</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Room: <strong style={{ color: '#38bdf8' }}>{roomName}</strong></p>
                <button onClick={() => setIsWaiting(false)} style={{ marginTop: '1.2rem', background: '#ef4444', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
            </div>
        );
    }

    if (inMeeting && token && serverUrl) {
        return (
            <div style={{ height: '100dvh', width: '100vw', background: '#090d16', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <LiveKitRoom
                    video={cameraEnabled ? { facingMode: 'user' } : false}
                    audio={micEnabled}
                    token={token}
                    serverUrl={serverUrl}
                    data-lk-theme="default"
                    style={{ height: '100%', width: '100%' }}
                    onDisconnected={() => { setInMeeting(false); setToken(''); }}
                >
                    <MeetingStage
                        roomName={roomName}
                        isHost={isHost}
                        participantName={participantName}
                        setParticipantName={setParticipantName}
                        initialCam={!initialMuteVideo}
                        initialMic={!initialMuteAudio}
                        onLeave={() => { setInMeeting(false); setToken(''); }}
                        onTerminate={handleTerminateMeeting}
                        showWhiteboard={showWhiteboard}
                        setShowWhiteboard={setShowWhiteboard}
                        allowScreenshare={allowScreenshare}
                        setAllowScreenshare={setAllowScreenshare}
                        allowDirectChat={allowDirectChat}
                        setAllowDirectChat={setAllowDirectChat}
                        chatLocked={chatLocked}
                        setChatLocked={setChatLocked}
                        waitingMode={waitingMode}
                        setWaitingMode={setWaitingMode}
                        allowWhiteboard={allowWhiteboard}
                        setAllowWhiteboard={setAllowWhiteboard}
                        allowReactions={allowReactions}
                        setAllowReactions={setAllowReactions}
                    />
                </LiveKitRoom>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #1e293b 0%, #090d16 100%)', color: '#f8fafc', padding: '12px' }}>

            {/* Pre-Meeting Configuration Modal */}
            {showPreSettingsModal && (
                <div style={modalBackdropStyle}>
                    <div style={modalCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sliders size={18} color="#38bdf8" />
                                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#38bdf8', fontWeight: '800' }}>Pre-Meeting Security & Controls</h3>
                            </div>
                            <button onClick={() => setShowPreSettingsModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
                            <div>
                                <label style={settingLabelStyle}>Waiting Room Admission Policy</label>
                                <select value={waitingMode} onChange={(e) => setWaitingMode(e.target.value)} style={selectInputStyle}>
                                    <option value="direct">Direct Bypass (Instant Join without approval)</option>
                                    <option value="strict">Strict (Host/Co-Host Approval Required)</option>
                                    <option value="open">Open Collaboration Room</option>
                                </select>
                            </div>

                            <div style={featureBoxStyle}>
                                <span style={groupHeadingStyle}>COLLABORATION & WHITEBOARD</span>
                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={allowScreenshare} onChange={(e) => setAllowScreenshare(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Allow Participants to Share Screen</span>
                                </label>

                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={allowWhiteboard} onChange={(e) => setAllowWhiteboard(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Enable Interactive Whiteboard Feature</span>
                                </label>
                            </div>

                            <div style={featureBoxStyle}>
                                <span style={groupHeadingStyle}>COMMUNICATION & CHAT</span>
                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={!chatLocked} onChange={(e) => setChatLocked(!e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Allow Public In-Meeting Chat</span>
                                </label>

                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={allowDirectChat} onChange={(e) => setAllowDirectChat(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Allow 1-on-1 Direct Chat Between Peers</span>
                                </label>

                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={allowReactions} onChange={(e) => setAllowReactions(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Allow Emoji Reactions (Floating Emojis)</span>
                                </label>
                            </div>

                            <div style={featureBoxStyle}>
                                <span style={groupHeadingStyle}>AUDIO & VIDEO ENTRY POLICY</span>
                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={muteOnEntry} onChange={(e) => setMuteOnEntry(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Mute Participants Mic upon joining</span>
                                </label>

                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={cameraOffOnEntry} onChange={(e) => setCameraOffOnEntry(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Turn off Participants Camera upon joining</span>
                                </label>
                            </div>
                        </div>

                        <button onClick={handleConfirmAndLaunchRoom} style={primaryBtnStyle}>
                            🚀 Launch Instant Meeting
                        </button>
                    </div>
                </div>
            )}

            {/* Schedule Meeting Modal */}
            {showScheduleModal && (
                <div style={modalBackdropStyle}>
                    <div style={modalCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} color="#38bdf8" />
                                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#38bdf8', fontWeight: '800' }}>Schedule Meeting & Controls</h3>
                            </div>
                            <button onClick={() => setShowScheduleModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleSaveScheduleMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '65vh', overflowY: 'auto', paddingRight: '4px' }}>
                            <div>
                                <label style={settingLabelStyle}>Meeting Topic / Title</label>
                                <input
                                    type="text"
                                    value={scheduleTitle}
                                    placeholder="e.g. Sprint Review / Team Sync"
                                    onChange={(e) => setScheduleTitle(e.target.value)}
                                    style={selectInputStyle}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={settingLabelStyle}>Date</label>
                                    <input
                                        type="date"
                                        value={scheduleDate}
                                        onChange={(e) => setScheduleDate(e.target.value)}
                                        style={selectInputStyle}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={settingLabelStyle}>Start Time</label>
                                    <input
                                        type="time"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        style={selectInputStyle}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={settingLabelStyle}>Estimated Duration</label>
                                <select
                                    value={scheduleDuration}
                                    onChange={(e) => setScheduleDuration(parseInt(e.target.value))}
                                    style={selectInputStyle}
                                >
                                    <option value={15}>15 Minutes</option>
                                    <option value={30}>30 Minutes</option>
                                    <option value={45}>45 Minutes</option>
                                    <option value={60}>1 Hour</option>
                                    <option value={90}>1.5 Hours</option>
                                </select>
                            </div>

                            <div style={featureBoxStyle}>
                                <span style={groupHeadingStyle}>PRE-SET MEETING CONTROLS</span>
                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={allowScreenshare} onChange={(e) => setAllowScreenshare(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Allow Participants Screen Sharing</span>
                                </label>
                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={allowWhiteboard} onChange={(e) => setAllowWhiteboard(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Enable Interactive Whiteboard</span>
                                </label>
                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={!chatLocked} onChange={(e) => setChatLocked(!e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Allow Public Chat</span>
                                </label>
                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={allowReactions} onChange={(e) => setAllowReactions(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Allow Emoji Reactions</span>
                                </label>
                                <label style={checkboxRowStyle}>
                                    <input type="checkbox" checked={muteOnEntry} onChange={(e) => setMuteOnEntry(e.target.checked)} style={{ accentColor: '#38bdf8' }} />
                                    <span>Mute Mic upon joining</span>
                                </label>
                            </div>

                            <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, marginTop: '8px' }}>
                                📅 Save & Schedule Meeting
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Landing Dashboard */}
            <div style={{ background: '#131b2e', borderRadius: '18px', width: '100%', maxWidth: '850px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>

                    <div style={{ padding: '1.8rem', background: '#0c1222', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.8rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
                            <h3 style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Green Room Hardware Preview</h3>
                        </div>

                        <div style={{ width: '100%', maxWidth: '320px', height: '190px', background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid #1e293b' }}>
                            <video ref={videoPreviewRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            {!cameraEnabled && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090d16', color: '#64748b', fontSize: '0.85rem' }}>
                                    Camera is turned off
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.2rem' }}>
                            <button onClick={toggleLobbyCam} style={{ ...toggleBtnStyle, background: cameraEnabled ? '#334155' : '#ef4444' }}>
                                {cameraEnabled ? <Video size={15} /> : <VideoOff size={15} />} {cameraEnabled ? 'Cam On' : 'Cam Off'}
                            </button>
                            <button onClick={toggleLobbyMic} style={{ ...toggleBtnStyle, background: micEnabled ? '#334155' : '#ef4444' }}>
                                {micEnabled ? <Mic size={15} /> : <MicOff size={15} />} {micEnabled ? 'Mic On' : 'Mic Off'}
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: '1.8rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h1 style={{ fontSize: '1.7rem', fontWeight: '900', background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.4rem' }}>MeetMatrix</h1>
                        {isInviteFlow && (
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1rem' }}>
                                Joining Meeting: <strong style={{ color: '#38bdf8' }}>{roomName}</strong>
                            </p>
                        )}

                        {user && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(9, 13, 22, 0.6)', padding: '6px 14px', borderRadius: '24px', marginBottom: '14px', border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    {user.picture ? <img src={user.picture} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%' }} /> : <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0284c7' }} />}
                                    <span style={{ fontSize: '0.82rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>{user.name}</span>
                                </div>
                                <button onClick={() => { localStorage.removeItem('meetmatrix_user'); setUser(null); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '700' }}>Switch</button>
                            </div>
                        )}

                        {isInviteFlow ? (
                            <button onClick={handleJoinClick} disabled={loading} style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {!user && <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" style={{ width: '16px', height: '16px' }} />}
                                {user ? `Enter Meeting as ${user.name.split(' ')[0]}` : `Sign in & Enter Meeting`}
                            </button>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                                    <button onClick={handleStartCreateMeeting} disabled={loading} style={{ ...primaryBtnStyle, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <Sliders size={15} /> Configure & Host
                                    </button>
                                    <button onClick={handleStartScheduleMeeting} disabled={loading} style={{ ...secondaryBtnStyle, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <Calendar size={15} /> Schedule
                                    </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', margin: '0.8rem 0', color: '#475569' }}>
                                    <hr style={{ flex: 1, borderColor: '#1e293b' }} />
                                    <span style={{ padding: '0 8px', fontSize: '0.7rem', fontWeight: '700' }}>OR JOIN EXISTING</span>
                                    <hr style={{ flex: 1, borderColor: '#1e293b' }} />
                                </div>

                                <form onSubmit={handleJoinClick} style={{ marginBottom: '14px' }}>
                                    <input type="text" placeholder="Enter Room Code (e.g. mm-xxxx-xxxx)" value={roomName} onChange={(e) => setRoomName(e.target.value)} style={{ ...inputStyle, marginBottom: '0.8rem' }} />
                                    <button type="submit" disabled={loading} style={{ ...secondaryBtnStyle, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        {!user && <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" style={{ width: '16px', height: '16px' }} />}
                                        {user ? `Join Meeting as ${user.name.split(' ')[0]}` : `Sign in & Join Meeting`}
                                    </button>
                                </form>

                                {scheduledMeetings.length > 0 && (
                                    <div style={{ background: '#090d16', borderRadius: '12px', padding: '12px', border: '1px solid #1e293b', maxHeight: '160px', overflowY: 'auto' }}>
                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '800', display: 'block', marginBottom: '8px' }}>UPCOMING SCHEDULED MEETINGS</span>
                                        {scheduledMeetings.map((item) => (
                                            <div key={item.room_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1e293b' }}>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '700', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '160px' }}>{item.title}</span>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{item.scheduled_date || item.date} at {item.scheduled_time || item.time} ({item.duration_mins || item.duration}m)</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?room=${item.room_id}`); alert("Invite Link Copied!"); }}
                                                        style={iconActionBtnStyle}
                                                        title="Copy Invite Link"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setRoomName(item.room_id);
                                                            setIsHost(true);
                                                            joinRoomDirect(item.room_id, user?.name || 'Host', true);
                                                        }}
                                                        style={{ ...iconActionBtnStyle, background: '#0284c7', color: '#fff' }}
                                                        title="Launch Scheduled Meeting"
                                                    >
                                                        <Play size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteScheduledMeeting(item.room_id)}
                                                        style={{ ...iconActionBtnStyle, color: '#ef4444' }}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const inputStyle = { width: '100%', padding: '11px 12px', background: '#090d16', border: '1px solid #334155', borderRadius: '8px', color: '#ffffff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
const primaryBtnStyle = { width: '100%', padding: '11px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 14px rgba(2,132,199,0.3)' };
const secondaryBtnStyle = { width: '100%', padding: '10px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #0284c7', color: '#38bdf8', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' };
const topBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '5px 9px', borderRadius: '7px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' };
const toggleBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff', border: 'none', padding: '7px 12px', borderRadius: '7px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700' };
const controlBtn = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '6px 10px', borderRadius: '8px', fontSize: '0.65rem', cursor: 'pointer', minWidth: '46px', fontWeight: '600' };
const bottomBarStyle = { background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #334155', padding: '8px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', zIndex: 100, flexShrink: 0 };
const headerBarStyle = { background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', color: '#f8fafc', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', zIndex: 1000, flexShrink: 0 };
const sideDrawerStyle = { width: '320px', maxWidth: '85vw', background: '#0f172a', borderLeft: '1px solid #334155', height: '100%', zIndex: 50, position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column' };
const drawerHeaderStyle = { padding: '12px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const drawerCloseBtn = { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' };
const drawerActionBtn = { background: 'transparent', border: 'none', color: '#94a3b8', padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center' };
const contextMenuStyle = { position: 'absolute', right: 0, top: '26px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '5px', zIndex: 999, minWidth: '150px', boxShadow: '0 10px 25px rgba(0,0,0,0.6)' };
const contextMenuItemStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', borderRadius: '5px' };
const modalBackdropStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };
const modalCardStyle = { background: '#131b2e', border: '1px solid #38bdf8', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '450px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' };
const settingLabelStyle = { fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '700' };
const selectInputStyle = { width: '100%', padding: '9px', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '7px', fontSize: '0.8rem', boxSizing: 'border-box' };
const checkboxRowStyle = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', color: '#f8fafc', marginBottom: '6px' };
const featureBoxStyle = { background: '#090d16', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' };
const groupHeadingStyle = { fontSize: '0.68rem', color: '#38bdf8', fontWeight: '800', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' };
const iconActionBtnStyle = { background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', padding: '5px 7px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center' };
const interactiveEmojiBtn = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px 4px', borderRadius: '4px' };
const editChipBtn = { background: '#0284c7', border: 'none', color: '#ffffff', borderRadius: '5px', padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', fontWeight: '700', marginLeft: '3px' };