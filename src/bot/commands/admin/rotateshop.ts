import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import Shop from "../../../utilities/shop.js";

export const data = new SlashCommandBuilder()
    .setName("rotateshop")
    .setDescription("Rotates the shop")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        await Shop.rotateShop();
        await interaction.editReply({ content: "The shop has been rotated." });
    } catch (error) {
        console.error('Failed to rotate shop:', error);
        await interaction.editReply({ content: "Failed to rotate the shop. Check console for errors." });
    }
}