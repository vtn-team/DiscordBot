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

    // Notionからロール情報を取得
    this._roles = await getDiscordRoles();
    console.log(`${this._roles.length} 個のロールを取得しました。`);

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
          if (!member) continue;

          const role = guild.roles.cache.get(r.RoleId);
          if (!role) continue;

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
              'エラーが出ちゃいました。講師かスタッフにお問い合わせください。'
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
    msg += 'どの職種でアサインされているかは、以下の資料を確認してください。\r\n';
    msg += 'https://candle-stoplight-544.notion.site/5294189c9dc44dbaa6114629aa007fba?pvs=4\r\n\r\n';
    msg += 'なお、メインジョブ・サブジョブ共に「これもやりたい」ロールを追加してもかまいません。\r\n\r\n';

    msg += '----\r\nメインジョブ\r\n\r\n以下の担当職種と一致するリアクションを押してください！\n\n';
    for (const r of this._roles) {
      if (!r.RoleName.includes('メインジョブ')) continue;
      msg += `${r.Emoji} ${r.RoleName.replace('メインジョブ:', '')}\r\n`;
    }

    msg += '----\r\n\r\n----\r\nサブジョブ\r\n\r\n';
    for (const r of this._roles) {
      if (!r.RoleName.includes('サブジョブ')) continue;
      msg += `${r.Emoji} ${r.RoleName.replace('サブジョブ:', '')}\r\n`;
    }

    msg += '----\r\n\r\n※サブジョブは人数が少なく需要が変動する可能性があるため、チームの垣根を越えてやり取りする可能性があります。\r\n';
    return msg;
  }

  async _sendTeamMessage(user) {
    try {
      const dmMessage = await user.send(this._getTeamMessage(user.username));
      for (const r of this._roles) {
        if (!r.RoleName.includes('チーム')) continue;
        await dmMessage.react(r.Emoji);
      }
    } catch (err) {
      console.error(`チームDM送信エラー (${user.tag}):`, err.message);
    }
  }

  async _sendRoleMessage(user) {
    try {
      const dmMessage = await user.send(this._getRoleMessage(user.username));
      for (const r of this._roles) {
        if (!r.RoleName.includes('メインジョブ') && !r.RoleName.includes('サブジョブ')) continue;
        await dmMessage.react(r.Emoji);
      }
    } catch (err) {
      console.error(`ロールDM送信エラー (${user.tag}):`, err.message);
    }
  }
}

module.exports = RoleAssignBotClient;
