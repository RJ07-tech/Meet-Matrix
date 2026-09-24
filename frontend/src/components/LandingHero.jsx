import React, { useState } from 'react';

export default function LandingHero({ onStartHost, onJoinGuest }) {
    const [joinCode, setJoinCode] = useState('');

    const handleJoinSubmit = (e) => {
        e.preventDefault();
        if (joinCode.trim()) {
            onJoinGuest(joinCode.trim());
        }
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div style={styles.logoRow}>
                    <div style={styles.flagIndicator} />
                    <h1 style={styles.brandTitle}>Meet<span style={{ color: 'var(--accent-saffron)' }}>Matrix</span></h1>
                </div>
                <div style={styles.badge}> • Secure WebRTC</div>
            </header>

            <div style={styles.heroSection}>
                <h2 style={styles.mainHeading}>Enterprise-Grade Video Conferencing</h2>
                <p style={styles.subHeading}>
                    Low-latency, ultra-crisp audio & video collaboration engineered for speed and privacy.
                </p>

                <div style={styles.actionGrid}>
                    {/* Host Card */}
                    <div style={styles.card}>
                        <div style={{ ...styles.iconCircle, background: 'rgba(255, 153, 51, 0.15)', color: 'var(--accent-saffron)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                        </div>
                        <h3 style={styles.cardTitle}>Host a New Meeting</h3>
                        <p style={styles.cardText}>Create an instant conference room, invite participants, and manage admin privileges.</p>
                        <button
                            style={{ ...styles.primaryBtn, background: 'var(--accent-saffron)' }}
                            onClick={onStartHost}
                        >
                            Start as Host &rarr;
                        </button>
                    </div>

                    {/* Join with Code Card */}
                    <div style={styles.card}>
                        <div style={{ ...styles.iconCircle, background: 'rgba(19, 136, 8, 0.15)', color: '#22c55e' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="M7 8h10M7 12h4M7 16h8" />
                            </svg>
                        </div>
                        <h3 style={styles.cardTitle}>Join with a Code</h3>
                        <p style={styles.cardText}>Enter a meeting room code or ID shared by your organizer to enter the call.</p>
                        <form onSubmit={handleJoinSubmit} style={styles.joinForm}>
                            <input
                                type="text"
                                placeholder="Enter Meeting Code (e.g. mm-9a8c)"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                style={styles.input}
                            />
                            <button
                                type="submit"
                                style={{ ...styles.primaryBtn, background: 'var(--accent-green)' }}
                                disabled={!joinCode.trim()}
                            >
                                Join Room &rarr;
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px 32px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--surface-border)',
    },
    logoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    flagIndicator: {
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: 'linear-gradient(180deg, #ff9933 33%, #ffffff 33%, #ffffff 66%, #138808 66%)',
        boxShadow: '0 0 10px rgba(255, 153, 51, 0.5)',
    },
    brandTitle: {
        margin: 0,
        fontSize: '24px',
        fontWeight: 700,
        letterSpacing: '-0.5px',
    },
    badge: {
        fontSize: '12px',
        padding: '4px 10px',
        borderRadius: '20px',
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid var(--surface-border)',
        color: 'var(--text-secondary)',
    },
    heroSection: {
        margin: 'auto 0',
        textAlign: 'center',
        padding: '40px 0',
    },
    mainHeading: {
        fontSize: '44px',
        fontWeight: 800,
        letterSpacing: '-1px',
        margin: '0 0 16px 0',
        color: '#ffffff',
    },
    subHeading: {
        fontSize: '18px',
        color: 'var(--text-secondary)',
        maxWidth: '650px',
        margin: '0 auto 48px auto',
        lineHeight: 1.5,
    },
    actionGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '32px',
        maxWidth: '850px',
        margin: '0 auto',
        textAlign: 'left',
    },
    card: {
        background: 'var(--surface-card)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--surface-border)',
        borderRadius: '16px',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
    },
    iconCircle: {
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
    },
    cardTitle: {
        margin: '0 0 8px 0',
        fontSize: '20px',
        fontWeight: 600,
    },
    cardText: {
        fontSize: '14px',
        color: 'var(--text-secondary)',
        margin: '0 0 24px 0',
        lineHeight: 1.4,
        flexGrow: 1,
    },
    joinForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    input: {
        width: '100%',
        padding: '12px 14px',
        boxSizing: 'border-box',
        borderRadius: '8px',
        background: 'rgba(0, 0, 0, 0.4)',
        border: '1px solid var(--surface-border)',
        color: '#ffffff',
        fontSize: '14px',
        outline: 'none',
    },
    primaryBtn: {
        border: 'none',
        color: '#ffffff',
        padding: '14px 20px',
        fontSize: '15px',
        fontWeight: 600,
        borderRadius: '8px',
        cursor: 'pointer',
    }
};