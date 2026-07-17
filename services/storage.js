const fs = require('fs').promises;
const path = require('path');
const lockfile = require('proper-lockfile');
const { FILES } = require('../config/constants');

const locks = new Map();

async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

async function loadJSON(filename) {
    const filePath = path.join(__dirname, '..', filename);

    try {
        await ensureDir(path.dirname(filePath));

        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            const isArray = [
                FILES.all_users,
                FILES.revenue,
                FILES.ratings,
                FILES.codes
            ].includes(filename);
            return isArray ? [] : {};
        }
        if (err.name === 'SyntaxError') {
            const isArray = [
                FILES.all_users,
                FILES.revenue,
                FILES.ratings,
                FILES.codes
            ].includes(filename);
            return isArray ? [] : {};
        }
        throw err;
    }
}

async function saveJSON(filename, data) {
    const filePath = path.join(__dirname, '..', filename);
    await ensureDir(path.dirname(filePath));

    let retries = 5;
    while (retries > 0) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
            return;
        } catch (err) {
            if (err.code === 'EBUSY' || err.code === 'EPERM') {
                retries--;
                await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
            } else {
                console.error(`Error saving ${filename}:`, err);
                return;
            }
        }
    }
    console.error(`Failed to save ${filename} after retries due to EBUSY/EPERM`);
}

async function loadText(filename) {
    const filePath = path.join(__dirname, '..', filename);

    try {
        return await fs.readFile(filePath, 'utf8');
    } catch {
        return '';
    }
}

async function saveText(filename, text) {
    const filePath = path.join(__dirname, '..', filename);

    try {
        await ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, text, 'utf8');
    } catch (err) {
        console.error(`Error saving ${filename}:`, err);
    }
}

async function initFiles() {
    for (const [key, filename] of Object.entries(FILES)) {
        const filePath = path.join(__dirname, '..', filename);

        try {
            await fs.access(filePath);
        } catch {
            await ensureDir(path.dirname(filePath));

            if (filename.endsWith('.json')) {
                const isArray = [
                    FILES.all_users,
                    FILES.revenue,
                    FILES.ratings,
                    FILES.codes
                ].includes(filename);
                await saveJSON(filename, isArray ? [] : {});
            } else if (filename.endsWith('.txt')) {
                await saveText(filename, '');
            }
        }
    }
}

module.exports = {
    loadJSON,
    saveJSON,
    loadText,
    saveText,
    initFiles
};
