import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Sparkles, CheckCircle2, Briefcase, Radio, Clock,
  TrendingUp, Target, Zap, BarChart3, ExternalLink, Calendar as CalendarIcon,
  ListTodo, UserCheck, Play, ArrowRight, Check, Send, AlertTriangle, RefreshCw,
  Lightbulb
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRecommendations, getWorkflowEvents, getAnalytics, getLemmaStatus, getAIInsights } from '../api';

const eventIcon = (type) => {
  if (type?.includes('workflow')) return <Radio className="text-teal-400" size={16} />;
  if (type?.includes('application')) return <Briefcase className="text-emerald-400" size={16} />;
  if (type?.includes('resume')) return <CheckCircle2 className="text-cyan-400" size={16} />;
  if (type?.includes('agent')) return <Sparkles className="text-violet-400" size={16} />;
  if (type?.includes('connector')) {
    if (type?.includes('calendar')) return <CalendarIcon className="text-teal-400" size={16} />;
    if (type?.includes('tasks')) return <ListTodo className="text-violet-400" size={16} />;
    if (type?.includes('gmail')) return <Send className="text-rose-400" size={16} />;
  }
  return <Activity className="text-slate-400" size={16} />;
};

const CHART_COLORS = {
  saved: 'from-slate-500 to-slate-400',
  applied: 'from-cyan-500 to-teal-400',
  interview: 'from-violet-500 to-purple-400',
  offer: 'from-emerald-500 to-green-400',
  rejected: 'from-rose-500 to-red-400',
};

