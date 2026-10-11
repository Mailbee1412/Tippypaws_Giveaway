import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  ChannelType,
  REST,
  Routes,
} from "discord.js";
import { randomInt } from "node:crypto";
import * as store from "./store.js";
import * as settings from "./settings.js";
import { getTheme } from "./theme.js";
import { commands } from "./commands.js";
import {
  parseEndTime,
  formatInZone,
  formatDuration,
  TIMEZONE,
} from "./time.js";

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel, Partials.Message],
});

const SWEEP_INTERVAL_MS = 15_000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parsePrizes(raw) {
  return raw
    .split(/[,，、;；\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((entry) => {
      const m = entry.match(/^(.*?)\s*[x*×]\s*(\d+)$/i);
      if (m && m[1].trim()) {
        const count = Math.min(Math.max(Number(m[2]), 1), 100);
        return { name: m[1].trim(), count };
      }
      return { name: entry, count: 1 };
    });
}

function normalizePrizes(prizes) {
  return (prizes || []).map((p) =>
    typeof p === "string"
      ? { name: p, count: 1 }
      : { name: p.name, count: p.count || 1 }
  );
}

function totalWinners(prizes) {
  return normalizePrizes(prizes).reduce((sum, p) => sum + p.count, 0);
}

const MEDALS = ["🥇", "🥈", "🥉"];

function prizeIcon(index) {
  return MEDALS[index] || "🏅";
}

function prizeListText(prizes) {
  return prizes
    .map(
      (p, i) =>
        `${prizeIcon(i)} **${p.name}**${
          p.count > 1 ? ` — ${p.count} รางวัล` : ""
        }`
    )
    .join("\n");
}

function guildIcon(g) {
  try {
    return client.guilds.cache.get(g.guildId)?.iconURL({ size: 256 }) || null;
  } catch {
    return null;
  }
}

function buildGiveawayEmbed(g) {
  const endsAt = new Date(g.endTime);
  const prizes = normalizePrizes(g.prizes);
  const ts = Math.floor(endsAt.getTime() / 1000);
  const icon = guildIcon(g);
  const theme = getTheme(g.theme);

  if (g.ended) {
    const embed = new EmbedBuilder()
      .setColor(theme.resultColor)
      .setTitle(theme.resultTitle)
      .setDescription(`**🎁 ของรางวัล**\n${prizeListText(prizes)}`)
      .setFooter({ text: `Giveaway ID: ${g.messageId}` })
      .setTimestamp(endsAt);
    if (icon) embed.setThumbnail(icon);

    const winners = g.winners || [];
    if (winners.length) {
      const grouped = new Map();
      for (const w of winners) {
        if (!grouped.has(w.prize)) grouped.set(w.prize, []);
        grouped.get(w.prize).push(`<@${w.userId}>`);
      }
      for (const [prize, users] of grouped) {
        embed.addFields({ name: `🏆 ${prize}`, value: users.join("\n") });
      }
    } else {
      embed.addFields({
        name: "🏆 ผู้ชนะ",
        value: "_ไม่มีผู้เข้าร่วม — ไม่มีผู้ชนะ_",
      });
    }
    return embed;
  }

  const embed = new EmbedBuilder()
    .setColor(theme.color)
    .setTitle(g.title || theme.title)
    .setDescription(
      `**🎁 ของรางวัล**\n${prizeListText(prizes)}\n\n` +
        `**🎯 วิธีร่วมสนุก**\n` +
        `กดอิโมจิ ${g.emoji} ใต้ข้อความนี้เพื่อลงชื่อลุ้นรางวัล!\n` +
        `-# สุ่มผู้ชนะแบบเรียลไทม์ ไม่ต้องแย่งกันกดก่อน` +
        (g.excludeHost ? `\n-# 🚫 ผู้จัดไม่มีสิทธิ์รับรางวัล` : "")
    )
    .addFields(
      { name: "⏰ สิ้นสุด", value: `<t:${ts}:R>\n<t:${ts}:F>`, inline: true },
      {
        name: "🏆 จำนวนผู้ชนะ",
        value: `**${totalWinners(prizes)}** คน`,
        inline: true,
      }
    )
    .setFooter({
      text: `${
        g.messageId ? `Giveaway ID: ${g.messageId} • ` : ""
      }${TIMEZONE} • กด ${g.emoji} เพื่อร่วม`,
    });

  if (icon) embed.setThumbnail(icon);
  return embed;
}

function buildResultEmbed(g) {
  const prizes = normalizePrizes(g.prizes);
  const theme = getTheme(g.theme);
  const embed = new EmbedBuilder()
    .setColor(theme.resultColor)
    .setTitle(theme.resultTitle)
    .setDescription(`**🎁 ของรางวัล**\n${prizeListText(prizes)}`)
    .setFooter({ text: `Giveaway ID: ${g.messageId}` })
    .setTimestamp();

  const icon = guildIcon(g);
  if (icon) embed.setThumbnail(icon);

  const winners = g.winners || [];
  if (winners.length) {
    const grouped = new Map();
    for (const w of winners) {
      if (!grouped.has(w.prize)) grouped.set(w.prize, []);
      grouped.get(w.prize).push(`<@${w.userId}>`);
    }
    for (const [prize, users] of grouped) {
      embed.addFields({ name: `🏆 ${prize}`, value: users.join("\n") });
    }
  } else {
    embed.addFields({
      name: "🏆 ผู้ชนะ",
      value: "_ไม่มีผู้เข้าร่วม — ไม่มีผู้ชนะ_",
    });
  }
  return embed;
}

function sameEmoji(reactionEmoji, target) {
  if (!reactionEmoji || !target) return false;
  const candidates = [
    reactionEmoji.toString(),
    reactionEmoji.identifier,
    reactionEmoji.name,
    reactionEmoji.id,
  ].filter(Boolean);
  if (candidates.includes(target)) return true;
  const id = reactionEmoji.id;
  if (id && target.includes(id)) return true;
  return false;
}

async function resolveReaction(message, emoji) {
  for (const reaction of message.reactions.cache.values()) {
    if (sameEmoji(reaction.emoji, emoji)) return reaction;
  }
  return null;
}

async function fetchAllReactors(reaction) {
  const users = [];
  let after;
  while (true) {
    const batch = await reaction.users.fetch({ limit: 100, after });
    if (batch.size === 0) break;
    for (const user of batch.values()) users.push(user);
    if (batch.size < 100) break;
    after = users[users.length - 1].id;
  }
  return users;
}

async function collectParticipants(giveaway, message) {
  const reaction = await resolveReaction(message, giveaway.emoji);
  if (!reaction) return [];

  const users = await fetchAllReactors(reaction);
  const unique = new Map();
  for (const user of users) {
    if (user.bot) continue;
    unique.set(user.id, user);
  }
  return [...unique.values()];
}

function drawWinners(participants, prizes, exclude = new Set()) {
  const normalized = normalizePrizes(prizes);
  const eligible = participants.filter((u) => !exclude.has(u.id));
  const pool = shuffle(eligible);
  const winners = [];
  let idx = 0;
  for (const prize of normalized) {
    for (let c = 0; c < prize.count && idx < pool.length; c++, idx++) {
      winners.push({ userId: pool[idx].id, prize: prize.name });
    }
  }
  return winners;
}

function renderAnnounce(text, vars) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, v),
    text
  );
}

function announcementText(giveaway, winners) {
  const cfg = settings.getConfig(giveaway.guildId);
  if (!cfg.announceText) {
    return `🎊 **ประกาศผลรางวัล!** ขอแสดงความยินดีกับ\n${winners
      .map((w) => `🎁 <@${w.userId}> — **${w.prize}**`)
      .join("\n")}`;
  }
  return renderAnnounce(cfg.announceText, {
    winners: winners.map((w) => `<@${w.userId}>`).join(", "),
    prizes: winners.map((w) => w.prize).join(", "),
    title:
      giveaway.title ||
      getTheme(giveaway.theme || "gold").title,
    count: String(winners.length),
  });
}

async function endGiveaway(giveaway, { silent = false } = {}) {
  if (giveaway.ended || giveaway.ending) return;
  giveaway.ending = true;
  try {
    const channel = await client.channels
      .fetch(giveaway.channelId)
      .catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const message = await channel.messages
      .fetch(giveaway.messageId)
      .catch(() => null);
    if (!message) return;

    let winners = [];
    let participantCount = 0;
    try {
      const participants = await collectParticipants(giveaway, message);
      participantCount = participants.length;
      const exclude = new Set();
      if (giveaway.excludeHost) exclude.add(giveaway.hostId);
      winners = drawWinners(participants, giveaway.prizes, exclude);
    } catch (err) {
      console.error("Failed to collect participants:", err);
    }
    console.log(
      `Giveaway ${giveaway.messageId}: ${participantCount} participant(s) → ${winners.length} winner(s)`
    );

    giveaway.participantCount = participantCount;
    giveaway.ended = true;
    giveaway.endedAt = new Date().toISOString();
    giveaway.winners = winners;
    await store.upsert(giveaway);

    await message
      .edit({ embeds: [buildGiveawayEmbed(giveaway)] })
      .catch(() => null);

    if (!silent) {
      const content = winners.length
        ? announcementText(giveaway, winners)
        : "😿 **Giveaway จบแล้ว** แต่ไม่มีผู้เข้าร่วม จึงไม่มีผู้ชนะครับ";
      const payload = { content, embeds: [buildResultEmbed(giveaway)] };
      await channel
        .send({ ...payload, reply: { messageReference: message.id } })
        .catch(() => channel.send(payload).catch(() => null));
    }
  } finally {
    delete giveaway.ending;
    if (giveaway.ended) await store.upsert(giveaway);
  }
}

