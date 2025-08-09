require('dotenv').config();

const token = process.env.BOT_TOKEN;
const adminChatId = process.env.ADMIN_CHAT_ID;
const paymentCard = '9860346607403174';
const moogoldEmail = process.env.MOOGOLD_EMAIL;
const moogoldPassword = process.env.MOOGOLD_PASSWORD;

const donationPackages = [
    { name: 'Haftalik — 19.500 SO\'M 🌟 ( 220 💎 + 70 ⭐ )', moogoldValue: 'Weekly Pass' },
    { name: '279 💎 — 50.500 SO\'M🔥(TOKEN Uchun)', moogoldValue: '284 Diamonds' },
    { name: '22 💎 — 5.000 SO\'M', moogoldValue: '20 + 2 Diamonds' },
    { name: '56 💎 — 11.000 SO\'M 🔥', moogoldValue: '51 + 5 Diamonds' },
    { name: '86 💎 — 15.500 SO\'M 🔥', moogoldValue: '70 Diamonds' },
    { name: '172 💎 — 31.000 SO\'M 🔥', moogoldValue: '140 Diamonds' },
    { name: '257 💎 — 45.500 SO\'M 🔥', moogoldValue: '203 + 20 Diamonds' },
    { name: '343 💎 — 61.500 SO\'M 🔥', moogoldValue: '284 Diamonds' },
    { name: '706 💎 — 122.500 SO\'M 🔥', moogoldValue: '716 Diamonds' },
    { name: '1041 💎 — 185.000 SO\'M 🔥', moogoldValue: '1007 + 156 Diamonds' },
    { name: '1412 💎 — 245.000 SO\'M 🔥', moogoldValue: '1446 Diamonds' },
    { name: '2195 💎 — 364.000 SO\'M 🔥', moogoldValue: '2015 + 383 Diamonds' },
    { name: '3688 💎 — 610.000 SO\'M 🔥', moogoldValue: '2976 Diamonds' },
    { name: '5532 💎 — 920.000 SO\'M 🔥', moogoldValue: '5035 + 1007 Diamonds' },
    { name: '50+50 💎 — 11.000 SO\'M ⚡ (Birinchi marta olishda ishlaydi)', moogoldValue: '50 + 50 Diamonds (First Top-Up Bonus)' },
    { name: '150+150 💎 — 32.000 SO\'M ⚡ (Birinchi marta olishda ishlaydi)', moogoldValue: '150 + 150 Diamonds (First Top-Up Bonus)' },
    { name: '250+250 💎 — 52.000 SO\'M ⚡ (Birinchi marta olishda ishlaydi)', moogoldValue: '250 + 250 Diamonds (First Top-Up Bonus)' },
    { name: '500+500 💎 — 105.000 SO\'M ⚡ (Birinchi marta olishda ishlaydi)', moogoldValue: '500 + 500 Diamonds (First Top-Up Bonus)' },
    { name: 'Summerchniy Propusk— 105.000 SO\'M 🌟', moogoldValue: 'Twilight Pass' },
];

module.exports = {
    token,
    adminChatId,
    paymentCard,
    moogoldEmail,
    moogoldPassword,
    donationPackages,
};