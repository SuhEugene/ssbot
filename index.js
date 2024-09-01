const {
  escapeMarkdown,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  Client,
  GatewayIntentBits,
  Interaction
} = require('discord.js');
const { roles, changelogChannel } = require('./config.json');
const express = require('express');
const cproc = require('child_process');
const byondFetch = require('byond-fetch');
const path = require('path');
const fs = require('node:fs');
const plugger = require('./plugger');
const { getRandomFurryPost, sanitizeTags } = require('./e621');

require('dotenv').config();

let pats = {};

const http = require('http');
const WebSocket = require('ws');

console.log('\n--- Script started', Date.now(), '---\n');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers /*, GatewayIntentBits.DirectMessages*/
  ]
});

/*webhookClient.send({
		content: 'Webhook test',
		username: 'some-username',
		avatarURL: 'https://i.imgur.com/AfFp7pu.png',
		embeds: [embed],
});*/

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const emojTypes = {
  tweak: '<:pepePants:961908545736036402>',
  feat: '<:pepePants:961908545736036402>',
  add: '<:pepeCoffe:967184121149407312>',
  del: '<:BFG:961734689306066974>',
  fix: '<:pepeMinecraft:924658692853493830>',
  bug: '<:pepeMinecraft:924658692853493830>'
};

app.use(express.json());
app.post('/hookd', async (req, res) => {
  const { ref, commits, sender } = req.body;
  if (!ref.endsWith('local')) return;
  const embed = new EmbedBuilder()
    .setTitle(`Ченджлох`)
    .setDescription(
      commits
        .map(c => {
          const url = `\[[**${c.id.slice(0, 7)}**](${c.url})\]`;
          const [type, ...msg] = c.message.split('\n')[0].split(':');
          return (
            `${url} ${emojTypes[type.toLowerCase()] || type} ${msg.join(':')}` +
            ` - ${c.author.name}`
          );
        })
        .join('\n')
    )
    .setColor('#A7A7A7');
  res.send();
  await (await client.channels.fetch(changelogChannel)).send({ embeds: [embed] });
});

const wsResponse = {};
let socks = [];
wss.on('connection', sock => {
  sock.isAlive = true;
  sock.reg = null;
  sock.on('pong', () => {
    sock.isAlive = true;
  });
  sock.on('message', async msg => {
    let data = String(msg);
    try {
      data = JSON.parse(data);
    } catch (e) {}

    console.log('Received data', data);
    if (!data.id) return;
    if (data.type == 'reg') {
      const oldSock = socks.find(s => s.id == data.id);
      if (oldSock) oldSock.instance.terminate();

      socks = socks.filter(s => s.id != data.id);
      sock.reg = data.id;
      console.log('Registered sock', data.id);
      return socks.push({ id: data.id, instance: sock });
    }
    if (!sock.reg) return console.log('Unregistered sock connection detected:', sock.reg, sock);
    if (data.type == 'response') {
      console.log('Written to wsReponse', data.data);
      wsResponse[data.id] = data.data;
      return;
    }
    if (data.type == 'dead') {
      const ch = await client.channels.fetch('926887441665777714');
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('Ded')
            .setColor('DarkRed')
            .setDescription(
              `Сервер ${serverEmojis[data.id]} ` +
                `**${serverNames[data.id]}** помер ` +
                `<:sadge:967184409495224390>`
            )
        ]
      });
    }
  });
});

const interval = setInterval(function ping() {
  wss.clients.forEach(sock => {
    if (sock.isAlive === false) {
      console.log('Terminated connection', sock.reg);
      socks = socks.filter(s => s.id != sock.reg);
      return sock.terminate();
    }

    sock.isAlive = false;
    sock.ping();
  });
}, 5000);

wss.on('close', function close() {
  clearInterval(interval);
});

const wait = secs => new Promise(send => setTimeout(send, secs * 1000));

async function waitForSockResponse(sockId, iter = 0) {
  console.log('Waiting for', sockId, 'response, iter:', iter, 'response:', wsResponse[sockId]);
  if (iter == 30) return { error: true, msg: 'Сервер не ответил' };
  const response = wsResponse[sockId];
  if (wsResponse[sockId]) {
    wsResponse[sockId] = null;
    console.log('Next reponse is', response);
    try {
      return JSON.parse(response);
    } catch (e) {
      return response;
    }
  }
  await wait(1);
  return await waitForSockResponse(sockId, iter + 1);
}

async function sendSockServerCommand(sockId, command) {
  console.log('Need to send', command, 'command to', sockId);
  console.log('I have', socks.length, 'socks');
  const sock = socks.find(s => s.id == sockId);
  if (!sock) return { error: true, msg: 'Сервер ded окончательно' };
  sock.instance.send(command);
  console.log('Sent', command, 'command to', sockId);
  return { error: false };
}

const bayCon = {}; /*mysql.createConnection({
  host: "localhost",
  user: "admin",
  password: "vewyhawd",
	database: "sbay"
});*/
bayCon.isConnected = false;
const doBayQuery = query =>
  new Promise((resolve, reject) =>
    bayCon.query(query, (err, data, fields) =>
      err ? reject({ err, data, fields }) : resolve({ err, data, fields })
    )
  );

function bayConPromise() {
  return new Promise((resolve, reject) => {
    // bayCon.connect(e => e ? reject(e) : resolve(e))
    resolve();
  });
}

async function connectToBay() {
  if (bayCon.isConnected) return true;
  console.log('Trying to connect to bay station');
  try {
    await bayConPromise();
    console.log('Connected to bay station');
    bayCon.isConnected = true;
  } catch (e) {
    console.error("Couldn't connect to bay station");
    console.error(e);
  }
  return bayCon.isConnected;
}

client.on('ready', async () => {
  console.log('Logged in as', client.user.username);
  server.listen(8062, () => console.log('Listening *:8062', new Date()));
  connectToBay();
	require('./servePlugs.js');
});

