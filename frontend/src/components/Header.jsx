import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Copy, Download, Users, DoorOpen, Settings, Edit3 } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';

const BACKEND_URL = 'https://meetmatrix-backend-3l9l.onrender.com';

export default function Header({
                                   roomName,
                                   isHost,
                                   isCoHost,
                                   isEffectiveModerator,
                                   allPeersCount,
                                   waitingMode,
                                   waitingList,
                                   allowReactions,
                                   showParticipants,
                                   setShowParticipants,
                                   setShowChat,
                                   showAdmitModal,
                                   setShowAdmitModal,
                                   showInMeetingSettings,
                                   setShowInMeetingSettings,
                                   onReactionBroadcast
                               }) {
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

    // Safe background download without page refresh/disconnect
    const handleDownloadAttendanceSafe = () => {
        const downloadUrl = `${BACKEND_URL}/api/attendance/export/${roomName}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.setAttribute('download', `attendance-${roomName}.csv`);
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
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
                                onClick={() => onReactionBroadcast(e)}
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
                    <span>People ({allPeersCount})</span>
                </button>

                {/* Lobby Button: Strict / Open me visible, Bypass (direct) me hidden */}
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

                {/* Safe Background CSV Export */}
                {isHost && (
                    <button
                        onClick={handleDownloadAttendanceSafe}
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
    );
}

const headerBarStyle = { background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', color: '#f8fafc', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', zIndex: 1000, flexShrink: 0 };
const topBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', background: '#1e293b', color: '#ffffff', border: '1px solid #334155', padding: '5px 9px', borderRadius: '7px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' };
const interactiveEmojiBtn = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px 4px', borderRadius: '4px' };
const editChipBtn = { background: '#0284c7', border: 'none', color: '#ffffff', borderRadius: '5px', padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', fontWeight: '700', marginLeft: '3px' };