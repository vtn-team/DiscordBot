const LocalData = require('./local-data');

const API_BASE = 'https://meodtz40k5.execute-api.ap-northeast-1.amazonaws.com/default/GetConfig';

/**
 * Notion APIからDiscordロール情報を取得する
 * @returns {Promise<Array>} DiscordRoleオブジェクトの配列
 */
async function getDiscordRoles() {
  const settings = LocalData.load('setting.json');
  if (!settings || !settings.RoleDatabaseId) {
    console.error('Error: setting.json が見つからないか、RoleDatabaseId が未設定です。');
    return [];
  }

  const url = `${API_BASE}/${settings.RoleDatabaseId}/`;
  let json = null;
  let retryCount = 0;

  while (json === null) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        json = await response.text();
      }
    } catch (err) {
      console.error('Request error:', err.message);
    }

    if (json !== null) break;

    await new Promise((resolve) => setTimeout(resolve, 1000));
    retryCount++;
    if (retryCount > 3) {
      console.error('Error: server error.');
      return [];
    }
  }

  try {
    const roles = JSON.parse(json);
    // Sortフィールドで昇順ソート
    roles.sort((a, b) => parseInt(a.Sort) - parseInt(b.Sort));
    return roles;
  } catch (err) {
    console.error('Error parsing roles JSON:', err.message);
    return [];
  }
}

module.exports = { getDiscordRoles };
