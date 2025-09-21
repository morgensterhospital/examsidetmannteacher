
import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
    return (
        <div className="text-center py-20">
            <div className="relative">
                <div className="absolute inset-0.5 bg-gradient-to-r from-[#a435f0] to-[#00ddeb] rounded-lg blur-lg opacity-75"></div>
                <div className="relative bg-[#101113] p-10 rounded-lg">
                    <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-300 mb-4 neon-text-purple">
                        Welcome to Exam Sidemann
                    </h1>
                    <h2 className="text-2xl md:text-3xl text-gray-300 mb-8">
                        Your Real-Time Interactive Tutoring Platform for Zimbabwe
                    </h2>
                    <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-10">
                        Connect with expert teachers for ZIMSEC and HEXCO curriculums. Join live classes, collaborate on a digital whiteboard, and get help from an AI study buddy, all from the comfort of your home.
                    </p>
                    <div className="flex justify-center space-x-6">
                        <Link 
                            to="/auth" 
                            className="bg-gradient-to-r from-[#a435f0] to-[#5624d0] text-white font-bold py-3 px-8 rounded-full text-lg hover:opacity-90 transition-all duration-300 transform hover:scale-110 neon-glow"
                        >
                            Get Started
                        </Link>
                        <Link 
                            to="/auth" 
                            className="bg-transparent border-2 border-[#00ddeb] text-[#00ddeb] font-bold py-3 px-8 rounded-full text-lg hover:bg-[#00ddeb] hover:text-black transition-all duration-300 transform hover:scale-110"
                        >
                            I have an account
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mt-24 grid md:grid-cols-3 gap-10">
                <div className="glass-card p-8 rounded-xl">
                    <h3 className="text-2xl font-bold text-[#00ddeb] mb-3">For Teachers</h3>
                    <p className="text-gray-400">Create your digital classroom, manage students, and conduct live, interactive lessons with our state-of-the-art tools.</p>
                </div>
                <div className="glass-card p-8 rounded-xl">
                    <h3 className="text-2xl font-bold text-[#00ddeb] mb-3">For Students</h3>
                    <p className="text-gray-400">Discover top teachers, join classes for any subject, and excel in your exams with personalized, live tutoring.</p>
                </div>
                <div className="glass-card p-8 rounded-xl">
                    <h3 className="text-2xl font-bold text-[#00ddeb] mb-3">AI Study Buddy</h3>
                    <p className="text-gray-400">Never get stuck again. Our Gemini-powered AI assistant is available 24/7 during live sessions to answer your questions.</p>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
