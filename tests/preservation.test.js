/**
 * Preservation Property Tests
 * 
 * Property 2: Preservation - LIVE/DIE Detection & Existing Flow Behavior
 * 
 * These tests MUST PASS on the current UNFIXED code.
 * They establish baseline behavior that must be preserved after the fix.
 * 
 * Validates: Requirements 3.1, 3.2, 3.5, 3.6
 */

const axios = require('axios');

jest.mock('axios');

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

describe('Preservation: LIVE Detection from valid "height" response', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Test 1: When Graph API returns a response containing "height" (profile picture exists),
     * checkUIDLiveDie() returns { status: 'LIVE' }.
     * 
     * This is core LIVE detection logic that MUST be preserved after the fix.
     * 
     * **Validates: Requirements 3.1**
     */
    test('checkUIDLiveDie returns LIVE when response contains "height"', async () => {
        axios.get.mockResolvedValue({
            data: { data: { height: 50, width: 50, url: 'https://scontent.xx.fbcdn.net/v/photo.jpg' } },
            status: 200,
        });

        const result = await checkUIDLiveDie('100001234567890');

        expect(result.status).toBe('LIVE');
    });

    /**
     * Test 1b: LIVE detection works with various UID formats.
     */
    test('checkUIDLiveDie returns LIVE for different UIDs with valid height response', async () => {
        axios.get.mockResolvedValue({
            data: { data: { height: 100, width: 100, url: 'https://example.com/pic.jpg' } },
            status: 200,
        });

        const uids = ['100000000000001', '61550000000000', '1234567890'];
        for (const uid of uids) {
            const result = await checkUIDLiveDie(uid);
            expect(result.status).toBe('LIVE');
        }
    });
});

describe('Preservation: DIE Detection from valid "error" response', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Test 2: When Graph API returns a response containing "error" (UID disabled/not found),
     * checkUIDLiveDie() returns { status: 'DIE' }.
     * 
     * This is core DIE detection logic that MUST be preserved after the fix.
     * 
     * **Validates: Requirements 3.2**
     */
    test('checkUIDLiveDie returns DIE when response contains "error"', async () => {
        axios.get.mockResolvedValue({
            data: { error: { message: 'Unsupported get request. Object with ID does not exist', code: 100, type: 'GraphMethodException' } },
            status: 200,
        });

        const result = await checkUIDLiveDie('100009876543210');

        expect(result.status).toBe('DIE');
    });

    /**
     * Test 2b: DIE detection works with different error response formats.
     */
    test('checkUIDLiveDie returns DIE for error response with different error codes', async () => {
        axios.get.mockResolvedValue({
            data: { error: { message: 'Invalid user id', code: 190 } },
            status: 200,
        });

        const result = await checkUIDLiveDie('999999999999999');

        expect(result.status).toBe('DIE');
    });
});

describe('Preservation: Done status UIDs skipped in auto-check', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Test 3: When UID has status 'done', checkSingleUID() returns null (skipped).
     * 
     * Done UIDs must continue to be skipped in the auto-check loop.
     * 
     * **Validates: Requirements 3.5**
     */
    test('checkSingleUID returns null for UID with status "done"', async () => {
        const uidInfo = {
            name: 'Done User',
            last_check: 'DIE',
            status: 'done',
            note: 'completed',
            price: 500000,
            part: 2,
            start_time: Math.floor(Date.now() / 1000) - 86400,
        };

        const result = await checkSingleUID('100001111111111', uidInfo, '12345');

        expect(result).toBeNull();
        // Verify checkUIDLiveDie was NOT called (UID was skipped before API call)
        expect(axios.get).not.toHaveBeenCalled();
    });
});

describe('Preservation: First run (UNKNOWN last_check) only updates status, no notification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Test 4: When UID is checked for the first time (last_check = 'UNKNOWN'),
     * checkSingleUID() returns update=true but notify=false.
     * 
     * First-time checks should only record the status, never send notifications.
     * 
     * **Validates: Requirements 3.6**
     */
    test('checkSingleUID returns notify=false when last_check is UNKNOWN', async () => {
        // Mock API to return LIVE
        axios.get.mockResolvedValue({
            data: { data: { height: 50, width: 50, url: 'https://example.com/pic.jpg' } },
            status: 200,
        });

        const uidInfo = {
            name: 'New User',
            last_check: 'UNKNOWN',
            status: 'active',
            note: 'first check',
            price: 0,
            part: 0,
            start_time: Math.floor(Date.now() / 1000),
        };

        const result = await checkSingleUID('100002222222222', uidInfo, '67890');

        expect(result).not.toBeNull();
        expect(result.update).toBe(true);
        expect(result.notify).toBe(false);
    });

    /**
     * Test 4b: First run with DIE result also only updates, no notification.
     */
    test('checkSingleUID returns notify=false when last_check is UNKNOWN even if DIE', async () => {
        // Mock API to return DIE
        axios.get.mockResolvedValue({
            data: { error: { message: 'Object does not exist', code: 100 } },
            status: 200,
        });

        const uidInfo = {
            name: 'New User DIE',
            last_check: 'UNKNOWN',
            status: 'active',
            note: 'first check die',
            price: 0,
            part: 0,
            start_time: Math.floor(Date.now() / 1000),
        };

        const result = await checkSingleUID('100003333333333', uidInfo, '67890');

        expect(result).not.toBeNull();
        expect(result.update).toBe(true);
        expect(result.notify).toBe(false);
    });
});
