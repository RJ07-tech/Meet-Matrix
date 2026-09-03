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

    // Single active text editing box
    const [activeTextInput, setActiveTextInput] = useState(null); // { id, x, y, text }
    const inputRef = useRef(null);

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
            } else if (action.type === 'text') {
                ctx.fillStyle = action.color;
                ctx.font = 'bold 18px Inter, system-ui, sans-serif';
                ctx.fillText(action.text, action.x, action.y);
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
        commitActiveText();
        await stopWhiteboardSharing();
        onClose();
    };

    const toggleShareCanvas = async () => {
        if (!isModerator) return;
        if (!localParticipant) return;

        if (isSharingBoard) {
            await stopWhiteboardSharing();
        } else {
            try {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');

                commitActiveText();

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
                alert("Whiteboard share error: " + err.message);
            }
        }
    };

    // Commit current active text permanently to canvas
    const commitActiveText = () => {
        if (!activeTextInput || !activeTextInput.text.trim()) {
            setActiveTextInput(null);
            return;
        }

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = activeTextInput.color || color;
            ctx.font = 'bold 18px Inter, system-ui, sans-serif';
            ctx.fillText(activeTextInput.text, activeTextInput.x, activeTextInput.y + 16);

            persistentDrawingHistory.push({
                type: 'text',
                text: activeTextInput.text,
                x: activeTextInput.x,
                y: activeTextInput.y + 16,
                color: activeTextInput.color || color,
                boxWidth: 200,
                boxHeight: 28
            });
        }
        setActiveTextInput(null);
    };

    // Canvas click: create or edit text
    const handleCanvasClick = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Check if clicking existing text to re-edit
        const existingIdx = persistentDrawingHistory.findIndex(
            item => item.type === 'text' &&
                clickX >= item.x && clickX <= item.x + (item.boxWidth || 180) &&
                clickY >= item.y - 18 && clickY <= item.y + 10
        );

        if (existingIdx !== -1) {
            const target = persistentDrawingHistory[existingIdx];
            persistentDrawingHistory.splice(existingIdx, 1);

            // Redraw canvas without this text item
            const ctx = canvas.getContext('2d');
            fillWhiteBackground(ctx, canvas.width, canvas.height);
            redrawHistory(ctx);

            setActiveTextInput({
                x: target.x,
                y: target.y - 16,
                text: target.text,
                color: target.color
            });
            setTimeout(() => inputRef.current?.focus(), 50);
            return;
        }

        if (tool === 'text') {
            commitActiveText();
            setActiveTextInput({
                x: clickX,
                y: clickY,
                text: '',
                color
            });
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const currentPointsRef = useRef([]);

    const startDraw = (e) => {
        if (tool === 'text') return;
        commitActiveText();

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
        setActiveTextInput(null);
    };

    return (
        <div style={fixedContainerStyle}>
            <div style={toolbarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '800', color: '#38bdf8', fontSize: '0.85rem' }}>Whiteboard</span>

                    <div style={{ display: 'flex', background: '#090d16', padding: '2px', borderRadius: '6px', border: '1px solid #334155' }}>
                        <button onClick={() => { commitActiveText(); setTool('pen'); }} style={{ ...iconBtnStyle, background: tool === 'pen' ? '#0284c7' : 'transparent' }} title="Pen">
                            <Pen size={14} />
                        </button>
                        <button onClick={() => setTool('text')} style={{ ...iconBtnStyle, background: tool === 'text' ? '#0284c7' : 'transparent' }} title="Text Tool (Click anywhere on board to type/edit)">
                            <Type size={14} />
                        </button>
                        <button onClick={() => { commitActiveText(); setTool('eraser'); }} style={{ ...iconBtnStyle, background: tool === 'eraser' ? '#0284c7' : 'transparent' }} title="Eraser">
                            <Eraser size={14} />
                        </button>
                        <button onClick={() => { commitActiveText(); setTool('rectangle'); }} style={{ ...iconBtnStyle, background: tool === 'rectangle' ? '#0284c7' : 'transparent' }} title="Rectangle">
                            <Square size={14} />
                        </button>
                        <button onClick={() => { commitActiveText(); setTool('circle'); }} style={{ ...iconBtnStyle, background: tool === 'circle' ? '#0284c7' : 'transparent' }} title="Circle">
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
                    {/* Share Board button visible ONLY for Host and Co-Hosts */}
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
                    style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                        cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair',
                        touchAction: 'none',
                        background: '#ffffff'
                    }}
                />

                {/* Single Active Editable Input Box */}
                {activeTextInput && (
                    <input
                        ref={inputRef}
                        type="text"
                        value={activeTextInput.text}
                        placeholder="Type text note..."
                        onChange={(e) => setActiveTextInput(prev => ({ ...prev, text: e.target.value }))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitActiveText();
                            if (e.key === 'Escape') setActiveTextInput(null);
                        }}
                        onBlur={commitActiveText}
                        style={{
                            position: 'absolute',
                            left: `${activeTextInput.x}px`,
                            top: `${activeTextInput.y}px`,
                            background: 'rgba(255, 255, 255, 0.95)',
                            border: '1.5px dashed #0284c7',
                            outline: 'none',
                            color: activeTextInput.color || color,
                            fontSize: '18px',
                            fontWeight: '700',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            minWidth: '160px',
                            zIndex: 30,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                        }}
                    />
                )}
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