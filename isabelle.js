/*
  TODO:
  Move Isabelle to a linux box, set up putty and github for remote upkeep
  ;character (gives a character role)
  Refactor ;set to check if a belt change happened, and assign roles if they did
  add a weekly decay feature (add a 'active' field to players table, when a match is put in set active to 1,
    when rivals is called anyone that's 0 gets decayed, then set everyone to 0)
  Refactor database, add a dID field to players table, tweak commands to use that to find people without suffix
  ;name change your tag in the database (checks dID)
  Refactor ;rival in/out to use dID and no name suffix

  far future:
  add small games
  make new table with discord ids and a currency from the games
*/

// requires/resources
const Discord = require('discord.js')
const fs = require('fs')
const mysql = require('mysql')
var config = JSON.parse(fs.readFileSync('data/config.json'))
var token = process.env.token
try {
  token = fs.readFileSync('token.txt')
}
catch(e){

}
var reportStream = fs.createWriteStream("data/reports.txt", {flags:'a'})
var logStream = fs.createWriteStream("data/log.txt", {flags:'a'})
var con = mysql.createConnection(config.db)

// bot config
const bot = new Discord.Client()
const TOKEN = token
var prefix = config.prefix
var K = config.K
bot.login(TOKEN)

// bot event handlers
bot.on('ready', () => {
  console.log('Bot is now connected.')  
  config.lastStart = Date.now()
  console.log(`Time Start: ${config.lastStart}`)
  bot.user.setActivity('Super Smash Bros. Ultimate')
  bot.channels.find(x => x.name === 'bot-maintanence').send('Hi Mayor! This is Isabelle, reporting for duty!')
  setInterval(() => { // update loop  
    console.log('interval loop start')  
    let currentTime = Date.now()
    if ((currentTime - config.rivalUpdate) > 604800000) {  
      console.log('if rival')    
      config.rivalUpdate = Date.now()
      updateRivals()
      if ((currentTime - config.rankUpdate) > 86400000) {
        setTimeout(() => { // so we don't post too soon after updateRivals          
          config.rankUpdate = Date.now()
          updateRanks()  
        }, 2000)
      }
    }
    else if ((currentTime - config.rankUpdate) > 86400000) {     
      console.log('if ranks') 
      config.rankUpdate = Date.now()
      updateRanks()  
    }
    else {
      con.pause()
      // con.query('SELECT * FROM players', function(err, result) {
      //   if(err) console.error('Routine check: Something broke in the mysql!')
      //   else if (!result[0]) console.error('Routine check: Couldn\'t find any players!')
      //   //else do nothing
      // })
    }
    console.log('interval loop exit')
    //fs.writeFileSync('data/config.json',JSON.stringify(config))
  }, 55000)
})
bot.on('disconnected', () => {
  console.log('Diconnected!')
  process.exit(1) // exit with error
})
bot.on('message', (msg) => {
  parseMessage(msg)
})

