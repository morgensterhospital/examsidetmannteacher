import React, { useState } from 'react';
// Fix: Use useNavigate for react-router-dom v6.
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../services/firebase';
import { createUserProfile, getUserProfile } from '../services/api';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Fix: Use useNavigate for react-router-dom v6.
    const navigate = useNavigate();

    // Common fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Registration fields
    const [name, setName] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // Fix: Use auth.signInWithEmailAndPassword for Firebase v8.
            await auth.signInWithEmailAndPassword(email, password);
            // Fix: Use navigate for navigation.
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
            // Fix: Use auth.createUserWithEmailAndPassword for Firebase v8.
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            // Fix: Check for user and use user.updateProfile for Firebase v8.
            if (user) {
                await user.updateProfile({ displayName: name });
                // Create a profile without a role. Role will be selected on the dashboard.
                await createUserProfile(user, name);
            }
            
            // Fix: Use navigate for navigation.
            navigate('/dashboard');
        } catch (err: any)
        {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await auth.signInWithPopup(googleProvider);
            const user = result.user;
            if (!user) throw new Error("Google sign-in failed.");

            // Check if user has a profile in our database
            const userProfile = await getUserProfile(user.uid);
            if (userProfile) {
                // Existing user, go to dashboard
                navigate('/dashboard');
            } else {
                // New user, create a partial profile and let them choose the role on the dashboard
                await createUserProfile(user, user.displayName || 'New User');
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


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
                        <div>
                            <label className="block text-sm font-medium text-[#cbb6e4]">Full Name</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-[#cbb6e4]">Email Address</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#cbb6e4]">Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 w-full p-2 bg-[#1c1d1f] border border-[#3e4143] rounded-md" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#a435f0] to-[#5624d0] text-white font-bold py-3 px-4 rounded-md hover:opacity-90 transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed neon-glow">
                        {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
                    </button>
                </form>

                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-600"></div>
                    <span className="flex-shrink mx-4 text-gray-400">OR</span>
                    <div className="flex-grow border-t border-gray-600"></div>
                </div>

                <button onClick={handleGoogleSignIn} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-3 px-4 rounded-md hover:bg-gray-200 transition transform hover:scale-105 disabled:opacity-50">
                    <svg className="w-6 h-6" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v8.51h12.8c-.57 3.01-2.2 5.48-4.64 7.17l7.98 6.19c4.63-4.28 7.27-10.45 7.27-17.32z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.98-6.19c-2.11 1.45-4.82 2.3-7.91 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    Sign in with Google
                </button>

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