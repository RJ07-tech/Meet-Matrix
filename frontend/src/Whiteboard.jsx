import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Pen, Eraser, RotateCcw, X, Share2, Square, Circle, Type, Trash2, Bell } from 'lucide-react';
import { LocalVideoTrack } from 'livekit-client';

export default function Whiteboard({
                                       isHost,
                                       isCoHost,
                                       allowCohostWhiteboard,
                                       activeScreenSharer,
                                       onClose,
                                       localParticipant,
                                       drawingHistoryRef,
                                       boardText,
                                       setBoardText,
                                       whiteboardAlerts = []
                                   }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(4);
    const [isSharingBoard, setIsSharingBoard] = useState(false);

    const screenTrackRef = useRef(null);
    const startPosRef = useRef({ x: 0, y: 0 });
    const snapshotRef = useRef(null);
    const currentPointsRef = useRef([]);

    const canPresentWhiteboard = isHost || (isCoHost && allowCohostWhiteboard);

    const fillWhiteBackground = (ctx, width, height) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
    };

    const redrawAll = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;

        fillWhiteBackground(ctx, width, height);

        if (drawingHistoryRef && drawingHistoryRef.current) {
            drawingHistoryRef.current.forEach(action => {
                if (action.type === 'stroke') {
                    ctx.strokeStyle = action.color;
                    ctx.lineWidth = action.size;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    action.points.forEach((pt, idx) => {
                        if (idx === 0) ctx.moveTo(pt.x, pt.y);
                        else ctx.lineTo(pt.x, pt.y);
                    });
                    ctx.stroke();
                } else if (action.type === 'rect') {
                    ctx.strokeStyle = action.color;
                    ctx.lineWidth = action.size;
                    ctx.strokeRect(action.x, action.y, action.w, action.h);
                } else if (action.type === 'circle') {
                    ctx.strokeStyle = action.color;
                    ctx.lineWidth = action.size;
                    ctx.beginPath();
                    ctx.arc(action.x, action.y, action.r, 0, 2 * Math.PI);
                    ctx.stroke();
                }
            });
        }
    }, [drawingHistoryRef]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - 56;
            redrawAll();
        };

        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [redrawAll]);

    const stopWhiteboardSharing = async () => {
        if (screenTrackRef.current && localParticipant) {
            try {
                await localParticipant.unpublishTrack(screenTrackRef.current);
                screenTrackRef.current.stop();
            } catch {}
            screenTrackRef.current = null;
        }
        setIsSharingBoard(false);
    };

    const handleCloseWhiteboard = async () => {
        await stopWhiteboardSharing();
        onClose();
    };

    const toggleShareCanvas = async () => {
        if (!canPresentWhiteboard) {
            alert("Host has restricted whiteboard presentation permissions.");
            return;
        }
        if (!localParticipant) return;

        if (isSharingBoard) {
            await stopWhiteboardSharing();
        } else {
            if (activeScreenSharer && activeScreenSharer !== localParticipant.identity) {
                alert("Someone is already sharing their screen. Only one person can share at a time.");
                return;
            }

            try {
                const canvas = canvasRef.current;
                redrawAll();

                // Capture stream at 30fps
                const stream = canvas.captureStream(30);
                const track = stream.getVideoTracks()[0];
                if (!track) return;

                // FIX BLANK SCREEN: Force render frames for 2 seconds to prime the encoder
                let frameCount = 0;
                const primeInterval = setInterval(() => {
                    redrawAll();
                    frameCount++;
                    if (frameCount > 20) clearInterval(primeInterval);
                }, 100);

                const localVideoTrack = new LocalVideoTrack(track, { name: 'whiteboard' });
                screenTrackRef.current = localVideoTrack;

                track.onended = () => {
                    setIsSharingBoard(false);
                };

                await localParticipant.publishTrack(localVideoTrack, {
                    name: 'whiteboard-share',
                    source: 'screen_share'
                });
                setIsSharingBoard(true);
            } catch (err) {
                alert("Could not share whiteboard: " + err.message);
            }
        }
    };

    const startDraw = (e) => {
        if (tool === 'text') return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

        setIsDrawing(true);
        startPosRef.current = { x, y };

        const ctx = canvas.getContext('2d');
        snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (tool === 'pen' || tool === 'eraser') {
            currentPointsRef.current = [{ x, y }];
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
            ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    };

    const draw = (e) => {
        if (!isDrawing || tool === 'text') return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

        if (tool === 'pen' || tool === 'eraser') {
            ctx.lineTo(x, y);
            ctx.stroke();
            currentPointsRef.current.push({ x, y });
        } else if (tool === 'rectangle') {
            ctx.putImageData(snapshotRef.current, 0, 0);
            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
            ctx.strokeRect(startPosRef.current.x, startPosRef.current.y, x - startPosRef.current.x, y - startPosRef.current.y);
        } else if (tool === 'circle') {
            ctx.putImageData(snapshotRef.current, 0, 0);
            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
            const r = Math.hypot(x - startPosRef.current.x, y - startPosRef.current.y);
            ctx.beginPath();
            ctx.arc(startPosRef.current.x, startPosRef.current.y, r, 0, 2 * Math.PI);
            ctx.stroke();
        }
    };

    const stopDraw = (e) => {
        if (!isDrawing || tool === 'text') return;
        setIsDrawing(false);

        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((e?.clientX || e?.changedTouches?.[0]?.clientX) || startPosRef.current.x) - rect.left;
        const y = ((e?.clientY || e?.changedTouches?.[0]?.clientY) || startPosRef.current.y) - rect.top;

        if (tool === 'pen' || tool === 'eraser') {
            drawingHistoryRef.current.push({
                type: 'stroke',
                color: tool === 'eraser' ? '#ffffff' : color,
                size: tool === 'eraser' ? brushSize * 4 : brushSize,
                points: [...currentPointsRef.current]
            });
            currentPointsRef.current = [];
        } else if (tool === 'rectangle') {
            drawingHistoryRef.current.push({
                type: 'rect',
                color,
                size: brushSize,
                x: startPosRef.current.x,
                y: startPosRef.current.y,
                w: x - startPosRef.current.x,
                h: y - startPosRef.current.y
            });
        } else if (tool === 'circle') {
            const r = Math.hypot(x - startPosRef.current.x, y - startPosRef.current.y);
            drawingHistoryRef.current.push({
                type: 'circle',
                color,
                size: brushSize,
                x: startPosRef.current.x,
                y: startPosRef.current.y,
                r
            });
        }
    };

    const clearBoard = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        fillWhiteBackground(ctx, canvas.width, canvas.height);
        drawingHistoryRef.current = [];
    };

    return (
        <div style={fixedContainerStyle}>
            {/* Whiteboard In-App Meeting Notifications Overlay */}
            {whiteboardAlerts.length > 0 && (
                <div style={{ position: 'absolute', top: '65px', right: '20px', zIndex: 9999999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
                    {whiteboardAlerts.map(alert => (
                        <div key={alert.id} style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #38bdf8', color: '#fff', padding: '8px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', fontSize: '0.82rem', fontWeight: '700' }}>
                            <Bell size={15} color="#38bdf8" />
                            <span>{alert.message}</span>
                        </div>
                    ))}
                </div>
            )}

            <div style={toolbarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '800', color: '#38bdf8', fontSize: '0.85rem' }}>Whiteboard</span>

                    <div style={{ display: 'flex', background: '#090d16', padding: '2px', borderRadius: '6px', border: '1px solid #334155' }}>
                        <button onClick={() => setTool('pen')} style={{ ...iconBtnStyle, background: tool === 'pen' ? '#0284c7' : 'transparent' }} title="Pen">
                            <Pen size={14} />
                        </button>
                        <button onClick={() => setTool('text')} style={{ ...iconBtnStyle, background: tool === 'text' ? '#0284c7' : 'transparent' }} title="Full Board Text Mode">
                            <Type size={14} />
                        </button>
                        <button onClick={() => setTool('eraser')} style={{ ...iconBtnStyle, background: tool === 'eraser' ? '#0284c7' : 'transparent' }} title="Eraser">
                            <Eraser size={14} />
                        </button>
                        <button onClick={() => setTool('rectangle')} style={{ ...iconBtnStyle, background: tool === 'rectangle' ? '#0284c7' : 'transparent' }} title="Rectangle">
                            <Square size={14} />
                        </button>
                        <button onClick={() => setTool('circle')} style={{ ...iconBtnStyle, background: tool === 'circle' ? '#0284c7' : 'transparent' }} title="Circle">
                            <Circle size={14} />
                        </button>
                    </div>

                    {tool !== 'eraser' && tool !== 'text' && (
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            style={{ width: '26px', height: '26px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        />
                    )}

                    {tool !== 'text' && (
                        <input
                            type="range"
                            min="2"
                            max="24"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                            style={{ width: '60px', accentColor: '#38bdf8' }}
                        />
                    )}

                    <button onClick={clearBoard} style={actionBtnStyle} title="Clear Canvas Drawings">
                        <RotateCcw size={14} /> Clear Drawing
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {canPresentWhiteboard && (
                        <button
                            onClick={toggleShareCanvas}
                            style={{
                                ...actionBtnStyle,
                                background: isSharingBoard ? '#ef4444' : '#0284c7',
                                color: '#ffffff',
                                fontWeight: '700'
                            }}
                        >
                            <Share2 size={14} />
                            {isSharingBoard ? 'Stop Sharing Board' : 'Present Board Live'}
                        </button>
                    )}

                    <button onClick={handleCloseWhiteboard} style={closeBtnStyle} title="Close Whiteboard">
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative', background: '#ffffff', overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                    style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        cursor: tool === 'text' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair',
                        touchAction: 'none',
                        background: '#ffffff'
                    }}
                />

                {/* FULL-BOARD TEXT EDITOR OVERLAY */}
                {tool === 'text' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.96)', zIndex: 50, display: 'flex', flexDirection: 'column', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0284c7' }}>📝 Full-Board Notebook / Text Mode</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setBoardText('')}
                                    style={{ ...actionBtnStyle, background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', fontWeight: '700' }}
                                    title="Delete all text"
                                >
                                    <Trash2 size={13} /> Delete Text
                                </button>
                                <button
                                    onClick={() => setTool('pen')}
                                    style={{ ...actionBtnStyle, background: '#0284c7', color: '#fff', fontWeight: '700' }}
                                >
                                    Done Writing
                                </button>
                            </div>
                        </div>
                        <textarea
                            autoFocus
                            value={boardText}
                            placeholder="Type notes, code, or ideas here (Press Enter for next line)..."
                            onChange={(e) => setBoardText(e.target.value)}
                            style={{
                                flex: 1,
                                width: '100%',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                background: 'transparent',
                                fontSize: '1.1rem',
                                lineHeight: '1.6',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                color: '#0f172a'
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

const fixedContainerStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 999999, background: '#ffffff', display: 'flex', flexDirection: 'column' };
const toolbarStyle = { height: '56px', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', borderBottom: '2px solid #0284c7', flexShrink: 0 };
const iconBtnStyle = { background: 'transparent', border: 'none', color: '#f8fafc', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const actionBtnStyle = { display: 'flex', alignItems: 'center', gap: '5px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' };
const closeBtnStyle = { background: '#ef4444', border: 'none', color: '#ffffff', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };