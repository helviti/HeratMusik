const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const {
  getTime, deleteMessage,
} = require('./utils.js');

const prefix = '!'
const sPrefix = '?'
let queue = []

class song {
  constructor(url, author, channel, member) {
    this.url = url;
    this.author = author;
    this.channel = channel;
    this.member = member;
  }
}

// ON TEXT CHANNEL
async function TEXT(msg, client) {
  try {
    if (msg.content.startsWith(prefix)) {
      if (!msg.member.voice.channel) {
        msg.reply('You are not in a channel.');
      }
      else {
        const channel = msg.member.voice.channel;
        if(channel == client.voice.channel) {
          queueOrPlay(connection, msg, client);
        }
        else {
          msg.member.voice.channel.join().then(connection => {
            queueOrPlay(connection, msg, client);
          });
        }
      }
    }

    if (msg.content.startsWith(sPrefix)) {

    }

  } catch (err) {
    console.log(err);
  }
}

async function queueOrPlay(connection, message, client) {
  const args = message.content.substring(prefix.length).split(prefix);
  const url = args[0];
  queue.push(new song(url, message.author, message.channel, message.member));
  deleteMessage(message);
  if(queue.length == 1) {
    playSong(connection, client);
  }
  console.log(queue.length);
}

async function playSong(connection, client) {
  const current = queue[0];
  const id = ytdl.getURLVideoID(current.url);
  let info = await ytdl.getInfo(id);
  info = info.videoDetails;

  const stream = ytdl(current.url, { filter: 'audioonly', liveBuffer: 5000 });
  const dispatcher = connection.play(stream);

  client.user.setActivity(info.title, { type: 'LISTENING' });

  let duration = durationString(info.lengthSeconds);
  const videoEmbed = new Discord.MessageEmbed()
    .setTitle(`Now Playing on ${client.user.tag}`)
    .setURL(current.url)
    .setDescription(`**Title:** ${info.title} 
            **Duration:** ${duration}`)
    .setImage(info.thumbnail.thumbnails[3].url)
    .setFooter(`Added to the queue by ${current.member.displayName}`, current.author.avatarURL())

  current.channel.send(videoEmbed);

  dispatcher.on('finish', () => {
    queue.shift();
    if (queue[0]) {
      playSong(connection, client);
    }
    else {
      client.user.setActivity('')
      connection.disconnect();
    }

  })


}

function durationString(sec) {
  let convStr = Math.floor(sec % 60) < 10 ? `0${sec % 60}` : (sec % 60);
  return `${Math.floor(sec / 60)}:${convStr.toString()}`
}


module.exports.startBot = function startBot(token) {
  const client = new Discord.Client();

  client.on('ready', () => {
    console.log(`${getTime()}: Logged in as ${client.user.tag}\n`);
  });

  client.on('message', (msg) => {
    if (msg.channel.type === 'text') { TEXT(msg, client); }
  });

  process.on('unhandledRejection', (error) => {
    console.error(`${getTime()}: Unhandled promise rejection:`, error);
  });

  client.login(token);
}

