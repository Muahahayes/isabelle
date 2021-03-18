/*
  TODO:
  add a weekly decay feature (add a 'active' field to players table, when a match is put in set active to 1,
    when rivals is called anyone that's 0 gets decayed, then set everyone to 0)

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
var prefix
var K
var logChan
var reportChan
var anonChan
var chanChan
var claimedTurnips = {}
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
      postNum = (result[0].postNum)?result[0].postNum:0
      K = config.K
      config.tprice = (result[0].tprice)?result[0].tprice:100
      config.tfound = (result[0].tfound)?result[0].tfound:0
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
      postNum = (configlocal)?configlocal.postNum:0
      K = config.K
      config.tprice = (configlocal)?configlocal.tprice:100
      config.tfound = (configlocal)?configlocal.tfound:0
      config.failedLoad = (configlocal)?false:true
      if (config.failedLoad) console.error('Failed to load from local, using default values.')
    }
    bot.login(token)
  }
})
/**
 * con.query()
 * if (result[0])
 * blah blah
 */

// bot event handlers
bot.on('ready', () => {
  console.log('Bot is now connected.')  
  config.lastStart = Date.now()
  console.log(`Time Start: ${config.lastStart}`)
  bot.user.setActivity('Super Smash Bros. Ultimate')
  logChan = bot.channels.find(x => x.name === 'logs')
  reportChan = bot.channels.find(x => x.name === 'reports')
  anonChan = bot.channels.find(x => x.id == '711689236457455691')
  chanChan = bot.channels.find(x => x.id == '744888215399301202')
  for (let i in commands) {
    commands[i].usage = commands[i].usage.replace(';',prefix) // replace default with defined prefix
    commands[i].description = commands[i].description.replace(';',prefix)
  }
  con.query(`SELECT * FROM chan`, function(err, result) {
    if(err) {
      console.log(err)
    }
    else {
      for (let row of result) {
        trips[row.dID] = row.trip
        chanColors[row.dID] = row.color
      }
      console.log(trips)
      console.log(chanColors)
    }
  })
  con.query(`SELECT * from turnips`, function (err, result) {
    if (err) {
      console.log(err)
      process.exit(0)
    }
    else {
      for (let row of result) {
        claimedTurnips[row['pass']] = true
      }
      console.log(JSON.stringify(claimedTurnips))
    }
  })
  bot.channels.find(x => x.name === 'bot-maintanence').send('Hi Mayor! This is Isabelle, reporting for duty!').then( () => {
    let embed = new Discord.RichEmbed().setTitle('Bot Reset!').setDescription('Anon Aliases are reset.').setColor('#ff52b1')
    anonChan.send(embed)
  }
  )
  // get trips and colors from db


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
    updatePostNum()
  }, 60000)
})
bot.on('disconnected', () => {
  console.log('Diconnected!')
  process.exit(1) // exit with error
})
bot.on('message', (msg) => {
  parseMessage(msg)
})
bot.on('guildMemberAdd', (member) => {
  if (member.guild.id == '711689236457455688') {
    member.setNickname('Anonymous')
  }
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
  'shhh',
  'Octave'
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
  "debugalias": {
    usage: ';debugAlias',
    description: 'used for debugging (bot owner only!)',
    admin:true,
    process: function(msg, suffix) {
      if (msg.author.id == 142893548134596608) {
        msg.channel.send(`Alias list:\n${JSON.stringify(anons)}`)
      }
      else {
        msg.channel.send('This command is only for debugging during code development.')
      }
    }// process
  },//debugalias
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
      if (msg.guild) msg.delete(3000)
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
      if (suffix && suffix != '' && msg.guild) {
        console.log(`${msg.member.nickname} said: ${suffix}`)
        let chan = msg.channel
        if (msg.guild) msg.delete(100)
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
  "a": {
    usage: ';a text',
    description: 'Gives Isabelle a message to post in the anonymous channel on Isabelle Channel',
    admin:false,
    process: function(msg, suffix) {
      anonPost(msg, suffix)
    }
  },//a
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
  "morning": {
    usage: ';morning',
    description: 'Prints a morning announcement.',
    admin:true,
    process: function(msg, suffix) {
      let greeting = new Discord.RichEmbed()
      .setColor('#e163c0')
      .setTitle('Good Morning!')
      .setDescription(vietnam())
      msg.channel.send(greeting)
    }
  },//morning
  "debugembed": {
    usage: ';debugembed',
    description: 'debugging thing don\'t worry about it',
    admin:true,
    process: function(msg, suffix) {
      let debugEmbed = new Discord.RichEmbed()
      .setColor('#008080')
      .setTitle('Debug')
      .setDescription(suffix)
      msg.channel.send(debugEmbed)
    }
  },//debugembed
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
          con.query(`UPDATE players SET tag="${suffix}" WHERE dID=${msg.author.id}`, function(err, result) {
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
                  if (msg.guild) msg.delete(500) // keep first name private
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
  },//join,
  "hash": {
    usage: ';hash password',
    description: 'Will hash the password given and give you an alias [tripcode]. Used for finding a code you like and then using ;trip to set it as your tripcode in #chan-posting on the Isabelle Chan server.',
    admin:false,
    process: function(msg, suffix) {
      let trip = tripHash(suffix.split(' ')[0])
      msg.channel.send(`Tripcode: ${trip}`)
      if (msg.guild) msg.delete(0)
    }
  },//hash
  "trip": {
    usage: ';trip name#password',
    description: 'Will hash the password (up to 20 characters) into an alias (tripcode) and store it in the db for your posts in Isabelle Chan. Saves the name and alias as "name [alias]" to be used in chan posts. Name is optional but password is not!',
    admin:false,
    process: function(msg, suffix) {
      if (!suffix.includes('#')) {
        msg.channel.send('Oops! No password given, remember to include a password after a # sign.')
      }
      else {
        let hash = suffix.split(' ')[0]
        let name
        if (hash) {
          name = hash.split('#')[0]
          hash = hash.split('#')[1]
          if (hash.length>20) {
            hash = hash.splice(0,20)
          }
          hash = tripHash(hash)
        }
        let trip = ((name)?name+' ':'') + '[`' + hash + '`]'
        updateTrip(msg, trip)
      }
      
      if (msg.guild) msg.delete(0)
    }
  },//trip
  "color": {
    usage: ';color #hex',
    description: 'Sets the hex value as your color in the db for your posts in Isabelle Chan.',
    admin:false,
    process: function(msg, suffix) {
      let color = suffix.match(/#([0-9]|[a-f]|[A-F])([0-9]|[a-f]|[A-F])([0-9]|[a-f]|[A-F])([0-9]|[a-f]|[A-F])([0-9]|[a-f]|[A-F])([0-9]|[a-f]|[A-F])/)
      if (color) {
        color = color[0]
        updateColor(msg, color)
      }
      else {
        msg.channel.send('Oops! That doesn\'t look like a hex number! Make sure your color is a hex code (#000000 for black, #FFFFFF for white, ect).')
      }      
      if (msg.guild) msg.delete(0)
    }
  },
  "post": {
    usage: ';post [url] text',
    description: 'Posts your message on Isabelle Chan in $chan-posting. If the first thing in your post is a url for an image she\'ll include your image in the post! (please don\'t use non-image urls)',
    admin:false,
    process: function(msg, suffix) {
      chanPost(msg, suffix)
    }
  },
  "pull": {
    usage: ";pull [hash]",
    description: "Pull a Turnip! If its a Lucky Turnip Isabelle will reward you with some bells. You may include an optional hash (string of alphanumeric characters) of length 1-20, you'll earn 50% more bells if this hash is lucky!",
    admin:false,
    process: function(msg, suffix) {
      if (config.tfound < 10) {
        pullTurnip(msg, suffix)
      }
      else {
        // tired of pulling turnips
        msg.channel.send(`Sorry, I'm all worn out pulling Turnips today. Check back tomorrow!`)
      }
    }
  },
  "price": {
    usage: ";price",
    description: "Isabelle checks the current price she's buying Lucky Turnips for.",
    admin:false,
    process: function(msg,suffix) {
      msg.channel.send(`Lucky Turnips <:luckyturnip:821950961819844621> are currently worth ${config.tprice} bells <:bellbag:821950894621851648>`)
    }
  },
  "test": {
    usage: ";test",
    description: 'used for testing things',
    admin:true,
    process: function(msg, suffix) {
      msg.channel.send(Object.keys(msg) + `\n\nmsg.member:\n${Object.keys(msg.member)}`)
    }
  }
}

// functions
function parseMessage(msg) {
  if (msg.author.id != bot.user.id && msg.author.id != '85614143951892480' && msg.channel.name == 'anonymous') { //anonymous message in the anonymous channel
    anonPost(msg, msg.content)
  }
  else if (msg.author.id != bot.user.id && msg.author.id != '85614143951892480' && msg.channel.name == 'chan') {
    chanPost(msg, msg.content)
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
          try {
          if (!command.admin || msg.member.roles.has('494878132143128616') || msg.member.roles.has('369948375530995712') || msg.member.roles.has('232012677147394048')) {
            embed.addField(`${command} Usage: ${commands[command].usage}`, `Description: ${commands[command].description}`, false)
          }
          }
          catch(e) {
            msg.channel.send(e).then(msg.channel.send(JSON.toString(msg)))
          }
        }
        msg.channel.send(embed)
      }
    }
    else if (cmd) {
      try {
        if (cmd.admin) {
          if(msg.member.roles.has('494878132143128616') || msg.member.roles.has('369948375530995712') || msg.member.roles.has('232012677147394048') || msg.author.id == 142893548134596608) { // senator or consul
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
        if (msg.guild) msg.delete(4000)
        break;
    }
  }  
  else if ((msg.channel.name == 'bot-maintanence' || msg.channel.name == 'bot_maintanence') && msg.content.toLowerCase().startsWith('hi')) {
    let name = msg.member.nickname
    name = name.replace(' (Mod)','')
    name = name.replace(' (Admin)','')
    msg.channel.send(`Hi ${name}!`)
  }
  else if (msg.channel.guild.id == 369948288277020674 && msg.channel.name != 'politics' && msg.channel.name != 'final-destination' && msg.channel.name != 'suggestions') {
    let polWords = /(global warming)|(climate change)|(capitalism)|(communism)|(socialism)|(republican)|(democrat)|(biden)|(trump)|(antifa)|(blm)|(black lives matter)|(proud boy)|(right wing)|(left wing)|(facist)|(facism)|(communist)|(capitalist)|(means of production)|(rape)|(impeach)|(socioeconomic)|(socio-economic)|(election)|(electoral college)|(maga)|(make america great again)|(free speech)|(amendment)|(constitution)/g
    let mat = msg.content.match(polWords)
    if (mat && mat[0]) { // someone posted a political word/phrase
      msg.channel.send(`${msg.author} BIG SISTER WARNING: ${mat} is a political word/phrase! Please move your discussion to the #politics channel, thanks!`).then((reply) => {if(msg.guild){msg.delete(10000)}reply.delete(10000)})
    }
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
                  if (rt && rt.includes('t')) newK *= 1.5
                  let lK = newK
                  if (rt && rt.includes('r')) {
                    newK *= 2
                    r = true
                  }
                  
                  let wK = newK
                  if (winnerP > 0) {
                    wK = K + K + newK
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
                    winnerNew = Math.floor(winnerELO + ((wK * (1 - e1) * 1.25) * s1))
                  }
                  else {
                    winnerNew = Math.floor(winnerELO + ((wK * (1 - e1) * 1.1) * s1))
                  }

                  // loser elo
                  if (loserELO <= 1200) {
                    loserNew = 1200
                  }
                  else if (loserELO < 1600) {
                    loserNew = Math.ceil(loserELO + ((lK * (0 - e2) * 0.75) * s1))
                  }
                  else {
                    loserNew = Math.ceil(loserELO + ((lK * (0 - e2) * 0.9) * s1))
                  }
                  let loserThreshold = Math.floor(loserELO/100) * 100 //eg. will turn 1410 into 1400
                  if (loserNew < loserThreshold && loserThreshold != loserELO) { // player dropped a 100 and wasn't already at that 100 (eg. 1410 dropped to 1390)
                    loserNew = loserThreshold // set 1390 back to 1400, gives 1 grace loss before you drop a belt
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
        if (result[0][variable] || result[0][variable] === 0) {
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
      let numTurnips = Object.keys(claimedTurnips).length
      config.tprice = Math.ceil(config.tprice + ((Math.random() - 0.25) * 10 * numTurnips))
      if (config.tprice < 100 + numTurnips) config.tprice = 100 + numTurnips
      config.tfound = 0
      con.query(`UPDATE config SET rankUpdate=${Date.now()},tprice=${config.tprice},tfound=0 WHERE id=2`, function(err,result) {
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
  msg.channel.send(masda)
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
  // let anonChans = ['711476887960027146','711482868421099550','711689236457455691']
  anons = {}
  aliases = {}
  try {
    clearAnonymous('711689236457455691')
  }
  catch (e) {
    console.log('Error while clearing the anonymous channel!')
    console.log(e)
  }
  // for (let id of anonChans) {
  //   try {
  //     clearAnonymous(id)
  //   }
  //   catch (e) {
  //     console.log('Error while clearing anonymous channels!')
  //     console.log(e)
  //   }
  // }
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
  .setColor('#404050')
  .setTitle('Welcome to Anonymous!')
  .setDescription('All posts in this channel are anonymized by Isabelle, speak whatever is on your mind! For extra anonymity, you can DM Isabelle your message! Use the `;a` command when giving her a message privately.')
  await anonC.send(embed)
  let greeting = new Discord.RichEmbed()
  .setColor('#e163c0')
  .setTitle('Good Morning!')
  .setDescription(vietnam())
  anonC.send(greeting)
}


let asides = [
  `How's everyone doing today?`,
  `I hope you all are having a good day so far!`,
  `I stayed up too late last night... again.`,
  `You're all wonderful people!`,
  `Today looks like it'll be a good day!`,
  `How's everyone liking the weather today?`,
  `It's the start of another great day!`,
  `Who's ready for another wonderful day?`,
  `Keep your chins up! It's time to face another day!`,
  `I hope you're all doing ok.`
]
let noNews = [
  `There's no news today, but `,
  `I don't have any announcements today... `,
  `I was going to read some news, but `,
  `I forgot to bring the news with me today, `,
  `There wasn't really anything interesting in the news day, so, `,
  `...oh! Sorry I got a little distracted. I was thinking about something, `,
  `I hope you're not upset if I don't read any news today. I wanted to talk about something else, `,
  `So what if I don't have any news? The mayor can't keep this from the public any longer, `,
  `I dropped my notepad in a puddle on the way to work today. I was so excited to finally have news... I guess I'll just tell you about something else, `,
  `I've got a bit of a cold today, I hope you don't mind if I didn't prepare any news for you... Um, `
]
function vietnam() { // GOOD MORNING VIETNAM
  let str = ''
  str += asides[randNum(asides.length)]
  str += '\n'
  str += noNews[randNum(noNews.length)]
  str += ``
  let genre = randNum(4)
  switch(genre) {
    case 0:
      str += tvShow()
      break;
    case 1:
      str += sawAnimal()
      break;
    case 2:
      str += factoid()
      break;
    case 3:
      str += offTopic()
      break;
    default: // just in case we somehow get 3 or whatever the magic number I used on genre??
      str += offTopic()
      break;
  }
  str += `\nHave a good day everyone!`
  str = str.replace(' a a', ' an a')
  str = str.replace(' a e', ' an e')
  str = str.replace(' a i', ' an i')
  str = str.replace(' a o', ' an o')
  str = str.replace(' a u', ' an u')
  str = str.replace(' A a', ' An a')
  str = str.replace(' A e', ' An e')
  str = str.replace(' A i', ' An i')
  str = str.replace(' A o', ' An o')
  str = str.replace(' A u', ' An u')
  return str
  /*
    Good Morning! (some kind of friendly aside)
    Right now its (time) on (day), (date)
    (doesn't really have any news today)
    (random goofy stuff)
  */
}

let nouns = [
  'pickle',
  'bear',
  'squirrel',
  'man',
  'man',
  'man',
  'woman',
  'woman',
  'woman',
  'boy',
  'boy',
  'girl',
  'girl',
  'cat',
  'cat',
  'dog',
  'dog',
  'flower',
  'uranium',
  'belly button',
  'bubble gum',
  'bubble gum',
  'gun',
  'sword',
  'apple',
  'pear',
  'peach',
  'cherry',
  'orange',
  'bunny',
  'pirate',
  'ninja',
  'bird',
  'fox'
]
let verbs = [
  'run','run',
  'jump','jump',
  'swim',
  'dance','dance',
  'play the flute',
  'save money',
  'hide',
  'hula dance',
  'find Waldo',
  'shake trees',
  'sing','sing',
  'rage',
  'make friends',
  'file taxes',
  'play Smash',
  'post on Discord',
  'watch Youtube',
  'watch TV',
  'play video games',
  'hunt',
  'eat','eat',
  'run','run',
  'jump','jump',
  'swim',
  'dance','dance',
  'play the flute',
  'save money',
  'hide',
  'hula dance',
  'find Waldo',
  'shake trees',
  'sing','sing',
  'rage',
  'make friends',
  'file taxes',
  'play Smash',
  'post on Discord',
  'watch Youtube',
  'watch TV',
  'play video games',
  'hunt',
  'eat','eat',
  'run','run',
  'jump','jump',
  'swim',
  'dance','dance',
  'play the flute',
  'save money',
  'hide',
  'hula dance',
  'find Waldo',
  'shake trees',
  'sing','sing',
  'rage',
  'make friends',
  'file taxes',
  'play Smash',
  'post on Discord',
  'watch Youtube',
  'watch TV',
  'play video games',
  'hunt',
  'eat','eat',
  'read announcements to ungrateful villagers'
]
let adj = [
  'red',
  'blue',
  'yellow',
  'green',
  'orange',
  'purple',
  'teal',
  'black',
  'white',
  'grey',
  'gray',
  'brown',
  'violet',
  'indigo',
  'cool',
  'sassy',
  'mean',
  'nice',
  'angry',
  'obtuse',
  'scared',
  'shy',
  'happy',
  'excited',
  'hyped',
  'lewd',
  'big',
  'small',
  'extra',
  'large',
  'tiny',
  'huge',
  'revered',
  'holy',
  'cursed',
  'blessed',
  'unholy',
  'favorite',
  'famous',
  'infamous',
  'relaxed',
  'loved',
  'hated',
  'feared',
  'respected',
  'responsible',
  'endearing',
  'friendly',
  'incredible',
  'slutty'
]
let adv = [
  'quickly',
  'responsibly',
  'easily',
  'abruptly',
  'beautifully',
  'delicately',
  'delightfully',
  'firmly',
  'lightly',
  'truthfully',
  'wearily',
  'willfully',
  'brutally',
  'expertly',
  'wickedly',
  'everywhere',
  'inside',
  'outside',
  'somewhere',
  'first',
  'last',
  'regularly',
  'today'
]
let libNames = [
  'Rick',
  'Morty',
  'Sean',
  'Erin Hanson',
  'Danny Sexbang',
  'Summer',
  'Alex',
  'Ryan',
  'Karen',
  'Chad',
  'Susan',
  'Joseph',
  'Greg',
  'Robbie',
  'Peter',
  'Homer',
  'Marge',
  'Shaggy',
  'Fred',
  'Velma',
  'Daphne',
  'Scooby',
  'Bruce',
  'Chris',
  'Aly',
  'Sunny',
  'Belle',
  'Stacy',
  'Tiffany',
  'Natalie',
  'Thot',
  'Simp'
]
let tvIntro = [
  'I stayed up last night watching TV again... ',
  'I stayed up last night watching Netflix again... ',
  'did you guys see that new show on PBS? ',
  `I saw a new show and I've been thinking about it all day. `,
  'does anyone remember that old TV show from our childhood? ',
  `don't tell anyone, but I kinda like that weird show that aired last night... `,
  `a friend recommended a new show to me yesterday! `
]
function tvShow() {
  let str = ''
  str += tvIntro[randNum(tvIntro.length)]
  let libs = [
    `It was a documentary about a {n} that could {v} {adv}! Can you believe it?`,
    `It was a gritty crime drama called {Uadj} {Un}! It was about {name}, a {adj} {n} with nothing to lose who needs to {v} {adv} to save their city. I was at the edge of my seat!`,
    `It was a cute cartoon with a {adj} {n} named {name} who can {v} all day long with their friends.\n...I may have stayed up all night watching the whole series.`,
    `It was a sci-fi action adventure show about someone named {name} who turned themselves into a {n}! Funniest thing I've ever seen!`,
    `It was a romcom where a woman falls in love with a {adj} {n}! It was so sweet, and I laughed when they began to {v}. I'd really recommend it!`,
    `It was an anime where a {n} had to {v} {adv}, in highschool! They were {adj} which let you know they were the protagonist! It was so cheesy but I couldn't help but watch the whole thing...`,
    `It was an anime about a {adj} {n} and their lover, but they had to {v} because society didn't want them to be together. So sad...`
  ]
  str += madLib(libs[randNum(libs.length)])
  return str
}

let sawThing = [
  'I looked outside my window this morning and saw the weirdest thing! ',
  'while watering my garden, I looked behind me and was startled by something! ',
  'I was sitting on my porch soaking in the sunrise, and saw something rustling in the bushes in my yard! ',
  'I saw something I just felt like telling you all about! ',
  'I was walking to work and heard something behind me, I turned around and saw something I just had to tell you about!'
]
function sawAnimal() {
  let str = ''
  str += sawThing[randNum(sawThing.length)]
  let libs = [
    `It was a {adj} {n} roaming around the village. I hear some people saw it {v} {adv} behind some houses. Weird right?`,
    `There was a {n} that I saw {v} right before my eyes! I've never seen anything like it!`,
    `I think it was a {n}? By the time I tried to {v} it was already gone! Let me know if anyone spots it!`,
    `It was a {adj} {n}! I was so scared I had to {v}! I hope I didn't upset it...`,
    `There was a {adj} {n} but it started to {v} {adv} before I knew it! I wonder what happened to it?`,
    `It was a {n} right behind me! It was {adj} and tried to {v} so I ran and hid. I'm still shaking just thinking about it!`,
    `It was a {adj} {n}! I tried to {v} but I think I scared it off... Maybe I'll see it again someday?`
  ]
  str += madLib(libs[randNum(libs.length)])
  return str
}

let factIntro = [
  `here's a random Fact of the Day! `,
  `here's a random Fact of the Day! `,
  `did you guys know? `,
  `Fact of the Day! `,
  `Fact of the Day! `,
  `oh yeah I read about something interesting today! `,
  `so guess what! `
]
function factoid() {
  let str = ''
  str += factIntro[randNum(factIntro.length)]
  let libs = [
    `A {adj} {n} can only {v} once in its lifetime? Weird right?`,
    `A {adj} {n} can {v}? I never knew!`,
    `Only a {adj} {n} can {v} {adv}? Unbelievable!`,
    `Doctors say if you {v} every day it's good for your health! Take care of yourselves!`,
    `Experts say if you {v} it will keep the {adj} {n} away! I should try that...`,
    'If you ask a {n} to {v}, it can never do it {adv}. Aww...'
  ]
  str += madLib(libs[randNum(libs.length)])
  return str
}

let offTopics = [
  'I\'m so tired... ',
  'I need a drink. ',
  'it got me thinking. ',
  'well you know what? ',
  'I\'ve been wondering about stuff. ',
  'and I guess I\'ve just been thinking about life a lot lately. '
]
function offTopic() {
  let str = ''
  str += offTopics[randNum(offTopics.length)]
  let libs = [
    'Sometimes I want to just grab my {adj} {n} and just leave this town.',
    'When you look at a {n} do you ever think "what if it was {adj}"?',
    'If I went back to school so I could {v} {adv}, would I have made something of myself?',
    'What if all those times I {v} {adv}, I really should have been finding myself instead.',
    'Can I ever truly {v} with a {n}?',
    'What if I was just a {adj} {n} all along...?'
  ]
  str += madLib(libs[randNum(libs.length)])
  return str
}

function madLib(lib) {
  lib = lib.replace('{n}', nouns[randNum(nouns.length)])
  let Un = nouns[randNum(nouns.length)]
  Un = Un.split('')
  Un[0] = Un[0].toUpperCase()
  Un = Un.join('')
  lib = lib.replace('{Un}', Un)
  lib = lib.replace('{v}', verbs[randNum(verbs.length)])
  lib = lib.replace('{adv}', adv[randNum(adv.length)])
  let Uadj = adj[randNum(adj.length)]
  Uadj = Uadj.split('')
  Uadj[0] = Uadj[0].toUpperCase()
  Uadj = Uadj.join('')
  lib = lib.replace('{Uadj}', Uadj)
  lib = lib.replace('{adj}', adj[randNum(adj.length)])
  lib = lib.replace('{name}', libNames[randNum(libNames.length)])
  return lib
}

function randNum(length) {
  return Math.floor(Math.random()*length)
}

// globals for anonPost, so they only get initialized once
var anonNoun = [
  'Watermelon',
  'Grapes',
  'Oregano',
  'Apple',
  'Strawberry',
  'Kiwi',
  'Lime',
  'Lemon',
  'Pineapple',
  'Dog',
  'Cat',
  'Bird',
  'Fox',
  'Elephant',
  'Person',
  'Fork',
  'Spoon',
  'Knife',
  'Bus',
  'Car',
  'Truck',
  'Armadillo',
  'Racoon',
  'Squirrel',
  'Meanie',
  'Bully',
  'Hero',
  'Villain',
  'Demon',
  'Angel',
  'Ninja',
  'Pirate',
  'Knight',
  'Samurai',
  'Rock',
  'Tree',
  'Flower',
  'Leaf',
  'Mushroom',
  'Sun',
  'Moon',
  'Star',
  'Diamond',
  'Amethyst',
  'Ruby',
  'Sapphire',
  'Emerald',
  'Jade',
  'Gamer',
  'Bunny'
]
var anonAdj = [
  'Red',
  'Blue',
  'Yellow',
  'Green',
  'Orange',
  'Purple',
  'Teal',
  'Black',
  'White',
  'Grey',
  'Gray',
  'Brown',
  'Violet',
  'Indigo',
  'Cool',
  'Sassy',
  'Mean',
  'Nice',
  'Angry',
  'Obtuse',
  'Scared',
  'Shy',
  'Happy',
  'Excited',
  'Hyped',
  'Lewd',
  'Big',
  'Small',
  'Extra',
  'Large',
  'Tiny',
  'Huge',
  'Revered',
  'Holy',
  'Cursed',
  'Blessed',
  'Unholy',
  'Favorite',
  'Famous',
  'Infamous',
  'Relaxed',
  'Loved',
  'Hated',
  'Feared',
  'Respected',
  'Responsible',
  'Endearing',
  'Friendly',
  'Incredible',
  'Slutty'
]
var anons = {}
var aliases = {}
var anonLast
function anonPost(msg, content) {
  let authorID = msg.author.id
  if (anons[authorID]) {
    if (msg.guild) {
      msg.delete(0).then(p => {
        anonMsg(authorID, content)
      })
    }
    else {
      anonMsg(authorID, content)
    }
  }
  else {
    // let alias = '' + letters[Math.floor(Math.random()*26)] + letters[Math.floor(Math.random()*26)]    
    // let taken = false
    // for (let anon in anons) {
    //   if (anons[anon] == alias) {
    //     taken = true
    //     break;
    //   }        
    // }
    // while (taken == true) {
    // // alias = '' + letters[Math.floor(Math.random()*26)] + letters[Math.floor(Math.random()*26)]
    // taken = false
    // for (let anon in anons) {
    //   if (anons[anon] == alias) {
    //     taken = true
    //     break;
    //   }        
    // }
    // }
    // anons[authorID] = alias
    // if (msg.guild) {
    //   msg.delete(0).then(p => {
    //     anonChan.send(`${anons[authorID]}: ` + content)
    //   })      
    // }
    // else {
    //   anonChan.send(`${anons[authorID]}: ` + content)
    // }
    
    if (aliases.length < anonAdj.length * anonNoun.length || !aliases.length) {
      let alias = anonAdj[Math.floor(Math.random()*anonAdj.length)] + ' ' + anonNoun[Math.floor(Math.random()*anonNoun.length)]
      while (aliases[alias]) {
        alias = anonAdj[Math.floor(Math.random()*anonAdj.length)] + ' ' + anonNoun[Math.floor(Math.random()*anonNoun.length)]
      }
      aliases[alias] = true
      anons[authorID] = alias
      if (msg.guild) {
        msg.delete(0).then(p => {
          anonMsg(authorID, content)
        })      
      }
      else {
        anonMsg(authorID, content)
      }
    }
    else {
      msg.channel.send('Sorry! We\'ve reached max anon capacity!')
    }
  }
}

function anonMsg(id, text) {
  let lastAlias = (anonLast)?anonLast.content.match(/ `.+`/)[0].split('`')[1]:null
  if (anonLast && lastAlias == anons[id]) {
    anonLast.edit(anonLast.content + '\n' + text)
  }
  else {
    anonChan.send(`>>> \`${anons[id]}\`\n${text}`).then(msg => {
      anonLast = msg
    })
  }
}

var trips = {}
var chanColors = {}
var postNum = 0

function chanPost(msg, content) {
  let authorID = `${msg.author.id}`
  let reg = /^[^\n\r ]+\.([a-z]|[A-Z])+( |\n|$)/
  let image = content.match(reg)
  let trip = (trips[authorID]) ? trips[authorID] : 'Anonymous'
  let color = (chanColors[authorID]) ? chanColors[authorID] : '#FDFFB4'
  let output = new Discord.RichEmbed()
  .setColor(color)
  .setTitle(`${trip}   Post:${postNum}`)

  if (image) {
    image = image[0].split(' ')[0] //gets rid of the trailing space, if any
    output.setThumbnail(image)
    content = content.replace(reg, "")
  }
  output.setDescription(content)
  
  chanChan.send(output)
  postNum++

  if (msg.guild) {
    msg.delete(0)
  }

  if (postNum % 10 === 9) {
    // every 10 posts, update postNum on the db
    updatePostNum()
  }
}

async function updatePostNum() {
  con.query(`UPDATE config SET postNum=${postNum} WHERE id=2`)
}

function updateTrip(msg, text) {
  let id = mysql.escape(`${msg.author.id}`)
  let rawText = text
  text = mysql.escape(text)
  con.query(`SELECT * FROM chan WHERE dID = ${id}`, function(err, result) {
    if (err) {
      console.log(err)
      msg.channel.send('Oops! Something went wrong with the database!')
    }
    else if (!result[0]) {
      //first time user
      con.query(`INSERT INTO chan (dID, trip, color) VALUES (${id}, ${text}, "#FDFFB4")`, function(err, result) {
        if (err) {
          console.log(err)
          msg.channel.send('Oops! Something went wrong with the database!')
        }
        else {
          trips[msg.author.id] = rawText
          msg.channel.send(`Tripcode: ${rawText} saved!`)
        }
      })
    }
    else {
      //returning user
      con.query(`UPDATE chan SET trip = ${text} WHERE dID = ${id}`, function(err,result) {
        if (err) {
          console.log(err)
          msg.channel.send('Oops! Something went wrong with the database!')
        }
        else {
          trips[msg.author.id] = rawText
          msg.channel.send(`Tripcode: ${rawText} changed!`)
        }
      })
    }
  })
}

//33-126
function tripHash(pass) {
  pass = pass.split('')
  let j = 0
  let vals = [1,2,3,4,5,6,7,8,9]
  for (let i=0; i<72; i+=2) {
    vals[i%9] *= pass[j%pass.length].charCodeAt(0)
    j++
  }
  for (let i in vals) {
    vals[i] = vals[i] % 92
    vals[i] += 34
    if (vals[i] == 96) vals[i] = 39
  }
  return String.fromCharCode(...vals)
}

function genString() {
  let vals = []
  for (let i=0; i<20; i++) {
    vals[i] = Math.floor((Math.random()*92)+34)
  }
  return String.fromCharCode(...vals)
}

function checkHash(hash) {
  let vals = [1,2,3,4,5,1,2,3,4,5,1,2,3,4,5,1,2,3,4,5]
  let result = 0
  let j = 0
  for (let i=0; i<20; i++) {
    result += hash.charCodeAt(j%hash.length) * vals[i]
    j++
  }
  return (result % 100 < 5)?true:false
}
//142893548134596608
function pullTurnip(msg, suffix) {
  let bonus = true
  if (!suffix) {
    suffix = genString()
    suffix = mysql.escape(suffix)
    bonus = false
  }
  else {
    suffix = mysql.escape(suffix)
    if (suffix.length>20) suffix = suffix.slice(0,20)
  }
  msg.channel.send(`Ok let's pull a Turnip! <:turnipburied:821951002214400011>`).then((reply) => {
    if (!claimedTurnips[suffix] && checkHash(suffix)) {
      //lucky
      let price = config.tprice
      if (bonus) price = Math.ceil(price * 1.5)
      // check if player exists in market using dID, if not add them
      con.query(`Select * from market where dID=${msg.author.id}`, function(err, result) {
        if (err) {
          console.log(err)
          msg.channel.send('Oops! Something went wrong with the database!')
        }
        else if (!result[0]) {
          // add player
          con.query(`INSERT INTO market (dID,bells) VALUES (${msg.author.id},${price})`,updateTurnip(msg,suffix,price,0,0,reply))
        }
        else {
          // returning player
          updateTurnip(msg,suffix,price,result[0].bells,result[0].turnips,reply)
        }
      })
    }
    else {
      //unlucky
      reply.edit(reply.content + `\nSorry, its just a regular Turnip <:turnip:821950942580441098>`)
    }
  })
}

function updateTurnip(msg, suffix, price, bells, turnips, reply) {
  // update player using config.tprice
  // update turnips using suffix
  con.query(`UPDATE market SET bells=${bells+price},turnips=${turnips+1} WHERE dID=${msg.author.id}`,(err,result) => {
    if (err) {
      console.log(err)
      msg.channel.send('Oops! Something went wrong with the database!')
    }
    else {
      con.query(`INSERT INTO turnips (pass) VALUES (${suffix})`, (err,result) => {
        if (err) {
          console.log(err)
          msg.channel.send('Oops! Something went wrong with the database!')
        }
        else {
          claimedTurnips[suffix] = true
          config.tfound++
          con.query(`UPDATE config SET tfound=${config.tfound} WHERE id=2`, (err, result) => {
            if (err) {
              console.log(err)
              msg.channel.send('Oops! Something went wrong with the database!')
            }
            else {
              reply.edit(reply.content + `\nCongratulations, its a lucky Turnip! <:luckyturnip:821950961819844621> \nYou earned ${price} <:bellbag:821950894621851648>`)
            }
          })
        }        
      })
    }
  })
}

function updateColor(msg, color) {
  let id = mysql.escape(`${msg.author.id}`)
  let rawColor = color
  color = mysql.escape(color)
  con.query(`SELECT * FROM chan WHERE dID=${id}`, function(err, result) {
    if (err) {
      console.log(err)
      msg.channel.send('Oops! Something went wrong with the database!')
    }
    else if (!result[0]) {
      // first time user
      con.query(`INSERT INTO chan (dID, trip, color) VALUES (${id},"Anonymous",${color})`, function(err, result) {
        if (err) {
          console.log(err)
          msg.channel.send('Oops! Something went wrong with the database!')
        }
        else {          
          chanColors[msg.author.id] = rawColor
          msg.channel.send(`Color: ${rawColor} saved!`)
        }
      })
    }
    else {
      // returning user
      con.query(`UPDATE chan SET color=${color} WHERE dID = ${id}`, function(err, result) {
        if (err) {
          console.log(err)
          msg.channel.send('Oops! Something went wrong with the database!')
        }
        else {          
          chanColors[msg.author.id] = rawColor
          msg.channel.send(`Color: ${rawColor} changed!`)
        }
      })
    }
  })
}

/*
  MAFIA GAME
    Program Design:
      !active:
        players can opt into the next game (set active=true)
        on the second night of being !active the next game starts (set active=true) 
        when night triggers, !active and date=-1: 
            set date=1
        when night triggers, !active and date=0:
            randomize players' roles
            assign discord roles to players based on their game role
            lock the town_hall channel and begin first night (set day=false)
            set config active=true
      active:
        two phases, night and day (based on day bool)
        a phase lasts 12 hours (9 to 9)
        night:
            lock town_hall channel
            unlock role channels
            players can do role actions (can only do if action==true, after doing action set action=false)
            players can only post in their team's channel and cannot see other channels
        day:
          set date=date+1
          reveal who died (and set alive=false)
          if mafia >= town, mafia wins
          unlock town_hall channel
          lock role channels
          set all protected=false, action=true
          players may vote for a target to hang (set vote=id)
          when day ends, reveal the votes and say who died
          if mafia >= town+neutral and there's no serial killer, mafia wins
          if mafia+sk==0, town wins
      end:
        announce the winners, and everyone's roles
        remove roles from all players
        set all player's active=false
        set config active=false
        set date=-1

    DB Design:
      Players (int id, varchar name, varchar role, int team, bool alive, bool action, int voteID, bool active, bool protected, bool used, bool blackmailed, int vests)
      Config (bool active, bool day, int hour, int date, int server, int town, int mafia, bool mayor)
      Deaths (int id, int date)
      Visits (int id, int otherid, bool violent) record player, target, and violence for each interaction during the night

    Roles:
    Players have 2 discord roles, a Player role (which lets them talk in town_hall) and Role role (which gives them channel access to their hidden channel), roles are colorless and all named the same to hide them
      Villager: No night action
      Investigator: Investigate a person and learn if they are a violence related role (check their role, respond with yes/no)
      Lookout: Watch one person at night (at the end of night, send message to them with a list of any players that matched on Visits table)
      Veteran: Can go on alert (at end of night, kill anyone that matched on Visits table)
      Vigilante: Can kill one player once per game, if they kill Town the vig will die the following night from guilt (set bool used to true)
      Doctor: Protect one person each night (flags them at protected=true)
      Escort: Distracts one person each night, nullifying their action (make a big switch statement of how to reverse actions done by each player)
      Mayor: May reveal self at any time, and bot will confirm. After being revealed their vote counts as 3 (set Config mayor to true and bool used to true)
      Medium: Speak with the dead at night (bot will anonymize messages from the dead in the mediums private channel)
      Retributionist: May revive a dead Town once per game (set bool used to true)

      Godfather: Choose one person to kill each night, if no Mafioso the GF does the killing
      Mafioso: Kill a person the Godfather chooses (do a violent visit)
      Blackmailer: Choose one person to blackmail, they can't talk during the next day (change their Player role to one without send message rights in town_hall)
      Consigliere: Check one person for their exact role each night
      Consort: Distracts one person each night, nullifying their action

      Survivor: May use a bulletproof vest once per night, up to 4 per game, to protect you from attacks (vests-- in db), you win if you survive to the end
      Executioner: You win if the Town lynches your target (chosen randomly on night 1, always Town), become a Jester if your target dies at night
      Jester: You win if the Town lynches you, you may kill one player that voted to lynch you during the following night
      Serial Killer: Kill someone each night, you win if you are the only survivor, if an Escort or Consort distracts you they die instead of your target
*/