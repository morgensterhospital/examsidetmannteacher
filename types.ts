
import type { User } from 'firebase/auth';

export interface UserProfile {
    uid: string;
    name: string;
    email: string;
    role: 'teacher' | 'student';
}

export interface Class {
    id: string;
    teacherId: string;
    teacherName: string;
    className: string;
    level: 'olevel' | 'alevel' | 'polytechnic';
    subject: string;
    isLive: boolean;
}

export interface Enrollment {
    id: string;
    classId: string;
    studentId: string;
    studentName: string;
    status: 'pending' | 'approved';
    className?: string; // Optional for display purposes
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// Simplified WebRTC signal type for Firestore
export interface Signal {
  type: 'offer' | 'answer' | 'candidate';
  sender: string;
  target: string;
  data: any; // SDP or ICE candidate
}
