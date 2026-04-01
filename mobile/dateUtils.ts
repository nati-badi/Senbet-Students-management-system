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
    
    // Force Amharic locale for time
    const locale = 'am-ET';

    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(dateObj);
};

export const computeEthiopianYear = (): string => {
    const d = new Date();
    const month = d.getMonth(); 
    const year = d.getFullYear();
    const ethiopianYear = month >= 8 ? year - 7 : year - 8;
    // Always use Amharic suffix
    return `${ethiopianYear} ዓ.ም`;
};
