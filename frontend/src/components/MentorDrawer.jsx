import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Send, Sparkles, AlertTriangle, CheckCircle2, Loader2, X, 
  ExternalLink, Layers, Brain
} from 'lucide-react';
import { chatWithJobCoPilot, getConnectorsStatus, scheduleStudyRoadmap } from '../api';

const tryFormatMentorJson = (content) => {
  if (!content) return '';
  try {
    const trimmed = content.trim();
    // Clean markdown code blocks if any
    const cleaned = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
      const parsed = JSON.parse(cleaned);
      let markdown = '';

      // 1. Format Skills
      if (parsed.skills && Array.isArray(parsed.skills) && parsed.skills.length > 0) {
        markdown += `### 📚 Study & Prep Roadmap\n\n`;
        markdown += `| Skill / Subject | Difficulty | Estimated Time | Recommended Resources |\n`;
        markdown += `| :--- | :--- | :--- | :--- |\n`;
        parsed.skills.forEach(skill => {
          const diffEmoji = skill.difficulty === 'Hard' ? '🔴' : skill.difficulty === 'Medium' ? '🟡' : '🟢';
          const resourcesList = skill.resources && Array.isArray(skill.resources) 
            ? skill.resources.map(r => `\`${r}\``).join(', ') 
            : 'General web resources';
          markdown += `| **${skill.name}** | ${diffEmoji} ${skill.difficulty || 'Medium'} | \`${skill.hours || 0} hours\` | ${resourcesList} |\n`;
        });
        markdown += `\n`;
      }

      // 2. Format ATS Suggestions
      if (parsed.ats_suggestions && Array.isArray(parsed.ats_suggestions) && parsed.ats_suggestions.length > 0) {
        markdown += `### 🔍 ATS Optimization Suggestions\n\n`;
        parsed.ats_suggestions.forEach(suggestion => {
          markdown += `- ${suggestion}\n`;
        });
        markdown += `\n`;
      }

      // 3. Format Keyword Suggestions
      if (parsed.keyword_suggestions && Array.isArray(parsed.keyword_suggestions) && parsed.keyword_suggestions.length > 0) {
        markdown += `### 🔑 Target Keywords to Add\n\n`;
        markdown += parsed.keyword_suggestions.map(kw => `\`${kw}\``).join('  ') + `\n\n`;
      }

      // 4. Format Optimized Resume / Suggestion Text
      if (parsed.optimized_resume) {
        markdown += `### 📝 Tailored Resume Sections & Bullets\n\n`;
        markdown += `${parsed.optimized_resume}\n`;
      }

      if (markdown) {
        return markdown;
      }
    }
  } catch (e) {
    // Fail silently and return original text
  }
  return content;
};

