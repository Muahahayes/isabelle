/*
  TODO:
  add a weekly decay feature (add a 'active' field to players table, when a match is put in set active to 1,
    when rivals is called anyone that's 0 gets decayed, then set everyone to 0)
  Refactor database, add a 'dID' field to players table, tweak commands to use that to find people without suffix
  ;name change your tag in the database (checks dID)

  far future:
  add waifu stocks
  add small games
*/

// requires/resources
const Discord = require('discord.js')
const fs = require('fs')
const mysql = require('mysql')
var config = {}
var token = (process.env.token)?process.env.token:JSON.parse(fs.readFileSync('data/configlocal.json')).token
try {
  token = fs.readFileSync('token.txt')
  console.log('Running on local machine.')
}
catch(e){
  console.log('Running on Heroku cloud.')
}
//var reportStream = fs.createWriteStream("data/reports.txt", {flags:'a'})
//var logStream = fs.createWriteStream("data/log.txt", {flags:'a'})
//var con = mysql.createConnection(config.db)
if (process.env.db_host) {
  var con = mysql.createPool({
  connectionLimit : 9,
  host : process.env.db_host,
  user : process.env.db_user,
  password : process.env.db_password,
  database : process.env.db_database,
  debug : false
})
}
else {
  var configlocal = JSON.parse(fs.readFileSync('data/configlocal.json'))
  var con = mysql.createPool({
    connectionLimit : 9,
    host : configlocal.db.host,
    user : configlocal.db.user,
    password : configlocal.db.password,
    database : configlocal.db.database,
    debug : false
  })
}

// bot config
const bot = new Discord.Client()
var prefix;
var K;
var logChan;
var reportChan;
var anons = {}
var letters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
con.query(`SELECT * FROM config`, function (err, result) {
  if (err) {
    console.error(err)
    bot.channels.find(x => x.name === 'logs').send(`Error Loading config values from database!\n${err}`).then(then => {
      process.exit(1)
    })
  }
  else {
    if (result[0]) {
      console.log('Loading config from database...')
      config.rivalUpdate = (result[0].rivalUpdate)?result[0].rivalUpdate:Date.now()
      config.rankUpdate = (result[0].rankUpdate)?result[0].rankUpdate:Date.now()
      config.prefix = (result[0].prefix)?result[0].prefix:';'
      prefix = config.prefix
      config.K = (result[0].K)?result[0].K:16
      K = config.K
      config.failedLoad = (result[0])?false:true
      if (config.failedLoad) console.error('Failed to load from database, using default values.')
    }
    else {
      console.log('No config values found from database! Loading from local...')
      config.rivalUpdate = (configlocal)?configlocal.rivalUpdate:Date.now()
      config.rankUpdate = (configlocal)?configlocal.rankUpdate:Date.now()
      config.prefix = (configlocal)?configlocal.prefix:';'
      prefix = config.prefix
      config.K = (configlocal)?configlocal.K:16
      K = config.K
      config.failedLoad = (configlocal)?false:true
      if (config.failedLoad) console.error('Failed to load from local, using default values.')
    }
    bot.login(token)
  }
})

// bot event handlers
bot.on('ready', () => {
  console.log('Bot is now connected.')  
  config.lastStart = Date.now()
  console.log(`Time Start: ${config.lastStart}`)
  bot.user.setActivity('Super Smash Bros. Ultimate')
  logChan = bot.channels.find(x => x.name === 'logs')
  reportChan = bot.channels.find(x => x.name === 'reports')
  for (let i in commands) {
    commands[i].usage = commands[i].usage.replace(';',prefix) // replace default with defined prefix
    commands[i].description = commands[i].description.replace(';',prefix)
  }
  bot.channels.find(x => x.name === 'bot-maintanence').send('Hi Mayor! This is Isabelle, reporting for duty!')
  setInterval(() => { // update loop 
    let currentTime = Date.now()
    if ((currentTime - config.rivalUpdate) > 604800000) {
      updateRivals()
      if ((currentTime - config.rankUpdate) > 86400000) {
        setTimeout(() => { // so we don't post too soon after updateRivals
          updateRanks()  
        }, 2000)
      }
    }
    else if ((currentTime - config.rankUpdate) > 86400000) {
      clearAnon()
      updateRanks()  
    }
    //fs.writeFileSync('data/config.json',JSON.stringify(config))
  }, 60000)
})
bot.on('disconnected', () => {
  console.log('Diconnected!')
  process.exit(1) // exit with error
})
bot.on('message', (msg) => {
  parseMessage(msg)
})

const miscRoles = [
  'Consul',
  'Senator',
  'Liason',
  'PRETTY COLOR!',
  'BEEP BOOP',
  'Black Belt',
  'Red Belt',
  'Purple Belt',
  'Blue Belt',
  'Green Belt',
  'Yellow Belt',
  'White Belt',
  'Wolverine',
  'Friend',
  'Smash Master',
  'Titan',
  'King',
  'Royalty',
  'Lord',
  'Champion',
  'Knight',
  'Squire',
  'Scrub',
  'Isabelle-Bot',
  'UB3R-B0T',
  'Crystal',
  'Bots',
  'D&D',
  'Player Juan',
  'Racial Slur',
  'DJ',
  'Dead',
  'DM',
  'gmichael',
  'coal',
  'Tatsumaki',
  'namelock',
  'rp',
  'shhh'
]

