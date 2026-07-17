function isValidUID(uid) {
    return /^\d+$/.test(uid.toString());
}

function isValidAmount(amount) {
    const num = parseInt(amount);
    return !isNaN(num) && num > 0;
}

function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function isFacebookURL(url) {
    return url.includes('facebook.com') || url.includes('fb.com');
}

function sanitizeInput(input) {
    return input.toString().trim();
}

function parseAmount(amountText) {
    const cleaned = amountText.replace(/[.,\s]/g, '');
    const num = parseInt(cleaned);
    return isNaN(num) ? 0 : num;
}

module.exports = {
    isValidUID,
    isValidAmount,
    isValidURL,
    isFacebookURL,
    sanitizeInput,
    parseAmount
};
