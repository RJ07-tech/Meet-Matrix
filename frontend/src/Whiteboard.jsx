import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Pencil, Square, Circle, Eraser, Download, Lock, Unlock } from 'lucide-react';

export default function Whiteboard({ isHost, onSyncDraw, initialData }) {
    const canvasRef = useRef(null);
    const fabricCanvas = useRef(null);
    const [isLocked, setIsLocked] = useState(!isHost);
    const [brushColor, setBrushColor] = useState('#38bdf8');
    const [brushSize, setBrushSize] = useState(3);

    useEffect(() => {
        fabricCanvas.current = new fabric.Canvas(canvasRef.current, {
            isDrawingMode: !isLocked,
            width: 800,
            height: 500,
            backgroundColor: '#1e293b',
        });

        fabricCanvas.current.freeDrawingBrush.color = brushColor;
        fabricCanvas.current.freeDrawingBrush.width = brushSize;

        fabricCanvas.current.on('path:created', (e) => {
            if (onSyncDraw) {
                onSyncDraw(JSON.stringify(fabricCanvas.current.toJSON()));
            }
        });

        return () => fabricCanvas.current.dispose();
    }, []);

    useEffect(() => {
        if (fabricCanvas.current) {
            fabricCanvas.current.isDrawingMode = !isLocked;
        }
    }, [isLocked]);

    const setTool = (tool) => {
        if (tool === 'pencil') {
            fabricCanvas.current.isDrawingMode = true;
            fabricCanvas.current.freeDrawingBrush.color = brushColor;
        } else if (tool === 'eraser') {
            fabricCanvas.current.isDrawingMode = true;
            fabricCanvas.current.freeDrawingBrush.color = '#1e293b';
            fabricCanvas.current.freeDrawingBrush.width = 15;
        }
    };

    const exportCanvas = () => {
        const dataURL = fabricCanvas.current.toDataURL({ format: 'png' });
        const link = document.createElement('a');
        link.download = `whiteboard-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    };

    return (
        <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setTool('pencil')} style={btnStyle}><Pencil size={16} /> Draw</button>
                <button onClick={() => setTool('eraser')} style={btnStyle}><Eraser size={16} /> Eraser</button>
                <input type="color" value={brushColor} onChange={(e) => {
                    setBrushColor(e.target.value);
                    fabricCanvas.current.freeDrawingBrush.color = e.target.value;
                }} />
                <button onClick={exportCanvas} style={btnStyle}><Download size={16} /> Export PNG</button>

                {isHost && (
                    <button
                        onClick={() => setIsLocked(!isLocked)}
                        style={{ ...btnStyle, background: isLocked ? '#ef4444' : '#10b981' }}
                    >
                        {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                        {isLocked ? 'Locked (Presentation Mode)' : 'Unlocked (Collaborative Mode)'}
                    </button>
                )}
            </div>
            <canvas ref={canvasRef} style={{ borderRadius: '8px' }} />
        </div>
    );
}

const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#334155',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem'
};