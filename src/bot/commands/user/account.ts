import Asteria from "../../../utilities/asteriasdk/index.js";

const asteria = new Asteria({
    collectAnonStats: true,
    throwErrors: true,
});

import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import Users from '../../../model/user.js';
import Profiles from '../../../model/profiles.js';

export const data = new SlashCommandBuilder()
    .setName('account')
    .setDescription('Shows you your account information');

export async function execute(interaction: ChatInputCommandInteraction) {

    await interaction.deferReply({ ephemeral: true });

    try {
        const user = await Users.findOne({ discordId: interaction.user.id });
        if (!user) return interaction.editReply({ content: "You are not registered!" });

        const profile = await Profiles.findOne({ accountId: user.accountId });

        if (!profile) return interaction.editReply({ content: "You are not registered!" });

        const selectedSkin = profile.profiles.athena.stats.attributes.favorite_character;
        const selectedSkinSplit = selectedSkin.split(":") || "CID_005_Athena_Commando_M_Default";

        let cosmetic: { images: { icon: string; }; } = { images: { icon: "" } };

        try {
            cosmetic = await asteria.getCosmetic("id", selectedSkinSplit[1], true);
        } catch (err) {
            cosmetic = { images: { icon: "https://raw.githubusercontent.com/Project-BlackFN/upload/refs/heads/main/logo.png" } }
        }

        if (!cosmetic) cosmetic = { images: { icon: "https://raw.githubusercontent.com/Project-BlackFN/upload/refs/heads/main/logo.png" } }

        let icon = cosmetic.images.icon;

        const embed = new EmbedBuilder()
            .setTitle("Your account")
            .setDescription("These are your account details")
            .setColor("#2b2d31")
            .addFields([
                {
                    name: "Username",
                    value: user.username,
                    inline: true
                },
                {
                    name: "Email",
                    value: user.email,
                    inline: true
                },
                {
                    name: "Account ID",
                    value: user.accountId
                },
            ])
            .setThumbnail(icon)
            .setFooter({
                text: "BlackFN",
                iconURL: "https://raw.githubusercontent.com/Project-BlackFN/upload/refs/heads/main/logo.png",
            })
            .setTimestamp();

        interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.log(err);
        interaction.editReply({ content: "An error occured while executing this command!\n\n" + err });
    }

}