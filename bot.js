const TelegramBot = require('node-telegram-bot-api');
const { token } = require('./config');
const { registerHandlers } = require('./handlers');

const bot = new TelegramBot(token, { polling: true });

registerHandlers(bot);

console.log('Bot is running...');