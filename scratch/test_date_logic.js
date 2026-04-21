const i18next = { language: 'am' };

const getEthiopianYear = (dateInput) => {
    if (!dateInput) return '—';
    
    // If it's already a string that looks like a year (e.g. "2018 ዓ.ም"), extract the number
    if (typeof dateInput === 'string') {
        const match = dateInput.match(/(\d{4})/);
        if (match) return `${match[1]} ዓ.ም`;
    }

    const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!dateObj || isNaN(dateObj.getTime())) return '—';
    
    // Ethiopian New Year is in September
    const month = dateObj.getMonth();
    const year = dateObj.getFullYear();
    const etYear = month >= 8 ? year - 7 : year - 8;
    return `${etYear} ዓ.ም`;
};

console.log('Test 1 (ISO):', getEthiopianYear('2026-04-20T11:21:07.000Z'));
console.log('Test 2 (Formatted):', getEthiopianYear('2018 ዓ.ም E.C.'));
console.log('Test 3 (Mixed):', getEthiopianYear('MEGABIT 21, 2018 E.C.'));
console.log('Test 4 (Null):', getEthiopianYear(null));
