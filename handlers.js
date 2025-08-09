const { token, adminChatId, paymentCard, donationPackages } = require('./config');
const { loadData, saveData } = require('./fileOperations');
const { userStates, updateUserState, cleanupUserState } = require('./stateManagement');
const { generateCheckCode, parseUserIdAndServerId } = require('./utils');
const { createDonationKeyboard, createUserIdKeyboard } = require('./keyboards');
const { topUpDiamonds } = require('./moogoldAutomation');

function formatUserTransactionStatus(transactions) {
    if (!transactions || transactions.length === 0) {
        return '❌ Hozirda tranzaksiyalaringiz yo‘q.';
    }

    return transactions.map(t => `
🆔 Tranzaksiya ID: <code>${t.id}</code>
💎 Paket: ${t.packageName}
🔢 Tekshiruv kodi: <code>${t.checkCode}</code>
👤 UserID: ${t.userId}
🖥️ ServerID: ${t.serverId}
📅 Vaqt: ${new Date(t.timestamp).toLocaleString()}
📊 Status: ${t.status}
    `).join('\n──────────────\n');
}

function formatAdminTransactionStatus(transactions) {
    if (!transactions || transactions.length === 0) {
        return '❌ Hozirda tranzaksiyalar yo‘q.';
    }

    return transactions.map(t => `
🆔 Tranzaksiya ID: <code>${t.id}</code>
📱 Chat ID: ${t.chatId}
👤 UserID: ${t.userId}
🖥️ ServerID: ${t.serverId}
💎 Paket: ${t.packageName}
🔢 Tekshiruv kodi: <code>${t.checkCode}</code>
📅 Vaqt: ${new Date(t.timestamp).toLocaleString()}
📊 Status: ${t.status}
    `).join('\n──────────────\n');
}

async function handleRegistration(bot, chatId, userId, serverId) {
    const data = await loadData();

    if (!data.users[chatId]) data.users[chatId] = [];

    const exists = data.users[chatId].some(r => r.userId === userId && r.serverId === serverId);

    if (exists) {
        await bot.sendMessage(chatId, "⚠️ Ushbu UserID va ServerID allaqachon ro‘yxatdan o‘tgan!");
        await showDonationPackages(bot, chatId);
        return;
    }

    data.users[chatId].push({ userId, serverId, registeredAt: new Date().toISOString() });
    await saveData(data);

    await bot.sendMessage(chatId, `✅ Siz muvaffaqiyatli ro‘yxatdan o‘tdingiz!  
UserID: ${userId}  
ServerID: ${serverId}`);

    setTimeout(() => showDonationPackages(bot, chatId), 1000);
}

async function showDonationPackages(bot, chatId) {
    await bot.sendMessage(chatId, "🎁 Iltimos, donat paketini tanlang:", createDonationKeyboard());
}

async function handleNewRegistration(bot, chatId, text) {
    const parsed = parseUserIdAndServerId(text);
    if (!parsed) {
        await bot.sendMessage(chatId, "❗️ Noto‘g‘ri format! Iltimos, UserID va ServerID ni quyidagi shaklda yuboring: 1234567890 (12345)");
        return;
    }

    await handleRegistration(bot, chatId, parsed.userId, parsed.serverId);
}

async function showUserIdSelection(bot, chatId) {
    const data = await loadData();
    const users = data.users[chatId] || [];

    if (users.length === 0) {
        await bot.sendMessage(chatId, "⚠️ Avvalo ro‘yxatdan o‘tishingiz kerak! Iltimos, UserID va ServerID ni quyidagi formatda yuboring: 1234567890 (12345)");
        return;
    }

    await bot.sendMessage(chatId, "📋 Ro‘yxatdan o‘tgan UserIDlaringizdan birini tanlang yoki yangi qo‘shing:", createUserIdKeyboard(users));
}

