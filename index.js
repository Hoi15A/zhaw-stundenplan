const config = require('./config.json')
const zhaw = require('./zhaw.js')

const Telegraf = require('telegraf')
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
const bot = new Telegraf(config.token)

bot.telegram.getMe().then(botInfo => {
  bot.options.username = botInfo.username
})

bot.command('start', ctx => {
  ctx.replyWithMarkdown('Fetch your timetable with:\n\n`/today <username>`\n`/yesterday <username>`\n`/tomorrow <username>`')
})

bot.command('chatid', ctx => {
  ctx.replyWithMarkdown(`ID: \`${ctx.chat.id}\``)
})

bot.command('today', async ctx => {
  ctx.message.text = ctx.message.text.replace(/\/today(\S+)?/, '').trim()
  sendDay(ctx, 0, '')
})
bot.command('tomorrow', async ctx => {
  ctx.message.text = ctx.message.text.replace(/\/tomorrow(\S+)?/, '').trim()
  sendDay(ctx, 1, '')
})
bot.command('yesterday', async ctx => {
  ctx.message.text = ctx.message.text.replace(/\/yesterday(\S+)?/, '').trim()
  sendDay(ctx, -1, '')
})

bot.action(/cd-.+/, ctx => {
  let match = ctx.match[0]
  match = match.replace(/cd-/, '').split('-')
  switch (match[0]) {
    case 'yesterday':
      sendDay(ctx, -1, match[1])
      break
    case 'today':
      sendDay(ctx, 0, match[1])
      break
    case 'tomorrow':
      sendDay(ctx, 1, match[1])
      break
  }
})

async function sendDay(ctx, offset, edit) {
  let today = new Date().getDay() + offset
  if (today === -1) {
    today = 6 // wrap around to saturday properly
  }
  let args = ''
  let username
  if (edit === '') {
    username = config.users[ctx.update.message.from.id]
    args = ctx.message.text
  } else {
    args = edit
  }

  if (args) {
    username = args
  } else if (!username) {
    ctx.reply('Sorry I dont know your ZHAW username.\nUse `/today <username>` instead!')
    return
  }

  let res = await zhaw.getDay(username, today)
  if (res === null) {
    return ctx.replyWithMarkdown(`Unknown student: \`${username}\``)
  }
  if (res.length === 0) {
    return ctx.reply('No known lessons for today!')
  }

  let d = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  let buttons = []
  let response = ''
  switch (offset) {
    case 1:
      response = `*Tomorrows timetable for *\`${username}\`*:*\n\n_${d[today]}_\n`
      buttons.push(Markup.callbackButton('Yesterday', `cd-yesterday-${username}`))
      buttons.push(Markup.callbackButton('Today', `cd-today-${username}`))
      break
    case -1:
      response = `*Yesterdays timetable for *\`${username}\`*:*\n\n_${d[today]}_\n`
      buttons.push(Markup.callbackButton('Today', `cd-today-${username}`))
      buttons.push(Markup.callbackButton('Tomorrow', `cd-tomorrow-${username}`))
      break
    default:
      response = `*Todays timetable for *\`${username}\`*:*\n\n_${d[today]}_\n`
      buttons.push(Markup.callbackButton('Yesterday', `cd-yesterday-${username}`))
      buttons.push(Markup.callbackButton('Tomorrow', `cd-tomorrow-${username}`))
  }

  for (let i = 0; i < res.length; i++) {
    let lessons = res[i].value.join('\n')

    if (lessons !== '') {
      response += `\`${res[i].time}\`:\n${lessons}\n`
    }
  }

  let keyboard = Markup.inlineKeyboard(buttons)
  if (edit) {
    ctx.editMessageText(response, Extra.markdown().markup(keyboard))

  } else {
    ctx.replyWithMarkdown(response, keyboard.extra())
  }
}

bot.launch().then(() => {
  console.log('Bot Launched')
})
