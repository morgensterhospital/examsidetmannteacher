import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import * as api from '../services/api';
import type { Class, Enrollment, UserProfile } from '../types';
import Spinner from '../components/Spinner';
import LiveSessionModal from '../components/LiveSessionModal';
import { db } from '../services/firebase';

const TeacherDashboard: React.FC<{ profile: UserProfile }> = ({ profile }) => {
    const [classes, setClasses] = useState<Class[]>([]);
    const [requests, setRequests] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newClass, setNewClass] = useState({ className: '', subject: '', level: 'olevel' as const });
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeClassId, setActiveClassId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const teacherClasses = await api.getTeacherClasses(profile.uid);
            setClasses(teacherClasses);
            if (teacherClasses.length > 0) {
                const classIds = teacherClasses.map(c => c.id);
                const pendingRequests = await api.getPendingRequestsForTeacher(classIds);
                 // Enrich requests with class names
                const enrichedRequests = pendingRequests.map(req => {
                    const classInfo = teacherClasses.find(c => c.id === req.classId);
                    return { ...req, className: classInfo?.className || 'Unknown Class' };
                });
                setRequests(enrichedRequests);
            }
        } catch (err) {
            setError('Failed to load dashboard data. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [profile.uid]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await api.createClass(profile, newClass);
            setNewClass({ className: '', subject: '', level: 'olevel' });
            fetchData(); // Refresh data
        } catch (err) {
            setError('Failed to create class.');
        }
    };
    
    const handleApprove = async (enrollmentId: string) => {
        try {
            await api.approveEnrollment(enrollmentId);
            fetchData(); // Refresh
        } catch (err) {
            setError('Failed to approve request.');
        }
    };

    const handleStartSession = async (classId: string) => {
        try {
            await api.startSession(classId);
            setActiveClassId(classId);
            setIsModalOpen(true);
            fetchData();
        } catch (err) {
             setError('Failed to start session.');
        }
    };
    
    const handleCloseModal = () => {
        if (activeClassId) {
            api.endSession(activeClassId);
        }
        setIsModalOpen(false);
        setActiveClassId(null);
        fetchData();
    };


    if (loading) return <div className="mt-8"><Spinner /></div>;

    return (
        <div className="space-y-12">
            {isModalOpen && activeClassId && (
                <LiveSessionModal classId={activeClassId} userProfile={profile} onClose={handleCloseModal} />
            )}

            {error && <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</p>}

            {/* Create Class */}
            <section className="glass-card p-6 rounded-xl">
                <h2 className="text-2xl font-bold text-white mb-4 neon-text-cyan">Create a New Class</h2>
                <form onSubmit={handleCreateClass} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[#cbb6e4] mb-1">Class Name</label>
                        <input type="text" value={newClass.className} onChange={e => setNewClass({...newClass, className: e.target.value})} required className="w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-[#cbb6e4] mb-1">Subject</label>
                        <input type="text" value={newClass.subject} onChange={e => setNewClass({...newClass, subject: e.target.value})} required className="w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#cbb6e4] mb-1">Level</label>
                        <select value={newClass.level} onChange={e => setNewClass({...newClass, level: e.target.value as any})} className="w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md">
                            <option value="olevel">O-Level</option>
                            <option value="alevel">A-Level</option>
                            <option value="polytechnic">Polytechnic</option>
                        </select>
                    </div>
                    <button type="submit" className="md:col-start-4 bg-[#00ddeb] text-black px-4 py-2 rounded-md hover:bg-opacity-80 transition-transform transform hover:scale-105">Create Class</button>
                </form>
            </section>

             {/* Your Classes */}
            <section>
                <h2 className="text-2xl font-bold text-white mb-4 neon-text-cyan">Your Classes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {classes.length > 0 ? classes.map(c => (
                        <div key={c.id} className="glass-card p-6 rounded-xl flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white">{c.className}</h3>
                                <p className="text-gray-400">{c.subject} - {c.level.charAt(0).toUpperCase() + c.level.slice(1)}</p>
                                <span className={`inline-block px-3 py-1 text-sm rounded-full mt-2 ${c.isLive ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                                    {c.isLive ? 'Live' : 'Offline'}
                                </span>
                            </div>
                            <div className="flex gap-4 mt-4">
                                {!c.isLive && (
                                     <button onClick={() => handleStartSession(c.id)} className="w-full px-4 py-2 rounded-md transition bg-green-600 hover:bg-green-700 text-white">
                                        Start Live Session
                                    </button>
                                )}
                            </div>
                        </div>
                    )) : <p className="text-gray-400">You haven't created any classes yet.</p>}
                </div>
            </section>

             {/* Pending Requests */}
            <section>
                <h2 className="text-2xl font-bold text-white mb-4 neon-text-cyan">Pending Enrollment Requests</h2>
                <div className="glass-card p-4 rounded-xl">
                    {requests.length > 0 ? (
                        <ul className="divide-y divide-gray-700">
                           {requests.map(req => (
                               <li key={req.id} className="flex justify-between items-center p-3">
                                   <p className="text-white">{req.studentName} <span className="text-gray-400">wants to join</span> {req.className}</p>
                                   <button onClick={() => handleApprove(req.id)} className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition text-sm">Approve</button>
                               </li>
                           ))}
                        </ul>
                    ) : <p className="text-gray-400 p-3">No pending requests.</p>}
                </div>
            </section>
        </div>
    );
};

const StudentDashboard: React.FC<{ profile: UserProfile }> = ({ profile }) => {
    const [liveClasses, setLiveClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeClassId, setActiveClassId] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        const q = db.collection('classes').where('isLive', '==', true);
        const unsubscribe = q.onSnapshot(
            (querySnapshot) => {
                const live = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Class[];
                setLiveClasses(live);
                setLoading(false);
            },
            (err) => {
                console.error(err);
                setError('Failed to listen for live classes.');
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, []);
    
    const handleJoin = (classId: string) => {
        setActiveClassId(classId);
        setIsModalOpen(true);
    };

    const handleLeave = () => {
        setIsModalOpen(false);
        setActiveClassId(null);
    };
    
    if (loading) return <div className="mt-8"><Spinner /></div>;

    return (
        <div className="space-y-12">
            {isModalOpen && activeClassId && (
                <LiveSessionModal classId={activeClassId} userProfile={profile} onClose={handleLeave} />
            )}
             {error && <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</p>}
            
            <section>
                <h2 className="text-2xl font-bold text-white mb-4 neon-text-cyan">Live Classes Happening Now</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {liveClasses.length > 0 ? liveClasses.map(c => (
                        <div key={c.id} className="glass-card p-6 rounded-xl flex flex-col justify-between animate-pulse-border">
                            <div>
                                <h3 className="text-xl font-bold text-white">{c.className}</h3>
                                <p className="text-gray-400">{c.subject} by {c.teacherName}</p>
                                <span className='inline-block px-3 py-1 text-sm rounded-full mt-2 bg-green-500/20 text-green-300'>
                                    Live
                                </span>
                            </div>
                            <div className="mt-4">
                                <button onClick={() => handleJoin(c.id)} className="w-full text-center block bg-[#a435f0] text-white px-4 py-2 rounded-md hover:bg-[#5624d0] transition neon-glow">
                                    Join Live Session
                                </button>
                            </div>
                        </div>
                    )) : <p className="text-gray-400">No classes are live right now. Check back soon!</p>}
                </div>
            </section>
        </div>
    );
};

const DashboardPage: React.FC = () => {
    const { userProfile, loading: authLoading } = useAuth();

    if (authLoading) {
        return <div className="h-full flex items-center justify-center"><Spinner /></div>;
    }

    return (
        <div>
            <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-gray-400 mb-8">Welcome back, {userProfile?.name}!</p>

            {userProfile?.role === 'teacher' && <TeacherDashboard profile={userProfile} />}
            {userProfile?.role === 'student' && <StudentDashboard profile={userProfile} />}
        </div>
    );
};

export default DashboardPage;