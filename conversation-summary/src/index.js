const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const SummaryGenerator = require('./summary-generator');

/**
 * setting.json を読み込む
 * 優先順位: カレントディレクトリ → 親ディレクトリ(nodejs/) → ルートディレクトリ
 */
function loadSettings() {
  const candidates = [
    path.join(__dirname, '..', 'setting.json'),
    path.join(__dirname, '..', '..', 'nodejs', 'setting.json'),
    path.join(__dirname, '..', '..', 'setting.json'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const json = fs.readFileSync(filePath, 'utf-8');
      console.log(`[ConversationSummary] 設定ファイル読み込み: ${filePath}`);
      return JSON.parse(json);
    }
  }

  return null;
}

async function main() {
  const settings = loadSettings();
  if (!settings || !settings.BotToken || !settings.GuildId) {
    console.error(
      'Error: setting.json が見つからないか、BotToken/GuildId が設定されていません。'
    );
    console.error('setting.json の形式:');
    console.error(
      JSON.stringify({ BotToken: 'YOUR_BOT_TOKEN', GuildId: 'YOUR_GUILD_ID' }, null, 2)
    );
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });

  try {
    // Discordにログイン
    await client.login(settings.BotToken);

    // ready イベントを待機
    await new Promise((resolve) => {
      if (client.isReady()) {
        resolve();
      } else {
        client.once('ready', resolve);
      }
    });

    console.log(`[ConversationSummary] ログイン成功: ${client.user.tag}`);

    // サマリー生成
    const outputDir = path.join(__dirname, '..', 'output');
    const generator = new SummaryGenerator(client, settings.GuildId);
    const filePath = await generator.generate(outputDir);

    console.log(`[ConversationSummary] 完了: ${filePath}`);
  } catch (err) {
    console.error('[ConversationSummary] エラー:', err.message);
    process.exit(1);
  } finally {
    client.destroy();
  }
}

main();
