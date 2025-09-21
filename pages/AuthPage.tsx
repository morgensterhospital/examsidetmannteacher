
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Common fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Registration fields
    const [name, setName] = useState('');
    const [role, setRole] = useState<'student' | 'teacher'>('student');
    const [level, setLevel] = useState<'olevel' | 'alevel' | 'polytechnic'>('olevel');
    const [subject, setSubject] = useState('');
    const [className, setClassName] = useState('');

    const olevelSubjects = ["Mathematics", "English Language", "Integrated Science", "History", "Geography"];
    const alevelSubjects = ["Mathematics", "Physics", "Chemistry", "Biology", "Literature in English"];
    const polytechnicSubjects = ["Applied Mechanics", "Electrical Engineering", "Software Development", "Accounting"];

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: name });

            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                name,
                email,
                role,
            });

            if (role === 'teacher') {
                await addDoc(collection(db, 'classes'), {
                    teacherId: user.uid,
                    teacherName: name,
                    className,
                    level,
                    subject,
                    isLive: false,
                });
            }
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const getSubjectOptions = () => {
        switch(level) {
            case 'olevel': return olevelSubjects;
            case 'alevel': return alevelSubjects;
            case 'polytechnic': return polytechnicSubjects;
            default: return [];
        }
    }
    
    const renderTeacherFields = () => (
        <>
            <div>
                <label className="block text-sm font-medium text-[#cbb6e4]">Curriculum Level</label>
                <select value={level} onChange={(e) => setLevel(e.target.value as any)} className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md">
                    <option value="olevel">O-Level</option>
                    <option value="alevel">A-Level</option>
                    <option value="polytechnic">Polytechnic</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-[#cbb6e4]">Subject</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md">
                     <option value="" disabled>Select a subject</option>
                     {getSubjectOptions().map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
             <div>
                <label className="block text-sm font-medium text-[#cbb6e4]">Class Name</label>
                <input type="text" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. A-Level Physics 2024" className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
            </div>
        </>
    );

    return (
        <div className="flex justify-center items-center py-12">
            <div className="w-full max-w-md p-8 space-y-6 glass-card rounded-xl">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white neon-text-purple">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
                    <p className="text-gray-400 mt-2">
                        {isLogin ? 'Sign in to continue your learning journey.' : 'Join our community of learners and educators.'}
                    </p>
                </div>
                
                {error && <p className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</p>}

                <form className="space-y-4" onSubmit={isLogin ? handleLogin : handleRegister}>
                    {!isLogin && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-[#cbb6e4]">Full Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-[#cbb6e4]">Email Address</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#cbb6e4]">Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
                    </div>
                     {!isLogin && (
                        <>
                            <div className="pt-2">
                               <label className="block text-sm font-medium text-[#cbb6e4] mb-2">I am a...</label>
                                <div className="flex gap-4">
                                    <label className="flex-1 p-3 border border-[#3e4143] rounded-md cursor-pointer has-[:checked]:bg-[#5624d0]/50 has-[:checked]:border-[#a435f0]">
                                        <input type="radio" name="role" value="student" checked={role === 'student'} onChange={() => setRole('student')} className="sr-only" />
                                        <span className="text-white">Student</span>
                                    </label>
                                    <label className="flex-1 p-3 border border-[#3e4143] rounded-md cursor-pointer has-[:checked]:bg-[#5624d0]/50 has-[:checked]:border-[#a435f0]">
                                        <input type="radio" name="role" value="teacher" checked={role === 'teacher'} onChange={() => setRole('teacher')} className="sr-only"/>
                                        <span className="text-white">Teacher</span>
                                    </label>
                                </div>
                            </div>
                            {role === 'teacher' && renderTeacherFields()}
                        </>
                    )}
                    <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#a435f0] to-[#5624d0] text-white font-bold py-3 px-4 rounded-md hover:opacity-90 transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed neon-glow">
                        {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
                    </button>
                </form>
                <p className="text-center text-gray-400">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}
                    <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-[#00ddeb] hover:underline ml-2">
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default AuthPage;
