import React, { useMemo } from 'react';
import { parseJobDescription } from '../utils/descriptionParser';

function DetailSection({ title, items, accentClass }) {
  return (
    <div>
      <h5 className="font-semibold text-slate-100 mb-2.5 flex items-center gap-2">
        <span className={`w-1 h-4 rounded-full ${accentClass}`} />
        {title}
      </h5>
      <ul className="space-y-2 ml-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5 text-slate-300">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${accentClass}`} />
            <span className="text-sm leading-relaxed flex-1">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FormattedJobDescription({ description, technologies: jobTechnologies = [] }) {
  const parsed = useMemo(() => parseJobDescription(description), [description]);
  const technologies = [...new Set([...(jobTechnologies || []), ...parsed.technologies])];

  return (
    <div className="space-y-6 text-sm">
      {parsed.inlineFields.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {parsed.inlineFields.map((field, idx) => (
            <div key={idx} className="rounded-lg border border-slate-700/80 bg-slate-950/50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-teal-400 mb-1">{field.label}</div>
              <div className="text-slate-200 leading-relaxed">{field.value}</div>
            </div>
          ))}
        </div>
      )}

      {parsed.salary && (
        <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-950/30 px-3 py-1 text-xs text-emerald-300">
          Salary: {parsed.salary}
        </div>
      )}

      {technologies.length > 0 && (
        <div>
          <h5 className="font-semibold text-slate-100 mb-2.5 flex items-center gap-2">
            <span className="w-1 h-4 bg-violet-500 rounded-full" />
            Tech Stack
          </h5>
          <div className="flex flex-wrap gap-2">
            {technologies.map((tech, idx) => (
              <span key={idx} className="px-2.5 py-1 bg-violet-950/50 text-violet-200 text-xs font-medium rounded-md border border-violet-700/40">
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {parsed.responsibilities.length > 0 && (
        <DetailSection title="Responsibilities" items={parsed.responsibilities} accentClass="bg-cyan-500" />
      )}

      {parsed.requirements.length > 0 && (
        <DetailSection title="Requirements" items={parsed.requirements} accentClass="bg-violet-500" />
      )}

      {parsed.benefits.length > 0 && (
        <DetailSection title="Benefits" items={parsed.benefits} accentClass="bg-emerald-500" />
      )}

      {parsed.rawText && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4">
          <h5 className="font-semibold text-slate-100 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-teal-500 rounded-full" />
            Full Description
          </h5>
          <div className="text-slate-300 text-sm leading-relaxed space-y-2">
            {parsed.rawText.split('\n').filter((line) => line.trim()).map((line, idx) => (
              <p key={idx} className="text-left">{line.trim()}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
