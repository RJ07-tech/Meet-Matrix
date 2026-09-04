import React from 'react';
import {
    Mic, MicOff, Video, VideoOff, Hand, MonitorUp,
    PenTool, MessageSquare, Square, Disc, PhoneOff
} from 'lucide-react';

export default function ControlBar({
                                       isHost,
                                       isEffectiveModerator,
                                       isMicrophoneEnabled,
                                       isCameraEnabled,
                                       isHandRaised,
                                       isScreenSharing,
                                       allowScreenshare,
                                       allowWhiteboard,
                                       showWhiteboard,
                                       setShowWhiteboard,
                                       showChat,
                                       setShowChat,
                                       setShowParticipants,
                                       isRecording,
                                       micLocked,
                                       toggleMic,
                                       toggleVideo,
                                       toggleHandRaise,
                                       toggleScreenShare,
                                       startRecording,
                                       stopRecording,
                                       onLeave,
                                       onTerminate
                                   }) {
    return (
        <div className="mobile-control-bar" style={bottomBarStyle}>
            <button
                onClick={toggleMic}
                style={{
                    ...controlBtn,
                    background: !isMicrophoneEnabled ? '#ef4444' : '#1e293b',
                    opacity: (micLocked && !isEffectiveModerator) ? 0.6 : 1
                }}
                title={micLocked && !isEffectiveModerator ? "Mic locked by host" : "Toggle Mic"}
            >
                {!isMicrophoneEnabled ? <MicOff size={18} /> : <Mic size={18} />}
                <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>
                    {micLocked && !isEffectiveModerator ? 'Locked' : (!isMicrophoneEnabled ? 'Unmute' : 'Mute')}
                </span>
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
                <button onClick={onLeave} style={{ ...controlBtn, background: '#e11d48', color: '#fff' }}>
                    <PhoneOff size={18} />
                    <span className="mobile-hide" style={{ fontSize: '0.65rem' }}>Leave</span>
                </button>
            )}
        </div>
    );
}

const bottomBarStyle = { background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #334155', padding: '8px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', zIndex: 100, flexShrink: 0 };
const controlBtn = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '6px 10px', borderRadius: '8px', fontSize: '0.65rem', cursor: 'pointer', minWidth: '46px', fontWeight: '600' };