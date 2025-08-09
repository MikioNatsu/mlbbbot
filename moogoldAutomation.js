const puppeteer = require('puppeteer');
const { createDonationKeyboard } = require('./keyboards');

async function loginToMooGold(page, email, password) {
    try {
        console.log('Attempting to navigate to MooGold login page');
        await page.goto('https://moogold.com/my-account/', { waitUntil: 'networkidle2', timeout: 90000 });
        console.log('Navigated to MooGold login page');

        // Check if already logged in
        const isLoggedIn = await page.evaluate(() => document.querySelector('.woocommerce-MyAccount-navigation, .my-account, .account-details') !== null);
        if (isLoggedIn) {
            console.log('Already logged in to MooGold');
            return true;
        }

        // Try login link
        console.log('Attempting to click login link');
        const loginLinkSelectors = ['a[href*="/my-account"]', 'a[href*="/login"]', 'a[href*="/account"]', '.login a'];
        let loginLinkFound = false;
        for (const selector of loginLinkSelectors) {
            const loginLink = await page.$(selector);
            if (loginLink) {
                await loginLink.click();
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 40000 }).catch(() => console.log('Navigation after login link click not required'));
                loginLinkFound = true;
                break;
            }
        }

        // Wait for login form
        const loginFormSelectors = ['input[name="username"]', 'input#username', 'input[type="text"]', 'input[type="email"]'];
        let loginFormSelector = null;
        for (const selector of loginFormSelectors) {
            const element = await page.$(selector);
            if (element) {
                loginFormSelector = selector;
                console.log(`Found login form input with selector: ${selector}`);
                break;
            }
        }

        if (!loginFormSelector) {
            console.error('Login form not found');
            return false;
        }

        await page.waitForSelector(loginFormSelector, { timeout: 40000 });
        console.log('Login form loaded');

        await page.type(loginFormSelector, email);
        await page.type('input[name="password"], input#password, input[type="password"]', password);
        console.log('Credentials entered');

        const submitButtonSelectors = ['button[name="login"]', 'button[type="submit"]', '.woocommerce-Button', 'button[class*="login"]'];
        let submitButton = null;
        for (const selector of submitButtonSelectors) {
            const button = await page.$(selector);
            if (button) {
                submitButton = button;
                console.log(`Found login submit button with selector: ${selector}`);
                break;
            }
        }

        if (!submitButton) {
            console.error('Login submit button not found');
            return false;
        }

        await submitButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 50000 }).catch(() => console.log('Post-login navigation completed or not required'));
        console.log('Logged in to MooGold successfully');
        return true;
    } catch (error) {
        console.error('Error logging in to MooGold:', error.message);
        return false;
    }
}

