# GitHub Invitation Tool

DiscordのスラッシュコマンドからGitHub Organizationへの招待を管理するツールです。

## 機能

- `/github-invite` - ユーザーをOrganizationに招待
- `/github-invite-list` - 保留中の招待一覧を表示
- `/github-invite-cancel` - 保留中の招待をキャンセル

## セットアップ

### 1. 依存パッケージのインストール

```bash
cd github-invitation-tool
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` にコピーし、各値を設定してください。

```bash
cp .env.example .env
```

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `DISCORD_TOKEN` | Yes | Discord Botのトークン |
| `DISCORD_CLIENT_ID` | Yes | DiscordアプリケーションのクライアントID |
| `DISCORD_GUILD_ID` | No | ギルドID（指定するとギルドコマンドとして即時登録） |
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token (`admin:org` スコープ必要) |
| `GITHUB_ORG` | Yes | 招待先のGitHub Organization名 |

### 3. GitHub Token の作成

GitHub Settings > Developer settings > Personal access tokens で、`admin:org` スコープを持つトークンを作成してください。

### 4. スラッシュコマンドの登録

```bash
npm run deploy-commands
```

### 5. Botの起動

```bash
npm start
```

## コマンド詳細

### `/github-invite`

| オプション | 必須 | 説明 |
|-----------|------|------|
| `username` | Yes | 招待するGitHubユーザー名 |
| `role` | No | ロール（メンバー/管理者、デフォルト: メンバー） |

### `/github-invite-list`

保留中の招待一覧を表示します。オプションはありません。

### `/github-invite-cancel`

| オプション | 必須 | 説明 |
|-----------|------|------|
| `username` | Yes | キャンセルするGitHubユーザー名 |

> **注意**: すべてのコマンドはDiscordサーバーの管理者権限が必要です。
