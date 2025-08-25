import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import Shop from "../../../utilities/shop.js";

export const data = new SlashCommandBuilder()
    .setName("rotateshop")
    .setDescription("Rotates the shop")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const shopItems = await Shop.updateShop();

    if (!shopItems.length) {
        return await interaction.editReply({ 
            content: "No bro.." 
        });
    }

    await interaction.editReply({ content: "The shop has been rotated." });
}
