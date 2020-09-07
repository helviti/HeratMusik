const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const {
  getTime, deleteMessage,
} = require('./utils.js');


const prefix = '!'
const sPrefix = '?'

// ON TEXT CHANNEL

async function TEXT(msg) {
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

          const exampleEmbed = new Discord.MessageEmbed()
            .setTitle(info.videoDetails.title)
            .setURL(args[0])
            .setDescription(`Added to the queue by ${msg.member.displayName}`)
            .setThumbnail(info.videoDetails.thumbnail.thumbnails[0].url)

          msg.channel.send(exampleEmbed);




          //msg.channel.send(`:arrow_forward: Playing now: [${}](${args[0]}) [${duration}] `)


          console.log(info.videoDetails.thumbnail)

          voiceChannel.join().then(connection => {
            const stream = ytdl(id, { filter: 'audioonly', liveBuffer: 5000 });
            const dispatcher = connection.play(stream);

            dispatcher.on('finish', () => voiceChannel.leave());
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
    if (msg.channel.type === 'text') { TEXT(msg); }
  });

  process.on('unhandledRejection', (error) => {
    console.error(`${getTime()}: Unhandled promise rejection:`, error);
  });

  client.login(token);
}