// commands
const commands = {
  "die": {
    usage: `;die`,
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
        let rand = Math.floor(Math.random()*4)
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
          case 3:
            msg.channel.send(`You're such a bully!`)
            break;
        }
      }
    }// process
  },//die
  "rating": {
    usage: `;rating name`,
    description: 'prints the current ELO rating of the named player\n'+
                  'if no name is given, prints your own rating',
    admin:false,
    process: function(msg, suffix) {
      let query = 'SELECT * FROM players WHERE id=0' // intentionally returns 0 results
      let name = (msg.member.nickname)?msg.member.nickname:msg.author.username
      if (suffix){
        query = `SELECT * FROM players WHERE tag = ${mysql.escape(suffix)}`
      }
      else {        
        query = `SELECT * FROM players WHERE dID = ${msg.author.id}`
      }
      con.query(query, function(err, result) {
        if (err) {
          console.error(err)
          msg.channel.send('Oops! Something broke when reading the database. Restarting bot...')
          process.exit(1)
        }
        else if (!result[0]) {
          console.error(`Query failed! ${name} queried for the rank of ${(suffix)?suffix:name}, no results found.`)
          msg.channel.send('Oops! I couldn\'t find anyone with that name on the rankings!')
        }
        else {
          let player = result[0]
          let embed = new Discord.RichEmbed()
            .setColor(beltColor(player.elo).color)
            .setTitle(`Rating Report`)
            .setDescription(`Tag: ${player.tag}\nRating: ${player.elo}${(player.placement > 0)?'\nPlacements: ' + player.placement:''}\nWallet: ${player.currency}`)
          msg.channel.send(embed)
        }
      })
    }// process
  },//rating
  "edit": {
    usage: `;edit variable value name`,
    description: 'changes the value of the given variable of the named player\n'+
                  'eg. ;edit elo 1300 Player 9 (sets Player 9\'s ELO rating to 1300)',
    admin:true,
    process: function(msg, suffix) {
      editValue(msg, suffix)
    }
  },//edit
  "set": {
    usage: `;set winner loser wins losses [optional] rt`,
    description: 'inputs the results of a set into the database, with an optional r or t to flag it as a rival/tournament match.\n' +
                  'For names with 1 space, add a * in front of the name. (*Player 9). More than 1 space won\'t work, talk to the player about changing things\n' +
                  `eg. ;set Bob John 3 2 r (Bob won 3-2 vs John, and it was a rivals match).\n 'r' 't' or 'rt' are valid tags (no spaces in rt)`,
    admin:true,
    process: function(msg, suffix) {
      inputSet(msg,suffix)
    }// process
  },//set
  "history": {
    usage: `;history name`,
    description: 'prints out the match history of the named player (wins-losses against each person they\'ve fought)\n'+
                  'if no name is given, prints the history for yourself',
    admin:false,
    process: function(msg, suffix) {
      // let name = (suffix)?suffix:(msg.member.nickname)?msg.member.nickname:msg.author.username
      matchHistory(msg,suffix)
    }// process
  },//history
  "report": {
    usage: `;report text`,
    description: 'Isabelle will take down a note from you to give to the Mayor later. \n'+
                  '(logs it to the bot\'s files, deletes your message shortly afterwards to keep your reports confidential)',
    admin:false,
    process: function(msg, suffix) {
      console.log(`Name: ${msg.member.nickname}`)
      console.log(`Message: ${suffix}`)
      let time = new Date()
      let rep = `[${time.toString()}]\n${(msg.member.nickname)?msg.member.nickname:msg.author.username}: ${suffix}\n\n`
      //reportStream.write(rep)
      msg.delete(3000)
      reportChan.send(rep).then(result => {
        msg.channel.send('Thanks! I\'ll write this down right away!')
      })
      
    }// process
  },//report
  "speak": {
    usage: `;speak`,
    description: `Isabelle is well trained and can speak on command!`,
    admin:true,
    process: function(msg, suffix) {
      if (suffix && suffix != '') {
        console.log(`${msg.member.nickname} said: ${suffix}`)
        let chan = msg.channel
        msg.delete(100)
        chan.send(suffix)
      }
      else {
        commands['speak'].alt(msg)
      }
    },
    alt: function(msg, suffix) {
      let rand = Math.floor(Math.random()*5)
      let reply = ''
      switch(rand) {
        case 0:
          reply = 'Woof!'
          break;
        case 1:
          reply = 'Bark Bark!'
          break;
        case 2:
          reply = 'Awooo!~'
          break;
        case 3:
          reply = 'Grrrrrr...'
          break;
        case 4:
          reply = 'Arf!'
          break;
      }
      msg.channel.send(reply)
    }
  },//speak
  "clearanon": {
    usage: ';clearAnon',
    description: 'Clears the anonymous channels',
    admin:true,
    process: function(msg, suffix) {
      console.log('clearAnon command')
      clearAnon()
    }
  },//clearAnon
  "smug": {
    usage: ';smug #',
    description: 'Displays a smug anime girl!',
    admin:false,
    process: function(msg,suffix) {
      let smug = -1
      if(suffix) {
        smug = Math.floor(suffix)
        if (Number.isNaN(smug)) smug = -1
      }
      smugPic(msg,smug)
    }
  },//smug
  "sign": {
    usage: ';sign text',
    description: 'Isabelle will attempt to repeat you in sign language! (She\'s not very good...)',
    admin:false,
    process: function(msg,suffix) {
      if(suffix){
        signLang(msg,suffix);
      }
      else {
        msg.channel.send('Oops! You didn\'t give me anything to sign!')
      }
    }
  },//sign
  "siwmn": {
    usage: ';siwmn text',
    description: 'Isabelle will yell your phrase.',
    admin:false,
    process: function(msg, suffix) {
      if (suffix) {
        siwmn(msg, suffix)
      }
      else {
        msg.channel.send('Oops! You didn\'t give me anything to yell!')
      }
    }
  },//siwmn
  "roulette" :{
    usage: ";roulette <roulette command>",
    description: "pre-command for roulette functions, see ;roulette help",
    process: function(msg,suffix) {
      message = msg.content.replace(';roulette ', "");
      var cmdTxt = message.split(" ")[0];
      var roulettesuffix = message.substring(cmdTxt.length+1);
      var cmd = roulettecommands[cmdTxt];
      if(cmd) {
        try {
          cmd.process(msg,roulettesuffix);
        } 
        catch(e) {
          var msgTxt = "command " + cmdTxt + " failed :(";
          msg.channel.send(e +'\n'+ msgTxt);
        }
      } 
      else {
        try {
          cmd = roulettecommands["fire"]
          cmd.process(msg,suffix);
        } 
        catch(e) {
          var msgTxt = "command " + cmdTxt + " failed :(";
          msg.channel.send(e +'\n'+ msgTxt);
        }
      }
    }
  },//roulette
  "character": {
    usage: `;character charactername`,
    description: `Adds a role for that character to your Discord profile.`,
    admin: false,
    process: function(msg, suffix) {
      let role = msg.guild.roles.find(r => r.name.toLowerCase() === suffix.toLowerCase())
      let notAllowed = miscRoles.find(r => r.toLowerCase() === suffix.toLowerCase())
      if (notAllowed) {
        msg.channel.send(`Sorry! ${role.name} is not allowed to be self-assigned!`)
      }
      else if (!role) {
        msg.channel.send(`Sorry! I couldn't find a role called ${suffix}!`)
      }
      else {
        if (!msg.member.roles.has(role.id)) {
          msg.member.addRole(role).then(result => {
            msg.channel.send(`Ok, I added the ${role.name} role to you!`)
          })
        }
        else {
          msg.member.removeRole(role.id).then(result => {
            msg.channel.send(`Ok, I removed the ${role.name} role from you!`)
          })
        }
      }
    }

  },//character
  "name" : {
    usage: `;name tag`,
    description: `Changes your current tag to the new one you provide.`,
    admin: false,
    process: function(msg, suffix) {
      con.query(`SELECT tag FROM players WHERE dID=${msg.author.id}`, function(err, result) {
        if (err) {
          console.error(err)
          msg.channel.send('Oops! Something broke when trying to change your tag.')
        }
        else if (!result[0]) {
          msg.channel.send(`Sorry! I couldn't find you in the database!`)
        }
        else {
          con.query(`UPDATE players SET tag=${suffix} WHERE dID=${msg.author.id}`, function(err, result) {
            if (err) {
              console.error(err)
              msg.channel.send('Oops! Something broke when trying to change your tag.')
            }
            else {
              msg.channel.send('Ok ' + suffix + ', I\'ve changed your tag in the system!')
            }
          })
        }
      })

    }
  },//name
  "update": {
    usage: `;update [optional]ranks/rivals`,
    description: `Pulls the current data from the database to update the given list\nif no list is given, updates all lists`,
    admin:true,
    process: function(msg, suffix) {
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
  },//update
  "rank": {
    usage: `;rank name`,
    description: 'Prints out the given player\'s current place in the ranked list (eg. 1st place, 10th place, ect)\n' + 
                  'if no name is given, prints the rank for yourself',
    admin: false,
    process: function(msg, suffix) {
      if (!suffix) {
        con.query(`SELECT dID FROM players ORDER BY elo desc`, function(err, result) {
          let i = 0
          while (result[i] && result[i].dID != msg.author.id) {
            i++
          }
          i++
          msg.channel.send(`You're #${i} in the rankings!`)
        })
      }
      else {
        con.query(`SELECT tag FROM players ORDER BY elo desc`, function(err, result) {
          let i = 0
          while (result[i] && result[i].tag != suffix) {
            i++
          }
          i++
          msg.channel.send(`You're #${i} in the rankings!`)
        })
      }
    }// process
  },//rank
  "rival": { // TODO: fix rivals to work without json
    usage: `;rival name or in or out`,
    description: 'If options are blank, tells you who your rival(s) are for the week. If a name is given, tells the rivals of that player\n'+
                  'If the word in used, opts you into the rivals system for future weeks\n'+
                  'If the word out used, opts you out of the rivals system for future weeks\n',
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
        let name = (msg.member.nickname)?msg.member.nickname:msg.author.username
        if (suffix == 'in') {
          con.query(`UPDATE players SET rival=1 WHERE dID=${msg.author.id}`, function(err, result) {
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
          con.query(`UPDATE players SET rival=0 WHERE dID=${msg.author.id}`, function(err, result) {
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
    usage: `;join name @player tag`,
    description: 'Adds a player into the database with the given name and tag, and gets their discord ID from the @ mention.\nTags with spaces are ok here.\neg. ;join Alex @Muahahayes Player 9 (Alex joins the database, with the tag Player 9)',
    admin: true,
    process: function(msg, suffix) {
      if (msg.mentions.users.size) {
        let player = msg.mentions.users.first()
        let name = suffix.split(" ")[0]      
        suffix = suffix.split(" ")
        suffix.shift()
        suffix.shift()
        suffix = suffix.join(" ")
        let tag = suffix
        name = mysql.escape(name)
        tag = mysql.escape(tag)
        if (name == '' || tag == '') {
          msg.channel.send('Oops! You forgot something, please give me a name, a @mention, and a tag!')
        }
        else {
          con.query(`INSERT INTO players (id, name, tag, dID) VALUES (0, ${name}, ${tag}, ${player.id})`, function(err, result) {
            if (err) {
              console.error(err)
              msg.channel.send(`Oops! Something broke when adding ${tag} to the database! Restarting bot...`)
              process.exit(1)
            }
            else {
              let logstr = `${(msg.member.nickname)?msg.member.nickname:msg.author.username} added ${tag} to the database.`
              console.log(logstr)
              let time = new Date()
              //logStream.write(`[${time.toString()}]\n${logstr}\n\n`)
              msg.channel.send(`Ok, I've added ${tag} to the database! Welcome to the ranking system ${tag}!\nIf you want to join the rivals system (weekly challenges) use the \`;rival in\` command.`)
                .then(result => {
                logChan.send(`[${time.toString()}]\n${logstr}\n\n`).then(result => {
                  msg.delete(500) // keep first name private
                })
              })
            }
          })// con query
        }
      }//if mentions
      else {
        msg.channel.send('Sorry! I need you to @mention the person you\'re trying to add!\n```' + commands['join'].usage + '```')
      }
    }// process
  }//join
}

// functions
function parseMessage(msg) {
  if (msg.author.id != bot.user.id && msg.author.id != '85614143951892480' && msg.channel.name == 'anonymous') { //anonymous message in the anonymous channel
    let authorID = msg.author.id
    let chan = msg.channel
    let content = msg.content
    if (anons[authorID]) {
      msg.delete(0).then(p => {
        chan.send(`${anons[authorID]}: ` + content)
      })
    }
    else {
      let alias = '' + letters[Math.floor(Math.random()*26)] + letters[Math.floor(Math.random()*26)]
      let taken = false
      for (let anon in anons) {
        if (anons[anon] == alias) {
          taken = true
          break;
        }        
      }
      while (taken == true) {
      alias = '' + letters[Math.floor(Math.random()*26)] + letters[Math.floor(Math.random()*26)]
      taken = false
      for (let anon in anons) {
        if (anons[anon] == alias) {
          taken = true
          break;
        }        
      }
      }
      anons[authorID] = alias
      msg.delete(0).then(p => {
        chan.send(`${anons[authorID]}: ` + content)
      })
    }
  }
  else if (msg.author.id != bot.user.id && msg.content.startsWith(prefix) && msg.author.id != '85614143951892480') { //command from user (not UB3R-B0T)
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
          if (!command.admin || msg.member.roles.has('494878132143128616') || msg.member.roles.has('369948375530995712') || msg.member.roles.has('232012677147394048')) {
            embed.addField(`${command} Usage: ${commands[command].usage}`, `Description: ${commands[command].description}`, false)
          }
        }
        msg.channel.send(embed)
      }
    }
    else if (cmd) {
      try {
        if (cmd.admin) {
          if(msg.member.roles.has('494878132143128616') || msg.member.roles.has('369948375530995712') || msg.member.roles.has('232012677147394048')) { // senator or consul
            cmd.process(msg, suffix)
          }
          else {
            if (cmd.alt) {
              cmd.alt(msg,suffix)
            }
            else {
              msg.channel.send(`Sorry! Only mods can use the ${cmdTxt.toLowerCase()} command!`)
            }            
          }
        }
        else {          
        cmd.process(msg,suffix)
        }
      } catch(e) {
        msg.channel.send(`${e}\n Command "${cmdTxt}" failed!`)
      }
    }
  }
  else if (msg.author.id === bot.user.id) { //messages from bot to clean up
    switch(msg.content) {
      case "Thanks! I'll write this down right away!" :
        msg.delete(4000)
        break;
    }
  }  
  else if ((msg.channel.name == 'bot-maintanence' || msg.channel.name == 'bot_maintanence') && msg.content.toLowerCase().startsWith('hi')) {
    let name = msg.member.nickname
    name = name.replace(' (Mod)','')
    name = name.replace(' (Admin)','')
    msg.channel.send(`Hi ${name}!`)
  }
}// parseMessage

function beltColor(elo) {
  if (elo < 1300) {
    //white
    return {name:'White Belt', color:'#cecece'}
  }
  else if (elo < 1400) {
    //yellow
    return {name:'Yellow Belt', color:'#d4d41b'}
  }
  else if (elo < 1500) {
    // green
    return {name:'Green Belt', color:'#1f833b'}
  }
  else if (elo < 1600) {
    //blue
    return {name:'Blue Belt', color:'#0f4a8d'}
  }
  else if (elo < 1700) {
    //purple
    return {name:'Purple Belt', color:'#a212be'}
  }
  else if (elo < 1800) {
    //red
    return {name:'Red Belt', color:'#bd3535'}
  }
  else {
    //black
    return {name:'Black Belt', color:'#140a0a'}
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
      msg.channel.send('Oops! You forgot some details there...\n' + commands['set'].usage)
    }
    else if (details[3].toLowerCase() == details[2].toLowerCase()){
      msg.channel.send('Sorry! The same player can\'t defeat themselves!')
    }
    else if (details[3] > details[2]) {
      msg.channel.send('Oops! You put things in the wrong order!\n' + commands['set'].usage)
    }
    else if (Number(details[2]) == NaN || Number(details[3]) == NaN) {
      msg.channel.send('Oops! You did\'t put a number in the wins or losses argument!\n' + commands['set'].usage)
    }
    else {
      let [winner, loser, wins, losses, ...rt] = details
      winner = mysql.escape(winner)
      loser = mysql.escape(loser)
      winsE = mysql.escape(wins)
      lossesE = mysql.escape(losses)

      let winnerK, winnerELO, winnerP, winnerCurrency, winnerID, loserK, loserELO, loserP, loserCurrency, loserID
      console.log(`winner: ${winner}\nloser: ${loser}\nwins: ${wins}\nlosses: ${losses}\nrt: ${rt}`)
      con.query(`SELECT id, elo, placement, currency, dID FROM players WHERE tag=${winner}`, (err, result) => {
        if (err) {
          console.log(err)
          msg.channel.send('Something broke when reading winner! Restarting bot...')
          process.exit(1)
        }
        else if (!result[0]) {
          msg.channel.send(`Sorry! I couldn't find anyone named ${winner} in the database.`)
        }
        else {
          winnerK = result[0].id
          winnerELO = result[0].elo
          winnerP = result[0].placement
          let winP = winnerP // in case we need to reset it
          winnerID = result[0].dID
          winnerCurrency = result[0].currency
          con.query(`SELECT id, elo, placement, dID, currency FROM players WHERE tag=${loser}`, (err, result) => {
            if (err) {
              console.log(err)
              msg.channel.send('Something broke when reading loser! Restarting bot...')
              process.exit(1)
            }
            else if (!result[0]) {
              msg.channel.send(`Sorry! I couldn't find anyone named ${loser} in the database.`)
            }
            else {
              loserK = result[0].id
              loserELO = result[0].elo
              loserP = result[0].placement
              loserCurrency = result[0].currency
              loserID = result[0].dID
              con.query(`INSERT INTO matches VALUES (0, '${winnerK}', '${loserK}', ${winsE}, ${lossesE})`, (err, result) => {
                if (err) {
                  console.log(err)
                  msg.channel.send('Something broke when inserting into matches! Restarting bot...')
                  process.exit(1)
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
                  if (winnerP > 0) {
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

                  let loserCoins = newK * (Number(wins) + Number(losses))
                  if (winnerELO > loserELO) {// coins based on better player's odds of winning, fighting big guys helps
                    loserCoins *= e1
                  }
                  else {
                    loserCoins *= e2
                  }
                  let winC = winnerCurrency // in case we need to reset it
                  winnerCurrency += Math.ceil(loserCoins * 1.25) // bonus for winning

                  if (loserELO > winnerELO) {
                    loserCoins = loserCoins*((winnerELO-1000)/(loserELO-1000)) // scale based on how much of an upset it was, 
                                                                               //great players should be punished for losing to weak players
                  }
                  loserCurrency += Math.ceil(loserCoins)

                  // update scores
                  let query = `UPDATE players SET elo=${winnerNew}, placement=${winnerP}, currency=${winnerCurrency} WHERE id=${winnerK}`
                  con.query(query, (err, result) => {
                    if (err) {
                      console.log(err)
                      msg.channel.send('Oh no! Something broke when updating the winner\'s score! Restarting bot...')
                      process.exit(1)
                    }
                    else {
                      let query = `UPDATE players SET elo=${loserNew}, placement=${loserP}, currency=${loserCurrency} WHERE id=${loserK}`
                      con.query(query, (err, result) => {
                        if (err) {
                          console.log(err)
                          msg.channel.send('Oh no! Something broke when updating the loser\'s score! Restarting bot...')
                          con.query(`UPDATE players SET elo=${winnerELO}, placement=${winP}, currency=${winC} WHERE id=${winnerK}`, function(err, result) {
                            process.exit(1)
                          })
                        }
                        else {
                          let embed = new Discord.RichEmbed()
                            .setColor('#08f8e')
                            .setTitle('Match has been recorded!')
                            .addField(`${details[0]}'s new ELO, placements and wallet`, `${winnerNew} : ${winnerP} : ${winnerCurrency}`,false)
                            .addField(`${details[1]}'s new ELO, placements and wallet`, `${loserNew} : ${loserP} : ${loserCurrency}`, false)
                          
                          let smasher, belt
                          let beltStr = ''
                          if ((Math.floor(winnerNew/100) - Math.floor(winnerELO/100)) > 0) { // belt went up
                            smasher = msg.guild.members.find(r => r.id == winnerID)
                            belt = smasher.roles.find(r => r.name.includes('Belt'))
                            if (belt) smasher.removeRole(belt)                            
                            belt = msg.guild.roles.find(r => r.name === beltColor(winnerNew).name)
                            smasher.addRole(belt)
                            beltStr += `${details[0]} has moved up to ${belt.name}!\n`
                          }
                          if ((Math.floor(loserELO/100) - Math.floor(loserNew/100)) > 0) { // belt went down
                            smasher = msg.guild.members.find(r => r.id == loserID)
                            belt = smasher.roles.find(r => r.name.includes('Belt'))
                            if(belt) smasher.removeRole(belt)
                            belt = msg.guild.roles.find(r => r.name === beltColor(loserNew).name)
                            smasher.addRole(belt)
                            beltStr += `${details[1]} has fallen down to ${belt.name}!`
                          }
                          if (beltStr != '') {
                            embed.addField(`Belt changes`, beltStr, false)
                          }
                          let logstr = `${(msg.member.nickname)?msg.member.nickname:msg.author.username} recorded a set:\n${winner} vs ${loser} ${wins}-${losses}\n${winnerELO} => ${winnerNew} \n${loserELO} => ${loserNew}`
                          console.log(logstr)
                          let time = new Date()
                          //logStream.write(`[${time.toString()}]\n${logstr}\n\n`)
                          msg.channel.send(embed).then(then => {
                            logChan.send(`[${time.toString()}]\n${logstr}\n\n`)
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
      })
    }
  }
}// inputSet

// editValue
// takes the current message, and its suffix
// changes a value in the db for a given player
function editValue(msg, suffix) {
  if (!suffix) {
    msg.channel.send('Oops! You\'re missing the details of this command!')
  }
  else {
    let details = suffix.split(' ')
    let variable = mysql.escape(details[0])
    let value = mysql.escape(details[1])
    let name = details.splice(2)
    let output = ''
    name = mysql.escape(name.join(' '))

    con.query(`SELECT * FROM players WHERE tag=${name}`, (err, result) => {
      if (err) {
        msg.channel.send(`${err}\n\nOops! Couldn't find a player with the tag ${name} in the database!`)
      }
      else {
        variable = variable.split('')
        variable.pop()
        variable.shift()
        variable = variable.join('')
        value = value.split('')
        value.pop()
        value.shift()
        value = value.join('')
        if (result[0][variable]) {
          output += `Found player with the tag ${name}, their ${variable} is ${result[0][variable]}`
          let query = `UPDATE players SET ${variable}=${value} WHERE tag=${name}`
          con.query(query, (err, result) => {
            if (err) {
              msg.channel.send(`Oops! Something went wrong while setting that value in the database!`)
            }
            else {
              output += `\nSuccess! Set the player's ${variable} to ${value}`
              msg.channel.send(output)
            }
          })
        }
        else {
          msg.channel.send(`Result = ${JSON.stringify(result)}\nOops! The variable ${variable} isn't valid!`)
        }
      }
    })

    
  }
}// editValue

// matchHistory
// takes the current message and the name of a player
// sends to channel their match history in an embed
function matchHistory(msg, suffix) {
  let player = {}
  let name = (suffix)?mysql.escape(suffix):''
  player.matches = {}
  let query = 'SELECT * FROM players WHERE id=0' // intentionally returns 0 results
  if (suffix) {
    query = `SELECT * FROM players WHERE tag=${name}`
  }
  else {
    query = `SELECT * FROM players WHERE dID=${msg.author.id}`
  }

  con.query(query, function(err, result) {
    if (err) {
      console.error(err)
      msg.channel.send('Oops! Something broke when reading the database.')
    }
    else if (!result[0]) {
      console.error(`Query failed! ${(msg.member.nickname)?msg.member.nickname:msg.author.username} queried for the match history of ${(name)?name:'themselves'}, no results found.`)
      msg.channel.send('Oops! I couldn\'t find anyone with that name in the rankings!')
    }
    else {
      if (name = '') name = result[0].tag
      player.tag = result[0].tag
      player.id = result[0].id
      player.color = beltColor(result[0].elo).color
      con.query(`SELECT * FROM matches WHERE winnerFK=${player.id} OR loserFK=${player.id}`, function(err, result) {
        /*
        [
          {id:0,winnerFK:1,loserFK:2,wins:3,losses:1}
        ]
        */
        if (err) {
          console.error(err)
          msg.channel.send('Oops! Something broke when reading the database. Restarting bot...')
          process.exit(1)
        }
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
            if (err) {
              console.error(err)
              msg.channel.send('Oops! Something broke when reading the database. Restarting bot...')
              process.exit(1)
            }
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
                        .setTitle(`Match History for ${player.tag}`)
                        .setDescription(str)
            msg.channel.send(embed)
          })
        }
      })
    }
  })
}// matchHistory

function updateRanks() {
  con.query(`SELECT * FROM players ORDER BY elo desc`, (err, result) => {
    if (err) {
      console.error(err)
      bot.channels.find(x => x.name === 'bot-maintanence').send('Oops! Something broke when updating the rankings. Restarting bot...')
      process.exit(1)
    }
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
          embeds[i] = new Discord.RichEmbed().setColor(beltColor(tiers[i]+1).color).setTitle(`${tierNames[i]} Belts`)
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
Check #weekly-rivals for a weekly challenge, its worth 2x points if you win! Use the command \`;rival in\` to be put into the weekly challenge.`
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
      config.rankUpdate = Date.now()
      con.query(`UPDATE config SET rankUpdate=${Date.now()} WHERE id=2`, function(err,result) {
        if (err) {
          console.error('Failed to update rankUpdate in config!')
        }
      })
    }// else
  })// con query
}// updateRanks

function updateRivals() {
  con.query(`SELECT * FROM players WHERE rival=1`, (err, result) => {
    let rivals = []
    let players = []
    // let oldRivals = JSON.parse(fs.readFileSync("data/rivals.json"))
    // oldRivals.shift()
    let oldRivals = [[]]
    
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
      j = Math.floor(Math.random()*players.length)

      // double check for duplicate pairings from last week
      if (oldRivals[0]) {
        let r = 0
        for (let w=0; w<oldRivals[0].length; w++) {
          if (oldRivals[0][w] == rivals[i-1]) {
            r = w
            w = oldRivals[0].length
          }
        }
        let tries = 0
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
    }
    if (result.length % 2 == 1) { // if odd number of rivals, reuse someone
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
Every week you will be given a random rival from the ranking database. You can challenge them once that week for double the points! You have 1 week to do that rival challenge before it goes away.
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
    config.rivalUpdate = Date.now()
    con.query(`UPDATE config SET rivalUpdate=${Date.now()} WHERE id=2`, function(err,result) {
      if (err) {
        console.error('Failed to update rivalUpdate in config!')
      }
    })
  })// con query
}// updateRivals

function smugPic(msg, sSmug){
	var smugURL = [
	"https://cdn.discordapp.com/attachments/229744007666728961/333096132869881858/smuglestia.png",
	"https://cdn.discordapp.com/attachments/229744007666728961/333064012394921984/tumblr_ooteuayn8Z1tpxzemo1_1280.gif",
	"https://68.media.tumblr.com/18f52db4a0cbc5c661749d73426b12d8/tumblr_o05ju3cLhi1rg7cf3o1_500.jpg",
	"http://i2.kym-cdn.com/entries/icons/facebook/000/004/403/Girls.jpg",
	"http://i1.kym-cdn.com/photos/images/original/000/928/178/ea4.gif",
	"https://s3-eu-west-1.amazonaws.com/mordhau-media/spirit/images/2903/4ed1d74cfaf1de8f553a833d3384351f.jpeg",
	"https://ih1.redbubble.net/image.306792406.5643/st%2Csmall%2C215x235-pad%2C210x230%2Cf8f8f8.lite-1u2.jpg",
	"https://cdn.discordapp.com/attachments/292112441750323200/334583543797645314/Lookssmugenoughformyfolder_b1e8155d7a827c033f8856fdddd4d99e.jpg",
	"https://cdn.discordapp.com/attachments/229744007666728961/334843038075453451/the_smuggest_snake_alive.png",
	"https://cdn.discordapp.com/attachments/289620719208235010/335255629428031498/MGGHZpp_.jpg",
	"https://cdn.discordapp.com/attachments/289620719208235010/335256354493300756/3_racoons.png",
	"https://cdn.discordapp.com/attachments/229744007666728961/335259517963206663/laughing-cheetah.jpg",
	];

	var smugCount = smugURL.length + 58;
  // Pick a smug
  if(sSmug <= smugURL.length + 58 && Math.floor(sSmug) >= 0){
    smug = Math.floor(sSmug);
  }
  else{
    smug = Math.ceil(Math.random() * smugURL.length + 58);
  }
  // Displaying the smug
	if(smug < 59 && smug > 0){
	    msg.channel.sendFile("http://smug.moe/smg/" + smug + ".png");
	}
	else if(smug == 0){
		msg.channel.send("There are currently " + smugCount + " smugs!");
	}
	else{
		msg.channel.sendFile(smugURL[smug - 59])
	}
}// smugPic

function signLang(msg, suffix){
	var hands = [
	" :ok_hand:",
	" :point_right:",
	" :vulcan:",
	" :middle_finger:",
	" :fist:",
	" :point_left:",
	" :metal:",
	" :raised_hands:",
	" :clap:",
	" :wave:",
	" :thumbsup:",
	" :thumbsdown:",
	" :punch:",
	" :v:",
	" :raised_hand:",
	" :open_hands:",
	" :point_up:",
	" :point_up_2:",
	" :point_down:",
	" :hand_splayed:",
	" :call_me:",
	" :raised_back_of_hand:",
	" :fingers_crossed:",
	" :right_facing_fist:",
	" :left_facing_fist:",
	" :muscle:",
	];
	var signHands = "";
	var letterSign;
	var letterHand;
	var words = suffix.split(" ");
	for(var i = 0; i < words.length; i++){
		letterSign = words[i];
		letterHand = letterSign.toUpperCase().charCodeAt(0)-65;
		if(letterHand >= 0 && letterHand <= 25)
			signHands += hands[letterHand];
		else
			signHands += hands[Math.floor(Math.random() * hands.length)];
	}
	msg.channel.send(signHands);
}//signLang

function siwmn(msg, suffix) {
  mystring = suffix.toLowerCase().split("")
  var masda = ""
  for (var i = 0; i < mystring.length; i++) {
    console.log('siwmn: ' + mystring[i])
    if (mystring[i] == '\n') continue;
    if (mystring[i].match(/[a-z]/) || Number(mystring[i])) {
      if (Number(mystring[i])) {
        switch(Number(mystring[i])) {
          case 0:
            masda += ' :zero: '
            break;
          case 1:
            masda += ' :one: '
            break;
          case 2:
            masda += ' :two: '
            break;
          case 3:
            masda += ' :three: '
            break;
          case 4:
            masda += ' :four: '
            break;
          case 5:
            masda += ' :five: '
            break;
          case 6:
            masda += ' :six: '
            break;
          case 7:
            masda += ' :seven: '
            break;
          case 8:
            masda += ' :eight: '
            break;
          case 9:
            masda += ' :nine: '
            break;
        }
      }
      else if (mystring[i] != "a" && mystring[i] != "b" && mystring[i] != "o" && mystring[i] != ' '){
      masda += " :regional_indicator_"+mystring[i]+": "
      }
      else if (mystring[i] != "o" && mystring[i] != ' '){
        masda += " :" + mystring[i] + ": "
      }
      else if (mystring[i] != ' ')
      {
        masda += " :o2: "
      }
      else {
        masda += ' '
      }
    }
  }
  msg.channel.send(masda);
}//siwmn

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


var rouletteBullets = {
	"0"	: 	0,
	"1" 	: 	0,
	"2" 	: 	0,
	"3" 	: 	0,
	"4" 	: 	0,
	"5" 	: 	0,
	'count' : function() // Gives the number of bullets currently avalaible
	{
		return 	rouletteBullets["0"] + 
				rouletteBullets["1"] + 
				rouletteBullets["2"] + 
				rouletteBullets["3"] + 
				rouletteBullets["4"] + 
				rouletteBullets["5"];

	},
	"load" : 	function() //loads a bullet, returns false if full
	{
		if (rouletteBullets.count() == 6)
		{
			return false;
		}
		else
		{
			var loaded = false;
			// Randomly insert Bullet
			// while (!loaded)
			// {
			// 	var rand = Math.floor(Math.abs((Math.random() * 6) - 0.001));
			// 	if(rouletteBullets[rand.toString()] == 0)
			// 	{
			// 		rouletteBullets[rand.toString()] = 1;
			// 		loaded = true;
			// 	}	
			// }

			// Insert bullet at position
			if (rouletteBullets[rouletteBullets.current.toString()] == 0)
			{
				rouletteBullets[rouletteBullets.current.toString()] = 1;
				loaded = true;
			}
			rouletteBullets.spun = false;
			rouletteBullets.rotateback();
			if (loaded)
			{
				return true;
			}
			else
			{
				return false
			}
			
		}
	},
	"current" : 0,
	"rotate" : function()
	{
		if (rouletteBullets.current < 5)
			rouletteBullets.current += 1;
		else
			rouletteBullets.current = 0;
	},
	"rotateback" : function()
	{
		if (rouletteBullets.current > 0)
			rouletteBullets.current -= 1;
		else
			rouletteBullets.current = 5;
	},
	"spin" : function()
	{
		rouletteBullets.current = Math.floor(Math.abs((Math.random() * 6) - 0.001))
		rouletteBullets.spun = true;
	},
	"spun" : false,
	"fire" : function()
	{
		rouletteBullets.rotate();
		if (rouletteBullets[rouletteBullets.current.toString()] == 1)
		{
			rouletteBullets[rouletteBullets.current.toString()] = 0;
			return true;
		}
		else
		{
			return false;
		}
	},
	"empty" : function()
	{
		cartridges = rouletteBullets.count();
		rouletteBullets["0"] = 0;
		rouletteBullets["1"] = 0;
		rouletteBullets["2"] = 0;	
		rouletteBullets["3"] = 0;
		rouletteBullets["4"] = 0;
		rouletteBullets["5"] = 0;
		return cartridges;
	}

};

var roulettecommands = {
	"reload":{
		process: function(msg,suffix){
			var loadcount = parseInt(suffix);
			if (!isNaN(loadcount))
			{
				var loaded = 0;
				for (var i = 0; i < loadcount; i++)
				{
					if (rouletteBullets.load())
					{
						loaded += 1;
					}
				}
				loadcount = loadcount - loaded;
				if(loaded == 1)
					msg.channel.send(":ok_hand: You loaded " + loaded + " bullet and dropped " + loadcount+ " on the floor");
				else
					msg.channel.send(":ok_hand: You loaded " + loaded + " bullets and dropped " + loadcount+ " on the floor");
			}
			

			else if (rouletteBullets.load())// if you actually load the bullet
			{
				msg.channel.send(":ok_hand: Gun Reloaded!");
			}
			else	// if you fail to load the bullet. i.e. it's full already, or you try to insert it over a different bullet
			{
				msg.channel.send(":thinking: You dropped the bullet on the ground.");
			}
		}
	},
	"load":{
		process: function(msg,suffix){
			var loadcount = parseInt(suffix);
			if (!isNaN(loadcount))
			{
				var loaded = 0;
				for (var i = 0; i < loadcount; i++)
				{
					if (rouletteBullets.load())
					{
						loaded += 1;
					}
				}
				loadcount = loadcount - loaded;
				if(loaded == 1)
					msg.channel.send(":ok_hand: You loaded " + loaded + " bullet and dropped " + loadcount+ " on the floor");
				else
					msg.channel.send(":ok_hand: You loaded " + loaded + " bullet(s) and dropped " + loadcount+ " on the floor");
			}
			

			else if (rouletteBullets.load())// if you actually load the bullet
			{
				msg.channel.send(":ok_hand: Gun Reloaded!");
			}
			else	// if you fail to load the bullet. i.e. it's full already, or you try to insert it over a different bullet
			{
				msg.channel.send(":thinking: You dropped the bullet on the ground.");
			}
		}
	},
	"spin":{
		process: function(msg,suffix){
			rouletteBullets.spin();
    		msg.channel.send(":nerd: Spinning the cylinders has randomized the bullet!");
		}
	},
	"count":{
		process: function(msg,suffix){
			msg.channel.send(":eyes: you cheat and check the number of bullets in the cylinder. There are " + rouletteBullets.count())
		}
	},
	"fire":{
		process: function(msg,suffix){
			msg1 = "";
			msg2 = "";
			msg3 = "";
			msg4 = ""
			if(suffix == ""){
				msg1 = ":joy: :gun:";
				msg2 = msg1 + "\n...";
		    		if (rouletteBullets.fire()){
		    			msg3 = msg2 + "\n:boom: **BANG!** You died!!";
		    			if (rouletteBullets.spun == false){
		    				msg4 = msg3 + "\n:clap: Did you intend to shoot the bullet you just loaded?. Use ;roulette spin";
		    			}
		    		}
		    		else{
						msg3 = msg2 + "\n.....*Click!*";
						if (rouletteBullets.count() == 0){
		    				msg4 = msg3 +"\n:expressionless: What were you expecting. It's empty. Use ;roulette reload";
		    			}
		    		}
		    }
		    else if(suffix.includes("<@")){
		    	var thisid = suffix.replace(/[^0-9\.]/g, '')
		    	
		    	var found = false;
				for(var i = 0; i < msg.guild.members.array().length; i++) {
				    if (msg.guild.members.array()[i].user.id == thisid) {
				        found = true;
				        break;
				    }
				}
				if (found)
				{
					msg1 = ":scream:  :gun: :joy:";
					msg2 = msg1 + "\n...";
		    		if (rouletteBullets.fire()){
		    			msg3 = msg2 + "\n:boom: **BANG!** You killed <@"+ thisid+  ">!!";
		    			if (rouletteBullets.spun == false){
		    				msg4 = msg3 + "\n:clap: Did you intend to shoot the bullet you just loaded?. Use ;roulette spin";
		    			}
		    		}
		    		else{
						msg.channel.send("\n.....*Click!*\n :disappointed_relieved: :gun: :rolling_eyes:");
						if (rouletteBullets.count() == 0){
		    				msg4 = msg3 +"\n:expressionless: What were you expecting. It's empty. Use ;roulette reload";
		    			}
		    		}
				}
			}
			var mes;
			msg.channel.send(msg1).then((message => {
				mes = message;
				if(msg2 != "")
				setTimeout(function(){mes.edit(msg2)}, 1000)
				if(msg3 != "")
				setTimeout(function(){mes.edit(msg3)}, 2000)
				if(msg4 != "")
				setTimeout(function(){mes.edit(msg4)}, 2250)
			}));
		}
	},
	"empty":{
		process: function(msg,suffix)
		{
			if (rouletteBullets.count() == 0){
				msg.channel.send(":dash: You attempt to empty the gun. Only an undetermined number of casings fall on the ground.");
			}
			else if (rouletteBullets.count() == 1)
			{
				msg.channel.send(":v: Peace! Peace! \nYou empty the gun and " + rouletteBullets.empty() + " cartridge along with an undetermined number of casings fall on the ground.");
			}
			else
			{
				msg.channel.send(":v: Peace! Peace! \nYou empty the gun and " + rouletteBullets.empty() + " cartridges along with an undetermined number of casings fall on the ground.");
			}
		}
	},
	"help":{
		process: function(msg,suffix)
		{
			msg.channel.send("```\nRussian Roulette!\nCommands:\n" + 
    				";roulette <name> (Fires the gun! if the bullet is in the chamber, you die!)\n" + 
    				";roulette spin (Spin the cylinder.\n" + 
    				";roulette empty (Clears the cylinder)\n" + 
    				";roulette count (Checks the number of bullets in the gun.)\n" + 
    				";roulette reload|load (Loads a new bullet)\n```");
		}
	}
}

function clearAnon() {
  console.log('clearAnon function')
  let anonChans = ['711476887960027146','711482868421099550']
  anons = {}
  for (let id of anonChans) {
    clearAnonymous(id)
  }
}

async function clearAnonymous(id) {
  let anonC = bot.channels.find(x => x.id === id)
  console.log('deleting messages from anonymous channel')
  await anonC.bulkDelete(100)
  let msgs = await anonC.fetchMessages({limit: 3})
  while (msgs.size >= 2) {
    console.log('deleting extras')
    await anonC.bulkDelete(100)
    msgs = await anonC.fetchMessages({limit: 3})
  }
  let embed = new Discord.RichEmbed()
  .setColor('#303850')
  .setTitle('Welcome to Anonymous!')
  .setDescription('All posts in this channel are anonymized by Isabelle, speak whatever is on your mind!')
  await anonC.send(embed)
}