// commands
const commands = {
  "die": {
    usage: `${prefix}die`,
    description: 'kills the bot and ends the process (bot owner only!)',
    admin:true,
    process: function(msg, suffix) {
      if (msg.author.id == 142893548134596608) {
        msg.channel.send('Goodbye Mayor!')
        console.log('Terminating bot.')   
        bot.destroy()
        config.lastEnd = Date.now()
        console.log(`Time End: ${config.lastEnd}`)
        let uptime = Math.floor((config.lastEnd - config.lastStart)/3600000) + ':' + 
                    Math.floor(((config.lastEnd - config.lastStart)/60000)%60) + ':' +
                    Math.floor(((config.lastEnd - config.lastStart)/1000)%60) + '.' +
                    Math.floor((config.lastEnd - config.lastStart)%1000)
        console.log(`Uptime: ${uptime}`)
        //fs.writeFileSync('data/config.json',JSON.stringify(config))
        setTimeout(() => {
         process.exit(0)
        }, 200)
      }
      else {
        let rand = Math.floor(Math.random()*3)
        switch(rand) {
          case 0:
            msg.channel.send(`Sorry, I'll only give my life for the Mayor!`)
            break;
          case 1:
            msg.channel.send('Don\'t hurt the puppy!')
            break;
          case 2:
            msg.channel.send('W-why would you do this??')
            break;
        }
      }
    }// process
  },//die
  "rating": {
    usage: `${prefix}rating name`,
    description: 'prints the current ELO rating of the named player\n'+
                  'if no name is given, prints your own rating (if your name matches your tag in the database)',
    admin:false,
    process: function(msg, suffix) {
      con.resume()
      let name = msg.member.nickname
      if (suffix) name = suffix
      con.query(`SELECT * FROM players WHERE tag = ${mysql.escape(name)}`, function(err, result) {
        if (err) console.error(err)
        else if (!result[0]) {
          console.error(`Query failed! ${(msg.member.nickname)?msg.member.nickname:msg.author.username} queried for the rank of ${name}, no results found.`)
          msg.channel.send('Oops! I couldn\'t find anyone with that name on the rankings!')
        }
        else {
          let player = result[0]
          let embed = new Discord.RichEmbed()
            .setColor(beltColor(player.elo))
            .setTitle(`Rating Report`)
            .setDescription(`Tag: ${name}\nRating: ${player.elo}${(player.placement > 0)?'\nPlacements: ' + player.placement:''}`)
          msg.channel.send(embed)
        }
      })
    }// process
  },//rating
  "set": {
    usage: `${prefix}set winner loser wins losses [optional] rt`,
    description: 'inputs the results of a set into the database, with an optional r or t to flag it as a rival/tournament match.\n' +
                  'For names with 1 space, add a * in front of the name. (*Player 9). More than 1 space won\'t work, talk to the player about changing things' +
                  `eg. ${prefix}set Bob John 3 2 r (Bob won 3-2 vs John, and it was a rivals match).\n 'r' 't' or 'rt' are valid tags (no spaces in rt)`,
    admin:true,
    process: function(msg, suffix) {
      inputSet(msg,suffix)
    }// process
  },//set
  "history": {
    usage: `${prefix}history name`,
    description: 'prints out the match history of the named player (wins-losses against each person they\'ve fought)\n'+
                  'if no name is given, prints the history for yourself (if your name matches your tag in the database)',
    admin:false,
    process: function(msg, suffix) {
      let name = (suffix)?suffix:(msg.member.nickname)?msg.member.nickname:msg.author.username
      matchHistory(msg,name)
    }// process
  },//history
  "report": {
    usage: `${prefix}report text`,
    description: 'Isabelle will take down a note from you to give to the Mayor later. \n'+
                  '(logs it to the bot\'s files, deletes your message shortly afterwards to keep your reports confidential)',
    admin:false,
    process: function(msg, suffix) {
      console.log(`Name: ${msg.member.nickname}`)
      console.log(`Message: ${suffix}`)
      let time = new Date()
      let rep = `[${time.toString()}]\n${(msg.member.nickname)?msg.member.nickname:msg.author.username}: ${suffix}\n\n`
      //reportStream.write(rep)
      if (msg.member.roles.has('369948375530995712')) console.log('Consul')
      if (msg.member.roles.has('494878132143128616')) console.log('Senator')
      msg.delete(3000)
      msg.channel.send('Thanks! I\'ll write this down right away!')
    }// process
  },//report
  "update": {
    usage: `${prefix}update [optional]ranks/rivals`,
    description: `Pulls the current data from the database to update the given list\nif no list is given, updates all lists`,
    admin:true,
    process: function(msg, suffix) {
      if (msg.member.roles.has('369948375530995712')) { // consul
        if (suffix && suffix != '') {
          switch(suffix.toLowerCase()) {
            case 'ranks':
              updateRanks()
              break;
            case 'rivals':
              updateRivals()
              break;
            default:
              msg.channel.send('Oops! I didn\'t understand which list you wanted me to update!')
          }
        }
        else {
          updateRivals()
          setTimeout(() => { // so we don't post too soon after updateRivals
            updateRanks()
          }, 2000)          
        }
      }
      else {
        msg.channel.send('Sorry! Only *admins* can update the lists!')
      }
    }
  },//update
  "rank": {
    usage: `${prefix}rank name`,
    description: 'Prints out the given player\'s current place in the ranked list (eg. 1st place, 10th place, ect)\n' + 
                  'if no name is given, prints the rank for yourself (if your name matches your tag in the database)',
    admin: false,
    process: function(msg, suffix) {
      if (!suffix) {
        suffix = (msg.member.nickname)?msg.member.nickname:msg.author.username
      }
      con.resume()
      con.query(`SELECT tag FROM players ORDER BY elo desc`, function(err, result) {
        let i = 0
        while (result[i] && result[i].tag != suffix) {
          i++
        }
        i++
        msg.channel.send(`You're #${i} in the rankings!`)
      })
    }// process
  },//rank
  "rival": {
    usage: `${prefix}rival name [optional]in or out`,
    description: 'If options are blank, tells you who your rival(s) are for the week. If no name is given it uses your name (Your name must match your tag in the database)\n'+
                  'If the word in is included, opts you into the rivals system for future weeks\n'+
                  'If the word out is included, opts you out of the rivals system for future weeks\n' +
                  'Note: if your name has spaces in it and you use the in/out option, writing your name in the command will break it! Set your server nickname to your tag name instead!',
    admin: false,
    process: function(msg, suffix) {
      if (!suffix || ((suffix != 'in' && suffix != 'out') && (suffix.split(" ")[1] != 'in' && suffix.split(" ")[1] != 'out'))) {
        let rivalstr = ''
        if (suffix.split(' ').length > 2) {
          rivalstr += '`Your command looks longer than expected, did you add a name with spaces?\n'+
                        'That will work on the base command but will not work with the in/out option. Try setting your server nickname to your tag name instead!`\n'
        }
        // find rivals
        let name = (!suffix)?((msg.member.nickname)?msg.member.nickname:msg.author.username):suffix
        let rivals = JSON.parse(fs.readFileSync('data/rivals.json'))
        let enemies = []
        if (rivals[0]) {
          for (let i=0; i<rivals[0].length; i++) {
            if (rivals[0][i] == name) {
              if (i%2 == 1) {
                enemies[0] = rivals[0][i-1]
              }
              else {
                enemies[0] = rivals[0][i+1]
              }
              i = rivals[0].length
            }
          }
        }
        if (rivals[1]) {
          for (let i=0; i<rivals[1].length; i++) {
            if (rivals[1][i] == name) {
              if (i%2 == 1) {
                enemies[1] = rivals[1][i-1]
              }
              else {
                enemies[1] = rivals[1][i+1]
              }
              i = rivals[1].length
            }
          }
        }

        // report rivals
        if (!enemies[0] && !enemies[1]) {
          rivalstr += 'Sorry, I couldn\'t find any rivals for ' + name + '!'
          msg.channel.send(rivalstr)
        }
        else {
          rivalstr = `${name}'s rival for this week is ${enemies[0]}`
          if (enemies[1]) {
            rivalstr += `\n${name}'s rival from last week is ${enemies[1]}`
          }
          msg.channel.send(rivalstr)
        }
      }// if not in/out
      else {// if in/out
        con.resume()
        let name = (!suffix.split(" ")[1])?((msg.member.nickname)?msg.member.nickname:msg.author.username):suffix.split(" ")[0]
        name = mysql.escape(name)
        if (suffix == 'in' || suffix.split(" ")[1] == 'in') {
          con.query(`UPDATE players SET rival=1 WHERE tag=${name}`, function(err, result) {
            if (err) {
              console.error(err)
              msg.channel.send('Oops! Something broke when trying to opt you into the rivals system.')
            }
            else {
              msg.channel.send('Ok '+ name + ', I\'ve added you to the rivals system!')
            }
          })
        }// in
        else {//out
          con.query(`UPDATE players SET rival=0 WHERE tag=${name}`, function(err, result) {
            if (err) {
              console.error(err)
              msg.channel.send('Oops! Something broke when trying to opt you out of the rivals system.')
            }
            else {
              msg.channel.send('Ok '+ name + ', I\'ve taken you out of the rivals system!')
            }
          })
        }// out
      }// in/out
    }// process
  },//rival
  "join": {
    usage: `${prefix}join name tag`,
    description: 'Adds a player into the database with the given name and tag, names with spaces are ok here.',
    admin: true,
    process: function(msg, suffix) {
      con.resume()
      let name = suffix.split(" ")[0]      
      suffix = suffix.split(" ")
      suffix.shift()
      suffix = suffix.join("")
      let tag = suffix
      name = mysql.escape(name)
      tag = mysql.escape(tag)
      con.query(`INSERT INTO players (id, name, tag) VALUES (0, ${name}, ${tag})`, function(err, result) {
        if (err) {
          console.error(err)
          msg.channel.send(`Oops! Something broke when adding ${tag} to the database!`)
        }
        else {
          let logstr = `${(msg.member.nickname)?msg.member.nickname:msg.author.username} added ${tag} to the database.`
          console.log(logstr)
          let time = new Date()
          //logStream.write(`[${time.toString()}]\n${logstr}\n\n`)
          msg.channel.send(`Ok, I've added ${tag} to the database! Welcome to the ranking system ${tag}!`)
        }
      })// con query
    }// process
  },//join
  "prefix": {
    admin:true,
    process: function(msg, suffix) {
      //fs.writeFileSync('data/prefix.txt', suffix)
      let newP = fs.readFileSync('data/prefix.txt')
      msg.channel.send(newP)
    }
  }
}