async function selectDiamondDenomination(page, moogoldValue, bot, chatId) {
    try {
        console.log('Navigating to Mobile Legends top-up page');
        await page.goto('https://moogold.com/product/mobile-legends/', { waitUntil: 'networkidle2', timeout: 90000 });
        console.log('Navigated to Mobile Legends top-up page');

        // Check for CAPTCHAs or popups
        const captchaPresent = await page.$('.g-recaptcha, [id*="captcha"], [class*="captcha"], [id*="cf-turnstile"], .challenge-form');
        if (captchaPresent) {
            console.error('CAPTCHA detected on page');
            await bot.sendMessage(chatId, '❌ CAPTCHA aniqlandi. Iltimos, MooGold saytida qo‘lda davom eting: https://moogold.com/product/mobile-legends/');
            return { success: false, error: 'CAPTCHA detected' };
        }

        // Handle popups
        const popupSelectors = ['.popup-close', '.close-button', '[aria-label="Close"], button[class*="close"]'];
        for (const selector of popupSelectors) {
            const popupClose = await page.$(selector);
            if (popupClose) {
                await popupClose.click();
                console.log(`Closed popup with selector: ${selector}`);
                await page.waitForTimeout(1000);
            }
        }

        // Try multiple selectors for the denomination dropdown
        const possibleSelectors = [
            'select[name="variation_id"]',
            'select#variation_id',
            'select[name="product_id"]',
            'select[class*="variation"]',
            'select[data-product_id]',
            'select[class*="product"]',
            'select'
        ];

        let selectSelector = null;
        for (const selector of possibleSelectors) {
            const element = await page.$(selector);
            if (element) {
                selectSelector = selector;
                console.log(`Found denomination dropdown with selector: ${selector}`);
                break;
            }
        }

        if (!selectSelector) {
            console.error('No denomination dropdown found with any selector');
            await bot.sendMessage(chatId, '❌ MooGold saytida paket tanlash menyusi topilmadi. Iltimos, qo‘lda tekshirib ko‘ring: https://moogold.com/product/mobile-legends/');
            return { success: false, error: 'Denomination dropdown not found' };
        }

        // Wait for dropdown options to load (with retry)
        let retries = 3;
        let optionsLoaded = false;
        while (retries > 0 && !optionsLoaded) {
            try {
                await page.waitForFunction(
                    (selector) => {
                        const select = document.querySelector(selector);
                        return select && select.options.length > 1;
                    },
                    { timeout: 40000 },
                    selectSelector
                );
                optionsLoaded = true;
            } catch (error) {
                console.warn(`Retry ${4 - retries}/3: Waiting for dropdown options failed: ${error.message}`);
                retries--;
                if (retries === 0) throw error;
                await page.waitForTimeout(2000);
            }
        }

        // Log available denominations
        const availableOptions = await page.evaluate((selector) => {
            const select = document.querySelector(selector);
            return Array.from(select.options).map(option => ({ value: option.value, text: option.textContent.trim() }));
        }, selectSelector);
        console.log('Available denominations:', JSON.stringify(availableOptions, null, 2));

        // Try multiple possible values for Weekly Pass
        const possibleValues = [moogoldValue, 'Weekly Diamond Pass', 'Weekly Pass', 'Weekly', 'Diamond Pass'];
        let optionValue = null;
        for (const value of possibleValues) {
            optionValue = await page.evaluate((val, selector) => {
                const select = document.querySelector(selector);
                for (let option of select.options) {
                    if (option.textContent.toLowerCase().includes(val.toLowerCase())) {
                        return option.value;
                    }
                }
                return null;
            }, value, selectSelector);
            if (optionValue) {
                console.log(`Found option for "${value}" with value: ${optionValue}`);
                break;
            }
        }

        if (!optionValue) {
            console.error(`Denomination "${moogoldValue}" not found in dropdown`);
            await bot.sendMessage(chatId, `❌ "${moogoldValue}" paketi MooGold saytida topilmadi. Iltimos, boshqa paket tanlang yoki qo‘lda tekshirib ko‘ring: https://moogold.com/product/mobile-legends/`, { reply_markup: createDonationKeyboard().reply_markup });
            return { success: false, error: `Denomination "${moogoldValue}" not found` };
        }

        await page.select(selectSelector, optionValue);
        console.log(`Selected denomination: ${moogoldValue}`);
        return { success: true, selector: selectSelector };
    } catch (error) {
        console.error('Error selecting diamond denomination:', error.message);
        await bot.sendMessage(chatId, `❌ Paket tanlashda xatolik: ${error.message}. Iltimos, qo‘lda tekshirib ko‘ring: https://moogold.com/product/mobile-legends/`);
        return { success: false, error: `Failed to select denomination: ${error.message}` };
    }
}

async function enterUserDetails(page, userId, serverId) {
    try {
        console.log('Attempting to enter UserID and ServerID');
        const userIdSelectors = ['input[name="user_id"]', 'input[id="user_id"]', 'input[class*="user_id"]', 'input[placeholder*="User ID"]', 'input[type="text"]:nth-of-type(1)'];
        const serverIdSelectors = ['input[name="zone_id"]', 'input[id="zone_id"]', 'input[class*="zone_id"]', 'input[placeholder*="Server ID"]', 'input[type="text"]:nth-of-type(2)'];

        let userIdSelector = null;
        let serverIdSelector = null;

        for (const selector of userIdSelectors) {
            const element = await page.$(selector);
            if (element) {
                userIdSelector = selector;
                console.log(`Found UserID input with selector: ${selector}`);
                break;
            }
        }

        for (const selector of serverIdSelectors) {
            const element = await page.$(selector);
            if (element) {
                serverIdSelector = selector;
                console.log(`Found ServerID input with selector: ${selector}`);
                break;
            }
        }

        if (!userIdSelector || !serverIdSelector) {
            console.error('UserID or ServerID input fields not found');
            return false;
        }

        await page.waitForSelector(userIdSelector, { timeout: 40000 });
        await page.waitForSelector(serverIdSelector, { timeout: 40000 });
        await page.type(userIdSelector, userId);
        await page.type(serverIdSelector, serverId);
        console.log(`Entered User ID: ${userId}, Server ID: ${serverId}`);
        return true;
    } catch (error) {
        console.error('Error entering user details:', error.message);
        return false;
    }
}

