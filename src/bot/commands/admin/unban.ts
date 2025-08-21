import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import Users from '../../../model/user.js';
import functions from "../../../utilities/structs/functions.js";

export const data = new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unbans a user account')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user whose account you want to unban')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {

    await interaction.deferReply({ ephemeral: true });

    const targetUser = await Users.findOne({ username_lower: interaction.options.getUser('user')?.username.toLowerCase() });
    
    if (!targetUser) {
        await interaction.editReply({ content: "The account username you entered does not exist." });
        return;
    }

    if (targetUser.banned === false) {
        await interaction.editReply({ content: "This account is not banned." });
        return;
    }

    await targetUser.updateOne({ $set: { banned: false } });
    await functions.UpdateTokens();

    const embed = new EmbedBuilder()
        .setTitle("Account unbanned")
        .setDescription(`User with name ${interaction.options.getUser('user')?.username} has been unbanned`)
        .setColor("#2b2d31")
        .setFooter({
            text: "BlackFN",
            iconURL: "https://raw.githubusercontent.com/Project-BlackFN/upload/refs/heads/main/logo.png",
        })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await interaction.options.getUser('user')?.send({ content: "Your account has been unbanned by an administrator" });
}
