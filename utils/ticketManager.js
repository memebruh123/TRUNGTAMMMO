const { loadJSON, saveJSON } = require('../services/storage');
const { getCurrentTimestamp, formatDate } = require('./helpers');
const path = require('path');

const TICKETS_FILE = 'data/tickets.json';

// Ensure tickets file exists
async function initTicketsFile() {
    const fs = require('fs');
    if (!fs.existsSync(TICKETS_FILE)) {
        await saveJSON(TICKETS_FILE, {});
    }
}

async function createTicket(userId, type = 'AI') {
    await initTicketsFile();
    const tickets = await loadJSON(TICKETS_FILE);

    const ticketId = `T${Date.now()}_${userId}`;
    const newTicket = {
        id: ticketId,
        userId: userId,
        type: type, // 'AI' or 'HUMAN'
        status: 'OPEN', // OPEN, CLOSED
        created_at: getCurrentTimestamp(),
        closed_at: null,
        messages: [],
        summary: null
    };

    tickets[ticketId] = newTicket;
    await saveJSON(TICKETS_FILE, tickets);
    return newTicket;
}

async function closeTicket(ticketId, summary = 'Ended by user') {
    try {
        await initTicketsFile();
        const tickets = await loadJSON(TICKETS_FILE);
        if (tickets[ticketId]) {
            tickets[ticketId].status = 'CLOSED';
            tickets[ticketId].closed_at = getCurrentTimestamp();
            tickets[ticketId].summary = summary;
            await saveJSON(TICKETS_FILE, tickets);
            console.log('✅ [TICKET] Closed successfully:', ticketId);
            return true;
        }
        console.log('⚠️ [TICKET] Not found:', ticketId);
        return false;
    } catch (err) {
        console.error('❌ [TICKET] Error closing:', err);
        return false;
    }
}

async function addTicketMessage(ticketId, role, content) {
    // role: 'user' or 'bot' or 'admin'
    const tickets = await loadJSON(TICKETS_FILE);
    if (tickets[ticketId]) {
        tickets[ticketId].messages.push({
            role: role,
            content: content,
            time: getCurrentTimestamp()
        });
        await saveJSON(TICKETS_FILE, tickets);
    }
}

async function getUserTickets(userId) {
    const tickets = await loadJSON(TICKETS_FILE);
    return Object.values(tickets)
        .filter(t => t.userId == userId)
        .sort((a, b) => b.created_at - a.created_at); // Newest first
}

async function getTicket(ticketId) {
    const tickets = await loadJSON(TICKETS_FILE);
    return tickets[ticketId];
}

module.exports = {
    createTicket,
    closeTicket,
    addTicketMessage,
    getUserTickets,
    getTicket
};
