const fs = require('fs');
const path = require('path');
const { SnowflakeUtil } = require('discord.js');

const SUMMARY_HOUR = 22;
const MAX_CONTENT_LENGTH = 80;

class SummaryGenerator {
  /**
   * @param {import('discord.js').Client} client
   * @param {string} guildId
   */
  constructor(client, guildId) {
    this._client = client;
    this._guildId = guildId;
  }

  /**
   * サマリーを生成してMarkdownファイルに保存する
   * @param {string} outputDir 出力先ディレクトリ
   * @returns {Promise<string>} 出力ファイルパス
   */
  async generate(outputDir) {
    const guild = this._client.guilds.cache.get(this._guildId);
    if (!guild) {
      throw new Error('ギルドが見つかりません');
    }

    // 集計期間: 前日22:00 〜 当日22:00
    const { startTime, endTime } = this._getTimeRange();
    console.log(
      `[SummaryGenerator] 集計期間: ${this._formatDate(startTime)} 〜 ${this._formatDate(endTime)}`
    );

    // 「チーム」を含むカテゴリを取得
    const teamCategories = guild.channels.cache.filter(
      (ch) => ch.type === 4 && ch.name.includes('チーム')
    );

    if (teamCategories.size === 0) {
      throw new Error('「チーム」を含むカテゴリが見つかりません');
    }

    const lines = [];
    lines.push(
      `# 会話まとめ (${this._formatDate(startTime)} 〜 ${this._formatDate(endTime)})`
    );
    lines.push('');

    let totalMessages = 0;

    for (const [, category] of teamCategories) {
      const categoryLines = [];
      categoryLines.push(`## ${category.name}`);
      categoryLines.push('');

      let hasMessages = false;

      // カテゴリ内のテキストチャンネルを取得
      const textChannels = guild.channels.cache
        .filter((ch) => ch.parentId === category.id && ch.isTextBased() && ch.type === 0)
        .sort((a, b) => a.position - b.position);

      for (const [, channel] of textChannels) {
        const messages = await this._getMessagesInRange(channel, startTime, endTime);
        if (messages.length === 0) continue;

        hasMessages = true;
        totalMessages += messages.length;

        categoryLines.push(`### #${channel.name}`);
        categoryLines.push('');
        categoryLines.push('| 名前 | 日時 | 会話内容 | リアクション件数 |');
        categoryLines.push('| --- | --- | --- | --- |');

        for (const msg of messages) {
          const name = msg.author.displayName || msg.author.username;
          const timestamp = this._formatTimestamp(msg.createdAt);
          const content = this._truncateContent(msg.content);
          const reactionCount = this._countReactions(msg);

          categoryLines.push(`| ${name} | ${timestamp} | ${content} | ${reactionCount} |`);
        }

        categoryLines.push('');
      }

      if (hasMessages) {
        lines.push(...categoryLines);
      }
    }

    if (totalMessages === 0) {
      lines.push('対象期間の会話はありませんでした。');
      lines.push('');
    }

    // 出力ディレクトリを作成
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // ファイル名: summary_YYYY-MM-DD.md
    const dateStr = this._toDateString(endTime);
    const fileName = `summary_${dateStr}.md`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    console.log(
      `[SummaryGenerator] 保存完了: ${filePath} (${totalMessages} 件のメッセージ)`
    );

    return filePath;
  }

  /**
   * 集計期間を計算する（前日22:00 〜 当日22:00）
   */
  _getTimeRange() {
    const now = new Date();

    const endTime = new Date(now);
    endTime.setHours(SUMMARY_HOUR, 0, 0, 0);

    // 現在時刻が22時より前の場合は前日基準に調整
    if (now.getHours() < SUMMARY_HOUR) {
      endTime.setDate(endTime.getDate() - 1);
    }

    const startTime = new Date(endTime);
    startTime.setDate(startTime.getDate() - 1);

    return { startTime, endTime };
  }

  /**
   * 指定期間のメッセージを取得する
   * @param {import('discord.js').TextChannel} channel
   * @param {Date} startTime
   * @param {Date} endTime
   * @returns {Promise<import('discord.js').Message[]>}
   */
  async _getMessagesInRange(channel, startTime, endTime) {
    const result = [];
    const endSnowflake = SnowflakeUtil.generate({ timestamp: endTime.getTime() });

    let lastId = endSnowflake.toString();
    let keepFetching = true;

    while (keepFetching) {
      const messages = await channel.messages.fetch({
        before: lastId,
        limit: 100,
      });

      if (messages.size === 0) break;

      for (const [, msg] of messages) {
        if (msg.createdAt < startTime) {
          keepFetching = false;
          break;
        }

        // BOTのメッセージは除外
        if (msg.author.bot) continue;

        result.push(msg);
      }

      lastId = messages.last().id;
    }

    // 時系列順にソート（古い順）
    result.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    return result;
  }

  /**
   * リアクション合計数を取得する
   * @param {import('discord.js').Message} message
   * @returns {number}
   */
  _countReactions(message) {
    let count = 0;
    for (const [, reaction] of message.reactions.cache) {
      count += reaction.count;
    }
    return count;
  }

  /**
   * メッセージ内容を短縮する
   * @param {string} content
   * @returns {string}
   */
  _truncateContent(content) {
    if (!content || content.trim() === '') {
      return '(添付/埋め込み)';
    }

    // 改行をスペースに置換
    let singleLine = content.replace(/\r?\n/g, ' ');
    // パイプ文字をエスケープ（テーブル崩れ防止）
    singleLine = singleLine.replace(/\|/g, '｜');

    if (singleLine.length > MAX_CONTENT_LENGTH) {
      singleLine = singleLine.substring(0, MAX_CONTENT_LENGTH - 3) + '...';
    }

    return singleLine;
  }

  /**
   * Date を "YYYY/MM/DD HH:mm" 形式にフォーマットする
   * @param {Date} date
   * @returns {string}
   */
  _formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${d} ${hh}:${mm}`;
  }

  /**
   * Date を "MM/DD HH:mm" 形式にフォーマットする
   * @param {Date} date
   * @returns {string}
   */
  _formatTimestamp(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${m}/${d} ${hh}:${mm}`;
  }

  /**
   * Date を "YYYY-MM-DD" 形式にフォーマットする
   * @param {Date} date
   * @returns {string}
   */
  _toDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

module.exports = SummaryGenerator;
