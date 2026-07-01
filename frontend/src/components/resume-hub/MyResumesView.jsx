import React, { useState } from 'react';
import { FileText, Copy, Edit2, Trash2, Plus, Star, Search, Filter, HelpCircle, Loader2, Sparkles } from 'lucide-react';

export default function MyResumesView({ versions, onCreate, onEdit, onDelete, onDuplicate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [template, setTemplate] = useState('Modern ATS');
  const [useAI, setUseAI] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const roles = [
    'Software Engineer', 'Java Developer', 'Python Developer', 'Backend Engineer',
    'Frontend Engineer', 'Full Stack Developer', 'AI Engineer', 'ML Engineer',
    'Data Scientist', 'Cybersecurity Analyst', 'Cloud Engineer', 'DevOps Engineer',
    'Android Developer', 'Product Manager', 'Business Analyst', 'QA Engineer',
    'Embedded Engineer', 'Custom Role'
  ];

  const templates = ['Modern ATS', 'Minimal', 'Google Style', 'Amazon Style'];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await onCreate({ name, targetRole, template, useAI, jobDescription });
      setName('');
      setJobDescription('');
      setShowCreateModal(false);
    } catch (err) {
      alert('Error creating resume version.');
    } finally {
      setCreating(false);
    }
  };

  // Filter & Sort versions
  const filteredVersions = versions
    .filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()) || v.target_role.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(v => !roleFilter || v.target_role === roleFilter)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">My Resumes</h2>
          <p className="text-xs text-slate-500">Manage, edit, clone, and trigger compliance scoring on your resume versions.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary text-xs py-2.5 px-4 flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus size={14} />
          Create Resume Version
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-2xl flex flex-col md:flex-row gap-3">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search resumes by name or role..."
            className="input-field py-2 pl-9 text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <select
            className="bg-slate-950 border border-slate-800 text-slate-350 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select
            className="bg-slate-950 border border-slate-800 text-slate-350 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="updated">Recently Modified</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Versions Grid */}
      {filteredVersions.length === 0 ? (
        <div className="card text-center py-16 text-xs text-slate-500 border-dashed border-slate-800">
          <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          No resume versions found matching search criteria. Create one above!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVersions.map((version) => {
            const dateStr = new Date(version.updated_at || version.created_at).toLocaleDateString();
            return (
              <div 
                key={version.id} 
                className="card border border-slate-800/80 bg-slate-950/20 hover:border-slate-700/50 hover:bg-slate-900/10 flex flex-col justify-between h-56 transition-all relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-lg">
                        <FileText size={16} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-200 line-clamp-1">{version.name}</h4>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase">{version.target_role}</p>
                      </div>
                    </div>
                    {version.ats_score > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        version.ats_score >= 75 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        ATS: {version.ats_score}%
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 text-xs text-slate-400 py-1">
                    <p className="text-[11px]">Template: <span className="text-slate-200">{version.template}</span></p>
                    <p className="text-[11px]">Skills: <span className="text-slate-200">{(version.skills || []).length} keywords</span></p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-900 text-xs">
                  <span className="text-[10px] text-slate-600">Updated: {dateStr}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onDuplicate(version.id)} 
                      title="Clone version" 
                      className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-teal-400 hover:border-teal-500/20"
                    >
                      <Copy size={12} />
                    </button>
                    <button 
                      onClick={() => onEdit(version.id)} 
                      className="px-3 py-1 bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 text-teal-300 rounded font-semibold text-[11px]"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => onDelete(version.id)} 
                      className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-950/20 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
              <Plus className="text-teal-400" size={18} />
              Create Custom Resume Version
            </h3>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Resume Version Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Java Backend Engineer Resume"
                  className="input-field py-2 px-3 text-xs"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Target Role *</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl p-2.5 focus:outline-none focus:border-teal-500"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Select Template</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl p-2.5 focus:outline-none focus:border-teal-500"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                  >
                    {templates.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* AI Auto tailor options */}
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-800 text-teal-600 bg-slate-950 w-3.5 h-3.5"
                      checked={useAI} 
                      onChange={(e) => setUseAI(e.target.checked)} 
                    />
                    Auto-Generate and Tailor with AI (Recommended)
                  </label>
                  <Sparkles size={14} className="text-teal-400" />
                </div>
                {useAI && (
                  <div className="space-y-1.5 animate-slide-in">
                    <label className="text-[10px] text-slate-500 font-bold uppercase block">Target Job Description (Optional but Recommended)</label>
                    <textarea
                      placeholder="Paste the description of the job you want to target..."
                      className="input-field min-h-[100px] text-xs font-sans"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="flex-1 btn-primary text-xs py-2.5 flex justify-center items-center gap-1.5 disabled:opacity-50"
                >
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {creating ? 'Tailoring Profile...' : 'Build Custom Resume'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-850 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
