const axios = require('axios');
const { DEEPSEEK_API_KEY } = require('../config/constants');

async function callDeepSeekAI(systemPrompt, userPrompt, temperature = 0.7) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        };

        const data = {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            stream: false,
            temperature
        };

        const response = await axios.post('https://api.deepseek.com/chat/completions', data, {
            headers,
            timeout: 30000
        });

        if (response.status === 200) {
            return response.data.choices[0].message.content.trim();
        }

        return null;
    } catch (err) {
        console.error('DeepSeek AI Error:', err.message);
        return null;
    }
}

// Hàm Chat cho User (Worm Bot)
async function chatWithWorm(userMessage, systemPrompt) {
    try {
        const reply = await callDeepSeekAI(systemPrompt, userMessage, 0.9); // Temp cao cho sáng tạo/bựa
        return reply || "Tao đéo hiểu, nói lại đê!";
    } catch {
        return "Tao đang bận, cút!";
    }
}

// Hàm Xử lý lệnh Admin
async function processAdminCommand(adminMessage, systemPrompt) {
    try {
        const fullUserPrompt = `Admin Command: "${adminMessage}"\n\nPhân tích và trả về JSON thực thi lệnh. Chỉ JSON, không giải thích.`;
        const content = await callDeepSeekAI(systemPrompt, fullUserPrompt, 0.2); // Temp thấp cho chính xác

        if (!content) return null;

        let jsonContent = content;
        // Clean markdown code blocks
        if (content.includes('```json')) {
            jsonContent = content.match(/```json([\s\S]*?)```/)[1];
        } else if (content.includes('```')) {
            jsonContent = content.match(/```([\s\S]*?)```/)[1];
        }

        return JSON.parse(jsonContent.trim());
    } catch (err) {
        // console.error("Parse Admin Command Error:", err);
        return null;
    }
}

async function analyzeRating(stars, message) {
    const systemPrompt = `Bạn là AI phân tích đánh giá chuyên nghiệp của Facebook Business.
Nhiệm vụ: Phân tích đánh giá và phản hồi chuyên nghiệp.
Output JSON: { "sentiment": "enum", "summary": "string", "response": "string" }`;

    const userPrompt = `Stars: ${stars}\nMessage: ${message}`;

    try {
        const content = await callDeepSeekAI(systemPrompt, userPrompt);
        if (!content) throw new Error("No content");

        let jsonContent = content;
        if (content.includes('{')) {
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}') + 1;
            jsonContent = content.substring(start, end);
        }

        return JSON.parse(jsonContent);
    } catch (err) {
        return {
            sentiment: 'suggestion',
            summary: 'Đánh giá từ người dùng',
            response: 'Cảm ơn Quý khách đã đánh giá.'
        };
    }
}

async function consultVIPSales(userName, basePrice, balance, totalSpent) {
    const { loadText } = require('./storage');
    const promptTemplate = await loadText('data/prompt_sales_agent.txt');

    if (!promptTemplate) return null;

    const userPrompt = promptTemplate
        .replace('{name}', userName)
        .replace('{base_price}', basePrice)
        .replace('{balance}', balance)
        .replace('{total_spent}', totalSpent); // Thêm dòng này

    try {
        const content = await callDeepSeekAI("You are a smart sales JSON generator.", userPrompt, 0.7);
        if (!content) return null;

        let jsonContent = content;
        if (content.includes('```json')) {
            jsonContent = content.match(/```json([\s\S]*?)```/)[1];
        } else if (content.includes('{')) {
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}') + 1;
            jsonContent = content.substring(start, end);
        }

        return JSON.parse(jsonContent);
    } catch (err) {
        console.error("Sales AI Error:", err);
        return null;
    }
}

// Hàm Chat AI đơn giản (cho broadcast)
async function chatWithAI(prompt) {
    try {
        const systemPrompt = "Bạn là chuyên gia soạn thảo thông báo chuyên nghiệp.";
        const reply = await callDeepSeekAI(systemPrompt, prompt, 0.7);
        return reply || prompt; // Fallback về nội dung gốc nếu lỗi
    } catch {
        return prompt;
    }
}

module.exports = {
    callDeepSeekAI,
    analyzeRating,
    chatWithWorm,
    processAdminCommand,
    consultVIPSales,
    chatWithAI
};
