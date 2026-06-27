import React, { useEffect, useState } from 'react';
import { getApplications } from '../api';
import { Link } from 'react-router-dom';
import { Activity, Sparkles, CheckCircle2, ChevronRight, Briefcase } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5002';

export default function Dashboard() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await axios.post(`${API_URL}/dashboard/recommendations`, { limit: 17 });
        setRecommendations(res.data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchRecommendations();
  }, []);

  if (loading) return <div className="text-center p-10"><div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full mx-auto"></div></div>;

  return (
    <div className="space-y-6">
      
      {/* 1. AI Briefing */}
      <div className="bg-gradient-to-r from-accent/20 to-purple-500/20 border border-accent/30 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <Sparkles className="mr-3 text-accent" /> Good Morning, Anand
          </h1>
          <p className="text-lg text-slate-300 mt-2">
            Opportunity Scout found <span className="font-bold text-accent">{recommendations.length} new jobs</span> that fit your profile today.
          </p>
        </div>
        <div className="hidden md:block text-right">
            <div className="text-sm text-slate-400">Workflow State</div>
            <div className="text-accent font-bold">DISCOVERED</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 2. Opportunity Feed */}
        <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold flex items-center border-b border-slate-700 pb-2">
                Opportunity Feed
            </h2>
            {recommendations.length === 0 ? (
                <div className="card border-dashed border-accent/40 bg-slate-900/70">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-white">Launch the workflow from any job</h3>
                            <p className="text-sm text-slate-400 mt-1">The dashboard is ready. Open a job posting and start the Lemma workflow from the detail view.</p>
                        </div>
                        <Link to="/jobs" className="btn-primary whitespace-nowrap">Browse Jobs</Link>
                    </div>
                </div>
            ) : recommendations.slice(0, 5).map(rec => (
                <div key={rec.job_id} className="card hover:border-accent/50 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold group-hover:text-accent transition-colors">{rec.job_details?.title}</h3>
                            <p className="text-sm text-slate-400">{rec.job_details?.company}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-green-400">{rec.match_score}%</div>
                            <div className="text-xs text-slate-500">AI Match</div>
                        </div>
                    </div>
                    
                    <div className="mt-4 bg-slate-900/50 p-3 rounded border border-slate-700">
                        <div className="text-sm text-slate-300 font-semibold mb-1 flex items-center">
                            <Sparkles size={14} className="mr-1 text-purple-400" /> Scout Reasoning
                        </div>
                        <p className="text-xs text-slate-400 italic">"{rec.reason}"</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {rec.matched_skills?.map((s, i) => (
                                <span key={i} className="px-2 py-0.5 bg-green-900/30 text-green-400 border border-green-800 rounded text-[10px]">✓ {s}</span>
                            ))}
                            {rec.missing_skills?.map((s, i) => (
                                <span key={i} className="px-2 py-0.5 bg-orange-900/30 text-orange-400 border border-orange-800 rounded text-[10px]">Missing: {s}</span>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <Link to={`/jobs/${rec.job_id}`} className="btn-primary text-sm px-4 py-2">
                            Launch Workflow
                        </Link>
                    </div>
                </div>
            ))}
            <Link to="/jobs" className="text-center text-sm text-slate-400 block hover:text-white">View all {recommendations.length} opportunities...</Link>
        </div>

        {/* 3. AI Activity Runtime */}
        <div className="card h-fit sticky top-6 border-accent/20">
            <h2 className="text-xl font-bold border-b border-slate-700 pb-2 mb-4 flex items-center">
                <Activity size={18} className="mr-2 text-accent" /> AI Activity Runtime
            </h2>
            
            <div className="space-y-4">
                <div className="p-3 rounded bg-slate-800/50 border border-slate-700">
                    <div className="text-xs text-slate-500 mb-1">08:00 AM • Job Discovery Workflow</div>
                    <div className="flex items-center text-sm font-bold text-slate-200">
                        <CheckCircle2 size={16} className="text-green-500 mr-2" />
                        Opportunity Scout finished
                    </div>
                    <div className="text-xs text-slate-400 mt-1 pl-6">Analyzed 5000+ jobs against AI Memory.</div>
                </div>
                
                <div className="p-3 rounded bg-slate-800/50 border border-slate-700">
                    <div className="text-xs text-slate-500 mb-1">Yesterday • Application Workflow</div>
                    <div className="flex items-center text-sm font-bold text-slate-200">
                        <CheckCircle2 size={16} className="text-green-500 mr-2" />
                        Application Strategist approved
                    </div>
                    <div className="text-xs text-slate-400 mt-1 pl-6">Saved application for Amazon SDE.</div>
                </div>

                <div className="p-3 rounded bg-slate-900 border border-dashed border-slate-600 text-center">
                    <p className="text-sm text-slate-500 italic">Waiting for next workflow trigger...</p>
                </div>
            </div>
        </div>
      </div>

      {/* 4. Applications & Interviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
          <div className="card">
              <h2 className="text-lg font-bold flex items-center mb-4"><Briefcase className="mr-2 text-accent" size={18}/> Active Applications</h2>
              <div className="text-sm text-slate-400">View your Kanban board in the Applications tab.</div>
              <Link to="/applications" className="btn-secondary text-sm mt-4 inline-block">Go to Tracker</Link>
          </div>
          <div className="card">
              <h2 className="text-lg font-bold flex items-center mb-4"><Activity className="mr-2 text-purple-400" size={18}/> Interview Center</h2>
              <div className="text-sm text-slate-400">No interviews scheduled yet. Let Lemma agents secure one for you.</div>
          </div>
      </div>

    </div>
  );
}
