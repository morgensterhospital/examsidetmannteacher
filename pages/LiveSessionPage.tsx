import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { db } from '../services/firebase'; // For real-time listeners
import * as api from '../services/api';
import * as gemini from '../services/geminiService';
import type { Class, ChatMessage } from '../types';
import Spinner from '../components/Spinner';


const LiveSessionPage: React.FC = () => {
    const { classId } = useParams<{ classId: string }>();
    const { userProfile } = useAuth();
    const [classInfo, setClassInfo] = useState<Class | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Whiteboard state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number, y: number } | null>(null);

    // Study Buddy Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [studyBuddyInput, setStudyBuddyInput] = useState('');
    const [isBuddyTyping, setIsBuddyTyping] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const drawLine = useCallback((x0: number, y0: number, x1: number, y1: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.closePath();
    }, []);

    useEffect(() => {
        if (!classId) {
            setError("No Class ID provided.");
            setLoading(false);
            return;
        }

        // Fetch class info and set up real-time listener
        const classRef = db.collection('classes').doc(classId);
        const unsubscribeClass = classRef.onSnapshot(
            (doc) => {
                if (doc.exists) {
                    const data = { id: doc.id, ...doc.data() } as Class;
                    if (!classInfo) { // On first load, create chat
                        gemini.createStudyBuddyChat(data.subject, data.level);
                    }
                    setClassInfo(data);
                    setLoading(false);
                } else {
                    setError("Class not found.");
                    setLoading(false);
                }
            },
            (err) => {
                console.error(err);
                setError("Failed to load class information.");
                setLoading(false);
            }
        );

        // Set up whiteboard drawing listener
        const drawingsCollection = db.collection(`live_sessions/${classId}/whiteboard_drawings`);
        const unsubscribeDrawings = drawingsCollection.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    drawLine(data.x0, data.y0, data.x1, data.y1);
                }
            });
        });

        return () => {
            unsubscribeClass();
            unsubscribeDrawings();
        };
    }, [classId, drawLine, classInfo]);

    // Canvas setup
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Resize canvas to fit container
        const resizeCanvas = () => {
            const container = canvas.parentElement;
            if (container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [classInfo]);
    
    // Auto-scroll chat
    useEffect(() => {
        if(chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    const getCanvasPos = (e: React.MouseEvent): { x: number, y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!classInfo?.whiteboardActive) return;
        isDrawing.current = true;
        const pos = getCanvasPos(e);
        lastPos.current = pos;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing.current || !classInfo?.whiteboardActive) return;
        const currentPos = getCanvasPos(e);
        if (lastPos.current && currentPos) {
            drawLine(lastPos.current.x, lastPos.current.y, currentPos.x, currentPos.y);
            api.sendDrawingData(classId!, { x0: lastPos.current.x, y0: lastPos.current.y, x1: currentPos.x, y1: currentPos.y });
            lastPos.current = currentPos;
        }
    };

    const handleMouseUp = () => {
        isDrawing.current = false;
        lastPos.current = null;
    };

    const handleToggleWhiteboard = async () => {
        if (!classId) return;
        await api.toggleWhiteboard(classId, !classInfo?.whiteboardActive);
    };

    const handleSendChatMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studyBuddyInput.trim() || isBuddyTyping) return;

        const userMessage: ChatMessage = { role: 'user', text: studyBuddyInput };
        setChatMessages(prev => [...prev, userMessage]);
        setStudyBuddyInput('');
        setIsBuddyTyping(true);

        let modelMessageAccumulator = '';
        let hasAddedModelMessage = false;

        await gemini.sendMessageToStudyBuddy(userMessage.text, (chunk) => {
            modelMessageAccumulator += chunk;
            if (!hasAddedModelMessage) {
                 setChatMessages(prev => [...prev, { role: 'model', text: modelMessageAccumulator }]);
                 hasAddedModelMessage = true;
            } else {
                 setChatMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = modelMessageAccumulator;
                    return newMessages;
                });
            }
        });
        setIsBuddyTyping(false);
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Spinner /></div>;
    if (error) return <div className="h-screen flex items-center justify-center text-red-400">{error}</div>;

    return (
        <div className="h-[calc(100vh-150px)] flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">{classInfo?.className}</h1>
                    <p className="text-gray-400">{classInfo?.subject}</p>
                </div>
                {userProfile?.role === 'teacher' && (
                    <button onClick={handleToggleWhiteboard} className="bg-[#a435f0] text-white px-4 py-2 rounded-md hover:bg-[#5624d0] transition">
                        {classInfo?.whiteboardActive ? 'Disable' : 'Enable'} Whiteboard
                    </button>
                )}
            </div>

            <div className="flex-grow grid grid-cols-3 gap-6">
                {/* Whiteboard */}
                <div className="col-span-2 glass-card rounded-xl relative p-2">
                     {!classInfo?.whiteboardActive && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-xl z-10">
                            <p className="text-2xl text-white">Whiteboard is disabled.</p>
                        </div>
                    )}
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp} // Stop drawing if mouse leaves canvas
                        className="rounded-lg cursor-crosshair"
                    />
                </div>

                {/* Study Buddy Chat */}
                <div className="col-span-1 glass-card rounded-xl flex flex-col p-4">
                    <h2 className="text-xl font-bold text-white mb-2 neon-text-cyan flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        AI Study Buddy
                    </h2>
                    <div ref={chatContainerRef} className="flex-grow overflow-y-auto pr-2 space-y-4">
                        {chatMessages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user' ? 'bg-[#5624d0]' : 'bg-[#3e4143]'} text-white`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isBuddyTyping && !chatMessages.some(m => m.role === 'model' && m.text.length > 0) && (
                             <div className="flex justify-start">
                                <div className="p-3 rounded-xl bg-[#3e4143] text-white">
                                    <span className="animate-pulse">...</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <form onSubmit={handleSendChatMessage} className="mt-4 flex gap-2">
                        <input
                            type="text"
                            value={studyBuddyInput}
                            onChange={(e) => setStudyBuddyInput(e.target.value)}
                            placeholder="Ask a question..."
                            className="flex-grow p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md text-white"
                            disabled={isBuddyTyping}
                        />
                        <button type="submit" disabled={isBuddyTyping} className="bg-[#00ddeb] text-black px-4 py-2 rounded-md hover:bg-opacity-80 disabled:opacity-50">Send</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LiveSessionPage;
