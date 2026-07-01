import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Briefcase, Building2, Loader2, Sparkles, Check, FileText, Plus } from 'lucide-react';
import JobCard from '../components/JobCard';
import { getJobs, getRecommendations, getMemory, uploadResume, saveResumeMemory } from '../api';

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [scoutScores, setScoutScores] = useState({});
  const [hasResume, setHasResume] = useState(false);
  const [scoutLoading, setScoutLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [experience, setExperience] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showHighMatchOnly, setShowHighMatchOnly] = useState(false);

  const [showManualInput, setShowManualInput] = useState(false);
  const [manualJobTitle, setManualJobTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualResume, setManualResume] = useState('');
  const [manualProcessing, setManualProcessing] = useState(false);

  const limit = 20;

  const loadScoutScores = async () => {
    setScoutLoading(true);
    try {
      const memory = await getMemory();
      const resume = memory?.resume_text?.trim();
      setHasResume(Boolean(resume));
      if (!resume) {
        setScoutScores({});
        setScoutLoading(false);
        return;
      }
      const recs = await getRecommendations(50);
      const map = {};
      recs.forEach((r) => {
        map[r.job_id] = {
          score: r.match_score,
          reason: r.reason,
          source: r.source || 'ai',
          matched_skills: r.matched_skills,
        };
      });
      setScoutScores(map);
    } catch (e) {
      console.error(e);
      setScoutScores({});
    } finally {
      setScoutLoading(false);
    }
  };

  useEffect(() => {
    // Check if user has resume, but don't auto-load scout scores
    getMemory().then((m) => {
      setHasResume(Boolean(m?.resume_text?.trim()));
    }).catch(() => {});
  }, []);

  const fetchJobs = async (reset = false) => {
    setLoading(true);
    try {
      const data = await getJobs({
        title,
        location,
        company: companyFilter,
        experience,
        page: reset ? 1 : page,
        limit,
      });

      const newJobs = data.jobs || data;
      const more = data.hasMore ?? false;

      if (reset) {
        setJobs(newJobs);
        setPage(2);
      } else {
        setJobs((prev) => [...prev, ...newJobs]);
        setPage((prev) => prev + 1);
      }
      setHasMore(more);
      setTotal(data.total ?? newJobs.length);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchJobs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, location, experience, companyFilter]);

  const handleLoadMore = () => {
    if (!loading && hasMore) fetchJobs(false);
  };

  const handleManualJobSubmit = async () => {
    if (!manualJobTitle.trim() || !manualDescription.trim()) return;
    setManualProcessing(true);
    try {
      if (manualResume.trim()) {
        await uploadResume(manualResume);
        await saveResumeMemory({ resume_text: manualResume });
      }
      const manualJob = {
        id: 'manual-' + Date.now(),
        title: manualJobTitle,
        company: manualCompany || 'Unknown Company',
        description: manualDescription,
        location: 'Not specified',
        experience: 'Not specified',
        is_manual: true,
      };
      localStorage.setItem(manualJob.id, JSON.stringify(manualJob));
      navigate(`/jobs/${manualJob.id}`, {
        state: { manualJob, resumeText: manualResume || undefined },
      });
    } catch (err) {
      console.error('Manual job processing failed:', err);
      alert('Failed to process job description');
    }
    setManualProcessing(false);
  };

  const displayedJobs = useMemo(() => {
    if (!showHighMatchOnly) return jobs;
    return jobs
      .filter((job) => (scoutScores[job.id]?.score ?? 0) >= 70)
      .sort((a, b) => (scoutScores[b.id]?.score ?? 0) - (scoutScores[a.id]?.score ?? 0));
  }, [jobs, showHighMatchOnly, scoutScores]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-slate-950 via-violet-950/40 to-teal-950/30 p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.15),transparent_50%)]" />
        <div className="relative max-w-5xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Discover Your Next Role
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-violet-300 mt-1">
              Opportunity Scout Rankings
            </span>
          </h1>
          <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
            {hasResume
              ? 'Match scores come from the Opportunity Scout agent (Lemma or Gemini) — not estimates.'
              : 'Upload your resume to enable real AI match scores from Opportunity Scout.'}
          </p>

          <div className="bg-surface/80 backdrop-blur-md rounded-2xl border border-slate-700/80 p-3 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="text" placeholder="Job title or keyword" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field pl-12" />
              </div>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="text" placeholder="Company name" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="input-field pl-12" />
              </div>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="text" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="input-field pl-12" />
              </div>
              <div className="relative">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="text" placeholder="Experience level" value={experience} onChange={(e) => setExperience(e.target.value)} className="input-field pl-12" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-4 text-sm text-teal-300/80">
            {scoutLoading ? (
              <><Loader2 size={14} className="animate-spin" /> Running Opportunity Scout...</>
            ) : (
              <>
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
                <span>{total || jobs.length} positions • {Object.keys(scoutScores).length} AI-scored</span>
              </>
            )}
            {hasResume && !scoutLoading && Object.keys(scoutScores).length === 0 && (
              <button
                type="button"
                onClick={loadScoutScores}
                className="px-3 py-1 rounded-lg border border-teal-500/30 bg-teal-950/20 hover:bg-teal-950/40 transition-all"
              >
                Load AI Scores
              </button>
            )}
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-violet-500/30 bg-violet-950/20 text-violet-300 hover:bg-violet-950/40 transition-all text-sm"
            >
              <Plus size={16} />
              {showManualInput ? 'Cancel' : 'Paste Job Description'}
            </button>
          </div>

          {showManualInput && (
            <div className="mt-4 card border-violet-500/30">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                <FileText size={18} className="text-violet-400" />
                Manual Job Input
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Job Title *"
                    value={manualJobTitle}
                    onChange={(e) => setManualJobTitle(e.target.value)}
                    className="input-field"
                  />
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                    className="input-field"
                  />
                </div>
                <textarea
                  placeholder="Paste job description here *"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className="input-field min-h-[150px]"
                />
                <textarea
                  placeholder="Paste your resume (optional - will use saved resume if empty)"
                  value={manualResume}
                  onChange={(e) => setManualResume(e.target.value)}
                  className="input-field min-h-[100px]"
                />
                <button
                  type="button"
                  onClick={handleManualJobSubmit}
                  disabled={manualProcessing || !manualJobTitle.trim() || !manualDescription.trim()}
                  className="btn-primary w-full py-3 flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {manualProcessing ? (
                    <><Loader2 size={18} className="animate-spin" /> Processing...</>
                  ) : (
                    <><Sparkles size={18} /> Analyze Job</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100">
              {showHighMatchOnly ? 'Top Scout Matches (70%+)' : 'Latest Opportunities'}
            </h2>
            <p className="text-slate-500 mt-1">
              {loading && jobs.length === 0 ? 'Loading...' : `${displayedJobs.length} positions shown`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHighMatchOnly(!showHighMatchOnly)}
            disabled={!hasResume}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all disabled:opacity-40 ${
              showHighMatchOnly
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-surface border-slate-700 text-slate-300 hover:border-violet-500/40'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="font-medium text-sm">High Match Only</span>
            {showHighMatchOnly && <Check className="w-4 h-4" />}
          </button>
        </div>

        {loading && jobs.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse h-64 bg-slate-900/50" />
            ))}
          </div>
        ) : displayedJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedJobs.map((job, idx) => (
              <JobCard 
                key={job.id ?? idx} 
                job={job} 
                scoutMatch={scoutScores[job.id]} 
                hasResume={hasResume} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 card border-dashed border-violet-500/30">
            <Sparkles className="w-10 h-10 text-violet-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-100 mb-2">No matching jobs found</h3>
            <p className="text-slate-500">
              {showHighMatchOnly ? 'No jobs scored 70%+ yet. Upload resume or clear filter.' : 'Try adjusting your search criteria.'}
            </p>
          </div>
        )}

        {hasMore && !showHighMatchOnly && (
          <div className="mt-12 text-center">
            <button type="button" onClick={handleLoadMore} disabled={loading} className="btn-primary px-8 py-3 inline-flex items-center gap-2">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</> : 'Load More Jobs'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
