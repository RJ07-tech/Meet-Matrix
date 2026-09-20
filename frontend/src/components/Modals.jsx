import React from 'react';
import { X, VolumeX, AlertTriangle, UserCheck, UserX, Sliders, Calendar, Video, Lock, Shield, Download } from 'lucide-react';

export function LobbyModal({ waitingList, onAdmitAction, onClose }) {
    return (
        <div style={{ position: 'fixed', top: '55px', right: '14px', background: 'rgba(15, 23, 42, 0.96)', backdropFilter: 'blur(16px)', padding: '14px', borderRadius: '14px', border: '2px solid #eab308', boxShadow: '0 25px 50px rgba(0,0,0,0.85)', zIndex: 100000, width: '300px', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} color="#eab308" />
                    <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#eab308', fontWeight: '800' }}>Waiting Requests ({waitingList.length})</h4>
                </div>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16} /></button>
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
                                    onClick={() => onAdmitAction(p.participant_id, 'admit')}
                                    style={{ background: '#10b981', border: 'none', color: '#fff', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: '700' }}
                                >
                                    <UserCheck size={13} /> Admit
                                </button>
                                <button
                                    onClick={() => onAdmitAction(p.participant_id, 'reject')}
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
    );
}

export function VideoRequestModal({ onAccept, onDecline }) {
    return (
        <div style={{ position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)', background: '#0f172a', padding: '16px 20px', borderRadius: '16px', border: '2px solid #38bdf8', boxShadow: '0 25px 60px rgba(0,0,0,0.95)', zIndex: 100002, width: '320px', color: '#f8fafc', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <div style={{ background: '#0284c7', padding: '10px', borderRadius: '50%' }}>
                    <Video size={24} color="#fff" />
                </div>
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: '800' }}>Camera Request</h4>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.78rem', color: '#cbd5e1' }}>The Host has requested you to turn on your camera.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                    onClick={onAccept}
                    style={{ flex: 1, padding: '8px', background: '#10b981', border: 'none', color: '#fff', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                    Turn On
                </button>
                <button
                    onClick={onDecline}
                    style={{ flex: 1, padding: '8px', background: '#334155', border: 'none', color: '#cbd5e1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                    Later
                </button>
            </div>
        </div>
    );
}

export function InMeetingSettingsModal({
                                           onClose,
                                           onMuteAll,
                                           micLocked,
                                           setMicLocked,
                                           allowScreenshare,
                                           setAllowScreenshare,
                                           allowCohostWhiteboard,
                                           setAllowCohostWhiteboard,
                                           chatLocked,
                                           setChatLocked,
                                           chatHostOnly,
                                           setChatHostOnly,
                                           allowDirectChat,
                                           setAllowDirectChat,
                                           allowWhiteboard,
                                           setAllowWhiteboard,
                                           allowReactions,
                                           setAllowReactions,
                                           autoDownloadCsv,
                                           setAutoDownloadCsv,
                                           waitingMode,
                                           setWaitingMode,
                                           onUpdateLiveSettings
                                       }) {
    return (
        <div style={{ position: 'fixed', top: '55px', right: '14px', background: 'rgba(15, 23, 42, 0.98)', backdropFilter: 'blur(16px)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(56, 189, 248, 0.5)', boxShadow: '0 25px 50px rgba(0,0,0,0.85)', zIndex: 100000, width: '320px', color: '#f8fafc', maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#38bdf8', fontWeight: '800', letterSpacing: '0.3px' }}>Host Security Controls</h4>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}><X size={16} /></button>
            </div>

            <button
                onClick={onMuteAll}
                style={{ width: '100%', background: '#ef4444', color: '#fff', border: 'none', padding: '9px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}
            >
                <VolumeX size={15} /> Mute All Participants Instantly
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                <label style={{ ...rowBaseStyle, background: micLocked ? 'rgba(239, 68, 68, 0.15)' : 'transparent', border: micLocked ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid transparent' }}>
                    <input
                        type="checkbox"
                        checked={micLocked}
                        onChange={(e) => {
                            setMicLocked(e.target.checked);
                            onUpdateLiveSettings({ mic_locked: e.target.checked });
                            if (e.target.checked) onMuteAll();
                        }}
                        style={{ ...checkboxSquareStyle, accentColor: '#ef4444' }}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: micLocked ? '#f87171' : '#f8fafc' }}>
                        <Lock size={13} color={micLocked ? '#f87171' : '#94a3b8'} style={{ flexShrink: 0 }} /> Permanent Mic Lock
                    </span>
                </label>

                <label style={{ ...rowBaseStyle, background: chatHostOnly ? 'rgba(2, 132, 199, 0.18)' : 'transparent', border: chatHostOnly ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent' }}>
                    <input
                        type="checkbox"
                        checked={chatHostOnly}
                        onChange={(e) => {
                            setChatHostOnly(e.target.checked);
                            onUpdateLiveSettings({ chat_host_only: e.target.checked });
                        }}
                        style={{ ...checkboxSquareStyle, accentColor: '#38bdf8' }}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: chatHostOnly ? '#38bdf8' : '#f8fafc' }}>
                        <Shield size={13} color={chatHostOnly ? '#38bdf8' : '#94a3b8'} style={{ flexShrink: 0 }} /> Host-Only Chat Mode
                    </span>
                </label>

                <label style={rowBaseStyle}>
                    <input
                        type="checkbox"
                        checked={allowScreenshare}
                        onChange={(e) => {
                            setAllowScreenshare(e.target.checked);
                            onUpdateLiveSettings({ allow_participant_screenshare: e.target.checked });
                        }}
                        style={checkboxSquareStyle}
                    />
                    <span>Allow Participant Screen Sharing</span>
                </label>

                <label style={rowBaseStyle}>
                    <input
                        type="checkbox"
                        checked={allowCohostWhiteboard}
                        onChange={(e) => {
                            setAllowCohostWhiteboard(e.target.checked);
                            onUpdateLiveSettings({ allow_cohost_whiteboard: e.target.checked });
                        }}
                        style={checkboxSquareStyle}
                    />
                    <span>Allow Co-Host Whiteboard Sharing</span>
                </label>

                <label style={rowBaseStyle}>
                    <input
                        type="checkbox"
                        checked={allowWhiteboard}
                        onChange={(e) => {
                            setAllowWhiteboard(e.target.checked);
                            onUpdateLiveSettings({ allow_whiteboard: e.target.checked });
                        }}
                        style={checkboxSquareStyle}
                    />
                    <span>Enable Interactive Whiteboard</span>
                </label>

                <label style={rowBaseStyle}>
                    <input
                        type="checkbox"
                        checked={chatLocked}
                        onChange={(e) => {
                            setChatLocked(e.target.checked);
                            onUpdateLiveSettings({ chat_locked: e.target.checked });
                        }}
                        style={checkboxSquareStyle}
                    />
                    <span>Lock Public Chat</span>
                </label>

                <label style={rowBaseStyle}>
                    <input
                        type="checkbox"
                        checked={allowDirectChat}
                        onChange={(e) => {
                            setAllowDirectChat(e.target.checked);
                            onUpdateLiveSettings({ allow_direct_chat: e.target.checked });
                        }}
                        style={checkboxSquareStyle}
                    />
                    <span>Allow 1-on-1 Direct Chat</span>
                </label>

                <label style={rowBaseStyle}>
                    <input
                        type="checkbox"
                        checked={allowReactions}
                        onChange={(e) => {
                            setAllowReactions(e.target.checked);
                            onUpdateLiveSettings({ allow_reactions: e.target.checked });
                        }}
                        style={checkboxSquareStyle}
                    />
                    <span>Allow Emoji Reactions</span>
                </label>

                <label style={{ ...rowBaseStyle, background: autoDownloadCsv ? 'rgba(16, 185, 129, 0.15)' : 'transparent', border: autoDownloadCsv ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent' }}>
                    <input
                        type="checkbox"
                        checked={autoDownloadCsv}
                        onChange={(e) => {
                            setAutoDownloadCsv(e.target.checked);
                            onUpdateLiveSettings({ auto_download_csv: e.target.checked });
                        }}
                        style={{ ...checkboxSquareStyle, accentColor: '#10b981' }}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: autoDownloadCsv ? '#34d399' : '#f8fafc' }}>
                        <Download size={13} color={autoDownloadCsv ? '#34d399' : '#94a3b8'} style={{ flexShrink: 0 }} /> Auto-download CSV on End Meeting
                    </span>
                </label>
            </div>

            <div style={{ marginTop: '4px' }}>
                <label style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', marginBottom: '6px', fontWeight: '700' }}>Waiting Room Mode:</label>
                <select
                    value={waitingMode}
                    onChange={(e) => {
                        setWaitingMode(e.target.value);
                        onUpdateLiveSettings({ waiting_mode: e.target.value });
                    }}
                    style={selectInputStyle}
                >
                    <option value="direct">Direct Bypass (Instant Entry)</option>
                    <option value="strict">Strict (Host Approval Required)</option>
                    <option value="open">Open Collaboration</option>
                </select>
            </div>
        </div>
    );
}

export function PreFlightModal({
                                   waitingMode,
                                   setWaitingMode,
                                   micLocked,
                                   setMicLocked,
                                   muteOnEntry,
                                   setMuteOnEntry,
                                   cameraOffOnEntry,
                                   setCameraOffOnEntry,
                                   allowScreenshare,
                                   setAllowScreenshare,
                                   allowCohostWhiteboard,
                                   setAllowCohostWhiteboard,
                                   allowWhiteboard,
                                   setAllowWhiteboard,
                                   chatLocked,
                                   setChatLocked,
                                   chatHostOnly,
                                   setChatHostOnly,
                                   allowDirectChat,
                                   setAllowDirectChat,
                                   allowReactions,
                                   setAllowReactions,
                                   autoDownloadCsv,
                                   setAutoDownloadCsv,
                                   onConfirmLaunch,
                                   onClose
                               }) {
    return (
        <div style={modalBackdropStyle}>
            <div style={modalCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sliders size={18} color="#38bdf8" />
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#38bdf8', fontWeight: '800' }}>Pre-Meeting Security & Controls</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '2px' }}>
                    <div>
                        <label style={settingLabelStyle}>Waiting Room Admission Policy</label>
                        <select value={waitingMode} onChange={(e) => setWaitingMode(e.target.value)} style={selectInputStyle}>
                            <option value="direct">Direct Bypass (Instant Join without approval)</option>
                            <option value="strict">Strict (Host/Co-Host Approval Required)</option>
                            <option value="open">Open Collaboration Room</option>
                        </select>
                    </div>

                    <div style={featureBoxStyle}>
                        <span style={groupHeadingStyle}>MIC LOCK & AUDIO ENTRY</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ ...rowBaseStyle, background: micLocked ? 'rgba(239, 68, 68, 0.15)' : 'transparent', border: micLocked ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid transparent' }}>
                                <input type="checkbox" checked={micLocked} onChange={(e) => setMicLocked(e.target.checked)} style={{ ...checkboxSquareStyle, accentColor: '#ef4444' }} />
                                <span style={{ fontWeight: '700', color: micLocked ? '#f87171' : '#f8fafc' }}>Permanent Mic Lock (Only Host/Co-Host Unmute)</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={muteOnEntry} onChange={(e) => setMuteOnEntry(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Mute Participants Mic on Entry</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={cameraOffOnEntry} onChange={(e) => setCameraOffOnEntry(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Turn off Participants Camera on Entry</span>
                            </label>
                        </div>
                    </div>

                    <div style={featureBoxStyle}>
                        <span style={groupHeadingStyle}>COLLABORATION & WHITEBOARD</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowScreenshare} onChange={(e) => setAllowScreenshare(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Allow Participants to Share Screen</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowCohostWhiteboard} onChange={(e) => setAllowCohostWhiteboard(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Allow Co-Host to Present Whiteboard</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowWhiteboard} onChange={(e) => setAllowWhiteboard(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Enable Interactive Whiteboard Feature</span>
                            </label>
                        </div>
                    </div>

                    <div style={featureBoxStyle}>
                        <span style={groupHeadingStyle}>COMMUNICATION & ATTENDANCE</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ ...rowBaseStyle, background: chatHostOnly ? 'rgba(2, 132, 199, 0.18)' : 'transparent', border: chatHostOnly ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent' }}>
                                <input type="checkbox" checked={chatHostOnly} onChange={(e) => setChatHostOnly(e.target.checked)} style={{ ...checkboxSquareStyle, accentColor: '#38bdf8' }} />
                                <span style={{ fontWeight: '700', color: chatHostOnly ? '#38bdf8' : '#f8fafc' }}>Host-Only Chat Mode</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={chatLocked} onChange={(e) => setChatLocked(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Lock Public In-Meeting Chat</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowDirectChat} onChange={(e) => setAllowDirectChat(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Allow 1-on-1 Direct Chat</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowReactions} onChange={(e) => setAllowReactions(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Allow Emoji Reactions</span>
                            </label>
                            <label style={{ ...rowBaseStyle, background: autoDownloadCsv ? 'rgba(16, 185, 129, 0.15)' : 'transparent', border: autoDownloadCsv ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid transparent' }}>
                                <input type="checkbox" checked={autoDownloadCsv} onChange={(e) => setAutoDownloadCsv(e.target.checked)} style={{ ...checkboxSquareStyle, accentColor: '#10b981' }} />
                                <span style={{ fontWeight: '700', color: autoDownloadCsv ? '#34d399' : '#f8fafc' }}>Auto-download CSV on End Meeting</span>
                            </label>
                        </div>
                    </div>
                </div>

                <button onClick={onConfirmLaunch} style={primaryBtnStyle}>
                    🚀 Launch Instant Meeting
                </button>
            </div>
        </div>
    );
}

export function ScheduleModal({
                                  scheduleTitle,
                                  setScheduleTitle,
                                  scheduleDate,
                                  setScheduleDate,
                                  scheduleTime,
                                  setScheduleTime,
                                  scheduleDuration,
                                  setScheduleDuration,
                                  micLocked,
                                  setMicLocked,
                                  muteOnEntry,
                                  setMuteOnEntry,
                                  allowScreenshare,
                                  setAllowScreenshare,
                                  allowCohostWhiteboard,
                                  setAllowCohostWhiteboard,
                                  allowWhiteboard,
                                  setAllowWhiteboard,
                                  chatLocked,
                                  setChatLocked,
                                  chatHostOnly,
                                  setChatHostOnly,
                                  allowDirectChat,
                                  setAllowDirectChat,
                                  allowReactions,
                                  setAllowReactions,
                                  autoDownloadCsv,
                                  setAutoDownloadCsv,
                                  loading,
                                  onSaveSchedule,
                                  onClose
                              }) {
    return (
        <div style={modalBackdropStyle}>
            <div style={modalCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={18} color="#38bdf8" />
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#38bdf8', fontWeight: '800' }}>Schedule Meeting & Controls</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <form onSubmit={onSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '65vh', overflowY: 'auto', paddingRight: '2px' }}>
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
                            onChange={(e) => setScheduleDuration(parseInt(e.target.value, 10))}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={micLocked} onChange={(e) => setMicLocked(e.target.checked)} style={{ ...checkboxSquareStyle, accentColor: '#ef4444' }} />
                                <span>Lock Mic Permanently</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={muteOnEntry} onChange={(e) => setMuteOnEntry(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Mute Participants Mic on Entry</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={chatHostOnly} onChange={(e) => setChatHostOnly(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Host-Only Chat</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={chatLocked} onChange={(e) => setChatLocked(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Lock Public In-Meeting Chat</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowDirectChat} onChange={(e) => setAllowDirectChat(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Allow 1-on-1 Direct Chat</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowScreenshare} onChange={(e) => setAllowScreenshare(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Allow Screen Sharing</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowCohostWhiteboard} onChange={(e) => setAllowCohostWhiteboard(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Allow Co-Host Whiteboard Presentation</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowWhiteboard} onChange={(e) => setAllowWhiteboard(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Enable Whiteboard</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={allowReactions} onChange={(e) => setAllowReactions(e.target.checked)} style={checkboxSquareStyle} />
                                <span>Allow Emoji Reactions</span>
                            </label>
                            <label style={rowBaseStyle}>
                                <input type="checkbox" checked={autoDownloadCsv} onChange={(e) => setAutoDownloadCsv(e.target.checked)} style={{ ...checkboxSquareStyle, accentColor: '#10b981' }} />
                                <span>Auto-download CSV on End Meeting</span>
                            </label>
                        </div>
                    </div>

                    <button type="submit" disabled={loading} style={{ ...primaryBtnStyle, marginTop: '8px' }}>
                        📅 Save & Schedule Meeting
                    </button>
                </form>
            </div>
        </div>
    );
}

// Rigid, Pixel-Aligned CSS Objects
const modalBackdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(6px)',
    zIndex: 100001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px'
};

const modalCardStyle = {
    background: '#131b2e',
    border: '1px solid rgba(56, 189, 248, 0.4)',
    borderRadius: '16px',
    padding: '20px',
    width: '100%',
    maxWidth: '460px',
    boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
    boxSizing: 'border-box'
};

const settingLabelStyle = {
    fontSize: '0.76rem',
    color: '#94a3b8',
    display: 'block',
    marginBottom: '6px',
    fontWeight: '700',
    letterSpacing: '0.3px'
};

const selectInputStyle = {
    width: '100%',
    height: '38px',
    padding: '0 10px',
    background: '#090d16',
    border: '1px solid #334155',
    color: '#ffffff',
    borderRadius: '7px',
    fontSize: '0.8rem',
    boxSizing: 'border-box',
    outline: 'none',
    display: 'block'
};

const rowBaseStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.82rem',
    cursor: 'pointer',
    color: '#f8fafc',
    padding: '7px 8px',
    borderRadius: '6px',
    userSelect: 'none',
    boxSizing: 'border-box',
    width: '100%',
    margin: 0
};

const checkboxSquareStyle = {
    width: '16px',
    height: '16px',
    minWidth: '16px',
    minHeight: '16px',
    cursor: 'pointer',
    accentColor: '#38bdf8',
    margin: 0,
    padding: 0,
    flexShrink: 0,
    display: 'block'
};

const featureBoxStyle = {
    background: '#090d16',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #1e293b',
    boxSizing: 'border-box',
    width: '100%'
};

const groupHeadingStyle = {
    fontSize: '0.68rem',
    color: '#38bdf8',
    fontWeight: '800',
    letterSpacing: '0.6px',
    display: 'block',
    marginBottom: '6px',
    textTransform: 'uppercase'
};

const primaryBtnStyle = {
    width: '100%',
    padding: '11px',
    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '0.85rem',
    boxShadow: '0 4px 14px rgba(2,132,199,0.3)',
    boxSizing: 'border-box'
};