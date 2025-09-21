
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from './services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from './types';

import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import LiveSessionPage from './pages/LiveSessionPage';
import Spinner from './components/Spinner';

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    setUserProfile(userDocSnap.data() as UserProfile);
                } else {
                    setUserProfile(null); // Or handle error
                }
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

    const handleLogout = async () => {
        await auth.signOut();
        navigate('/auth');
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
            navigate('/auth', { state: { from: location }, replace: true });
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
        <AuthProvider>
            <HashRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/auth" element={<AuthPage />} />
                        <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
                        <Route path="/live/:classId" element={<AuthGuard><LiveSessionPage /></AuthGuard>} />
                    </Routes>
                </Layout>
            </HashRouter>
        </AuthProvider>
    );
};

export default App;
