import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import type firebase from 'firebase/compat/app';
import { auth } from './services/firebase';
import { getUserProfile } from './services/api';
import type { UserProfile } from './types';

import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import Spinner from './components/Spinner';

// --- START: Toast Notification System ---
// To keep the file count low, the Toast system is integrated here.
// In a larger app, this would be in its own files (context, component).

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    // Simple interface for easy calling
    return {
        success: (message: string) => context.addToast(message, 'success'),
        error: (message: string) => context.addToast(message, 'error'),
        info: (message: string) => context.addToast(message, 'info'),
    };
};

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = Date.now();
        setToasts(currentToasts => [...currentToasts, { id, message, type }]);
        setTimeout(() => {
            setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
        }, 5000); // Auto-dismiss after 5 seconds
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <ToastContainer toasts={toasts} />
        </ToastContext.Provider>
    );
};

const ToastContainer: React.FC<{ toasts: Toast[] }> = ({ toasts }) => {
    return (
        <div className="fixed bottom-5 right-5 z-[100] w-full max-w-xs space-y-3">
            {toasts.map(toast => (
                <ToastMessage key={toast.id} message={toast.message} type={toast.type} />
            ))}
        </div>
    );
};

const ToastMessage: React.FC<Omit<Toast, 'id'>> = ({ message, type }) => {
    const baseClasses = 'p-4 rounded-lg shadow-2xl text-white font-semibold animate-fade-in-up';
    const typeClasses = {
        success: 'bg-green-600/80 backdrop-blur-sm border border-green-500',
        error: 'bg-red-600/80 backdrop-blur-sm border border-red-500',
        info: 'bg-blue-600/80 backdrop-blur-sm border border-blue-500',
    };
    return (
        <div className={`${baseClasses} ${typeClasses[type]}`}>
            {message}
        </div>
    );
};
// --- END: Toast Notification System ---


interface AuthContextType {
    user: firebase.User | null;
    userProfile: UserProfile | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<firebase.User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                const profile = await getUserProfile(firebaseUser.uid);
                setUserProfile(profile);
            } else {
                setUser(null);
                setUserProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const value = { user, userProfile, loading };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const Header: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const handleLogout = async () => {
        try {
            await auth.signOut();
            toast.success("You have been logged out.");
            navigate('/auth');
        } catch(e) {
            toast.error("Logout failed. Please try again.");
        }
    };

    return (
        <header className="py-4 px-8 glass-card sticky top-0 z-50">
            <div className="container mx-auto flex justify-between items-center">
                <Link to="/" className="text-2xl font-bold text-white neon-text-purple">Exam Sidemann</Link>
                <nav className="flex items-center space-x-6">
                    {!loading && (
                        <>
                            {user ? (
                                <>
                                    <Link to="/dashboard" className="text-gray-300 hover:text-white transition">Dashboard</Link>
                                    <button onClick={handleLogout} className="bg-[#a435f0] text-white px-4 py-2 rounded-md hover:bg-[#5624d0] transition-transform transform hover:scale-105">Logout</button>
                                </>
                            ) : (
                                <Link to="/auth" className="bg-[#00ddeb] text-black px-4 py-2 rounded-md hover:bg-opacity-80 transition-transform transform hover:scale-105">Login / Register</Link>
                            )}
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
};

const Footer: React.FC = () => (
    <footer className="py-6 mt-12 glass-card">
        <div className="container mx-auto text-center text-gray-400">
            &copy; {new Date().getFullYear()} Exam Sidemann Live Teaching. All Rights Reserved.
        </div>
    </footer>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen flex flex-col bg-[#101113] bg-grid-gray-700/[0.2]">
         <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
            {children}
        </main>
        <Footer />
    </div>
);


const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/auth', { replace: true, state: { from: location } });
        }
    }, [user, loading, navigate, location]);

    if (loading) {
        return <div className="h-screen flex items-center justify-center"><Spinner /></div>;
    }
    
    if (!user) {
        return null;
    }

    return <>{children}</>;
};


const App: React.FC = () => {
    return (
        <ToastProvider>
            <AuthProvider>
                <HashRouter>
                    <Layout>
                        <Routes>
                            <Route path="/auth" element={<AuthPage />} />
                            <Route path="/dashboard" element={
                                <AuthGuard><DashboardPage /></AuthGuard>
                            } />
                            <Route path="/" element={<HomePage />} />
                        </Routes>
                    </Layout>
                </HashRouter>
            </AuthProvider>
        </ToastProvider>
    );
};

export default App;