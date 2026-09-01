import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Pencil, Eraser, Download, Lock, Unlock, X } from 'lucide-react';

export default function Whiteboard({ isHost, onClose }) {
    const canvasRef = useRef(null);
    const fabricCanvas = useRef(null);
    const [isLocked, setIsLocked] = useState(false);
    const [brushColor, setBrushColor] = useState('#38bdf8');
    const [brushSize, setBrushSize] = useState(3);

    useEffect(() => {
        if (!canvasRef.current) return;

        try {
            const CanvasConstructor = fabric.Canvas || fabric.fabric?.Canvas;
            if (CanvasConstructor) {
                fabricCanvas.current = new CanvasConstructor(canvasRef.current, {
                    isDrawingMode: true,
                    width: 750,
                    height: 450,
                    backgroundColor: '#1e293b',
                });

                if (fabricCanvas.current.freeDrawingBrush) {
                    fabricCanvas.current.freeDrawingBrush.color = brushColor;
                    fabricCanvas.current.freeDrawingBrush.width = brushSize;
                }
            }
        } catch (err) {
            console.error("Whiteboard init error:", err);
        }

        return () => {
            if (fabricCanvas.current && fabricCanvas.current.dispose) {
                fabricCanvas.current.dispose();
            }
        };
    }, []);

    useEffect(() => {
        if (fabricCanvas.current) {
            fabricCanvas.current.isDrawingMode = !isLocked;
        }
    }, [isLocked]);

    const setTool = (tool) => {
        if (!fabricCanvas.current) return;
        if (tool === 'pencil') {
            fabricCanvas.current.isDrawingMode = true;
            if (fabricCanvas.current.freeDrawingBrush) {
                fabricCanvas.current.freeDrawingBrush.color = brushColor;
                fabricCanvas.current.freeDrawingBrush.width = brushSize;
            }
        } else if (tool === 'eraser') {
            fabricCanvas.current.isDrawingMode = true;
            if (fabricCanvas.current.freeDrawingBrush) {
                fabricCanvas.current.freeDrawingBrush.color = '#1e293b';
                fabricCanvas.current.freeDrawingBrush.width = 20;
            }
        }
    };

    const exportCanvas = () => {
        if (!fabricCanvas.current) return;
        const dataURL = fabricCanvas.current.toDataURL({ format: 'png' });
        const link = document.createElement('a');
        link.download = `whiteboard-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    };

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#0f172a',
            padding: '16px',
            borderRadius: '16px',
            border: '2px solid #38bdf8',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
            zIndex: 9999,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => setTool('pencil')} style={btnStyle}><Pencil size={15} /> Pencil</button>
                    <button onClick={() => setTool('eraser')} style={btnStyle}><Eraser size={15} /> Eraser</button>
                    <input
                        type="color"
                        value={brushColor}
                        onChange={(e) => {
                            setBrushColor(e.target.value);
                            if (fabricCanvas.current && fabricCanvas.current.freeDrawingBrush) {
                                fabricCanvas.current.freeDrawingBrush.color = e.target.value;
                            }
                        }}
                        style={{ width: '32px', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                    />
                    <button onClick={exportCanvas} style={btnStyle}><Download size={15} /> Save PNG</button>
                    {isHost && (
                        <button
                            onClick={() => setIsLocked(!isLocked)}
                            style={{ ...btnStyle, background: isLocked ? '#ef4444' : '#10b981' }}
                        >
                            {isLocked ? <Lock size={15} /> : <Unlock size={15} />}
                            {isLocked ? 'Locked' : 'Unlocked'}
                        </button>
                    )}
                </div>
                <button onClick={onClose} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>
                    <X size={16} />
                </button>
            </div>
            <canvas ref={canvasRef} width="750" height="450" style={{ borderRadius: '8px', border: '1px solid #334155' }} />
        </div>
    );
}

const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#1e293b',
    color: '#fff',
    border: '1px solid #334155',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem'
};