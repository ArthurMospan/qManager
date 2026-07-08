require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
const puppeteer = require('puppeteer');
const axios = require('axios');
const { fetchAllActiveUsers } = require('./services/youtrack');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('[Telegram Bot] TELEGRAM_BOT_TOKEN not provided, bot is disabled.');
  return;
}

const bot = new TelegramBot(token, { polling: true });

console.log('[Telegram Bot] Started successfully.');

// Main menu
bot.onText(/\/(start|report)/, (msg) => {
  const chatId = msg.chat.id;
  
  const welcomeText = `
👋 **Привіт, я qManager Bot!** 🤖

Ваш персональний AI-асистент для звітів YouTrack.
Я генерую красиві картки активності вашої команди, використовуючи штучний інтелект.

👇 *Оберіть період, щоб почати:*
  `;
  
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '☀️ Звіт за сьогодні', callback_data: 'period_24h' }
        ],
        [
          { text: '🗓 Звіт за цей тиждень', callback_data: 'period_week' }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, welcomeText, options);
});

// Callback queries handler
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = message.chat.id;
  
  try {
    // 1. User selected a period
    if (data.startsWith('period_')) {
      const timeframe = data.replace('period_', '');
      const timeframeName = timeframe === 'week' ? 'Цей тиждень' : 'Сьогодні';
      
      // We answer callback to remove loading state
      bot.answerCallbackQuery(callbackQuery.id);
      
      // Fetch users dynamically to build the next menu
      const users = await fetchAllActiveUsers();
      
      const keyboard = [
        [{ text: '👥 Вся команда', callback_data: `run_all_${timeframe}` }]
      ];
      
      // Group users in pairs for buttons
      for (let i = 0; i < users.length; i += 2) {
        const row = [];
        row.push({ text: `👤 ${users[i].name}`, callback_data: `run_single_${users[i].id}_${timeframe}` });
        if (i + 1 < users.length) {
          row.push({ text: `👤 ${users[i+1].name}`, callback_data: `run_single_${users[i+1].id}_${timeframe}` });
        }
        keyboard.push(row);
      }
      
      const options = {
        reply_markup: {
          inline_keyboard: keyboard
        }
      };
      
      bot.editMessageText(`Період: **${timeframeName}**\nОберіть кого показати:`, {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'Markdown',
        ...options
      });
      return;
    }
    
    // 2. User selected someone or everyone to run
    if (data.startsWith('run_')) {
      bot.answerCallbackQuery(callbackQuery.id);
      
      const parts = data.split('_'); // e.g. ["run", "all", "24h"] or ["run", "single", "2-14", "24h"]
      const isAll = parts[1] === 'all';
      const timeframe = isAll ? parts[2] : parts[3];
      const targetDevId = isAll ? null : parts[2];
      
      const waitMsg = await bot.editMessageText('🔄 Синхронізую дані з YouTrack та ШІ...\nЦе може зайняти хвилину.', {
        chat_id: chatId,
        message_id: message.message_id
      });
      
      // Trigger sync via internal API
      try {
        const PORT = process.env.PORT || 5000;
        const syncResponse = await axios.post(`http://localhost:${PORT}/api/sync?timeframe=${timeframe}`);
        
        if (!syncResponse.data.success) {
          throw new Error('Sync failed');
        }
        
        const dashboardData = syncResponse.data.data;
        
        await bot.editMessageText(`⏳ Готую скріншоти...`, {
          chat_id: chatId,
          message_id: waitMsg.message_id
        });
        
        // Setup Puppeteer
        const browser = await puppeteer.launch({
          headless: "new",
          defaultViewport: { width: 500, height: 800 },
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process'
          ]
        });
        
        let sentCount = 0;
        const mediaPhotos = [];
        let mdReport = `# qManager Звіт (${timeframe === 'week' ? 'Цей тиждень' : 'Сьогодні'})\n\n`;
        
        for (const item of dashboardData) {
          const { developer, analysis } = item;
          
          if (!isAll && developer.id !== targetDevId) {
            continue; // Skip if we only want one specific developer
          }
          
          const hasZeroTime = analysis?.time_tracked_hours === 0;
          const isInactive = (!analysis?.summary_done || analysis.summary_done.length === 0) && 
                             (!analysis?.in_progress || analysis.in_progress.length === 0) && 
                             hasZeroTime && !analysis?.blockers;
                             
          if (isInactive) continue;
          
          // Generate Markdown text for this developer
          if (isAll) {
            mdReport += `## ${developer.name} (${Number(analysis.time_tracked_hours).toFixed(1)} год)\n`;
            if (analysis.summary_done?.length > 0) {
              mdReport += `**Виконано:**\n${analysis.summary_done.map(t => `- ${t}`).join('\n')}\n`;
            }
            if (analysis.in_progress?.length > 0) {
              mdReport += `**В роботі:**\n${analysis.in_progress.map(t => `- ${t}`).join('\n')}\n`;
            }
            if (analysis.blockers) {
              mdReport += `**Блокери:** ${analysis.blockers}\n`;
            }
            mdReport += `\n`;
          }
          
          const page = await browser.newPage();
          const PORT = process.env.PORT || 5000;
          const url = `http://localhost:${PORT}/?devId=${encodeURIComponent(developer.id)}&timeframe=${timeframe}`;
          
          try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            
            // Wait for React to finish rendering the card
            await page.waitForSelector('#capture-card', { timeout: 10000 });
            
            const cardElement = await page.$('#capture-card');
            
            if (cardElement) {
              const screenshotBuffer = await cardElement.screenshot({ omitBackground: true });
              if (isAll) {
                mediaPhotos.push({
                  type: 'photo',
                  media: screenshotBuffer
                });
              } else {
                await bot.sendPhoto(chatId, screenshotBuffer, {
                  caption: `${developer.name} - Звіт`
                });
              }
              sentCount++;
            }
          } catch(e) {
            console.error(`Failed to screenshot ${developer.name}`, e);
          } finally {
            await page.close();
          }
        }
        
        await browser.close();
        
        if (sentCount === 0) {
          bot.sendMessage(chatId, '📭 Немає активності за вказаний період.');
          return;
        } 
        
        if (isAll) {
          // Send Media Group in chunks of 10 (Telegram API limit)
          for (let i = 0; i < mediaPhotos.length; i += 10) {
            const chunk = mediaPhotos.slice(i, i + 10);
            await bot.sendMediaGroup(chatId, chunk);
          }
          
          // Send MD File
          const mdBuffer = Buffer.from(mdReport, 'utf-8');
          await bot.sendDocument(chatId, mdBuffer, {
            caption: '📄 Текстовий звіт (Markdown) для використання в AI/ChatGPT'
          }, {
            filename: `qManager_Report_${timeframe}.md`,
            contentType: 'text/markdown'
          });
          
          bot.sendMessage(chatId, '✅ Звіт всієї команди успішно згенеровано!');
        } else {
          bot.sendMessage(chatId, '✅ Картка готова!');
        }
        
      } catch (err) {
        if (err.response && err.response.status === 429) {
           bot.sendMessage(chatId, `🛑 ${err.response.data.error}`);
        } else {
           console.error('Error during run_ sync:', err);
           bot.sendMessage(chatId, '❌ Сталася помилка при синхронізації або генерації звіту.');
        }
      }
    }
  } catch (error) {
    console.error('Callback query error:', error);
  }
});