async function continueTransaction(bot, chatId, userIndex) {
    const data = await loadData();
    const users = data.users[chatId] || [];
    const selectedUser = users[userIndex];

    if (!selectedUser) {
        await bot.sendMessage(chatId, "❌ Noto‘g‘ri tanlov. Iltimos, qayta urinib ko‘ring.");
        return;
    }

    updateUserState(chatId, {
        selectedUser,
        state: 'waiting_for_payment',
        packageName: userStates[chatId].packageName,
        packageIndex: userStates[chatId].packageIndex,
        checkCode: userStates[chatId].checkCode,
        paymentReminderSent: false
    });

    const packageName = userStates[chatId].packageName || "Noma'lum paket";
    const checkCode = userStates[chatId].checkCode || "Noma'lum kod";

    const paymentMessage = `💳 To‘lov talab qilinadi

💎 Paket: ${packageName}
🔢 Tekshiruv kodi: <code>${checkCode}</code>
👤 UserID: ${selectedUser.userId}
🖥️ ServerID: ${selectedUser.serverId}

💳 To‘lov kartasi: <code>${paymentCard}</code>

Yuqoridagi karta raqamiga pul yuboring, so‘ng to‘lovingizning skrinshotini yuboring va oxirida “To‘lov bajarildi” tugmasini bosing, shunda adminga tasdiqlash uchun xabar jo‘natiladi.`;

    await bot.sendMessage(chatId, paymentMessage, { parse_mode: "HTML" });
}

async function handlePaymentCompleted(bot, chatId) {
    const transactionData = userStates[chatId];
    if (!transactionData || !transactionData.selectedUser) {
        await bot.sendMessage(chatId, "⚠️ Tranzaksiya ma'lumotlari topilmadi. Iltimos, boshidan boshlang.");
        return;
    }

    if (!transactionData.paymentScreenshot) {
        await bot.sendMessage(chatId, "📸 Iltimos, avvalo to‘lov skrinshotini yuboring, keyin to‘lovni yakunlang.");
        return;
    }

    const { selectedUser, checkCode, packageName } = transactionData;
    const data = await loadData();

    const transactionId = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const transaction = {
        id: transactionId,
        chatId,
        userId: selectedUser.userId,
        serverId: selectedUser.serverId,
        packageName,
        checkCode,
        paymentCard,
        paymentScreenshot: transactionData.paymentScreenshot,
        timestamp: new Date().toISOString(),
        status: 'Jarayonda'
    };

    data.transactions.push(transaction);
    await saveData(data);

    const adminPhotoCaption = `🔔 Yangi Donat Talabi (To‘lov Skrinshoti)

👤 UserID: ${selectedUser.userId}
🖥️ ServerID: ${selectedUser.serverId}
💎 Paket: ${packageName}
🔢 Tekshiruv kodi: <code>${checkCode}</code>
💳 To‘lov kartasi: <code>${paymentCard}</code>
📱 Telegram Chat ID: ${chatId}
🆔 Tranzaksiya ID: <code>${transactionId}</code>

📸 To‘lov skrinshoti yuklangan vaqti: ${new Date(transactionData.paymentScreenshot.uploadedAt).toLocaleString()}`;

    const adminKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Qabul qilindi!', callback_data: `admin_accept_${transactionId}` },
                    { text: '❌ Rad etildi', callback_data: `admin_dismiss_${transactionId}` }
                ]
            ]
        }
    };

    await bot.sendPhoto(adminChatId, transactionData.paymentScreenshot.fileId, {
        caption: adminPhotoCaption,
        parse_mode: "HTML",
        ...adminKeyboard
    });

    await bot.sendMessage(chatId, `✅ Skrinshot qabul qilindi!

💎 Paket: ${packageName}
🔢 Tekshiruv kodi: <code>${checkCode}</code>

Adminga to‘lov skrinshotingiz yuborildi va ular tasdiqlashni amalga oshiradi. Iltimos, natijani kuting.`, { parse_mode: "HTML" });

    cleanupUserState(chatId);
}

