const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

function prettifyBook(book, verbose = false) {
  return `"${book.title}" by ${book.author}    ISBN: ${book.isbn}` + 
    verbose ? ` ${book.borrowed==""?"":"[Checked Out]"} ${book.reserved==""?"":"[Reserved]"} ${book.special?"[Special]":""}` : '';
}

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
  var name = message.split('/register ', 2)[1]
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
  await bot.sendMessage(chatId, "You are now registered", {parse_mode: 'html'});
}
async function editMember() {}
async function memberInfo(db, bot, chatId, message) {
  var member = await db.collection('members').where('name', '==', message.split('/member ', 2)[1] || '').get();
  if (member.empty) {
    await bot.sendMessage(chatId, "Member doesn't exist.", {parse_mode: 'html'});
    return;
  }
  member = member.docs[0].data()
  var returnMessage = `${member.name}, ${member.borrowed_books.length} book${member.borrowed_books.length == 1 ? "" : "s"} borrowed.\n`

  if (member.borrowed_books.length) {
    var books = (await db.collection('books').where(admin.firestore.FieldPath.documentId(), 'in', member.borrowed_books).get());
    books.forEach(book => {
      book = book.data()
      returnMessage += `\t${prettifyBook(book)}  Due: ${book.due_date.toDate().toLocaleString()}\n`
    })
  }
  await bot.sendMessage(chatId, returnMessage, {parse_mode: 'html'});
}
async function listBooks(db, bot, chatId, message) {
  var books = await db.collection('books').get();
  var message = ''

  books.forEach((b) => {
    b = b.data()

    message += `${prettifyBook(b, true)}`;
  })
  await bot.sendMessage(chatId, message, {parse_mode: 'html'});
}
async function addBook(db, bot, chatId, message) {}
async function removeBook(db, bot, chatId, message) {}
async function searchBook(db, bot, chatId, message) {}
async function borrowBook(db, bot, chatId, message) {}
async function reserveBook(db, bot, chatId, message) {}
async function returnBook(db, bot, chatId, message) {}
async function overdueBooks(db, bot, chatId, message) {}
async function statistics(db, bot, chatId, message) {}


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
      } else if (text.startsWith("/member")) {
        await memberInfo(db, bot, id, text)
      } else if (text.startsWith("/list-book")) {
        await listBooks(db, bot, id, text)
      } else if (text.startsWith("/add-book")) {
        await addBook(db, bot, id, text)
      } else if (text.startsWith("/remove-book")) {
        await removeBook(db, bot, id, text)
      } else if (text.startsWith("/search-book")) {
        await searchBook(db, bot, id, text)
      } else if (text.startsWith("/borrow-book")) {
        await borrowBook(db, bot, id, text)
      } else if (text.startsWith("/reserve-book")) {
        await reserveBook(db, bot, id, text)
      } else if (text.startsWith("/return-book")) {
        await returnBook(db, bot, id, text)
      } else if (text.startsWith("/overdue-books")) {
        await overdueBooks(db, bot, id, text)
      } else if (text.startsWith("/statistics")) {
        await statistics(db, bot, id, text)
      }
    }
  }
  catch(error) {
    console.error('Error sending message');
    console.log(error.toString());
  }
  response.send('OK');
};