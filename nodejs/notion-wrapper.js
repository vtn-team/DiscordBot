const LocalData = require('./local-data');

/**
 * ローカルJSONファイルからDiscordロール情報を読み込む
 * @returns {Array} DiscordRoleオブジェクトの配列
 */
function getDiscordRoles() {
  const roles = LocalData.load('roles.json');
  if (!roles) {
    console.error('Error: roles.json が見つかりません。');
    return [];
  }

  // Sortフィールドで昇順ソート
  roles.sort((a, b) => parseInt(a.Sort) - parseInt(b.Sort));
  console.log(`roles.json から ${roles.length} 個のロールを読み込みました。`);
  return roles;
}

/**
 * ロール設定をローカルJSONファイルに保存する
 * @param {Array} roles DiscordRoleオブジェクトの配列
 */
function saveDiscordRoles(roles) {
  LocalData.save('roles.json', roles);
  console.log(`roles.json に ${roles.length} 個のロールを保存しました。`);
}

module.exports = { getDiscordRoles, saveDiscordRoles };