async function handleAdminAction(bot, callbackQuery, action, transactionId) {
    const data = await loadData();
    const transaction = data.transactions.find(t => t.id === transactionId);
    if (!transaction) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❗️ Tranzaksiya topilmadi yoki allaqachon qayta ishlangan.', show_alert: true });
        return;
    }

    if (transaction.status !== 'Jarayonda') {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❗️ Ushbu tranzaksiya allaqachon qayta ishlangan.', show_alert: true });
        return;
    }

    if (action === 'accept') {
        transaction.status = 'Bajarildi';
        await bot.sendMessage(transaction.chatId, `🎉 To‘lovingiz tasdiqlandi! Donat paketi savatga qo‘shilmoqda...\n\nUserID: ${transaction.userId}\nPaket: ${transaction.packageName}`, { parse_mode: "HTML" });

        const packageIndex = donationPackages.findIndex(p => p.name === transaction.packageName);
        const userIndex = data.users[transaction.chatId].findIndex(u => u.userId === transaction.userId && u.serverId === transaction.serverId);

        if (packageIndex === -1 || userIndex === -1) {
            await bot.sendMessage(transaction.chatId, "❌ Tranzaksiya ma'lumotlari noto‘g‘ri. Iltimos, administrator bilan bog‘laning.");
            await bot.sendMessage(adminChatId, `❌ Tranzaksiya ID: ${transactionId} uchun MooGold avtomatizatsiyasi ishlamadi. Paket yoki foydalanuvchi topilmadi.`);
            return;
        }

        const success = await topUpDiamonds(bot, transaction.chatId, userIndex, packageIndex);
        if (success) {
            await bot.sendMessage(transaction.chatId, `✅ Donat paketingiz muvaffaqiyatli savatga qo‘shildi! Iltimos, savatni tekshirib, to‘lovni qo‘lda amalga oshiring: https://moogold.com/cart/`);
        } else {
            await bot.sendMessage(transaction.chatId, `❌ Donat paketi savatga qo‘shishda xatolik yuz berdi. Iltimos, administrator bilan bog‘laning.`);
            await bot.sendMessage(adminChatId, `❌ Tranzaksiya ID: ${transactionId} uchun MooGold avtomatizatsiyasi muvaffaqiyatsiz yakunlandi.`);
        }

        try {
            await bot.editMessageCaption(`✅ Donat qabul qilindi va savatga qo‘shildi!`, {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id,
                parse_mode: "HTML"
            });
        } catch (error) {
            console.error('Error editing message caption:', error.message);
        }
    } else if (action === 'dismiss') {
        transaction.status = 'Rad etildi';
        await bot.sendMessage(transaction.chatId, `❌ To‘lovingiz rad qilindi. Iltimos, administrator bilan bog‘laning.`, { parse_mode: "HTML" });
        try {
            await bot.editMessageCaption(`❌ Donat rad etildi!`, {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id,
                parse_mode: "HTML"
            });
        } catch (error) {
            console.error('Error editing message caption:', error.message);
        }
    }

    await saveData(data);
    await bot.answerCallbackQuery(callbackQuery.id);
}

