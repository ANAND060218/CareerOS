import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  createApplication, formatApiError, getJob, getLemmaStatus, getMemory,
  runLemmaWorkflow, runLemmaWorkflowStream, saveResumeMemory, uploadResume, getWorkflowEvents,
  getWorkflowResult, generateMoreInterviewQuestions
} from '../api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Briefcase, MapPin, Calendar, CheckCircle2, Loader2, Sparkles,
  FileText, UserCircle2, MessageSquare, Brain, Target, Mic, Download, ExternalLink,
  HelpCircle, Clock, ChevronRight, Check, Send, AlertTriangle, Play, ListTodo,
  Copy, Mail, Linkedin, Banknote, TrendingUp, Users, Layers3, CircleDot
} from 'lucide-react';
import FormattedJobDescription from '../components/FormattedJobDescription';
import { getCompanyColorPalette, getCompanyInitials } from '../utils/colorUtils';

const AGENT_STEPS = [
  { key: 'opportunity-intelligence', label: 'Opportunity Intel', icon: Target, color: 'text-teal-400', desc: 'Analyzing fit & company culture' },
  { key: 'career-mentor', label: 'Career Mentor', icon: Brain, color: 'text-violet-400', desc: 'ATS resume optimize & study gaps' },
  { key: 'application-strategist', label: 'Application Strategist', icon: MessageSquare, color: 'text-orange-400', desc: 'Crafting cover letter & outreach docs' },
  { key: 'career-memory', label: 'Career Memory Sync', icon: UserCircle2, color: 'text-blue-400', desc: 'Saving session logs & key actions' },
];

