function generateQRCode(amount, userId) {
    const acc = '0398085063';
    const bank = 'ICB';
    const des = userId.toString();
    const template = 'compact';

    return `https://qr.sepay.vn/img?acc=${acc}&bank=${bank}&amount=${amount}&des=${des}&template=${template}&download=false`;
}

function generateDepositMessage(amount, userId) {
    const formattedAmount = amount.toLocaleString('vi-VN');

    return `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
🔥 HỆ THỐNG NẠP TIỀN NHANH 🔥
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

🏦 NGÂN HÀNG: VIETINBANK
💳 STK: 0398085063
👤 CHỦ TK: PHAM XUAN TIEN
💰 SỐ TIỀN: ${formattedAmount} VNĐ

📌 NỘI DUNG CK: 👉 ${userId} 👈

👉 QUÉT MÃ QR HOẶC CK THEO THÔNG TIN TRÊN
📝 Gửi bill tại đây để Admin duyệt.
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`;
}

module.exports = {
    generateQRCode,
    generateDepositMessage
};
