const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds] });

const { SlashCommandBuilder, ContextMenuCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const config = require("./config.json");

const GUILD = config.guild;
const ADMIN_ROLES = config.adminRoles;

const builds = [
  { name: "Paradise", value: "para" }
]

const commands = [
  {
    data: new ContextMenuCommandBuilder()
      .setName('Погладить').setType(2),
    access: "user"
  },
  {
    data: new ContextMenuCommandBuilder()
      .setName('Плаг').setType(2),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("билд")
      .setDescription("В очередной раз сбилдить пару"),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("пулл")
      .setDescription("Подсосать свеженький билд с гитхаба"),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("ресет")
      .setDescription("Ресетнуть пару (ну кто так пуллит?)"),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("статус")
      .setDescription("Узнать статус локальных серверов"),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("старт")
      .setDescription("Запустить локальный сервер")
      .addStringOption(o => o
        .setName("id")
        .setDescription("Название билда")
        .setRequired(true)
        .addChoices(...builds)
      ),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(true)
      .setName("фурря")
      .setDescription("Случайная картинка с e621")
      .addStringOption(o => o
        .setName("запрос")
        .setDescription("Теги e621 через пробел")
      )
      .addStringOption(o => o
        .setName("категория")
        .setDescription("Степень откровенности изображений")
        .addChoices(
          { name: "Safe", value: "s" },
          { name: "Questionable", value: "q" },
          { name: "Explicit", value: "e" },
        )
      ),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("стоп")
      .setDescription("Остановить локальный сервер")
      .addStringOption(o => o
        .setName("id")
        .setDescription("Название билда")
        .setRequired(true)
        .addChoices(...builds)
      ),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("пинги")
      .setDescription("Получить/снять роль для пингов")
      .addStringOption(o => o
        .setName("роль")
        .setDescription("Получаемая/снимаемая роль для пингов")
        .setRequired(true)
        .addChoices(
          { name: "Игрок Bay12", value: "bay" },
          { name: "Ждущий тестов", value: "test" }
        )
      ),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("игроки")
      .setDescription("Узнать кто играет сейчас на сервере"),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("айпи")
      .setDescription("Узнать IP сервера (или серверов)")
      .addStringOption(o => o
        .setName("сервер")
        .setDescription("Сервер, IP которого нужно узнать")
        .setRequired(false)
        .addChoices(
          /*{ name: "Бэй", value: "bay" },
          { name: "Парадиз", value: "para" },
          { name: "Скайрат", value: "skyrat" },
          { name: "Тест сервер", value: "test" }*/
		{ name: "Парадиз", value: "paran" }
        )
      ),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("плаг")
      .setDescription("Всадить плаг в аватарку")
      .addStringOption(o => o
        .setName("название")
        .setDescription("Текст названия файла")
        .setRequired(true)
      )
      .addStringOption(o => o
        .setName("аватарка")
        .setDescription("URL аватарки")
        .setRequired(true)
      ),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("где")
      .setDescription("Найти игрока по ckey")
      .addStringOption(o => o
        .setName("ckey")
        .setDescription("ckey игрока")
        .setRequired(true)
      ),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("sstat")
      .setDescription("Узнать данные сервера")
      .addStringOption(o => o
        .setName("сервер")
        .setDescription("IP сервера")
        .setRequired(true)
      ),
    access: "user"
  },
  {
    data: new SlashCommandBuilder()
      .setDMPermission(false)
      .setName("бэй")
      .setDescription("Взаимодействие с локальным сервером Baystation12")
      .addSubcommand(sub =>
        sub.setName("вайтлист")
        .setDescription("Управление вайтлистом")
        .addUserOption(o => o
          .setName("игрок")
          .setDescription("Игрок, которому выдаётся вайтлист")
          .setRequired(true)
        ).addStringOption(o => o
          .setName("раса")
          .setDescription("Раса для выдачи игроку")
          .setRequired(true)
          .addChoices(
            { name: "Резоми", value: "resomi" },
            { name: "Адхерант", value: "adherent" },
            { name: "Вокс", value: "vox" },
            { name: "Вокс Армалис", value: "vox armalis" },
            { name: "Восхождение милфа", value: "kharmaan gyne" },
            { name: "Восхождение симп", value: "kharmaan alate" },
            { name: "Диона", value: "diona" },
            { name: "Скрелл", value: "skrell" },
            { name: "Таяра", value: "tajara" },
            { name: "КПБшка", value: "machine" },
            { name: "ППТшка", value: "full body prosthesis" },
            { name: "ГБСик", value: "giant armoured serpentid" },
            { name: "Унати", value: "unathi" }
          )
        )
      ).addSubcommand(sub =>
        sub.setName("роль")
        .setDescription("Управление админками")
        .addUserOption(o => o
          .setName("игрок")
          .setDescription("Игрок, кому выдать роль")
          .setRequired(true)
        ).addStringOption(o => o
          .setName("роль")
          .setDescription("Роль для выдачи игроку")
          .setRequired(true)
          .addChoices(
            ...ADMIN_ROLES.map(({ name, value }) => ({ name, value }))
            .concat({ name: "Снять", value: "demote" })
          )
        )
      ).addSubcommand(sub =>
        sub.setName("привязать")
        .setDescription("Привязать аккаунт")
        .addStringOption(o => o
          .setName("t")
          .setDescription("Токен для привязки")
          .setRequired(true)
        )
      ).addSubcommand(sub =>
        sub.setName("отвязать")
        .setDescription("Отвязать аккаунт Baystation12")
      ).addSubcommand(sub => 
        sub.setName("игрок")
        .setDescription("Информация об игроке")
        .addUserOption(o => o
          .setName("игрок")
          .setDescription("Игрок, информацию о котором нужно узнать")
        )
      ),
    access: "user"
  }
 
]


const PLUG_COMMAND = {
  name: 'плаг',
  type: 1,
  description: 'See your game inventory and progress',
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

console.log('Successfully parsed', commands.length, 'commands!\n');

const rest = new REST({ version: '9' }).setToken(config.token);
const restv10 = new REST({ version: '10' }).setToken(config.token);

function getGlobCommands() {
	return commands.map(c => c.data.setDMPermission(true).toJSON()).filter(c => c.name.toLowerCase() === 'плаг').map(c => {
                 c.integration_types = [0, 1];
                 c.contexts =  [0, 1, 2];
		if (!c.type) c.type = 1;
                 let obj =  ({
			name: c.name,
			 type: c.type || 1,
			 integration_types: [0,1],
			 contexts: [0,1,2]
		 });
		if (c.options) obj.options = c.options;
		if (c.description) obj.description = c.description;

		return obj;
         });
}

function getCommands() {
	return commands.map(c => c.data.setDMPermission(c.access == "user").toJSON()).map(c => {
                if (c.name.toLowerCase() === "плаг") {
                        c.integration_types = ["0", "1"];
                        c.contexts =  ["0", "2"];
                }
                 return c;
         });
}

client.on('ready', async () => {

  console.log('Successfully authenticated!\n')

  if (process.argv.includes("-get")) {
	  console.log("========= GUILD =========");
	console.log( await rest.get(
		Routes.applicationGuildCommands(client.application.id, GUILD)
	))
	  console.log("========= GLOBAL =========");
	  console.log( await rest.get(
                Routes.applicationCommands(client.application.id)
        ))
  }
  
  if (process.argv.includes("-c")) {
  console.log('Refreshing application (/) commands...');
	await rest.put(
		Routes.applicationGuildCommands(client.application.id, GUILD),
		{ body: getCommands() },
	);
	console.log("ANSWER\n", await restv10.put(
		Routes.applicationCommands(client.application.id),
		{ body: getGlobCommands() },
	));
	  console.log(JSON.stringify(getGlobCommands(), null, 2));
	console.log('Successfully reloaded application (/) commands!\n');


	console.log('Started getting application (/) commands...');
	let r = await rest.get(
		Routes.applicationGuildCommands(client.application.id, GUILD)
	);
	console.log('Successfully got application (/) commands!\n');
  cmds = r.map(c => {
    const cmd = commands.find(co => co.data.name == c.name);
    return { id: c.id, name: c.name, role: cmd.access != 'user' ? config.roles[cmd.access] : false };
  });

  console.log(cmds)

  
  console.log('Trying to set commands permissions...');
  for (let c of cmds) {
    if (!c.role) continue;
    await rest.put(
      `/applications/${client.application.id}/guilds/${GUILD}/commands/${c.id}/permissions`,
      { body: { id: c.role, type: 1, permission: true } }
    );
  }
  console.log('Successfully set commands permissions\n');
  }

  if (process.argv.includes("-i")) {
  console.log('Trying to update interactions...');
  await restv10.put(
    `/applications/${client.application.id}/role-connections/metadata`,
    { body: [
    ] }
  );
  console.log('Successfully updated interactions\n');

  console.log('Started getting interactions...');
  let r = await restv10.get(
    `/applications/${client.application.id}/role-connections/metadata`
  );
  console.log('Successfully got interactions\n');
  console.log(r);
  }

	console.log("APP ID:", client.application.id); 
  console.log('ALL DONE!');
  client.destroy();
});

console.log('Trying to authenticate...')
client.login(config.token);