client.on('guildMemberRemove', async mbr => {
  console.log(mbr.id, 'LEFT');
  (await client.channels.fetch('968191076252917831')).send(
    `Нас покинул <@!${mbr.user.id}> - ${mbr.user.username}` +
      (mbr.nickname ? ` (${mbr.nicname})` : '')
  );
});

let replacements = {
  г: 'к',
  д: 'т',
  з: 'ц',
  р: 'ррр',
  Г: 'К',
  Д: 'Т',
  З: 'Ц',
  Р: 'Ррр'
};

async function hiss(msg) {
  if (msg.author.bot) return;
  if (!msg.content.startsWith('!') || msg.content.length < 2) return;
  if (msg.content.includes('http')) return;
  let text = msg.content.slice(1).replaceAll('@', '');
  for (let repl in replacements) {
    text = text.replaceAll(repl, replacements[repl]);
  }
  await msg.channel.send(text);
}

client.on('messageCreate', async msg => {
  // "Идёт" gif
  if (msg.content.includes('1169587906755694604')) return await msg.delete();
  // "Post this rat" gif
  if (msg.content.includes('993919553396543528')) return await msg.delete();

  if (msg.channel.id == '1068691001566314678') return hiss(msg);
  let args = msg.content.split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd == '!check') {
    const id = args[0];
    const m = await msg.channel.messages.fetch(id);
    msg.reply(`\`\`\`\n${m.content}\n\`\`\``);
  }
  if (cmd == '!emojis') {
    console.log('Got emojis request');
    const emojis = (await msg.guild.emojis.fetch()).toJSON();
    let i = 0;
    const elist = [];
    for (const emoji of emojis) {
      if (!(i++ % 30)) {
        await msg.channel.send('```\n' + elist.join(',\n') + '\n```');
        elist.length = 0;
      }
      elist.push(`"${emoji.name.toLowerCase()}" = "${emoji.id}.${emoji.animated ? 'gif' : 'png'}"`);
      console.log(elist[elist.length - 1]);
    }
    if (elist.length) await msg.channel.send('```\n' + elist.join(',\n') + '\n```');
  }
  if (cmd == '!pats') {
    if (msg.author.id != '706124306660458507') return await msg.react('❌');
    try {
      pats = JSON.parse(fs.readFileSync('./pats.json')) || {};
    } catch (e) {
      console.log(e, new Date());
      return await msg.react('❌');
    }
    let nnn = [];
    for (let usr in pats) nnn.push(`<@!${usr}> - ✅`);

    await msg.reply({ content: nnn.join('\n'), allowedMentions: { parse: [] } });
    return;
  }
  const inlineRolls = ['ролл', 'роляю', 'кидаю'];
  if ([...inlineRolls, '!roll'].includes(cmd)) {
    const n = Math.floor(Number(args[0]));
    if (!n || n <= 1) {
      if (!inlineRolls.includes(cmd)) await msg.reply('Вам выпало: **по ебалу**');
      return;
    }
    await msg.reply(`Число от 1 до ${n}: **${Math.ceil(Math.random() * n)}**`);
  }
  if (cmd == '!pat') {
    if (
      msg.author.id != '706124306660458507' &&
      msg.author.id != '449288145574428673' &&
      msg.author.id != '333588597234073601'
    )
      return await msg.react('❌');
    try {
      pats = JSON.parse(fs.readFileSync('./pats.json')) || {};
    } catch (e) {
      console.log(e, new Date());
      return await msg.react('❌');
    }
    const id = args[0];
    const pat = args[1];
    pats[id] = pat;
    if (!id || !pat || !pats[id]) return await msg.react('❌');
    try {
      fs.writeFileSync('./pats.json', JSON.stringify(pats, null, 2));
      await msg.react('✅');
    } catch (e) {
      console.log(e, new Date());
      await msg.react('❌');
    }
  }
  if (msg.channel.id == '997111496880427079') {
    if (msg.type == 'DEFAULT') {
      await msg.react('👍');
      await msg.react('👎');
    } else if (msg.type == 'THREAD_STARTER_MESSAGE') {
      await msg.delete();
    }
    return;
  }
});

function execScript(script) {
  return new Promise((resolve, reject) => {
    cproc.exec(script, (error, stdout, stderr) => {
      if (error) return reject({ error, stdout, stderr });
      resolve({ error, stdout, stderr });
    });
  });
}

let isBuilding = false;
async function buildPara(interaction, embed) {
  if (isBuilding) {
    embed.setColor('Red').setTitle('<:achE:974586173307641857> Я и так билжу');
    await interaction.editReply({ embeds: [embed] });
    return;
  }
  isBuilding = true;
  embed.setTitle('<a:andance:983035371900260422> Билдим...').setColor('Greyple');
  // interaction.editReply({ content: "<a:andance:983035371900260422> Билдим..." });
  await interaction.editReply({ embeds: [embed] });
  execScript(`./buildpara.sh`)
    .then(async r => {
      let errors = r.stdout.match(/(\d) errors, (\d) warnings/);
      embed
        .setColor('Blurple')
        .setTitle('<:kokomi:990458395981144074> Успешно сбилжено')
        .setDescription(`Ошибки: ${errors[1]}, Предупреждения: ${errors[2]}`);
      //  .setDescription(output);
      await interaction.editReply({ embeds: [embed] });
    })
    .catch(async e => {
      let output = `**Код ошибки:** ${e.error ? e.error.code : e.code || '???'}`;
      output += '\n**stdout:** ' + (e.stdout ? '```' + e.stdout.slice(0, 1024) + '```' : 'Пуст');
      output += '\n**stderr:** ' + (e.stderr ? '```' + e.stderr.slice(0, 1024) + '```' : 'Пуст');
      embed
        .setColor('DarkRed')
        .setTitle('<:KannaKms:873199424032092200> Ошибка')
        .setDescription(output);
      await interaction.editReply({ embeds: [embed] });
    })
    .finally(() => {
      isBuilding = false;
    });
}

