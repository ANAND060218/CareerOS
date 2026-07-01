import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Briefcase, Target, Save, Trash2, LogOut, Loader2, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { deleteAccount, getProfile, updateProfile } from '../api';

function TagInput({ label, values, onChange, placeholder }) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setText('');
  };
  return (
    <div>
      <label className="text-sm text-slate-400 mb-1 block">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-teal-950/50 border border-teal-700/40 px-3 py-1 text-xs text-teal-200">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-slate-500 hover:text-rose-400">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="input-field flex-1"
        />
        <button type="button" onClick={add} className="btn-secondary px-4">Add</button>
      </div>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { logout, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: '',
    career_goals: '',
    preferred_roles: [],
    preferred_locations: [],
    skills: [],
    dream_companies: [],
    salary_expectation: '',
  });

  useEffect(() => {
    getProfile()
      .then((data) => {
        setForm({
          name: data.user?.name || '',
          email: data.user?.email || '',
          role: data.user?.role || '',
          career_goals: data.memory?.career_goals || '',
          preferred_roles: data.memory?.preferred_roles || [],
          preferred_locations: data.memory?.preferred_locations || [],
          skills: data.memory?.skills || [],
          dream_companies: data.memory?.dream_companies || [],
          salary_expectation: data.memory?.salary_expectation || '',
        });
        setStats(data.stats);
      })
      .catch(() => setError('Could not load profile.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateProfile({
        name: form.name,
        role: form.role,
        career_goals: form.career_goals,
        preferred_roles: form.preferred_roles,
        preferred_locations: form.preferred_locations,
        skills: form.skills,
        dream_companies: form.dream_companies,
        salary_expectation: form.salary_expectation,
      });
      await refreshUser();
      setMessage('Profile saved. AI memory updated for Opportunity Scout and workflows.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed.');
    }
    setSaving(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete your account and all data permanently? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteAccount();
      logout();
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center p-10">
        <Loader2 className="animate-spin h-10 w-10 text-teal-500 mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
          <User className="text-teal-400" /> Profile
        </h1>
        <p className="text-slate-500 mt-1">Your account and AI memory — used by all 6 Lemma agents.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Resume chars', value: stats.resume_chars },
            { label: 'Skills', value: stats.skills_count },
            { label: 'Uploads', value: stats.resume_uploads },
            { label: 'Applications', value: stats.applications },
          ].map((s) => (
            <div key={s.label} className="card text-center py-4">
              <div className="text-2xl font-bold text-teal-400">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSave} className="card space-y-6">
        <h2 className="text-lg font-bold text-slate-100 border-b border-slate-700 pb-2">Account</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 flex items-center gap-1"><User size={14} /> Name</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 flex items-center gap-1"><Mail size={14} /> Email</label>
            <input className="input-field bg-slate-900/50 text-slate-500" value={form.email} disabled />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-slate-400 mb-1 flex items-center gap-1"><Briefcase size={14} /> Target role</label>
            <input className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Software Engineer" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-slate-100 border-b border-slate-700 pb-2">AI Memory</h2>
        <div>
          <label className="text-sm text-slate-400 mb-1 flex items-center gap-1"><Target size={14} /> Career goals</label>
          <textarea
            className="input-field min-h-[80px]"
            value={form.career_goals}
            onChange={(e) => setForm({ ...form, career_goals: e.target.value })}
            placeholder="Where do you want to be in 2 years?"
          />
        </div>
        <TagInput label="Preferred roles" values={form.preferred_roles} onChange={(v) => setForm({ ...form, preferred_roles: v })} placeholder="Backend Engineer" />
        <TagInput label="Skills" values={form.skills} onChange={(v) => setForm({ ...form, skills: v })} placeholder="Python, React..." />
        <TagInput label="Preferred locations" values={form.preferred_locations} onChange={(v) => setForm({ ...form, preferred_locations: v })} placeholder="Remote, Bangalore" />
        <TagInput label="Dream companies" values={form.dream_companies} onChange={(v) => setForm({ ...form, dream_companies: v })} placeholder="Google" />
        <div>
          <label className="text-sm text-slate-400 mb-1">Salary expectation</label>
          <input className="input-field" value={form.salary_expectation} onChange={(e) => setForm({ ...form, salary_expectation: e.target.value })} placeholder="e.g. 12 LPA" />
        </div>

        {message && <div className="text-sm text-emerald-400">{message}</div>}
        {error && <div className="text-sm text-rose-400">{error}</div>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <div className="card border-slate-700 space-y-3">
        <h2 className="text-lg font-bold text-slate-100">Session</h2>
        <button type="button" onClick={handleLogout} className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
          <LogOut size={18} /> Log out
        </button>
      </div>

      <div className="card border-rose-900/50 bg-rose-950/10 space-y-3">
        <h2 className="text-lg font-bold text-rose-300 flex items-center gap-2"><AlertTriangle size={18} /> Danger zone</h2>
        <p className="text-sm text-slate-500">Deletes your account, resume, memory, applications, and timeline events.</p>
        <button type="button" onClick={handleDelete} disabled={deleting} className="w-full py-3 rounded-lg border border-rose-700/50 text-rose-400 hover:bg-rose-950/30 flex items-center justify-center gap-2">
          {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          {deleting ? 'Deleting...' : 'Delete account'}
        </button>
      </div>
    </div>
  );
}
