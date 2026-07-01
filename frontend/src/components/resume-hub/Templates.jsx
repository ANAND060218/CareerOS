import React from 'react';

// ================= CSS Print Stylesheet Helper =================
export const PrintStylesheet = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    @media print {
      body * {
        visibility: hidden;
      }
      #resume-print-canvas, #resume-print-canvas * {
        visibility: visible;
      }
      #resume-print-canvas {
        position: absolute;
        left: 0;
        top: 0;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        background: white !important;
        color: black !important;
      }
      html, body {
        background: white !important;
        color: black !important;
      }
    }
  `}} />
);

// ================= Modern ATS Template =================
export function ModernATS({ data }) {
  const personal = data.personal_info || {};
  const safeArray = (arr) => Array.isArray(arr) ? arr : [];
  const safeString = (str) => str || '';
  
  return (
    <div className="bg-white text-slate-800 p-8 font-sans leading-relaxed text-xs shadow-inner select-text border border-slate-200 min-h-[750px] w-full selection:bg-teal-100">
      {/* Header */}
      <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
        <h1 className="text-2xl font-bold text-slate-950 uppercase tracking-tight mb-1">{personal.name || 'Your Name'}</h1>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-slate-600 font-medium">
          {personal.location && <span>{personal.location}</span>}
          {personal.phone && <span>• {personal.phone}</span>}
          {personal.email && <span>• {personal.email}</span>}
          {personal.linkedin && <span>• linkedin.com/in/{personal.linkedin.split('/').pop()}</span>}
          {personal.github && <span>• github.com/{personal.github.split('/').pop()}</span>}
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-0.5 mb-2">Professional Summary</h2>
          <p className="text-slate-700 leading-relaxed">{data.summary}</p>
        </div>
      )}

      {/* Experience */}
      {safeArray(data.experience).length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-0.5 mb-2">Work Experience</h2>
          <div className="space-y-3">
            {safeArray(data.experience).map((exp, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{safeString(exp.role)} — {safeString(exp.company)}</span>
                  <span className="font-normal text-slate-600">{safeString(exp.start_date)} – {safeString(exp.end_date)}</span>
                </div>
                {exp.location && <p className="text-[10px] text-slate-500 font-semibold mb-1">{exp.location}</p>}
                <ul className="list-disc pl-4 text-slate-700 space-y-1 mt-1">
                  {safeArray(exp.description).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {safeArray(data.projects).length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-0.5 mb-2">Projects</h2>
          <div className="space-y-3">
            {safeArray(data.projects).map((proj, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{safeString(proj.name)} {safeArray(proj.technologies).length > 0 && <span className="font-normal text-slate-500">({proj.technologies.join(', ')})</span>}</span>
                  {proj.link && <span className="font-normal text-slate-600 text-[10px]">{proj.link}</span>}
                </div>
                <ul className="list-disc pl-4 text-slate-700 space-y-1 mt-1">
                  {safeArray(proj.description).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {safeArray(data.education).length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-0.5 mb-2">Education</h2>
          <div className="space-y-2">
            {safeArray(data.education).map((edu, idx) => (
              <div key={idx} className="flex justify-between text-slate-700">
                <div>
                  <span className="font-bold text-slate-900">{safeString(edu.institution)}</span> — <span>{safeString(edu.degree)} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}</span>
                  {edu.grade && <span className="text-slate-500 ml-2">(CGPA: {edu.grade})</span>}
                </div>
                <span className="text-slate-600 font-semibold">{safeString(edu.start_date)} – {safeString(edu.end_date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {safeArray(data.skills).length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-0.5 mb-2">Technical Skills</h2>
          <p className="text-slate-700 leading-relaxed">
            <span className="font-bold text-slate-900">Core Technologies: </span>
            {safeArray(data.skills).join(', ')}
          </p>
        </div>
      )}

      {/* Certifications */}
      {safeArray(data.certifications).length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-950 uppercase tracking-wider border-b border-slate-300 pb-0.5 mb-2">Certifications</h2>
          <ul className="list-disc pl-4 text-slate-700 space-y-0.5">
            {safeArray(data.certifications).map((cert, idx) => (
              <li key={idx}>
                <span className="font-bold text-slate-900">{safeString(cert.name)}</span> — {safeString(cert.issuer)} {cert.date ? `(${cert.date})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ================= Minimal Template =================
