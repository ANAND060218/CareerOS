import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { LayoutDashboard, Briefcase, FileText, CheckSquare } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Applications from './pages/Applications';
import Resume from './pages/Resume';

function Navbar() {
  return (
    <nav className="bg-surface border-b border-slate-700 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold text-accent tracking-wider">CareerOS</h1>
        <div className="flex space-x-6">
          <Link to="/" className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
            <LayoutDashboard size={20} /> <span>Dashboard</span>
          </Link>
          <Link to="/jobs" className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
            <Briefcase size={20} /> <span>Jobs</span>
          </Link>
          <Link to="/applications" className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
            <CheckSquare size={20} /> <span>Applications</span>
          </Link>
          <Link to="/resume" className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
            <FileText size={20} /> <span>Resume</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow container mx-auto p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/resume" element={<Resume />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
