import i18next from 'i18next';

/**
 * Formats a date into the Ethiopian (Ethiopic) calendar.
 * @param {string|Date|any} dateInput - The date to format.
 * @param {boolean} forceAmharic - Whether to force the output to be in Amharic regardless of current locale.
 * @returns {string} The formatted Ethiopian date.
 */
export const formatEthiopianDate = (dateInput: string | Date | any): string => {
    const dateObj = (dateInput && typeof dateInput === 'string' && dateInput.includes('T'))
        ? new Date(dateInput)
        : (dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date()));

    if (!dateObj || isNaN(dateObj.getTime())) return String(dateInput || '—');

    const locale = 'am-ET-u-ca-ethiopic';

    try {
        const formatter = new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Use formatToParts to avoid "ERA1" artifacts and force a consistent order
        const parts = formatter.formatToParts(dateObj);
        const day = parts.find(p => p.type === 'day')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const year = parts.find(p => p.type === 'year')?.value || '';

        return `${month} ${day}, ${year}`;
    } catch (e) {
        // Fallback for environments that don't support formatToParts or the locale properly
        try {
            const formatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' });
            return formatter.format(dateObj).replace(/(ERA\d|ERA|AM|PM)/gi, '').trim();
        } catch (inner) {
            return String(dateInput || '—');
        }
    }
};

export const formatEthiopianTime = (dateInput: any): string => {
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(dateObj.getTime())) return '-';
    
    const h = dateObj.getHours();
    const m = dateObj.getMinutes();
    
    // Ethiopian hour = (StandardHour - 6 + 12) % 12
    const etHour = ((h - 6 + 12) % 12) || 12;
    const etMin = m < 10 ? `0${m}` : m;
    
    let suffix = 'ጥዋት';
    if (h >= 23 || h < 6) suffix = 'ሌሊት';
    else if (h >= 6 && h < 12) suffix = 'ጥዋት';
    else if (h >= 12 && h < 18) suffix = 'ከሰዓት';
    else if (h >= 18 && h < 23) suffix = 'ማታ';

    return `${etHour}:${etMin} ${suffix}`;
};

export const computeEthiopianYear = (): string => {
    const d = new Date();
    const month = d.getMonth(); 
    const year = d.getFullYear();
    const ethiopianYear = month >= 8 ? year - 7 : year - 8;
    // Always use Amharic suffix
    return `${ethiopianYear} ዓ.ም`;
};
