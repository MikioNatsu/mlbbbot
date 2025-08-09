const userStates = {};

function updateUserState(chatId, state) {
    userStates[chatId] = { ...userStates[chatId], ...state, lastActivity: Date.now() };
}

function cleanupUserState(chatId) {
    delete userStates[chatId];
}

module.exports = {
    userStates,
    updateUserState,
    cleanupUserState
};