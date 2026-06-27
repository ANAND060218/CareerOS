import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createApplication, getJob, runLemmaWorkflow, saveResumeMemory, uploadResume } from '../api';
import { ArrowLeft, Briefcase, MapPin, Calendar, CheckCircle2, Loader2, Sparkles, AlertCircle, FileText, UserCircle2, History } from 'lucide-react';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [workflowState, setWorkflowState] = useState('IDLE'); // IDLE, RUNNING, APPROVAL_NEEDED, COMPLETE
  const [activeStep, setActiveStep] = useState(0);
  const [resumeText, setResumeText] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('careeros_resume') || '';
    }
    return '';
  });
  const [workflowResult, setWorkflowResult] = useState(null);
  const [workflowError, setWorkflowError] = useState('');
  const [profile, setProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('careeros_profile');
      return saved ? JSON.parse(saved) : { name: 'Anand', role: 'Software Engineer', focus: 'Backend & AI' };
    }
    return { name: 'Anand', role: 'Software Engineer', focus: 'Backend & AI' };
  });
  const [activityLog, setActivityLog] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('careeros_activity_log');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await getJob(id);
        setJob(res);
      } catch (e) {
        console.error(e);
      }
    };
    fetchJob();
  }, [id]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('careeros_resume', resumeText);
    }
  }, [resumeText]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('careeros_profile', JSON.stringify(profile));
    }
  }, [profile]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('careeros_activity_log', JSON.stringify(activityLog));
    }
  }, [activityLog]);

  const startWorkflow = async () => {
    if (!resumeText.trim()) {
      setWorkflowError('Paste your resume first so the workflow can analyze it.');
      return;
    }

    setWorkflowState('RUNNING');
    setWorkflowError('');
    setWorkflowResult(null);
    setActiveStep(1);
    setActivityLog((prev) => [
      { id: Date.now(), type: 'info', message: `Started workflow for ${job?.title || 'this role'}` },
      ...prev.slice(0, 4)
    ]);

    try {
      await uploadResume(resumeText);
      await saveResumeMemory(resumeText);
      setActivityLog((prev) => [
        { id: Date.now() + 1, type: 'success', message: 'Resume saved and memory updated' },
        ...prev.slice(0, 4)
      ]);

      const workflowData = await runLemmaWorkflow(resumeText, job.description || '', job.company || '');

      setActiveStep(2);
      setActivityLog((prev) => [
        { id: Date.now() + 2, type: 'success', message: `Agent run completed with ${workflowData?.match_result?.match_score ?? 0}% match` },
        ...prev.slice(0, 4)
      ]);
      setWorkflowResult({
        matchScore: workflowData?.match_result?.match_score ?? 0,
        strengths: workflowData?.match_result?.strengths ?? [],
        missingSkills: workflowData?.match_result?.missing_skills ?? [],
        reasoning: workflowData?.match_result?.reasoning ?? 'Analysis complete.',
        optimizedResume: workflowData?.optimize_result?.optimized_resume ?? resumeText,
        suggestions: workflowData?.optimize_result?.ats_suggestions ?? [],
        keywords: workflowData?.optimize_result?.keyword_suggestions ?? [],
        agents: workflowData?.agents ?? []
      });

      await createApplication(job.id, 'Saved');
      setActiveStep(3);
      setWorkflowState('APPROVAL_NEEDED');
      setActivityLog((prev) => [
        { id: Date.now() + 3, type: 'success', message: 'Application strategist prepared the next action' },
        ...prev.slice(0, 4)
      ]);
    } catch (e) {
      console.error(e);
      setWorkflowError('The workflow could not complete. Please verify the backend is running.');
      setWorkflowState('IDLE');
      setActiveStep(0);
      setActivityLog((prev) => [
        { id: Date.now() + 4, type: 'error', message: 'Workflow failed. Backend check required.' },
        ...prev.slice(0, 4)
      ]);
    }
  };

  const approveApplication = async () => {
    try {
      await createApplication(job.id, 'Applied');
      setWorkflowState('COMPLETE');
      setActivityLog((prev) => [
        { id: Date.now() + 5, type: 'success', message: 'Application approved and saved to your tracker' },
        ...prev.slice(0, 4)
      ]);
    } catch (e) {
      console.error(e);
      setWorkflowError('The application could not be saved.');
    }
  };

  if (!job) return <div className="text-center p-10"><Loader2 className="animate-spin h-10 w-10 text-accent mx-auto" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white flex items-center mb-4">
        <ArrowLeft size={16} className="mr-2" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
        {/* Left: Job Details */}
        <div className="lg:col-span-2 space-y-6">
            <div className="card">
                <h1 className="text-3xl font-bold">{job.title}</h1>
                <div className="text-xl text-accent mt-1">{job.company}</div>
                
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-400">
                    <span className="flex items-center"><MapPin size={16} className="mr-1" /> {job.location || 'Remote'}</span>
                    <span className="flex items-center"><Briefcase size={16} className="mr-1" /> {job.experience || 'Any'}</span>
                    <span className="flex items-center"><Calendar size={16} className="mr-1" /> {new Date(job.date_posted).toLocaleDateString()}</span>
                </div>

                <div className="mt-6">
                    <h2 className="text-lg font-bold mb-2">Technologies</h2>
                    <div className="flex flex-wrap gap-2">
                        {job.technologies?.map((t, i) => (
                            <span key={i} className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300 border border-slate-700">{t}</span>
                        ))}
                    </div>
                </div>

                <div className="mt-6 border-t border-slate-700 pt-6">
                    <h2 className="text-lg font-bold mb-2">Job Description</h2>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{job.description}</p>
                </div>
            </div>
        </div>

        {/* Right: Lemma Workflow Runtime */}
        <div className="space-y-4">
            <div className="card border-accent/30 bg-slate-900/80 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center">
                        <Sparkles className="text-accent mr-2" size={20} /> Application Workflow
                    </h2>
                    <div className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent">
                        Lemma Copilot
                    </div>
                </div>

                <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                    <div className="flex items-center text-sm text-slate-300">
                        <UserCircle2 size={16} className="mr-2 text-accent" />
                        <span className="font-semibold">{profile.name}</span>
                        <span className="ml-2 text-slate-500">• {profile.role}</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">Focus: {profile.focus}</div>
                </div>

                {workflowState === 'IDLE' && (
                    <div className="space-y-4 py-2">
                        <div className="flex items-center text-sm text-slate-300"><FileText size={16} className="mr-2 text-accent" /> Paste your resume to run a real workflow.</div>
                        <textarea
                            value={resumeText}
                            onChange={(e) => setResumeText(e.target.value)}
                            placeholder="Paste your resume text here..."
                            className="w-full min-h-[180px] rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-sm text-slate-300 focus:outline-none focus:border-accent"
                        />
                        <p className="text-xs text-slate-400">The workflow will save your resume, score it against this role, and generate an optimized version using the live backend AI service.</p>
                        {workflowError && <div className="rounded border border-red-600/40 bg-red-950/40 p-2 text-xs text-red-300">{workflowError}</div>}
                        <button onClick={startWorkflow} className="btn-primary w-full py-3">
                            Launch Workflow
                        </button>
                    </div>
                )}

                {workflowState !== 'IDLE' && (
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-0.5 before:bg-slate-700">
                        
                        {/* Agent 1: Resume Match */}
                        <div className="relative flex items-center justify-between">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-slate-900 z-10 ${activeStep >= 1 ? 'border-green-500 text-green-500' : 'border-slate-600 text-slate-600'}`}>
                                {activeStep >= 1 ? <CheckCircle2 size={14} /> : <Loader2 size={12} className="animate-spin" />}
                            </div>
                            <div className="w-[calc(100%-2.5rem)] p-3 rounded bg-slate-800/50 border border-slate-700">
                                <div className="font-bold text-sm text-slate-200">Resume Match</div>
                                {activeStep >= 1 && <div className="text-xs text-green-400 mt-1">Live scoring complete against this job.</div>}
                            </div>
                        </div>

                        {/* Agent 2: Resume Optimizer */}
                        <div className="relative flex items-center justify-between">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-slate-900 z-10 ${activeStep >= 2 ? 'border-green-500 text-green-500' : (activeStep >= 1 ? 'border-accent text-accent' : 'border-slate-600 text-slate-600')}`}>
                                {activeStep >= 2 ? <CheckCircle2 size={14} /> : (activeStep >= 1 ? <Loader2 size={12} className="animate-spin" /> : <div className="w-2 h-2 rounded-full bg-slate-600"></div>)}
                            </div>
                            <div className="w-[calc(100%-2.5rem)] p-3 rounded bg-slate-800/50 border border-slate-700">
                                <div className="font-bold text-sm text-slate-200">Resume Optimizer</div>
                                {activeStep >= 2 && <div className="text-xs text-accent mt-1">Generated an ATS-friendly rewrite for this role.</div>}
                            </div>
                        </div>

                        {/* Agent 3: Application Strategist */}
                        <div className="relative flex items-center justify-between">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-slate-900 z-10 ${activeStep >= 3 ? 'border-orange-500 text-orange-500' : (activeStep >= 2 ? 'border-purple-500 text-purple-500' : 'border-slate-600 text-slate-600')}`}>
                                {activeStep >= 3 ? <AlertCircle size={14} /> : (activeStep >= 2 ? <Loader2 size={12} className="animate-spin" /> : <div className="w-2 h-2 rounded-full bg-slate-600"></div>)}
                            </div>
                            <div className="w-[calc(100%-2.5rem)] p-3 rounded bg-slate-800/50 border border-slate-700">
                                <div className="font-bold text-sm text-slate-200">Application Strategist</div>
                                {activeStep >= 3 && (
                                    <div className="mt-2">
                                        {workflowResult && (
                                            <div className="space-y-2 text-xs text-slate-300">
                                                <div className="font-semibold text-white">Match score: {workflowResult.matchScore}%</div>
                                                <div>Reasoning: {workflowResult.reasoning}</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {workflowResult.strengths.slice(0, 4).map((skill, i) => (
                                                        <span key={i} className="rounded border border-green-700/50 bg-green-900/30 px-2 py-0.5 text-green-300">{skill}</span>
                                                    ))}
                                                </div>
                                                {workflowResult.missingSkills.length > 0 && (
                                                    <div className="text-orange-300">Suggested additions: {workflowResult.missingSkills.slice(0, 3).join(', ')}</div>
                                                )}
                                            </div>
                                        )}
                                        {workflowState === 'APPROVAL_NEEDED' && (
                                            <button onClick={approveApplication} className="btn-primary mt-3 w-full py-2 text-sm bg-orange-600 hover:bg-orange-700">Approve & Apply</button>
                                        )}
                                        {workflowState === 'COMPLETE' && (
                                            <div className="text-xs text-green-400 font-bold flex items-center mt-2"><CheckCircle2 size={14} className="mr-1" /> Approved</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {workflowState === 'COMPLETE' && (
                            <div className="mt-6 p-4 bg-green-900/20 border border-green-500/50 rounded-lg text-center animate-fade-in">
                                <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                                <h3 className="text-green-400 font-bold">Application Saved</h3>
                                <p className="text-xs text-slate-400 mt-1">Interview Coach is preparing your study plan.</p>
                            </div>
                        )}

                        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                            <div className="mb-2 flex items-center text-sm font-semibold text-slate-200">
                                <History size={14} className="mr-2 text-accent" /> Agent Activity
                            </div>
                            <div className="space-y-2 text-xs text-slate-400">
                                {activityLog.length === 0 ? (
                                    <div>No activity yet.</div>
                                ) : activityLog.map((entry) => (
                                    <div key={entry.id} className={`rounded border px-2 py-2 ${entry.type === 'error' ? 'border-red-700/40 bg-red-950/30 text-red-300' : entry.type === 'success' ? 'border-green-700/40 bg-green-950/20 text-green-300' : 'border-slate-700 bg-slate-900/60 text-slate-300'}`}>
                                        {entry.message}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
