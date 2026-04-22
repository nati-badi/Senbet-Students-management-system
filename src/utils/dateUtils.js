import i18next from 'i18next';

/**
 * Formats a date into the Ethiopian (Ethiopic) calendar.
 * @param {string|Date} dateInput - The date to format.
 * @param {boolean} forceAmharic - Whether to force the output to be in Amharic regardless of current locale.
 * @returns {string} The formatted Ethiopian date.
 */
export const formatEthiopianDate = (dateInput, forceAmharic = true) => {
    const dateObj = (dateInput && typeof dateInput === 'string' && dateInput.includes('T'))
        ? new Date(dateInput)
        : (dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date()));

    if (!dateObj || isNaN(dateObj.getTime())) return dateInput || '—';

    // Default to 'am' locale for Ethiopian calendar if not specified
    const locale = forceAmharic ? 'am-ET-u-ca-ethiopic' : (i18next.language?.startsWith('am') ? 'am-ET-u-ca-ethiopic' : 'en-ET-u-ca-ethiopic');
    const isAmharic = forceAmharic || (i18next.language?.startsWith('am'));

    try {
        const formatter = new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        let formatted = formatter.format(dateObj);
        
        // Always ensure 'ዓ.ም' suffix for Amharic or as a replacement for 'E.C.'
        if (isAmharic) {
            // Remove any trailing ERA or extra spaces before adding ዓ.ም
            formatted = formatted.replace(/(AM|PM|ERA1|ERA0)/gi, '').trim() + ' ዓ.ም';
        } else {
            formatted = formatted.replace(/(AM|PM|ERA1|ERA0)/gi, '').trim() + ' E.C.';
        }
        
        return formatted;
    } catch (e) {
        return dateInput || '—';
    }
};

/**
 * Formats a date into Ethiopian time (12-hour format with E.C. context).
 * @param {Date} date - The date to format.
 * @returns {string} The formatted Ethiopian time.
 */
export const formatEthiopianTime = (dateInput) => {
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!dateObj || isNaN(dateObj.getTime())) return '—';
    
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

/**
 * Computes the current Ethiopian Academic Year based on the current date.
 * Ethiopian New Year is in September.
 * @returns {string} The formatted academic year (e.g., "2016 E.C.").
 */
export const computeEthiopianYear = () => {
    const d = new Date();
    const month = d.getMonth(); // 0-indexed
    const year = d.getFullYear();
    // Ethiopian New Year is in September (month index 8)
    const ethiopianYear = month >= 8 ? year - 7 : year - 8;
    return `${ethiopianYear} ዓ.ም`;
};

/**
 * Extracts the Ethiopian Year from a date string or Date object.
 * @param {string|Date} dateInput
 * @returns {string} The Ethiopian year with ዓ.ም suffix.
 */
export const getEthiopianYear = (dateInput) => {
    if (!dateInput) return '—';
    
    // 1. Try standard date parsing first (handles ISO strings correctly)
    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
    
    if (dateObj && !isNaN(dateObj.getTime())) {
        // Ethiopian New Year is in September
        const month = dateObj.getMonth();
        const year = dateObj.getFullYear();
        const etYear = month >= 8 ? year - 7 : year - 8;
        return `${etYear} ዓ.ም`;
    }

    // 2. Fallback: If parsing failed, try to extract a 4-digit number from raw text (e.g. "2018 ዓ.ም")
    if (typeof dateInput === 'string') {
        const match = dateInput.match(/(\d{4})/);
        if (match) return `${match[1]} ዓ.ም`;
    }

    return '—';
};
