const { donationPackages } = require('./config');

function createDonationKeyboard() {
    const keyboard = [];
    const packagesPerRow = 2;

    for (let i = 0; i < donationPackages.length; i += packagesPerRow) {
        const row = [];
        for (let j = i; j < Math.min(i + packagesPerRow, donationPackages.length); j++) {
            row.push({
                text: donationPackages[j].name,
                callback_data: `donation_${j}`
            });
        }
        keyboard.push(row);
    }

    return { reply_markup: { inline_keyboard: keyboard } };
}

function createUserIdKeyboard(userRegistrations) {
    const keyboard = userRegistrations.map((registration, index) => [{
        text: `UserID: ${registration.userId} (Server: ${registration.serverId})`,
        callback_data: `select_user_${index}`
    }]);

    keyboard.push([{ text: '➕ Yangi UserID qo‘shish', callback_data: 'add_new_user' }]);

    return { reply_markup: { inline_keyboard: keyboard } };
}

module.exports = {
    createDonationKeyboard,
    createUserIdKeyboard,
};