let isPulling = false;
async function pullPara(interaction, embed) {
  if (isPulling) {
    embed.setColor('Red').setTitle('<:achE:974586173307641857> Я и так пуллю');
    await interaction.editReply({ embeds: [embed] });
    return;
  }
  isPulling = true;
  embed.setTitle('<a:andance:983035371900260422> Пуллим...').setColor('Greyple');
  await interaction.editReply({ embeds: [embed] });
  execScript(`./pullpara.sh`)
    .then(async r => {
      embed.setColor('Blurple').setTitle('<:kokomi:990458395981144074> Успешный пулл');
      await interaction.editReply({ embeds: [embed] });
    })
    .catch(async e => {
      console.log(e);
      let output = `**Код ошибки:** ${e.error.code}`;
      output += '\n**stdout:** ' + (e.stdout ? '```' + e.stdout.slice(0, 1024) + '```' : 'Пуст');
      output += '\n**stderr:** ' + (e.stderr ? '```' + e.stderr.slice(0, 1024) + '```' : 'Пуст');
      embed
        .setColor('DarkRed')
        .setTitle('<:KannaKms:873199424032092200> Ошибка')
        .setDescription(output);
      await interaction.editReply({ embeds: [embed] });
    })
    .finally(() => {
      isPulling = false;
    });
}

let isResetting = false;
async function resetPara(interaction, embed) {
  if (isResetting) {
    embed.setColor('Red').setTitle('<:achE:974586173307641857> Я и так ресетаю');
    await interaction.editReply({ embeds: [embed] });
    return;
  }
  isResetting = true;
  embed.setTitle('<a:andance:983035371900260422> Ресеттим...').setColor('Greyple');
  await interaction.editReply({ embeds: [embed] });
  execScript(`./resetpara.sh`)
    .then(async r => {
      embed.setColor('Blurple').setTitle('<:kokomi:990458395981144074> Успешный ресет');
      await interaction.editReply({ embeds: [embed] });
    })
    .catch(async e => {
      console.log(e);
      let output = `**Код ошибки:** ${e.error.code}`;
      output += '\n**stdout:** ' + (e.stdout ? '```' + e.stdout.slice(0, 1024) + '```' : 'Пуст');
      output += '\n**stderr:** ' + (e.stderr ? '```' + e.stderr.slice(0, 1024) + '```' : 'Пуст');
      embed
        .setColor('DarkRed')
        .setTitle('<:KannaKms:873199424032092200> Ошибка')
        .setDescription(output);
      await interaction.editReply({ embeds: [embed] });
    })
    .finally(() => {
      isResetting = false;
    });
}

function checkCkey(ckey) {
  return /^[a-zA-Z0-9_ ]{3,32}$/.test(ckey);
}

function paramsToObject(params, lower = true) {
  const result = {};
  const arr = params.split('&');
  for (const pair of arr) {
    const [key, val] = pair.split('=');
    result[lower ? key.toLowerCase() : key] = val;
  }
  return result;
}

const ALL_RACES = {
  resomi: 'Резоми',
  adherent: 'Адхерант',
  vox: 'Вокс',
  'vox armalis': 'Вокс Армалис',
  'kharmaan gyne': 'Восхождение милфа',
  'kharmaan alate': 'Восхождение симп',
  diona: 'Диона',
  skrell: 'Скрелл',
  tajara: 'Таяра',
  machine: 'КПБшка',
  'full body prosthesis': 'ППТшка',
  'giant armoured serpentid': 'ГБСик',
  unathi: 'Унати'
};

async function getPlayerDataByDiscord(discordId) {
  if (!(await connectToBay())) return { err: 'Невозможно подключиться к базе данных BayStation' };

  const { err, data: users } = await doBayQuery(
    `SELECT * FROM erro_player WHERE discord_id="${discordId}"`
  );
  if (err) return { err: 'Ошибка запроса к базе данных' };

  if (!users.length) return { ckey: false };
  return { ...users[0] };
}

async function ckeyByDiscord(discordId, interaction, embed) {
  const data = await getPlayerDataByDiscord(discordId);
  const { err, ckey } = data;
  if (err) {
    interaction.editReply({
      embeds: [
        embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
      ]
    });
    return false;
  }
  if (!ckey) {
    interaction.editReply({
      embeds: [
        embed
          .setTitle('Ошибка')
          .setColor('Red')
          .setDescription(
            'Дискорд аккаунт не привязан\nДля привязки ' +
              'зайдите на сервер, откройте вкладку `Special ' +
              'verbs`, нажмите `Привязка Discord` и следуйте' +
              ' дальнейшим инструкциям'
          )
      ]
    });
    return false;
  }
  return ckey;
}

function dataToExp(data) {
  const h = m => Math.round((Number(m) / 60) * 10) / 10;

  const text = [];
  text.push(`**Всего:** ${h(Number(data.ghost) + Number(data.living))}ч`);
  text.push(`- Призрак: ${h(data.ghost)}ч`);
  text.push(`- Живым: ${h(data.living)}ч`);
  text.push(`**Экипаж:** ${h(data.crew)}ч`);
  text.push(`- Командование: ${h(data.command)}ч`);
  text.push(`- Инженерия: ${h(data.engineering)}ч`);
  text.push(`- Медицина: ${h(data.medical)}ч`);
  text.push(`- Наука: ${h(data.science)}ч`);
  text.push(`- Карго: ${h(data.supply)}ч`);
  text.push(`- Сервис: ${h(data.service)}ч`);
  text.push(`- Исследование: ${h(data.exploration)}ч`);
  text.push(`- Служба безопасности: ${h(data.security)}ч`);
  text.push(`- Силиконы: ${h(data.silicon)}ч`);
  text.push(`- Цивилиан: ${h(data.civilian)}ч`);
  text.push(`- Авейки: ${h(data.submap)}ч`);
  text.push(`- Спец. роли: ${h(data.special)}ч`);

  return text.join('\n');
}

