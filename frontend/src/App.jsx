import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, FileText, CheckSquare, LogOut, Sparkles, User, MessageSquare } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Applications from './pages/Applications';
import Resume from './pages/Resume';
import Profile from './pages/Profile';
import Login from './pages/Login';

function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLink = (to, label, Icon) => {
    const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
          active
            ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
        }`}
      >
        <Icon size={18} />
        <span className="hidden md:inline">{label}</span>
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-teal-500/20 to-violet-500/20 border border-teal-500/30">
            <Sparkles className="text-teal-400" size={22} />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-violet-300">
            CareerOS
          </span>
        </Link>
        {user && (
          <div className="flex items-center gap-2 md:gap-4">
            {navLink('/', 'Mission Control', LayoutDashboard)}
            {navLink('/jobs', 'Jobs', Briefcase)}
            {navLink('/applications', 'Applications', CheckSquare)}
            {navLink('/resume', 'Resume', FileText)}
            <Link to="/profile" className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-teal-400">
              <User size={18} />
            </Link>
            <Link
              to="/profile"
              className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-sm border-l border-slate-700 ml-2 pl-4 transition-all ${
                location.pathname === '/profile'
                  ? 'text-teal-300'
                  : 'text-slate-500 hover:text-teal-300'
              }`}
            >
              <User size={16} />
              {user.name}
            </Link>
            <button
              onClick={logout}
              className="text-slate-500 hover:text-rose-400 flex items-center gap-1 text-sm p-2 rounded-lg hover:bg-rose-950/30 transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="text-center p-10">
        <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
      <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
      <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
      <Route path="/resume" element={<ProtectedRoute><Resume /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/mentor" element={<Navigate to="/jobs" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-grow container mx-auto p-4 md:p-8">
            <AppRoutes />
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
