const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const {
  getTime, deleteMessage,
} = require('./utils.js');

const prefix = '!'
const sPrefix = '?'
let queue = []

// ON TEXT CHANNEL

async function TEXT(msg, client) {
  try {

    if (msg.content.startsWith(prefix)) {
      const voiceChannel = msg.member.voice.channel;
      if (!voiceChannel) {
        msg.reply('You are not in a channel.');
      }
      else {
        let args = msg.content.substring(prefix.length).split(prefix);

        try {

          let id = ytdl.getURLVideoID(args[0])
          let info = await ytdl.getInfo(id);
          let duration = `${Math.floor(info.videoDetails.lengthSeconds / 60)}:${info.videoDetails.lengthSeconds % 60}`

          const videoEmbed = new Discord.MessageEmbed()
            .setTitle(`${info.videoDetails.title} [${duration}]`)
            .setURL(args[0])
            .setDescription(`Added to the queue by ${msg.member.displayName}`)
            .setThumbnail(info.videoDetails.thumbnail.thumbnails[3].url)

          msg.channel.send(videoEmbed);

          voiceChannel.join().then(connection => {
            const stream = ytdl(id, { filter: 'audioonly', liveBuffer: 5000 });
            const dispatcher = connection.play(stream);

            client.user.setActivity(info.videoDetails.title, { type: 'LISTENING' });

            dispatcher.on('finish', () => {
              client.user.setActivity('')
              voiceChannel.leave()
            })

          });
        }
        catch (err) {
          msg.channel.send(`Video id '${args[0]}' not found.`)
          console.log(err)
        }
        deleteMessage(msg);

      }
    }

    if (msg.content.startsWith(sPrefix)) {

    }

  } catch (err) {
    console.log(err);
  }
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