async function bayPlayerData(interaction, embed) {
  const discordId = (interaction.options.getUser('игрок') || interaction.user).id;
  const ckey = await ckeyByDiscord(discordId, interaction, embed);
  if (!ckey) return;

  if (!(await connectToBay()))
    return interaction.editReply({
      embeds: [
        embed
          .setTitle('Ошибка')
          .setColor('Red')
          .setDescription('Невозможно подключиться к базе данных BayStation')
      ]
    });

  const playerData = await getPlayerDataByDiscord(discordId);
  if (!playerData.ckey)
    return interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription('Игрок не найден')]
    });

  const { err, data: players } = await doBayQuery(`SELECT * FROM whitelist WHERE ckey="${ckey}"`);
  if (err)
    return interaction.editReply({
      embeds: [
        embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
      ]
    });
  const races = players.map(p => '- ' + ALL_RACES[p.race] || '`' + p.race + '`');

  const exp = paramsToObject(playerData.exp);
  const spexp = paramsToObject(playerData.species_exp);

  return interaction.editReply({
    embeds: [
      embed
        .setTitle('Информация об игроке')
        .setColor('Blurple')
        .setDescription(`Сикей: \`${playerData.ckey}\``)
        .addFields(
          { name: 'Время игры', value: dataToExp(exp), inline: true },
          { name: 'Вайтлист расы', value: races.join('\n') || 'Отсутствуют', inline: true }
        )
    ]
  });
}

async function bayWhiteListToggle(interaction, embed) {
  const discordId = interaction.options.getUser('игрок').id;
  const race = interaction.options.getString('раса').toLowerCase();

  if (!ALL_RACES[race])
    return interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription('Раса не существует')]
    });

  if (!(await connectToBay()))
    return interaction.editReply({
      embeds: [
        embed
          .setTitle('Ошибка')
          .setColor('Red')
          .setDescription('Невозможно подключиться к базе данных BayStation')
      ]
    });

  const ckey = await ckeyByDiscord(discordId, interaction, embed);
  if (!ckey) return;

  const { err: err1, data: players } = await doBayQuery(
    `SELECT * FROM whitelist WHERE ckey="${ckey}" AND race="${race}"`
  );
  if (err1)
    return interaction.editReply({
      embeds: [
        embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
      ]
    });
  if (players.length) {
    const { err: err2 } = await doBayQuery(
      `DELETE FROM whitelist WHERE ckey="${ckey}" AND race="${race}"`
    );
    if (err2)
      return interaction.editReply({
        embeds: [
          embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
        ]
      });
    await interaction.editReply({
      embeds: [
        embed
          .setTitle(':x: Успешно удалено')
          .setColor('DarkRed')
          .setDescription(
            `Игрок \`${ckey}\` успешно удалён из вайтлиста расы **${
              ALL_RACES[race] || '`' + race + '`'
            }**`
          )
      ]
    });
  } else {
    const { err: err2 } = await doBayQuery(
      `INSERT INTO whitelist (ckey, race) VALUES ("${ckey}", "${race}")`
    );
    if (err2)
      return interaction.editReply({
        embeds: [
          embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
        ]
      });
    await interaction.editReply({
      embeds: [
        embed
          .setTitle(':white_check_mark: Успешно добавлено')
          .setColor('DarkGreen')
          .setDescription(
            `Игрок \`${ckey}\` успешно добавлен в вайтлист расы **${
              ALL_RACES[race] || '`' + race + '`'
            }**`
          )
      ]
    });
  }
}

async function bayAdminToggle(interaction, embed) {
  const discordId = interaction.options.getUser('игрок').toLowerCase();
  const roleName = interaction.options.getString('роль').toLowerCase();

  const ckey = await ckeyByDiscord(discordId, interaction, embed);
  if (!ckey) return;

  const role = ADMIN_ROLES.find(r => r.value == roleName);
  if (!role && roleName != 'demote')
    return interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription('Роль не существует')]
    });

  if (!(await connectToBay()))
    return interaction.editReply({
      embeds: [
        embed
          .setTitle('Ошибка')
          .setColor('Red')
          .setDescription('Невозможно подключиться к базе данных BayStation')
      ]
    });

  const { err, data: players } = await doBayQuery(`SELECT * FROM erro_admin WHERE ckey="${ckey}"`);
  if (err)
    return interaction.editReply({
      embeds: [
        embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
      ]
    });
  if (players.length) {
    if (roleName == 'demote') {
      const { err: err2 } = await doBayQuery(
        `DELETE FROM whitelist WHERE ckey="${ckey}" AND race="${race}"`
      );
      if (err2)
        return interaction.editReply({
          embeds: [
            embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
          ]
        });
      await interaction.editReply({
        embeds: [
          embed
            .setTitle(':x: Успешно удалено')
            .setColor('DarkRed')
            .setDescription(
              `Игрок \`${ckey}\` успешно удалён из вайтлиста расы **${
                ALL_RACES[race] || '`' + race + '`'
              }**`
            )
        ]
      });
    } else {
      const { err: err2 } = await doBayQuery(
        `DELETE FROM whitelist WHERE ckey="${ckey}" AND race="${race}"`
      );
      if (err2)
        return interaction.editReply({
          embeds: [
            embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
          ]
        });
      await interaction.editReply({
        embeds: [
          embed
            .setTitle(':x: Успешно удалено')
            .setColor('DarkRed')
            .setDescription(
              `Игрок \`${ckey}\` успешно удалён из вайтлиста расы **${
                ALL_RACES[race] || '`' + race + '`'
              }**`
            )
        ]
      });
    }
  } else {
    if (roleName == 'demote')
      return interaction.editReply({
        embeds: [
          embed
            .setTitle('Ошибка')
            .setColor('Red')
            .setDescription('Игрок не найден как администратор - снять невозможно')
        ]
      });

    const { err: err2 } = await doBayQuery(
      `INSERT INTO erro_admin (ckey, rank) VALUES ("${ckey}", "${role.bay}")`
    );
    if (err2)
      return interaction.editReply({
        embeds: [
          embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
        ]
      });
    await interaction.editReply({
      embeds: [
        embed
          .setTitle(`:white_check_mark: Успешное ${isUp ? 'повышение' : 'понижение'}`)
          .setColor('DarkGreen')
          .setDescription(
            `Игрок \`${ckey}\` успешно ${isUp ? 'повышен' : 'понижен'} до роли **${
              role.bay
            }** и получает плашку <&${role.role}>`
          )
      ]
    });
  }
}

