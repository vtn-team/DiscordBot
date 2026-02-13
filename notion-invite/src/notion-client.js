const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/**
 * Notion APIクライアント（外部依存なし、Node.js組み込みfetch使用）
 */
export class NotionClientWrapper {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error("NOTION_API_KEY が設定されていません");
    }
    this.apiKey = apiKey;
  }

  /**
   * Notion APIへのリクエスト共通処理
   */
  async request(method, path, body = null) {
    const url = `${NOTION_API_BASE}${path}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    };

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Notion API エラー (${response.status}): レスポンスの解析に失敗しました`);
    }

    if (!response.ok) {
      const msg = data.message || data.code || response.statusText;
      throw new Error(`Notion API エラー (${response.status}): ${msg}`);
    }

    return data;
  }

  /**
   * ワークスペース内のユーザー一覧を取得
   */
  async listUsers() {
    const data = await this.request("GET", "/users");
    return data.results;
  }

  /**
   * メールアドレスでユーザーを検索
   */
  async findUserByEmail(email) {
    const users = await this.listUsers();
    return users.find(
      (user) => user.type === "person" && user.person?.email === email
    );
  }

  /**
   * ページ情報を取得
   */
  async getPage(pageId) {
    return await this.request("GET", `/pages/${pageId}`);
  }

  /**
   * ページのプロパティを更新（Personプロパティにユーザーを追加）
   */
  async updatePagePeople(pageId, propertyName, userIds) {
    const people = userIds.map((id) => ({ id }));
    return await this.request("PATCH", `/pages/${pageId}`, {
      properties: {
        [propertyName]: {
          people,
        },
      },
    });
  }

  /**
   * ページにメンションブロック（コールアウト）を追加してユーザーに通知
   */
  async addMentionBlock(pageId, userId, message) {
    const richText = [
      {
        type: "mention",
        mention: {
          type: "user",
          user: { id: userId },
        },
      },
      {
        type: "text",
        text: { content: ` ${message}` },
      },
    ];

    return await this.request("PATCH", `/blocks/${pageId}/children`, {
      children: [
        {
          object: "block",
          type: "callout",
          callout: {
            rich_text: richText,
            icon: { type: "emoji", emoji: "👋" },
          },
        },
      ],
    });
  }

  /**
   * データベースのプロパティスキーマを取得
   */
  async getDatabaseProperties(databaseId) {
    const db = await this.request("GET", `/databases/${databaseId}`);
    return db.properties;
  }

  /**
   * ページの親がデータベースかどうかを判定し、Peopleプロパティ名を返す
   */
  async findPersonProperty(pageId) {
    const page = await this.getPage(pageId);

    if (page.parent?.type === "database_id") {
      const dbId = page.parent.database_id;
      const properties = await this.getDatabaseProperties(dbId);

      for (const [name, prop] of Object.entries(properties)) {
        if (prop.type === "people") {
          return { propertyName: name, databaseId: dbId };
        }
      }
    }

    return null;
  }
}
