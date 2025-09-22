import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/firebase';
import type { UserProfile, Class } from '../types';
import Spinner from './Spinner';
import { useToast } from '../App';

const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

type ConnectionState = 'connecting' | 'connected' | 'failed' | 'disconnected' | 'closed';

interface LiveSessionModalProps {
    classId: string;
    userProfile: UserProfile;
    onClose: () => void;
}

const LiveSessionModal: React.FC<LiveSessionModalProps> = ({ classId, userProfile, onClose }) => {
    const [classInfo, setClassInfo] = useState<Class | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('connecting');
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const toast = useToast();

    const mainRemoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

    useEffect(() => {
        if (userProfile.role === 'student' && classInfo?.teacherId && mainRemoteVideoRef.current) {
            const teacherStream = remoteStreams[classInfo.teacherId];
            if (teacherStream && mainRemoteVideoRef.current.srcObject !== teacherStream) {
                mainRemoteVideoRef.current.srcObject = teacherStream;
            }
        }

        Object.entries(remoteStreams).forEach(([id, stream]) => {
            const videoElement = remoteVideoRefs.current[id];
            if (videoElement && videoElement.srcObject !== stream) {
                videoElement.srcObject = stream;
            }
        });
    }, [remoteStreams, classInfo, userProfile.role]);

    const sendSignal = useCallback(async (target: string, data: any) => {
        const signalPayload = {
            type: data.type,
            sender: userProfile.uid,
            target,
            data: data.sdp || data.candidate ? JSON.stringify(data) : undefined,
        };
        await db.collection('live_sessions').doc(classId).collection('signals').add(signalPayload);
    }, [classId, userProfile.uid]);

    const createPeerConnection = useCallback((peerId: string) => {
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
            if(userProfile.role === 'student' && peerId === classInfo?.teacherId) {
                setConnectionStatus('connected');
            }
        };

        pc.oniceconnectionstatechange = () => {
             if (userProfile.role === 'student' && peerId === classInfo?.teacherId) {
                const state = pc.iceConnectionState as ConnectionState;
                 if (['failed', 'disconnected', 'closed'].includes(state)) {
                     setConnectionStatus(state);
                     toast.error("Connection to the teacher was lost.");
                 }
            }
        }

        return pc;
    }, [localStream, sendSignal, userProfile.role, classInfo?.teacherId, toast]);

    useEffect(() => {
        const setupMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            } catch (err) {
                console.error("Error accessing media devices.", err);
                toast.error("Camera and microphone access is required. Please check your browser permissions.");
                onClose();
            }
        };
        setupMedia();
        
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

        return () => {
            unsubscribeSignals();
            localStream?.getTracks().forEach(track => track.stop());
            Object.values(peerConnections.current).forEach(pc => pc.close());
        };
    }, [classId, userProfile.uid, createPeerConnection, sendSignal, onClose, toast]);

    useEffect(() => {
        if (!localStream) return;

        db.collection('classes').doc(classId).get().then(doc => {
            if (doc.exists) setClassInfo({ id: doc.id, ...doc.data() } as Class);
        });

        if (userProfile.role === 'teacher') {
            const unsubscribeStudents = db.collection('live_sessions').doc(classId).collection('students')
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(async change => {
                        const studentId = change.doc.id;
                        if (change.type === 'added') {
                            toast.info(`${change.doc.data().name} has joined.`);
                            const pc = createPeerConnection(studentId);
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            sendSignal(studentId, pc.localDescription);
                        }
                        if (change.type === 'removed') {
                            toast.info(`A student has left.`);
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
            const studentRef = db.collection('live_sessions').doc(classId).collection('students').doc(userProfile.uid);
            studentRef.set({ name: userProfile.name, joinedAt: new Date() });

            // Student listens for teacher ending the session
            const unsubscribeClass = db.collection('classes').doc(classId).onSnapshot(doc => {
                 if (doc.exists && doc.data()?.isLive === false) {
                    toast.info("The teacher has ended the session.");
                    setTimeout(onClose, 2000);
                }
            });

            return () => { 
                studentRef.delete(); 
                unsubscribeClass();
            };
        }
    }, [localStream, classId, userProfile, createPeerConnection, sendSignal, toast, onClose]);

    const renderMainVideo = () => {
        if (userProfile.role === 'teacher') {
            return <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />;
        }
        
        // Student view
        const teacherStream = remoteStreams[classInfo?.teacherId || ''];
        if (teacherStream && connectionStatus === 'connected') {
            return <video ref={mainRemoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />;
        }
        
        const statusMessages: Record<ConnectionState, string> = {
            connecting: 'Connecting to teacher...',
            connected: 'Connected!',
            failed: 'Connection failed. Please try re-joining the session.',
            disconnected: 'Connection lost. Attempting to reconnect...',
            closed: 'The connection has been closed.'
        }

        return (
             <div className="w-full h-full bg-black flex items-center justify-center text-white">
                <Spinner />
                <p className="ml-4">{statusMessages[connectionStatus] || 'Connecting...'}</p>
            </div>
        );
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
                                <video ref={el => { remoteVideoRefs.current[id] = el; }} autoPlay playsInline className="w-full h-24 object-cover rounded-md" />
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