async function rerollGiveaway(giveaway) {
  const channel = await client.channels
    .fetch(giveaway.channelId)
    .catch(() => null);
  if (!channel || !channel.isTextBased()) return null;

  const message = await channel.messages
    .fetch(giveaway.messageId)
    .catch(() => null);
  if (!message) return null;

  const previous = new Set((giveaway.winners || []).map((w) => w.userId));
  if (giveaway.excludeHost) previous.add(giveaway.hostId);
  const participants = await collectParticipants(giveaway, message);
  const winners = drawWinners(participants, giveaway.prizes, previous);

  giveaway.winners = winners;
  giveaway.rerolledAt = new Date().toISOString();
  await store.upsert(giveaway);

  await message
    .edit({ embeds: [buildGiveawayEmbed(giveaway)] })
    .catch(() => null);

  return winners;
}

async function resolveChannel(interaction) {
  let channel = interaction.options.getChannel("channel");
  if (channel) return channel;
  const defaultId = process.env.DEFAULT_CHANNEL_ID;
  if (!defaultId) {
    return "Please specify a `channel`, or set `DEFAULT_CHANNEL_ID` in the `.env`.";
  }
  channel = await interaction.guild.channels.fetch(defaultId).catch(() => null);
  if (!channel) return `Could not find the default channel (\`${defaultId}\`).`;
  return channel;
}

async function launchGiveaway(interaction, cfg) {
  const giveaway = {
    messageId: null,
    channelId: cfg.channel.id,
    guildId: interaction.guildId,
    hostId: interaction.user.id,
    emoji: cfg.emoji,
    prizes: cfg.prizes,
    title: cfg.title || null,
    theme: cfg.theme || "gold",
    excludeHost: !!cfg.excludeHost,
    endTime: cfg.endTime.toISOString(),
    createdAt: new Date().toISOString(),
    ended: false,
    winners: [],
  };

  const message = await cfg.channel.send({
    embeds: [buildGiveawayEmbed(giveaway)],
  });

  try {
    await message.react(cfg.emoji);
  } catch {
    await message.delete().catch(() => null);
    return null;
  }

  giveaway.messageId = message.id;
  await store.upsert(giveaway);
  await message
    .edit({ embeds: [buildGiveawayEmbed(giveaway)] })
    .catch(() => null);
  return giveaway;
}

