require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const requiredEnvVars = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`環境変数 ${envVar} が設定されていません。`);
    process.exit(1);
  }
}

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ("data" in command) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`${commands.length} 個のスラッシュコマンドを登録中...`);

    if (process.env.DISCORD_GUILD_ID) {
      // ギルド固有のコマンドとして登録（即時反映）
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID,
          process.env.DISCORD_GUILD_ID
        ),
        { body: commands }
      );
      console.log("ギルドコマンドとして登録しました。");
    } else {
      // グローバルコマンドとして登録（反映に最大1時間）
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commands }
      );
      console.log("グローバルコマンドとして登録しました。");
    }
  } catch (error) {
    console.error("コマンド登録エラー:", error);
  }
})();
