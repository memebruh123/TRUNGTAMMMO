const Decimal = require('decimal.js');
const { loadJSON, saveJSON } = require('../services/storage');
const { FILES } = require('../config/constants');
const { getCurrentTimestamp, formatDate } = require('../utils/helpers');

async function createCode(codeName, codeType, value, maxUses = 100, expiryDays = 30, expiryDate = null, minAmount = 0) {
    const codes = await loadJSON(FILES.codes);

    let expiryTimestamp;
    let expiryDateStr;

    if (expiryDate) {
        try {
            const expiryDateTime = new Date(expiryDate);
            expiryTimestamp = Math.floor(expiryDateTime.getTime() / 1000);
            expiryDateStr = expiryDate;
        } catch {
            expiryTimestamp = getCurrentTimestamp() + (expiryDays * 86400);
            expiryDateStr = formatDate(expiryTimestamp);
        }
    } else {
        expiryTimestamp = getCurrentTimestamp() + (expiryDays * 86400);
        expiryDateStr = formatDate(expiryTimestamp);
    }

    const codeEntry = {
        code_name: codeName.toUpperCase(),
        code_type: codeType,
        value: value,
        max_uses: maxUses,
        used_count: 0,
        used_by: [],
        expiry: expiryTimestamp,
        expiry_date: expiryDateStr,
        min_amount: parseInt(minAmount),
        created_at: getCurrentTimestamp(),
        created_date: new Date().toLocaleString('vi-VN')
    };

    codes.push(codeEntry);
    await saveJSON(FILES.codes, codes);

    return codeEntry;
}

async function getCode(codeName) {
    const codes = await loadJSON(FILES.codes);
    const codeNameUpper = codeName.toUpperCase();

    for (const code of codes) {
        if (code.code_name === codeNameUpper) {
            return code;
        }
    }

    return null;
}

async function useCode(userId, codeName, checkAmount = 0) {
    const codes = await loadJSON(FILES.codes);
    const codeNameUpper = codeName.toUpperCase();
    const now = getCurrentTimestamp();
    const todayDate = formatDate(now);

    for (let i = 0; i < codes.length; i++) {
        const code = codes[i];

        if (code.code_name === codeNameUpper) {
            const expiryDate = code.expiry_date || '';

            if (expiryDate && expiryDate < todayDate) {
                return { success: false, message: `❌ Mã đã hết hạn. Hạn sử dụng: ${expiryDate}` };
            }

            if (code.expiry < now) {
                return { success: false, message: '❌ Mã đã hết hạn.' };
            }

            const minAmount = code.min_amount || 0;
            if (minAmount > 0 && checkAmount > 0 && checkAmount < minAmount) {
                const { formatVND } = require('./helpers');
                return { success: false, message: `❌ Mã yêu cầu số tiền tối thiểu ${formatVND(minAmount)}. Số tiền của bạn: ${formatVND(checkAmount)}` };
            }

            const usedBy = code.used_by || [];
            if (usedBy.includes(userId.toString())) {
                return { success: false, message: '❌ Bạn đã sử dụng mã này rồi.' };
            }

            if (code.used_count >= code.max_uses) {
                return { success: false, message: '❌ Mã đã hết lượt sử dụng.' };
            }

            const codeType = code.code_type;
            const value = code.value || 0;

            if (codeType === 'FREE_VIP') {
                codes[i].used_count = (code.used_count || 0) + 1;
                if (!codes[i].used_by) codes[i].used_by = [];
                codes[i].used_by.push(userId.toString());
                await saveJSON(FILES.codes, codes);

                const { setVIP } = require('./userManager');
                await setVIP(userId, value);

                return { success: true, message: `✅ Đã nhận ${value} ngày VIP miễn phí!`, type: 'VIP', value: value, code_info: code };
            } else if (codeType === 'DISCOUNT') {
                const { getUserData } = require('./userManager');
                const userData = await getUserData(userId);
                const oldCode = userData.active_discount_code;

                userData.active_discount_code = codeNameUpper;
                userData.active_discount_code_time = getCurrentTimestamp();

                const allUsers = await loadJSON(FILES.users);
                allUsers[userId.toString()] = userData;
                await saveJSON(FILES.users, allUsers);

                const oldMsg = oldCode && oldCode !== codeNameUpper ? `\n\n⚠️ Mã cũ \`${oldCode}\` đã bị thay thế.` : '';
                return { success: true, message: `✅ Mã giảm giá ${value}% đã được kích hoạt! Mã sẽ tự động áp dụng khi bạn nạp tiền hoặc mua VIP.${oldMsg}`, type: 'DISCOUNT', value: value, code_info: code };
            } else if (codeType === 'BONUS_DAYS') {
                const { getUserData } = require('./userManager');
                const userData = await getUserData(userId);
                const oldCode = userData.active_bonus_days_code;

                userData.active_bonus_days_code = codeNameUpper;
                userData.active_bonus_days_code_time = getCurrentTimestamp();

                const allUsers = await loadJSON(FILES.users);
                allUsers[userId.toString()] = userData;
                await saveJSON(FILES.users, allUsers);

                const oldMsg = oldCode && oldCode !== codeNameUpper ? `\n\n⚠️ Mã cũ \`${oldCode}\` đã bị thay thế.` : '';
                return { success: true, message: `✅ Mã tặng thêm ${value} ngày VIP đã được kích hoạt! Mã sẽ tự động áp dụng khi bạn mua VIP.${oldMsg}`, type: 'BONUS_DAYS', value: value, code_info: code };
            } else if (codeType === 'ADD_MONEY') {
                codes[i].used_count = (code.used_count || 0) + 1;
                if (!codes[i].used_by) codes[i].used_by = [];
                codes[i].used_by.push(userId.toString());
                await saveJSON(FILES.codes, codes);

                const { updateBalance, logUserHistory } = require('./userManager');
                const { formatVND } = require('./helpers');
                await updateBalance(userId, value);
                await logUserHistory(userId, 'code_reward', value, `Mã ${codeNameUpper}`);

                return { success: true, message: `✅ Đã nhận ${formatVND(value)} từ mã khuyến mãi!`, type: 'MONEY', value: value, code_info: code };
            }

            return { success: false, message: '❌ Loại mã không hợp lệ.' };
        }
    }

    return { success: false, message: '❌ Mã không tồn tại.' };
}