export default function MentorDrawer({ job, isOpen, onClose }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [connectors, setConnectors] = useState({ gmail: true, google_calendar: true, googletasks: false });
  const [toast, setToast] = useState(null);
  const [unconnectedApp, setUnconnectedApp] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [showConnectors, setShowConnectors] = useState(false);
  const chatBottomRef = useRef(null);

  // Initialize messages and load connectors
  useEffect(() => {
    if (job) {
      setChatMessages([
        { 
          role: 'assistant', 
          content: `Hi Anand! I am your Career Mentor for the ${job.title} role at ${job.company}. Let's optimize your roadmap, talk strategy, or schedule some study sessions. What would you like to discuss today?` 
        }
      ]);
    }
    
    getConnectorsStatus()
      .then(setConnectors)
      .catch(err => console.warn('Failed to load connector status in drawer:', err));
  }, [job]);

  // Auto scroll chat
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatLoading, isOpen]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSendMessage = async (textOverride) => {
    const messageToSend = textOverride || chatInput;
    if (!messageToSend.trim() || chatLoading) return;

    if (!textOverride) {
      setChatInput('');
    }

    const updatedMessages = [...chatMessages, { role: 'user', content: messageToSend }];
    setChatMessages(updatedMessages);
    setChatLoading(true);

    try {
      const response = await chatWithJobCoPilot(messageToSend, updatedMessages, job?.id, {
        title: job?.title,
        company: job?.company,
        description: job?.description,
      });
      let responseText = response.reply || '';

      // Dynamic simulated action parsing (e.g. scheduling blocks)
      if (responseText.includes('[ACTION_TRIGGER:')) {
        const match = responseText.match(/\[ACTION_TRIGGER:\s*(\{.*?\})\s*\]/);
        if (match && match[1]) {
          try {
            const act = JSON.parse(match[1]);
            if (act.action === 'schedule') {
              responseText = responseText.replace(
                match[0], 
                `\n\n*📅 Suggested study plan scheduled in calendar: ${act.skill} (${act.hours} hours)*`
              );
              if (!connectors.google_calendar) {
                setUnconnectedApp('google_calendar');
                setPendingAction(act);
              } else {
                await scheduleStudyRoadmap(act.skill, act.hours, job.company, job.title);
                showToast(`📅 Scheduled study block for ${act.skill}`);
              }
            }
          } catch (e) {
            console.error('Error parsing simulated calendar action:', e);
          }
        }
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I hit a rate limit. Please try again in a few seconds!' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleMockAction = async () => {
    const app = unconnectedApp;
    setUnconnectedApp(null);
    
    if (app === 'google_calendar' && pendingAction) {
      try {
        await scheduleStudyRoadmap(pendingAction.skill, pendingAction.hours, job.company, job.title);
        showToast(`📅 Calendar Mock Synced! Scheduled ${pendingAction.hours}h.`);
      } catch (err) {
        showToast('❌ Mock Calendar failed.');
      }
    } else if (app === 'googletasks') {
      showToast('✅ Synced task with database mock.');
    } else if (app === 'gmail') {
      showToast('📨 Draft created in local mail database.');
    }
    
    setPendingAction(null);
  };

  const handleSuggestionClick = (text) => {
    handleSendMessage(text);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-slate-950/95 border-l border-slate-800/80 backdrop-blur-xl shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Brain size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100">Career Mentor</h1>
              <p className="text-[10px] text-slate-400 max-w-[280px] truncate">
                Context: {job?.title} at {job?.company}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Collapsible Connector Hub */}
        <div className="border-b border-slate-800/60 bg-slate-900/30">
          <button 
            onClick={() => setShowConnectors(!showConnectors)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="text-teal-400 animate-pulse" size={13} />
              <span className="font-semibold text-[11px]">⚡ Lemma Connector Hub</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500">{showConnectors ? 'Hide details' : 'Show details'}</span>
              <div className="flex gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${connectors.google_calendar ? 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]' : 'bg-amber-400'}`} title="Calendar" />
                <span className={`w-1.5 h-1.5 rounded-full ${connectors.googletasks ? 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]' : 'bg-amber-400'}`} title="Tasks" />
                <span className={`w-1.5 h-1.5 rounded-full ${connectors.gmail ? 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]' : 'bg-amber-400'}`} title="Gmail" />
              </div>
            </div>
          </button>
          
          {showConnectors && (
            <div className="px-4 pb-3 pt-1 border-t border-slate-900 bg-slate-950/60 space-y-2 animate-slide-in">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900/80 border border-slate-800/60 p-2 rounded-xl text-center">
                  <p className="text-[10px] text-slate-400 mb-0.5">Calendar</p>
                  <span className={`text-[9px] font-bold ${connectors.google_calendar ? 'text-teal-400' : 'text-amber-400'}`}>
                    {connectors.google_calendar ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800/60 p-2 rounded-xl text-center">
                  <p className="text-[10px] text-slate-400 mb-0.5">Tasks</p>
                  <span className={`text-[9px] font-bold ${connectors.googletasks ? 'text-teal-400' : 'text-amber-400'}`}>
                    {connectors.googletasks ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800/60 p-2 rounded-xl text-center">
                  <p className="text-[10px] text-slate-400 mb-0.5">Gmail Surface</p>
                  <span className={`text-[9px] font-bold ${connectors.gmail ? 'text-teal-400' : 'text-amber-400'}`}>
                    {connectors.gmail ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
              </div>
              
              {(!connectors.google_calendar || !connectors.googletasks || !connectors.gmail) && (
                <a
                  href="https://lemma.work/connectors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-300 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  🔌 Link Google Accounts <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
          {chatMessages.map((m, idx) => (
            <div 
              key={idx} 
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed border ${
                  m.role === 'user' 
                    ? 'bg-teal-600/15 border-teal-500/20 text-teal-100 rounded-br-none' 
                    : 'bg-slate-900 border-slate-800/80 text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                {m.role === 'assistant' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-teal-300">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-1">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      code: ({ inline, children }) => inline 
                        ? <code className="bg-slate-950 px-1 py-0.5 rounded text-teal-300 font-mono text-[10px]">{children}</code>
                        : <code className="block bg-slate-950 p-2 rounded text-teal-300 font-mono text-[10px] whitespace-pre-wrap overflow-x-auto">{children}</code>,
                      table: ({ children }) => <div className="my-3 overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40"><table className="w-full border-collapse text-[10px] text-slate-350">{children}</table></div>,
                      th: ({ children }) => <th className="border-b border-slate-800 bg-slate-900/80 px-2.5 py-2 text-left font-bold text-teal-400">{children}</th>,
                      td: ({ children }) => <td className="border-b border-slate-850 px-2.5 py-2 align-middle text-slate-300">{children}</td>,
                    }}
                  >
                    {tryFormatMentorJson(m.content)}
                  </ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start items-center gap-1.5 text-xs text-slate-500 pl-1">
              <Loader2 size={12} className="animate-spin text-teal-400" />
              Mentor thinking...
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Suggestion Bubbles */}
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-900/60 flex gap-2 overflow-x-auto">
          <button 
            onClick={() => handleSuggestionClick(`Review my resume context and suggest optimizations for the ${job?.title} role`)}
            className="shrink-0 text-[10px] border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-700 px-3 py-1.5 rounded-full transition-all"
          >
            🔍 Resume review
          </button>
          <button 
            onClick={() => handleSuggestionClick(`Draft an outreach message to a recruiter at ${job?.company} for the ${job?.title} role`)}
            className="shrink-0 text-[10px] border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-700 px-3 py-1.5 rounded-full transition-all"
          >
            ✉️ Outreach template
          </button>
          <button 
            onClick={() => handleSuggestionClick(`Recommend a study roadmap for the missing skills for the ${job?.title} role`)}
            className="shrink-0 text-[10px] border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-700 px-3 py-1.5 rounded-full transition-all"
          >
            📚 Study Roadmap
          </button>
          <button 
            onClick={() => handleSuggestionClick(`Give me some sample interview questions for the ${job?.title} role at ${job?.company}`)}
            className="shrink-0 text-[10px] border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-700 px-3 py-1.5 rounded-full transition-all"
          >
            💼 Interview Prep
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex gap-2 shrink-0">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask Career Mentor about this job context..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 placeholder-slate-500"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={chatLoading}
            className="px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-all disabled:opacity-50"
          >
            <Send size={13} />
          </button>
        </div>
      </div>

      {/* Unconnected App Warning Modal */}
      {unconnectedApp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold text-slate-100">
                {unconnectedApp === 'google_calendar' ? 'Connect Google Calendar' : unconnectedApp === 'googletasks' ? 'Connect Google Tasks' : 'Connect Gmail'}
              </h3>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              CareerOS uses real Lemma Connectors to sync with your Google workspace. 
              You haven't linked your Google account for this app in your Lemma Pod yet.
            </p>
            
            <div className="flex gap-2">
              <a
                href="https://lemma.work/connectors"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setUnconnectedApp(null)}
                className="flex-1 py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-teal-500/10"
              >
                🔌 Open Connectors dashboard
              </a>
              <button
                type="button"
                onClick={handleMockAction}
                className="py-2 px-4 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Skip and Mock
              </button>
            </div>
            
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setUnconnectedApp(null);
                  setPendingAction(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[70] bg-teal-500 border border-teal-400/30 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs transition-all duration-300 animate-slide-in">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </>
  );
}
