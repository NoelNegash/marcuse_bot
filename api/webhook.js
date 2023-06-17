const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

async function listMembers(db, bot, chatId) {
  var members = await db.collection('members').get();
  var message = ''

  members.forEach((m) => {
    m = m.data()

    message += `${m.name} ${m.isAdmin ? ' [ADMIN]' : ''} | ${m.borrowed_books.length} books currently borrowed.\n`;
  })
  await bot.sendMessage(chatId, message, {parse_mode: 'html'});
}
async function registerMember(db, bot, chatId, message, telegramId) {
  var name = message.split('/register')[1]
  var canRegister = (await db.collection('members').where('telegram_id', '==', telegramId).get()).empty;
  if (!canRegister) {
    await bot.sendMessage(chatId, "Already registered.", {parse_mode: 'html'});
    return;
  }
  if (name == undefined || name == '') {
    await bot.sendMessage(chatId, "Add a name.", {parse_mode: 'html'});
    return;
  }
  

  var member = {
    admin: false,
    borrowed_books: [],
    name: name,
    telegram_id: telegramId,
    total_borrowed: 0
  }

  // todo save member
  await db.collection('members').add(member)
  await bot.sendMessage(chatId, `New member \n. ${JSON.stringify(member)}`, {parse_mode: 'html'});
}
async function editMember() {}
async function memberInfo() {}
async function listBooks() {}
async function addBook() {}
async function removeBook() {}
async function searchBook() {}
async function borrowBook() {}
async function reserveBook() {}
async function returnBook() {}
async function overdueBooks() {}
async function statistics() {}


module.exports = async (request, response) => {
  try {
    const firebaseAccount = JSON.parse(process.env.FIREBASE_KEY);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseAccount)
      });
    }

    const db = admin.firestore();
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

    const { body } = request;

    if (body.message) {
      const { chat: { id }, text } = body.message;

      if (text == "/list-members") {
        await listMembers(db, bot, id)
      } else if (text.startsWith("/list-members")) {
        await addMember(db, bot, id, text)
      } else if (text.startsWith("/register")) {
        await registerMember(db, bot, id, text, body.message.from.id)
      }
    }
  }
  catch(error) {
    console.error('Error sending message');
    console.log(error.toString());
  }
  response.send('OK');
};