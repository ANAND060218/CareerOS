export const hashStringToColor = (str) => {
  if (!str) return { hue: 220, saturation: 70, lightness: 50 };

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  const hue = Math.abs(hash % 360);
  const saturation = 60 + (Math.abs(hash) % 20);
  const lightness = 45 + (Math.abs(hash >> 8) % 15);

  return { hue, saturation, lightness };
};

export const getCompanyColorPalette = (companyName) => {
  const { hue, saturation, lightness } = hashStringToColor(companyName);

  return {
    primary: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    light: `hsl(${hue}, ${saturation - 10}%, ${lightness + 35}%)`,
    dark: `hsl(${hue}, ${saturation + 10}%, ${lightness - 15}%)`,
    glow: `hsla(${hue}, ${saturation}%, ${lightness}%, 0.3)`,
  };
};

export const getExperienceColor = (experience) => {
  if (!experience) return 'teal';

  const exp = experience.toLowerCase();

  if (exp.includes('entry') || exp.includes('junior') || exp.includes('0-1') || exp.includes('0-2')) return 'emerald';
  if (exp.includes('mid') || exp.includes('2-4') || exp.includes('3-5')) return 'cyan';
  if (exp.includes('senior') || exp.includes('5+') || exp.includes('lead')) return 'violet';
  if (exp.includes('principal') || exp.includes('staff') || exp.includes('architect')) return 'amber';

  return 'teal';
};

export const getCompanyInitials = (companyName) => {
  if (!companyName) return '?';
  const words = companyName.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};
