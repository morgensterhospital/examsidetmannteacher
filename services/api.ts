import firebase from 'firebase/compat/app';
import { db } from './firebase';
import type { UserProfile, Class, Enrollment } from '../types';

// Profile Management
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
        return userDoc.data() as UserProfile;
    }
    return null;
};

export const createUserProfile = async (
    user: firebase.User,
    name: string
): Promise<void> => {
    await db.collection('users').doc(user.uid).set({
        uid: user.uid,
        name,
        email: user.email,
        role: null, // Role is set to null initially, to be updated in the onboarding flow
    });
};

export const updateUserRole = async (uid: string, role: 'teacher' | 'student'): Promise<void> => {
    await db.collection('users').doc(uid).update({ role });
};


// Teacher Actions
export const createClass = async (
    teacherProfile: UserProfile,
    classDetails: { className: string; level: 'olevel' | 'alevel' | 'polytechnic'; subject: string }
): Promise<void> => {
    await db.collection('classes').add({
        teacherId: teacherProfile.uid,
        teacherName: teacherProfile.name,
        ...classDetails,
        isLive: false,
    });
};

export const getTeacherClasses = async (uid: string): Promise<Class[]> => {
    const snapshot = await db.collection('classes').where('teacherId', '==', uid).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Class[];
}

export const getPendingRequestsForTeacher = async (classIds: string[]): Promise<Enrollment[]> => {
    if (classIds.length === 0) return [];
    const snapshot = await db.collection('enrollments').where('classId', 'in', classIds).where('status', '==', 'pending').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Enrollment[];
}

export const approveEnrollment = async (enrollmentId: string): Promise<void> => {
    await db.collection('enrollments').doc(enrollmentId).update({ status: 'approved' });
};

export const startSession = async (classId: string): Promise<void> => {
    await db.collection('classes').doc(classId).update({ isLive: true });
};

export const endSession = async (classId: string): Promise<void> => {
    await db.collection('classes').doc(classId).update({ isLive: false });
};


// Student Actions
export const getAllClasses = async (): Promise<Class[]> => {
    const snapshot = await db.collection('classes').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Class[];
};

export const getStudentEnrollments = async (uid: string): Promise<string[]> => {
    const snapshot = await db.collection('enrollments').where('studentId', '==', uid).where('status', '==', 'approved').get();
    return snapshot.docs.map(doc => doc.data().classId);
};

export const requestToJoinClass = async (classToJoin: Class, profile: UserProfile): Promise<void> => {
     await db.collection('enrollments').add({
        classId: classToJoin.id,
        studentId: profile.uid,
        studentName: profile.name,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
};