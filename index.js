const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

const http = require("http");

const TOKEN = process.env.DISCORD_TOKEN;
const AFK_CHANNEL_ID = "1556742017537679462";
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN in Render Environment Variables.");
  process.exit(1);
}

// Render health server.
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Bot is online.");
}).listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server listening on 0.0.0.0:${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

function isStaff(member) {
  return member?.permissions?.has(PermissionsBitField.Flags.ManageGuild) ||
         member?.permissions?.has(PermissionsBitField.Flags.ManageChannels);
}

let afkConnecting = false;
let afkRetryTimer = null;
let afkConnection = null;

async function connectToAfk() {
  if (afkConnecting) return;
  afkConnecting = true;

  try {
    const channel = await client.channels.fetch(AFK_CHANNEL_ID);

    if (!channel || channel.type !== ChannelType.GuildVoice) {
      console.error(`AFK channel ${AFK_CHANNEL_ID} is missing or is not a voice channel.`);
      scheduleAfkRetry(10000);
      return;
    }

    if (afkConnection) {
      try { afkConnection.destroy(); } catch {}
      afkConnection = null;
    }

    afkConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    afkConnection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`AFK connected: ${channel.name} (${channel.id})`);
    });

    afkConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log("AFK voice disconnected; attempting recovery...");
      try {
        await Promise.race([
          entersState(afkConnection, VoiceConnectionStatus.Signalling, 5000),
          entersState(afkConnection, VoiceConnectionStatus.Connecting, 5000),
        ]);
        console.log("AFK voice connection recovered.");
      } catch {
        try { afkConnection.destroy(); } catch {}
        afkConnection = null;
        scheduleAfkRetry(3000);
      }
    });

    afkConnection.on(VoiceConnectionStatus.Destroyed, () => {
      if (client.isReady()) scheduleAfkRetry(3000);
    });
  } catch (err) {
    console.error("AFK connection failed:", err);
    scheduleAfkRetry(10000);
  } finally {
    afkConnecting = false;
  }
}

function scheduleAfkRetry(delay) {
  if (afkRetryTimer || !client.isReady()) return;
  afkRetryTimer = setTimeout(async () => {
    afkRetryTimer = null;
    await connectToAfk();
  }, delay);
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await connectToAfk();
});

// Reconnect if the bot changes guild/voice state or loses its voice connection.
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (newState.id !== client.user.id) return;
  if (newState.channelId !== AFK_CHANNEL_ID) {
    scheduleAfkRetry(3000);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith("!")) return;

  const withoutPrefix = message.content.slice(1).trim();
  const [command, ...args] = withoutPrefix.split(/\s+/);
  const cmd = command?.toLowerCase();

  // !took <anything>
  if (cmd === "took") {
    const text = message.content.slice((1 + command.length)).trim();

    if (!text) {
      await message.reply("اكتب الكلام بعد !took");
      return;
    }

    const safeText = text.replace(/@everyone|@here/g, "@ everyone");

    try {
      await message.delete();
      await message.channel.send({
        content: safeText,
        allowedMentions: {
          users: [...message.mentions.users.keys()],
          roles: [],
          repliedUser: false,
        },
      });
    } catch (err) {
      console.error("!took error:", err);
    }
    return;
  }

  // !مسح 10/20/30/40/50
  if (cmd === "مسح" || cmd === "clear") {
    if (!isStaff(message.member)) {
      await message.reply("ما عندك صلاحية تستخدم الأمر.");
      return;
    }

    const amount = Number(args[0]);
    if (![10, 20, 30, 40, 50].includes(amount)) {
      await message.reply("استخدم: !مسح 10 أو 20 أو 30 أو 40 أو 50");
      return;
    }

    try {
      const deleted = await message.channel.bulkDelete(amount, true);
      const reply = await message.channel.send(`تم مسح ${deleted.size} رسالة.`);
      setTimeout(() => reply.delete().catch(() => {}), 3000);
    } catch (err) {
      console.error("clear error:", err);
      await message.reply("ما قدرت أمسح الرسائل. تأكد من صلاحيات البوت.");
    }
    return;
  }

  // !ticket — staff only, sends the ticket panel.
  if (cmd === "ticket") {
    if (!isStaff(message.member)) {
      await message.reply("ما عندك صلاحية تستخدم الأمر.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🎫 التذاكر")
      .setDescription("اختر نوع التكت من الأزرار بالأسفل.")
      .setColor(0x7c3aed);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_player_report")
        .setLabel("بلاغ على لاعب")
        .setEmoji("🚨")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ticket_clan")
        .setLabel("تقديم على كلان")
        .setEmoji("⚔️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("ticket_creator")
        .setLabel("تقديم على صناع المحتوى")
        .setEmoji("🎥")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("ticket_admin_report")
        .setLabel("بلاغ على إداري")
        .setEmoji("👮")
        .setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row1] });
    await message.delete().catch(() => {});
    return;
  }
});

const ticketTypes = {
  ticket_player_report: { name: "بلاغ-على-لاعب", emoji: "🚨", title: "بلاغ على لاعب" },
  ticket_clan: { name: "تقديم-على-كلان", emoji: "⚔️", title: "تقديم على كلان" },
  ticket_creator: { name: "تقديم-صناع-المحتوى", emoji: "🎥", title: "تقديم على صناع المحتوى" },
  ticket_admin_report: { name: "بلاغ-على-إداري", emoji: "👮", title: "بلاغ على إداري" },
};

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // Ticket creation.
  if (ticketTypes[interaction.customId]) {
    const guild = interaction.guild;
    const type = ticketTypes[interaction.customId];

    const existing = guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.topic === `ticket-owner:${interaction.user.id}`
    );

    if (existing) {
      await interaction.reply({
        content: `عندك تكت مفتوح بالفعل: ${existing}`,
        ephemeral: true,
      });
      return;
    }

    let category = guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildCategory &&
        ch.name.toLowerCase() === "tickets"
    );

    if (!category) {
      category = await guild.channels.create({
        name: "Tickets",
        type: ChannelType.GuildCategory,
      });
    }

    const ticket = await guild.channels.create({
      name: `${type.name}-${interaction.user.username}`.slice(0, 100),
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `ticket-owner:${interaction.user.id}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles,
          ],
        },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels,
          ],
        },
      ],
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("إغلاق التكت")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger)
    );

    await ticket.send({
      content: `${interaction.user}`,
      embeds: [
        new EmbedBuilder()
          .setTitle(`${type.emoji} ${type.title}`)
          .setDescription("اكتب تفاصيل طلبك هنا، وبعد الانتهاء يمكن إغلاق التكت.")
          .setColor(0x7c3aed),
      ],
      components: [closeRow],
    });

    await interaction.reply({
      content: `تم فتح التكت: ${ticket}`,
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === "ticket_close") {
    const ownerId = interaction.channel.topic?.replace("ticket-owner:", "");

    if (!isStaff(interaction.member) && ownerId !== interaction.user.id) {
      await interaction.reply({
        content: "ما عندك صلاحية تغلق هذا التكت.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply("جاري إغلاق التكت...");
    setTimeout(() => interaction.channel.delete().catch(() => {}), 1500);
  }
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

client.login(TOKEN);
