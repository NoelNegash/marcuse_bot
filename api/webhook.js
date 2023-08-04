const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

const SERVER_URL = "http://marcuse-bot.vercel.app/"

function prettifyBook(book, verbose = false) {
  var res = `${book.title} - ${book.author}    ISBN: [${book.isbn}]` 
  if (verbose) res += `${book.borrowed?"[Checked Out]":""} ${book.reserved?"[Reserved]":""} ${book.special?"[Special]":""}`;
  return res
}
function quoteSplit(s) {
  return s.match(/\\?.|^$/g).reduce((p, c) => {
      if(c === '"'){
          p.quote ^= 1;
      }else if(!p.quote && c === ' '){
          p.a.push('');
      }else{
          p.a[p.a.length-1] += c.replace(/\\(.)/,"$1");
      }
      return  p;
  }, {a: ['']}).a
}
function stringContainsAny(str, arr) {
  for (var i = 0; i < arr.length; i++) {
    if (str.includes(arr[i])) return true
  }
  return false
}

async function listMembers(db, bot, chatId) {
  var members = await db.collection('members').get();
  var returnMessage = ''

  members.forEach((m) => {
    m = m.data()

    returnMessage += `${m.name} ${m.isAdmin ? ' [ADMIN]' : ''} | ${m.borrowed_books.length} books currently borrowed.\n`;
  })
  if (returnMessage == '') returnMessage = "No members yet."
  await bot.sendMessage(chatId, returnMessage, {parse_mode: 'html'});
}
async function registerMember(db, bot, chatId, message, telegramId) {
  var name = message
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
  var member = await db.collection('members').where('name', '==', message).get();
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
async function listBooks(db, bot, chatId) {
  var books = await db.collection('books').get();
  var returnMessage = ''

  books.forEach((b) => {
    b = b.data()

    returnMessage += `${prettifyBook(b, true)}\n`;
  })

  if (returnMessage == '') returnMessage = "No books yet."
  await bot.sendMessage(chatId, returnMessage, {parse_mode: 'html'});
}
async function addBook(db, bot, chatId, message, telegramId, fileId) {
  var split = quoteSplit(message)
  var title = split[0], author = split[1], isbn = split[2], special = split[3]
  var canRegister = (await db.collection('members').where('telegram_id', '==', telegramId).get()).empty;
  if (!fileId) {
    await bot.sendMessage(chatId, "Add an image.", {parse_mode: 'html'});
    return;
  }
  if (canRegister) {
    await bot.sendMessage(chatId, "You are not a registered member.", {parse_mode: 'html'});
    return;
  }
  if (title == undefined || title == '') {
    await bot.sendMessage(chatId, "Add a name.", {parse_mode: 'html'});
    return;
  }
  if (author == undefined || author == '') {
    await bot.sendMessage(chatId, "Add an author.", {parse_mode: 'html'});
    return;
  }
  if (isbn == undefined || isbn == '') {
    await bot.sendMessage(chatId, "Add an isbn.", {parse_mode: 'html'});
    return;
  }
  

  var book = {
    "title": title,
    "author":author,
    "isbn": isbn,
    "photo": fileId,
    total_borrowed: 0,
    borrowed: null,
    borrowed_date: null,
    due_date: null,
    reserved: null,
    "special": special != undefined
  }
  await db.collection('books').add(book)
  await bot.sendMessage(chatId, "Book registered", {parse_mode: 'html'});
}
async function removeBook(db, bot, chatId, message) {
  
}
async function searchBook(db, bot, chatId, message) {
  var searchTerms = message.toLowerCase().split(' ').filter(x => x != '')
  var books = await db.collection('books').get();

  var returnKeyboard = [];

  books.forEach((b) => {
    b = b.data()

    if (stringContainsAny(b.title.toLowerCase(), searchTerms) ||
        stringContainsAny(b.author.toLowerCase(), searchTerms) ||
        stringContainsAny(b.isbn.toLowerCase(), searchTerms)) {
      returnKeyboard.push([
        {
          text: prettifyBook(b, true),
          callback_data: "book-details "+b.isbn
        }
      ])
    }
  })

  var returnMessage = `Searched "${message.split('/search-book ', 2)[1] || ''}".\n ${returnKeyboard.length == 0 ? "No" : returnKeyboard.length} book"${returnKeyboard.length == 1 ? "" : "s"} found.`
  await bot.sendMessage(chatId, returnMessage, {reply_markup: {inline_keyboard: returnKeyboard}, parse_mode: 'html'});
}
async function borrowBook(db, bot, chatId, message, telegramId) {
  var returnMessage = ''
  var alreadyBorrowed = false

  var isbn = message
  var books = await db.collection('books').where("isbn", '==', isbn).get();

  for (var i = 0; i < books.docs.length; i++) {
    var b = books.docs[i]
    var bookId = b.id
    var bookRef = db.collection('books').doc(b.id);
    b = b.data()

    var members = await db.collection('members').where("telegram_id", '==', telegramId).get();
    for (var j = 0; j < members.docs.length; j++) {
      var m = members.docs[j]
      var data = m.data();
      if (data.borrowed_books.includes(bookId)) {
        alreadyBorrowed = true;
        break;
      }
      await db.collection('members').doc(m.id).update(
        {
          total_borrowed: m.data().total_borrowed + 1,
          borrowed_books: m.data().borrowed_books.concat(bookId)
        }
      )
    }   
    if (alreadyBorrowed) break;
    
    var dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    var updates = {
      borrowed: telegramId,
      total_borrowed: b.total_borrowed + 1,
      borrowed_date: new Date(),
      due_date: dueDate
    };
    await bookRef.update(updates)

    returnMessage += `Borrowed ${prettifyBook(b, true)}\n`;
  }

  if (alreadyBorrowed) returnMessage = "Book already borrowed."
  else if (returnMessage == '') returnMessage = "No books borrowed."
  await bot.sendMessage(chatId, returnMessage, {parse_mode: 'html'});
}
async function reserveBook(db, bot, chatId, message) {}
async function returnBook(db, bot, chatId, message, telegramId) {
  var isbn = message
  var books = await db.collection('books').where("isbn", '==', isbn).get();
  var members = await db.collection('members').where("telegram_id", '==', telegramId).get();

  var bookReturned = false

  for (var i = 0; i < books.docs.length; i++) {
    var b = books.docs[i]
    var bookId = b.id
    var bookRef = db.collection('books').doc(b.id);
    b = b.data()

    for (var j = 0; j < members.docs.length; j++) {
      var m = members.docs[j]
      var data = m.data();

      if (data.borrowed_books.includes(bookId)) {
        await db.collection('members').doc(m.id).update({
          borrowed_books: m.data().borrowed_books.filter(x => x != bookId)
        })

        var updates = {
          borrowed: null,
          due_date: null,
          borrowed_date: null
        };
        await bookRef.update(updates)
        await bot.sendMessage(chatId, "Book returned.", {parse_mode: 'html'});
        bookReturned = true
      }
    }
  }

  if (!bookReturned) await bot.sendMessage(chatId, "Book is not borrowed.", {parse_mode: 'html'});
}
async function overdueBooks(db, bot, chatId, message) {
  var books = await db.collection('books').get();
  var returnMessage = ''

  books.forEach((b) => {
    b = b.data()

    if (b.due_date != null && b.due_date < new Date().getTime())
      returnMessage += `${prettifyBook(b, true)}\n`;
  })

  if (returnMessage == '') returnMessage = "No overdue books."
  await bot.sendMessage(chatId, returnMessage, {parse_mode: 'html'});
}
async function statistics(db, bot, chatId, message) {}


async function callbackBookDetails(db, bot, chatId, data) {

  var isbn = data;

  var books = await db.collection('books').where("isbn", "==", isbn).get();
  var b = books.docs[0].data();

  var returnMessage = prettifyBook(b, true)
  var returnKeyboard = [
    [
      {text: "Borrow", callback_data: "borrow-book "+b.isbn},
      {text: "Reserve", callback_data: "reserve-book "+b.isbn}
    ]
  ];

  
  await bot.sendPhoto(chatId, b.photo || (SERVER_URL + "assets/covers/default.png"), {
    caption: prettifyBook(b),
    reply_markup: {inline_keyboard: returnKeyboard}, 
    parse_mode: 'html'
  });
}


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

    // check if the update contains a callback query
    if (body.callback_query) {
      const callbackData = body.callback_query.data;
      const message = body.callback_query.message;

      var callbackFunctions = {
        "book-details": callbackBookDetails,
        "borrow-book": (db, bot, chatId, text) => borrowBook(db, bot, chatId, text, message.from.id)
      }

      var func = callbackFunctions[callbackData.split(' ')[0]]
      if (func) await func(db, bot, message.chat.id, callbackData.split(' ', 2)[1], message)

      bot.answerCallbackQuery(body.callback_query.id);
    } else if (body.photo && body.photo.length > 0) {

      
        await bot.sendMessage(body.message.chat.id, JSON.stringify(body.photo), {parse_mode: 'html'});
        const fileId = body.photo[0].file_id;
        const caption = body.caption;

        var commands = {
          "/add-book": addBook,
        }

        var func = commands[caption.split(' ')[0]]
        if (func) await func (db, bot, body.message.chat.id, caption.split(' ',2)[1] || '', body.message.from.id, fileId)

     } else if (body.message) {
      const { chat: { id }, text } = body.message;

      var commands = {
        "/list-members": listMembers,
        "/register": registerMember,
        "/member": memberInfo,
        "/add-book": addBook,
        "/list-books": listBooks,
        "/remove-book": removeBook,
        "/search-book": searchBook, 
        "/borrow-book": borrowBook,
        "/reserve-book": reserveBook,
        "/return-book": returnBook,
        "/overdue-books": overdueBooks,
        "/statistics":statistics
      }

      var func = commands[text.split(' ')[0]]
      if (func) await func (db, bot, id, text.split(' ',2)[1] || '', body.message.from.id)
    }
  }
  catch(error) {
    console.error('Error sending message');
    console.log(error.toString());
  }
  response.send('OK');
};