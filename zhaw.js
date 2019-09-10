const fetch = require('node-fetch')
const cheerio = require('cheerio')
const cheerioTableparser = require('cheerio-tableparser')

const config = require('./config.json')

let timeTableCache = new Map()

exports.getTimetable = async function (username, week) {
  let currWeek = getWeek()
  if (currWeek === 25 || currWeek === 26) { // Prüfungswochen FS
    week = week - 25
  } else if (currWeek === 3 || currWeek === 4) { // Prüfungswochen HS
    week = week - 3
  } else if (currWeek >= 8 && currWeek <= 21) { // Frühlingssemester
    week = week - 8
  } else if (currWeek >= 38 && currWeek <= 51) { // Herbstsemester
    week = week - 38
  } else if (currWeek === 27) { // BA Präsentationen
    week = week - 27
  } else {
    console.log(username, week, '! No specific timeframe, defaulting to 0')
    week = 0
  }

  let cacheKey = `${username}-${week}`
  let cachedTimeTable = timeTableCache.get(cacheKey)
  if (cachedTimeTable !== undefined) {
    console.log('Loaded from cache', `${username}-${week}`)
    return cachedTimeTable
  }

  let res = await fetch('https://stundenplan.zhaw.ch/', {
    method: 'POST',
    body: `ctl00$SelectionContent$txtSearch=${username}&ctl00$SelectionContent$selWeek=${week}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    }
  })
  let text = await res.text()

  const $ = cheerio.load(text)
  let tableContents = $('table.schedTable').html()
  let t = cheerio.load(`<table>${tableContents}</table>`)

  cheerioTableparser(t)
  let data = t('table').parsetable(true, true, true)
  let headers = data.shift()

  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      let value = data[i][j].replace(/ [0-9]{3}|[A-Z][0-9]\.[0-9]{2}/, '$&\n').trim()
        .replace(/[A-Z]{2} [0-9]{3}|[A-Z]{2} [A-Z][0-9]\.[0-9]{2}/g, ' $&')
        .replace(/(\.P|\.V)(?!.*(\.P|\.V))/g, '$& ').split('\n')
      data[i][j] = {
        'time': headers[j].replace('Zeit', 'day'),
        'value': value
      }
    }
  }

  timeTableCache.set(cacheKey, data)

  setTimeout(() => { // Invalidate cache
    console.log(`Cache ${cacheKey} invalidated`)
    timeTableCache.delete(cacheKey)
  }, config.cacheTimeHours * 3600000)

  return data
}


exports.getDay = async function (username, day) {
  if (day === 0) { // Sunday won't ever have entries
    return []
  }
  let week = getWeek()
  let res = await this.getTimetable(username, week)
  let setDay = res[day - 1]
  if (setDay === undefined) {
    return null
  }

  if (setDay[0].time === 'day') {
    setDay.shift() // get rid of first row if its there
  }
  return setDay
}


function getWeek() {
  // Function grabbed from https://github.com/you-dont-need/You-Dont-Need-Momentjs#week-of-year
  // Licensed MIT
  const day = new Date()
  const MILLISECONDS_IN_WEEK = 604800000
  const firstDayOfWeek = 1 // monday as the first day (0 = sunday)
  const startOfYear = new Date(day.getFullYear(), 0, 1)
  startOfYear.setDate(
    startOfYear.getDate() + (firstDayOfWeek - (startOfYear.getDay() % 7))
  )
  const dayWeek = Math.round((day - startOfYear) / MILLISECONDS_IN_WEEK) + 1
  return dayWeek
}