// functions
function parseMessage(msg) {
  if (msg.author.id != bot.user.id && msg.content.startsWith(prefix)) {
    let cmdTxt = msg.content.split(" ")[0].substring(prefix.length)
    let suffix = msg.content.substring(cmdTxt.length+prefix.length+1)
    let cmd = commands[cmdTxt.toLowerCase()]
    if (cmdTxt == 'help') {
      if (suffix) {
        let cmdH = suffix.split(" ")[0]
        if (commands[cmdH.toLowerCase()]) {
          let embed = new Discord.RichEmbed()
          .setColor('#cecece')
          .setTitle(`Help: ${cmdH} command`)
          .addField('Usage:', commands[cmdH].usage, false)
          .addField('Description:', commands[cmdH].description, false)
          msg.channel.send(embed)
        }
        else {
          msg.channel.send(`Sorry! No command called ${cmdH} exists!`)
        }
      }
      else {
        let embed = new Discord.RichEmbed().setColor('#cecece').setTitle('Help: all commands')
        for (let command in commands) {
          if (!command.admin || msg.member.roles.has('494878132143128616') || msg.member.roles.has('369948375530995712')) {
            embed.addField(`${command} Usage: ${commands[command].usage}`, `Description: ${commands[command].description}`, false)
          }
        }
        msg.channel.send(embed)
      }
    }
    else if (cmd) {
      try {
        if (cmd.admin) {
          if(msg.member.roles.has('494878132143128616') || msg.member.roles.has('369948375530995712')) { // senator or consul
            cmd.process(msg, suffix)
          }
          else {
            msg.channel.send(`Sorry! Only mods can use the ${cmdTxt.toLowerCase()} command!`)
          }
        }
        else {          
        cmd.process(msg,suffix)
        }
      } catch(e) {
        msg.channel.send(`Command "${cmdTxt}" failed!`)
      }
    }
  }
}// parseMessage

