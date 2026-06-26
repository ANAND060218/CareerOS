import React, { useState } from 'react';
import { uploadResume, optimizeResume } from '../api';
import { FileText, Wand2, Upload } from 'lucide-react';

export default function Resume() {
  const [resumeText, setResumeText] = useState('');
  const [optimized, setOptimized] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!resumeText) return;
    setLoading(true);
    try {
      await uploadResume(resumeText);
      alert('Resume saved to CareerOS!');
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleOptimize = async () => {
    if (!resumeText) return;
    setLoading(true);
    try {
      const res = await optimizeResume(resumeText);
      setOptimized(res);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 flex items-center"><FileText className="mr-3 text-accent" /> Resume Center</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card space-y-4 flex flex-col">
          <h2 className="text-xl font-bold border-b border-slate-700 pb-2">Current Resume</h2>
          <textarea 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-300 min-h-[400px] flex-grow focus:outline-none focus:border-accent"
            placeholder="Paste your resume text here..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          ></textarea>
          <div className="flex space-x-4">
            <button onClick={handleUpload} disabled={loading} className="btn-primary flex-1 flex justify-center items-center">
              <Upload size={18} className="mr-2" /> Save Resume
            </button>
            <button onClick={handleOptimize} disabled={loading} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex-1 flex justify-center items-center transition-colors">
              <Wand2 size={18} className="mr-2" /> AI Optimize
            </button>
          </div>
        </div>

        {optimized && (
          <div className="card space-y-4">
            <h2 className="text-xl font-bold border-b border-purple-700/50 pb-2 text-purple-400 flex items-center">
                <Wand2 className="mr-2" size={20} /> AI Recommendations
            </h2>
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-slate-200 mb-2">ATS Suggestions</h3>
                    <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                        {optimized.ats_suggestions?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </div>
                <div>
                    <h3 className="font-semibold text-slate-200 mb-2">Keyword Missing</h3>
                    <div className="flex flex-wrap gap-2">
                        {optimized.keyword_suggestions?.map((k, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300">
                                {k}
                            </span>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="font-semibold text-slate-200 mb-2">Optimized Content</h3>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-400 whitespace-pre-wrap h-64 overflow-y-auto">
                        {optimized.optimized_resume}
                    </div>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
