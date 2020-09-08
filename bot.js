const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const ytlist = require('youtube-playlist'); 

const {
  getTime, deleteMessage,
} = require('./utils.js');

const prefix = '!'
const sPrefix = '?'
let queue = []
let volume = 1.0;
let dispatcher = null;

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
    let match;
    if (command.startsWith(prefix)) {
      if(command.startsWith(`${prefix}queue`)) {
        sendQueue(msg.channel);
        deleteMessage(msg);
      } else if (command.startsWith(`${prefix}skip`)) {
        skip(msg.member.voice.channel);
        deleteMessage(msg);
      } else if (command.startsWith(`${prefix}clearplaylist`)) {
        clear(msg.member.voice.channel);
        deleteMessage(msg);
      } else if ((match = command.match(new RegExp(`${prefix}volume ([0-9]+\.?[0-9]*)`)))) {
        setVolume(parseFloat(match[1], msg.member.voice.channel));
        deleteMessage(msg);
      } else if (command.startsWith(`${prefix}http`)) {
        if (!msg.member.voice.channel) {
          msg.reply('You are not in a channel.');
        }
        else {
          const channel = msg.member.voice.channel;
          channel.join().then(connection => {
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

function skip(channel) {
  if(queue.length > 0 && channel) {
    channel.join().then(connection => {
      if (queue.length > 0) {
        queue.shift();
        if(queue.length > 0) {
          playSong(connection, connection.client);
        }
        else {
          connection.disconnect();
        }
      }
    });
  }
}

function clear(channel) {
  if (queue.length > 0 && channel) {          
    channel.join().then(connection => {
      queue = [];
      connection.disconnect();
    });
  }
}

function setVolume(newVolume) {
  volume = newVolume;
  if (queue.length > 0 && dispatcher) {
    dispatcher.setVolume(newVolume);
  }
}

async function queueOrPlay(connection, message, client) {
  const urlRaw = message.content.substring(prefix.length).split(prefix)[0];
  if (urlRaw.includes('.com/playlist?list=')) {
    const res = await ytlist(urlRaw, 'url');
    const playlist = res.data.playlist;
    for (let i = 0; i < playlist.length; i++) {
      try {
        await processUrl(playlist[i], true);
      } catch (err) {
        console.log(err);
      }
    }

    message.reply('Queued the playlist!');
    deleteMessage(message);
  }
  else {
    processUrl(urlRaw, false);
    deleteMessage(message);
  }

  async function processUrl(url, isSilent) {
    let info = await ytdl.getInfo(ytdl.getURLVideoID(url));
    info = info.videoDetails;
    const willPlay = queue.length == 0;
    const song = new Song(url, info, message.author, message.channel, message.member);
    queue.push(song);
    if(willPlay) {
      playSong(connection, client);
    }
    else if (!isSilent) {
      sendVideoInfoMessage(videoMessage.QUEUED, song, client);
    }
  }
}

async function playSong(connection, client) {
  const current = queue[0];

  const stream = ytdl(current.url, { filter: 'audioonly', liveBuffer: 5000 });
  dispatcher = connection.play(stream, { volume: volume });

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
  if(queue.length == 0) return;
  let msg = '**Current Queue:**\n';
  for (let i = 0; i < queue.length; i++) {
    const song = queue[i];
    let entry = '';
    if (i == 0) entry += '**NP:**'
    else entry += `**${i}:**`
    entry += `\'${song.details.title}\' added by **${song.member.displayName}**`;
    if(i < queue.length - 1) {
      entry += '\n';
    }
    
    if(entry.length + msg.length > 2000) {
      channel.send(msg);
      msg = entry;
    }
    else {
      msg += entry;
    }
  }

  channel.send(msg);
}

function durationString(sec) {
  let convStr = Math.floor(sec % 60) < 10 ? `0${sec % 60}` : (sec % 60);
  return `${Math.floor(sec / 60)}:${convStr.toString()}`
}


module.exports.startMusikBot = function startMusikBot(token) {
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

