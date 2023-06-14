const TelegramBot = require('telegram-bot-api');

const token = '6215926940:AAG7TzCKSKILW4plinFBzf5Sy-I2BhXzPa0';
const bot = new TelegramBot(token);


bot.on('message', (msg) => {
    console.log(msg);
});

bot.setWebhook({
url: 'https://marcuse-bot.vercel.app/'
});