import React, { useState, useEffect, useRef } from 'react';
// Fix: Use useNavigate for react-router-dom v6 compatibility.
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../App';
import { toggleWhiteboard, endSession, sendDrawingData } from '../services/api';
import type { Class, ChatMessage } from '../types';
import { createStudyBuddyChat, sendMessageToStudyBuddy } from '../services/geminiService';
import Spinner from '../components/Spinner';

// Whiteboard Component
const Whiteboard: React.FC<{ classId: string; isTeacher: boolean }> = ({ classId, isTeacher }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const context = canvas.getContext('2d');
            if(context){
                context.lineCap = 'round';
                context.strokeStyle = '#00ddeb';
                context.lineWidth = 5;
                contextRef.current = context;
            }
        }
    }, []);

    const handleSendDrawingData = async (x0: number, y0: number, x1: number, y1: number) => {
        if (!isTeacher) return;
        await sendDrawingData(classId, { x0, y0, x1, y1 });
    };

    useEffect(() => {
        const drawingsCollection = collection(db, `live_sessions/${classId}/whiteboard_drawings`);
        const q = query(drawingsCollection);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const canvas = canvasRef.current;
                    const context = contextRef.current;
                    if(canvas && context){
                        const { x0, y0, x1, y1 } = data;
                        context.beginPath();
                        context.moveTo(x0 * canvas.width, y0 * canvas.height);
                        context.lineTo(x1 * canvas.width, y1 * canvas.height);
                        context.stroke();
                        context.closePath();
                    }
                }
            });
        });
        return () => unsubscribe();
    }, [classId]);
    
    const startDrawing = ({ nativeEvent }: React.MouseEvent) => {
        if (!isTeacher) return;
        const { offsetX, offsetY } = nativeEvent;
        contextRef.current?.beginPath();
        contextRef.current?.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const finishDrawing = () => {
        if (!isTeacher) return;
        contextRef.current?.closePath();
        setIsDrawing(false);
    };

    const draw = ({ nativeEvent }: React.MouseEvent) => {
        if (!isDrawing || !isTeacher) return;
        const { offsetX, offsetY, movementX, movementY } = nativeEvent;
        const canvas = canvasRef.current;
        if (canvas && contextRef.current) {
            contextRef.current.lineTo(offsetX, offsetY);
            contextRef.current.stroke();
            handleSendDrawingData(
                (offsetX - movementX) / canvas.width,
                (offsetY - movementY) / canvas.height,
                offsetX / canvas.width,
                offsetY / canvas.height
            );
        }
    };

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseUp={finishDrawing}
            onMouseMove={draw}
            onMouseLeave={finishDrawing}
            className={`w-full h-full rounded-lg ${isTeacher ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
            style={{ touchAction: 'none' }}
        />
    );
};

// StudyBuddy Component
const StudyBuddy: React.FC<{ classInfo: Class }> = ({ classInfo }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      createStudyBuddyChat(classInfo.subject, classInfo.level);
      setMessages([{ role: 'model', text: `Hi! I'm your AI study buddy. Ask me anything about ${classInfo.subject}.` }]);
    }, [classInfo]);
    
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        
        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const modelMessage: ChatMessage = { role: 'model', text: '' };
        setMessages(prev => [...prev, modelMessage]);

        await sendMessageToStudyBuddy(input, (chunk) => {
            setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'model') {
                    lastMessage.text += chunk;
                    return [...prev.slice(0, -1), lastMessage];
                }
                return prev;
            });
        });
        
        setIsLoading(false);
    };

    return (
        <div className="glass-card rounded-lg flex flex-col h-full w-full max-w-sm">
            <h3 className="text-xl font-bold p-4 border-b border-[#3e4143] text-[#00ddeb]">AI Study Buddy</h3>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-[#5624d0] text-white' : 'bg-[#1c1d1f] text-gray-300'}`}>
                           {msg.text}
                           {isLoading && msg.role === 'model' && index === messages.length - 1 && <span className="inline-block w-2 h-2 ml-2 bg-white rounded-full animate-ping"></span>}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-[#3e4143] flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question..."
                    disabled={isLoading}
                    className="flex-1 p-2 bg-[#101113] border border-[#3e4143] rounded-md focus:ring-2 focus:ring-[#a435f0] focus:border-transparent"
                />
                <button type="submit" disabled={isLoading} className="bg-[#a435f0] text-white px-4 py-2 rounded-md hover:bg-[#5624d0] disabled:opacity-50">Send</button>
            </form>
        </div>
    );
};


// Main LiveSessionPage Component
const LiveSessionPage: React.FC = () => {
    const { classId } = useParams<{ classId: string }>();
    const { userProfile } = useAuth();
    // Fix: Use useNavigate for react-router-dom v6.
    const navigate = useNavigate();
    const [classInfo, setClassInfo] = useState<Class | null>(null);
    const [whiteboardActive, setWhiteboardActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null); // Simplified to one remote video

    const isTeacher = userProfile?.role === 'teacher';

    useEffect(() => {
        if (!classId) return;
        const classDocRef = doc(db, 'classes', classId);
        const unsubscribe = onSnapshot(classDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Omit<Class, 'id'>;
                setClassInfo({ id: docSnap.id, ...data });
                setWhiteboardActive(data.whiteboardActive || false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [classId]);

    useEffect(() => {
      const startMedia = async () => {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              if (localVideoRef.current) {
                  localVideoRef.current.srcObject = stream;
              }
          } catch (err) {
              console.error("Error accessing media devices.", err);
              alert("Could not access camera and microphone. Please check permissions.");
          }
      };
      startMedia();
    }, []);

    const handleToggleWhiteboard = async () => {
        if (!classId || !isTeacher) return;
        await toggleWhiteboard(classId, !whiteboardActive);
    };
    
    const handleEndSession = async () => {
        if (!classId || !isTeacher) return;
        await endSession(classId);
        // Fix: Use navigate for navigation.
        navigate('/dashboard');
    };

    if (loading) {
        return <div className="h-screen flex items-center justify-center"><Spinner /></div>;
    }
    
    if (!classInfo) {
        return <div className="text-center text-red-500">Class not found.</div>
    }

    return (
        <div className="flex flex-col h-[85vh]">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">{classInfo?.className}</h1>
                <div>
                  {isTeacher && (
                      <>
                        <button onClick={handleToggleWhiteboard} className="bg-blue-500 text-white px-4 py-2 rounded-md mr-4 hover:bg-blue-600 transition">
                            {whiteboardActive ? 'Show Video' : 'Show Whiteboard'}
                        </button>
                        <button onClick={handleEndSession} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition">
                            End Session
                        </button>
                      </>
                  )}
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
                <div className="lg:col-span-3 glass-card rounded-lg p-2 flex justify-center items-center">
                    {whiteboardActive ? (
                        <Whiteboard classId={classId!} isTeacher={isTeacher} />
                    ) : (
                         <video ref={isTeacher ? localVideoRef : remoteVideoRef} autoPlay playsInline muted={isTeacher} className="w-full h-full object-contain rounded-lg" />
                    )}
                </div>
                <div className="flex flex-col gap-4">
                    <div className="glass-card rounded-lg p-2 aspect-video">
                       <video ref={isTeacher ? remoteVideoRef : localVideoRef} autoPlay playsInline muted={!isTeacher} className="w-full h-full object-cover rounded-lg" />
                       <p className="text-sm text-center -mt-6 text-white bg-black/50 rounded-b-lg">{isTeacher ? "Student View" : userProfile?.name}</p>
                    </div>
                   {!isTeacher && classInfo && <StudyBuddy classInfo={classInfo}/>}
                </div>
            </div>
        </div>
    );
};

export default LiveSessionPage;
