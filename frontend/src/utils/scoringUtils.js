const TECH_KEYWORDS = [
  'react', 'node', 'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'go', 'ruby',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'sql', 'nosql', 'mongodb', 'postgres',
  'redis', 'graphql', 'rest', 'api', 'html', 'css', 'tailwind', 'redux', 'next.js',
  'vue', 'angular', 'git', 'ci/cd', 'agile', 'scrum', 'machine learning', 'ai', 'data',
];

const EDUCATION_LEVELS = { phd: 3, doctorate: 3, master: 2, ms: 2, bachelor: 1, bs: 1, degree: 1 };
const EXPERIENCE_LEVELS = { senior: 3, lead: 3, principal: 4, architect: 4, mid: 2, junior: 1, entry: 0, intern: 0 };

export const getUserProfile = () => {
  if (typeof window === 'undefined') return {};
  try {
    const profile = JSON.parse(localStorage.getItem('careeros_profile') || '{}');
    return {
      resumeText: localStorage.getItem('careeros_resume') || '',
      career: profile.role || '',
      education: profile.education || '',
    };
  } catch {
    return { resumeText: localStorage.getItem('careeros_resume') || '', career: '', education: '' };
  }
};

export const calculateMatchScore = (job, userProfile) => {
  if (!userProfile) return { score: 0, details: {}, explanations: [], level: 'Low', breakdown: {} };

  const userText = (
    (userProfile.resumeText || '') + ' ' +
    (userProfile.career || '') + ' ' +
    (userProfile.education || '')
  ).toLowerCase();

  const currentRole = (userProfile.career || '').toLowerCase();
  const jobDescription = (job.description || '').toLowerCase();
  const jobTitle = (job.title || '').toLowerCase();
  const jobTechStack = (job.technologies || []).map((t) => t.toLowerCase());

  const scores = { skills: 0, title: 0, education: 0, experience: 0, location: 0 };
  const explanations = [];

  const jobKeywords = new Set([...jobTechStack]);
  TECH_KEYWORDS.forEach((tech) => {
    if (jobDescription.includes(tech)) jobKeywords.add(tech);
  });

  if (jobKeywords.size > 0) {
    let matchCount = 0;
    const matchedSkills = [];
    jobKeywords.forEach((keyword) => {
      if (userText.includes(keyword)) {
        matchCount++;
        matchedSkills.push(keyword);
      }
    });
    const coverage = Math.min(matchCount / (jobKeywords.size * 0.5), 1);
    scores.skills = Math.round(coverage * 40);
    if (matchedSkills.length > 0) {
      explanations.push(`Matches ${matchedSkills.length} key skills: ${matchedSkills.slice(0, 3).join(', ')}${matchedSkills.length > 3 ? '...' : ''}`);
    }
  } else {
    scores.skills = 20;
  }

  if (currentRole) {
    const titleTokens = jobTitle.split(/[\s-]+/);
    const roleTokens = currentRole.split(/[\s-]+/);
    const matchingTokens = titleTokens.filter((token) => token.length > 3 && roleTokens.includes(token));
    if (matchingTokens.length > 0 || jobTitle.includes(currentRole) || currentRole.includes(jobTitle)) {
      scores.title = 20;
      explanations.push(`Title aligns with "${userProfile.career}"`);
    }
  }

  let jobEduLevel = 0;
  Object.entries(EDUCATION_LEVELS).forEach(([key, lvl]) => {
    if (jobDescription.includes(key)) jobEduLevel = Math.max(jobEduLevel, lvl);
  });
  let userEduLevel = 0;
  Object.entries(EDUCATION_LEVELS).forEach(([key, lvl]) => {
    if (userText.includes(key)) userEduLevel = Math.max(userEduLevel, lvl);
  });
  if (userEduLevel >= jobEduLevel) {
    scores.education = 15;
    if (jobEduLevel > 0) explanations.push('Education requirements met');
  } else if (userEduLevel > 0) {
    scores.education = 10;
  }

  let jobExpLevel = 2;
  Object.entries(EXPERIENCE_LEVELS).forEach(([key, lvl]) => {
    if (jobTitle.includes(key) || jobDescription.includes(key)) jobExpLevel = lvl;
  });
  const yearsMatch = userText.match(/(\d+)\+?\s*years?/);
  const userYears = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
  const userExpLevel = userYears > 5 ? 3 : (userYears > 2 ? 2 : 1);
  if (userExpLevel >= jobExpLevel) {
    scores.experience = 15;
    explanations.push('Experience level fits');
  } else if (userExpLevel >= jobExpLevel - 1) {
    scores.experience = 10;
  } else {
    scores.experience = 5;
  }

  const loc = typeof job.location === 'string' ? job.location : '';
  if (loc.toLowerCase().includes('remote')) {
    scores.location = 10;
    explanations.push('Remote friendly');
  } else {
    scores.location = 5;
  }

  const totalScore = Math.min(100, scores.skills + scores.title + scores.education + scores.experience + scores.location);

  return {
    score: Math.round(totalScore),
    breakdown: scores,
    explanations,
    level: totalScore >= 70 ? 'Strong' : (totalScore >= 40 ? 'Medium' : 'Low'),
  };
};