export function Minimal({ data }) {
  const personal = data.personal_info || {};
  const safeArray = (arr) => Array.isArray(arr) ? arr : [];
  const safeString = (str) => str || '';
  
  return (
    <div className="bg-white text-slate-800 p-8 font-serif leading-relaxed text-xs shadow-inner select-text border border-slate-200 min-h-[750px] w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 mb-1">{personal.name || 'Your Name'}</h1>
        <div className="flex gap-x-4 text-slate-500 text-[11px] font-sans">
          {personal.email && <span>{personal.email}</span>}
          {personal.phone && <span>{personal.phone}</span>}
          {personal.location && <span>{personal.location}</span>}
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="mb-5">
          <p className="text-slate-600 leading-relaxed italic">{data.summary}</p>
        </div>
      )}

      {/* Experience */}
      {safeArray(data.experience).length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3 font-sans">Experience</h2>
          <div className="space-y-4">
            {safeArray(data.experience).map((exp, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-bold text-slate-900 text-xs">
                  <span>{safeString(exp.company)} — {safeString(exp.role)}</span>
                  <span className="font-normal text-slate-500 text-[10px] font-sans">{safeString(exp.start_date)} – {safeString(exp.end_date)}</span>
                </div>
                <ul className="list-disc pl-4 text-slate-600 space-y-1 mt-1 text-[11px] font-sans leading-relaxed">
                  {safeArray(exp.description).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {safeArray(data.projects).length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3 font-sans">Projects</h2>
          <div className="space-y-4">
            {safeArray(data.projects).map((proj, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-bold text-slate-900 text-xs">
                  <span>{safeString(proj.name)}</span>
                  <span className="font-normal text-slate-500 text-[10px] font-sans">{proj.link}</span>
                </div>
                {safeArray(proj.technologies).length > 0 && <p className="text-[10px] text-slate-400 italic mb-1 font-sans">Tech: {proj.technologies.join(', ')}</p>}
                <ul className="list-disc pl-4 text-slate-600 space-y-1 mt-1 text-[11px] font-sans leading-relaxed">
                  {safeArray(proj.description).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {safeArray(data.skills).length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2 font-sans">Skills</h2>
          <p className="text-[11px] text-slate-600 font-sans">{safeArray(data.skills).join(', ')}</p>
        </div>
      )}

      {/* Education */}
      {safeArray(data.education).length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3 font-sans">Education</h2>
          <div className="space-y-2">
            {safeArray(data.education).map((edu, idx) => (
              <div key={idx} className="flex justify-between text-slate-700 text-xs">
                <div>
                  <span className="font-bold text-slate-900">{safeString(edu.institution)}</span> — {safeString(edu.degree)}
                </div>
                <span className="text-slate-500 text-[10px] font-sans">{safeString(edu.start_date)} – {safeString(edu.end_date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ================= Google Style Template =================
export function GoogleStyle({ data }) {
  const personal = data.personal_info || {};
  const safeArray = (arr) => Array.isArray(arr) ? arr : [];
  const safeString = (str) => str || '';
  
  return (
    <div className="bg-white text-black p-8 font-serif leading-relaxed text-xs shadow-inner select-text border border-slate-200 min-h-[750px] w-full">
      {/* Centered Google Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold mb-1 tracking-tight">{personal.name || 'Your Name'}</h1>
        <div className="text-slate-700 text-[10px]">
          {personal.location} | {personal.phone} | {personal.email}
          {personal.linkedin && ` | LinkedIn: ${personal.linkedin.split('/').pop()}`}
          {personal.github && ` | GitHub: ${personal.github.split('/').pop()}`}
        </div>
      </div>

      {/* Education First */}
      {safeArray(data.education).length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold text-slate-900 border-b border-black pb-0.5 mb-2 uppercase tracking-wide">Education</h2>
          {safeArray(data.education).map((edu, idx) => (
            <div key={idx} className="mb-1.5">
              <div className="flex justify-between font-bold text-black">
                <span>{safeString(edu.institution)}</span>
                <span className="font-normal text-slate-700">{safeString(edu.start_date)} – {safeString(edu.end_date)}</span>
              </div>
              <p className="text-[11px] text-slate-700">{safeString(edu.degree)} in {safeString(edu.field_of_study)} {edu.grade ? `(GPA: ${edu.grade})` : ''}</p>
            </div>
          ))}
        </div>
      )}

      {/* Experience */}
      {safeArray(data.experience).length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold text-slate-900 border-b border-black pb-0.5 mb-2 uppercase tracking-wide">Professional Experience</h2>
          <div className="space-y-3">
            {safeArray(data.experience).map((exp, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-bold text-black">
                  <span>{safeString(exp.company)}</span>
                  <span className="font-normal text-slate-700">{safeString(exp.start_date)} – {safeString(exp.end_date)}</span>
                </div>
                <p className="italic text-[11px] text-slate-700 mb-1">{safeString(exp.role)}</p>
                <ul className="list-disc pl-4 text-slate-800 space-y-1">
                  {safeArray(exp.description).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {safeArray(data.projects).length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold text-slate-900 border-b border-black pb-0.5 mb-2 uppercase tracking-wide">Projects</h2>
          <div className="space-y-3">
            {safeArray(data.projects).map((proj, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-bold text-black">
                  <span>{safeString(proj.name)}</span>
                  <span className="font-normal text-slate-700 text-[10px]">{proj.link}</span>
                </div>
                {safeArray(proj.technologies).length > 0 && <p className="text-[10px] text-slate-500 italic font-sans mb-1">Tech: {proj.technologies.join(', ')}</p>}
                <ul className="list-disc pl-4 text-slate-800 space-y-1">
                  {safeArray(proj.description).map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {safeArray(data.skills).length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-slate-900 border-b border-black pb-0.5 mb-2 uppercase tracking-wide">Skills & Interests</h2>
          <p className="text-slate-850">
            <span className="font-bold">Skills: </span>{safeArray(data.skills).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
