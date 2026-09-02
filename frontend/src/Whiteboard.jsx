import React, { useRef, useState, useEffect } from 'react';
import {
    Pencil, Eraser, Trash2, Download, Lock, Unlock,
    X, Type, MonitorUp, StopCircle
} from 'lucide-react';

export default function Whiteboard({ isHost, onClose, localParticipant }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'text'
    const [color, setColor] = useState('#1e293b');
    const [lineWidth, setLineWidth] = useState(3);
    const [isLocked, setIsLocked] = useState(false);
    const [isSharingBoard, setIsSharingBoard] = useState(false);
    const textInputRef = useRef(null);
    const [textPos, setTextPos] = useState(null);
    const [textValue, setTextValue] = useState('');

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Set white canvas background
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight - 65;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const getCanvasCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const startDraw = (e) => {
        if (isLocked) return;
        if (tool === 'text') {
            const coords = getCanvasCoords(e);
            setTextPos(coords);
            setTextValue('');
            setTimeout(() => textInputRef.current?.focus(), 50);
            return;
        }

        const { x, y } = getCanvasCoords(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing || isLocked || tool === 'text') return;
        const { x, y } = getCanvasCoords(e);
        const ctx = canvasRef.current.getContext('2d');

        ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
        ctx.lineWidth = tool === 'eraser' ? 24 : lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDraw = () => {
        if (!isDrawing) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.closePath();
        setIsDrawing(false);
    };

    const handleCommitText = () => {
        if (!textPos || !textValue.trim()) {
            setTextPos(null);
            return;
        }
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = color;
        ctx.font = '18px Inter, system-ui, sans-serif';
        ctx.fillText(textValue, textPos.x, textPos.y + 14);
        setTextPos(null);
        setTextValue('');
    };

    const clearCanvas = () => {
        if (isLocked) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const savePNG = () => {
        const canvas = canvasRef.current;
        const image = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = image;
        a.download = `MeetMatrix-Whiteboard-${Date.now()}.png`;
        a.click();
    };

    // Host-only: Stream whiteboard canvas directly to video room via WebRTC
    const toggleShareWhiteboardStream = async () => {
        if (!isHost) {
            alert("Only the Host can broadcast the whiteboard directly as screen share.");
            return;
        }
        if (!localParticipant) return;

        if (!isSharingBoard) {
            try {
                const stream = canvasRef.current.captureStream(30);
                const videoTrack = stream.getVideoTracks()[0];
                await localParticipant.publishTrack(videoTrack, { name: 'whiteboard' });
                setIsSharingBoard(true);
            } catch (err) {
                alert("Could not share whiteboard: " + err.message);
            }
        } else {
            await localParticipant.setScreenShareEnabled(false);
            setIsSharingBoard(false);
        }
    };

    return (
        <div style={wbOverlayStyle}>
            <div style={wbModalStyle}>
                {/* Toolbar Header */}
                <div style={wbToolbarStyle}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => { setTool('pen'); setColor('#1e293b'); }}
                            style={{ ...wbBtnStyle, background: tool === 'pen' ? '#0284c7' : '#1e293b' }}
                        >
                            <Pencil size={15} /> Pen
                        </button>
                        <button
                            onClick={() => setTool('text')}
                            style={{ ...wbBtnStyle, background: tool === 'text' ? '#0284c7' : '#1e293b' }}
                        >
                            <Type size={15} /> Text Note
                        </button>
                        <button
                            onClick={() => setTool('eraser')}
                            style={{ ...wbBtnStyle, background: tool === 'eraser' ? '#0284c7' : '#1e293b' }}
                        >
                            <Eraser size={15} /> Eraser
                        </button>

                        {tool === 'pen' && (
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                style={{ width: '28px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                            />
                        )}

                        <button onClick={clearCanvas} style={{ ...wbBtnStyle, background: '#334155' }}>
                            <Trash2 size={15} /> Clear
                        </button>
                        <button onClick={savePNG} style={{ ...wbBtnStyle, background: '#059669' }}>
                            <Download size={15} /> Save PNG
                        </button>

                        {isHost && (
                            <button
                                onClick={toggleShareWhiteboardStream}
                                style={{ ...wbBtnStyle, background: isSharingBoard ? '#ef4444' : '#0284c7' }}
                            >
                                {isSharingBoard ? <StopCircle size={15} /> : <MonitorUp size={15} />}
                                {isSharingBoard ? 'Stop Sharing' : 'Share Board'}
                            </button>
                        )}

                        {isHost && (
                            <button onClick={() => setIsLocked(!isLocked)} style={{ ...wbBtnStyle, background: isLocked ? '#e11d48' : '#10b981' }}>
                                {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
                                {isLocked ? 'Locked' : 'Unlocked'}
                            </button>
                        )}
                    </div>

                    <button onClick={onClose} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Canvas Body */}
                <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%', background: '#fff' }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={stopDraw}
                        onMouseLeave={stopDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={stopDraw}
                        style={{ display: 'block', width: '100%', height: '100%', cursor: tool === 'text' ? 'text' : 'crosshair' }}
                    />

                    {textPos && (
                        <input
                            ref={textInputRef}
                            type="text"
                            value={textValue}
                            placeholder="Type note and hit Enter"
                            onChange={(e) => setTextValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCommitText(); }}
                            onBlur={handleCommitText}
                            style={{
                                position: 'absolute',
                                left: `${textPos.x}px`,
                                top: `${textPos.y}px`,
                                padding: '4px 8px',
                                background: 'rgba(255,255,255,0.95)',
                                border: '1px solid #0284c7',
                                borderRadius: '4px',
                                color: color,
                                fontSize: '16px',
                                outline: 'none',
                                zIndex: 10,
                                boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

const wbOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' };
const wbModalStyle = { width: '96vw', height: '90vh', background: '#ffffff', borderRadius: '12px', border: '2px solid #38bdf8', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.7)' };
const wbToolbarStyle = { background: '#0f172a', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' };
const wbBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', border: 'none', color: '#f8fafc', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' };