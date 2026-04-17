/**
 * Shared grade and subject normalization logic.
 * Ensures that grade "10A" and "Grade 10" and "10" all resolve to the same internal key.
 */

export const normalizeGrade = (rawGrade: any): string => {
  if (rawGrade === undefined || rawGrade === null) return '';
  const s = String(rawGrade).toLowerCase().trim();
  const match = s.match(/(\d+)/);
  if (match) {
    const num = match[1];
    const n = parseInt(num);
    if (n >= 1 && n <= 12) return String(n);
    if (n > 12) return '13'; // 12+ or Higher
  }
  if (s.includes('ሌላ') || s.includes('other') || s.includes('12+')) return '13';
  return s; 
};

export const normalizeSubject = (raw: any): string => {
  if (!raw) return '';
  return String(raw).trim().toLowerCase();
};

export const isConductAssessment = (assessment: any): boolean => {
  if (!assessment) return false;
  
  // Explicit system-tag match
  const sName = (assessment.subjectName || assessment.subjectname || '').toLowerCase();
  if (sName === '__conduct__') return true;
  
  // Keyword match (English & Amharic)
  const aName = (assessment.name || '').toLowerCase();
  
  const conductKeywords = ['conduct', 'attitude', 'behaviour', 'behavior', 'ስነ-ምግባር', 'ስነ ምግባር'];
  return conductKeywords.some(kw => aName.includes(kw) || sName.includes(kw));
};
