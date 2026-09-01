import React, { useRef, useEffect, useState } from 'react';
import { Pencil, Eraser, Download, Trash2, X, Lock, Unlock } from 'lucide-react';

export default function Whiteboard({ isHost, onClose }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState('pencil'); // 'pencil' | 'eraser'
    const [color, setColor] = useState('#38bdf8');
    const [lineWidth, setLineWidth] = useState(3);
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Set initial canvas background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e) => {
        if (isLocked && !isHost) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing || (isLocked && !isHost)) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');

        ctx.strokeStyle = tool === 'eraser' ? '#0f172a' : color;
        ctx.lineWidth = tool === 'eraser' ? 22 : lineWidth;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.closePath();
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        if (isLocked && !isHost) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const downloadPNG = () => {
        const canvas = canvasRef.current;
        const link = document.createElement('a');
        link.download = `whiteboard-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#1e293b',
            padding: '16px',
            borderRadius: '16px',
            border: '2px solid #38bdf8',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)',
            zIndex: 9999,
            maxWidth: '95vw',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setTool('pencil')}
                        style={{ ...btnStyle, background: tool === 'pencil' ? '#0284c7' : '#334155' }}
                    >
                        <Pencil size={15} /> Pen
                    </button>
                    <button
                        onClick={() => setTool('eraser')}
                        style={{ ...btnStyle, background: tool === 'eraser' ? '#0284c7' : '#334155' }}
                    >
                        <Eraser size={15} /> Eraser
                    </button>

                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        style={{ width: '32px', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '4px', background: 'transparent' }}
                    />

                    <button onClick={clearCanvas} style={{ ...btnStyle, background: '#475569' }}>
                        <Trash2 size={15} /> Clear
                    </button>

                    <button onClick={downloadPNG} style={{ ...btnStyle, background: '#10b981' }}>
                        <Download size={15} /> Save PNG
                    </button>

                    {isHost && (
                        <button
                            onClick={() => setIsLocked(!isLocked)}
                            style={{ ...btnStyle, background: isLocked ? '#ef4444' : '#059669' }}
                        >
                            {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
                            {isLocked ? 'Locked' : 'Unlocked'}
                        </button>
                    )}
                </div>

                <button onClick={onClose} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>
                    <X size={18} />
                </button>
            </div>

            {/* Drawing Canvas */}
            <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #475569', background: '#0f172a' }}>
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={480}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ display: 'block', cursor: tool === 'eraser' ? 'cell' : 'crosshair', maxWidth: '100%', height: 'auto', touchAction: 'none' }}
                />
            </div>
        </div>
    );
}

const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#ffffff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '500'
};