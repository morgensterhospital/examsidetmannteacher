
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../App';
import type { Class, Enrollment, UserProfile } from '../types';
import Spinner from '../components/Spinner';

// TeacherDashboard Component (defined within DashboardPage)
const TeacherDashboard: React.FC<{ profile: UserProfile }> = ({ profile }) => {
    const [myClasses, setMyClasses] = useState<Class[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchTeacherData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch classes
            const classesQuery = query(collection(db, 'classes'), where('teacherId', '==', profile.uid));
            const classesSnapshot = await getDocs(classesQuery);
            const classesData = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Class[];
            setMyClasses(classesData);

            if (classesData.length > 0) {
                const classIds = classesData.map(c => c.id);
                 // Fetch pending enrollments for those classes
                const enrollmentsQuery = query(collection(db, 'enrollments'), where('classId', 'in', classIds), where('status', '==', 'pending'));
                const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
                const requestsData = enrollmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Enrollment[];
                setPendingRequests(requestsData);
            }
        } catch (error) {
            console.error("Error fetching teacher data:", error);
        }
        setLoading(false);
    }, [profile.uid]);

    useEffect(() => {
        fetchTeacherData();
    }, [fetchTeacherData]);

    const handleApprove = async (enrollmentId: string) => {
        const enrollmentRef = doc(db, 'enrollments', enrollmentId);
        await updateDoc(enrollmentRef, { status: 'approved' });
        fetchTeacherData(); // Refresh data
    };
    
    const handleStartSession = async (classId: string) => {
        const classRef = doc(db, 'classes', classId);
        await updateDoc(classRef, { isLive: true });
        navigate(`/live/${classId}`);
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
                                    <p className="text-sm text-gray-400">{c.subject} - {c.level}</p>
                                </div>
                                <button onClick={() => handleStartSession(c.id)} className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition">Start Live Session</button>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-gray-400">You haven't created any classes yet.</p>}
            </div>
            <div className="glass-card p-6 rounded-lg">
                <h2 className="text-2xl font-bold mb-4 text-[#00ddeb]">Pending Requests</h2>
                {pendingRequests.length > 0 ? (
                    <ul className="space-y-4">
                        {pendingRequests.map(req => (
                            <li key={req.id} className="bg-[#101113] p-4 rounded-md flex justify-between items-center">
                                <p><span className="font-semibold">{req.studentName}</span> wants to join your class.</p>
                                <button onClick={() => handleApprove(req.id)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition">Approve</button>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-gray-400">No pending enrollment requests.</p>}
            </div>
        </div>
    );
};


// StudentDashboard Component (defined within DashboardPage)
const StudentDashboard: React.FC<{ profile: UserProfile }> = ({ profile }) => {
    const [myClasses, setMyClasses] = useState<Class[]>([]);
    const [allClasses, setAllClasses] = useState<Class[]>([]);
    const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                // Fetch all classes for discovery
                const allClassesSnapshot = await getDocs(collection(db, 'classes'));
                const allClassesData = allClassesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Class[];
                setAllClasses(allClassesData);
                
                // Fetch student's enrollments
                const enrollmentsQuery = query(collection(db, 'enrollments'), where('studentId', '==', profile.uid), where('status', '==', 'approved'));
                const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
                const approvedClassIds = enrollmentsSnapshot.docs.map(doc => doc.data().classId);
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
            await addDoc(collection(db, 'enrollments'), {
                classId: classToJoin.id,
                studentId: profile.uid,
                studentName: profile.name,
                status: 'pending',
                createdAt: serverTimestamp()
            });
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
