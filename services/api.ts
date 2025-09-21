import {
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';
// Fix: Use Firebase v8 compat User type.
import type firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { UserProfile, Class, Enrollment } from '../types';

// Profile Management
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocSnap.data() as UserProfile;
    }
    return null;
};

export const createUserProfile = async (
    // Fix: Use firebase.User type
    user: firebase.User,
    name: string,
    role: 'student' | 'teacher'
): Promise<void> => {
    await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email: user.email,
        role,
    });
};

// Teacher Actions
export const createClass = async (
    teacherProfile: UserProfile,
    classDetails: { className: string; level: 'olevel' | 'alevel' | 'polytechnic'; subject: string }
): Promise<void> => {
    await addDoc(collection(db, 'classes'), {
        teacherId: teacherProfile.uid,
        teacherName: teacherProfile.name,
        ...classDetails,
        isLive: false,
    });
};

export const getTeacherClasses = async (uid: string): Promise<Class[]> => {
    const classesQuery = query(collection(db, 'classes'), where('teacherId', '==', uid));
    const classesSnapshot = await getDocs(classesQuery);
    return classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Class[];
}

export const getPendingRequestsForTeacher = async (classIds: string[]): Promise<Enrollment[]> => {
    if (classIds.length === 0) return [];
    const enrollmentsQuery = query(collection(db, 'enrollments'), where('classId', 'in', classIds), where('status', '==', 'pending'));
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    return enrollmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Enrollment[];
}

export const approveEnrollment = async (enrollmentId: string): Promise<void> => {
    const enrollmentRef = doc(db, 'enrollments', enrollmentId);
    await updateDoc(enrollmentRef, { status: 'approved' });
};

export const startSession = async (classId: string): Promise<void> => {
    const classRef = doc(db, 'classes', classId);
    await updateDoc(classRef, { isLive: true });
};

export const endSession = async (classId: string): Promise<void> => {
    const classRef = doc(db, 'classes', classId);
    await updateDoc(classRef, { isLive: false });
    // Note: Ephemeral live_session data is left to be cleaned up by a script or naturally expire.
    // Client-side cleanup of collections is not recommended for security/reliability.
};


// Student Actions
export const getAllClasses = async (): Promise<Class[]> => {
    const allClassesSnapshot = await getDocs(collection(db, 'classes'));
    return allClassesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Class[];
};

export const getStudentEnrollments = async (uid: string): Promise<string[]> => {
    const enrollmentsQuery = query(collection(db, 'enrollments'), where('studentId', '==', uid), where('status', '==', 'approved'));
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    return enrollmentsSnapshot.docs.map(doc => doc.data().classId);
};

export const requestToJoinClass = async (classToJoin: Class, profile: UserProfile): Promise<void> => {
     await addDoc(collection(db, 'enrollments'), {
        classId: classToJoin.id,
        studentId: profile.uid,
        studentName: profile.name,
        status: 'pending',
        createdAt: serverTimestamp()
    });
};