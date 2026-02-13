using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static Program;

namespace DiscordBot
{
    [Serializable]
    public class DiscordRole
    {
        public string RoleName;
        public string Emoji;
        public string RoleId;
        public string Sort;
    }

    public class RoleLoader
    {
        /// <summary>
        /// ローカルJSONファイルからロール設定を読み込む
        /// </summary>
        static public DiscordRole[] LoadRoles()
        {
            var roles = LocalData.Load<DiscordRole[]>("roles.json");
            if (roles == null)
            {
                Console.WriteLine("Error: roles.json が見つかりません。");
                return Array.Empty<DiscordRole>();
            }

            Array.Sort(roles, (a, b) => int.Parse(a.Sort) - int.Parse(b.Sort));
            return roles;
        }

        /// <summary>
        /// ロール設定をローカルJSONファイルに保存する
        /// </summary>
        static public void SaveRoles(DiscordRole[] roles)
        {
            LocalData.Save("roles.json", roles);
            Console.WriteLine($"roles.json に {roles.Length} 個のロールを保存しました。");
        }
    }
}