function startSummary(giveaway, { emoji, prizes, excludeHost }) {
  return (
    `✅ **เริ่ม giveaway แล้ว!**\n` +
    `📢 ช่อง: <#${giveaway.channelId}>\n` +
    `🎁 รางวัล: ${prizes
      .map((p) => `${p.name}${p.count > 1 ? ` ×${p.count}` : ""}`)
      .join(", ")} (${totalWinners(prizes)} ผู้ชนะ)\n` +
    `⏰ สิ้นสุด: ${formatInZone(new Date(giveaway.endTime))} (${TIMEZONE}) — อีก ${formatDuration(
      new Date(giveaway.endTime).getTime() - Date.now()
    )}\n` +
    (excludeHost ? `🚫 ผู้จัดไม่มีสิทธิ์รับรางวัล\n` : "") +
    `🆔 Message ID: \`${giveaway.messageId}\``
  );
}

async function handleStart(interaction) {
  const channel = await resolveChannel(interaction);
  if (typeof channel === "string") {
    return interaction.reply({ content: channel, flags: 64 });
  }
  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.GuildAnnouncement
  ) {
    return interaction.reply({ content: "Please pick a text channel.", flags: 64 });
  }

  const emoji = interaction.options.getString("emoji").trim();
  const prizes = parsePrizes(interaction.options.getString("prizes"));
  if (prizes.length === 0) {
    return interaction.reply({
      content: "Provide at least one prize.",
      flags: 64,
    });
  }

  const endTime = parseEndTime(interaction.options.getString("end"));
  if (!endTime) {
    return interaction.reply({
      content:
        "Invalid date/time. Use `YYYY-MM-DD HH:mm`, e.g. `2026-10-11 20:00`.",
      flags: 64,
    });
  }
  if (endTime.getTime() <= Date.now()) {
    return interaction.reply({
      content: "The end time must be in the future.",
      flags: 64,
    });
  }

  const title = interaction.options.getString("title");
  const theme = interaction.options.getString("theme") || "gold";
  const excludeHost = interaction.options.getBoolean("exclude_host") ?? false;

  await interaction.deferReply({ flags: 64 });

  const giveaway = await launchGiveaway(interaction, {
    channel,
    emoji,
    prizes,
    title,
    theme,
    excludeHost,
    endTime,
  });
  if (!giveaway) {
    return interaction.editReply({
      content: `Could not react with \`${emoji}\`. Use a standard unicode emoji or an emoji this bot can access.`,
    });
  }

  return interaction.editReply({
    content: startSummary(giveaway, { prizes, excludeHost }),
  });
}

async function handleEnd(interaction) {
  const messageId = interaction.options.getString("message_id").trim();
  const giveaway = store.get(messageId);
  if (!giveaway) {
    return interaction.reply({ content: "No giveaway found.", flags: 64 });
  }
  if (giveaway.ended) {
    return interaction.reply({
      content: "That giveaway already ended. Use `/giveaway reroll`.",
      flags: 64,
    });
  }
  await interaction.deferReply({ flags: 64 });
  await endGiveaway(giveaway);
  return interaction.editReply({ content: "Giveaway ended." });
}

async function handleReroll(interaction) {
  const messageId = interaction.options.getString("message_id").trim();
  const giveaway = store.get(messageId);
  if (!giveaway) {
    return interaction.reply({ content: "No giveaway found.", flags: 64 });
  }
  if (!giveaway.ended) {
    return interaction.reply({
      content: "That giveaway is still running.",
      flags: 64,
    });
  }
  await interaction.deferReply({ flags: 64 });
  const winners = await rerollGiveaway(giveaway);
  if (!winners) {
    return interaction.editReply({
      content: "Could not reroll (message not found).",
    });
  }
  const content = winners.length
    ? winners.map((w) => `<@${w.userId}> won **${w.prize}**`).join("\n")
    : "No valid entries to reroll.";
  return interaction.editReply({ content: `🎲 New winners:\n${content}` });
}