function beltColor(elo) {
  if (elo < 1300) {
    //white
    return '#cecece'
  }
  else if (elo < 1400) {
    //yellow
    return '#d4d41b'
  }
  else if (elo < 1500) {
    // green
    return '#1f833b'
  }
  else if (elo < 1600) {
    //blue
    return '#0f4a8d'
  }
  else if (elo < 1700) {
    //purple
    return '#a212be'
  }
  else if (elo < 1800) {
    //red
    return '#bd3535'
  }
  else {
    //black
    return '#140a0a'
  }
}// beltColor

// inputSet
// takes the current message, and its suffix
// records the game set to the matches table, and updates the elo scores in the players table
function inputSet(msg, suffix) {
  if (!suffix) {
    msg.channel.send('Oops! You\'re missing the details of this command!')
  }
  else {
    let details = suffix.split(" ")
    if (details[0].includes('*')) {
      let name = details[0].split("")
      name.shift()
      name = name.join("") + ' ' + details[1]
      details.shift()
      details[0] = name
    }
    if (details[1].includes('*')) {
      let name = details[1].split("")
      name.shift()
      name = name.join("") + ' ' + details[2]
      let name1 = details.shift()
      details.shift()
      details.unshift(name1)
      details[1] = name
    }
    if (details.length < 4) {
      msg.channel.send('Oops! You forgot some details there...')
    }
    else {
      con.resume()
      let [winner, loser, wins, losses, ...rt] = details
      winner = mysql.escape(winner)
      loser = mysql.escape(loser)
      winsE = mysql.escape(wins)
      lossesE = mysql.escape(losses)

      let winnerK, winnerELO, winnerP, loserK, loserELO, loserP
      console.log(`winner: ${winner}\nloser: ${loser}\nwins: ${wins}\nlosses: ${losses}\nrt: ${rt}`)
      con.query(`SELECT id, elo, placement FROM players WHERE tag=${winner}`, (err, result) => {
        if (err) {
          console.log(err)
          msg.channel.send('Something broke when reading winner!')
        }
        else if (!result[0]) {
          msg.channel.send(`Sorry! I couldn't find anyone named ${winner} in the database.`)
        }
        else {
          winnerK = result[0].id
          winnerELO = result[0].elo
          winnerP = result[0].placement
          con.query(`SELECT id, elo, placement FROM players WHERE tag=${loser}`, (err, result) => {
            if (err) {
              console.log(err)
              msg.channel.send('Something broke when reading loser!')
            }
            else if (!result[0]) {
              msg.channel.send(`Sorry! I couldn't find anyone named ${loser} in the database.`)
            }
            else {
              loserK = result[0].id
              loserELO = result[0].elo
              loserP = result[0].placement
              con.query(`INSERT INTO matches VALUES (0, '${winnerK}', '${loserK}', ${winsE}, ${lossesE})`, (err, result) => {
                if (err) {
                  console.log(err)
                  msg.channel.send('Something broke when inserting into matches!')
                }
                else {
                  let newK = K
                  let r = false
                  if (rt && rt.includes('r')) {
                    newK *= 2
                    r = true
                  }
                  if (rt && rt.includes('t')) newK *= 1.5
                  let wK = newK
                  let lK = newK
                  if (winnerP > 0) { // TODO: update placements in final con.query
                    wK = K + newK
                    winnerP--
                  }
                  if (loserP > 0) {
                    lK = K + newK
                    loserP--
                  }

                  let ex1,ex2, r1, r2, e1, e2, s1, winnerNew, loserNew
                  ex1 = winnerELO / 300.0
                  ex2 = loserELO / 300.0
                  r1 = Math.pow(10, ex1)
                  r2 = Math.pow(10, ex2)
                  e1 = r1 / (r1+r2)
                  e2 = r2 / (r2+r1)
                  s1 = wins - losses

                  // winner elo
                  if (loserELO <= 1200) {
                    winnerNew = winnerELO + (2 * s1)
                  }
                  else if (winnerELO < 1600) {
                    winnerNew = Math.floor(winnerELO + ((wK * (1 - e1) * 1.1) * s1))
                  }
                  else {
                    winnerNew = Math.floor(winnerELO + ((wK * (1 - e1)) * s1))
                  }

                  // loser elo
                  if (r) lK = newK - K
                  if (loserELO <= 1200) {
                    loserNew = 1200
                  }
                  else if (loserELO < 1600) {
                    loserNew = Math.ceil(loserELO + ((lK * (0 - e2) * 0.9) * s1))
                  }
                  else {
                    loserNew = Math.ceil(loserELO + ((lK * (0 - e2)) * s1))
                  }

                  // update scores
                  let query = `UPDATE players SET elo=${winnerNew}, placement=${winnerP} WHERE id=${winnerK}`
                  con.query(query, (err, result) => {
                    if (err) {
                      console.log(err)
                      msg.channel.send('Oh no! Something broke when updating the winner\'s score!')
                    }
                    else {
                      let query = `UPDATE players SET elo=${loserNew}, placement=${loserP} WHERE id=${loserK}`
                      con.query(query, (err, result) => {
                        if (err) {
                          console.log(err)
                          msg.channel.send('Oh no! Something broke when updating the loser\'s score!')
                          con.query(`UPDATE players SET elo=${winnerELO} WHERE id=${winnerK}`)
                        }
                        else {
                          let embed = new Discord.RichEmbed()
                            .setColor('#08f8e')
                            .setTitle('Match has been recorded!')
                            .addField(`${details[0]}'s new ELO and placements`, `${winnerNew} : ${winnerP}`,false)
                            .addField(`${details[1]}'s new ELO and placements`, `${loserNew} : ${loserP}`, false)
                          msg.channel.send(embed)
                          let logstr = `${(msg.member.nickname)?msg.member.nickname:msg.author.username} recorded a set:\n${winner} vs ${loser} ${wins}-${losses}\n${winnerELO} => ${winnerNew} \n${loserELO} => ${loserNew}\n`
                          console.log(logstr)
                          let time = new Date()
                          //logStream.write(`[${time.toString()}]\n${logstr}\n`)
                        }
                      })
                    }
                  })
                }
              })
            }
          })
        }
      })
    }
  }
}// inputSet

