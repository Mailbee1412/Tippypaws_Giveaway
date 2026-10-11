import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { THEME_CHOICES } from "./theme.js";

const themeOption = (o) =>
  o
    .setName("theme")
    .setDescription("Theme of the card (optional)")
    .addChoices(...THEME_CHOICES);

export const commands = [
  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage giveaways")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a giveaway")
        .addStringOption((o) =>
          o
            .setName("emoji")
            .setDescription("Emoji users must react with to enter")
            .setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName("prizes")
            .setDescription(
              "Prizes, comma-separated. Use 'Name x3' for 3 winners (e.g. 'VIP x3, Mouse')"
            )
            .setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName("end")
            .setDescription("End date/time, e.g. 2026-10-11 20:00")
            .setRequired(true)
        )
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription(
              "Channel to post in (defaults to DEFAULT_CHANNEL_ID if not given)"
            )
        )
        .addStringOption((o) =>
          o.setName("title").setDescription("Giveaway title (optional)")
        )
        .addStringOption(themeOption)
        .addBooleanOption((o) =>
          o
            .setName("exclude_host")
            .setDescription("Don't let the host win (optional)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a giveaway early by message ID")
        .addStringOption((o) =>
          o
            .setName("message_id")
            .setDescription("Message ID of the giveaway")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reroll")
        .setDescription("Draw new winners for a finished giveaway")
        .addStringOption((o) =>
          o
            .setName("message_id")
            .setDescription("Message ID of the giveaway")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List active giveaways")
    )
    .addSubcommandGroup((group) =>
      group
        .setName("template")
        .setDescription("Save and reuse giveaway presets")
        .addSubcommand((sub) =>
          sub
            .setName("save")
            .setDescription("Save the current settings as a template")
            .addStringOption((o) =>
              o
                .setName("name")
                .setDescription("Template name")
                .setRequired(true)
            )
            .addStringOption((o) =>
              o
                .setName("emoji")
                .setDescription("Emoji users react with")
                .setRequired(true)
            )
            .addStringOption((o) =>
              o
                .setName("prizes")
                .setDescription("Prizes, comma-separated (e.g. 'VIP x3, Mouse')")
                .setRequired(true)
            )
            .addStringOption((o) =>
              o.setName("title").setDescription("Giveaway title (optional)")
            )
            .addStringOption(themeOption)
            .addBooleanOption((o) =>
              o
                .setName("exclude_host")
                .setDescription("Don't let the host win (optional)")
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("use")
            .setDescription("Start a giveaway from a saved template")
            .addStringOption((o) =>
              o
                .setName("name")
                .setDescription("Template name")
                .setRequired(true)
            )
            .addStringOption((o) =>
              o
                .setName("end")
                .setDescription("End date/time, e.g. 2026-10-11 20:00")
                .setRequired(true)
            )
            .addChannelOption((o) =>
              o
                .setName("channel")
                .setDescription("Channel to post in (defaults to DEFAULT_CHANNEL_ID)")
            )
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List saved templates")
        )
        .addSubcommand((sub) =>
          sub
            .setName("delete")
            .setDescription("Delete a saved template")
            .addStringOption((o) =>
              o
                .setName("name")
                .setDescription("Template name")
                .setRequired(true)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("announce")
        .setDescription("Customize the result announcement message")
        .addSubcommand((sub) =>
          sub
            .setName("set")
            .setDescription(
              "Set announcement text. Placeholders: {winners} {prizes} {title} {count}"
            )
            .addStringOption((o) =>
              o
                .setName("text")
                .setDescription(
                  "e.g. 'ยินดีด้วย {winners} กับรางวัล {prizes}!'"
                )
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub.setName("reset").setDescription("Reset to the default message")
        )
        .addSubcommand((sub) =>
          sub.setName("show").setDescription("Show the current message")
        )
    ),
].map((c) => c.toJSON());
