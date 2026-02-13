import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { InviteService } from "./invite-service.js";

// .env ファイルの簡易読み込み（dotenv不要）
function loadEnvFile() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .envファイルがなくても環境変数で設定可能
  }
}

const USAGE = `
Notion ページ招待ツール

使い方:
  node src/index.js users                           ワークスペースのユーザー一覧を表示
  node src/index.js page <pageId>                   ページ情報を表示
  node src/index.js invite <pageId> <email>         ユーザーをページに招待
  node src/index.js invite <pageId> <email1,email2> 複数ユーザーをまとめて招待

オプション:
  --method <auto|mention|property>  招待方法を指定 (デフォルト: auto)
  --message <text>                  メンションに付けるメッセージ

環境変数:
  NOTION_API_KEY  Notion インテグレーションのAPIキー (必須)

例:
  node src/index.js users
  node src/index.js page abc123def456
  node src/index.js invite abc123def456 user@example.com
  node src/index.js invite abc123def456 user@example.com --message "確認お願いします"
  node src/index.js invite abc123def456 a@example.com,b@example.com
`.trim();

async function main() {
  loadEnvFile();

  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    console.error(
      "エラー: NOTION_API_KEY 環境変数が設定されていません。\n" +
        ".env ファイルに NOTION_API_KEY=secret_xxx を設定するか、\n" +
        "環境変数として NOTION_API_KEY=secret_xxx node src/index.js ... のように指定してください。"
    );
    process.exit(1);
  }

  const service = new InviteService(apiKey);
  const command = args[0];

  switch (command) {
    case "users":
      await handleUsers(service);
      break;
    case "page":
      await handlePage(service, args);
      break;
    case "invite":
      await handleInvite(service, args);
      break;
    default:
      console.error(`不明なコマンド: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

async function handleUsers(service) {
  console.log("ワークスペースのユーザー一覧を取得中...\n");
  const users = await service.getWorkspaceUsers();

  if (users.length === 0) {
    console.log("ユーザーが見つかりませんでした。");
    return;
  }

  console.log(`${users.length} 人のユーザーが見つかりました:\n`);
  for (const user of users) {
    console.log(`  ID:    ${user.id}`);
    console.log(`  名前:  ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log("");
  }
}

async function handlePage(service, args) {
  const pageId = args[1];
  if (!pageId) {
    console.error("エラー: ページIDを指定してください。");
    process.exit(1);
  }

  console.log("ページ情報を取得中...\n");
  const info = await service.getPageInfo(pageId);

  console.log(`  タイトル:   ${info.title}`);
  console.log(`  ID:         ${info.id}`);
  console.log(`  URL:        ${info.url}`);
  console.log(`  親タイプ:   ${info.parentType}`);
  console.log(`  アーカイブ: ${info.archived ? "はい" : "いいえ"}`);
}

async function handleInvite(service, args) {
  const pageId = args[1];
  const emailArg = args[2];

  if (!pageId || !emailArg) {
    console.error("エラー: ページIDとメールアドレスを指定してください。");
    console.error("使い方: node src/index.js invite <pageId> <email>");
    process.exit(1);
  }

  const options = parseOptions(args.slice(3));
  const emails = emailArg.split(",").map((e) => e.trim()).filter((e) => e);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const email of emails) {
    if (!emailRegex.test(email)) {
      console.error(`エラー: 不正なメールアドレス形式です: ${email}`);
      process.exit(1);
    }
  }

  if (emails.length === 1) {
    console.log(`"${emails[0]}" をページに招待中...\n`);
    const result = await service.inviteUser(pageId, emails[0], options);
    printResult(result);
  } else {
    console.log(`${emails.length} 人のユーザーをページに招待中...\n`);
    const results = await service.inviteUsers(pageId, emails, options);
    for (const result of results) {
      printResult(result);
      console.log("---");
    }
  }
}

function parseOptions(args) {
  const validMethods = ["auto", "mention", "property"];
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--method" && args[i + 1]) {
      if (!validMethods.includes(args[i + 1])) {
        console.error(`エラー: 不正なメソッドです: ${args[i + 1]} (有効な値: ${validMethods.join(", ")})`);
        process.exit(1);
      }
      options.method = args[i + 1];
      i++;
    } else if (args[i] === "--message" && args[i + 1]) {
      options.message = args[i + 1];
      i++;
    }
  }
  return options;
}

function printResult(result) {
  if (result.error) {
    console.error(`エラー [${result.user.email}]: ${result.error}`);
    return;
  }

  console.log(`ユーザー: ${result.user.name} (${result.user.email})`);
  console.log(`ページ:   ${result.page.title}`);
  console.log(`URL:      ${result.page.url}`);
  console.log("結果:");

  for (const action of result.actions) {
    const status = action.success ? "OK" : "NG";
    console.log(`  [${status}] ${action.detail}`);
  }
}

main().catch((err) => {
  console.error(`エラーが発生しました: ${err.message}`);
  process.exit(1);
});
