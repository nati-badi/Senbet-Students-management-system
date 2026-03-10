export const validateAmharic = (_, value) => {
    if (!value) return Promise.resolve();
    return Promise.resolve();
};

export const validateEthiopianPhone = (_, value) => {
    if (!value) return Promise.resolve();
    const cleaned = value.replace(/\s/g, '');
    if (!/^\d{10}$/.test(cleaned)) return Promise.reject('ስልክ ቁጥር 10 አሃዝ መሆን አለበት (ለምሳሌ 0911234567)');
    if (!/^(09|07)/.test(cleaned)) return Promise.reject('ስልክ ቁጥር 09 ወይም 07 ሲጀምር ብቻ ትክክለኛ ነው');
    return Promise.resolve();
};
