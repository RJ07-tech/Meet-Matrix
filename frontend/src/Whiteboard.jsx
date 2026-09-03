import { useRef, useState, useEffect } from 'react';
import { Pen, Eraser, RotateCcw, X, Share2, Square, Circle, Type } from 'lucide-react';
import { LocalVideoTrack } from 'livekit-client';

let persistentDrawingHistory = [];

export default function Whiteboard({ isModerator, onClose, localParticipant }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(4);
    const [isSharingBoard, setIsSharingBoard] = useState(false);
    const screenTrackRef = useRef(null);
    const startPosRef = useRef({ x: 0, y: 0 });
    const snapshotRef = useRef(null);
    const animFrameIdRef = useRef(null);

    // Editable text boxes on canvas
    const [textItems, setTextItems] = useState([]);
    const [activeTextId, setActiveTextId] = useState(null);

    const fillWhiteBackground = (ctx, width, height) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
    };

    const redrawHistory = (ctx) => {
        persistentDrawingHistory.forEach(action => {
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
    };

    const startHeartbeatPump = () => {
        const pump = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const pixel = ctx.getImageData(0, 0, 1, 1);
                ctx.putImageData(pixel, 0, 0);
            }
            animFrameIdRef.current = requestAnimationFrame(pump);
        };
        pump();
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 56;

        fillWhiteBackground(ctx, canvas.width, canvas.height);

        if (persistentDrawingHistory.length > 0) {
            redrawHistory(ctx);
        }

        startHeartbeatPump();

        const handleResize = () => {
            if (!canvas) return;
            const temp = ctx.getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - 56;
            fillWhiteBackground(ctx, canvas.width, canvas.height);
            ctx.putImageData(temp, 0, 0);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
        };
    }, []);

    const stopWhiteboardSharing = async () => {
        if (screenTrackRef.current && localParticipant) {
            try {
                await localParticipant.unpublishTrack(screenTrackRef.current);
                screenTrackRef.current.stop();
            } catch (e) {}
            screenTrackRef.current = null;
        }
        if (localParticipant?.isScreenShareEnabled) {
            try {
                await localParticipant.setScreenShareEnabled(false);
            } catch (e) {}
        }
        setIsSharingBoard(false);
    };

    const handleCloseWhiteboard = async () => {
        await stopWhiteboardSharing();
        onClose();
    };

    const toggleShareCanvas = async () => {
        // Point 2: Restricted to Host and Co-Host only
        if (!isModerator) {
            alert("Only Host and Co-Hosts can present the whiteboard.");
            return;
        }
        if (!localParticipant) return;

        if (isSharingBoard) {
            await stopWhiteboardSharing();
        } else {
            try {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');

                if (persistentDrawingHistory.length === 0) {
                    fillWhiteBackground(ctx, canvas.width, canvas.height);
                }

                const stream = canvas.captureStream(30);
                const track = stream.getVideoTracks()[0];
                if (!track) return;

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

    // Point 3: Direct Canvas Click Text Note Creation & Instant Editable Focus
    const handleCanvasClick = (e) => {
        if (tool !== 'text') return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newId = Date.now();
        const newText = { id: newId, x, y, text: 'Click & type note...', color };
        setTextItems(prev => [...prev, newText]);
        setActiveTextId(newId);
    };

    const handleTextChange = (id, newContent) => {
        setTextItems(prev => prev.map(t => t.id === id ? { ...t, text: newContent } : t));
    };

    const currentPointsRef = useRef([]);

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

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = ((e?.clientX || e?.changedTouches?.[0]?.clientX) || startPosRef.current.x) - rect.left;
        const y = ((e?.clientY || e?.changedTouches?.[0]?.clientY) || startPosRef.current.y) - rect.top;

        if (tool === 'pen' || tool === 'eraser') {
            persistentDrawingHistory.push({
                type: 'stroke',
                color: tool === 'eraser' ? '#ffffff' : color,
                size: tool === 'eraser' ? brushSize * 4 : brushSize,
                points: [...currentPointsRef.current]
            });
            currentPointsRef.current = [];
        } else if (tool === 'rectangle') {
            persistentDrawingHistory.push({
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
            persistentDrawingHistory.push({
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
        persistentDrawingHistory = [];
        setTextItems([]);
        setActiveTextId(null);
    };

    return (
        <div style={fixedContainerStyle}>
            <div style={toolbarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '800', color: '#38bdf8', fontSize: '0.85rem' }}>Whiteboard</span>

                    <div style={{ display: 'flex', background: '#090d16', padding: '2px', borderRadius: '6px', border: '1px solid #334155' }}>
                        <button onClick={() => setTool('pen')} style={{ ...iconBtnStyle, background: tool === 'pen' ? '#0284c7' : 'transparent' }} title="Pen">
                            <Pen size={14} />
                        </button>
                        <button onClick={() => setTool('text')} style={{ ...iconBtnStyle, background: tool === 'text' ? '#0284c7' : 'transparent' }} title="Text Tool (Click Canvas to Write)">
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

                    {tool !== 'eraser' && (
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            style={{ width: '26px', height: '26px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        />
                    )}

                    <input
                        type="range"
                        min="2"
                        max="24"
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        style={{ width: '60px', accentColor: '#38bdf8' }}
                    />

                    <button onClick={clearBoard} style={actionBtnStyle} title="Clear Canvas">
                        <RotateCcw size={14} /> Clear
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Point 2: Present Board Live visible ONLY for Host and Co-Hosts */}
                    {isModerator && (
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
                    onClick={handleCanvasClick}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                    style={{ display: 'block', width: '100%', height: '100%', cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none', background: '#ffffff' }}
                />

                {/* Point 3: Real-Time Editable Text Elements */}
                {textItems.map(item => (
                    <div
                        key={item.id}
                        style={{
                            position: 'absolute',
                            left: `${item.x}px`,
                            top: `${item.y}px`,
                            zIndex: 20
                        }}
                    >
                        <textarea
                            value={item.text}
                            onChange={(e) => handleTextChange(item.id, e.target.value)}
                            onFocus={() => setActiveTextId(item.id)}
                            rows={1}
                            style={{
                                background: activeTextId === item.id ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
                                border: activeTextId === item.id ? '1px dashed #0284c7' : '1px solid transparent',
                                outline: 'none',
                                color: item.color,
                                fontSize: '18px',
                                fontWeight: '700',
                                fontFamily: 'Inter, system-ui, sans-serif',
                                resize: 'none',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                minWidth: '140px',
                                boxShadow: activeTextId === item.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

const fixedContainerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 999999,
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column'
};

const toolbarStyle = {
    height: '56px',
    background: '#0f172a',
    color: '#ffffff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 12px',
    borderBottom: '2px solid #0284c7',
    flexShrink: 0
};

const iconBtnStyle = {
    background: 'transparent',
    border: 'none',
    color: '#f8fafc',
    padding: '6px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const actionBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#f8fafc',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    cursor: 'pointer'
};

const closeBtnStyle = {
    background: '#ef4444',
    border: 'none',
    color: '#ffffff',
    padding: '6px 8px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};