const downloadTextFile = (content, filename) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const downloadDocFile = (contentHtml, filename) => {
  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><title>Interview Preparation Plan</title><style>body { font-family: Arial, sans-serif; line-height: 1.5; color: #333333; margin: 40px; } h1 { color: #0f172a; font-size: 24px; border-bottom: 2px solid #0d9488; padding-bottom: 8px; } h2 { color: #0d9488; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; } .question { font-weight: bold; font-size: 14px; margin-top: 15px; color: #1e293b; } .answer { margin-bottom: 15px; font-size: 13px; color: #475569; padding-left: 10px; border-left: 3px solid #cbd5e1; }</style></head><body>";
  const footer = "</body></html>";
  const sourceHTML = header + contentHtml + footer;
  
  const blob = new Blob(['\ufeff' + sourceHTML], {
    type: 'application/msword'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const parseResumeSuggestions = (rawText) => {
  if (!rawText) return [];
  
  // Split by markdown bullet items for Sections
  const blocks = rawText.split(/(?=\n-\s*\*\*Section\*\*)/);
  const parsed = [];
  
  for (const block of blocks) {
    if (!block.trim()) continue;
    
    // Parse using regex
    const sectionMatch = block.match(/-\s*\*\*Section\*\*:\s*(.*?)(?=\n-\s*\*\*|$)/is);
    const originalMatch = block.match(/-\s*\*\*Original Content\*\*:\s*(.*?)(?=\n-\s*\*\*|$)/is);
    const suggestedMatch = block.match(/-\s*\*\*Suggested Improvement \(Copy & Paste\)\*\*:\s*(.*?)(?=\n-\s*\*\*|$)/is);
    const whyMatch = block.match(/-\s*\*\*Why\*\*:\s*(.*?)(?=\n-\s*\*\*|$)/is);
    
    if (sectionMatch || suggestedMatch) {
      parsed.push({
        section: sectionMatch ? sectionMatch[1].replace(/['"\r\n]+/g, '').replace(/^\*\*|\*\*$/g, '').trim() : 'General Suggestions',
        original: originalMatch ? originalMatch[1].replace(/^['"]|['"]$/g, '').trim() : '(none)',
        suggested: suggestedMatch ? suggestedMatch[1].replace(/^['"]|['"]$/g, '').trim() : '',
        why: whyMatch ? whyMatch[1].trim() : ''
      });
    }
  }
  
  // Fallback split by double newlines if regex list split yielded nothing
  if (parsed.length === 0) {
    const blocksDouble = rawText.split(/\n\s*\n/);
    for (const block of blocksDouble) {
      if (!block.trim()) continue;
      
      const sectionMatch = block.match(/-\s*\*\*Section\*\*:\s*(.*?)(?=\n-\s*\*\*|$)/is);
      const originalMatch = block.match(/-\s*\*\*Original Content\*\*:\s*(.*?)(?=\n-\s*\*\*|$)/is);
      const suggestedMatch = block.match(/-\s*\*\*Suggested Improvement \(Copy & Paste\)\*\*:\s*(.*?)(?=\n-\s*\*\*|$)/is);
      const whyMatch = block.match(/-\s*\*\*Why\*\*:\s*(.*?)(?=\n-\s*\*\*|$)/is);
      
      if (sectionMatch || suggestedMatch) {
        parsed.push({
          section: sectionMatch ? sectionMatch[1].replace(/['"\r\n]+/g, '').replace(/^\*\*|\*\*$/g, '').trim() : 'General Suggestions',
          original: originalMatch ? originalMatch[1].replace(/^['"]|['"]$/g, '').trim() : '(none)',
          suggested: suggestedMatch ? suggestedMatch[1].replace(/^['"]|['"]$/g, '').trim() : '',
          why: whyMatch ? whyMatch[1].trim() : ''
        });
      }
    }
  }
  
  return parsed;
};

const asArray = (value) => Array.isArray(value) ? value : [];

const getInterviewStages = (companyIntelligence = {}) => {
  const structured = asArray(companyIntelligence.interview_stages);
  if (structured.length) {
    return structured.map((stage, index) => typeof stage === 'string'
      ? { name: stage, focus: 'Role and company fit', duration: 'Not specified', difficulty: 'Medium' }
      : {
          name: stage?.name || `Round ${index + 1}`,
          focus: stage?.focus || 'Role and company fit',
          duration: stage?.duration || 'Not specified',
          difficulty: stage?.difficulty || 'Medium',
        });
  }

  const process = companyIntelligence.interview_process || '';
  const parsed = process
    .replace(/\(\d+\)/g, '|')
    .split(/\s*(?:→|➔|\+|\||,| then )\s*/i)
    .map((name) => name.trim())
    .filter((name) => name.length > 2 && name.length < 90);

  return (parsed.length ? parsed : ['Technical Screening', 'Manager / HR Discussion']).map((name) => ({
    name,
    focus: 'Role and company fit',
    duration: 'Not specified',
    difficulty: 'Medium',
  }));
};

const getInterviewRounds = (result = {}) => {
  const structured = asArray(result.interviewRounds);
  if (structured.length) return structured;

  const technical = asArray(result.technicalQuestions);
  const behavioral = asArray(result.behavioralQuestions);
  if (!technical.length && !behavioral.length) return [];

  return [{
    name: 'Role Interview Preparation',
    focus: asArray(result.techDeepDive),
    duration: '45-60 minutes',
    difficulty: 'Medium',
    technical_questions: technical,
    behavioral_questions: behavioral,
    preparation_tips: result.preparationPlan ? [result.preparationPlan] : [],
  }];
};

function MarkdownMessage({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: (props) => <h2 className="mt-3 mb-1 text-sm font-bold text-teal-300" {...props} />,
        h3: (props) => <h3 className="mt-3 mb-1 text-xs font-bold text-slate-100" {...props} />,
        p: (props) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
        ul: (props) => <ul className="mb-2 ml-4 list-disc space-y-1" {...props} />,
        ol: (props) => <ol className="mb-2 ml-4 list-decimal space-y-1" {...props} />,
        table: (props) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-[10px]" {...props} /></div>,
        th: (props) => <th className="border border-slate-700 bg-slate-800 px-2 py-1 text-left" {...props} />,
        td: (props) => <td className="border border-slate-800 px-2 py-1 align-top" {...props} />,
        a: (props) => <a className="text-teal-400 underline hover:text-teal-300" target="_blank" rel="noreferrer" {...props} />,
        strong: (props) => <strong className="font-bold text-slate-100" {...props} />,
      }}
    >
      {children || ''}
    </ReactMarkdown>
  );
}

const getNodeColorTheme = (idx) => {
  const themes = [
    {
      border: 'border-blue-500/30 hover:border-blue-400/60',
      bg: 'bg-blue-950/10 hover:bg-blue-950/20',
      text: 'text-blue-400',
      badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      nodeBorder: 'border-blue-500 text-blue-400 hover:bg-blue-500/10',
      shadow: 'shadow-blue-500/5 hover:shadow-blue-500/20',
      glow: 'from-blue-500/10 to-transparent',
    },
    {
      border: 'border-indigo-500/30 hover:border-indigo-400/60',
      bg: 'bg-indigo-950/10 hover:bg-indigo-950/20',
      text: 'text-indigo-400',
      badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
      nodeBorder: 'border-indigo-500 text-indigo-400 hover:bg-indigo-500/10',
      shadow: 'shadow-indigo-500/5 hover:shadow-indigo-500/20',
      glow: 'from-indigo-500/10 to-transparent',
    },
    {
      border: 'border-purple-500/30 hover:border-purple-400/60',
      bg: 'bg-purple-950/10 hover:bg-purple-950/20',
      text: 'text-purple-400',
      badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      nodeBorder: 'border-purple-500 text-purple-400 hover:bg-purple-500/10',
      shadow: 'shadow-purple-500/5 hover:shadow-purple-500/20',
      glow: 'from-purple-500/10 to-transparent',
    },
    {
      border: 'border-violet-500/30 hover:border-violet-400/60',
      bg: 'bg-violet-950/10 hover:bg-violet-950/20',
      text: 'text-violet-400',
      badge: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
      nodeBorder: 'border-violet-500 text-violet-400 hover:bg-violet-500/10',
      shadow: 'shadow-violet-500/5 hover:shadow-violet-500/20',
      glow: 'from-violet-500/10 to-transparent',
    },
    {
      border: 'border-pink-500/30 hover:border-pink-400/60',
      bg: 'bg-pink-950/10 hover:bg-pink-950/20',
      text: 'text-pink-400',
      badge: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
      nodeBorder: 'border-pink-500 text-pink-400 hover:bg-pink-500/10',
      shadow: 'shadow-pink-500/5 hover:shadow-pink-500/20',
      glow: 'from-pink-500/10 to-transparent',
    },
    {
      border: 'border-rose-500/30 hover:border-rose-400/60',
      bg: 'bg-rose-950/10 hover:bg-rose-950/20',
      text: 'text-rose-400',
      badge: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
      nodeBorder: 'border-rose-500 text-rose-400 hover:bg-rose-500/10',
      shadow: 'shadow-rose-500/5 hover:shadow-rose-500/20',
      glow: 'from-rose-500/10 to-transparent',
    },
    {
      border: 'border-orange-500/30 hover:border-orange-400/60',
      bg: 'bg-orange-950/10 hover:bg-orange-950/20',
      text: 'text-orange-400',
      badge: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
      nodeBorder: 'border-orange-500 text-orange-400 hover:bg-orange-500/10',
      shadow: 'shadow-orange-500/5 hover:shadow-orange-500/20',
      glow: 'from-orange-500/10 to-transparent',
    },
    {
      border: 'border-amber-500/30 hover:border-amber-400/60',
      bg: 'bg-amber-950/10 hover:bg-amber-950/20',
      text: 'text-amber-400',
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      nodeBorder: 'border-amber-500 text-amber-400 hover:bg-amber-500/10',
      shadow: 'shadow-amber-500/5 hover:shadow-amber-500/20',
      glow: 'from-amber-500/10 to-transparent',
    },
    {
      border: 'border-emerald-500/30 hover:border-emerald-400/60',
      bg: 'bg-emerald-950/10 hover:bg-emerald-950/20',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      nodeBorder: 'border-emerald-500 text-emerald-400 hover:bg-emerald-500/10',
      shadow: 'shadow-emerald-500/5 hover:shadow-emerald-500/20',
      glow: 'from-emerald-500/10 to-transparent',
    },
    {
      border: 'border-teal-500/30 hover:border-teal-400/60',
      bg: 'bg-teal-950/10 hover:bg-teal-950/20',
      text: 'text-teal-400',
      badge: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
      nodeBorder: 'border-teal-500 text-teal-400 hover:bg-teal-500/10',
      shadow: 'shadow-teal-500/5 hover:shadow-teal-500/20',
      glow: 'from-teal-500/10 to-transparent',
    },
  ];
  return themes[idx % themes.length];
};

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const workflowFeedbackRef = useRef(null);

  const [job, setJob] = useState(null);
  const [workflowState, setWorkflowState] = useState('IDLE');
  const [resumeText, setResumeText] = useState('');
  const [workflowResult, setWorkflowResult] = useState(null);
  const [workflowError, setWorkflowError] = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const [lemmaStatus, setLemmaStatus] = useState(null);
  const [completedAgents, setCompletedAgents] = useState([]);
  const [currentRunningAgent, setCurrentRunningAgent] = useState('');
  const [agentThinkingMessage, setAgentThinkingMessage] = useState('');
  const [workflowStartTime, setWorkflowStartTime] = useState(null);
  const [showFullJD, setShowFullJD] = useState(true);

  // New interactive states
  const [activeTab, setActiveTab] = useState('roadmap'); // roadmap, interview, company, outreach
  const [selectedNode, setSelectedNode] = useState(null); // click agent node to see Prompt/Reasoning
  const [isMentorOpen, setIsMentorOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [completedMindmapNodes, setCompletedMindmapNodes] = useState([]);
  // Connectors states removed
  const [outreachDrafts, setOutreachDrafts] = useState({});

  const [localChecklist, setLocalChecklist] = useState([]);

  const [localBehQuestions, setLocalBehQuestions] = useState([]);
  const [localTechQuestions, setLocalTechQuestions] = useState([]);
  const [behLoading, setBehLoading] = useState(false);
  const [techLoading, setTechLoading] = useState(false);
  const [copiedSuggestionId, setCopiedSuggestionId] = useState(null);

  useEffect(() => {
    if (workflowResult?.checklist) {
      setLocalChecklist(workflowResult.checklist.map((item, idx) => ({
        id: `task-${idx}-${Date.now()}`,
        text: item,
        completed: false
      })));
    } else {
      setLocalChecklist([]);
    }
  }, [workflowResult]);

  useEffect(() => {
    if (workflowResult) {
      setLocalBehQuestions(workflowResult.behavioralQuestions || []);
      setLocalTechQuestions(workflowResult.technicalQuestions || []);
    } else {
      setLocalBehQuestions([]);
      setLocalTechQuestions([]);
    }
  }, [workflowResult]);

  // Load resume on initial mount
  useEffect(() => {
    getMemory().then((m) => {
      if (m?.resume_text) setResumeText(m.resume_text);
    }).catch(() => { });
  }, []);

  // Fetch Lemma connectivity status
  useEffect(() => {
    getLemmaStatus().then(setLemmaStatus).catch(() => setLemmaStatus({ connected: false }));
  }, []);

  // Fetch connectors status hook removed
  useEffect(() => {
    getLemmaStatus().then(setLemmaStatus).catch(() => setLemmaStatus({ connected: false }));
  }, []);

  // Handle visibility change (computer sleep/wake)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && job) {
        if (!job.is_manual && job.id) {
          getJob(job.id).then((freshJob) => {
            if (freshJob && typeof freshJob === 'object' && freshJob.title) {
              setJob(freshJob);
            }
          }).catch((err) => {
            console.error('Failed to refresh job on visibility change:', err);
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [job]);

  // Fetch target job details
  useEffect(() => {
    if (location.state?.manualJob) {
      // Validate the job object before setting it
      if (location.state.manualJob && typeof location.state.manualJob === 'object' && location.state.manualJob.title) {
        setJob(location.state.manualJob);
        localStorage.setItem(location.state.manualJob.id, JSON.stringify(location.state.manualJob));
        if (location.state.resumeText) {
          setResumeText(location.state.resumeText);
        }
      } else {
        console.error('Invalid manual job from location state:', location.state.manualJob);
        setWorkflowError('Invalid job data received');
      }
    } else if (id && id.startsWith('manual-')) {
      const stored = localStorage.getItem(id);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object' && parsed.title) {
            setJob(parsed);
          } else {
            console.error('Invalid job from localStorage:', parsed);
            setWorkflowError('Invalid job data in storage');
          }
        } catch (e) {
          console.error('Failed to parse localStorage job:', e);
          setWorkflowError('Failed to load manual job from storage');
        }
      } else {
        setWorkflowError('Manual job details not found in local storage.');
      }
    } else {
      getJob(id).then((jobData) => {
        if (jobData && typeof jobData === 'object' && jobData.title) {
          setJob(jobData);
        } else {
          console.error('Invalid job from API:', jobData);
          setWorkflowError('Invalid job data received from API');
        }
      }).catch((err) => {
        console.error('Failed to fetch job:', err);
        setWorkflowError('Failed to load job details');
      });
    }
  }, [id, location.state]);

  // Load cached workflow result if exists
  useEffect(() => {
    if (job) {
      const jobId = job.id;
      if (jobId) {
        // Try localStorage first for faster load
        const localCache = localStorage.getItem(`workflow_${jobId}`);
        if (localCache) {
          try {
            const cached = JSON.parse(localCache);
            if (cached.timestamp && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
              setCompletedAgents(cached.completedAgents || []);
              setWorkflowResult(cached.workflowResult);
              setWorkflowState(cached.workflowState || 'COMPLETE');
              console.log('Loaded workflow from localStorage cache');
            }
          } catch (e) {
            console.warn('Failed to parse localStorage cache:', e);
          }
        }

        // Then load from backend for fresh data
        getWorkflowResult(jobId).then((res) => {
          if (res && res.status === 'completed') {
            const resultData = {
              matchScore: res.match_result?.match_score ?? 0,
              strengths: res.match_result?.strengths ?? [],
              missingSkills: res.match_result?.missing_skills ?? [],
              matchedSkills: res.match_result?.matched_skills ?? [],
              reasoning: res.match_result?.reasoning ?? '',
              companyIntelligence: res.match_result?.company_intelligence ?? {},

              optimizedResume: res.optimize_result?.optimized_resume ?? '',
              suggestions: res.optimize_result?.ats_suggestions ?? [],
              keywords: res.optimize_result?.keyword_suggestions ?? [],
              skills: res.optimize_result?.skills ?? [],

              recommendation: res.strategist_result?.recommendation ?? '',
              strategistReasoning: res.strategist_result?.reasoning ?? '',
              recruiterOutreach: res.strategist_result?.recruiter_outreach ?? '',
              followUpTimeline: res.strategist_result?.follow_up_timeline ?? '',
              checklist: res.strategist_result?.checklist ?? [],

              behavioralQuestions: res.interview_result?.behavioral_questions ?? [],
              technicalQuestions: res.interview_result?.technical_questions ?? [],
              interviewRounds: res.interview_result?.interview_rounds ?? [],
              preparationPlan: res.interview_result?.preparation_plan ?? '',
              companyResearch: res.interview_result?.company_research ?? '',
              techDeepDive: res.interview_result?.tech_deep_dive ?? [],

              coverLetter: res.cover_letter?.cover_letter ?? '',
              recruiterEmail: res.cover_letter?.recruiter_email ?? '',
              linkedinMessage: res.cover_letter?.linkedin_message ?? '',
              followUpEmail: res.cover_letter?.follow_up_email ?? '',

              agents: res.agents ?? [],
              source: res.source ?? 'unknown',
              message: res.message ?? '',
              lemmaAgentsRun: res.lemma_agents_run ?? [],
              lemmaPodId: res.lemma_pod_id ?? '',
              reasoningGraph: res.reasoning_graph ?? {},
            };
            setCompletedAgents(res.lemma_agents_run || []);
            setWorkflowResult(resultData);
            
            // Save to localStorage
            localStorage.setItem(`workflow_${jobId}`, JSON.stringify({
              workflowResult: resultData,
              completedAgents: res.lemma_agents_run || [],
              workflowState: job.is_manual ? 'COMPLETE' : 'APPROVAL_NEEDED',
              timestamp: Date.now()
            }));

            if (job.is_manual) {
              setWorkflowState('COMPLETE');
            } else {
              setWorkflowState('APPROVAL_NEEDED');
            }
          }
        }).catch((err) => {
          console.warn('Failed to load cached workflow:', err);
        });
      }
    }
  }, [job]);

  useEffect(() => {
    if (!workflowResult) return;
    setOutreachDrafts({
      coverLetter: workflowResult.coverLetter || '',
      recruiterEmail: workflowResult.recruiterEmail || '',
      linkedinMessage: workflowResult.linkedinMessage || '',
      followUpEmail: workflowResult.followUpEmail || '',
    });
  }, [workflowResult?.coverLetter, workflowResult?.recruiterEmail, workflowResult?.linkedinMessage, workflowResult?.followUpEmail]);



  // Bring the newly rendered live agent feedback into view when a run starts.
  useEffect(() => {
    if (workflowState !== 'RUNNING') return;

    const frame = window.requestAnimationFrame(() => {
      workflowFeedbackRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [workflowState]);

  const showToast = (msg, duration = 4000) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  };

  const startWorkflow = async () => {
    if (!resumeText.trim()) {
      setWorkflowError('Resume required');
      return;
    }

    const runStartTime = new Date().toISOString();
    setWorkflowStartTime(runStartTime);

    setWorkflowState('RUNNING');
    setWorkflowError('');
    setWorkflowResult(null);
    setCompletedAgents([]);
    setCurrentRunningAgent('');
    setAgentThinkingMessage('');
    setShowFullJD(false); // Collapse JD when workflow starts

    try {
      await uploadResume(resumeText);
      await saveResumeMemory({ resume_text: resumeText });

      let receivedTerminalEvent = false;
      await runLemmaWorkflowStream(
        resumeText,
        job.description || '',
        job.company || '',
        job.id,
        (event) => {
          if (event.type === 'workflow_start') {
            setWorkflowState('RUNNING');
            setCompletedAgents([]);
            setWorkflowResult(null);
            setWorkflowError('');
          } else if (event.type === 'agent_start') {
            setCurrentRunningAgent(event.agent);
            setAgentThinkingMessage(event.description || `Agent ${event.label} is analyzing...`);
          } else if (event.type === 'agent_complete') {
            setCurrentRunningAgent('');
            setAgentThinkingMessage('');
            setCompletedAgents(prev => {
              if (prev.includes(event.agent)) return prev;
              return [...prev, event.agent];
            });
            setWorkflowResult(prev => {
              const base = prev || {};
              if (event.agent === 'opportunity-intelligence') {
                return {
                  ...base,
                  matchScore: event.data.match_score ?? 0,
                  strengths: event.data.strengths ?? [],
                  missingSkills: event.data.missing_skills ?? [],
                  matchedSkills: event.data.matched_skills ?? [],
                  reasoning: event.data.reasoning ?? '',
                  companyIntelligence: event.data.company_intelligence ?? {},
                };
              }
              if (event.agent === 'career-mentor') {
                return {
                  ...base,
                  optimizedResume: event.data.optimized_resume ?? '',
                  suggestions: event.data.ats_suggestions ?? [],
                  keywords: event.data.keyword_suggestions ?? [],
                  skills: event.data.skills ?? [],
                };
              }
              if (event.agent === 'application-strategist') {
                return {
                  ...base,
                  recommendation: event.data.recommendation ?? '',
                  strategistReasoning: event.data.reasoning ?? '',
                  coverLetter: event.data.cover_letter ?? '',
                  recruiterEmail: event.data.recruiter_email ?? '',
                  linkedinMessage: event.data.linkedin_message ?? '',
                  followUpEmail: event.data.follow_up_email ?? '',
                  recruiterOutreach: event.data.recruiter_outreach ?? '',
                  followUpTimeline: event.data.follow_up_timeline ?? '',
                  checklist: event.data.checklist ?? [],
                  behavioralQuestions: event.data.behavioral_questions ?? [],
                  technicalQuestions: event.data.technical_questions ?? [],
                  interviewRounds: event.data.interview_rounds ?? [],
                  preparationPlan: event.data.preparation_plan ?? '',
                  companyResearch: event.data.company_research ?? '',
                  techDeepDive: event.data.tech_deep_dive ?? [],
                };
              }
              if (event.agent === 'career-memory') {
                return {
                  ...base,
                  runSummary: event.data.run_summary ?? '',
                  keyAction: event.data.key_action ?? '',
                };
              }
              return base;
            });
          } else if (event.type === 'workflow_complete') {
            receivedTerminalEvent = true;
            const workflowData = event.data;
            const agentsRun = workflowData?.lemma_agents_run || [];
            setCompletedAgents(agentsRun);
            setCurrentRunningAgent('');
            setAgentThinkingMessage('');

            setWorkflowResult({
              matchScore: workflowData?.match_result?.match_score ?? 0,
              strengths: workflowData?.match_result?.strengths ?? [],
              missingSkills: workflowData?.match_result?.missing_skills ?? [],
              matchedSkills: workflowData?.match_result?.matched_skills ?? [],
              reasoning: workflowData?.match_result?.reasoning ?? '',
              companyIntelligence: workflowData?.match_result?.company_intelligence ?? {},

              optimizedResume: workflowData?.optimize_result?.optimized_resume ?? '',
              suggestions: workflowData?.optimize_result?.ats_suggestions ?? [],
              keywords: workflowData?.optimize_result?.keyword_suggestions ?? [],
              skills: workflowData?.optimize_result?.skills ?? [],

              recommendation: workflowData?.strategist_result?.recommendation ?? '',
              strategistReasoning: workflowData?.strategist_result?.reasoning ?? '',
              recruiterOutreach: workflowData?.strategist_result?.recruiter_outreach ?? '',
              followUpTimeline: workflowData?.strategist_result?.follow_up_timeline ?? '',
              checklist: workflowData?.strategist_result?.checklist ?? [],

              behavioralQuestions: workflowData?.interview_result?.behavioral_questions ?? [],
              technicalQuestions: workflowData?.interview_result?.technical_questions ?? [],
              interviewRounds: workflowData?.interview_result?.interview_rounds ?? [],
              preparationPlan: workflowData?.interview_result?.preparation_plan ?? '',
              companyResearch: workflowData?.interview_result?.company_research ?? '',
              techDeepDive: workflowData?.interview_result?.tech_deep_dive ?? [],

              coverLetter: workflowData?.cover_letter?.cover_letter ?? '',
              recruiterEmail: workflowData?.cover_letter?.recruiter_email ?? '',
              linkedinMessage: workflowData?.cover_letter?.linkedin_message ?? '',
              followUpEmail: workflowData?.cover_letter?.follow_up_email ?? '',

              agents: workflowData?.agents ?? [],
              source: workflowData?.source ?? 'unknown',
              message: workflowData?.message ?? '',
              lemmaAgentsRun: agentsRun,
              lemmaPodId: workflowData?.lemma_pod_id ?? '',
              reasoningGraph: workflowData?.reasoning_graph ?? {},
            });

            if (!job.is_manual) {
              createApplication(job.id, 'Saved', job.title, job.company).catch((appErr) => {
                console.warn('Application save:', appErr);
              });
              setWorkflowState('APPROVAL_NEEDED');
            } else {
              setWorkflowState('COMPLETE');
            }

            // Save to localStorage for persistence
            localStorage.setItem(`workflow_${job.id}`, JSON.stringify({
              workflowResult: workflowResult,
              completedAgents: agentsRun,
              workflowState: job.is_manual ? 'COMPLETE' : 'APPROVAL_NEEDED',
              timestamp: Date.now()
            }));
          } else if (event.type === 'error') {
            receivedTerminalEvent = true;
            setWorkflowError(event.message);
            setCurrentRunningAgent('');
            setAgentThinkingMessage('');
            setWorkflowState('ERROR');
          }
        }
      );
      if (!receivedTerminalEvent) {
        setCurrentRunningAgent('');
        setAgentThinkingMessage('');
        setWorkflowError('The Lemma stream ended before the workflow returned a final result. Please retry.');
        setWorkflowState('ERROR');
      }
    } catch (e) {
      setWorkflowError(formatApiError(e));
      setCurrentRunningAgent('');
      setAgentThinkingMessage('');
      setWorkflowState('ERROR');
    }
  };

  const approveApplication = async () => {
    try {
      await createApplication(job.id, 'Applied', job.title, job.company);
      setWorkflowState('COMPLETE');
      showToast('Application promoted to "Applied" successfully.');
    } catch (e) {
      setWorkflowError('Failed to save application');
    }
  };

  const exportFullAnalysisReport = () => {
    if (!workflowResult) return;
    
    const techQuestionsList = localTechQuestions.length > 0 
      ? localTechQuestions 
      : (workflowResult.technicalQuestions || []);
      
    const behQuestionsList = localBehQuestions.length > 0 
      ? localBehQuestions 
      : (workflowResult.behavioralQuestions || []);
    
    let html = `
      <h1>CareerOS AI Workflow Report - ${job?.company || 'Company'}</h1>
      <p><strong>Position:</strong> ${job?.title || 'Position'}</p>
      <p><strong>Location:</strong> ${job?.location || 'Not Specified'}</p>
      <p><strong>Scanned At:</strong> ${new Date().toLocaleDateString()}</p>
      <hr/>
      
      <h2>1. Overall Match & Fit Analysis</h2>
      <p><strong>Profile Match Score:</strong> ${workflowResult.matchScore || 0}%</p>
      <p><strong>Evaluation Reasoning:</strong></p>
      <div style="font-style: italic; color: #475569; margin-bottom: 15px;">"${workflowResult.reasoning || 'No evaluation reasoning provided.'}"</div>
      
      <h3>Candidate Strengths & Matches:</h3>
      <ul>
        ${(workflowResult.strengths || []).map(s => `<li>${s}</li>`).join('')}
        ${(workflowResult.matchedSkills || []).map(s => `<li>${s} (matched)</li>`).join('')}
      </ul>
      
      <h3>Missing Skills & Gaps:</h3>
      <ul>
        ${(workflowResult.missingSkills || []).map(s => `<li>${s}</li>`).join('')}
      </ul>
      
      <h2>2. Technical & Behavioral Interview Prep</h2>
      <p><strong>Preparation Strategy Plan:</strong></p>
      <div style="white-space: pre-wrap; font-size: 13px; color: #475569; margin-bottom: 20px;">${workflowResult.preparationPlan || 'N/A'}</div>
      
      <h3>Technical Interview Qs & Model Answers:</h3>
      ${techQuestionsList.map((q, idx) => `
        <div class="question">Q${idx + 1}: ${q.question || q.q || 'Question'}</div>
        <div class="answer">${q.answer || q.a_short || q.a || 'Model answer not available'}</div>
      `).join('')}
      
      <h3>Behavioral Interview Qs & Model Answers:</h3>
      ${behQuestionsList.map((q, idx) => `
        <div class="question">Q${idx + 1}: ${q.question || q.q || 'Question'}</div>
        <div class="answer">${q.answer || q.a_template || q.a || 'Model answer template not available'}</div>
      `).join('')}
      
      <h2>3. Company Intelligence & Expected Stages</h2>
      <p><strong>About the Company:</strong> ${workflowResult.companyIntelligence?.about || 'Not researched'}</p>
      <p><strong>HQ & Locations:</strong> ${workflowResult.companyIntelligence?.locations || 'Global'}</p>
      <p><strong>Global Scale:</strong> ${workflowResult.companyIntelligence?.employee_count || '700,000+'}</p>
      <p><strong>Annual Revenue Scale:</strong> ${workflowResult.companyIntelligence?.revenue || 'N/A'}</p>
      <p><strong>Package & Benefits:</strong> ${workflowResult.companyIntelligence?.role_package_details || 'N/A'}</p>
      <p><strong>Company Culture:</strong> "${workflowResult.companyIntelligence?.culture || 'Collaborative deliverables.'}"</p>
      
      <h3>Expected Interview Stages:</h3>
      <ul>
        ${(workflowResult.companyIntelligence?.interview_stages || []).map(s => `
          <li><strong>${s.name}</strong> (${s.duration || 'Not specified'}): ${s.focus}</li>
        `).join('')}
      </ul>
      
      <h2>4. Resume Suggestions suitable for Role</h2>
      <div style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.5; font-size: 13px;">
        ${(workflowResult.optimizedResume || '').replace(/\n/g, '<br/>')}
      </div>
      
      <h2>5. Cover Letter suitable for Role</h2>
      <div style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.5; font-size: 13px;">
        ${(workflowResult.coverLetter || '').replace(/\n/g, '<br/>')}
      </div>
    `;
    
    downloadDocFile(html, `full-analysis-report-${job?.company || 'company'}.doc`);
  };

  // Lemma scheduling and connector handlers removed



  if (!job) {
    return (
      <div className="text-center p-10">
        <Loader2 className="animate-spin h-10 w-10 text-teal-500 mx-auto" />
        <p className="text-slate-400 mt-4">Loading job details...</p>
      </div>
    );
  }

  // Validate job object structure
  if (typeof job !== 'object' || !job.title) {
    console.error('Invalid job object:', job);
    return (
      <div className="text-center p-10">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
        <p className="text-slate-400 mt-4">Invalid job data. Please try refreshing the page.</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg">
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative pb-20">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 bg-slate-900 border border-teal-500 text-teal-300 text-sm font-semibold rounded-xl shadow-xl animate-bounce">
          {toast}
        </div>
      )}

      {/* Top action bar */}
      <div className="flex justify-between items-center">
        <button type="button" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm font-medium">
          <ArrowLeft size={16} /> Back
        </button>

        {/* Gmail Sync button removed */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Hand: Job Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 flex-shrink-0 rounded-2xl flex items-center justify-center p-2.5 border-2 shadow-lg transition-transform duration-300 hover:scale-105"
                  style={{
                    backgroundColor: getCompanyColorPalette(job.company).light,
                    borderColor: getCompanyColorPalette(job.company).primary,
                  }}
                >
                  {(!job.logo || imgFailed) ? (
                    <div
                      className="w-full h-full flex items-center justify-center font-extrabold text-xl"
                      style={{ color: getCompanyColorPalette(job.company).primary }}
                    >
                      {getCompanyInitials(job.company)}
                    </div>
                  ) : (
                    <img
                      src={job.logo}
                      alt={job.company}
                      className="w-full h-full object-contain animate-fade-in"
                      onError={() => setImgFailed(true)}
                    />
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight leading-tight">{job.title}</h1>
                  <div className="text-lg text-teal-400 font-semibold mt-1.5">{job.company}</div>
                </div>
              </div>
              {(job.apply_link || job.apply_url) && (
                <a
                  href={job.apply_link || job.apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl font-semibold text-white transition-all flex items-center gap-2 hover:opacity-90 border border-teal-500/30 bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/10 shrink-0"
                >
                  <ExternalLink size={16} /> Apply Direct
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-400">
              <span className="flex items-center"><MapPin size={16} className="mr-1 text-teal-500" /> {job.location || 'Remote'}</span>
              <span className="flex items-center"><Briefcase size={16} className="mr-1 text-teal-500" /> {job.experience || 'Any'}</span>
              {job.date_posted && (
                <span className="flex items-center"><Calendar size={16} className="mr-1 text-teal-500" /> {new Date(job.date_posted).toLocaleDateString()}</span>
              )}
            </div>
            {job.technologies?.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {job.technologies.map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300 border border-slate-700">{t}</span>
                ))}
              </div>
            )}
            <div className="mt-6 border-t border-slate-700/60 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-100">Job Description</h3>
                <button
                  type="button"
                  onClick={() => setShowFullJD(!showFullJD)}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                >
                  {showFullJD ? 'Hide' : 'Show'}
                </button>
              </div>
              {showFullJD && (
                <FormattedJobDescription description={job.description} technologies={job.technologies} />
              )}
            </div>
          </div>

          {/* Animated Agent Flow Diagram */}
          {workflowState !== 'IDLE' && (
            <div ref={workflowFeedbackRef} className="card scroll-mt-6 border-slate-700/60 bg-slate-950/40 p-6 space-y-6">
              <style>{`
                @keyframes pulseBorder {
                  0%, 100% { border-color: rgba(45, 212, 191, 0.2); box-shadow: 0 0 5px rgba(45, 212, 191, 0.1); }
                  50% { border-color: rgba(45, 212, 191, 0.8); box-shadow: 0 0 15px rgba(45, 212, 191, 0.3); }
                }
                @keyframes flowDash {
                  to { stroke-dashoffset: -20; }
                }
                .animate-pulse-border {
                  animation: pulseBorder 1.5s infinite;
                }
                .animate-flow-dash {
                  stroke-dasharray: 6, 4;
                  animation: flowDash 0.8s linear infinite;
                }
              `}</style>

              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="text-teal-400 animate-pulse" size={18} />
                    <span>Live Agent Pipeline Connection Flow</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Observe live communication and thinking status of agent micro-services.</p>
                </div>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-semibold font-mono ${workflowState === 'RUNNING'
                    ? 'border-teal-500/30 bg-teal-950/20 text-teal-300 animate-pulse'
                    : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                  }`}>
                  {workflowState === 'RUNNING' ? 'STREAMING ACTIVE' : 'PIPELINE COMPLETE'}
                </span>
              </div>

              {/* Flow Diagram Row */}
              <div className="flex flex-col lg:flex-row justify-between items-stretch gap-2 py-4 relative">
                {AGENT_STEPS.map((step, idx) => {
                  const isDone = completedAgents.includes(step.key);
                  const isActive = currentRunningAgent === step.key;
                  const isPending = !isDone && !isActive;
                  const Icon = step.icon;

                  return (
                    <React.Fragment key={step.key}>
                      {/* Box element */}
                      <div className={`flex-1 rounded-2xl border p-4 bg-slate-900/60 transition-all duration-300 relative flex flex-col justify-between min-h-[110px] ${isActive
                          ? 'border-teal-500 bg-slate-900 animate-pulse-border scale-105 z-10'
                          : isDone
                            ? 'border-emerald-800/60 bg-emerald-950/5'
                            : 'border-slate-800/80 opacity-60'
                        }`}>
                        <div className="flex items-start justify-between">
                          <div className={`p-2 rounded-xl ${isDone
                              ? 'bg-emerald-950/40 text-emerald-400'
                              : isActive
                                ? 'bg-teal-950/40 text-teal-400'
                                : 'bg-slate-950/40 text-slate-500'
                            }`}>
                            <Icon size={20} />
                          </div>
                          <div className="text-[9px] font-mono">
                            {isDone ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                <Check size={10} /> DONE
                              </span>
                            ) : isActive ? (
                              <span className="text-teal-400 font-bold flex items-center gap-1 animate-pulse">
                                <Loader2 size={10} className="animate-spin" /> RUNNING
                              </span>
                            ) : (
                              <span className="text-slate-500">PENDING</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-3">
                          <h4 className="text-xs font-bold text-slate-200">{step.label}</h4>
                          <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">{step.desc}</p>
                        </div>
                      </div>

                      {/* Connecting Connector */}
                      {idx < AGENT_STEPS.length - 1 && (
                        <div className="hidden lg:flex items-center justify-center h-8 shrink-0 w-8">
                          <svg className="w-full h-2" overflow="visible">
                            <path
                              d="M 0 4 L 32 4"
                              fill="none"
                              stroke={isDone ? '#065f46' : isActive || (isDone && currentRunningAgent === AGENT_STEPS[idx + 1].key) ? '#2dd4bf' : '#334155'}
                              strokeWidth="2.5"
                              className={isDone && currentRunningAgent === AGENT_STEPS[idx + 1].key ? 'animate-flow-dash' : ''}
                            />
                            {(isActive || (isDone && currentRunningAgent === AGENT_STEPS[idx + 1].key)) && (
                              <circle cx="16" cy="4" r="3" fill="#2dd4bf" className="animate-ping" />
                            )}
                          </svg>
                        </div>
                      )}
                      {idx < AGENT_STEPS.length - 1 && (
                        <div className="lg:hidden flex justify-center items-center py-1">
                          <svg className="w-2 h-6" overflow="visible">
                            <path
                              d="M 4 0 L 4 24"
                              fill="none"
                              stroke={isDone ? '#065f46' : isActive || (isDone && currentRunningAgent === AGENT_STEPS[idx + 1].key) ? '#2dd4bf' : '#334155'}
                              strokeWidth="2.5"
                              className={isDone && currentRunningAgent === AGENT_STEPS[idx + 1].key ? 'animate-flow-dash' : ''}
                            />
                          </svg>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Live Terminal Console Console output */}
              {workflowState === 'RUNNING' && currentRunningAgent && (
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-[11px] text-teal-400 space-y-2 max-h-[140px] overflow-y-auto leading-relaxed shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-1.5">
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping"></span>
                      LIVE LEMMA DESKTOP RUNTIME CONSOLE
                    </span>
                    <span className="text-[9px] text-slate-500">POD: career-os-pod</span>
                  </div>
                  <div className="text-slate-500">[{new Date().toLocaleTimeString()}] Connecting to Lemma desktop workflow server...</div>
                  <div className="text-slate-300">
                    <span className="text-teal-500 font-bold">[{currentRunningAgent} thinking]</span> {agentThinkingMessage}
                  </div>
                  <div className="animate-pulse text-slate-500">... awaiting streaming response chunks ...</div>
                </div>
              )}
            </div>
          )}

          {/* Interactive Workflow Reasoning Modal / Node Panel details */}
          {selectedNode && (
            <div className="card border-teal-500/40 bg-slate-950 p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-teal-300 flex items-center gap-2">
                  <Target size={18} />
                  <span>Agent Reason Log: {selectedNode}</span>
                </h3>
                <button type="button" onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white">
                  <CheckCircle2 size={18} /> Close
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4 text-xs font-mono border border-slate-800 rounded p-3 bg-slate-900/40">
                <div>
                  <span className="text-slate-500 block">Time Elapsed</span>
                  <span className="text-slate-200 font-bold">{workflowResult.reasoningGraph[selectedNode]?.time}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Confidence Score</span>
                  <span className="text-emerald-400 font-bold">{workflowResult.reasoningGraph[selectedNode]?.confidence}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Source Runtime</span>
                  <span className="text-slate-200 font-bold">{workflowResult.reasoningGraph[selectedNode]?.source}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <span className="text-emerald-400 font-bold">SUCCESS</span>
                </div>
              </div>
              <details className="group border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/20">
                <summary className="cursor-pointer bg-slate-900/40 p-3 font-semibold text-xs text-slate-400 hover:bg-slate-900/70 select-none">
                  Inspect System Prompt sent to Agent
                </summary>
                <div className="p-3 text-xs font-mono text-slate-400 bg-slate-950 whitespace-pre-wrap max-h-48 overflow-y-auto border-t border-slate-800">
                  {workflowResult.reasoningGraph[selectedNode]?.prompt}
                </div>
              </details>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 block">Parsed Agent Response (JSON)</span>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-teal-400/90 overflow-x-auto max-h-60 overflow-y-auto">
                  {workflowResult.reasoningGraph[selectedNode]?.output}
                </pre>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 block">Full Agent Response (Formatted)</span>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                  {workflowResult.reasoningGraph[selectedNode]?._raw_response || workflowResult.reasoningGraph[selectedNode]?.output}
                </div>
              </div>
            </div>
          )}

          {/* Core Interactive Tabs */}
          {workflowResult && (workflowState === 'COMPLETE' || workflowState === 'APPROVAL_NEEDED') && (
            <div className="space-y-4">
              <div id="interactive-tabs-header" className="flex border-b border-slate-800">
                {[
                  { id: 'roadmap', label: 'Interactive Roadmap Mindmap', icon: Brain },
                  { id: 'company', label: 'Company Intelligence Panel', icon: Briefcase },
                  { id: 'interview', label: 'Interview Simulator Prep', icon: Mic },
                  { id: 'assets', label: 'Resume & Cover Letter', icon: FileText },
                  { id: 'checklist', label: 'Application Tasks & Checklist', icon: ListTodo }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === t.id
                        ? 'border-teal-500 text-teal-300 bg-teal-500/5'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <t.icon size={16} />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: Visual Mindmap skill tree */}
              {activeTab === 'roadmap' && (
                <div className="card space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                        <Brain className="text-teal-400" /> Interactive Learning Roadmap
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Track your customized roadmap. Click the numbered nodes to check them off.
                      </p>
                    </div>
                  </div>

                  {workflowResult.skills?.length > 0 ? (
                    <div className="space-y-8">
                      {/* Overall Progress Tracker Panel */}
                      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full border-2 border-teal-500/20 flex items-center justify-center bg-teal-950/30 text-teal-400">
                            <Brain size={24} className="animate-pulse" />
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Roadmap Mastery Progress</span>
                            <span className="text-sm font-bold text-slate-200">
                              {completedMindmapNodes.length} of {workflowResult.skills.length} skills acquired ({Math.round((completedMindmapNodes.length / workflowResult.skills.length) * 100)}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full md:w-64 bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 relative flex items-center">
                          <div
                            className="bg-gradient-to-r from-teal-500 via-indigo-500 to-emerald-500 h-full transition-all duration-500 rounded-full"
                            style={{ width: `${(completedMindmapNodes.length / workflowResult.skills.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Match & Fit Analysis Dashboard */}
                      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-6">
                        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                          {/* Score Gauge Circle */}
                          <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 rounded-2xl border border-slate-800/80 min-w-[200px] shrink-0">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Overall Profile Match</span>
                            <div className="relative w-28 h-28 flex items-center justify-center">
                              {/* Radial Outer Circle */}
                              <svg className="w-full h-full transform -rotate-90">
                                <circle
                                  cx="56"
                                  cy="56"
                                  r="48"
                                  className="stroke-slate-800"
                                  strokeWidth="8"
                                  fill="transparent"
                                />
                                <circle
                                  cx="56"
                                  cy="56"
                                  r="48"
                                  className={`transition-all duration-1000 ${
                                    (workflowResult.matchScore || 0) < 30
                                      ? 'stroke-rose-500 shadow-rose-500/20'
                                      : (workflowResult.matchScore || 0) < 70
                                      ? 'stroke-amber-500 shadow-amber-500/20'
                                      : 'stroke-teal-500 shadow-teal-500/20'
                                  }`}
                                  strokeWidth="8"
                                  strokeDasharray={2 * Math.PI * 48}
                                  strokeDashoffset={2 * Math.PI * 48 * (1 - (workflowResult.matchScore || 0) / 100)}
                                  strokeLinecap="round"
                                  fill="transparent"
                                />
                              </svg>
                              <div className="absolute flex flex-col items-center justify-center">
                                <span className={`text-3xl font-extrabold tracking-tight ${
                                  (workflowResult.matchScore || 0) < 30
                                    ? 'text-rose-400'
                                    : (workflowResult.matchScore || 0) < 70
                                    ? 'text-amber-400'
                                    : 'text-teal-400'
                                }`}>
                                  {workflowResult.matchScore || 0}%
                                </span>
                              </div>
                            </div>
                            <span className={`text-xs font-extrabold mt-3 px-3 py-1 rounded-full border ${
                              (workflowResult.matchScore || 0) < 30
                                ? 'bg-rose-950/20 border-rose-500/20 text-rose-400'
                                : (workflowResult.matchScore || 0) < 70
                                ? 'bg-amber-950/20 border-amber-500/20 text-amber-400'
                                : 'bg-teal-950/20 border-teal-500/20 text-teal-400'
                            }`}>
                              {(workflowResult.matchScore || 0) < 30
                                ? 'Severe Profile Gap'
                                : (workflowResult.matchScore || 0) < 70
                                ? 'Moderate Fit'
                                : 'Excellent Candidate Fit'}
                            </span>
                          </div>

                          {/* Reasoning Box */}
                          <div className="flex-1 bg-slate-950/20 rounded-2xl border border-slate-800/80 p-5 flex flex-col justify-between space-y-3">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Role Fit Evaluation Reasoning</span>
                              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                {workflowResult.reasoning}
                              </p>
                            </div>
                            <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-900 flex items-center justify-between text-xs">
                              <span className="text-slate-400">Match evaluation computed in step 1 of pipeline.</span>
                              <span className="text-[10px] text-teal-400/90 font-mono">confidence: 95%</span>
                            </div>
                          </div>
                        </div>

                        {/* Strengths & Gaps bullet list grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Strengths / Matches Column */}
                          <div className="bg-emerald-950/5 border border-emerald-950/40 rounded-2xl p-5 space-y-3">
                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-emerald-950/30 pb-2">
                              <CheckCircle2 size={13} className="text-emerald-400" />
                              <span>Candidate Strengths & Matches</span>
                            </h4>
                            {workflowResult.strengths?.length > 0 || workflowResult.matchedSkills?.length > 0 ? (
                              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                                {workflowResult.strengths?.map((str, idx) => (
                                  <li key={`str-${idx}`} className="flex gap-2 items-start">
                                    <span className="text-emerald-400 shrink-0 mt-1">✦</span>
                                    <span>{str}</span>
                                  </li>
                                ))}
                                {workflowResult.matchedSkills?.map((mSkill, idx) => (
                                  <li key={`mskill-${idx}`} className="flex gap-2 items-start opacity-80">
                                    <span className="text-emerald-500/60 shrink-0 mt-1">✔</span>
                                    <span className="italic">{mSkill}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-500 italic">No matching strengths analyzed.</p>
                            )}
                          </div>

                          {/* Gaps / Missing Skills Column */}
                          <div className="bg-rose-950/5 border border-rose-950/40 rounded-2xl p-5 space-y-3">
                            <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-rose-950/30 pb-2">
                              <AlertTriangle size={13} className="text-rose-400" />
                              <span>Critical Missing Skills & Gaps</span>
                            </h4>
                            {workflowResult.missingSkills?.length > 0 ? (
                              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                                {workflowResult.missingSkills.map((gap, idx) => (
                                  <li key={`gap-${idx}`} className="flex gap-2 items-start">
                                    <span className="text-rose-400 shrink-0 mt-1">✕</span>
                                    <span>{gap}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-500 italic">Perfect Match! No critical profile gaps detected.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Interactive Mindmap Winding Staggered Tree */}
                      <div className="relative border border-slate-800/60 bg-slate-950/20 rounded-3xl p-6 md:p-10 overflow-hidden min-h-[450px]">
                        {/* Winding timeline connector line */}
                        <div className="absolute left-6 md:left-1/2 md:-translate-x-1/2 top-10 bottom-10 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 via-rose-500 via-amber-500 to-emerald-500 opacity-60"></div>

                        <div className="space-y-12 relative">
                          {workflowResult.skills.map((s, idx) => {
                            const isDone = completedMindmapNodes.includes(s.name);
                            const theme = getNodeColorTheme(idx);
                            const isEven = idx % 2 === 0;
                            
                            // Determine difficulty badge colors
                            const difficultyColor = s.difficulty?.toLowerCase() === 'easy'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : s.difficulty?.toLowerCase() === 'medium'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                            return (
                              <div
                                key={idx}
                                className={`flex flex-col md:flex-row md:items-center relative z-10 w-full min-h-[120px] ${
                                  isEven ? 'md:flex-row-reverse' : ''
                                }`}
                              >
                                {/* The Mindmap Card */}
                                <div className="w-full md:w-[calc(50%-2.5rem)] pl-12 md:pl-0">
                                  <div
                                    className={`bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 space-y-3 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] ${
                                      isDone
                                        ? 'border-emerald-500/40 bg-emerald-950/5 shadow-emerald-500/5'
                                        : `${theme.border} ${theme.bg} ${theme.shadow}`
                                    } ${
                                      isEven
                                        ? 'rounded-tr-[35px] rounded-bl-[35px]'
                                        : 'rounded-tl-[35px] rounded-br-[35px]'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-slate-200">{s.name}</h4>
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                            <Clock size={11} /> Est: {s.hours}h
                                          </span>
                                          <span className="text-[10px] text-slate-500">•</span>
                                          <span className={`text-[10px] px-1.5 py-0.2 border rounded-full font-semibold ${difficultyColor}`}>
                                            {s.difficulty || 'Medium'}
                                          </span>
                                        </div>
                                      </div>
                                      {/* Calendar scheduling button removed */}
                                    </div>
                                    {s.resources?.length > 0 && (
                                      <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 leading-relaxed">
                                        <span className="font-semibold text-slate-300 block mb-0.5">Resources:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {s.resources.map((res, rIdx) => (
                                            <span
                                              key={rIdx}
                                              className={`px-2 py-0.5 rounded text-[10px] border ${
                                                isDone
                                                  ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'
                                                  : theme.badge
                                              }`}
                                            >
                                              {res}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Node Center Circle Pin */}
                                <div className="absolute left-2 md:left-1/2 md:-translate-x-1/2 top-4 md:top-auto flex items-center justify-center z-20">
                                  <div
                                    onClick={() => {
                                      setCompletedMindmapNodes(prev =>
                                        prev.includes(s.name) ? prev.filter(n => n !== s.name) : [...prev, s.name]
                                      );
                                    }}
                                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer ring-8 ring-slate-950 transition-all duration-300 ${
                                      isDone
                                        ? 'border-emerald-500 bg-emerald-950/60 text-emerald-400 shadow-md shadow-emerald-500/20'
                                        : `${theme.nodeBorder} bg-slate-900 shadow-md`
                                    }`}
                                  >
                                    {isDone ? <Check size={14} /> : <span className="text-xs font-black">{idx + 1}</span>}
                                  </div>
                                </div>

                                {/* Opposite side Spacer */}
                                <div className="hidden md:block md:w-[calc(50%-2.5rem)]"></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8 border border-slate-800 rounded bg-slate-900/10 text-slate-400 text-xs">
                      No matching roadmap gaps found. Your profile matches all requirements.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Company Intelligence Panel */}
              {activeTab === 'company' && (
                <div className="card space-y-6">
                  {/* Company Info Banner */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center p-2 border-2 shadow-md"
                        style={{
                          backgroundColor: getCompanyColorPalette(job.company).light,
                          borderColor: getCompanyColorPalette(job.company).primary,
                        }}
                      >
                        {(!job.logo || imgFailed) ? (
                          <div className="w-full h-full flex items-center justify-center font-bold text-lg" style={{ color: getCompanyColorPalette(job.company).primary }}>
                            {getCompanyInitials(job.company)}
                          </div>
                        ) : (
                          <img src={job.logo} alt={job.company} className="w-full h-full object-contain" onError={() => setImgFailed(true)} />
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                          {job.company} Intelligence Dashboard
                        </h3>
                        <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Verified Intel from opportunity-intelligence agent
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 text-xs font-bold rounded-full">
                      Verified Insights
                    </span>
                  </div>

                  {/* Corporate Profile Card */}
                  <div className="border border-slate-800 bg-slate-950/20 rounded-2xl p-5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-blue-500 rounded-sm"></span> Corporate Profile & Mission
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {workflowResult.companyIntelligence?.about || `Researching detailed profile details for ${job.company}...`}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-900/30 p-4 rounded-xl border border-slate-800/80">
                      <div className="flex gap-2 items-center">
                        <MapPin size={16} className="text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Locations</span>
                          <span className="text-slate-300 font-semibold">{workflowResult.companyIntelligence?.locations || 'Global Presence'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Users size={16} className="text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-500 block text-[9px] font-bold uppercase tracking-wider">Global Scale / Workforce</span>
                          <span className="text-slate-300 font-semibold">{workflowResult.companyIntelligence?.employee_count || '700,000+ Employees'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Metric 1: Salary */}
                    <div className="border border-slate-800 bg-slate-950/20 rounded-2xl p-5 space-y-3 shadow-md hover:border-slate-700/60 transition-all duration-300">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Banknote size={18} className="text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimated Salary</span>
                      </div>
                      <div className="text-lg font-extrabold text-slate-200">
                        {workflowResult.companyIntelligence?.salary_range || 'Market Rate'}
                      </div>
                      <span className="text-[10px] text-slate-500 block">Estimated base salary for this experience tier.</span>
                    </div>

                    {/* Metric 2: Revenue */}
                    <div className="border border-slate-800 bg-slate-950/20 rounded-2xl p-5 space-y-3 shadow-md hover:border-slate-700/60 transition-all duration-300">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Banknote size={18} className="text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Annual Revenue</span>
                      </div>
                      <div className="text-lg font-extrabold text-slate-200 font-sans">
                        {workflowResult.companyIntelligence?.revenue || 'Market Capitalization'}
                      </div>
                      <span className="text-[10px] text-slate-500 block">Reported annual financial performance scale.</span>
                    </div>

                    {/* Metric 3: Hiring Trend */}
                    <div className="border border-slate-800 bg-slate-950/20 rounded-2xl p-5 space-y-3 shadow-md hover:border-slate-700/60 transition-all duration-300">
                      <div className="flex items-center gap-2 text-slate-400">
                        <TrendingUp size={18} className="text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hiring Activity</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/40 border border-emerald-800/30 text-emerald-300">
                          {workflowResult.companyIntelligence?.hiring_trend || 'Stable'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">Based on recent hiring activity and open roles.</span>
                    </div>
                  </div>

                  {/* Role Compensation & Perks Package */}
                  <div className="border border-slate-800 bg-slate-950/20 rounded-2xl p-5 space-y-3">
                    <h4 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-amber-500 rounded-sm"></span> Package Perks & Benefits
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {workflowResult.companyIntelligence?.role_package_details || 'Standard company healthcare, 401(k) matching, dental, vision, paid leaves, and continuous development allowances.'}
                    </p>
                  </div>

                  {/* Tech Blueprint Banner */}
                  <div className="border border-slate-800 bg-slate-950/20 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-2">
                      <Layers3 size={18} className="text-teal-400" />
                      <span className="text-sm font-bold text-slate-200">Tech Blueprint & Stack</span>
                    </div>
                    {workflowResult.companyIntelligence?.tech_stack?.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {workflowResult.companyIntelligence.tech_stack.map((t, i) => (
                          <div key={i} className="flex gap-2.5 items-start p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl hover:border-slate-700/50 transition-all duration-300">
                            <span className="text-teal-400 shrink-0 mt-0.5">⚡</span>
                            <span className="text-xs font-semibold text-slate-300 leading-normal">{t}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Not specified</span>
                    )}
                  </div>

                  {/* Culture & Interview Deep Dive */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Culture Card */}
                    <div className="border border-slate-800 bg-slate-950/20 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-full -mr-8 -mt-8"></div>
                      <h4 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                        <span className="w-1.5 h-3 bg-indigo-500 rounded-sm"></span> Culture & Work Environment
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed italic">
                        "{workflowResult.companyIntelligence?.culture || 'Professional environment focused on growth and collaborative deliverables.'}"
                      </p>
                    </div>

                    {/* Interview stages timeline card */}
                    <div className="border border-slate-800 bg-slate-950/20 rounded-2xl p-5 space-y-3">
                      <h4 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                        <span className="w-1.5 h-3 bg-teal-500 rounded-sm"></span> Expected Interview Stages
                      </h4>
                      {workflowResult.companyIntelligence?.interview_stages?.length > 0 ? (
                        <div className="space-y-4 pl-2 pr-1">
                          {workflowResult.companyIntelligence.interview_stages.map((stage, idx) => (
                            <div key={idx} className="flex gap-3 relative">
                              {idx < workflowResult.companyIntelligence.interview_stages.length - 1 && (
                                <div className="absolute left-[7px] top-[18px] bottom-[-15px] w-0.5 bg-slate-800"></div>
                              )}
                              <CircleDot size={15} className="text-teal-500 mt-1 shrink-0 bg-slate-950 rounded-full" />
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-200">{stage.name}</span>
                                  {stage.duration && (
                                    <span className="text-[9px] px-1 bg-slate-800 border border-slate-700/80 rounded text-slate-400">
                                      {stage.duration}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed">{stage.focus}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {workflowResult.companyIntelligence?.interview_process || 'Recruiter screening call, followed by standard technical assessment rounds.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Red flags alerts */}
                  {workflowResult.companyIntelligence?.red_flags?.length > 0 && (
                    <div className="rounded-2xl border border-amber-900/40 bg-amber-950/10 p-5 flex gap-3 shadow-md">
                      <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Company Red Flags & Points of Concern</span>
                        <ul className="list-disc list-inside text-xs text-amber-300/90 space-y-1 pl-1">
                          {workflowResult.companyIntelligence.red_flags.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}              {/* TAB 3: Interview Coach */}
              {activeTab === 'interview' && (
                <div className="card space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                        <Sparkles size={18} className="text-cyan-400" />
                        <span>Interview Prep Blueprint</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Custom interview simulator prep with model short answers targeted at your gaps.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!workflowResult) return;
                        let html = `
                          <h1>Interview Prep Blueprint - ${job?.company || 'Company'}</h1>
                          <p><strong>Position:</strong> ${job?.title || 'Role'}</p>
                          <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</p>
                          <hr />
                          
                          <h2>1. Preparation Strategy</h2>
                          <p>${workflowResult.preparationPlan || 'No custom preparation strategy generated.'}</p>
                          
                          <h2>2. Technical Deep-Dives (${localTechQuestions.length} Questions & Answers)</h2>
                        `;
                        
                        if (localTechQuestions.length > 0) {
                          localTechQuestions.forEach((qObj, idx) => {
                            const qText = typeof qObj === 'object' ? qObj.question : qObj;
                            const qAns = typeof qObj === 'object' ? qObj.answer : 'No model answer provided.';
                            html += `
                              <div class="question">Q${idx + 1}: ${qText}</div>
                              <div class="answer"><strong>Suggested Response:</strong> ${qAns}</div>
                            `;
                          });
                        } else {
                          html += `<p>No technical questions generated.</p>`;
                        }
                        
                        html += `<h2>3. Behavioral Prep Qs (${localBehQuestions.length} Questions & Answers)</h2>`;
                        if (localBehQuestions.length > 0) {
                          localBehQuestions.forEach((qObj, idx) => {
                            const qText = typeof qObj === 'object' ? qObj.question : qObj;
                            const qAns = typeof qObj === 'object' ? qObj.answer : 'No model answer provided.';
                            html += `
                              <div class="question">Q${idx + 1}: ${qText}</div>
                              <div class="answer"><strong>Suggested Response:</strong> ${qAns}</div>
                            `;
                          });
                        } else {
                          html += `<p>No behavioral questions generated.</p>`;
                        }
                        
                        downloadDocFile(html, `interview-prep-${job?.company || 'company'}.doc`);
                      }}
                      className="text-xs px-3.5 py-2 rounded-xl border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50 flex items-center gap-1.5 transition-all shadow-md font-semibold"
                    >
                      <Download size={14} /> Export Word (.doc)
                    </button>
                  </div>

                  {workflowResult.preparationPlan ? (
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Preparation Strategy</span>
                      <p className="text-xs text-slate-300 leading-relaxed">{workflowResult.preparationPlan}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Run the workflow to generate interview preparation plan.</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Technical Column */}
                    <div className="border border-slate-800 rounded-2xl p-5 bg-slate-950/20 space-y-4 hover:border-slate-700/50 transition-all duration-300">
                      <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
                        <Layers3 size={16} className="text-violet-400" />
                        <span className="text-sm font-bold text-violet-400">Technical Deep Dives ({localTechQuestions.length})</span>
                      </div>
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {localTechQuestions.length > 0 ? (
                          localTechQuestions.map((qObj, i) => {
                            const qText = typeof qObj === 'object' ? qObj.question : qObj;
                            const qAns = typeof qObj === 'object' ? qObj.answer : null;
                            return (
                              <div key={i} className="space-y-2 border-b border-slate-900/40 pb-3 last:border-b-0 last:pb-0">
                                <div className="flex gap-2">
                                  <span className="text-xs font-extrabold text-slate-500 shrink-0">Q{i + 1}.</span>
                                  <span className="text-xs font-bold text-slate-200">{qText}</span>
                                </div>
                                {qAns && (
                                  <div className="text-[11px] text-slate-300 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 leading-relaxed">
                                    <span className="font-bold text-violet-400 block mb-1 uppercase tracking-wider text-[9px]">Suggested Response:</span>
                                    "{qAns}"
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500 italic">Run workflow to generate questions.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={techLoading}
                        onClick={() => handleLoadMoreQuestions('technical')}
                        className="w-full mt-3 py-2 px-4 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-all font-semibold"
                      >
                        {techLoading ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Loading new questions...
                          </>
                        ) : (
                          <>
                            ➕ Get 10 More Tech Questions
                          </>
                        )}
                      </button>
                    </div>

                    {/* Behavioral Column */}
                    <div className="border border-slate-800 rounded-2xl p-5 bg-slate-950/20 space-y-4 hover:border-slate-700/50 transition-all duration-300">
                      <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
                        <Users size={16} className="text-teal-400" />
                        <span className="text-sm font-bold text-teal-400">Behavioral Prep Qs ({localBehQuestions.length})</span>
                      </div>
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {localBehQuestions.length > 0 ? (
                          localBehQuestions.map((qObj, i) => {
                            const qText = typeof qObj === 'object' ? qObj.question : qObj;
                            const qAns = typeof qObj === 'object' ? qObj.answer : null;
                            return (
                              <div key={i} className="space-y-2 border-b border-slate-900/40 pb-3 last:border-b-0 last:pb-0">
                                <div className="flex gap-2">
                                  <span className="text-xs font-extrabold text-slate-500 shrink-0">Q{i + 1}.</span>
                                  <span className="text-xs font-bold text-slate-200">{qText}</span>
                                </div>
                                {qAns && (
                                  <div className="text-[11px] text-slate-300 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 leading-relaxed">
                                    <span className="font-bold text-teal-400 block mb-1 uppercase tracking-wider text-[9px]">Model Short Response:</span>
                                    "{qAns}"
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500 italic">Run workflow to generate questions.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={behLoading}
                        onClick={() => handleLoadMoreQuestions('behavioral')}
                        className="w-full mt-3 py-2 px-4 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-all font-semibold"
                      >
                        {behLoading ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Loading new questions...
                          </>
                        ) : (
                          <>
                            ➕ Get 10 More Behavioral Questions
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Resume & Cover Letter */}
              {activeTab === 'assets' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Resume suitable suggestions */}
                    {workflowResult.optimizedResume ? (
                      <div className="card space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                          <h4 className="font-extrabold text-slate-100 text-base flex items-center gap-2">
                            <Layers3 className="text-teal-400" size={16} />
                            <span>Resume Suggestions & Role Fit</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const html = `
                                <h1>Resume Suitable for Job Role - Suggestions</h1>
                                <p><strong>Company:</strong> ${job?.company || 'Company'}</p>
                                <p><strong>Position:</strong> ${job?.title || 'Position'}</p>
                                <hr/>
                                <div style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.5; font-size: 13px;">
                                  ${workflowResult.optimizedResume.replace(/\n/g, '<br/>')}
                                </div>
                              `;
                              downloadDocFile(html, `resume-suggestions-${job?.company || 'company'}.doc`);
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-1 font-semibold"
                          >
                            <Download size={12} /> Export Word (.doc)
                          </button>
                        </div>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                          {(() => {
                            const parsedSuggestions = parseResumeSuggestions(workflowResult.optimizedResume);
                            
                            if (parsedSuggestions.length > 0) {
                              return parsedSuggestions.map((item, idx) => (
                                <div key={idx} className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 space-y-3">
                                  <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                                    <span className="text-xs font-bold text-teal-400">
                                      📁 {item.section}
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {item.original && item.original !== '(none)' && (
                                      <div className="text-[11px] bg-slate-900/30 p-2.5 rounded-lg border border-slate-900/80">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Original Content</span>
                                        <span className="text-slate-400 line-through decoration-rose-500/40 select-text block">{item.original}</span>
                                      </div>
                                    )}
                                    <div className="text-[11px] bg-emerald-950/5 p-2.5 rounded-lg border border-emerald-950/20 flex flex-col justify-between gap-2">
                                      <div>
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Suggested (Copy & Paste)</span>
                                        <span className="text-slate-200 select-text block leading-relaxed font-mono">{item.suggested}</span>
                                      </div>
                                      <div className="flex justify-end">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(item.suggested);
                                            setCopiedSuggestionId(idx);
                                            setTimeout(() => setCopiedSuggestionId(null), 2000);
                                          }}
                                          className="text-[10px] px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold transition-all flex items-center gap-1"
                                        >
                                          {copiedSuggestionId === idx ? (
                                            <>
                                              <Check size={10} /> Copied!
                                            </>
                                          ) : (
                                            <>
                                              <Copy size={10} /> Copy Text
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  {item.why && (
                                    <div className="text-[10px] text-slate-400 bg-slate-900/10 p-2 rounded-lg border border-slate-900 leading-normal flex items-start gap-1">
                                      <span className="text-teal-400 shrink-0">💡</span>
                                      <span>{item.why}</span>
                                    </div>
                                  )}
                                </div>
                              ));
                            }
                            
                            // Fallback to plain markdown
                            return (
                              <div className="text-xs text-slate-300 max-h-[500px] overflow-y-auto bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 leading-relaxed font-sans shadow-inner">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-3 pl-1 mb-4" {...props} />,
                                    li: ({node, ...props}) => <li className="text-slate-300 leading-relaxed" {...props} />,
                                    strong: ({node, ...props}) => <strong className="text-teal-400 font-bold" {...props} />,
                                  }}
                                >
                                  {workflowResult.optimizedResume}
                                </ReactMarkdown>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="card text-center p-8">
                        <span className="font-bold text-slate-500 text-sm block mb-2">Resume Suggestions</span>
                        <p className="text-xs text-slate-500 italic">Run workflow to generate resume suggestions.</p>
                      </div>
                    )}

                    {/* Cover Letter card */}
                    {workflowResult.coverLetter ? (
                      <div className="card space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                          <h4 className="font-extrabold text-slate-100 text-base flex items-center gap-2">
                            <FileText className="text-violet-400" size={16} />
                            <span>Generated Cover Letter</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const html = `
                                <h1>Cover Letter - ${job?.company || 'Company'}</h1>
                                <p><strong>Position:</strong> ${job?.title || 'Position'}</p>
                                <hr/>
                                <div style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.5; font-size: 13px; margin-top: 20px;">
                                  ${workflowResult.coverLetter.replace(/\n/g, '<br/>')}
                                </div>
                              `;
                              downloadDocFile(html, `cover-letter-${job?.company || 'company'}.doc`);
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-1 font-semibold"
                          >
                            <Download size={12} /> Export Word (.doc)
                          </button>
                        </div>
                        <div className="text-xs text-slate-400 whitespace-pre-wrap max-h-[500px] overflow-y-auto bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 leading-relaxed font-sans shadow-inner">
                          {workflowResult.coverLetter}
                        </div>
                      </div>
                    ) : (
                      <div className="card text-center p-8">
                        <span className="font-bold text-slate-500 text-sm block mb-2">Generated Cover Letter</span>
                        <p className="text-xs text-slate-500 italic">Run workflow to generate cover letter.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: Application Tasks & Checklist */}
              {activeTab === 'checklist' && (
                <div className="card space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-4">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                        <ListTodo size={20} className="text-teal-400" />
                        <span>Application Checklist & Tasks</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Manage application milestones.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setLocalChecklist(prev => [
                            ...prev,
                            {
                              id: `task-custom-${Date.now()}`,
                              text: '',
                              completed: false
                            }
                          ]);
                        }}
                        className="text-xs px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-1.5 transition-all font-semibold"
                      >
                        + Add Custom Task
                      </button>
                    </div>
                  </div>

                  {localChecklist.length > 0 ? (
                    <div className="space-y-3">
                      {localChecklist.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl border transition-all duration-300 ${
                            task.completed
                              ? 'bg-slate-900/20 border-slate-900/60 opacity-60'
                              : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/60'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={(e) => {
                                setLocalChecklist(prev =>
                                  prev.map(t => t.id === task.id ? { ...t, completed: e.target.checked } : t)
                                );
                              }}
                              className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-teal-600 focus:ring-teal-500 focus:ring-offset-slate-950"
                            />
                            {/* Editable Input Text */}
                            <input
                              type="text"
                              value={task.text}
                              onChange={(e) => {
                                setLocalChecklist(prev =>
                                  prev.map(t => t.id === task.id ? { ...t, text: e.target.value } : t)
                                );
                              }}
                              disabled={task.completed}
                              className={`bg-transparent border-0 border-b border-transparent focus:border-slate-700 focus:ring-0 p-0 text-xs text-slate-200 w-full transition-all focus:bg-slate-950/30 px-1 rounded ${
                                task.completed ? 'line-through text-slate-500' : ''
                              }`}
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setLocalChecklist(prev => prev.filter(t => t.id !== task.id));
                              }}
                              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-500 hover:text-rose-400 hover:border-rose-950/50 transition-all"
                              title="Delete Task"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 border border-slate-800 rounded-2xl bg-slate-900/10 text-slate-500 text-xs italic">
                      No tasks found. Click "+ Add Custom Task" to get started.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Decision Hub Card */}
          {workflowResult && (
            <div className="card border-teal-500/20 bg-gradient-to-br from-slate-900 to-slate-950 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-900 pb-3">
                <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="text-teal-400" size={16} />
                  <span>Workflow Decision Hub & Next Steps</span>
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full border border-teal-500/20 bg-teal-950/20 text-teal-400 font-bold flex items-center gap-1">
                  ✓ Autosaved to Applications Tracker
                </span>
              </div>

              {workflowResult.runSummary && (
                <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                  <span className="font-semibold text-slate-300 block mb-1">Agent Memory Run Summary:</span>
                  {workflowResult.runSummary}
                </p>
              )}

              {workflowResult.keyAction && (
                <div className="bg-teal-950/10 border border-teal-500/20 rounded-xl p-3 flex gap-2">
                  <Sparkles className="text-teal-400 shrink-0 mt-0.5" size={14} />
                  <div>
                    <span className="text-xs font-bold text-teal-300 block">Top Recommended Action:</span>
                    <p className="text-xs text-teal-400/90 leading-relaxed mt-0.5">{workflowResult.keyAction}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {workflowState === 'APPROVAL_NEEDED' && (
                  <button
                    type="button"
                    onClick={approveApplication}
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    Willing to Apply: Approve & Submit
                  </button>
                )}

                {workflowResult.skills?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('roadmap');
                      const element = document.getElementById('interactive-tabs-header');
                      if (element) element.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex-1 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700/80 text-slate-200 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Brain size={14} className="text-violet-400" />
                    Review Learning Roadmap Gaps
                  </button>
                )}

                <button
                  type="button"
                  onClick={exportFullAnalysisReport}
                  className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-indigo-500 hover:from-teal-400 hover:to-indigo-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-teal-500/10 transition-all flex items-center justify-center gap-1.5"
                >
                  <Download size={14} />
                  Export Full Analysis Report (.doc)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Hand: AI Workflow Control and Agent Console */}
        <div className="space-y-4">
          <div className="card border-teal-500/30 bg-slate-900/80 sticky top-6 max-h-[92vh] overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center">
                  <Sparkles className="text-teal-400 mr-2" size={18} /> 4-Agent Pipeline
                </h2>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${workflowResult?.source === 'lemma'
                    ? 'border-emerald-500/50 bg-emerald-900/30 text-emerald-300'
                    : workflowResult?.source === 'gemini'
                      ? 'border-amber-500/50 bg-amber-900/30 text-amber-300'
                      : lemmaStatus?.connected
                        ? 'border-teal-500/40 text-teal-300'
                        : 'border-rose-500/50 text-rose-300'
                  }`}>
                  {workflowResult?.source === 'lemma' ? 'Lemma' : workflowResult?.source === 'gemini' ? 'Gemini' : lemmaStatus?.connected ? 'Ready' : 'Offline'}
                </span>
              </div>

              {workflowState === 'IDLE' && (
                <div className="space-y-4">
                  <textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste resume or upload from Resume page..."
                    className="w-full min-h-[120px] rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-xs text-slate-300 focus:border-teal-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Orchestrates a 4-Agent event workflow: Memory initialization ➔ Opportunity matching ➔ Mentor roadmap mapping ➔ Application strategy checklists.
                  </p>
                  {workflowError && <div className="text-xs text-rose-400 border border-rose-800/50 rounded-lg p-2.5 bg-rose-950/20">{workflowError}</div>}
                  <button type="button" onClick={startWorkflow} className="btn-primary w-full py-2.5 text-xs">Launch Workflow</button>
                </div>
              )}

              {workflowState !== 'IDLE' && (
                <div className="space-y-3">
                  {/* Step indicators */}
                  {AGENT_STEPS.map((step, i) => {
                    const isDone = workflowState === 'COMPLETE' || workflowState === 'APPROVAL_NEEDED' || !!workflowResult || (workflowState === 'RUNNING' && completedAgents.includes(step.key));
                    const isCurrent = workflowState === 'RUNNING' && !isDone && (i === 0 || completedAgents.includes(AGENT_STEPS[i - 1].key));
                    const isPending = !isDone && !isCurrent;
                    const Icon = step.icon;
                    return (
                      <div key={step.key} className="flex gap-2 items-center text-xs">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${isDone
                            ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                            : isCurrent
                              ? 'border-teal-500 text-teal-300 animate-pulse'
                              : 'border-slate-800 text-slate-600'
                          }`}>
                          {isDone ? <Check size={11} /> : isCurrent ? <Loader2 size={10} className="animate-spin" /> : <span>{i + 1}</span>}
                        </div>
                        <div className={`flex-1 flex justify-between items-center border rounded-lg px-2.5 py-1.5 transition-all ${isDone
                            ? 'border-emerald-900/40 bg-emerald-950/10'
                            : isCurrent
                              ? 'border-teal-700/50 bg-teal-950/10'
                              : 'border-slate-800 bg-slate-900/20'
                          }`}>
                          <span className={`font-semibold flex items-center gap-1.5 ${isPending ? 'text-slate-500' : 'text-slate-200'}`}>
                            <Icon size={12} className={step.color} />
                            {step.label}
                          </span>
                          {isDone && workflowResult?.reasoningGraph?.[step.key] && (
                            <button
                              type="button"
                              onClick={() => setSelectedNode(step.key)}
                              className="text-[9px] text-teal-400 font-bold hover:underline"
                            >
                              Inspect
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Cache and execution metadata */}
                  {workflowResult && (
                    <div className="mt-4 border-t border-slate-800/80 pt-4 space-y-3">
                      {/* Match metric card */}
                      <div className="rounded-xl border border-teal-800/40 bg-teal-950/10 p-3 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-0.5">Overall Fit Match</span>
                          <span className="text-xl font-bold text-teal-400">{workflowResult.matchScore}%</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-800 bg-emerald-950/30 text-emerald-300 font-mono">
                          {workflowResult.source === 'cache' ? 'CACHED' : 'COMPUTED'}
                        </span>
                      </div>

                      {/* Google Tasks Checklist removed */}

                      {/* Launch Career Mentor Chat button */}
                      <button
                        type="button"
                        onClick={() => setIsMentorOpen(prev => !prev)}
                        className="w-full py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-teal-500/10"
                      >
                        <MessageSquare size={13} />
                        {isMentorOpen ? 'Close Mentor Chat' : 'Ask Career Mentor'}
                      </button>

                      {workflowState === 'APPROVAL_NEEDED' && (
                        <button type="button" onClick={approveApplication} className="btn-primary w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-xs">
                          Approve & Apply
                        </button>
                      )}

                      {workflowState === 'COMPLETE' && (
                        <div className="text-center text-emerald-400 font-semibold flex items-center justify-center gap-1.5 text-xs py-1">
                          <CheckCircle2 size={14} /> Saved to applications tracker
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setWorkflowResult(null);
                          setWorkflowState('IDLE');
                          setCompletedAgents([]);
                        }}
                        className="w-full py-2 text-[10px] border border-slate-800 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-950/30 transition-all font-semibold"
                      >
                        🔄 Re-run Workflow (Force Refresh)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* Unconnected warning modal removed */}
    </div>
  );
}
