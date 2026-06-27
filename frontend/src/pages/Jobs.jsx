import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJobs } from '../api';
import { MapPin, Building, Clock } from 'lucide-react';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJobs().then((data) => {
      setJobs(data);
      setLoading(false);
    });
  }, []);

  const formatLocation = (loc) => {
    if (typeof loc === 'string') return loc;
    if (loc && typeof loc === 'object') {
      return [loc.city, loc.region, loc.countryName].filter(Boolean).join(', ');
    }
    return 'Remote / Unspecified';
  };

  if (loading) return <div className="text-center p-10"><div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full mx-auto"></div></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Latest Job Postings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <div key={job.id} className="card hover:-translate-y-1 transition-transform cursor-pointer flex flex-col justify-between">
            <div>
              <div className="flex items-center mb-4">
                {job.logo ? (
                  <img src={job.logo} alt={job.company} className="h-10 w-10 rounded-full object-cover mr-4" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-slate-600 flex items-center justify-center mr-4 font-bold">
                    {job.company ? job.company.charAt(0) : 'C'}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold line-clamp-1">{job.title || 'Unknown Role'}</h3>
                  <p className="text-slate-400 flex items-center text-sm"><Building size={14} className="mr-1"/> {job.company}</p>
                </div>
              </div>
              <div className="text-sm text-slate-300 space-y-2 mb-4">
                <p className="flex items-center"><MapPin size={16} className="mr-2 text-slate-400" /> {formatLocation(job.location)}</p>
                {job.experience && <p className="flex items-center"><Clock size={16} className="mr-2 text-slate-400" /> {job.experience}</p>}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Link to={`/jobs/${job.id}`} className="btn-primary block text-center w-full">
                Launch Workflow
              </Link>
              <Link to={`/jobs/${job.id}`} className="text-sm text-slate-400 text-center block hover:text-white">
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
