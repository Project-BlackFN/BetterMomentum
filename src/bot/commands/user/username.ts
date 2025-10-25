import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import Users from '../../../model/user.js';

export const data = new SlashCommandBuilder()
	.setName('username')
	.setDescription('Lets you change your userame')
	.addStringOption(option =>
		option.setName('username')
			.setDescription('Your desired username')
			.setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {

	await interaction.deferReply({ ephemeral: true });

	const user = await Users.findOne({ discordId: interaction.user.id });
	if (!user) return interaction.reply({ content: "You are not registered!", ephemeral: true });

	let accessToken = global.accessTokens.find(i => i.accountId == user.accountId);
	if (accessToken) return interaction.editReply({ content: "Failed to change username as you are currently logged in to Fortnite.\nRun the /sign-out-of-all-sessions command to sign out." });

	const username = interaction.options.getString('username');

	if (username && /^bfntmp-/i.test(username)) {
		return interaction.editReply({ content: "Failed to change Username." });
	}

	await user.updateOne({ $set: { username: username } });

	const embed = new EmbedBuilder()
		.setTitle("Username changed")
		.setDescription("Your new Username is: " + username + "")
		.setColor("#2b2d31")
		.setFooter({
			text: "BlackFN",
			iconURL: "https://raw.githubusercontent.com/Project-BlackFN/upload/refs/heads/main/logo.png",
		})
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });

}