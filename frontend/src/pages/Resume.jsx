import React, { useEffect, useState } from 'react';
import { FileText, Layers, User, Award, CheckCircle2, Loader2, Sparkles, Plus } from 'lucide-react';

import { 
  getMasterProfile, 
  updateMasterProfile, 
  getResumeVersions, 
  createResumeVersion, 
  updateResumeVersion, 
  deleteResumeVersion, 
  duplicateResumeVersion,
  aiGenerateResume
} from '../api';

import DashboardView from '../components/resume-hub/DashboardView';
import MasterProfileView from '../components/resume-hub/MasterProfileView';
import MyResumesView from '../components/resume-hub/MyResumesView';
import ResumeEditorView from '../components/resume-hub/ResumeEditorView';

export default function Resume() {
  const [activeView, setActiveView] = useState('dashboard');
  const [profile, setProfile] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadData = async () => {
    try {
      const [profileData, versionsData] = await Promise.all([
        getMasterProfile(),
        getResumeVersions()
      ]);
      setProfile(profileData);
      setVersions(versionsData);
    } catch (e) {
      console.error('Failed to load Resume Hub data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async (updatedProfile) => {
    try {
      await updateMasterProfile(updatedProfile);
      setProfile(updatedProfile);
      showToast('Master Profile updated successfully.');
    } catch (e) {
      showToast('Failed to save Master Profile.');
      throw e;
    }
  };

  const handleCreateVersion = async ({ name, targetRole, template, useAI, jobDescription }) => {
    try {
      if (useAI) {
        const newVer = await aiGenerateResume(targetRole, jobDescription);
        setVersions(prev => [newVer, ...prev]);
        showToast(`AI Custom Resume generated for ${targetRole}`);
      } else {
        const newVer = await createResumeVersion(name, targetRole, template);
        setVersions(prev => [newVer, ...prev]);
        showToast(`Resume version "${name}" created.`);
      }
    } catch (e) {
      showToast('Failed to create resume version.');
      throw e;
    }
  };

  const handleUpdateVersion = async (updatedVersion) => {
    try {
      await updateResumeVersion(updatedVersion.id, updatedVersion);
      setVersions(prev => prev.map(v => v.id === updatedVersion.id ? updatedVersion : v));
      showToast('Resume version saved successfully.');
    } catch (e) {
      showToast('Failed to save resume version.');
      throw e;
    }
  };

  const handleDeleteVersion = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resume version?')) return;
    try {
      await deleteResumeVersion(id);
      setVersions(prev => prev.filter(v => v.id !== id));
      showToast('Resume version deleted.');
    } catch (e) {
      showToast('Failed to delete version.');
    }
  };

  const handleDuplicateVersion = async (id) => {
    try {
      const cloned = await duplicateResumeVersion(id);
      setVersions(prev => [cloned, ...prev]);
      showToast('Resume version cloned.');
    } catch (e) {
      showToast('Failed to duplicate version.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)] gap-3">
        <Loader2 className="animate-spin text-teal-400" size={36} />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Loading Resume Hub...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Upper Navigation Tabs (only show when not in editor view) */}
      {activeView !== 'editor' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Resume Hub</h1>
              <p className="text-xs text-slate-500">Create & manage targeted resume variants from one master profile.</p>
            </div>
          </div>

          <div className="flex bg-slate-950 p-1 border border-slate-850 rounded-xl">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'dashboard'
                  ? 'bg-slate-900 border border-slate-700/50 text-teal-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveView('profile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'profile'
                  ? 'bg-slate-900 border border-slate-700/50 text-teal-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Master Profile
            </button>
            <button
              onClick={() => setActiveView('resumes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'resumes'
                  ? 'bg-slate-900 border border-slate-700/50 text-teal-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              My Resumes
            </button>
          </div>
        </div>
      )}

      {/* Primary Sub-Views */}
      <div>
        {activeView === 'dashboard' && (
          <DashboardView 
            versions={versions} 
            profile={profile} 
            onNavigate={setActiveView} 
          />
        )}
        {activeView === 'profile' && (
          <MasterProfileView 
            initialProfile={profile} 
            onSave={handleSaveProfile} 
          />
        )}
        {activeView === 'resumes' && (
          <MyResumesView 
            versions={versions} 
            onCreate={handleCreateVersion} 
            onEdit={(id) => {
              const ver = versions.find(v => v.id === id);
              setSelectedVersion(ver);
              setActiveView('editor');
            }} 
            onDelete={handleDeleteVersion} 
            onDuplicate={handleDuplicateVersion} 
          />
        )}
        {activeView === 'editor' && (
          <ResumeEditorView 
            initialVersion={selectedVersion} 
            onSave={handleUpdateVersion} 
            onBack={() => {
              setActiveView('resumes');
              setSelectedVersion(null);
              loadData(); // reload to get any updated ATS score/details
            }} 
          />
        )}
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-teal-500 border border-teal-400/30 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs transition-all duration-300 animate-slide-in">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
