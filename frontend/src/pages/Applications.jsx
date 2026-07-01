import React, { useEffect, useState } from 'react';
import { getApplications, updateApplicationStatus, createApplication } from '../api';
import { Building, Calendar, GripVertical, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const COLUMNS = [
  { id: 'Saved', color: 'border-slate-600 bg-slate-900/60' },
  { id: 'Applied', color: 'border-cyan-700/50 bg-cyan-950/30' },
  { id: 'Interview', color: 'border-violet-700/50 bg-violet-950/30' },
  { id: 'Offer', color: 'border-emerald-700/50 bg-emerald-950/30' },
  { id: 'Rejected', color: 'border-rose-700/50 bg-rose-950/30' },
];

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualStatus, setManualStatus] = useState('Saved');
  const [creating, setCreating] = useState(false);

  const load = () => {
    getApplications()
      .then(setApplications)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const moveStatus = async (appId, status) => {
    setUpdating(appId);
    try {
      await updateApplicationStatus(appId, status);
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
    } catch (e) {
      console.error(e);
    }
    setUpdating(null);
  };

  const handleManualCreate = async () => {
    if (!manualTitle.trim()) return;
    setCreating(true);
    try {
      const manualJobId = 'manual-' + Date.now();
      const result = await createApplication(manualJobId, manualStatus, manualTitle, manualCompany || 'Unknown Company');
      setApplications((prev) => [
        ...prev,
        {
          id: result.id || manualJobId,
          job_id: manualJobId,
          status: manualStatus,
          job_details: {
            title: manualTitle,
            company: manualCompany || 'Unknown Company',
          },
          created_at: new Date().toISOString(),
        },
      ]);
      setManualTitle('');
      setManualCompany('');
      setManualStatus('Saved');
      setShowManualForm(false);
    } catch (e) {
      console.error(e);
      alert('Failed to create application');
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="text-center p-10">
        <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  const byStatus = (status) => applications.filter((a) => a.status === status);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-slate-100">Application Tracker</h1>
          <p className="text-slate-500">Drag cards between columns or use the status menu — synced to MongoDB.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowManualForm(!showManualForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-teal-500/30 bg-teal-950/20 text-teal-300 hover:bg-teal-950/40 transition-all"
        >
          <Plus size={18} />
          {showManualForm ? 'Cancel' : 'Add Application'}
        </button>
      </div>

      {showManualForm && (
        <div className="card border-teal-500/30 mb-6">
          <h3 className="text-lg font-bold text-slate-100 mb-4">Manual Application Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Job Title *"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              className="input-field"
            />
            <input
              type="text"
              placeholder="Company Name"
              value={manualCompany}
              onChange={(e) => setManualCompany(e.target.value)}
              className="input-field"
            />
            <select
              value={manualStatus}
              onChange={(e) => setManualStatus(e.target.value)}
              className="input-field"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>{c.id}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={handleManualCreate}
              disabled={creating || !manualTitle.trim()}
              className="btn-primary flex-1 py-2 flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Add to Tracker'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowManualForm(false);
                setManualTitle('');
                setManualCompany('');
                setManualStatus('Saved');
              }}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="card text-center p-10 text-slate-500 border-dashed border-teal-500/30">
          No applications yet. Launch a workflow on any job or add manually.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className={`rounded-xl border p-3 min-h-[200px] ${col.color}`}>
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center justify-between">
                {col.id}
                <span className="text-xs text-slate-500 font-normal">{byStatus(col.id).length}</span>
              </h3>
              <div className="space-y-2">
                {byStatus(col.id).map((app) => (
                  <div key={app.id} className="rounded-lg border border-slate-700/80 bg-slate-950/80 p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="text-slate-600 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/jobs/${app.job_id}`} className="font-semibold text-slate-100 hover:text-teal-400 line-clamp-2">
                          {app.title || app.job_details?.title || 'Unknown Role'}
                        </Link>
                        <div className="flex items-center text-xs text-slate-500 mt-1 gap-1">
                          <Building size={12} />
                          {app.company || app.job_details?.company || 'Unknown'}
                        </div>
                        <div className="flex items-center text-xs text-slate-600 mt-1 gap-1">
                          <Calendar size={12} />
                          {app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}
                        </div>
                        <select
                          value={app.status}
                          disabled={updating === app.id}
                          onChange={(e) => moveStatus(app.id, e.target.value)}
                          className="mt-2 w-full text-xs rounded border border-slate-700 bg-slate-900 text-slate-300 py-1 px-2"
                        >
                          {COLUMNS.map((c) => (
                            <option key={c.id} value={c.id}>{c.id}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