const allowed = '1234567890abcdef';
function checkToken(token) {
  let flag = true;
  for (let letter of token)
    if (!allowed.includes(letter)) {
      flag = false;
      break;
    }
  return flag;
}

async function bayLinkAccount(interaction, embed) {
  const token = interaction.options.getString('t');

  if (token.length < 32 || !checkToken(token))
    return interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription('Неверный токен')]
    });
  if (!(await connectToBay()))
    return interaction.editReply({
      embeds: [
        embed
          .setTitle('Ошибка')
          .setColor('Red')
          .setDescription('Невозможно подключиться к базе данных BayStation')
      ]
    });

  // DISCORD CHECK
  const { err, data: discords } = await doBayQuery(
    `SELECT * FROM erro_player WHERE discord_id="${interaction.user.id}"`
  );
  if (err)
    return interaction.editReply({
      embeds: [
        embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
      ]
    });
  if (discords.length)
    return interaction.editReply({
      embeds: [
        embed
          .setTitle('Ошибка')
          .setColor('Red')
          .setDescription(
            `Дискорд аккаунт <@!${interaction.user.id}> уже привязан к аккаунту \`${discords[0].ckey}\``
          )
      ]
    });
  // /DISCORD CHECK

  const { err: err1, data: players } = await doBayQuery(
    `SELECT * FROM erro_player WHERE discord_id="${token}"`
  );
  if (err1)
    return interaction.editReply({
      embeds: [
        embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
      ]
    });

  if (players.length) {
    const { err: err2 } = await doBayQuery(
      `UPDATE erro_player SET discord_id="${interaction.user.id}" WHERE ckey="${players[0].ckey}"`
    );
    if (err2)
      return interaction.editReply({
        embeds: [
          embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
        ]
      });
    await interaction.editReply({
      embeds: [
        embed
          .setTitle(':white_check_mark: Успешно привязано')
          .setColor('DarkGreen')
          .setDescription(
            `Аккаунт \`${players[0].ckey}\` успешно привязан к дискорд аккаунту <@!${interaction.user.id}>`
          )
      ]
    });
  } else {
    await interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription('Неверный токен')]
    });
  }
}

async function bayUnlinkAccount(interaction, embed) {
  if (!(await connectToBay()))
    return interaction.editReply({
      embeds: [
        embed
          .setTitle('Ошибка')
          .setColor('Red')
          .setDescription('Невозможно подключиться к базе данных BayStation')
      ]
    });
  const { err, data: players } = await doBayQuery(
    `SELECT * FROM erro_player WHERE discord_id="${interaction.user.id}"`
  );
  if (err)
    return interaction.editReply({
      embeds: [
        embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
      ]
    });

  if (players.length) {
    const { err: err2 } = await doBayQuery(
      `UPDATE erro_player SET discord_id="" WHERE ckey="${players[0].ckey}"`
    );
    if (err2)
      return interaction.editReply({
        embeds: [
          embed.setTitle('Ошибка').setColor('Red').setDescription('Ошибка запроса к базе данных')
        ]
      });
    await interaction.editReply({
      embeds: [
        embed
          .setTitle(':x: Успешно отвязано')
          .setColor('DarkRed')
          .setDescription(
            `Аккаунт \`${players[0].ckey}\` успешно отвязан от дискорд аккаунта <@!${interaction.user.id}>`
          )
      ]
    });
  } else {
    await interaction.editReply({
      embeds: [
        embed
          .setTitle('Ошибка')
          .setColor('Red')
          .setDescription(`Дискорд аккаунт <@!${interaction.user.id}> не привязан`)
      ]
    });
  }
}

const cap = string => (string ? string.charAt(0).toUpperCase() + string.slice(1) : string);

const serverEmojis = {
  bay: ':cheese:',
  para: ':palm_tree:',
  skyrat: ':mouse:',
  test: ':tools:'
};

const serverNames = {
  bay: 'BayStation',
  skyrat: 'Skyrat',
  para: 'Paradise',
  test: 'Тест сервер'
};

const serverPorts = {
  bay: 49383,
  para: 49229,
  skyrat: 49191,
  test: 49298,
  paran: 23410
};

const serverTitle = id => `${serverEmojis[id]} **${serverNames[id]}:**`;

function formatServer(id, srv) {
  console.log('Formatting', srv);
  let text = [];
  if (!srv || !srv.mode) return `${serverTitle(id)} Спит`;

  text.push(`${serverTitle(id)} **${srv.map || srv.map_name} - ${cap(srv.mode) || 'Без режима'}**`);
  text.push(`Раунд: \`${srv.gameid || 'ERR'}\` | Длительность: \`${srv.roundtime}\``);
  if (srv.active_players === undefined) {
    text.push(`Игроки: ${srv.players} всего`);
  } else {
    text.push(`Игроки: ${srv.active_players} активных, ${srv.players} всего`);
  }
  if (srv.admins && srv.adminlist !== undefined) {
    const adminObj = paramsToObject(srv.adminlist, false);
    const adminArr = [];
    for (const ckey in adminObj) adminArr.push(`- [${adminObj[ckey]}] ${ckey}`);
    text.push('Админы:\n' + adminArr.join('\n'));
  } else if (srv.admins && srv.adminlist === undefined) {
    text.push(`Админы: ${srv.admins}`);
  } else text.push('Админы: Отсутствуют');

  return text.join('\n');
}

async function fetchTopic(ip, port, topic) {
  try {
    const r = await byondFetch.fetchTopic({
      ip,
      port,
      topic
    });
    try {
      return JSON.parse(r);
    } catch (e) {
      return String(r);
    }
  } catch (e) {
    console.error('fetchTopic err', e);
    return 'Error: ' + e.message;
  }
}

