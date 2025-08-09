const fs = require('fs').promises;
const lockfile = require('proper-lockfile');

const DATA_FILE = './data.json';

async function loadData() {
    try {
        await fs.access(DATA_FILE);
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        // Ensure backward compatibility: remove region from existing users
        for (const chatId in parsed.users) {
            parsed.users[chatId] = parsed.users[chatId].map(({ userId, serverId, registeredAt }) => ({
                userId,
                serverId,
                registeredAt: registeredAt || new Date().toISOString()
            }));
        }
        return parsed;
    } catch (error) {
        return { users: {}, transactions: [] };
    }
}

async function saveData(data) {
    try {
        await lockfile.lock(DATA_FILE);
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        await lockfile.unlock(DATA_FILE);
    } catch (error) {
        console.error('Error saving data:', error.message);
        await lockfile.unlock(DATA_FILE);
        throw error;
    }
}

module.exports = {
    loadData,
    saveData
};