require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('[Telegram Bot] TELEGRAM_BOT_TOKEN not provided, bot is disabled.');
  return;
}

const bot = new TelegramBot(token, { polling: true });

console.log('[Telegram Bot] Started successfully (Mini App Launcher Mode).');

const authenticatedUsers = new Set();

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  // If already authenticated
  if (authenticatedUsers.has(chatId)) {
    if (text.match(/\/(start|report|dashboard)/)) {
      sendDashboard(chatId);
    }
    return;
  }

  // If entering password
  if (text === 'AIW') {
    authenticatedUsers.add(chatId);
    bot.sendMessage(chatId, '✅ Пароль прийнято! Доступ дозволено.');
    sendDashboard(chatId);
  } else {
    bot.sendMessage(chatId, '🔒 Бот захищений паролем.\nБудь ласка, введіть пароль для доступу:');
  }
});

function sendDashboard(chatId) {
  const welcomeText = `
👋 **Привіт, я qManager Bot!** 🤖

Я ваш персональний AI-асистент для звітів команди.
Натисніть кнопку нижче, щоб відкрити інтерактивний дашборд.
  `;
  
  const dashboardUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 5000}`;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 Відкрити qManager', web_app: { url: dashboardUrl } }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, welcomeText, options);
}

// Set a persistent menu button (only visible/useful really if they click it, but good to have)
bot.setChatMenuButton({
  menu_button: {
    type: 'web_app',
    text: 'Дашборд',
    web_app: { url: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 5000}` }
  }
}).catch(console.error);

// Clean up callback query handler since we don't use inline buttons anymore
bot.on('callback_query', (callbackQuery) => {
  bot.answerCallbackQuery(callbackQuery.id);
});