// matchHistory
// takes the current message and the name of a player
// sends to channel their match history in an embed
function matchHistory(msg, name) {
  con.resume()
  let player = {}
  player.tag = name
  player.matches = {}
  name = mysql.escape(name)

  con.query(`SELECT * FROM players WHERE tag=${name}`, function(err, result) {
    if(err) console.error(err)
    else if (!result[0]) {
      console.error(`Query failed! ${(msg.member.nickname)?msg.member.nickname:msg.author.username} queried for the match history of ${name}, no results found.`)
      msg.channel.send('Oops! I could\'t find anyone with that name in the rankings!')
    }
    else {
      player.id = result[0].id
      player.color = beltColor(result[0].elo)
      con.query(`SELECT * FROM matches WHERE winnerFK=${player.id} OR loserFK=${player.id}`, function(err, result) {
        /*
        [
          {id:0,winnerFK:1,loserFK:2,wins:3,losses:1}
        ]
        */
        if (err) console.error(err)
        else if (!result[0]) {
          let embed = new Discord.RichEmbed()
            .setColor("#bd3535")
            .setTitle(`Match History for ${name}`)
            .setDescription('No matches found!')
          return embed
        }
        else {
          for (let match of result) {
            if (match.winnerFK == player.id) {
              if (player.matches.hasOwnProperty(match.loserFK)) {
                player.matches[match.loserFK].wins += 1
              }
              else {
                player.matches[match.loserFK] = {wins:1,losses:0}
              }
            }
            else {
              if (player.matches.hasOwnProperty(match.winnerFK)) {
                player.matches[match.winnerFK].losses += 1
              }
              else {
                player.matches[match.winnerFK] = {wins:0,losses:1}
              }
            }
          }//for
          con.query(`SELECT id,tag FROM players`, function (err, result) {
            if (err) console.error(err)
            for (let row of result) {
              if (player.matches.hasOwnProperty(row.id)) {
                player.matches[row.id].name = row.tag
              }
            }
            let str = ''
            for (let m in player.matches) {
              str += `${player.matches[m].name}: ${player.matches[m].wins} - ${player.matches[m].losses}\n`
            }
            let embed = new Discord.RichEmbed()
                        .setColor(player.color)
                        .setTitle(`Match History for ${name}`)
                        .setDescription(str)
            msg.channel.send(embed)
          })
        }
      })
    }
  })
}// matchHistory