function registerHandlers(bot) {
    bot.onText(/\/status/, async (msg) => {
        const chatId = msg.chat.id;
        const data = await loadData();

        const userTransactions = data.transactions.filter(t => t.chatId == chatId);
        const statusMessage = formatUserTransactionStatus(userTransactions);

        await bot.sendMessage(chatId, `<b>📋 Sizning tranzaksiyalaringiz:</b>\n\n${statusMessage}`, { parse_mode: "HTML" });
    });

    bot.onText(/\/adminstatus/, async (msg) => {
        const chatId = msg.chat.id;

        if (chatId != adminChatId) {
            await bot.sendMessage(chatId, "❌ Bu komanda faqat adminlar uchun!");
            return;
        }

        const data = await loadData();
        const statusMessage = formatAdminTransactionStatus(data.transactions);

        await bot.sendMessage(chatId, `<b>📋 Barcha tranzaksiyalar:</b>\n\n${statusMessage}`, { parse_mode: "HTML" });
    });

    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const data = await loadData();

        if (data.users[chatId] && data.users[chatId].length > 0) {
            const welcomeMessage = `👋 Qaytadan xush kelibsiz!  
Sizda <b>${data.users[chatId].length}</b> ta ro‘yxatdan o‘tgan UserID mavjud.`;
            await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "HTML" });
            setTimeout(() => showDonationPackages(bot, chatId), 1000);
        } else {
            const welcomeMessage = `🌟 Assalomu alaykum!  
Iltimos, avval ro‘yxatdan o‘tish uchun  
<b>UserID</b> va <b>ServerID</b> ni quyidagi formatda yuboring:  
<code>1234567890 (12345)</code>`;
            await bot.sendMessage(chatId, welcomeMessage, { parse_mode: "HTML" });
        }
    });

    bot.onText(/\/topup/, async (msg) => {
        const chatId = msg.chat.id;
        const data = await loadData();

        if (data.users[chatId] && data.users[chatId].length > 0) {
            await showDonationPackages(bot, chatId);
        } else {
            await bot.sendMessage(chatId, "⚠️ Avvalo ro‘yxatdan o‘tishingiz kerak! Iltimos, UserID va ServerID ni quyidagi formatda yuboring: 1234567890 (12345)");
        }
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!text || text.startsWith('/')) return;

        if (userStates[chatId]) {
            if (userStates[chatId].state === 'waiting_for_new_registration') {
                await handleNewRegistration(bot, chatId, text);
                return;
            }

            if (userStates[chatId].state === 'waiting_for_payment' || userStates[chatId].state === 'waiting_for_payment_screenshot') {
                if (!userStates[chatId].paymentReminderSent) {
                    await bot.sendMessage(chatId, "📸 Avvalo to‘lovingizning skrinshotini yuboring, so‘ngra «To‘lov bajarildi» tugmasini bosing.");
                    updateUserState(chatId, { ...userStates[chatId], paymentReminderSent: true });
                }
                return;
            }

            if (userStates[chatId].state === 'screenshot_uploaded') {
                return;
            }
        }

        const parsed = parseUserIdAndServerId(text);
        if (parsed) {
            await handleNewRegistration(bot, chatId, text);
        } else {
            await bot.sendMessage(chatId, "⚠️ Iltimos, UserID va ServerID ni quyidagi formatda yuboring: 1234567890 (12345)");
        }
    });

    bot.on('photo', async (msg) => {
        const chatId = msg.chat.id;

        console.log(`Photo received for chatId: ${chatId}, current state:`, userStates[chatId]);

        if (userStates[chatId] && (userStates[chatId].state === 'waiting_for_payment' || userStates[chatId].state === 'waiting_for_payment_screenshot')) {
            const photo = msg.photo[msg.photo.length - 1];

            updateUserState(chatId, {
                ...userStates[chatId],
                state: 'screenshot_uploaded',
                paymentScreenshot: {
                    fileId: photo.file_id,
                    fileUniqueId: photo.file_unique_id,
                    uploadedAt: new Date().toISOString()
                },
                lastActivity: Date.now()
            });

            console.log(`State updated to screenshot_uploaded for chatId: ${chatId}`, userStates[chatId]);

            const confirmMessage = `✅ To‘lov skrinshoti qabul qilindi!\n\nEndi «To‘lov bajarildi» tugmasini bosing, shunda adminga tasdiqlash uchun xabar yuboriladi.`;

            const paymentKeyboard = {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ To‘lov bajarildi', callback_data: 'payment_completed' }
                    ]]
                }
            };

            await bot.sendMessage(chatId, confirmMessage, paymentKeyboard);
        } else {
            console.log(`Invalid state for photo upload in chatId: ${chatId}, state:`, userStates[chatId]?.state);
            await bot.sendMessage(chatId, "🔰 Iltimos, avvalo /start yoki /topup komandasi orqali donat jarayonini boshlang.");
        }
    });

    bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;

        if (data.startsWith('donation_')) {
            const index = parseInt(data.split('_')[1]);
            const packageName = donationPackages[index].name;
            const checkCode = generateCheckCode();

            updateUserState(chatId, { state: 'selecting_user', packageName, packageIndex: index, checkCode });
            await showUserIdSelection(bot, chatId);
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }

        if (data.startsWith('select_user_')) {
            const index = parseInt(data.split('_')[2]);

            if (!userStates[chatId] || !userStates[chatId].packageName) {
                await bot.sendMessage(chatId, "⚠️ Iltimos, avval donat paketini tanlang.");
                await bot.answerCallbackQuery(callbackQuery.id);
                return;
            }

            await continueTransaction(bot, chatId, index);
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }

        if (data === 'add_new_user') {
            updateUserState(chatId, { state: 'waiting_for_new_registration' });
            await bot.sendMessage(chatId, "Iltimos, yangi UserID va ServerID ni quyidagi formatda yuboring:\n1234567890 (12345)");
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }

        if (data === 'payment_completed') {
            console.log(`Payment completed callback for chatId: ${chatId}, current state:`, userStates[chatId]);

            if (userStates[chatId] && userStates[chatId].state === 'screenshot_uploaded') {
                await handlePaymentCompleted(bot, chatId);
                try {
                    await bot.deleteMessage(chatId, messageId);
                } catch (error) {
                    console.error('Error deleting message:', error.message);
                }
            } else {
                console.warn(`Invalid state for payment_completed in chatId: ${chatId}, state:`, userStates[chatId]?.state);
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: "📸 Iltimos, avval to‘lov skrinshotini yuboring yoki jarayonni qaytadan boshlang!",
                    show_alert: true
                });
            }
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }

        if (data.startsWith('admin_accept_')) {
            const transactionId = data.replace('admin_accept_', '');
            await handleAdminAction(bot, callbackQuery, 'accept', transactionId);
            return;
        }

        if (data.startsWith('admin_dismiss_')) {
            const transactionId = data.replace('admin_dismiss_', '');
            await handleAdminAction(bot, callbackQuery, 'dismiss', transactionId);
            return;
        }

        await bot.answerCallbackQuery(callbackQuery.id);
    });
}

module.exports = {
    registerHandlers,
};