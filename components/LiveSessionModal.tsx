import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import type { UserProfile, Class, Signal } from '../types';
import Spinner from './Spinner';

// WebRTC configuration
const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

interface LiveSessionModalProps {
    classId: string;
    userProfile: UserProfile;
    onClose: () => void;
}

const LiveSessionModal: React.FC<LiveSessionModalProps> = ({ classId, userProfile, onClose }) => {
    const [classInfo, setClassInfo] = useState<Class | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // FIX: Add refs to manage remote video elements imperatively to fix srcObject error.
    const mainRemoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

    // FIX: Effect to assign remote MediaStreams to video elements' srcObject property.
    useEffect(() => {
        // This handles setting the srcObject for the main remote video (teacher's stream for student)
        if (userProfile.role === 'student' && classInfo?.teacherId && mainRemoteVideoRef.current) {
            const teacherStream = remoteStreams[classInfo.teacherId];
            if (teacherStream && mainRemoteVideoRef.current.srcObject !== teacherStream) {
                mainRemoteVideoRef.current.srcObject = teacherStream;
            }
        }

        // This handles setting srcObject for the gallery of remote videos (students' streams for teacher)
        Object.entries(remoteStreams).forEach(([id, stream]) => {
            const videoElement = remoteVideoRefs.current[id];
            if (videoElement && videoElement.srcObject !== stream) {
                videoElement.srcObject = stream;
            }
        });
    }, [remoteStreams, classInfo, userProfile.role]);

    // Helper to send signals via Firestore
    const sendSignal = async (target: string, data: any) => {
        const signalPayload = {
            type: data.type,
            sender: userProfile.uid,
            target,
            data: data.sdp || data.candidate ? JSON.stringify(data) : undefined,
        };
        await db.collection('live_sessions').doc(classId).collection('signals').add(signalPayload);
    };

    // Creates a peer connection and sets up its listeners
    const createPeerConnection = (peerId: string) => {
        if (peerConnections.current[peerId]) return peerConnections.current[peerId];

        const pc = new RTCPeerConnection(servers);
        peerConnections.current[peerId] = pc;

        localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));

        pc.onicecandidate = event => {
            if (event.candidate) {
                sendSignal(peerId, { type: 'candidate', candidate: event.candidate });
            }
        };

        pc.ontrack = event => {
            setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] }));
        };

        return pc;
    };

    // Main setup effect for media and signal listening
    useEffect(() => {
        // Get user media
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                setLocalStream(stream);
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            })
            .catch(err => console.error("Error accessing media devices.", err));

        // Firestore signal listener
        const unsubscribeSignals = db.collection('live_sessions').doc(classId).collection('signals')
            .where('target', '==', userProfile.uid)
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(async change => {
                    if (change.type === 'added') {
                        const signal = change.doc.data();
                        const peerId = signal.sender;
                        const data = signal.data ? JSON.parse(signal.data) : null;

                        const pc = createPeerConnection(peerId);

                        if (data.type === 'offer') {
                            await pc.setRemoteDescription(new RTCSessionDescription(data));
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            sendSignal(peerId, pc.localDescription);
                        } else if (data.type === 'answer') {
                            await pc.setRemoteDescription(new RTCSessionDescription(data));
                        } else if (data.type === 'candidate') {
                            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                        }
                    }
                });
            });

        // Cleanup function
        return () => {
            unsubscribeSignals();
            localStream?.getTracks().forEach(track => track.stop());
            Object.values(peerConnections.current).forEach(pc => pc.close());
        };
    }, [classId, userProfile.uid]);

    // Role-specific logic
    useEffect(() => {
        if (!localStream) return;

        // Fetch class info once
        db.collection('classes').doc(classId).get().then(doc => {
            if (doc.exists) setClassInfo({ id: doc.id, ...doc.data() } as Class);
        });

        if (userProfile.role === 'teacher') {
            // Teacher listens for students joining/leaving
            const unsubscribeStudents = db.collection('live_sessions').doc(classId).collection('students')
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(async change => {
                        const studentId = change.doc.id;
                        if (change.type === 'added') {
                            console.log(`Student ${studentId} joined. Creating offer.`);
                            const pc = createPeerConnection(studentId);
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            sendSignal(studentId, pc.localDescription);
                        }
                        if (change.type === 'removed') {
                            console.log(`Student ${studentId} left.`);
                            peerConnections.current[studentId]?.close();
                            delete peerConnections.current[studentId];
                            setRemoteStreams(prev => {
                                const newStreams = { ...prev };
                                delete newStreams[studentId];
                                return newStreams;
                            });
                        }
                    });
                });
            return () => unsubscribeStudents();
        } else {
            // Student announces their presence
            const studentRef = db.collection('live_sessions').doc(classId).collection('students').doc(userProfile.uid);
            studentRef.set({ name: userProfile.name, joinedAt: new Date() });
            return () => { studentRef.delete(); };
        }
    }, [localStream, classId, userProfile.role, userProfile.uid, userProfile.name]);

    const renderMainVideo = () => {
        if (userProfile.role === 'teacher') {
            return <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />;
        }
        // Student view
        const teacherStream = remoteStreams[classInfo?.teacherId || ''];
        if (teacherStream) {
            // FIX: Use ref instead of srcObject prop to avoid TypeScript error.
            return <video ref={mainRemoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />;
        }
        return <div className="w-full h-full bg-black flex items-center justify-center text-white"><Spinner /> <p className="ml-4">Connecting to teacher...</p></div>;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50">
            <div className="bg-[#101113] w-full max-w-6xl h-[90vh] rounded-lg shadow-2xl flex flex-col glass-card">
                <div className="flex-grow relative bg-black rounded-t-lg overflow-hidden">
                    {renderMainVideo()}
                    {userProfile.role === 'student' && localStream && (
                        <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-4 right-4 w-48 h-auto rounded-lg border-2 border-[#a435f0] z-10" />
                    )}
                </div>

                {userProfile.role === 'teacher' && (
                    <div className="bg-black/50 p-2 h-40 flex items-center space-x-4 overflow-x-auto">
                        <div className="flex-shrink-0 w-48 h-full bg-gray-800 rounded-md p-1">
                            <p className="text-white text-xs text-center font-bold">You (Teacher)</p>
                            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-24 object-cover rounded-md" />
                        </div>
                        {Object.entries(remoteStreams).map(([id, stream]) => (
                            <div key={id} className="flex-shrink-0 w-48 h-full bg-gray-800 rounded-md p-1">
                                <p className="text-white text-xs text-center">Student</p>
                                {/* FIX: Use callback ref instead of srcObject prop to avoid TypeScript error. */}
                                <video ref={el => remoteVideoRefs.current[id] = el} autoPlay playsInline className="w-full h-24 object-cover rounded-md" />
                            </div>
                        ))}
                    </div>
                )}

                <div className="p-4 flex justify-center">
                    <button onClick={onClose} className="bg-red-600 text-white font-bold py-3 px-8 rounded-full hover:bg-red-700 transition transform hover:scale-105">
                        Leave Session
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LiveSessionModal;
