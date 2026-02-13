using Discord;
using Discord.Rest;
using Discord.WebSocket;
using DiscordBot;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

class Program
{
    [Serializable]
    public class SettingData
    {
        public string BotToken;
        public ulong GuildId;
        public ulong ChannelId;
        public string CalendarDBId;
    }

    static string TimeString(string timeStr)
    {
        DateTime end = DateTime.Parse(timeStr);
        string time = end.ToString("HH:mm");
        return time;
    }

    static void Main(string[] args)
    {
        //テスト
        RoleAssignBotClient botClient = new RoleAssignBotClient();
        botClient.Run().GetAwaiter().GetResult();
    }
}