async function getAllServerData(ip, port) {
  return {
    manifest: await fetchTopic(ip, port, '?manifest'),
    status: await fetchTopic(ip, port, '?status=2&format=json'),
    ping: await fetchTopic(ip, port, '?ping')
  };
}

async function constructAllServerData(ip, port) {
  const data = await getAllServerData(ip, port);
  return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
}

async function getServerData(interaction, embed) {
  const [ip, port] = interaction.options
    .getString('сервер')
    .split('/')
    .join('')
    .replace('byond:', '')
    .split(':');
  await interaction.editReply({
    content:
      `Данные сервера: \`byond://${ip}:${port}\`\n` + (await constructAllServerData(ip, port))
  });
}
/*
async function checkServersStatus (interaction, embed) {
	let srv = {};

	for (let name in serverPorts) {
		try {
			const r = await byondFetch.fetchTopic({
				ip: "127.0.0.1",
				port: serverPorts[name],
				topic: "?status=2&format=json"
			});
			srv[name] = JSON.parse(r);
		}
		catch (e) { srv[name] = {}; }
	}

	const servers = [];
	for (const id in srv) servers.push(formatServer(id, srv[id]));

	return await interaction.editReply({ embeds: [
		new EmbedBuilder().setTitle("Статус серверов")
		.setColor("Blurple")
		.setDescription(servers.join("\n\n"))
	]});
}
*/
async function checkServersStatus(interaction, embed) {
  const r = await byondFetch.fetchTopic({
    ip: 'games-republic.ru',
    port: 23410,
    topic: '?status=2&format=json'
  });
  const jsonData = JSON.parse(r);
  return await interaction.editReply({
    embeds: [
      embed
        .setTitle('Статус серверов')
        .setColor('Blurple')
        .setDescription(formatServer('para', jsonData))
    ]
  });
}

const zeroes = [
  'Никого',
  'Хайпоп',
  '0',
  '9999',
  'Мяу',
  'Отсутствуют',
  'Нема',
  'Да',
  'Нет',
  '---',
  'UwU',
  '$#@',
  '284617',
  '-1',
  'Хуууууууй',
  '•~•',
  '._.',
  '0_о',
  'Существуют?',
  'Не существуют',
  'Миф',
  'Играют в Майнкрафт',
  'Исчезли',
  'Успешно аннигилированы',
  'Забанены',
  'Уже вышли',
  'Листают NSFW каналы',
  'Милашки',
  'Продались',
  'Спят',
  '<:KannaKms:873199424032092200>',
  '<:NinoPain:1094445733408682034>',
  '<:pepesadge:1145111506795642900>',
  '<a:Bye:1042544645986586634>',
  '-0',
  'o',
  'ö',
  '∅'
];
async function getServerPlayers(interaction, embed) {
  const r = await byondFetch.fetchTopic({
    ip: 'games-republic.ru',
    port: 23410,
    topic: '?playerlist=2&format=json'
  });
  const randZero = zeroes[Math.floor(Math.random() * zeroes.length)];
  const jsonData = JSON.parse(r);
  return await interaction.editReply({
    embeds: [
      embed
        .setTitle(`Онлайн игроки: ${jsonData.length || randZero}`)
        .setColor('Blurple')
        .setDescription(jsonData.map(p => `\`${p}\``).join(', '))
    ]
  });
}

async function checkServers(interaction, embed) {
  let servers = {};
  try {
    servers.para = await byondFetch.fetchTopic({ ip: '127.0.0.1', port: 49229, topic: '?ping' });
  } catch (e) {
    servers.para = null;
  }
  try {
    servers.bay = await byondFetch.fetchTopic({ ip: '127.0.0.1', port: 49383, topic: '?ping' });
  } catch (e) {
    servers.bay = null;
  }
  try {
    servers.skyrat = await byondFetch.fetchTopic({ ip: '127.0.0.1', port: 49191, topic: '?ping' });
  } catch (e) {
    servers.skyrat = null;
  }
  console.log(servers);

  return await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle('Статус серверов')
        .setColor('Blurple')
        .setDescription(
          `:palm_tree: **Paradise:** ${servers.para ? 'Робит :+1:' : 'Спит :zzz:/ Дед :skull:'}\n` +
            `:cheese: **Sierra:** ${servers.bay ? 'Робит :+1:' : 'Спит :zzz:/ Дед :skull:'}\n` +
            `:mouse: **SkyRat:** ${servers.skyrat ? 'Робит :+1:' : 'Спит :zzz:/ Дед :skull:'}`
        )
    ]
  });
}

async function getServerIP(interaction, embed) {
  let server = interaction.options.getString('сервер');

  if (!server) server = 'paran';

  if (server) {
    if (!serverPorts[server])
      return interaction.editReply({
        embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription('Сервер не найден')]
      });
    if (server == 'paran')
      return interaction.editReply({
        embeds: [
          embed
            .setTitle('IP сервера')
            .setColor('Blurple')
            .setDescription(
              '**Ссылка:** <https://play.games-republic.ru/>\n' +
                `**BYOND:** \`byond://games-republic.ru:${serverPorts[server]}\`\n` +
                `**Alt:** \`byond://82.146.42.80:${serverPorts[server]}\``
            )
        ]
      });
    return interaction.editReply({
      embeds: [
        embed
          .setTitle(`${serverNames[server] || 'IP сервера'}`)
          .setColor('Blurple')
          .setDescription(`**<byond://wetskrell.ru:${serverPorts[server]}>**`)
      ]
    });
  } else {
    let links = [];
    for (let name in serverPorts)
      links.push(
        `${serverEmojis[name]} **${serverNames[name]}:** ` +
          `<byond://wetskrell.ru:${serverPorts[name]}>`
      );
    return interaction.editReply({
      embeds: [embed.setTitle('Айпи серверов').setColor('Blurple').setDescription(links.join('\n'))]
    });
  }
}