function StatBar({ label, value, max, colorClass, icon: Icon }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-400">
          {Icon && <Icon size={14} className="text-teal-400" />}
          {label}
        </span>
        <span className="font-semibold text-slate-200">{value}</span>
      </div>
      <div className="stat-bar">
        <div
          className={`stat-bar-fill bg-gradient-to-r ${colorClass}`}
          style={{ width: `${Math.max(pct, value > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [lemmaStatus, setLemmaStatus] = useState(null);
  const [loading, setLoading] = useState(!localStorage.getItem('dashboard_cache'));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const load = async () => {
    if (!loading) {
      setIsRefreshing(true);
    }
    setInsightsLoading(true);
    try {
      const [recs, evts, stats, lemma] = await Promise.all([
        getRecommendations(8),
        getWorkflowEvents(),
        getAnalytics(),
        getLemmaStatus(),
      ]);
      setRecommendations(recs);
      setEvents(evts);
      setAnalytics(stats);
      setLemmaStatus(lemma);
      setLoading(false);
      setIsRefreshing(false);

      // Cache dashboard data immediately (without insights)
      const cachedInsights = JSON.parse(localStorage.getItem('dashboard_cache') || '{}')?.insights || [];
      localStorage.setItem('dashboard_cache', JSON.stringify({
        recs, evts, stats, lemma, insights: cachedInsights, timestamp: Date.now()
      }));
    } catch (e) {
      console.error(e);
      setLoading(false);
      setIsRefreshing(false);
    }

    // Load insights independently (don't block the dashboard)
    try {
      const insightsRes = await getAIInsights();
      const newInsights = insightsRes?.insights || [];
      setInsights(newInsights);
      // Update cache with insights
      try {
        const cached = JSON.parse(localStorage.getItem('dashboard_cache') || '{}');
        cached.insights = newInsights;
        localStorage.setItem('dashboard_cache', JSON.stringify(cached));
      } catch (_) {}
    } catch (e) {
      console.error('Failed to load AI insights:', e);
    }
    setInsightsLoading(false);
  };

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem('dashboard_cache');
      if (cached) {
        const { recs, evts, stats, lemma, insights: cachedInsights, timestamp } = JSON.parse(cached);
        if (!cachedInsights) return false;
        // Use cache if less than 5 minutes old
        if (Date.now() - timestamp < 300000) {
          setRecommendations(recs);
          setEvents(evts);
          setAnalytics(stats);
          setLemmaStatus(lemma);
          setInsights(cachedInsights || []);
          setInsightsLoading(false);
          setLoading(false);
          return true;
        }
      }
    } catch (e) {
      console.error('Failed to load from cache:', e);
    }
    return false;
  };

  useEffect(() => {
    // Try to load from cache first
    if (!loadFromCache()) {
      load();
    }
    // No auto-refresh interval - only load on mount or manual refresh
  }, []);
  if (loading) {
    return (
      <div className="text-center p-20">
        <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-slate-500 mt-3 font-semibold">Initializing Mission Control...</p>
      </div>
    );
  }

  const metrics = analytics?.metrics || {};
  const maxMetric = Math.max(...Object.values(metrics), 1);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-slate-950 via-violet-950/30 to-teal-950/20 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Sparkles className="text-teal-400" /> Mission Control
            <button
              onClick={() => { localStorage.removeItem('dashboard_cache'); load(); }}
              disabled={isRefreshing}
              className="ml-4 text-xs px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin text-teal-400" : ""} />
              {isRefreshing ? "Updating..." : "Refresh"}
            </button>
          </h1>
          <p className="text-lg text-slate-400 mt-2">
            Welcome back, {user?.name}.{' '}
            {lemmaStatus?.connected ? (
              <>
                <span className="text-teal-400 font-semibold">Lemma runtime online</span>
                {' '}— {lemmaStatus.agent_count} core agents ready on pod {lemmaStatus.pod_id?.slice(0, 8)}…
              </>
            ) : lemmaStatus?.gemini_configured ? (
              <>
                <span className="text-amber-400">Lemma offline</span>
                {' '}— recommendations & workflows use your <span className="text-teal-400">GEMINI_API_KEY</span>.
              </>
            ) : (
              <span className="text-rose-400 font-semibold">agent loading</span>
            )}
          </p>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Applications', value: analytics?.total_applications ?? 0, icon: Briefcase, color: 'text-teal-400' },
              { label: 'Saved', value: metrics.saved ?? 0, icon: Target, color: 'text-violet-400' },
              { label: 'Lemma Agents', value: lemmaStatus?.agent_count ?? 0, icon: Zap, color: 'text-cyan-400' },
              { label: 'Opportunities', value: recommendations.length, icon: TrendingUp, color: 'text-emerald-400' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-slate-900/60 border border-slate-700/60 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <stat.icon size={14} className={stat.color} />
                  {stat.label}
                </div>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Feed and Simulator */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Application Pipeline Funnel */}
          <div className="card border-teal-500/20 bg-slate-950/40 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 className="text-teal-400" size={18} />
                Application Pipeline Funnel
              </h2>
              <span className="text-[10px] text-teal-400 font-mono px-2 py-0.5 rounded border border-teal-800 bg-teal-950/20">CONVERSION RATES</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                { stage: 'Saved', value: metrics.saved ?? 0, pct: 100, color: 'from-slate-600 to-slate-500', desc: 'Identified matches' },
                { 
                  stage: 'Applied', 
                  value: metrics.applied ?? 0, 
                  pct: Math.round(((metrics.applied ?? 0) / (metrics.saved || 1)) * 100), 
                  color: 'from-cyan-500 to-blue-600', 
                  desc: 'Submitted resumes' 
                },
                { 
                  stage: 'Interview', 
                  value: metrics.interview ?? 0, 
                  pct: Math.round(((metrics.interview ?? 0) / (metrics.applied || 1)) * 100), 
                  color: 'from-violet-500 to-fuchsia-600', 
                  desc: 'Active discussions' 
                },
                { 
                  stage: 'Offer', 
                  value: metrics.offer ?? 0, 
                  pct: Math.round(((metrics.offer ?? 0) / (metrics.interview || 1)) * 100), 
                  color: 'from-emerald-500 to-teal-500', 
                  desc: 'Secured positions' 
                }
              ].map((item, idx) => (
                <div key={item.stage} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-slate-700/60 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all" />
                  <div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold uppercase tracking-wider">{item.stage}</span>
                      <span className="text-[10px] text-teal-400 font-bold bg-teal-950/40 px-1.5 py-0.5 rounded border border-teal-800/30">
                        {idx === 0 ? 'Base' : `${item.pct}% conversion`}
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-100 mt-2">{item.value}</div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">{item.desc}</p>
                  </div>
                  {/* Visual conversion bar */}
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`} 
                      style={{ width: `${Math.min(idx === 0 ? 100 : item.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Career Insights & Recommendations */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Lightbulb size={20} className="text-teal-400" />
              AI Career Insights & Recommendations
            </h2>
            {insightsLoading ? (
              <div className="card space-y-4 border-teal-500/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="animate-spin h-4 w-4 border-2 border-teal-500 border-t-transparent rounded-full" />
                  <span className="text-xs text-teal-400 font-semibold animate-pulse">Generating personalized insights from Lemma AI agent…</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-slate-700/40 bg-slate-900/50 p-4 space-y-3">
                      <div className="flex justify-between">
                        <div className="h-3 bg-slate-800 rounded w-16"></div>
                        <div className="h-3 bg-slate-800 rounded w-20"></div>
                      </div>
                      <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                      <div className="space-y-2">
                        <div className="h-2 bg-slate-800 rounded"></div>
                        <div className="h-2 bg-slate-800 rounded w-5/6"></div>
                      </div>
                      <div className="h-8 bg-slate-800/60 rounded-xl"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : insights.length === 0 ? (
              <div className="card text-center py-6 border-dashed border-slate-800">
                <p className="text-xs text-slate-500 leading-normal">
                  No active insights. Customize your resume and save/apply to jobs to generate tailored recommendations.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((ins) => {
                  const statusLower = ins.status?.toLowerCase();
                  const isSaved = statusLower === 'saved';
                  const isApplied = statusLower === 'applied';
                  const isInterview = statusLower === 'interviewing' || statusLower === 'interview';
                  const isRejected = statusLower === 'rejected';
                  
                  const statusColors = isSaved
                    ? 'border-cyan-500/30 bg-cyan-950/20 text-cyan-400'
                    : isApplied
                    ? 'border-teal-500/30 bg-teal-950/20 text-teal-400'
                    : isInterview
                    ? 'border-violet-500/30 bg-violet-950/20 text-violet-400'
                    : isRejected
                    ? 'border-rose-500/30 bg-rose-950/20 text-rose-400'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400';
                    
                  return (
                    <div key={ins.id} className="card hover:border-teal-500/20 transition-all flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-2">
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${statusColors}`}>
                            {ins.status || 'General'}
                          </span>
                          <span className="text-slate-500 font-semibold truncate max-w-[120px]">
                            {ins.company && ins.company !== 'CareerOS' ? `${ins.company}` : ''}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-200 line-clamp-1">{ins.title || 'General Guideline'}</h4>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">&ldquo;{ins.insight}&rdquo;</p>
                      </div>
                      <div>
                        <Link
                          to={ins.action_url}
                          className="w-full mt-2 py-2 px-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
                        >
                          <Sparkles size={11} className="text-teal-400" />
                          {ins.action_label || 'Go to Action'}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Opportunity Feed */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp size={20} className="text-teal-400" />
              Opportunity Feed
            </h2>
            {recommendations.length === 0 ? (
              <div className="card border-dashed border-teal-500/30 text-center py-6">
                <p className="text-slate-400 mb-4">Customize your resume in the Resume Hub to begin tailoring matching suggestions against saved roles.</p>
                <Link to="/resume" className="btn-primary inline-block">Go to Resume Hub</Link>
              </div>
            ) : (
              recommendations.slice(0, 5).map((rec) => (
                <div key={rec.job_id} className="card hover:border-teal-500/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">{rec.job_details?.title}</h3>
                      <p className="text-sm text-slate-500">{rec.job_details?.company}</p>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">{rec.match_score}%</div>
                  </div>
                  <p className="text-xs text-slate-500 italic mt-2">&ldquo;{rec.reason}&rdquo;</p>
                  {rec.matched_skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rec.matched_skills.slice(0, 4).map((s) => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-teal-950/50 text-teal-300 border border-teal-800/40">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Link to={`/jobs/${rec.job_id}`} className="btn-primary text-xs flex-1 text-center py-2 flex items-center justify-center gap-1.5">
                      <Sparkles size={12} /> Launch Workflow
                    </Link>
                    {(rec.job_details?.apply_link || rec.job_details?.apply_url) && (
                      <a
                        href={rec.job_details.apply_link || rec.job_details.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 transition-all flex items-center gap-1 hover:text-white border border-slate-700 bg-slate-800 hover:bg-slate-700 shadow-sm"
                      >
                        <ExternalLink size={12} /> Apply Direct
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Analytics & Chronological Timeline */}
        <div className="space-y-6">
          
          {/* Pipeline stats */}
          <div className="card border-violet-500/20">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-100">
              <BarChart3 className="text-violet-400" size={18} />
              Pipeline Analytics
            </h2>
            <div className="space-y-4">
              <StatBar label="Saved" value={metrics.saved ?? 0} max={maxMetric} colorClass={CHART_COLORS.saved} />
              <StatBar label="Applied" value={metrics.applied ?? 0} max={maxMetric} colorClass={CHART_COLORS.applied} icon={Briefcase} />
              <StatBar label="Interview" value={metrics.interview ?? 0} max={maxMetric} colorClass={CHART_COLORS.interview} icon={Radio} />
              <StatBar label="Offers" value={metrics.offer ?? 0} max={maxMetric} colorClass={CHART_COLORS.offer} icon={CheckCircle2} />
              <StatBar label="Rejected" value={metrics.rejected ?? 0} max={maxMetric} colorClass={CHART_COLORS.rejected} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700/60 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-teal-950/30 border border-teal-800/30 p-3">
                <div className="text-xs text-slate-500">Interview Rate</div>
                <div className="text-xl font-bold text-teal-400">{analytics?.interview_rate ?? 0}%</div>
              </div>
              <div className="rounded-lg bg-violet-950/30 border border-violet-800/30 p-3">
                <div className="text-xs text-slate-500">Offer Rate</div>
                <div className="text-xl font-bold text-violet-400">{analytics?.offer_rate ?? 0}%</div>
              </div>
            </div>
          </div>

          {/* Chronological live timeline feed */}
          <div className="card border-teal-500/20 sticky top-6">
            <h2 className="text-lg font-bold border-b border-slate-700/60 pb-3 mb-4 flex items-center gap-2 text-slate-100">
              <Activity className="text-teal-400" size={18} />
              Career Timeline Feed
            </h2>
            <div className="space-y-3 max-h-[380px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No events yet. Paste resume and match to start.</p>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/60 text-xs">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
                      <Clock size={11} />
                      {ev.created_at ? new Date(ev.created_at).toLocaleString() : 'Just now'}
                      {ev.agent && <span className="text-teal-400 font-semibold">• {ev.agent}</span>}
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">{eventIcon(ev.event_type)}</div>
                      <div>
                        <div className="font-bold text-slate-200">{ev.event_type?.toUpperCase()}</div>
                        <div className="text-slate-400 mt-0.5 leading-relaxed">{ev.message}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
