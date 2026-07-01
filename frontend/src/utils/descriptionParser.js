/**
 * Smart job description parser — extracts structured info from raw HTML/text.
 */

export const extractTechnologies = (text) => {
  if (!text) return [];

  const techKeywords = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'PHP',
    'React', 'Vue', 'Angular', 'Next.js', 'Svelte', 'HTML', 'CSS', 'Tailwind', 'Bootstrap',
    'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Rails', 'Laravel',
    'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch', 'DynamoDB', 'Oracle',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform',
    'Git', 'Jenkins', 'CI/CD', 'GraphQL', 'REST', 'API',
    'Machine Learning', 'AI', 'Data Science', 'DevOps', 'Agile', 'Scrum',
  ];

  const found = new Set();

  techKeywords.forEach((tech) => {
    const escapedTech = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escapedTech}(?:$|[^a-zA-Z0-9])`, 'i');
    if (regex.test(text)) found.add(tech);
  });

  return Array.from(found).slice(0, 12);
};

export const extractSalary = (text) => {
  if (!text) return null;

  const patterns = [
    /\$[\d,]+\s*-\s*\$[\d,]+/gi,
    /\$[\d,]+k\s*-\s*\$[\d,]+k/gi,
    /[\d,]+\s*-\s*[\d,]+\s*(?:USD|usd|dollar)/gi,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
};

const htmlToText = (html) => {
  if (!html) return '';

  let text = html.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
  text = text.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');
  text = text.replace(/<[^>]*>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/  +/g, ' ');
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  return text.trim();
};

/**
 * Parse inline HTML labels like <b>Project Role : </b>value<br>
 */
export const parseInlineFields = (description) => {
  if (!description) return [];

  const fields = [];
  const pattern = /<b>([^<]+)<\/b>\s*([^<]*?)(?=<b>|<br|$)/gi;
  let match;

  while ((match = pattern.exec(description)) !== null) {
    const label = match[1].replace(/:$/, '').trim();
    const value = match[2].replace(/<br\s*\/?>/gi, '').trim();
    if (label && value) fields.push({ label, value });
  }

  return fields;
};

export const parseJobDescription = (description) => {
  if (!description) {
    return {
      requirements: [],
      responsibilities: [],
      benefits: [],
      technologies: [],
      salary: null,
      rawText: '',
      inlineFields: [],
    };
  }

  const plainText = htmlToText(description);
  const inlineFields = parseInlineFields(description);

  const result = {
    requirements: [],
    responsibilities: [],
    benefits: [],
    technologies: extractTechnologies(plainText),
    salary: extractSalary(plainText),
    rawText: plainText,
    inlineFields,
  };

  const lines = plainText.split('\n').map((l) => l.trim()).filter(Boolean);
  let currentSection = null;

  lines.forEach((line) => {
    const lowerLine = line.toLowerCase();

    if (lowerLine.includes('requirement') || lowerLine.includes('qualification') || lowerLine.includes('must have')) {
      currentSection = 'requirements';
      return;
    }
    if (lowerLine.includes('responsibilit') || lowerLine.includes('you will') || lowerLine.includes('duties') || lowerLine.includes('roles &')) {
      currentSection = 'responsibilities';
      return;
    }
    if (lowerLine.includes('benefit') || lowerLine.includes('we offer') || lowerLine.includes('perks')) {
      currentSection = 'benefits';
      return;
    }

    if (currentSection && (line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || /^\d+\./.test(line))) {
      const cleanedLine = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (cleanedLine.length > 10) result[currentSection].push(cleanedLine);
    }
  });

  return result;
};

export const createDescriptionPreview = (description, maxLength = 150) => {
  if (!description) return '';
  const plainText = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plainText.length <= maxLength) return plainText;
  return `${plainText.substring(0, maxLength).trim()}...`;
};
