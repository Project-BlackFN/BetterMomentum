import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import Users from '../../../model/user.js';
import functions from "../../../utilities/structs/functions.js";

export const data = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick someone out of their current session by their username')
    .addStringOption(option =>
        option.setName('username')
            .setDescription('Target username')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const username = interaction.options.getString('username', true);
    const targetUser = await Users.findOne({ username_lower: username.toLowerCase() });

    if (!targetUser) {
        await interaction.editReply({ content: "The account username you entered does not exist." });
        return;
    }

    let refreshToken = global.refreshTokens.findIndex(i => i.accountId == targetUser.accountId);
    if (refreshToken != -1) global.refreshTokens.splice(refreshToken, 1);

    let accessToken = global.accessTokens.findIndex(i => i.accountId == targetUser.accountId);
    if (accessToken != -1) {
        global.accessTokens.splice(accessToken, 1);

        let xmppClient = global.Clients.find(client => client.accountId == targetUser.accountId);
        if (xmppClient) xmppClient.client.close();
    }

    if (accessToken != -1 || refreshToken != -1) {
        await functions.UpdateTokens();
        
        await interaction.editReply({ content: `Successfully kicked ${targetUser.username}` });
        return;
    }
    
    await interaction.editReply({ content: `There are no current active sessions by ${targetUser.username}` });
}