async function addToCart(page, bot, chatId) {
    try {
        const possibleButtonSelectors = [
            'button[name="add-to-cart"]',
            'button.single_add_to_cart_button',
            'button[class*="add-to-cart"]',
            'button[type="submit"][class*="cart"]',
            'button[class*="add_to_cart"]',
            'button[type="submit"]',
            'button[class*="button"]'
        ];

        let addToCartButton = null;
        for (const selector of possibleButtonSelectors) {
            const button = await page.$(selector);
            if (button) {
                addToCartButton = button;
                console.log(`Found Add to Cart button with selector: ${selector}`);
                break;
            }
        }

        if (!addToCartButton) {
            console.error('Add to Cart button not found');
            await bot.sendMessage(chatId, '❌ "Savatga qo‘shish" tugmasi topilmadi. Iltimos, qo‘lda tekshirib ko‘ring: https://moogold.com/product/mobile-legends/');
            return false;
        }

        await addToCartButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 50000 }).catch(() => console.log('Navigation after Add to Cart completed or not required'));
        console.log('Clicked Add to Cart, navigating to cart page');

        // Verify cart contents
        await page.goto('https://moogold.com/cart/', { waitUntil: 'networkidle2', timeout: 90000 });
        const cartItems = await page.evaluate(() => {
            const items = document.querySelectorAll('.cart_item .product-name, .cart-item__name, .woocommerce-cart-form__cart-item .product-name a, .cart-item-details, .product-title');
            return Array.from(items).map(item => item.textContent.trim());
        });
        console.log('Cart contents:', JSON.stringify(cartItems, null, 2));

        // Check if Weekly Pass is in the cart
        const expectedItems = ['Weekly Pass', 'Weekly Diamond Pass', 'Weekly', 'Diamond Pass'];
        const cartContainsItem = cartItems.some(item => expectedItems.some(exp => item.toLowerCase().includes(exp.toLowerCase())));
        if (!cartContainsItem) {
            console.error(`Cart does not contain expected item: ${expectedItems.join(' or ')}`);
            await bot.sendMessage(chatId, `❌ Savatda "Weekly Pass" topilmadi. Iltimos, qo‘lda tekshirib ko‘ring: https://moogold.com/cart/`);
            return false;
        }

        await bot.sendMessage(chatId, `✅ Paket savatga qo‘shildi! Iltimos, savatni tekshirib, to‘lovni qo‘lda amalga oshiring: https://moogold.com/cart/`);
        return true;
    } catch (error) {
        console.error('Error adding to cart:', error.message);
        await bot.sendMessage(chatId, `❌ Savatga qo‘shishda xatolik: ${error.message}. Iltimos, qo‘lda tekshirib ko‘ring: https://moogold.com/product/mobile-legends/`);
        return false;
    }
}

async function topUpDiamonds(bot, chatId, userIndex, packageIndex) {
    const { loadData } = require('./fileOperations');
    const { donationPackages, moogoldEmail, moogoldPassword } = require('./config');

    const data = await loadData();
    const users = data.users[chatId] || [];
    const selectedUser = users[userIndex];
    const selectedPackage = donationPackages[packageIndex];

    if (!selectedUser || !selectedPackage) {
        console.error('Invalid user or package:', { userIndex, packageIndex });
        await bot.sendMessage(chatId, "❌ Noto‘g‘ri foydalanuvchi yoki paket tanlandi.");
        return false;
    }

    console.log(`Starting top-up for UserID: ${selectedUser.userId}, Package: ${selectedPackage.name}`);

    const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications'] });
    const page = await browser.newPage();

    try {
        if (!(await loginToMooGold(page, moogoldEmail, moogoldPassword))) {
            console.error('Login failed');
            await bot.sendMessage(chatId, "❌ MooGold saytiga kirishda xatolik yuz berdi. Iltimos, login ma'lumotlarini tekshirib ko‘ring.");
            await browser.close();
            return false;
        }

        const selectionResult = await selectDiamondDenomination(page, selectedPackage.moogoldValue, bot, chatId);
        if (!selectionResult.success) {
            console.error('Denomination selection failed:', selectionResult.error);
            await browser.close();
            return false;
        }

        if (!(await enterUserDetails(page, selectedUser.userId, selectedUser.serverId))) {
            console.error('Failed to enter user details');
            await bot.sendMessage(chatId, "❌ UserID yoki ServerID kiritishda xatolik yuz berdi.");
            await browser.close();
            return false;
        }

        if (!(await addToCart(page, bot, chatId))) {
            console.error('Failed to add to cart');
            await browser.close();
            return false;
        }

        console.log('Top-up process completed successfully');
        await browser.close();
        return true;
    } catch (error) {
        console.error('Error during top-up process:', error.message);
        await bot.sendMessage(chatId, "❌ Donat jarayonida xatolik yuz berdi. Iltimos, qayta urinib ko‘ring yoki qo‘lda davom eting: https://moogold.com/product/mobile-legends/");
        await browser.close();
        return false;
    }
}

module.exports = {
    topUpDiamonds,
};