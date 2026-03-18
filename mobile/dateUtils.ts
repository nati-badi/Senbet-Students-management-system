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

    // Force Amharic Ethiopic locale regardless of current i18n language
    const locale = 'am-ET-u-ca-ethiopic';

    try {
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        const date = (typeof dateInput === 'string' && !dateInput.includes('T'))
            ? new Date(dateInput + 'T00:00:00')
            : dateObj;

        const formatter = new Intl.DateTimeFormat(locale, options);
        return formatter.format(date);
    } catch (e) {
        return String(dateInput || '—');
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
