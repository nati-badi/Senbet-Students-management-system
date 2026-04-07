import dayjs from 'dayjs';

export const GRADE_OPTIONS = [
    { value: '1', label: '1ኛ ክፍል' },
    { value: '2', label: '2ኛ ክፍል' },
    { value: '3', label: '3ኛ ክፍል' },
    { value: '4', label: '4ኛ ክፍል' },
    { value: '5', label: '5ኛ ክፍል' },
    { value: '6', label: '6ኛ ክፍል' },
    { value: '7', label: '7ኛ ክፍል' },
    { value: '8', label: '8ኛ ክፍል' },
    { value: '9', label: '9ኛ ክፍል' },
    { value: '10', label: '10ኛ ክፍል' },
    { value: '11', label: '11ኛ ክፍል' },
    { value: '12', label: '12ኛ ክፍል' },
    { value: '13', label: '12+ (ሌላ)' },
];

export const formatGrade = (grade) => {
    if (!grade) return '';
    const s = String(grade);
    const option = GRADE_OPTIONS.find(o => o.value === s);
    if (option) return option.label;
    if (s.includes('ኛ ክፍል')) return s;
    return `${s}ኛ ክፍል`;
};

export const normalizeGrade = (rawGrade) => {
    if (rawGrade === undefined || rawGrade === null) return '';
    const s = String(rawGrade).toLowerCase().trim();
    const match = s.match(/(\d+)/);
    if (match) {
        const num = match[1];
        const n = parseInt(num);
        if (n >= 1 && n <= 12) return String(n);
        if (n > 12) return '13';
    }
    if (s.includes('ሌላ') || s.includes('other') || s.includes('12+')) return '13';
    return s; // Consistency: return lowercase trimmed string if no digits
};

export const disabledDate = (current) => {
    return current && current > dayjs().endOf('day');
};

export const getNextGrade = (rawGrade) => {
    const normalized = normalizeGrade(rawGrade);
    const num = parseInt(normalized);
    if (isNaN(num)) return rawGrade; // If we couldn't parse it, return as is
    if (num >= 12) return '13'; // Graduate / Other
    return String(num + 1);
};

export const normalizeSubject = (raw) => {
    if (!raw) return '';
    return String(raw).toLowerCase().trim();
};
