import React, { useState } from 'react';
import { ArrowLeft, Save, Sparkles, Award, Play, Check, ChevronDown, ChevronUp, Printer, Loader2, ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';
import { ModernATS, Minimal, GoogleStyle, PrintStylesheet } from './Templates';
import { aiScanResume, aiSectionAssist } from '../../api';

export default function ResumeEditorView({ initialVersion, onSave, onBack }) {
  const [version, setVersion] = useState(initialVersion);
  const [activeAccordion, setActiveAccordion] = useState('summary');
  const [template, setTemplate] = useState(version.template || 'Modern ATS');
  const [saving, setSaving] = useState(false);

  // ATS scanner states
  const [showScanPanel, setShowScanPanel] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState({
    ats_score: version.ats_score || 0,
    ats_suggestions: version.ats_suggestions || [],
    keyword_suggestions: version.keyword_suggestions || []
  });

  // AI section assistant states
  const [assistantIdx, setAssistantIdx] = useState(null); // index of experience/project being edited
  const [assistantBulletIdx, setAssistantBulletIdx] = useState(null); // index of bullet
  const [assistantType, setAssistantType] = useState(''); // 'summary', 'experience', 'projects'
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistOutput, setAssistOutput] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...version,
        template,
        ats_score: scanResult.ats_score,
        ats_suggestions: scanResult.ats_suggestions,
        keyword_suggestions: scanResult.keyword_suggestions
      });
    } catch (e) {
      alert('Failed to save resume version.');
    }
    setSaving(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleScan = async () => {
    if (!jobDescription.trim()) return;
    setScanning(true);
    try {
      const res = await aiScanResume(version.id, jobDescription);
      setScanResult(res);
      setVersion(prev => ({
        ...prev,
        ats_score: res.ats_score,
        ats_suggestions: res.ats_suggestions,
        keyword_suggestions: res.keyword_suggestions
      }));
    } catch (e) {
      alert('ATS scan failed. Please try again.');
    }
    setScanning(false);
  };

  const triggerAIAssist = async (type, index, bulletIndex, text, action) => {
    setAssistLoading(true);
    setAssistantType(type);
    setAssistantIdx(index);
    setAssistantBulletIdx(bulletIndex);
    setAssistOutput('');
    try {
      const res = await aiSectionAssist(type, text, action, version.target_role);
      setAssistOutput(res.suggestion || '');
    } catch (e) {
      setAssistOutput('AI help failed. Please try again.');
    }
    setAssistLoading(false);
  };

  const applyAISuggestion = () => {
    if (!assistOutput) return;
    if (assistantType === 'summary') {
      setVersion(prev => ({ ...prev, summary: assistOutput }));
    } else if (assistantType === 'experience') {
      const list = [...(version.experience || [])];
      list[assistantIdx].description[assistantBulletIdx] = assistOutput;
      setVersion(prev => ({ ...prev, experience: list }));
    } else if (assistantType === 'projects') {
      const list = [...(version.projects || [])];
      list[assistantIdx].description[assistantBulletIdx] = assistOutput;
      setVersion(prev => ({ ...prev, projects: list }));
    }
    closeAssistant();
  };

  const closeAssistant = () => {
    setAssistantIdx(null);
    setAssistantBulletIdx(null);
    setAssistantType('');
    setAssistOutput('');
  };

  // Reorder experience/projects/education
  const moveItem = (listKey, idx, direction) => {
    const list = [...(version[listKey] || [])];
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= list.length) return;
    const temp = list[idx];
    list[idx] = list[newIdx];
    list[newIdx] = temp;
    setVersion(prev => ({ ...prev, [listKey]: list }));
  };

  const updateExperienceBullet = (expIdx, bIdx, val) => {
    const list = [...(version.experience || [])];
    list[expIdx].description[bIdx] = val;
    setVersion(prev => ({ ...prev, experience: list }));
  };

  const updateProjectBullet = (projIdx, bIdx, val) => {
    const list = [...(version.projects || [])];
    list[projIdx].description[bIdx] = val;
    setVersion(prev => ({ ...prev, projects: list }));
  };

  const toggleAccordion = (sec) => {
    setActiveAccordion(prev => (prev === sec ? null : sec));
  };

  return (
    <div className="space-y-6">
      {/* Stylesheet needed for printing standard sizes */}
      <PrintStylesheet />

      {/* Editor Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-100 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-100">{version.name}</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Role Tailored: {version.target_role}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Template Select */}
          <select 
            value={template} 
            onChange={(e) => setTemplate(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-350 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500"
          >
            <option value="Modern ATS">Modern ATS</option>
            <option value="Minimal">Minimal Style</option>
            <option value="Google Style">Google Style</option>
          </select>

          <button onClick={handlePrint} className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5">
            <Printer size={13} /> Print / PDF
          </button>

          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save Version
          </button>
        </div>
      </div>

      {/* Split Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Section-Based Form Accordions */}
        <div className="space-y-4 max-h-[800px] overflow-y-auto pr-1">
          {/* Summary Accordion */}
          <div className="card border-slate-800/80 p-0 overflow-hidden">
            <button 
              onClick={() => toggleAccordion('summary')} 
              className="w-full px-5 py-4 flex justify-between items-center bg-slate-900/40 text-xs font-bold text-slate-200"
            >
              <span>PROFESSIONAL SUMMARY</span>
              {activeAccordion === 'summary' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {activeAccordion === 'summary' && (
              <div className="p-4 space-y-3">
                <textarea
                  className="input-field text-xs min-h-[120px] font-sans"
                  value={version.summary || ''}
                  onChange={(e) => setVersion(prev => ({ ...prev, summary: e.target.value }))}
                />
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => triggerAIAssist('summary', null, null, version.summary, 'quantify')} className="text-[10px] text-teal-400 bg-teal-500/5 hover:bg-teal-500/10 px-2 py-1 rounded border border-teal-500/10 flex items-center gap-1"><Sparkles size={10} /> Add Metrics</button>
                  <button type="button" onClick={() => triggerAIAssist('summary', null, null, version.summary, 'shorten')} className="text-[10px] text-teal-400 bg-teal-500/5 hover:bg-teal-500/10 px-2 py-1 rounded border border-teal-500/10 flex items-center gap-1"><Sparkles size={10} /> Shorten</button>
                </div>
              </div>
            )}
          </div>

          {/* Work Experience Accordion */}
          <div className="card border-slate-800/80 p-0 overflow-hidden">
            <button 
              onClick={() => toggleAccordion('experience')} 
              className="w-full px-5 py-4 flex justify-between items-center bg-slate-900/40 text-xs font-bold text-slate-200"
            >
              <span>EXPERIENCE BULLETS</span>
              {activeAccordion === 'experience' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {activeAccordion === 'experience' && (
              <div className="p-4 space-y-4">
                {(version.experience || []).map((exp, expIdx) => (
                  <div key={expIdx} className="bg-slate-950/40 p-3.5 border border-slate-850 rounded-xl space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-300">{exp.role} at {exp.company}</span>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => moveItem('experience', expIdx, 'up')} disabled={expIdx === 0} className="p-0.5 text-slate-400 disabled:opacity-20 hover:text-teal-400"><ArrowUp size={11} /></button>
                        <button type="button" onClick={() => moveItem('experience', expIdx, 'down')} disabled={expIdx === version.experience.length - 1} className="p-0.5 text-slate-400 disabled:opacity-20 hover:text-teal-400"><ArrowDown size={11} /></button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(exp.description || []).map((bullet, bIdx) => (
                        <div key={bIdx} className="space-y-1">
                          <input 
                            type="text" 
                            className="input-field py-1.5 px-2.5 text-xs font-sans w-full"
                            value={bullet}
                            onChange={(e) => updateExperienceBullet(expIdx, bIdx, e.target.value)}
                          />
                          <div className="flex gap-1.5 justify-end">
                            <button type="button" onClick={() => triggerAIAssist('experience', expIdx, bIdx, bullet, 'STAR')} className="text-[9px] text-teal-400/80 hover:text-teal-300 flex items-center gap-0.5 font-bold"><Sparkles size={8} /> STAR format</button>
                            <button type="button" onClick={() => triggerAIAssist('experience', expIdx, bIdx, bullet, 'quantify')} className="text-[9px] text-teal-400/80 hover:text-teal-300 flex items-center gap-0.5 font-bold"><Sparkles size={8} /> Add metrics</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Projects Accordion */}
          <div className="card border-slate-800/80 p-0 overflow-hidden">
            <button 
              onClick={() => toggleAccordion('projects')} 
              className="w-full px-5 py-4 flex justify-between items-center bg-slate-900/40 text-xs font-bold text-slate-200"
            >
              <span>PROJECT BULLETS</span>
              {activeAccordion === 'projects' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {activeAccordion === 'projects' && (
              <div className="p-4 space-y-4">
                {(version.projects || []).map((proj, projIdx) => (
                  <div key={projIdx} className="bg-slate-950/40 p-3.5 border border-slate-850 rounded-xl space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-300">{proj.name}</span>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => moveItem('projects', projIdx, 'up')} disabled={projIdx === 0} className="p-0.5 text-slate-400 disabled:opacity-20 hover:text-teal-400"><ArrowUp size={11} /></button>
                        <button type="button" onClick={() => moveItem('projects', projIdx, 'down')} disabled={projIdx === version.projects.length - 1} className="p-0.5 text-slate-400 disabled:opacity-20 hover:text-teal-400"><ArrowDown size={11} /></button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(proj.description || []).map((bullet, bIdx) => (
                        <div key={bIdx} className="space-y-1">
                          <input 
                            type="text" 
                            className="input-field py-1.5 px-2.5 text-xs font-sans w-full"
                            value={bullet}
                            onChange={(e) => updateProjectBullet(projIdx, bIdx, e.target.value)}
                          />
                          <div className="flex gap-1.5 justify-end">
                            <button type="button" onClick={() => triggerAIAssist('projects', projIdx, bIdx, bullet, 'quantify')} className="text-[9px] text-teal-400/80 hover:text-teal-300 flex items-center gap-0.5 font-bold"><Sparkles size={8} /> Add metrics</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ATS Compliance Scanner Panel */}
          <div className="card border-slate-800/80 p-4 space-y-4">
            <button 
              onClick={() => setShowScanPanel(!showScanPanel)}
              className="w-full flex justify-between items-center text-xs font-bold text-slate-200 uppercase tracking-wider"
            >
              <span className="flex items-center gap-1.5"><Award className="text-violet-400" size={15} /> ATS Match Scanner</span>
              <span>{showScanPanel ? 'Hide Scanner' : 'Open Scanner'}</span>
            </button>

            {showScanPanel && (
              <div className="space-y-4 pt-2 border-t border-slate-850 animate-slide-in">
                <textarea
                  placeholder="Paste target job description to match keywords..."
                  className="input-field text-xs min-h-[100px] font-sans"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
                
                <button 
                  type="button" 
                  disabled={scanning || !jobDescription.trim()} 
                  onClick={handleScan}
                  className="w-full btn-secondary py-2 flex justify-center items-center gap-1.5 disabled:opacity-50 text-xs font-bold"
                >
                  {scanning ? <Loader2 size={13} className="animate-spin text-teal-400" /> : <Play size={13} />}
                  {scanning ? 'Scanning Keywords...' : 'Scan Resume Compatibility'}
                </button>

                {/* Scan Results Layout */}
                {scanResult.ats_score > 0 && (
                  <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-850 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-300">ATS Score:</span>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                        scanResult.ats_score >= 75 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                      }`}>{scanResult.ats_score}%</span>
                    </div>

                    {scanResult.ats_suggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Suggested Fixes</p>
                        <ul className="list-disc pl-4 text-xs text-slate-400 space-y-1">
                          {scanResult.ats_suggestions.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}

                    {scanResult.keyword_suggestions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Missing Target Keywords</p>
                        <div className="flex flex-wrap gap-1">
                          {scanResult.keyword_suggestions.map((kw, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-violet-950/40 border border-violet-850 text-violet-300">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Template Canvas Preview */}
        <div className="bg-slate-900/10 p-2 rounded-2xl border border-slate-850 sticky top-4">
          <div id="resume-print-canvas" className="w-full">
            {template === 'Modern ATS' && <ModernATS data={version} />}
            {template === 'Minimal' && <Minimal data={version} />}
            {template === 'Google Style' && <GoogleStyle data={version} />}
          </div>
        </div>
      </div>

      {/* AI SUGGESTION MODAL OVERLAY */}
      {assistantType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Sparkles size={16} className="text-teal-400 animate-pulse" />
                AI Assistant Rewrite
              </h3>
              <button onClick={closeAssistant} className="text-xs text-slate-500 hover:text-slate-300">Close</button>
            </div>

            {assistLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 size={32} className="animate-spin text-teal-400" />
                <p className="text-xs text-slate-500 font-semibold uppercase">Rephrasing section content...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Optimized Suggestion</span>
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl text-xs leading-relaxed text-slate-200 select-text whitespace-pre-wrap">
                    {assistOutput}
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <button 
                    onClick={applyAISuggestion}
                    className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1"
                  >
                    <Check size={13} />
                    Apply Changes
                  </button>
                  <button 
                    onClick={closeAssistant}
                    className="px-4 py-2 bg-slate-850 border border-slate-700 hover:bg-slate-800 text-slate-350 rounded-xl text-xs"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