async function giveMeetRole(interaction, embed) {
  const role = interaction.options.getString('роль');

  if (!roles.meet[role])
    return interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription('Роль не найдена')]
    });
  if ((await interaction.member.fetch()).roles.cache.has(roles.meet[role])) {
    await interaction.member.roles.remove(roles.meet[role]);
    return interaction.editReply({
      embeds: [
        embed
          .setTitle(':x: Роль успешно снята')
          .setDescription(`С позором срываю с тебя плашку <@&${roles.meet[role]}>`)
          .setColor('DarkRed')
      ]
    });
  } else {
    await interaction.member.roles.add(roles.meet[role]);
    return interaction.editReply({
      embeds: [
        embed
          .setTitle(':white_check_mark: Роль успешно добавлена')
          .setDescription(`Носи плашку <@&${roles.meet[role]}> с гордостью и честью`)
          .setColor('DarkGreen')
      ]
    });
  }
}

function getFurryUrl(post) {
  return `https://static1.e621.net/data/${post.md5.slice(0, 2)}/${post.md5.slice(2, 4)}/${
    post.md5
  }.${post.file_ext}`;
}

const furryUsersIds = {};
const fullRating = {
  e: 'Explicit',
  q: 'Questionable',
  s: 'Safe'
};

function getFurryPost(interaction, embed, post, count, query = [], rating = null, update = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('furry-new').setLabel('Заменить').setEmoji('♻️').setStyle(1),
    new ButtonBuilder().setCustomId('furry-place').setLabel('Оставить').setEmoji('👌').setStyle(3),
    new ButtonBuilder().setCustomId('furry-remove').setLabel('Убрать').setEmoji('✖️').setStyle(4)
  );
  const tags = post.tag_array.map(escapeMarkdown).map(t => (query.includes(t) ? `**${t}**` : t));

  return {
    embeds: [
      embed
        .setTitle(`Фурря #${post.id}${count > 1 ? ' — ' + count : ''}`)
        .setDescription(
          `**Теги:** ${tags.join(', ')}\n**Рейтинг:** ${post.score}\n**Категория:** ${
            fullRating[post.rating]
          }`
        )
        .setImage(getFurryUrl(post))
        .setColor('Blurple')
    ],
    components: [row]
  };
}

async function sendNewFurryPost(interaction, embed, query, rating, count = 1) {
  const post = await getRandomFurryPost(query, rating);
  if (!post)
    return interaction.editReply({
      embeds: [
        embed
          .setTitle('Фурря не найдена')
          .setDescription(
            `Ни единого поста по запросу не нашлось.` +
              (query ? `\nЗапрос: \`\`\`\n${query.join(' ')}\n\`\`\`` : '') +
              (rating ? `\nКатегория: ${fullRating[rating]}` : '')
          )
          .setColor('DarkRed')
      ]
    });

  const postBody = await getFurryPost(interaction, embed, post, count, query);
  let reply;
  if (count > 1) reply = await interaction.update(postBody);
  else reply = await interaction.editReply(postBody);

  try {
    const buttonClick = await reply.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id,
      time: 120_000
    });
    if (buttonClick.customId === 'furry-place') await buttonClick.update({ components: [] });
    if (buttonClick.customId === 'furry-remove') {
      await buttonClick.update({ components: [] });
      await buttonClick.message.delete();
    }
    if (buttonClick.customId === 'furry-new') {
      await sendNewFurryPost(buttonClick, embed, query, rating, count + 1);
    }
  } catch (e) {
    console.error(e);
    try {
      await reply.edit({ components: [] });
    } catch (e) {
      console.error(e);
    }
  }
}

async function getRandomFurry(interaction, embed) {
  const query = interaction.options.getString('запрос') || '';
  const rating = interaction.options.getString('категория') || null;
  return sendNewFurryPost(interaction, embed, sanitizeTags(query), rating);
}

async function createCustomPlug(interaction, embed) {
  const url = interaction.options.getString('аватарка');
  const name = interaction.options.getString('название');
  const filename = `$${name.replace(/[^a-zA-Z0-9_\-\(\)]/g, '')}.gif`;
  if (filename === '$.gif')
    return interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription('Неверное название')]
    });

  console.log('Creating plug', filename);
  const plugPath = await plugger(filename, url);
  console.log('Plug created', filename);

  if (plugPath) {
    fs.copyFileSync(plugPath, path.join('/app/plugs/', path.basename(filename)));
    fs.unlinkSync(plugPath);
    return interaction.editReply({
      embeds: [
        embed
          .setTitle('Гиф готова')
          .setDescription(
            `Скачать её можно по ссылке:\nhttps://download.wetskrell.ru/plugs/${path.basename(
              plugPath
            )}`
          )
          .setColor('Blurple')
      ]
    });
  } else {
    return interaction.editReply({
      embeds: [
        embed
          .setTitle('Всё хуйня')
          .setDescription(`Не знаю что произошло, но это пиздец`)
          .setColor('DarkRed')
      ]
    });
  }
}

const jobs = {
  heads: 'Главы',
  sec: 'Щиткуры',
  eng: 'Кринжи',
  med: 'Медовые',
  sci: 'ЕРП вульпы',
  car: 'Карго',
  srv: 'Сервис',
  civ: 'Цивы',
  bot: 'Банки'
};
async function getManifest(interaction, embed) {
  let r = 'Ошибка';
  try {
    r = await byondFetch.fetchTopic({ ip: '127.0.0.1', port: 49229, topic: '?manifest' });
  } catch (e) {
    r = e;
  }
  let json = JSON.parse(r);
  let text = [];
  for (let job in json) {
    text.push(`**${jobs[job]}:**`);
    for (let crew in json[job]) {
      text.push(`- ${crew} (${json[job][crew]})`);
    }
  }
  if (!text.length) text.push('Никто не играет');
  return await interaction.editReply(text.join('\n'));
}

