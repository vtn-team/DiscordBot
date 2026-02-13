const RoleAssignBotClient = require('./bot-client');

async function main() {
  const bot = new RoleAssignBotClient();
  await bot.run();
}

main().catch((err) => {
  console.error('起動エラー:', err);
  process.exit(1);
});
