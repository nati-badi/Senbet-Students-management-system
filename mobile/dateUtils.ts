import i18next from 'i18next';

/**
 * Formats a date into the Ethiopian (Ethiopic) calendar.
 * @param {string|Date|any} dateInput - The date to format.
 * @param {boolean} forceAmharic - Whether to force the output to be in Amharic regardless of current locale.
 * @returns {string} The formatted Ethiopian date.
 */
export const formatEthiopianDate = (dateInput: string | Date | any, forceAmharic = false): string => {
    const dateObj = (dateInput && typeof dateInput === 'string' && dateInput.includes('T'))
        ? new Date(dateInput)
        : (dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date()));

    if (!dateObj || isNaN(dateObj.getTime())) return String(dateInput || '—');

    const currentLang = i18next.language || 'am';
    const isAmharic = forceAmharic || currentLang.startsWith('am');
    const locale = isAmharic ? 'am-ET-u-ca-ethiopic' : 'en-ET-u-ca-ethiopic';

    try {
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        // If it's a date-only string like "2024-03-17", ensure it's treated as local time
        const date = (typeof dateInput === 'string' && !dateInput.includes('T'))
            ? new Date(dateInput + 'T00:00:00')
            : dateObj;

        const formatter = new Intl.DateTimeFormat(locale, options);
        let formatted = formatter.format(date);
        
        if (!isAmharic) {
            formatted = formatted.replace(/(AM|PM|ERA1|ERA0)/gi, '').trim() + ' E.C.';
        }
        return formatted;
    } catch (e) {
        return String(dateInput || '—');
    }
};

/**
 * Computes the current Ethiopian Academic Year based on the current date.
 * Ethiopian New Year is in September.
 * @returns {string} The formatted academic year (e.g., "2016 E.C.").
 */
/**
 * Formats a time string or date into Ethiopian locale time.
 */
export const formatEthiopianTime = (dateInput: any): string => {
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(dateObj.getTime())) return '-';
    
    const currentLang = i18next.language || 'am';
    const isAmharic = currentLang.startsWith('am');
    const locale = isAmharic ? 'am-ET' : 'en-ET';

    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(dateObj);
};

export const computeEthiopianYear = (): string => {
    const d = new Date();
    const month = d.getMonth(); // 0-indexed
    const year = d.getFullYear();
    // Ethiopian New Year is in September (month index 8)
    const ethiopianYear = month >= 8 ? year - 7 : year - 8;
    return `${ethiopianYear} ${i18next.language?.startsWith('am') ? 'ዓ.ም' : 'E.C.'}`;
};
