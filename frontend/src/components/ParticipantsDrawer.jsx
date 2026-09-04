import React, { useState } from 'react';
import { X, Edit3, Check, MoreVertical, Shield, ShieldCheck, VolumeX, UserX, Video } from 'lucide-react';

export default function ParticipantsDrawer({
                                               onClose,
                                               allPeers,
                                               isHost,
                                               isEffectiveModerator,
                                               isScreenSharing,
                                               onSaveName,
                                               onToggleCoHost,
                                               onHostMute,
                                               onHostKick,
                                               onRequestVideo  // Point 7: Request Video Call
                                           }) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState('');
    const [activeMenuIdentity, setActiveMenuIdentity] = useState(null);

    const handleSave = () => {
        if (!editNameValue.trim()) return;
        onSaveName(editNameValue.trim());
        setIsEditingName(false);
    };

    return (
        <div style={sideDrawerStyle}>
            <div style={drawerHeaderStyle}>
                <span style={{ fontWeight: '800', fontSize: '0.88rem' }}>Participants ({allPeers.length})</span>
                <button onClick={onClose} style={drawerCloseBtn}><X size={16} /></button>
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
                                    <button onClick={handleSave} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}><Check size={12} /></button>
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
                                <button
                                    onClick={() => { setIsEditingName(true); setEditNameValue(p.name.replace(' (You)', '')); }}
                                    style={drawerActionBtn}
                                    title="Rename"
                                >
                                    <Edit3 size={13} />
                                </button>
                            )}

                            {/* Host Immunity: Host cannot be muted/kicked by anyone */}
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
                                            {/* Point 7: Ask to start video */}
                                            <button onClick={() => { onRequestVideo(p.identity, p.name); setActiveMenuIdentity(null); }} style={contextMenuItemStyle}>
                                                <Video size={14} color="#38bdf8" /> Ask to Start Video
                                            </button>

                                            {isHost && (
                                                <button onClick={() => { onToggleCoHost(p.identity); setActiveMenuIdentity(null); }} style={contextMenuItemStyle}>
                                                    {p.isCoHost ? <Shield size={14} color="#ef4444" /> : <ShieldCheck size={14} color="#10b981" />}
                                                    {p.isCoHost ? 'Revoke Co-Host' : 'Make Co-Host'}
                                                </button>
                                            )}

                                            <button onClick={() => { onHostMute(p.identity); setActiveMenuIdentity(null); }} style={contextMenuItemStyle}>
                                                <VolumeX size={14} color="#f59e0b" /> Mute Audio
                                            </button>
                                            <button onClick={() => { onHostKick(p.identity, p.name, p.isHost); setActiveMenuIdentity(null); }} style={{ ...contextMenuItemStyle, color: '#ef4444' }}>
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
    );
}

const sideDrawerStyle = { width: '320px', maxWidth: '85vw', background: '#0f172a', borderLeft: '1px solid #334155', height: '100%', zIndex: 50, position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column' };
const drawerHeaderStyle = { padding: '12px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const drawerCloseBtn = { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' };
const drawerActionBtn = { background: 'transparent', border: 'none', color: '#94a3b8', padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center' };
const contextMenuStyle = { position: 'absolute', right: 0, top: '26px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '5px', zIndex: 999, minWidth: '165px', boxShadow: '0 10px 25px rgba(0,0,0,0.6)' };
const contextMenuItemStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', borderRadius: '5px' };