async function calculateBonusWithAI(baseAmount, userId) {
    try {
        const { getUserData } = require('./userManager');
        const userData = await getUserData(userId);
        const activeDiscountCode = userData.active_discount_code;
        const todayDate = formatDate(getCurrentTimestamp());

        let totalBonusPercent = 0;
        let bonusSources = [];

        if (activeDiscountCode) {
            const code = await getCode(activeDiscountCode);
            if (code && code.code_type === 'DISCOUNT') {
                const expiryDate = code.expiry_date || '';
                const minAmount = code.min_amount || 0;

                if ((!expiryDate || expiryDate >= todayDate) && (minAmount === 0 || baseAmount >= minAmount)) {
                    totalBonusPercent += code.value || 0;
                    bonusSources.push(`Mã ${activeDiscountCode} (${code.value}%)`);
                }
            }
        }

        if (totalBonusPercent === 0) {
            return {
                has_bonus: false,
                base_amount: baseAmount,
                bonus_percent: 0,
                bonus_amount: 0,
                total_amount: baseAmount,
                code_name: null,
                code_valid: false,
                validation_message: null
            };
        }

        const code = await getCode(activeDiscountCode);
        if (!code || code.code_type !== 'DISCOUNT') {
            userData.active_discount_code = null;
            const allUsers = await loadJSON(FILES.users);
            allUsers[userId.toString()] = userData;
            await saveJSON(FILES.users, allUsers);

            return {
                has_bonus: false,
                base_amount: baseAmount,
                bonus_percent: 0,
                bonus_amount: 0,
                total_amount: baseAmount,
                code_name: null,
                code_valid: false,
                validation_message: 'Mã không tồn tại hoặc không hợp lệ'
            };
        }

        const expiryDate = code.expiry_date || '';
        const minAmount = code.min_amount || 0;
        let codeValid = true;
        let validationMessage = 'Đạt';

        if (expiryDate && expiryDate < todayDate) {
            codeValid = false;
            validationMessage = `Không đạt - Mã đã hết hạn (${expiryDate})`;

            userData.active_discount_code = null;
            const allUsers = await loadJSON(FILES.users);
            allUsers[userId.toString()] = userData;
            await saveJSON(FILES.users, allUsers);
        } else if (minAmount > 0 && baseAmount < minAmount) {
            codeValid = false;
            const { formatVND } = require('./helpers');
            validationMessage = `Không đạt - Số tiền ${formatVND(baseAmount)} < Tối thiểu ${formatVND(minAmount)}`;
        }

        if (!codeValid) {
            return {
                has_bonus: false,
                base_amount: baseAmount,
                bonus_percent: 0,
                bonus_amount: 0,
                total_amount: baseAmount,
                code_name: activeDiscountCode,
                code_valid: false,
                validation_message: validationMessage
            };
        }

        const bonusPercent = code.value || 0;
        const baseDecimal = new Decimal(baseAmount.toString());
        const bonusDecimal = baseDecimal.times(new Decimal(bonusPercent.toString())).dividedBy(new Decimal('100'));
        const bonusAmount = parseInt(bonusDecimal.toFixed(0, Decimal.ROUND_HALF_UP));
        const totalAmount = parseInt(baseDecimal.plus(bonusDecimal).toFixed(0, Decimal.ROUND_HALF_UP));

        return {
            has_bonus: true,
            base_amount: baseAmount,
            bonus_percent: bonusPercent,
            bonus_amount: bonusAmount,
            total_amount: totalAmount,
            code_name: activeDiscountCode,
            code_valid: true,
            validation_message: validationMessage,
            min_amount: minAmount,
            expiry_date: expiryDate
        };
    } catch {
        return {
            has_bonus: false,
            base_amount: baseAmount,
            bonus_percent: 0,
            bonus_amount: 0,
            total_amount: baseAmount,
            code_name: null,
            code_valid: false,
            validation_message: 'Lỗi kiểm tra mã'
        };
    }
}

module.exports = {
    createCode,
    getCode,
    useCode,
    calculateBonusWithAI
};
