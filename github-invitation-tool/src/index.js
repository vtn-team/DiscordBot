require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, GatewayIntentBits, Events } = require("discord.js");
const GitHubClient = require("./github");

// 環境変数のバリデーション
const requiredEnvVars = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "GITHUB_TOKEN",
  "GITHUB_ORG",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`環境変数 ${envVar} が設定されていません。`);
    process.exit(1);
  }
}

// クライアントの初期化
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const githubClient = new GitHubClient(process.env.GITHUB_TOKEN);

// コマンドの読み込み
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`コマンドを読み込みました: ${command.data.name}`);
  }
}

// インタラクションハンドラー
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, githubClient);
  } catch (error) {
    console.error(`コマンド実行エラー:`, error);
    try {
      const reply = {
        content: "コマンドの実行中にエラーが発生しました。",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch (replyError) {
      console.error("エラー応答の送信に失敗しました:", replyError.message);
    }
  }
});

// Bot起動
client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag} としてログインしました。`);
});

client.login(process.env.DISCORD_TOKEN);