async function startServer(interaction, embed) {
  const server = interaction.options.getString('id').toLowerCase();
  const sentData = await sendSockServerCommand(server, 'start');
  if (sentData.error)
    return await interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription(sentData.msg)]
    });
  await interaction.editReply({
    embeds: [
      embed
        .setTitle('<a:andance:983035371900260422> Команда запуска отправлена')
        .setColor('Greyple')
    ]
  });
  const receivedData = await waitForSockResponse(server);
  console.log(receivedData);
  if (receivedData.error)
    return await interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription(receivedData.msg)]
    });
  return await interaction.editReply({
    embeds: [embed.setTitle(':+1: Сервер запускается').setColor('Blurple')]
  });
}

async function stopServer(interaction, embed) {
  const server = interaction.options.getString('id').toLowerCase();
  const sentData = await sendSockServerCommand(server, 'stop');
  if (sentData.error)
    return await interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription(sentData.msg)]
    });
  await interaction.editReply({
    embeds: [
      embed
        .setTitle('<a:andance:983035371900260422> Команда остановки отправлена')
        .setColor('Greyple')
    ]
  });
  const receivedData = await waitForSockResponse(server);
  if (receivedData.error)
    return await interaction.editReply({
      embeds: [embed.setTitle('Ошибка').setColor('Red').setDescription(receivedData.msg)]
    });
  return await interaction.editReply({
    embeds: [embed.setTitle(':+1: Сервер стопнут').setColor('DarkRed')]
  });
}

async function runIfHasRoles(roles, fun, interaction, embed) {
  await interaction.member.fetch();
  let hasRole = false;
  for (let role of roles) {
    if (!interaction.member.roles.cache.has(role)) continue;
    hasRole = true;
    break;
  }
  if (interaction.member.guild.id == '946712507874152488') hasRole = true;
  if (!hasRole)
    return await interaction.editReply({ content: 'Нет доступа <:achE:974586173307641857>' });
  return await fun(interaction, embed);
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isContextMenuCommand()) return;
  if (interaction.commandName.toLowerCase() == 'погладить') {
    try {
      pats = JSON.parse(fs.readFileSync('./pats.json')) || {};
    } catch (e) {}
    const usrId = interaction.targetUser.id;
    if (!pats[usrId])
      return interaction.reply({
        content: 'У меня нет гифки чтобы его погладить :c',
        ephemeral: true
      });
    return interaction.reply({ content: pats[usrId] });
  }
  if (interaction.commandName.toLowerCase() == 'плаг') {
    try {
      const mbr =
        interaction.guild && (await interaction.guild.members.fetch(interaction.targetMember.id));
      const usr = interaction.targetUser;
      if (!mbr?.avatar && !usr.avatar)
        return interaction.reply({
          content: 'Аватар не найден',
          ephemeral: true
        });
      console.log('Test', mbr?.avatar, mbr?.avatar && mbr.avatarURL());
      await interaction.deferReply();
      const plugPath = await plugger(
        mbr?.avatar || usr.avatar,
        mbr?.avatar ? mbr.avatarURL() : usr.avatarURL()
      );
      console.log('got path', plugPath);
      if (!plugPath)
        return interaction.editReply({
          content: 'У пользователя нет аватарки',
          ephemeral: true
        });
      await interaction.editReply({
        files: [
          {
            name: `plug-${usr.username}.gif`,
            attachment: plugPath,
            description: `A ${mbr?.nickname || usr.username} plugged`
          }
        ]
      });
    } catch (e) {
      const r = Date.now();
      console.log('E', r, e);
      return interaction.reply({
        content: `Произошла ошибка (${r})`,
        ephemeral: true
      });
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return interaction;
  await interaction.deferReply();
  const embed = new EmbedBuilder();

  if (interaction.commandName == 'пинги') return await giveMeetRole(interaction, embed);
  if (interaction.commandName == 'айпи') return await getServerIP(interaction, embed);
  if (interaction.commandName == 'статус') return await checkServersStatus(interaction, embed);
  if (interaction.commandName == 'игроки') return await getServerPlayers(interaction, embed);
  if (interaction.commandName == 'фурря') return await getRandomFurry(interaction, embed);

  if (interaction.commandName == 'билд')
    return await runIfHasRoles([roles.coder], buildPara, interaction, embed);
  if (interaction.commandName == 'пулл')
    return await runIfHasRoles([roles.coder], pullPara, interaction, embed);
  if (interaction.commandName == 'ресет')
    return await runIfHasRoles([roles.coder], resetPara, interaction, embed);
  if (interaction.commandName == 'бэй') {
    const sub = interaction.options.getSubcommand();
    if (sub == 'вайтлист')
      return await runIfHasRoles(
        [roles.admin, '1069693040475771000'],
        bayWhiteListToggle,
        interaction,
        embed
      );
    if (sub == 'роль')
      return await runIfHasRoles([roles.admin, roles.hadmin], bayAdminToggle, interaction, embed);
    if (sub == 'привязать') return await bayLinkAccount(interaction, embed);
    if (sub == 'отвязать') return await bayUnlinkAccount(interaction, embed);
    if (sub == 'игрок') return await bayPlayerData(interaction, embed);
  }

  if (interaction.commandName == 'старт')
    return await runIfHasRoles(
      [roles.coder, roles.admin, roles.hadmin],
      startServer,
      interaction,
      embed
    );
  if (interaction.commandName == 'стоп')
    return await runIfHasRoles([roles.coder, roles.hadmin], stopServer, interaction, embed);
  if (interaction.commandName == 'sstat')
    return await runIfHasRoles(['1167210351604019231'], getServerData, interaction, embed);
  if (interaction.commandName == 'где')
    return await runIfHasRoles(
      [roles.coder, '1169672685266149496'],
      require('./wherePlayer.js'),
      interaction,
      embed
    );
  if (interaction.commandName == 'плаг')
    return await runIfHasRoles(['1031627532660908114'], createCustomPlug, interaction, embed);

  interaction.editReply('<:achE:974586173307641857>');
});

client.login(process.env.BOT_TOKEN);
