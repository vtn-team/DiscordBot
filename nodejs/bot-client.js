const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { getDiscordRoles } = require('./notion-wrapper');
const LocalData = require('./local-data');

class RoleAssignBotClient {
  constructor() {
    this._client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
      ],
    });

    this._roles = [];
    this._settings = null;

    // イベントハンドラ登録
    this._client.on('ready', () => this._onReady());
    this._client.on('guildMemberAdd', (member) => this._onJoinUser(member));
    this._client.on('messageCreate', (message) => this._onMessage(message));
    this._client.on('messageReactionAdd', (reaction, user) => this._onReaction(reaction, user));
  }

  /**
   * ボットを起動する
   */
  async run() {
    this._settings = LocalData.load('setting.json');
    if (!this._settings) {
      console.error('Error: setting.json が見つかりません。');
      process.exit(1);
    }

    // ローカルJSONからロール情報を読み込む
    this._roles = getDiscordRoles();

    // Discordにログイン
    await this._client.login(this._settings.BotToken);
  }

  // --- イベントハンドラ ---

  _onReady() {
    console.log(`${this._client.user.tag} is Running!!`);

    const guild = this._client.guilds.cache.get(this._settings.GuildId);
    if (guild) {
      guild.roles.cache.forEach((role) => {
        console.log(`${role.name} (${role.id})`);
      });
    }
  }

  async _onJoinUser(member) {
    console.log(member.guild.name);
    console.log(member.user.username);

    // チーム選択DM
    await this._sendTeamMessage(member.user);
    // ジョブ選択DM
    await this._sendRoleMessage(member.user);
  }

  async _onMessage(message) {
    // BOT自身の発言は無視
    if (message.author.id === this._client.user.id) return;

    console.log(message.content);

    if (message.content === 'ジョブ') {
      await this._sendRoleMessage(message.author);
    }

    if (message.content === 'チーム') {
      await this._sendTeamMessage(message.author);
    }

    if (message.content === 'ロール一覧') {
      // Discordサーバーのロール一覧を表示
      const guild = this._client.guilds.cache.get(this._settings.GuildId);
      if (guild) {
        const roles = guild.roles.cache
          .filter((r) => r.id !== guild.id) // @everyone を除外
          .sort((a, b) => b.position - a.position);

        let msg = '**Discordサーバーのロール一覧:**\r\n\r\n';
        roles.forEach((r) => {
          msg += `- ${r.name} (ID: ${r.id})\r\n`;
        });
        await message.channel.send(msg);
      }
    }
  }

  async _onReaction(reaction, user) {
    // BOT自身のリアクションは無視
    if (user.id === this._client.user.id) return;

    // partialの場合はフェッチ
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        console.error('リアクション取得エラー:', err);
        return;
      }
    }

    console.log(`${user.tag} reacted with ${reaction.emoji.name}`);

    try {
      const guild = this._client.guilds.cache.get(this._settings.GuildId);
      if (!guild) return;

      for (const r of this._roles) {
        if (reaction.emoji.name === r.Emoji) {
          const member = await guild.members.fetch(user.id).catch(() => null);
          if (!member) break;

          const role = guild.roles.cache.get(r.RoleId);
          if (!role) break;

          await member.roles.add(role);
          console.log(`ロール "${role.name}" を ${user.tag} に付与しました。`);
        }
      }
    } catch (err) {
      console.error('ロール付与エラー:', err.message);

      // エラーをユーザーにDMで通知
      try {
        const guild = this._client.guilds.cache.get(this._settings.GuildId);
        if (guild) {
          const member = await guild.members.fetch(user.id).catch(() => null);
          if (member) {
            await member.send(
              'エラーが出ちゃいました。講師かスタッフにエラー内容を問い合わせてください。\r\nエラー内容:\r\n' +
                err.message
            );
          }
        }
      } catch (dmErr) {
        console.error('DM送信エラー:', dmErr.message);
      }
    }
  }

  // --- メッセージ生成・送信 ---

  _getTeamMessage(name) {
    let msg = `こんにちは、${name}さん！ \r\n**あなたの「所属チーム」を教えてください！**\r\n\r\n`;
    msg += '----\r\nチームと一致するリアクションを押してください！\n\n';

    for (const r of this._roles) {
      if (!r.RoleName.includes('チーム')) continue;
      msg += `${r.Emoji} ${r.RoleName}\r\n`;
    }
    return msg;
  }

  _getRoleMessage(name) {
    let msg = `こんにちは、${name}さん！ \r\n**あなたの「担当職種」を教えてください！**\r\n\r\n`;
    msg += '「これもやりたい」ロールを追加してもかまいません。\r\n\r\n';

    msg += '----\r\n以下の担当職種と一致するリアクションを押してください！\n\n';
    for (const r of this._roles) {
      if (r.RoleName.includes('チーム')) continue;
      msg += `${r.Emoji} ${r.RoleName}\r\n`;
    }

    msg += '----\r\n';
    return msg;
  }

  async _sendTeamMessage(user) {
    const dmMessage = await user.send(this._getTeamMessage(user.username));
    for (const r of this._roles) {
      if (!r.RoleName.includes('チーム')) continue;
      await dmMessage.react(r.Emoji);
    }
  }

  async _sendRoleMessage(user) {
    const dmMessage = await user.send(this._getRoleMessage(user.username));
    for (const r of this._roles) {
      if (r.RoleName.includes('チーム')) continue;
      await dmMessage.react(r.Emoji);
    }
  }
}

module.exports = RoleAssignBotClient;
