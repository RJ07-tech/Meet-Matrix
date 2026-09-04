import React, { useState } from 'react';
import { X, Smile, Send } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';

export default function ChatDrawer({
                                       onClose,
                                       chatMessages,
                                       allowDirectChat,
                                       remoteParticipants,
                                       chatRecipient,
                                       setChatRecipient,
                                       chatLocked,
                                       isEffectiveModerator,
                                       onSendMessage
                                   }) {
    const [chatInput, setChatInput] = useState('');
    const [showChatEmojiPicker, setShowChatEmojiPicker] = useState(false);

    const handleChatEmojiPicked = (emojiData) => {
        setChatInput(prev => prev + emojiData.emoji);
        setShowChatEmojiPicker(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        onSendMessage(chatInput.trim(), chatRecipient);
        setChatInput('');
        setShowChatEmojiPicker(false);
    };

    return (
        <div style={sideDrawerStyle}>
            <div style={drawerHeaderStyle}>
                <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>In-Meeting Chat</span>
                <button onClick={onClose} style={drawerCloseBtn}><X size={16} /></button>
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

            <form onSubmit={handleSubmit} style={{ padding: '8px 12px', background: '#090d16', borderTop: '1px solid #1e293b', display: 'flex', gap: '6px', alignItems: 'center' }}>
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
    );
}

const sideDrawerStyle = { width: '320px', maxWidth: '85vw', background: '#0f172a', borderLeft: '1px solid #334155', height: '100%', zIndex: 50, position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column' };
const drawerHeaderStyle = { padding: '12px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const drawerCloseBtn = { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' };