const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const {
  getTime, deleteMessage,
} = require('./utils.js');

const prefix = '!'
const sPrefix = '?'
let queue = []

class Song {
  constructor(url, details, author, channel, member) {
    this.url = url;
    this.author = author;
    this.channel = channel;
    this.member = member;
    this.details = details;
  }
}

const videoMessage = {
  QUEUED: 0,
  NOWPLAYING: 1
};

// ON TEXT CHANNEL
async function TEXT(msg, client) {
  try {
    const command = msg.content;
    if (command.startsWith(prefix)) {
      if(command.startsWith(`${prefix}queue`)) {

      }
      else {
        if (!msg.member.voice.channel) {
          msg.reply('You are not in a channel.');
        }
        else {
          const channel = msg.member.voice.channel;
          if(channel == client.voice.channel) {
            queueOrPlay(connection, msg, client);
          }
          else {
            channel.join().then(connection => {
              queueOrPlay(connection, msg, client);
            });
          }
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
  let info = await ytdl.getInfo(ytdl.getURLVideoID(url));
  info = info.videoDetails;
  const willPlay = queue.length == 0;
  const song = new Song(url, info, message.author, message.channel, message.member);
  queue.push(song);
  if(willPlay) {
    playSong(connection, client);
  }
  else {
    sendVideoInfoMessage(videoMessage.QUEUED, song, client);
  }
  deleteMessage(message);
}

async function playSong(connection, client) {
  const current = queue[0];

  const stream = ytdl(current.url, { filter: 'audioonly', liveBuffer: 5000 });
  const dispatcher = connection.play(stream);

  client.user.setActivity(current.details.title, { type: 'LISTENING' });

  sendVideoInfoMessage(videoMessage.NOWPLAYING, current, client);

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

function sendVideoInfoMessage(type, song, client) {  
  const embed = new Discord.MessageEmbed()
  const thumbnail = song.details.thumbnail.thumbnails[3].url;
  switch(type) {
    case videoMessage.QUEUED:
      embed.setThumbnail(thumbnail).setTitle(`Queued on ${client.user.tag}`);
      break;
    case videoMessage.NOWPLAYING:
      embed.setImage(thumbnail).setTitle(`Now Playing on ${client.user.tag}`);
      break;
  };
  embed.setURL(song.url)
    .setDescription(`**Title:** ${song.details.title} 
      **Duration:** ${durationString(song.details.lengthSeconds)}`)
    .setFooter(`Added to the queue by ${song.member.displayName}`, song.author.avatarURL());
  song.channel.send(embed);
}

function sendQueue(channel) {
  
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

