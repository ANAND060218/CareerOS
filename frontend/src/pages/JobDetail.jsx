import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJob, optimizeResume } from '../api';
import { ArrowLeft, Briefcase, MapPin, Calendar, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [workflowState, setWorkflowState] = useState('IDLE'); // IDLE, RUNNING, APPROVAL_NEEDED, COMPLETE
  const [activeStep, setActiveStep] = useState(0);

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

  const startWorkflow = () => {
    setWorkflowState('RUNNING');
    
    // Simulate Lemma Agent Parallel Execution
    setTimeout(() => setActiveStep(1), 1500); // Job Matcher Done
    setTimeout(() => setActiveStep(2), 3000); // Resume Advisor Done
    setTimeout(() => setActiveStep(3), 4500); // Career Mentor Done
    setTimeout(() => {
        setActiveStep(4);
        setWorkflowState('APPROVAL_NEEDED'); // Strategist needs approval
    }, 6000); 
  };

  const approveApplication = () => {
    setWorkflowState('COMPLETE');
    // In real app, call API to save application state
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
                <h2 className="text-xl font-bold flex items-center mb-4">
                    <Sparkles className="text-accent mr-2" size={20} /> Application Workflow
                </h2>

                {workflowState === 'IDLE' && (
                    <div className="text-center py-6">
                        <p className="text-sm text-slate-400 mb-4">Click below to launch the Lemma Application Workflow. AI agents will analyze, optimize, and strategize in parallel.</p>
                        <button onClick={startWorkflow} className="btn-primary w-full py-3">
                            Launch Workflow
                        </button>
                    </div>
                )}

                {workflowState !== 'IDLE' && (
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-0.5 before:bg-slate-700">
                        
                        {/* Agent 1: Job Matcher */}
                        <div className="relative flex items-center justify-between">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-slate-900 z-10 ${activeStep >= 1 ? 'border-green-500 text-green-500' : 'border-slate-600 text-slate-600'}`}>
                                {activeStep >= 1 ? <CheckCircle2 size={14} /> : <Loader2 size={12} className="animate-spin" />}
                            </div>
                            <div className="w-[calc(100%-2.5rem)] p-3 rounded bg-slate-800/50 border border-slate-700">
                                <div className="font-bold text-sm text-slate-200">Job Matcher</div>
                                {activeStep >= 1 && <div className="text-xs text-green-400 mt-1">98% Match. Strong Python alignment.</div>}
                            </div>
                        </div>

                        {/* Agent 2: Resume Advisor */}
                        <div className="relative flex items-center justify-between">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-slate-900 z-10 ${activeStep >= 2 ? 'border-green-500 text-green-500' : (activeStep >= 1 ? 'border-accent text-accent' : 'border-slate-600 text-slate-600')}`}>
                                {activeStep >= 2 ? <CheckCircle2 size={14} /> : (activeStep >= 1 ? <Loader2 size={12} className="animate-spin" /> : <div className="w-2 h-2 rounded-full bg-slate-600"></div>)}
                            </div>
                            <div className="w-[calc(100%-2.5rem)] p-3 rounded bg-slate-800/50 border border-slate-700">
                                <div className="font-bold text-sm text-slate-200">Resume Advisor</div>
                                {activeStep >= 2 && <div className="text-xs text-accent mt-1">Generated: Google_SWE_Optimized_v1</div>}
                            </div>
                        </div>

                        {/* Agent 3: Career Mentor */}
                        <div className="relative flex items-center justify-between">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-slate-900 z-10 ${activeStep >= 3 ? 'border-green-500 text-green-500' : (activeStep >= 2 ? 'border-purple-500 text-purple-500' : 'border-slate-600 text-slate-600')}`}>
                                {activeStep >= 3 ? <CheckCircle2 size={14} /> : (activeStep >= 2 ? <Loader2 size={12} className="animate-spin" /> : <div className="w-2 h-2 rounded-full bg-slate-600"></div>)}
                            </div>
                            <div className="w-[calc(100%-2.5rem)] p-3 rounded bg-slate-800/50 border border-slate-700">
                                <div className="font-bold text-sm text-slate-200">Career Mentor</div>
                                {activeStep >= 3 && <div className="text-xs text-purple-400 mt-1">Found 2 alumni in your network.</div>}
                            </div>
                        </div>

                        {/* Agent 4: Application Strategist (Approval) */}
                        <div className="relative flex items-center justify-between">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-slate-900 z-10 ${activeStep >= 4 ? 'border-orange-500 text-orange-500' : (activeStep >= 3 ? 'border-orange-500 text-orange-500' : 'border-slate-600 text-slate-600')}`}>
                                {activeStep >= 4 ? <AlertCircle size={14} /> : (activeStep >= 3 ? <Loader2 size={12} className="animate-spin" /> : <div className="w-2 h-2 rounded-full bg-slate-600"></div>)}
                            </div>
                            <div className="w-[calc(100%-2.5rem)] p-3 rounded bg-slate-800/50 border border-slate-700">
                                <div className="font-bold text-sm text-slate-200">Application Strategist</div>
                                {activeStep >= 4 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-slate-300 mb-3">"Highly recommend applying immediately. The job was posted 2 hours ago and your resume is a perfect fit."</p>
                                        {workflowState === 'APPROVAL_NEEDED' && (
                                            <button onClick={approveApplication} className="btn-primary w-full py-2 text-sm bg-orange-600 hover:bg-orange-700">Approve & Apply</button>
                                        )}
                                        {workflowState === 'COMPLETE' && (
                                            <div className="text-xs text-green-400 font-bold flex items-center"><CheckCircle2 size={14} className="mr-1" /> Approved</div>
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

                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
