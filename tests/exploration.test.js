/**
 * Bug Condition Exploration Test
 * 
 * Property 1: Fault Condition - Network/Timeout Errors Treated as DIE & Single Check Notification
 * 
 * These tests encode the EXPECTED (correct) behavior.
 * They MUST FAIL on the current unfixed code — failure confirms the bug exists.
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
 */

const axios = require('axios');

// Mock axios before requiring modules under test
jest.mock('axios');

// Mock all external dependencies that autoCheck.js and facebook.js pull in
jest.mock('../services/telegram', () => ({
    sendMessage: jest.fn(),
    sendAnimation: jest.fn(),
    sendPhoto: jest.fn(),
    getChatMember: jest.fn(),
}));

jest.mock('../services/storage', () => ({
    loadJSON: jest.fn().mockResolvedValue({}),
    saveJSON: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/trackingManager', () => ({
    getTracking: jest.fn().mockResolvedValue({}),
    manageUIDMemory: jest.fn().mockResolvedValue({ name: 'Test User', last_status_change: 0 }),
    getUIDMemory: jest.fn().mockResolvedValue(null),
}));

const { checkUIDLiveDie } = require('../services/facebook');
const { checkSingleUID } = require('../workers/autoCheck');

describe('Bug Condition Exploration: Network/Timeout Errors Treated as DIE', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Test 1: When ALL Graph API endpoints timeout, checkUIDLiveDie() should return UNKNOWN, not DIE.
     * 
     * Current buggy behavior: returns { status: 'DIE', info: 'Die' }
     * Expected correct behavior: returns { status: 'UNKNOWN', ... }
     * 
     * Root cause: catch block ignores errors, loop ends, falls through to
     * `return { status: 'DIE', info: 'Die' }` at the end of the function.
     */
    test('checkUIDLiveDie returns UNKNOWN (not DIE) when all endpoints timeout', async () => {
        const timeoutError = new Error('timeout of 5000ms exceeded');
        timeoutError.code = 'ECONNABORTED';
        axios.get.mockRejectedValue(timeoutError);

        const result = await checkUIDLiveDie('100001234567890');

        // EXPECTED: UNKNOWN when all requests fail due to timeout
        // ACTUAL (buggy): 'DIE' — this WILL FAIL on unfixed code
        expect(result.status).toBe('UNKNOWN');
    });

    /**
     * Test 2: When ALL Graph API endpoints return network error, should return UNKNOWN, not DIE.
     */
    test('checkUIDLiveDie returns UNKNOWN (not DIE) when all endpoints have network error', async () => {
        const networkError = new Error('Network Error');
        networkError.code = 'ERR_NETWORK';
        axios.get.mockRejectedValue(networkError);

        const result = await checkUIDLiveDie('100009876543210');

        // EXPECTED: UNKNOWN
        // ACTUAL (buggy): 'DIE' — WILL FAIL
        expect(result.status).toBe('UNKNOWN');
    });
});

describe('Bug Condition Exploration: Single Check Notification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Test 3: When a LIVE UID gets a single DIE result, checkSingleUID() should NOT
     * set notify=true immediately. It should require multiple consecutive DIE confirmations.
     * 
     * Current buggy behavior: notify=true after 1 status change (LIVE→DIE)
     * Expected correct behavior: notify=false until DIE_CONFIRM_COUNT (3) consecutive DIE checks
     * 
     * Root cause: `if (currStatus !== lastStatus)` immediately sets notify=true
     * with no confirmation counter.
     */
    test('checkSingleUID does NOT notify after a single DIE check (requires confirmation)', async () => {
        // Mock axios to return a DIE response (contains "error")
        axios.get.mockResolvedValue({
            data: { error: { message: 'Unsupported get request', code: 100 } },
            status: 200,
        });

        const { manageUIDMemory } = require('../utils/trackingManager');
        manageUIDMemory.mockResolvedValue({
            name: 'Test User',
            last_status_change: Math.floor(Date.now() / 1000),
        });

        // UID was previously LIVE, now API returns DIE — first time seeing DIE
        const uidInfo = {
            name: 'Test User',
            last_check: 'LIVE',
            status: 'active',
            note: 'test',
            price: 0,
            part: 0,
            start_time: Math.floor(Date.now() / 1000),
        };

        const result = await checkSingleUID('100001234567890', uidInfo, '12345');

        // EXPECTED: notify=false (needs 3 consecutive DIE checks to confirm)
        // ACTUAL (buggy): notify=true — WILL FAIL on unfixed code
        expect(result).not.toBeNull();
        expect(result.notify).toBe(false);
    });
});
