function parseUserIdAndServerId(text) {
    const regex = /^(\d+)\s*\((\d+)\)$/;
    const match = text.match(regex);
    if (!match) return null;
    return { userId: match[1], serverId: match[2] };
}

function generateCheckCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

module.exports = {
    parseUserIdAndServerId,
    generateCheckCode
};