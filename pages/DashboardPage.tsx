
import React, { useState, useEffect, useCallback } from 'react';
// Fix: Use useNavigate for react-router-dom v6 compatibility.
import { useNavigate } from 'react-router-dom';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../App';
import { 
    getTeacherClasses, 
    getPendingRequestsForTeacher, 
    approveEnrollment,
    startSession,
    getAllClasses,
    getStudentEnrollments,
    requestToJoinClass,
    createClass,
} from '../services/api';
import type { Class, Enrollment, UserProfile } from '../types';
import Spinner from '../components/Spinner';

const olevelSubjects = ["Mathematics", "English Language", "Integrated Science", "History", "Geography"];
const alevelSubjects = ["Mathematics", "Physics", "Chemistry", "Biology", "Literature in English"];
const polytechnicSubjects = ["Applied Mechanics", "Electrical Engineering", "Software Development", "Accounting"];

const getSubjectOptions = (level: 'olevel' | 'alevel' | 'polytechnic') => {
    switch(level) {
        case 'olevel': return olevelSubjects;
        case 'alevel': return alevelSubjects;
        case 'polytechnic': return polytechnicSubjects;
        default: return [];
    }
};

const CreateClassForm: React.FC<{ profile: UserProfile, onClassCreated: () => void }> = ({ profile, onClassCreated }) => {
    const [className, setClassName] = useState('');
    const [level, setLevel] = useState<'olevel' | 'alevel' | 'polytechnic'>('olevel');
    const [subject, setSubject] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!className || !subject) {
            setError("All fields are required.");
            return;
        }
        setLoading(true);
        setError('');
        try {
            await createClass(profile, { className, level, subject });
            setClassName('');
            setSubject('');
            setLevel('olevel');
            onClassCreated();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="p-4 bg-[#101113] rounded-md space-y-4 mt-4 border border-[#3e4143]">
             {error && <p className="text-red-400">{error}</p>}
            <div>
                <label className="block text-sm font-medium text-[#cbb6e4]">Class Name</label>
                <input type="text" value={className} onChange={(e) => setClassName(e.target.value)} required placeholder="e.g. A-Level Physics 2024" className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
            </div>
             <div>
                <label className="block text-sm font-medium text-[#cbb6e4]">Curriculum Level</label>
                <select value={level} onChange={(e) => { setLevel(e.target.value as any); setSubject(''); }} className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md">
                    <option value="olevel">O-Level</option>
                    <option value="alevel">A-Level</option>
                    <option value="polytechnic">Polytechnic</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-[#cbb6e4]">Subject</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} required className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md">
                     <option value="" disabled>Select a subject</option>
                     {getSubjectOptions(level).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#a435f0] text-white font-bold py-2 px-4 rounded-md hover:bg-[#5624d0] disabled:opacity-50">
                {loading ? 'Creating...' : 'Create Class'}
            </button>
        </form>
    );
};


// TeacherDashboard Component
const TeacherDashboard: React.FC<{ profile: UserProfile }> = ({ profile }) => {
    const [myClasses, setMyClasses] = useState<Class[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    // Fix: Use useNavigate for react-router-dom v6.
    const navigate = useNavigate();

    const fetchTeacherData = useCallback(async () => {
        // Keep loading false on refetch to avoid flicker
        // setLoading(true); 
        try {
            const classesData = await getTeacherClasses(profile.uid);
            setMyClasses(classesData);

            if (classesData.length > 0) {
                const classIds = classesData.map(c => c.id);
                const requestsData = await getPendingRequestsForTeacher(classIds);
                setPendingRequests(requestsData);
            } else {
                setPendingRequests([]);
            }
        } catch (error) {
            console.error("Error fetching teacher data:", error);
        }
        setLoading(false);
    }, [profile.uid]);

    useEffect(() => {
        setLoading(true);
        fetchTeacherData();
    }, [fetchTeacherData]);

    const handleApprove = async (enrollmentId: string) => {
        await approveEnrollment(enrollmentId);
        fetchTeacherData(); // Refresh data
    };
    
    const handleStartSession = async (classId: string) => {
        await startSession(classId);
        // Fix: Use navigate for navigation.
        navigate(`/live/${classId}`);
    };

    if (loading) return <Spinner />;

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <div className="glass-card p-6 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-[#00ddeb]">My Classes</h2>
                    <button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-transparent border border-[#00ddeb] text-[#00ddeb] px-4 py-2 rounded-md hover:bg-[#00ddeb] hover:text-black transition">
                        {showCreateForm ? 'Cancel' : '+ New Class'}
                    </button>
                </div>

                {showCreateForm && <CreateClassForm profile={profile} onClassCreated={() => {
                    setShowCreateForm(false);
                    fetchTeacherData();
                }} />}
                
                <div className="mt-4">
                    {myClasses.length > 0 ? (
                        <ul className="space-y-4">
                            {myClasses.map(c => (
                                <li key={c.id} className="bg-[#101113] p-4 rounded-md flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-lg">{c.className}</h3>
                                        <p className="text-sm text-gray-400">{c.subject} - {c.level}</p>
                                    </div>
                                    <button onClick={() => handleStartSession(c.id)} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition">Start Live Session</button>
                                </li>
                            ))}
                        </ul>
                    ) : !showCreateForm && (
                        <p className="text-gray-400 text-center py-4">You haven't created any classes yet. Click '+ New Class' to get started.</p>
                    )}
                </div>
            </div>
            <div className="glass-card p-6 rounded-lg">
                <h2 className="text-2xl font-bold mb-4 text-[#00ddeb]">Pending Requests</h2>
                {pendingRequests.length > 0 ? (
                    <ul className="space-y-4">
                        {pendingRequests.map(req => (
                            <li key={req.id} className="bg-[#101113] p-4 rounded-md flex justify-between items-center">
                                <p><span className="font-semibold">{req.studentName}</span> wants to join {myClasses.find(c => c.id === req.classId)?.className || 'your class'}.</p>
                                <button onClick={() => handleApprove(req.id)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition">Approve</button>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-gray-400">No pending enrollment requests.</p>}
            </div>
        </div>
    );
};


// StudentDashboard Component
const StudentDashboard: React.FC<{ profile: UserProfile }> = ({ profile }) => {
    const [myClasses, setMyClasses] = useState<Class[]>([]);
    const [allClasses, setAllClasses] = useState<Class[]>([]);
    const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    // Fix: Use useNavigate for react-router-dom v6.
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const [allClassesData, approvedClassIds] = await Promise.all([
                    getAllClasses(),
                    getStudentEnrollments(profile.uid)
                ]);
                
                setAllClasses(allClassesData);
                setEnrolledClassIds(approvedClassIds);

            } catch (error) {
                console.error("Error fetching student data:", error);
            }
            setLoading(false);
        };
        fetchAllData();
    }, [profile.uid]);

    useEffect(() => {
        if (enrolledClassIds.length === 0) {
            setMyClasses([]);
            return;
        }
        
        const unsubscribes = enrolledClassIds.map(classId => {
            const classRef = doc(db, 'classes', classId);
            return onSnapshot(classRef, (doc) => {
                const classData = { id: doc.id, ...doc.data() } as Class;
                setMyClasses(prev => {
                    const existing = prev.find(c => c.id === classId);
                    if (existing) {
                        return prev.map(c => c.id === classId ? classData : c);
                    }
                    return [...prev, classData];
                });
            });
        });

        return () => unsubscribes.forEach(unsub => unsub());

    }, [enrolledClassIds]);
    
    const handleRequestJoin = async (classToJoin: Class) => {
        try {
            await requestToJoinClass(classToJoin, profile);
            alert(`Request sent to join ${classToJoin.className}!`);
            // You might want to update UI to show pending status
        } catch(error) {
            console.error("Error requesting to join class:", error);
            alert("Failed to send join request.");
        }
    };
    
    if (loading) return <Spinner />;

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <div className="glass-card p-6 rounded-lg">
                <h2 className="text-2xl font-bold mb-4 text-[#00ddeb]">My Classes</h2>
                {myClasses.length > 0 ? (
                    <ul className="space-y-4">
                        {myClasses.map(c => (
                            <li key={c.id} className="bg-[#101113] p-4 rounded-md flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-lg">{c.className}</h3>
                                    <p className="text-sm text-gray-400">{c.teacherName}</p>
                                </div>
                                {c.isLive ? (
                                    <button onClick={() => navigate(`/live/${c.id}`)} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition animate-pulse">Join Live!</button>
                                ) : (
                                    <span className="text-gray-500">Not Live</span>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-gray-400">You are not enrolled in any classes yet.</p>}
            </div>
             <div className="glass-card p-6 rounded-lg">
                <h2 className="text-2xl font-bold mb-4 text-[#00ddeb]">Find a Class</h2>
                 <ul className="space-y-4 max-h-96 overflow-y-auto">
                    {allClasses.filter(c => !enrolledClassIds.includes(c.id)).map(c => (
                         <li key={c.id} className="bg-[#101113] p-4 rounded-md flex justify-between items-center">
                             <div>
                                 <h3 className="font-bold text-lg">{c.className}</h3>
                                 <p className="text-sm text-gray-400">{c.teacherName} - {c.subject}</p>
                             </div>
                             <button onClick={() => handleRequestJoin(c)} className="bg-[#a435f0] text-white px-3 py-1 rounded-md hover:bg-[#5624d0] transition">Request to Join</button>
                         </li>
                     ))}
                 </ul>
            </div>
        </div>
    );
};


// Main DashboardPage Component
const DashboardPage: React.FC = () => {
    const { userProfile, loading } = useAuth();

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <div>
            <h1 className="text-4xl font-bold mb-8 text-white">
                Welcome, <span className="text-[#a435f0]">{userProfile?.name}</span>
            </h1>
            {userProfile?.role === 'teacher' ? <TeacherDashboard profile={userProfile} /> : <StudentDashboard profile={userProfile} />}
        </div>
    );
};

export default DashboardPage;
