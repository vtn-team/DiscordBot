using Discord;
using Discord.Rest;
using Discord.WebSocket;
using DiscordBot.Commands;
using DiscordBot.Cron;
using Microsoft.VisualBasic;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Runtime;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Xml.Linq;
using static Program;
using static System.Net.WebRequestMethods;

namespace DiscordBot
{
    /// <summary>
    /// ロール付与用の応答BOT
    /// </summary>
    public class RoleAssignBotClient
    {
        DiscordSocketClient _client;
        DiscordRole[] _roles;
        SettingData _settings;
        CronScheduler? _summaryCron;

        Dictionary<string, SocketGuildUser> _userStack = new Dictionary<string, SocketGuildUser>();

        public RoleAssignBotClient()
        {
            var configuracoes = new DiscordSocketConfig()
            {
                LogLevel = LogSeverity.Debug,
                AlwaysDownloadUsers = true,
                GatewayIntents = GatewayIntents.All
            };
            _client = new DiscordSocketClient(configuracoes);
            _client.Log += LogAsync;
            _client.Ready += onReady;
            _client.UserJoined += onJoinUser;
            _client.MessageReceived += onMessage;
            _client.ReactionAdded += onReaction;
            //Discord.GatewayIntents.All
        }

        public async Task Run()
        {
            _settings = LocalData.Load<SettingData>("setting.json");
            await _client.LoginAsync(TokenType.Bot, _settings.BotToken);
            await _client.StartAsync();

            //確認用
            //var discordAPI = new RestAPIWrapper();
            //var roles = discordAPI.GetRoles(settings.GuildId).GetAwaiter().GetResult();

            _roles = RoleLoader.LoadRoles();
            Console.WriteLine($"[Bot] roles.json から {_roles.Length} 個のロールを読み込みました。");

            // 会話まとめCronを開始（毎日22:00に実行）
            var summaryCommand = new ConversationSummaryCommand(_client, _settings.GuildId);
            _summaryCron = new CronScheduler(
                new TimeSpan(22, 0, 0),
                () => summaryCommand.ExecuteAsync()
            );
            _summaryCron.Start();
            Console.WriteLine("[Bot] 会話まとめCronを開始しました（毎日22:00実行）");

            await Task.Delay(Timeout.Infinite);
        }

        private Task LogAsync(LogMessage log)
        {
            Console.WriteLine(log.ToString());
            return Task.CompletedTask;
        }

        private Task onReady()
        {
            Console.WriteLine($"{_client.CurrentUser} is Running!!");
            var roles = _client.GetGuild(_settings.GuildId).Roles.ToList();
            roles.ForEach(r =>
            {
                Console.WriteLine(r.Name);
                Console.WriteLine(r.Id);
                Console.WriteLine(r.Mention);
            });
            return Task.CompletedTask;
        }

        private string GetTeamMessage(string name)
        {
            string jobMessage = "こんにちは、" + name + "さん！ \r\n**あなたの「所属チーム」を教えてください！**\r\n\r\n";
            jobMessage += "----\r\nチームと一致するリアクションを押してください！\n\n";
            foreach (var r in _roles)
            {
                if (!r.RoleName.Contains("チーム")) continue;
                jobMessage += Emoji.Parse(r.Emoji) + " " + r.RoleName + "\r\n";
            }
            return jobMessage;
        }

        private string GetRoleMessage(string name)
        {
            string jobMessage = "こんにちは、" + name + "さん！ \r\n**あなたの「担当職種」を教えてください！**\r\n\r\n「これもやりたい」ロールを追加してもかまいません。\r\n\r\n";
            jobMessage += "----\r\n以下の担当職種と一致するリアクションを押してください！\n\n";
            foreach (var r in _roles)
            {
                if (r.RoleName.Contains("チーム")) continue;
                jobMessage += Emoji.Parse(r.Emoji) + " " + r.RoleName + "\r\n";
            }
            jobMessage += "----\r\n";
            return jobMessage;
        }

