import { NotionClientWrapper } from "./notion-client.js";

/**
 * Notionページ招待サービス
 *
 * Notion公式APIにはページ単位の権限共有エンドポイントがないため、
 * 以下の2つの方法でユーザーに通知・招待を行います:
 *
 * 1. データベースページの場合: Personプロパティにユーザーを追加
 * 2. 任意のページの場合: ページ内に@メンションブロックを追加して通知
 */
export class InviteService {
  constructor(apiKey) {
    this.notion = new NotionClientWrapper(apiKey);
  }

  /**
   * ワークスペースのユーザー一覧を表示用に整形して返す
   */
  async getWorkspaceUsers() {
    const users = await this.notion.listUsers();
    return users
      .filter((u) => u.type === "person")
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.person?.email || "(メール非公開)",
      }));
  }

  /**
   * ページ情報を取得して表示用に整形
   */
  async getPageInfo(pageId) {
    const page = await this.notion.getPage(pageId);
    const title = extractTitle(page);
    return {
      id: page.id,
      title,
      url: page.url,
      parentType: page.parent?.type,
      archived: page.archived,
    };
  }

  /**
   * ユーザーをページに招待する
   *
   * @param {string} pageId - 対象ページID
   * @param {string} email - 招待するユーザーのメールアドレス
   * @param {object} options - オプション
   * @param {string} options.message - メンションに付与するメッセージ
   * @param {string} options.method - 招待方法 ("auto" | "mention" | "property")
   * @returns {object} 招待結果
   */
  async inviteUser(pageId, email, options = {}) {
    const { message = "このページに招待されました。", method = "auto" } =
      options;

    // ユーザーを検索
    const user = await this.notion.findUserByEmail(email);
    if (!user) {
      throw new Error(
        `メールアドレス "${email}" に一致するユーザーが見つかりません。\n` +
          "ワークスペースのメンバーであることを確認してください。"
      );
    }

    const pageInfo = await this.getPageInfo(pageId);
    const result = {
      user: { id: user.id, name: user.name, email },
      page: pageInfo,
      actions: [],
    };

    // 方法1: Personプロパティへの追加（データベースページの場合）
    if (method === "auto" || method === "property") {
      const personProp = await this.notion.findPersonProperty(pageId);
      if (personProp) {
        try {
          await this.notion.updatePagePeople(
            pageId,
            personProp.propertyName,
            [user.id]
          );
          result.actions.push({
            type: "property",
            success: true,
            propertyName: personProp.propertyName,
            detail: `"${personProp.propertyName}" プロパティにユーザーを追加しました`,
          });
        } catch (err) {
          result.actions.push({
            type: "property",
            success: false,
            detail: `プロパティ追加に失敗: ${err.message}`,
          });
        }
      }
    }

    // 方法2: メンションブロックの追加
    if (method === "auto" || method === "mention") {
      try {
        await this.notion.addMentionBlock(pageId, user.id, message);
        result.actions.push({
          type: "mention",
          success: true,
          detail: "ページ内にメンション付きコールアウトを追加しました",
        });
      } catch (err) {
        result.actions.push({
          type: "mention",
          success: false,
          detail: `メンション追加に失敗: ${err.message}`,
        });
      }
    }

    if (result.actions.length === 0) {
      throw new Error("招待処理を実行できませんでした。");
    }

    return result;
  }

  /**
   * 複数ユーザーをまとめて招待
   */
  async inviteUsers(pageId, emails, options = {}) {
    const results = [];
    for (const email of emails) {
      try {
        const result = await this.inviteUser(pageId, email, options);
        results.push(result);
      } catch (err) {
        results.push({
          user: { email },
          error: err.message,
        });
      }
    }
    return results;
  }
}

/**
 * ページオブジェクトからタイトルを抽出
 */
function extractTitle(page) {
  const properties = page.properties || {};
  for (const prop of Object.values(properties)) {
    if (prop.type === "title" && prop.title?.length > 0) {
      return prop.title.map((t) => t.plain_text).join("");
    }
  }
  return "(タイトルなし)";
}