function updateRanks() {
  con.resume()
  con.query(`SELECT * FROM players ORDER BY elo desc`, (err, result) => {
    if (err) console.error(err)
    else if (!result[0]) {
      console.error('Failed to update ranks, no results found.')
      bot.channels.find(x => x.name === 'bot-maintanence').send('Oh no! Something went wrong when updating ranks, no results were found!')
    }
    else {
      let embeds = []
      let i = 0
      let tiers = [1800,1700,1600,1500,1400,1300,-1]
      let tierNames = ['Black','Red','Purple','Blue','Green','Yellow','White']
      let tierDescriptions = ['-----Tag--------ELO--Placements','-----Tag--------ELO--Placements','-----Tag--------ELO--Placements','-----Tag--------ELO--Placements','-----Tag--------ELO--Placements','-----Tag--------ELO--Placements','-----Tag--------ELO--Placements']
      for (let player of result) {
        while (player.elo < tiers[i]) {
          if (!embeds[i]) embeds[i] = false
          i++
        }
        if (!embeds[i]) {
          embeds[i] = new Discord.RichEmbed().setColor(beltColor(tiers[i]+1)).setTitle(`${tierNames[i]} Belts`)
        }
        player.tag += ' -'
        for (let j=player.tag.split('').length; j < 15; j++) {
          player.tag += '-'
        }
        tierDescriptions[i] += `\n${player.tag} ${player.elo}${(player.placement <= 0)?'':' - ' + player.placement}`
      }
      let z = 0
      for (let embed of embeds) {
        if(embed != false) {
          embed.setDescription(tierDescriptions[z])
        }
        z++
      }
      let x = 0
      for (let embed of embeds) {
        if (!embed) x++
      }
      let greeting = `Welcome to the Dojo!
Work your way up to higher ranked belt colors by sparring with other members and raising your rating.
The higher your opponent the more points you gain on a win, and the less you lose on a loss! (and vice versa)
During your first 5 games you are in 'Placement' and receive 3x the points (both up and down)
Check #weekly-rivals for a weekly challenge, its worth 2x points if you win!`
      let chan = bot.channels.find(x => x.name === 'dojo-ratings')
      chan.bulkDelete(20).catch((result) => console.log('Promise rejected from bulkDelete inside updateRanks'))
      chan.send(greeting).then(msg => {
        chan.send(embeds[x]).then(msg => {
          x++
          if (embeds[x]) chan.send(embeds[x]).then(msg => {
            x++
            if (embeds[x]) chan.send(embeds[x]).then(msg => {
              x++
              if (embeds[x]) chan.send(embeds[x]).then(msg => {
                x++
                if (embeds[x]) chan.send(embeds[x]).then(msg => {
                  x++
                  if (embeds[x]) chan.send(embeds[x]).then(msg => {
                    x++
                    if (embeds[x]) chan.send(embeds[x]).then(msg => {
                      x++                    
                    })
                  })
                })
              })
            })
          })
        })
      })// chan send greeting    
      config.updateRanks = Date.now()  
    }// else
  })// con query
}// updateRanks

