import React, { useState, useEffect, useRef } from 'react';
import { getMemory, chatWithJobCoPilot, getJobs } from '../api';
import { 
  Send, Sparkles, AlertTriangle, ShieldCheck, CheckCircle2, 
  HelpCircle, MessageSquare, Loader2, ArrowRight, Layers, LogIn, ExternalLink
} from 'lucide-react';

export default function MentorChat() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hi there! I am your Career Mentor. Let's optimize your roadmap, talk strategy, or schedule some study sessions. What would you like to build today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [toast, setToast] = useState(null);
  const chatBottomRef = useRef(null);

  // Load jobs and resume
  useEffect(() => {
    getJobs().then(res => {
      const jobsList = res?.jobs || res || [];
      setJobs(jobsList);
      if (jobsList && jobsList.length > 0) {
        setSelectedJob(jobsList[0]);
      }
    }).catch(console.error);

    getMemory().then(m => {
      if (m?.resume_text) setResumeText(m.resume_text);
    }).catch(console.error);
  }, []);

  // Auto scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const history = chatMessages.map(m => `${m.role === 'user' ? 'Candidate' : 'Mentor'}: ${m.content}`).join('\n');
      const response = await chatWithJobCoPilot(userMsg, history, selectedJob?.id || 'general');
      
      // Dynamic simulated action parsing
      let responseText = response.reply || '';
      
      // Parse for simulated scheduling trigger
      if (responseText.includes('[ACTION_TRIGGER:')) {
        const match = responseText.match(/\[ACTION_TRIGGER:\s*(\{.*?\})\s*\]/);
        if (match && match[1]) {
          try {
            const act = JSON.parse(match[1]);
            if (act.action === 'schedule') {
              responseText = responseText.replace(match[0], `\n\n*📅 Suggested study plan scheduled: ${act.skill} (${act.hours} hours)*`);
              showToast(`📅 Scheduled study block for ${act.skill}`);
            }
          } catch(e) {}
        }
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch(err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I hit a rate limit. Please try again in a few seconds!' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar with Connectors Status & Context Selection */}
      <div className="lg:col-span-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col space-y-6">
        <div>
          <h2 className="text-md font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Layers className="text-teal-400" size={16} />
            Target Context
          </h2>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            All mentor queries are processed using your current resume and selected job requirements.
          </p>
          <select 
            value={selectedJob?.id || ''}
            onChange={(e) => {
              const j = jobs.find(job => job.id === e.target.value);
              setSelectedJob(j);
              showToast(`🎯 Context switched to ${j ? j.title : 'General'}`);
            }}
            className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-teal-500"
          >
            {jobs.map(job => (
              <option key={job.id} value={job.id}>{job.title} - {job.company}</option>
            ))}
            <option value="">General Mentor Session</option>
          </select>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="lg:col-span-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden relative">
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            <h1 className="text-sm font-bold text-slate-100">Career Mentor</h1>
          </div>
          <span className="text-[10px] text-slate-500">Powered by system:lemma (DeepSeek Flash)</span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.map((m, idx) => (
            <div 
              key={idx} 
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-line border ${
                  m.role === 'user' 
                    ? 'bg-teal-600/15 border-teal-500/20 text-teal-100 rounded-br-none' 
                    : 'bg-slate-950/60 border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start items-center gap-1.5 text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin text-teal-400" />
              Mentor thinking...
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Suggestion Bubble Helpers */}
        <div className="px-4 py-2 bg-slate-950/20 border-t border-slate-900 flex gap-2 overflow-x-auto">
          <button 
            onClick={() => setChatInput('Review my resume context and suggest optimizations')}
            className="shrink-0 text-[10px] border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 px-3 py-1 rounded-full transition-colors"
          >
            🔍 Resume review
          </button>
          <button 
            onClick={() => setChatInput('Draft an outreach message to a recruiter at ' + (selectedJob?.company || 'Accenture'))}
            className="shrink-0 text-[10px] border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 px-3 py-1 rounded-full transition-colors"
          >
            ✉️ Outreach template
          </button>
          <button 
            onClick={() => setChatInput('Recommend a study roadmap for the missing skills')}
            className="shrink-0 text-[10px] border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 px-3 py-1 rounded-full transition-colors"
          >
            📚 Study Roadmap
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex gap-3">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask anything about your target role, preparation strategy..."
            className="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-teal-500 placeholder-slate-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={chatLoading}
            className="px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-all disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-teal-500 border border-teal-400/30 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs transition-all duration-300 animate-slide-in">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
