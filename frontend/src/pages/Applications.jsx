import React, { useEffect, useState } from 'react';
import { getApplications } from '../api';
import { Building, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApplications().then(data => {
      setApplications(data);
      setLoading(false);
    }).catch(console.error);
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case 'Saved': return 'bg-slate-700 text-slate-300';
      case 'Applied': return 'bg-blue-900/50 text-blue-300 border border-blue-700';
      case 'Interview': return 'bg-purple-900/50 text-purple-300 border border-purple-700';
      case 'Offer': return 'bg-green-900/50 text-green-300 border border-green-700';
      case 'Rejected': return 'bg-red-900/50 text-red-300 border border-red-700';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  if (loading) return <div className="text-center p-10"><div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full mx-auto"></div></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Application Tracker</h1>
      <div className="grid gap-4">
        {applications.length === 0 ? (
          <div className="card text-center p-10 text-slate-400">No applications tracked yet. Start browsing jobs!</div>
        ) : (
          applications.map(app => (
            <div key={app.id} className="card flex items-center justify-between hover:bg-slate-800 transition-colors">
              <div className="flex items-center">
                 <div className="h-12 w-12 rounded bg-slate-700 flex items-center justify-center font-bold text-xl mr-4">
                   {app.job_details?.company?.charAt(0) || 'C'}
                 </div>
                 <div>
                   <Link to={`/jobs/${app.job_id}`} className="text-xl font-bold hover:text-accent transition-colors">
                     {app.job_details?.title || 'Unknown Role'}
                   </Link>
                   <div className="flex items-center text-sm text-slate-400 mt-1">
                     <Building size={14} className="mr-1" /> {app.job_details?.company || 'Unknown'}
                     <span className="mx-2">•</span>
                     <Calendar size={14} className="mr-1" /> {new Date(app.created_at).toLocaleDateString()}
                   </div>
                 </div>
              </div>
              <div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(app.status)}`}>
                  {app.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
