const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const {
  getTime, deleteMessage,
} = require('./utils.js');

const prefix = '!'
const sPrefix = '?'
let queue = []

class song {
  constructor(url, author) {
    this.url = url;
    this.author = author;
  }
}

// ON TEXT CHANNEL
async function TEXT(msg, client) {
  try {
    if (msg.content.startsWith(prefix)) {
      if (!msg.member.voice.channel) {
        msg.reply('You are not in a channel.');
        console.log(msg.member.voice.channel);
      }
      if (!msg.member.voice.connection) {
        console.log(msg.member.voice.channel);
        msg.member.voice.channel.join().then(connection => {
          console.log('new');
          playSong(connection, msg, client);
        }
        );
      }
    }

    if (msg.content.startsWith(sPrefix)) {

    }

  } catch (err) {
    console.log(err);
  }
}

async function playSong(connection, message, client) {
  let args = message.content.substring(prefix.length).split(prefix);
  let id = ytdl.getURLVideoID(args[0]);
  let info = await ytdl.getInfo(id);
  info = info.videoDetails;

  queue.push(new song(id, message.member.displayName));
  console.log(queue);

  const stream = ytdl(queue[0].url, { filter: 'audioonly', liveBuffer: 5000 });
  const dispatcher = connection.play(stream);

  client.user.setActivity(info.title, { type: 'LISTENING' });
  deleteMessage(message);

  let duration = durationString(info.lengthSeconds);
  const videoEmbed = new Discord.MessageEmbed()
    .setTitle(`Now Playing on ${client.user.tag}`)
    .setURL(args[0])
    .setDescription(`**Title:** ${info.title} 
            **Duration:** ${duration}`)
    .setImage(info.thumbnail.thumbnails[3].url)
    .setFooter(`Added to the queue by ${queue[0].author}`, message.author.avatarURL())

  message.channel.send(videoEmbed);

  queue.shift();

  dispatcher.on('finish', () => {
    if (queue[0]) {
      playSong(connection, message, client);
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

