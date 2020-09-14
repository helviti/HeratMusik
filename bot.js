const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const ytlist = require('youtube-playlist');
const search = require('youtube-search');
const axios = require('axios');

const {
  getTime, deleteMessage,
} = require('./utils.js');

class SearchData {
  constructor(msg, results, member) {
    this.msg = msg;
    this.results = results;
    this.member = member;
  }
}

const prefix = '!'
const sPrefix = '?'
const w2gPrefix = '>'
const searchData = new SearchData(null, null, null);
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
      if (command.startsWith(`${prefix}queue`)) {
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
    } else if (command.match(/^[1-9][0-9]?$/) &&
      searchData.msg != null &&
      searchData.member.id == msg.member.id &&
      searchData.msg.channel.id == msg.channel.id) {
      respondToSearch(parseInt(command) - 1, msg, client);
    } else if ((match = command.match(new RegExp(`^\\${sPrefix}(.+ *)+`)))) {
      searchyoutube(match[1], msg);
    } else if (command.startsWith(w2gPrefix)) {
      w2gRoomCreate(msg);
      deleteMessage(msg);
    }

  } catch (err) {
    console.log(err);
  }
}

function skip(channel) {
  if (queue.length > 0 && channel) {
    channel.join().then(connection => {
      if (queue.length > 0) {
        queue.shift();
        if (queue.length > 0) {
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

function searchyoutube(key, msg) {
  if (searchData.msg != null) {
    deleteMessage(searchData.msg);
    searchData.msg = null;
  }
  searchData.member = msg.member;
  search(key, { maxResults: 10, key: process.env.YOUTUBE_API_KEY, type: 'video' }, function (err, results) {
    if (err) return console.log(err);
    searchData.results = results;
    let msgText = `**Search results for ${key}:**`;
    for (let i = 0; i < results.length; i++) {
      const element = results[i];
      msgText += `\n**${i + 1}:** ${element.title} **by** ${element.channelTitle}`
    }
    msg.reply(msgText).then(newMsg => searchData.msg = newMsg);
    deleteMessage(msg);
  });
}

function respondToSearch(response, msg, client) {
  if (response >= searchData.results.length || response < 0) return;
  if (searchData.msg != null) {
    deleteMessage(searchData.msg);
    searchData.msg = null;
  }
  if (!msg.member.voice.channel) {
    msg.reply('You are not in a channel.');
  }
  else {
    const channel = msg.member.voice.channel;
    channel.join().then(connection => {
      msg.content = `${prefix}${searchData.results[response].link}`
      queueOrPlay(connection, msg, client);
    });
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
    if (willPlay) {
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
  switch (type) {
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

async function w2gRoomCreate(msg) {
  const embed = new Discord.MessageEmbed();
  const url = message.content.substring(w2gPrefix.length).split(w2gPrefix)[0];
  const response = await axios.post('https://w2g.tv/rooms/create.json', {
    "w2g_api_key": process.env.W2G_API_KEY,
    "share": url
  })
  const roomKey = response.streamkey;
  const roomURL = `http://w2g.tv/rooms/${roomKey}`;
  embed.setTitle(`WatchTogether Room: ${roomURL}`)
    .setThumbnail('https://w2g.tv/static/watch2gether-share.jpg')
    .setFooter(`Created by ${msg.member.displayName}`, msg.author.avatarURL())
    .setURL(roomURL)
    .setColor('#D1A427');
  msg.channel.send(embed);
}

function sendQueue(channel) {
  if (queue.length == 0) return;
  let msg = '**Current Queue:**\n';
  for (let i = 0; i < queue.length; i++) {
    const song = queue[i];
    let entry = '';
    if (i == 0) entry += '**NP:**'
    else entry += `**${i}:**`
    entry += `\'${song.details.title}\' added by **${song.member.displayName}**`;
    if (i < queue.length - 1) {
      entry += '\n';
    }

    if (entry.length + msg.length > 2000) {
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