async function handleList(interaction) {
  const guildId = interaction.guildId;
  const active = store
    .all()
    .filter((g) => g.guildId === guildId && !g.ended);

  if (active.length === 0) {
    return interaction.reply({ content: "No active giveaways.", flags: 64 });
  }

  const lines = active
    .sort((a, b) => new Date(a.endTime) - new Date(b.endTime))
    .map(
      (g) =>
        `• <#${g.channelId}> — ${normalizePrizes(g.prizes)
          .map((p) => `${p.name}${p.count > 1 ? ` ×${p.count}` : ""}`)
          .join(", ")} — ends ${formatInZone(
          new Date(g.endTime)
        )} (ID: \`${g.messageId}\`)`
    );

  return interaction.reply({
    content: `**Active giveaways**\n${lines.join("\n")}`,
    flags: 64,
  });
}

function templatePreview(t) {
  return t.prizes
    .map((p) => `${p.name}${p.count > 1 ? ` ×${p.count}` : ""}`)
    .join(", ");
}

async function handleTemplateSave(interaction) {
  const name = interaction.options.getString("name").trim();
  const prizes = parsePrizes(interaction.options.getString("prizes"));
  if (!name || prizes.length === 0) {
    return interaction.reply({
      content: "Need a `name` and at least one prize.",
      flags: 64,
    });
  }
  const tpl = {
    emoji: interaction.options.getString("emoji").trim(),
    prizes,
    title: interaction.options.getString("title") || null,
    theme: interaction.options.getString("theme") || "gold",
    excludeHost: interaction.options.getBoolean("exclude_host") ?? false,
  };
  await settings.saveTemplate(interaction.guildId, name, tpl);
  return interaction.reply({
    content: `✅ บันทึกเทมเพลต **${name}** แล้ว\n🎁 ${templatePreview(
      tpl
    )} · ${tpl.emoji} · 🎭 ธีม ${tpl.theme}`,
    flags: 64,
  });
}

async function handleTemplateUse(interaction) {
  const name = interaction.options.getString("name").trim();
  const tpl = settings.getTemplate(interaction.guildId, name);
  if (!tpl) {
    return interaction.reply({
      content: `ไม่พบเทมเพลต **${name}**. ใช้ \`/giveaway template list\` เพื่อดู.`,
      flags: 64,
    });
  }

  const endTime = parseEndTime(interaction.options.getString("end"));
  if (!endTime) {
    return interaction.reply({
      content:
        "Invalid date/time. Use `YYYY-MM-DD HH:mm`, e.g. `2026-10-11 20:00`.",
      flags: 64,
    });
  }
  if (endTime.getTime() <= Date.now()) {
    return interaction.reply({
      content: "The end time must be in the future.",
      flags: 64,
    });
  }

  const channel = await resolveChannel(interaction);
  if (typeof channel === "string") {
    return interaction.reply({ content: channel, flags: 64 });
  }
  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.GuildAnnouncement
  ) {
    return interaction.reply({ content: "Please pick a text channel.", flags: 64 });
  }

  await interaction.deferReply({ flags: 64 });
  const giveaway = await launchGiveaway(interaction, {
    channel,
    endTime,
    emoji: tpl.emoji,
    prizes: tpl.prizes,
    title: tpl.title,
    theme: tpl.theme,
    excludeHost: tpl.excludeHost,
  });
  if (!giveaway) {
    return interaction.editReply({
      content: `Could not react with \`${tpl.emoji}\`. Use a standard unicode emoji or an emoji this bot can access.`,
    });
  }
  return interaction.editReply({
    content: `✅ ใช้เทมเพลต **${name}**\n${startSummary(giveaway, {
      prizes: tpl.prizes,
      excludeHost: tpl.excludeHost,
    })}`,
  });
}

async function handleTemplateList(interaction) {
  const tpls = Object.values(settings.getTemplates(interaction.guildId));
  if (tpls.length === 0) {
    return interaction.reply({
      content: "ยังไม่มีเทมเพลต. ใช้ `/giveaway template save` ครับ.",
      flags: 64,
    });
  }
  const lines = tpls.map(
    (t) =>
      `• **${t.name}** — ${templatePreview(t)} · ${t.emoji} · 🎭 ${t.theme}`
  );
  return interaction.reply({
    content: `**เทมเพลตที่บันทึกไว้**\n${lines.join("\n")}`,
    flags: 64,
  });
}