        private async Task SendTeamMessage(SocketUser user)
        {
            //ロールを設定してもらう旨をDMする
            var message = await user.SendMessageAsync(GetTeamMessage(user.Username));
            foreach (var r in _roles)
            {
                if (!r.RoleName.Contains("チーム")) continue;
                await message.AddReactionAsync(Emoji.Parse(r.Emoji));
            }
        }

        private async Task SendRoleMessage(SocketUser user)
        {
            //ロールを設定してもらう旨をDMする
            var message = await user.SendMessageAsync(GetRoleMessage(user.Username));
            foreach (var r in _roles)
            {
                if (r.RoleName.Contains("チーム")) continue;
                await message.AddReactionAsync(Emoji.Parse(r.Emoji));
            }
        }

        private async Task onJoinUser(SocketGuildUser user)
        {
            Console.WriteLine(user.Guild.Name);
            Console.WriteLine(user.Username);

            //チーム
            await SendTeamMessage(user);

            //担当職種
            await SendRoleMessage(user);
        }

        private async Task onMessage(SocketMessage message)
        {
            //BOT君の発言は読まない
            if (message.Author.Id == _client.CurrentUser.Id)
            {
                return;
            }

            Console.WriteLine(message.Content);

            if (message.Content == "ジョブ")
            {
                //ロールを設定してもらう旨をDMする
                await SendRoleMessage(message.Author);
            }

            if (message.Content == "チーム")
            {
                //チームを設定してもらう旨をDMする
                await SendTeamMessage(message.Author);
            }

            if (message.Content == "ロール一覧")
            {
                // Discordサーバーのロール一覧を表示
                var guild = _client.GetGuild(_settings.GuildId);
                if (guild != null)
                {
                    var roles = guild.Roles
                        .Where(r => !r.IsEveryone)
                        .OrderByDescending(r => r.Position)
                        .ToList();

                    var sb = new StringBuilder();
                    sb.AppendLine("**Discordサーバーのロール一覧:**\r\n");
                    foreach (var r in roles)
                    {
                        sb.AppendLine($"- {r.Name} (ID: {r.Id})");
                    }
                    await message.Channel.SendMessageAsync(sb.ToString());
                }
            }

            if (message.Content == "まとめ")
            {
                // 会話まとめを手動実行
                var summaryCommand = new ConversationSummaryCommand(_client, _settings.GuildId);
                await message.Channel.SendMessageAsync("会話まとめを実行中...");
                await summaryCommand.ExecuteAsync();
            }
        }


        private async Task onReaction(Cacheable<IUserMessage, ulong> message, Cacheable<IMessageChannel, ulong> channel, SocketReaction reaction)
        {
            //BOT君の発言は読まない
            if (reaction.UserId == _client.CurrentUser.Id)
            {
                return;
            }

            Console.WriteLine(reaction.User.Value);
            Console.WriteLine(reaction.Emote.Name);

            try
            {
                //ロール設定する
                foreach (var r in _roles)
                {
                    if (reaction.Emote.Name == r.Emoji)
                    {
                        //var api = new RestAPIWrapper();
                        //await api.AddRoles(_settings.GuildId, reaction.UserId, ulong.Parse(r.RoleId));

                        var guild = _client.GetGuild(_settings.GuildId);
                        var user = guild.Users.Where(u => u.Id == reaction.UserId);
                        if (user.Count() == 0) break;

                        var role = guild.Roles.Where(rr => rr.Id == ulong.Parse(r.RoleId));
                        if (role.Count() == 0) break;

                        await user.First().AddRoleAsync(role.First());
                    }
                }
            }
            catch(Exception ex)
            {
                var guild = _client.GetGuild(_settings.GuildId);
                var user = guild.Users.Where(u => u.Id == reaction.UserId);
                if (user.Count() > 0)
                {
                    await user.First().SendMessageAsync("エラーが出ちゃいました。講師かスタッフにエラー内容を問い合わせてください。\r\nエラー内容:\r\n" + ex.Message);
                }
            }
        }
        
    }
}
