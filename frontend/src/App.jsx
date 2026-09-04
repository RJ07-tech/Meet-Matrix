import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '@livekit/components-styles';
import {
    LiveKitRoom,
    ParticipantTile,
    useTracks,
    useLocalParticipant,
    useRemoteParticipants,
    RoomAudioRenderer,
    useRoomContext
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Video, VideoOff, Mic, MicOff, Sliders, Calendar, Copy, Play, Trash2, Clock, PauseCircle } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

// Modular Child Components
import Header from './components/Header';
import ControlBar from './components/ControlBar';
import ChatDrawer from './components/ChatDrawer';
import ParticipantsDrawer from './components/ParticipantsDrawer';
import { LobbyModal, InMeetingSettingsModal, PreFlightModal, ScheduleModal } from './components/Modals';
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
                          setAllowReactions,
                          micLocked,
                          setMicLocked
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

    const [floatingEmojis, setFloatingEmojis] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatRecipient, setChatRecipient] = useState('Everyone');

    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const isCoHost = Boolean(coHostsMap[localParticipant?.identity]);
    const isEffectiveModerator = isHost || isCoHost;

    const allTracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false }
        ],
        { onlySubscribed: false }
    );

    const screenShareTrack = allTracks.find(t => t.source === Track.Source.ScreenShare);
    const cameraTracks = allTracks.filter(t => t.source === Track.Source.Camera);

    useEffect(() => {
        if (!localParticipant) return;
        localParticipant.setName(participantName);

        if (!initialMic || (micLocked && !isEffectiveModerator)) {
            localParticipant.setMicrophoneEnabled(false).catch(() => {});
        }
        if (!initialCam) {
            localParticipant.setCameraEnabled(false).catch(() => {});
        }
    }, [localParticipant, initialCam, initialMic, participantName, micLocked, isEffectiveModerator]);

    // Visibility / Hold status
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

                        if (res.data.mic_locked !== undefined) {
                            setMicLocked(Boolean(res.data.mic_locked));
                            if (res.data.mic_locked && !isEffectiveModerator && localParticipant) {
                                localParticipant.setMicrophoneEnabled(false).catch(() => {});
                            }
                        }
                    }
                } catch (e) {}
            }, 1200);
        }
        return () => clearInterval(interval);
    }, [roomName, setAllowScreenshare, setChatLocked, setWaitingMode, setAllowReactions, setAllowWhiteboard, setAllowDirectChat, setMicLocked, isEffectiveModerator, localParticipant]);

    // Waiting list poll
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
                    if (data.mic_locked !== undefined) {
                        setMicLocked(data.mic_locked);
                        if (data.mic_locked && !isEffectiveModerator) {
                            localParticipant.setMicrophoneEnabled(false);
                        }
                    }
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
                    if (!isHost) localParticipant.setMicrophoneEnabled(false);
                } else if (data.type === 'mute_all') {
                    if (!isHost) localParticipant.setMicrophoneEnabled(false);
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
    }, [room, localParticipant, onLeave, setAllowScreenshare, setChatLocked, setWaitingMode, setAllowReactions, setAllowWhiteboard, setAllowDirectChat, setMicLocked, allowReactions, isEffectiveModerator, isHost]);

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

    const toggleVideo = async () => {
        if (!localParticipant) return;
        try {
            await localParticipant.setCameraEnabled(!isCameraEnabled, { facingMode: 'user' });
        } catch (err) {}
    };

    const toggleMic = async () => {
        if (!localParticipant) return;
        if (!isMicrophoneEnabled && micLocked && !isEffectiveModerator) {
            alert("Microphone is permanently locked by the Host.");
            return;
        }
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

    const handleSaveName = (newName) => {
        if (!localParticipant) return;
        localParticipant.setName(newName);
        setParticipantName(newName);
    };

    const handleHostMute = (identity) => {
        if (!isEffectiveModerator || !room) return;
        const payload = JSON.stringify({ type: 'force_mute', targetIdentity: identity });
        room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    };

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
        }
    };

    const handleToggleCoHost = (identity) => {
        if (!isHost || !room) return;
        const nextStatus = !coHostsMap[identity];
        setCoHostsMap(prev => ({ ...prev, [identity]: nextStatus }));
        const payload = JSON.stringify({ type: 'co_host_update', targetIdentity: identity, isCoHost: nextStatus });
        room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    };

    const handleAdmitAction = async (pid, action) => {
        try {
            await axios.post(`${BACKEND_URL}/api/admit-participant`, {
                room_name: roomName,
                participant_id: pid,
                action
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

    const handleSendMessage = (text, recipient) => {
        if (!room) return;
        const messageData = { type: 'chat', text, recipient };
        room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(messageData)), { reliable: true });

        setChatMessages(prev => [...prev, {
            sender: 'You',
            text,
            recipient,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
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

    const allPeers = [
        {
            identity: localParticipant?.identity,
            name: `${participantName} (You)`,
            isHost,
            isCoHost,
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

            {/* Floating Emojis */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 99999 }}>
                {floatingEmojis.map(item => (
                    <div key={item.id} className="floating-emoji-item" style={{ left: `${item.left}%` }}>
                        <span className="floating-emoji-icon">{item.emoji}</span>
                        <span className="floating-emoji-sender">{item.sender}</span>
                    </div>
                ))}
            </div>

            {/* Modular Header Component */}
            <Header
                roomName={roomName}
                isHost={isHost}
                isCoHost={isCoHost}
                isEffectiveModerator={isEffectiveModerator}
                allPeersCount={allPeers.length}
                waitingMode={waitingMode}
                waitingList={waitingList}
                allowReactions={allowReactions}
                showParticipants={showParticipants}
                setShowParticipants={setShowParticipants}
                setShowChat={setShowChat}
                showAdmitModal={showAdmitModal}
                setShowAdmitModal={setShowAdmitModal}
                showInMeetingSettings={showInMeetingSettings}
                setShowInMeetingSettings={setShowInMeetingSettings}
                onReactionBroadcast={triggerReactionBroadcast}
            />

            {/* Main Stage Grid & Drawers */}
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

                {/* Modular Chat Drawer */}
                {showChat && (
                    <ChatDrawer
                        onClose={() => setShowChat(false)}
                        chatMessages={chatMessages}
                        allowDirectChat={allowDirectChat}
                        remoteParticipants={remoteParticipants}
                        chatRecipient={chatRecipient}
                        setChatRecipient={setChatRecipient}
                        chatLocked={chatLocked}
                        isEffectiveModerator={isEffectiveModerator}
                        onSendMessage={handleSendMessage}
                    />
                )}

                {/* Modular Participants Drawer */}
                {showParticipants && (
                    <ParticipantsDrawer
                        onClose={() => setShowParticipants(false)}
                        allPeers={allPeers}
                        isHost={isHost}
                        isEffectiveModerator={isEffectiveModerator}
                        isScreenSharing={isScreenSharing}
                        onSaveName={handleSaveName}
                        onToggleCoHost={handleToggleCoHost}
                        onHostMute={handleHostMute}
                        onHostKick={handleHostKick}
                    />
                )}
            </div>

            {/* Modular Bottom Controls */}
            <ControlBar
                isHost={isHost}
                isEffectiveModerator={isEffectiveModerator}
                isMicrophoneEnabled={isMicrophoneEnabled}
                isCameraEnabled={isCameraEnabled}
                isHandRaised={isHandRaised}
                isScreenSharing={isScreenSharing}
                allowScreenshare={allowScreenshare}
                allowWhiteboard={allowWhiteboard}
                showWhiteboard={showWhiteboard}
                setShowWhiteboard={setShowWhiteboard}
                showChat={showChat}
                setShowChat={setShowChat}
                setShowParticipants={setShowParticipants}
                isRecording={isRecording}
                micLocked={micLocked}
                toggleMic={toggleMic}
                toggleVideo={toggleVideo}
                toggleHandRaise={toggleHandRaise}
                toggleScreenShare={toggleScreenShare}
                startRecording={startRecording}
                stopRecording={stopRecording}
                onLeave={handleLeaveMeeting}
                onTerminate={onTerminate}
            />

            {/* Modular Popups & Overlays */}
            {showWhiteboard && (
                <Whiteboard
                    isModerator={isEffectiveModerator}
                    onClose={() => setShowWhiteboard(false)}
                    localParticipant={localParticipant}
                />
            )}

            {showAdmitModal && isEffectiveModerator && (
                <LobbyModal
                    waitingList={waitingList}
                    onAdmitAction={handleAdmitAction}
                    onClose={() => setShowAdmitModal(false)}
                />
            )}

            {showInMeetingSettings && isHost && (
                <InMeetingSettingsModal
                    onClose={() => setShowInMeetingSettings(false)}
                    onMuteAll={handleMuteAll}
                    micLocked={micLocked}
                    setMicLocked={setMicLocked}
                    allowScreenshare={allowScreenshare}
                    setAllowScreenshare={setAllowScreenshare}
                    chatLocked={chatLocked}
                    setChatLocked={setChatLocked}
                    allowDirectChat={allowDirectChat}
                    setAllowDirectChat={setAllowDirectChat}
                    allowWhiteboard={allowWhiteboard}
                    setAllowWhiteboard={setAllowWhiteboard}
                    allowReactions={allowReactions}
                    setAllowReactions={setAllowReactions}
                    waitingMode={waitingMode}
                    setWaitingMode={setWaitingMode}
                    onUpdateLiveSettings={handleUpdateLiveRoomSettings}
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

    const [initialMuteAudio, setInitialMuteAudio] = useState(false);
    const [initialMuteVideo, setInitialMuteVideo] = useState(false);

    const [showPreSettingsModal, setShowPreSettingsModal] = useState(false);
    const [waitingMode, setWaitingMode] = useState('direct');
    const [chatLocked, setChatLocked] = useState(false);
    const [micLocked, setMicLocked] = useState(false);
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
                    picture: userInfo.data.picture
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
                mic_locked: micLocked,
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
                mic_locked: micLocked,
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
            role: hostFlag ? "host" : "participant"
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
                        micLocked={micLocked}
                        setMicLocked={setMicLocked}
                    />
                </LiveKitRoom>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #1e293b 0%, #090d16 100%)', color: '#f8fafc', padding: '12px' }}>
            {showPreSettingsModal && (
                <PreFlightModal
                    waitingMode={waitingMode}
                    setWaitingMode={setWaitingMode}
                    micLocked={micLocked}
                    setMicLocked={setMicLocked}
                    muteOnEntry={muteOnEntry}
                    setMuteOnEntry={setMuteOnEntry}
                    cameraOffOnEntry={cameraOffOnEntry}
                    setCameraOffOnEntry={setCameraOffOnEntry}
                    allowScreenshare={allowScreenshare}
                    setAllowScreenshare={setAllowScreenshare}
                    allowWhiteboard={allowWhiteboard}
                    setAllowWhiteboard={setAllowWhiteboard}
                    chatLocked={chatLocked}
                    setChatLocked={setChatLocked}
                    allowDirectChat={allowDirectChat}
                    setAllowDirectChat={setAllowDirectChat}
                    allowReactions={allowReactions}
                    setAllowReactions={setAllowReactions}
                    onConfirmLaunch={handleConfirmAndLaunchRoom}
                    onClose={() => setShowPreSettingsModal(false)}
                />
            )}

            {showScheduleModal && (
                <ScheduleModal
                    scheduleTitle={scheduleTitle}
                    setScheduleTitle={setScheduleTitle}
                    scheduleDate={scheduleDate}
                    setScheduleDate={setScheduleDate}
                    scheduleTime={scheduleTime}
                    setScheduleTime={setScheduleTime}
                    scheduleDuration={scheduleDuration}
                    setScheduleDuration={setScheduleDuration}
                    micLocked={micLocked}
                    setMicLocked={setMicLocked}
                    muteOnEntry={muteOnEntry}
                    setMuteOnEntry={setMuteOnEntry}
                    allowScreenshare={allowScreenshare}
                    setAllowScreenshare={setAllowScreenshare}
                    allowWhiteboard={allowWhiteboard}
                    setAllowWhiteboard={setAllowWhiteboard}
                    chatLocked={chatLocked}
                    setChatLocked={setChatLocked}
                    allowReactions={allowReactions}
                    setAllowReactions={setAllowReactions}
                    loading={loading}
                    onSaveSchedule={handleSaveScheduleMeeting}
                    onClose={() => setShowScheduleModal(false)}
                />
            )}

            {/* Landing Dashboard View */}
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
const toggleBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff', border: 'none', padding: '7px 12px', borderRadius: '7px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700' };
const iconActionBtnStyle = { background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', padding: '5px 7px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center' };