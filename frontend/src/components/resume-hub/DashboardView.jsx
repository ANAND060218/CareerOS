import React from 'react';
import { FileText, Award, Layers, Percent, Clock, Plus, Zap, AlertCircle } from 'lucide-react';

export default function DashboardView({ versions, profile, onNavigate }) {
  const totalResumes = versions.length;
  
  // Calculate average ATS score for non-zero scores
  const scoredResumes = versions.filter(v => v.ats_score > 0);
  const avgAtsScore = scoredResumes.length > 0 
    ? Math.round(scoredResumes.reduce((acc, v) => acc + v.ats_score, 0) / scoredResumes.length)
    : 0;

  // Calculate completion percentage of Master Profile
  const calculateCompletion = () => {
    if (!profile) return 0;
    let filled = 0;
    let total = 0;

    // personal info fields
    const personal = profile.personal_info || {};
    total += 4;
    if (personal.name) filled++;
    if (personal.email) filled++;
    if (personal.phone) filled++;
    if (personal.location) filled++;

    // core sections
    total += 5;
    if (profile.professional_summary) filled++;
    if (profile.education && profile.education.length > 0) filled++;
    if (profile.experience && profile.experience.length > 0) filled++;
    if (profile.projects && profile.projects.length > 0) filled++;
    if (profile.skills && profile.skills.length > 0) filled++;

    return Math.round((filled / total) * 100);
  };

  const completionPercent = calculateCompletion();

  const getRecentActivity = () => {
    const list = [];
    if (profile && profile.updated_at) {
      list.push({ type: 'profile', text: 'Master Profile updated', date: new Date(profile.updated_at).toLocaleDateString() });
    }
    versions.slice(0, 3).forEach(v => {
      list.push({ type: 'resume', text: `Resume version "${v.name}" modified`, date: new Date(v.updated_at || v.created_at).toLocaleDateString() });
    });
    return list;
  };

  const activities = getRecentActivity();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 mb-1">Resume Hub Dashboard</h2>
        <p className="text-xs text-slate-500">Track and optimize your multiple role-specific resumes inherited from your Master Profile.</p>
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4 py-4 px-5">
          <div className="p-3 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl">
            <FileText size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{totalResumes}</div>
            <div className="text-xs text-slate-500">Total Resumes</div>
          </div>
        </div>

        <div className="card flex items-center gap-4 py-4 px-5">
          <div className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl">
            <Award size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{avgAtsScore}%</div>
            <div className="text-xs text-slate-500">Average ATS Score</div>
          </div>
        </div>

        <div className="card flex items-center gap-4 py-4 px-5">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
            <Percent size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold text-slate-100">{completionPercent}%</div>
            <div className="text-xs text-slate-500">Master Profile Completion</div>
          </div>
        </div>

        <div className="card flex items-center gap-4 py-4 px-5">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">
              {versions[0] ? new Date(versions[0].updated_at || versions[0].created_at).toLocaleDateString() : '—'}
            </div>
            <div className="text-xs text-slate-500">Last Modified Resume</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Get Started / Health Checks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile completion bar */}
          <div className="card space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-200">Master Profile Health</h3>
              <span className="text-xs font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full">{completionPercent}% Ready</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your Master Profile serves as the single source of truth. Filling it out completely makes it easy to generate specialized resumes for any target role with one click.
            </p>
            <div className="stat-bar w-full">
              <div 
                className="stat-bar-fill bg-gradient-to-r from-teal-500 to-teal-400"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            {completionPercent < 80 && (
              <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>Fill out missing personal summary, experiences, or project details to improve your AI optimizations.</span>
              </div>
            )}
            <button 
              onClick={() => onNavigate('profile')} 
              className="w-full btn-secondary text-xs py-2 flex justify-center items-center gap-1.5"
            >
              Update Master Profile
            </button>
          </div>

          {/* Quick AI generation banner */}
          <div className="card bg-gradient-to-r from-slate-900 via-violet-950/20 to-teal-950/20 border-teal-500/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                <Zap size={16} className="text-teal-400" />
                Generate Role-Specific Resume
              </h3>
              <p className="text-xs text-slate-400 max-w-md">
                Quickly customize your experience and target keywords for roles like AI Developer, DevOps Engineer, or Product Manager in seconds.
              </p>
            </div>
            <button 
              onClick={() => onNavigate('resumes')} 
              className="btn-primary shrink-0 text-xs py-2.5 px-4 flex items-center gap-1.5"
            >
              <Plus size={14} /> Create Version
            </button>
          </div>
        </div>

        {/* Right Column: Recent Activity */}
        <div className="card space-y-4">
          <h3 className="font-bold text-sm text-slate-200">Recent Activity</h3>
          
          {activities.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No recent activity. Start by editing your Master Profile.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act, i) => (
                <div key={i} className="flex justify-between items-start text-xs border-b border-slate-800 pb-2.5 last:border-0 last:pb-0">
                  <div className="space-y-0.5">
                    <span className="font-medium text-slate-300">{act.text}</span>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{act.type}</p>
                  </div>
                  <span className="text-[10px] text-slate-500">{act.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
