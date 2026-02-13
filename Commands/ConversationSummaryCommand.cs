using Discord;
using Discord.WebSocket;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DiscordBot.Commands
{
    /// <summary>
    /// 会話まとめコマンド
    /// 「チーム」を含むカテゴリのチャンネルから前日22時〜当日22時の会話を収集し、
    /// 「会話まとめ」チャンネルに投稿する
    /// </summary>
    public class ConversationSummaryCommand
    {
        private const string SummaryChannelName = "会話まとめ";
        private const int SummaryHour = 22; // 22:00基準

        private readonly DiscordSocketClient _client;
        private readonly ulong _guildId;

        public ConversationSummaryCommand(DiscordSocketClient client, ulong guildId)
        {
            _client = client;
            _guildId = guildId;
        }

        /// <summary>
        /// 会話まとめを実行する
        /// </summary>
        public async Task ExecuteAsync()
        {
            var guild = _client.GetGuild(_guildId);
            if (guild == null)
            {
                Console.WriteLine("[ConversationSummary] ギルドが見つかりません");
                return;
            }

            // 「会話まとめ」チャンネルを探す
            var summaryChannel = guild.TextChannels
                .FirstOrDefault(c => c.Name == SummaryChannelName);

            if (summaryChannel == null)
            {
                Console.WriteLine($"[ConversationSummary] 「{SummaryChannelName}」チャンネルが見つかりません");
                return;
            }

            // 集計期間: 前日22:00 〜 当日22:00
            var now = DateTime.Now;
            var endTime = now.Date.AddHours(SummaryHour);
            var startTime = endTime.AddDays(-1);

            // 現在時刻が22時より前の場合は前日基準に調整
            if (now.Hour < SummaryHour)
            {
                endTime = endTime.AddDays(-1);
                startTime = startTime.AddDays(-1);
            }

            Console.WriteLine($"[ConversationSummary] 集計期間: {startTime:yyyy/MM/dd HH:mm} 〜 {endTime:yyyy/MM/dd HH:mm}");

            // 「チーム」を含むカテゴリを取得
            var teamCategories = guild.CategoryChannels
                .Where(c => c.Name.Contains("チーム"))
                .ToList();

            if (teamCategories.Count == 0)
            {
                Console.WriteLine("[ConversationSummary] 「チーム」を含むカテゴリが見つかりません");
                return;
            }

            var summaryMessages = new List<string>();

            foreach (var category in teamCategories)
            {
                var categoryMessages = new StringBuilder();
                categoryMessages.AppendLine($"## 📁 {category.Name}");
                categoryMessages.AppendLine();

                var hasMessages = false;

                // カテゴリ内のテキストチャンネルを取得
                var textChannels = guild.TextChannels
                    .Where(c => c.CategoryId == category.Id)
                    .OrderBy(c => c.Position)
                    .ToList();

                foreach (var channel in textChannels)
                {
                    var channelMessages = await GetMessagesInRange(channel, startTime, endTime);

                    if (channelMessages.Count == 0) continue;

                    hasMessages = true;
                    categoryMessages.AppendLine($"### #{channel.Name}");
                    categoryMessages.AppendLine("```");
                    categoryMessages.AppendLine("名前 | 日時 | 会話内容 | リアクション件数");
                    categoryMessages.AppendLine("--- | --- | --- | ---");

                    foreach (var msg in channelMessages)
                    {
                        var authorName = msg.Author.Username;
                        var timestamp = msg.Timestamp.LocalDateTime.ToString("MM/dd HH:mm");
                        var content = TruncateContent(msg.Content);
                        var reactionCount = msg.Reactions.Values.Sum(r => r.ReactionCount);

                        categoryMessages.AppendLine($"{authorName} | {timestamp} | {content} | {reactionCount}");
                    }

                    categoryMessages.AppendLine("```");
                    categoryMessages.AppendLine();
                }

                if (hasMessages)
                {
                    summaryMessages.Add(categoryMessages.ToString());
                }
            }

            // 結果を投稿
            if (summaryMessages.Count == 0)
            {
                await summaryChannel.SendMessageAsync(
                    $"📋 **会話まとめ** ({startTime:yyyy/MM/dd HH:mm} 〜 {endTime:yyyy/MM/dd HH:mm})\n\n対象期間の会話はありませんでした。");
                return;
            }

            // ヘッダー投稿
            await summaryChannel.SendMessageAsync(
                $"📋 **会話まとめ** ({startTime:yyyy/MM/dd HH:mm} 〜 {endTime:yyyy/MM/dd HH:mm})");

            // カテゴリごとに投稿（Discordの2000文字制限対応）
            foreach (var message in summaryMessages)
            {
                var chunks = SplitMessage(message);
                foreach (var chunk in chunks)
                {
                    await summaryChannel.SendMessageAsync(chunk);
                    // レートリミット対策
                    await Task.Delay(500);
                }
            }

            Console.WriteLine($"[ConversationSummary] まとめ投稿完了: {summaryMessages.Count} カテゴリ");
        }

        /// <summary>
        /// 指定期間のメッセージを取得する
        /// </summary>
        private async Task<List<IMessage>> GetMessagesInRange(
            SocketTextChannel channel, DateTime startTime, DateTime endTime)
        {
            var result = new List<IMessage>();
            var startOffset = new DateTimeOffset(startTime);
            var endOffset = new DateTimeOffset(endTime);

            // SnowflakeUtils で期間の境界を示す Snowflake ID を生成
            var endSnowflake = SnowflakeUtils.ToSnowflake(endOffset);

            IMessage? lastMessage = null;
            var keepFetching = true;

            while (keepFetching)
            {
                IEnumerable<IMessage> messages;

                if (lastMessage == null)
                {
                    messages = await channel.GetMessagesAsync(endSnowflake, Direction.Before, 100).FlattenAsync();
                }
                else
                {
                    messages = await channel.GetMessagesAsync(lastMessage.Id, Direction.Before, 100).FlattenAsync();
                }

                var messageList = messages.ToList();

                if (messageList.Count == 0)
                {
                    keepFetching = false;
                    break;
                }

                foreach (var msg in messageList)
                {
                    if (msg.Timestamp < startOffset)
                    {
                        keepFetching = false;
                        break;
                    }

                    // BOTのメッセージは除外
                    if (msg.Author.IsBot) continue;

                    result.Add(msg);
                }

                lastMessage = messageList.Last();
            }

            // 時系列順にソート
            result.Sort((a, b) => a.Timestamp.CompareTo(b.Timestamp));
            return result;
        }

        /// <summary>
        /// メッセージ内容を短縮する（改行除去、長すぎる場合は切り詰め）
        /// </summary>
        private string TruncateContent(string content)
        {
            if (string.IsNullOrEmpty(content))
                return "(添付/埋め込み)";

            // 改行をスペースに置換
            var singleLine = content.Replace("\r\n", " ").Replace("\n", " ").Replace("\r", " ");

            // パイプ文字をエスケープ（テーブル崩れ防止）
            singleLine = singleLine.Replace("|", "｜");

            if (singleLine.Length > 80)
            {
                singleLine = singleLine.Substring(0, 77) + "...";
            }

            return singleLine;
        }

        /// <summary>
        /// Discordの2000文字制限に合わせてメッセージを分割する
        /// </summary>
        private List<string> SplitMessage(string message, int maxLength = 1900)
        {
            var result = new List<string>();

            if (message.Length <= maxLength)
            {
                result.Add(message);
                return result;
            }

            var lines = message.Split('\n');
            var current = new StringBuilder();

            foreach (var line in lines)
            {
                if (current.Length + line.Length + 1 > maxLength)
                {
                    if (current.Length > 0)
                    {
                        result.Add(current.ToString());
                        current.Clear();
                    }
                }
                current.AppendLine(line);
            }

            if (current.Length > 0)
            {
                result.Add(current.ToString());
            }

            return result;
        }
    }
}
