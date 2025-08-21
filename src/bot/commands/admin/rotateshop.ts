import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import Shop from "../../../utilities/shop.js";
import Safety from "../../../utilities/safety.js";

export const data = new SlashCommandBuilder()
    .setName('rotateshop')
    .setDescription('Rotates the shop')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    if(!Safety.env.ENABLE_CLOUD) {
        return await interaction.editReply({ 
            content: "This command is disabled because cloud features are disabled. You can enable them by setting ENABLE_CLOUD to true in .env" 
        }); 
    }

    const shopItems = await Shop.updateShop();

    if(shopItems[0] === false) {
        return await interaction.editReply({ 
            content: "This command is disabled as it's only available to users that bought the Auto Rotate module. To purchase it, join https://discord.gg/NexusFN." 
        });
    }
    await interaction.editReply({ content: "The shop has been rotated." });
}