async function handleTemplateDelete(interaction) {
  const name = interaction.options.getString("name").trim();
  const ok = settings.deleteTemplate(interaction.guildId, name);
  return interaction.reply({
    content: ok ? `🗑️ ลบเทมเพลต **${name}** แล้ว` : `ไม่พบเทมเพลต **${name}**`,
    flags: 64,
  });
}

async function handleAnnounceSet(interaction) {
  const text = interaction.options.getString("text");
  const cfg = settings.getConfig(interaction.guildId);
  await settings.setConfig(interaction.guildId, { announceText: text });

  let danger = "";
  if (!/{\w+}/.test(text)) {
    danger =
      "\n⚠️ ยังไม่เห็น placeholder `{winners}` `{prizes}` `{title}` `{count}` — แนะนำให้ใส่ด้วยครับ";
  }
  return interaction.reply({
    content:
      `✅ ตั้งข้อความประกาศผลแล้ว\nตัวอย่าง: ${renderAnnounce(text, {
        winners: "@userA, @userB",
        prizes: "รางวัล1, รางวัล2",
        title: "GIVEAWAY",
        count: "2",
      })}${danger}` +
      (cfg.announceText
        ? `\n\n(เดิม: ${cfg.announceText})`
        : ""),
    flags: 64,
  });
}

async function handleAnnounceReset(interaction) {
  await settings.setConfig(interaction.guildId, { announceText: null });
  return interaction.reply({
    content: "↩️ กลับเป็นข้อความประกาศผลแบบ default แล้ว",
    flags: 64,
  });
}

async function handleAnnounceShow(interaction) {
  const cfg = settings.getConfig(interaction.guildId);
  return interaction.reply({
    content: cfg.announceText
      ? `**ข้อความประกาศผลปัจจุบัน**\n${cfg.announceText}`
      : "กำลังใช้ข้อความ default (ยังไม่ได้ตั้งเอง)",
    flags: 64,
  });
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "giveaway") return;

  try {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    if (group === "template") {
      if (sub === "save") await handleTemplateSave(interaction);
      else if (sub === "use") await handleTemplateUse(interaction);
      else if (sub === "list") await handleTemplateList(interaction);
      else if (sub === "delete") await handleTemplateDelete(interaction);
    } else if (group === "announce") {
      if (sub === "set") await handleAnnounceSet(interaction);
      else if (sub === "reset") await handleAnnounceReset(interaction);
      else if (sub === "show") await handleAnnounceShow(interaction);
    } else if (sub === "start") await handleStart(interaction);
    else if (sub === "end") await handleEnd(interaction);
    else if (sub === "reroll") await handleReroll(interaction);
    else if (sub === "list") await handleList(interaction);
  } catch (err) {
    console.error("Command error:", err);
    const payload = { content: "Something went wrong.", flags: 64 };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
});

async function sweep() {
  const now = Date.now();
  for (const giveaway of store.all()) {
    if (giveaway.ended) continue;
    if (new Date(giveaway.endTime).getTime() <= now) {
      try {
        await endGiveaway(giveaway);
      } catch (err) {
        console.error(`Failed to end giveaway ${giveaway.messageId}:`, err);
      }
    }
  }
}

async function registerCommands() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!clientId) {
    console.warn("DISCORD_CLIENT_ID not set; skipping command registration.");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`Registered commands to guild ${guildId} (instant).`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log("Registered global commands (may take up to 1 hour).");
    }
  } catch (err) {
    console.error("Failed to register commands:", err.message);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  await registerCommands();
  await store.load();
  await settings.load();
  console.log(`Loaded ${store.all().length} giveaway(s) from disk.`);
  await sweep();
  setInterval(sweep, SWEEP_INTERVAL_MS);
});

client.login(TOKEN);
