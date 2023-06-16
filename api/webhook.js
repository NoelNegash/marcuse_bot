const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

async function listMembers(db, bot, chatId) {
  var members = await db.collection('members').get();
  var message = ''

  members.forEach((m) => {
    m = m.data()

    message += `${m.name} ${m.isAdmin ? ' [ADMIN]' : ''} | ${m.borrowed_books.length} books currently borrowed.`;
  })
  await bot.sendMessage(chatId, message, {parse_mode: 'html'});
}
async function addMember() {}
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
    admin.initializeApp({
      credential: admin.credential.cert(firebaseAccount)
    });

    const db = admin.firestore();
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

    const { body } = request;

    if (body.message) {
      const { chat: { id }, text } = body.message;

      if (text == "/list-members") {
        await listMembers(db, bot, id)
      }
    }
  }
  catch(error) {
    console.error('Error sending message');
    console.log(error.toString());
  }
  response.send('OK');
};