function updateRivals() {
  con.resume()
  con.query(`SELECT * FROM players WHERE rival=1`, (err, result) => {
    let rivals = []
    let players = []
    let oldRivals = JSON.parse(fs.readFileSync("data/rivals.json"))
    oldRivals.shift()
    for (let row of result) {
      players.push(row.tag)
    }

    // randomize rivals
    let i = 0
    let j = 0
    while (players.length > 1) {
      j = Math.floor(Math.random()*players.length)
      if (j < 0) j = 0
      rivals[i] = players.splice(j,1)[0] // assign first rival in a pair
      i++
      let tries = 0
      j = Math.floor(Math.random()*players.length)

      // double check for duplicate pairings from last week
      let r = 0
      for (let w=0; w<oldRivals[0].length; w++) {
        if (oldRivals[0][w] == rivals[i-1]) {
          r = w
          w = oldRivals[0].length
        }
      }
      while (tries < 10) {
            if (r % 2 == 1) {
              if (oldRivals[0][r-1] == players[j]) {
                j = Math.floor(Math.random()*players.length)
              }
              else {
                tries = 10
              }
            }
            else {
              if (oldRivals[0][r+1] == players[j]) {
                j = Math.floor(Math.random()*players.length)
              }
              else {
                tries = 10
              }
            }
        tries++
      }// while tries < 10
      rivals[i] = players.splice(j,1)[0] // assign second rival in a pair
      i++
    }// while players.length > 1
    if (players.length == 1) { // if odd number of rivals, reuse someone
      rivals[i] = players[0] // the leftover player
      i++
      rivals[i] = rivals[Math.floor(Math.random()*(rivals.length-1))]
    }

    // build output strings
    let rivalstr = '```md\n#This Week\'s Rivals:\n'
    for (let z=0; z<rivals.length; z++) {
      rivalstr += `${rivals[z]} vs `
      z++
      rivalstr += `${rivals[z]}\n`
    }
    rivalstr += '```'    
    oldRivals.push(rivals)
    let oldstr = ''
    if (oldRivals && oldRivals[0] && oldRivals[0][0]) {
      oldstr = '```md\n#Last Week\'s Rivals:\n'
      for (let y=0; y<oldRivals[0].length; y++) {
        oldstr += `${oldRivals[0][y]} vs `
        y++
        oldstr += `${oldRivals[0][y]}\n`
      }
      oldstr += '```'
    }
    //fs.writeFileSync('data/rivals.json', JSON.stringify(oldRivals))
    let greeting = `CHALLENGE YOUR RIVAL! (Best of 3)
Every week you will be given a random rival from the ranking database. You can challenge them once that week for double the points! You have 2 weeks to do that rival challenge before it goes away, meaning you have 2 rivals at one time and each week the older of the two gets replaced.
(loser only loses the normal amount so don't be afraid!)`

    // print output
    let chan = bot.channels.find(x => x.name === 'weekly-rivals')
    chan.bulkDelete(20).catch((result) => console.log('Promise rejected from bulkDelete inside updateRivals'))
    chan.send(greeting).then(msg => {
      if (oldstr != '') {
        chan.send(oldstr).then(msg => {
          chan.send(rivalstr)
        })
      }
      else {
        chan.send(rivalstr)        
      }
    })
    config.updateRivals = Date.now()
  })// con query
}// updateRivals
/*
for pretty messages use this
let embed = new Discord.RichEmbed()
  .setColor('#ffffff')
  .setTitle('top text')
  .setDescription('main text')
  .addField('field name', 'field text', false)
  .setAuthor('name', 'pic')
msg.channel.send(embed)
*/