import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Briefcase, Building2, ChevronDown, ChevronUp, Clock, Sparkles, ExternalLink
} from 'lucide-react';
import { getCompanyColorPalette, getCompanyInitials } from '../utils/colorUtils';
import { getRelativeTime, estimateReadingTime } from '../utils/timeUtils';
import { parseJobDescription } from '../utils/descriptionParser';
import FormattedJobDescription from './FormattedJobDescription';

function MatchRing({ score, level }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const colorClass = level === 'Strong' ? 'text-emerald-400' : level === 'Medium' ? 'text-amber-400' : 'text-slate-500';

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg className="transform -rotate-90 w-full h-full p-0.5" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="transparent" stroke="currentColor" strokeWidth="3" className="text-slate-700" />
        <circle
          cx="24" cy="24" r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={colorClass}
        />
      </svg>
    </div>
  );
}

export default function JobCard({ job, scoutMatch, hasResume }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);

  const companyColors = useMemo(() => getCompanyColorPalette(job.company), [job.company]);
  const parsedDescription = useMemo(() => parseJobDescription(job.description), [job.description]);

  const score = scoutMatch?.score;
  const level = score >= 70 ? 'Strong' : score >= 40 ? 'Medium' : 'Low';
  const showScore = hasResume && typeof score === 'number';

  const formatLocation = (location) => {
    if (!location) return 'Remote';
    if (typeof location === 'object') {
      const { city, region, countryName } = location;
      const parts = [city, region].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : countryName || 'Remote';
    }
    return location;
  };

  const logoUrl = job.logo || '';
  const showPlaceholder = imgFailed || !logoUrl;
  const relativeTime = getRelativeTime(job.date_posted);
  const readingTime = estimateReadingTime(parsedDescription.rawText);
  const technologies = parsedDescription.technologies.slice(0, 4);

  return (
    <div
      className="card flex flex-col h-full group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/30"
      style={{ borderTop: `3px solid ${companyColors.primary}` }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="relative">
            <div
              className="relative w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center p-2 border-2"
              style={{ backgroundColor: companyColors.light, borderColor: companyColors.primary }}
            >
              {showPlaceholder ? (
                <div className="w-full h-full flex items-center justify-center font-bold text-lg" style={{ color: companyColors.primary }}>
                  {getCompanyInitials(job.company)}
                </div>
              ) : (
                <img src={logoUrl} alt={job.company} className="w-full h-full object-contain" onError={() => setImgFailed(true)} />
              )}
            </div>
          </div>

          {showScore ? (
            <div
              className="relative flex flex-col items-end cursor-pointer"
              onMouseEnter={() => setShowScoreDetails(true)}
              onMouseLeave={() => setShowScoreDetails(false)}
            >
              <div className="relative w-12 h-12 flex items-center justify-center">
                <MatchRing score={score} level={level} />
                <span className={`text-xs font-bold ${level === 'Strong' ? 'text-emerald-400' : level === 'Medium' ? 'text-amber-400' : 'text-slate-400'}`}>
                  {score}%
                </span>
              </div>
              {showScoreDetails && scoutMatch?.reason && (
                <div className="absolute right-0 top-14 z-50 w-64 rounded-xl shadow-xl p-4 border border-slate-700 bg-surface">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span className="font-semibold text-sm text-slate-100">Opportunity Scout</span>
                  </div>
                  <p className="text-xs text-slate-300">{scoutMatch.reason}</p>
                  {scoutMatch.matched_skills?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {scoutMatch.matched_skills.slice(0, 4).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950/50 text-teal-300">{s}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-2">Source: {scoutMatch.source === 'lemma' ? 'Lemma agent' : 'Gemini AI'}</p>
                </div>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-slate-500 border border-slate-700 rounded-full px-2 py-1">
              {hasResume ? 'Not ranked' : 'Upload resume'}
            </span>
          )}
        </div>

        <h3 className="font-bold text-lg text-slate-100 mb-2 line-clamp-2 leading-tight">{job.title}</h3>

        <p className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          {job.company}
        </p>

        {technologies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {technologies.map((tech, idx) => (
              <span key={idx} className="px-2 py-0.5 text-xs font-medium rounded-md" style={{ backgroundColor: companyColors.light, color: companyColors.dark }}>
                {tech}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-auto">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-teal-950/40 text-teal-300 border border-teal-800/40">
            <MapPin className="w-3 h-3 mr-1" />
            {formatLocation(job.location).substring(0, 50)}
          </span>
          {job.experience && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-violet-950/40 text-violet-300 border border-violet-800/40">
              <Briefcase className="w-3 h-3 mr-1" />
              {job.experience.substring(0, 30)}
            </span>
          )}
          {relativeTime && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 bg-slate-800/60 border border-slate-700">
              <Clock className="w-3 h-3 mr-1" />
              {relativeTime}
            </span>
          )}
        </div>

        {parsedDescription.rawText && (
          <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="w-full mt-4 text-left text-sm text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-between">
            <span className="flex items-center gap-2">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span className="font-medium">{isExpanded ? 'Hide Details' : 'View Details'}</span>
              {!isExpanded && readingTime && <span className="text-xs text-slate-500">• {readingTime}</span>}
            </span>
          </button>
        )}

        {isExpanded && (
          <div className="overflow-hidden mt-4 pt-4 border-t border-slate-700">
            <FormattedJobDescription description={job.description} technologies={job.technologies} />
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {(job.apply_link || job.apply_url) && (
            <a
              href={job.apply_link || job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2.5 rounded-xl font-medium text-white text-center transition-all flex items-center justify-center gap-2 hover:opacity-90 border border-teal-500/30 bg-teal-600"
            >
              <ExternalLink className="w-4 h-4" />
              Apply Direct
            </a>
          )}
          <Link
            to={`/jobs/${job.id}`}
            className="w-full px-4 py-2.5 rounded-xl font-semibold text-white text-center transition-all flex items-center justify-center gap-2 hover:opacity-90 text-sm"
            style={{ background: `linear-gradient(135deg, ${companyColors.primary}, ${companyColors.dark})` }}
          >
            <Sparkles className="w-4 h-4" />
            Launch Workflow
          </Link>
        </div>
      </div>
    </div>
  );
}
