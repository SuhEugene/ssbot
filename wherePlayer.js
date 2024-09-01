const fetch = require("node-fetch");
const htmlparser2 = require("htmlparser2");
const du = require("domutils");

du.getElementsByClassName = (class_name, nodes) => du.findAll(
	(el) => el.attribs["class"] && el.attribs["class"].split(/ +/).includes(class_name),
	nodes
)

module.exports = async (interaction, embed) => {
	const ckey = interaction.options.getString("ckey").toLowerCase();

	const r = await fetch("https://www.byond.com/games/Exadv1/SpaceStation13");
	const dom = htmlparser2.parseDocument(await r.text());
	const entries = du.getElementsByClassName("live_game_entry", dom.children);
	for (const entry of entries) {
		const statEl = du.getElementsByClassName("live_game_status", entry.children)[0];
		const bstat = du.getElementsByTagName("b", statEl.children).map(e => du.innerText(e)).join(" ");

		const playersEl = du.getElementsByClassName("live_game_player_list", entry.children)[0];
		if (!playersEl) continue;
		const players = du.getElementsByTagName("nobr", playersEl.children)
			.map(e => du.innerText(e))
			.map(e => e.toLowerCase());
		
		if (players.includes(ckey)) return interaction.editReply({ embeds: [
			embed.setTitle("Игрок найден").setColor("Blurple")
			     .setDescription(
			         `\`${ckey}\` найден на сервере:\n`+
			         `**${bstat}**`
			     )
		] });
	}

	return interaction.editReply({ embeds: [
		embed.setTitle("Игрок не найден").setColor("Greyple")
		.setDescription(`\`${ckey}\` не найден ни на одном сервере`)
	] });
}
