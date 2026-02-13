const { Octokit } = require("@octokit/rest");

class GitHubClient {
  constructor(token) {
    this.octokit = new Octokit({ auth: token });
  }

  /**
   * GitHub Organization にユーザーを招待する
   * @param {string} org - Organization名
   * @param {string} username - 招待するGitHubユーザー名
   * @param {string} [role="direct_member"] - ロール ("admin" | "direct_member")
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async inviteUser(org, username, role = "direct_member") {
    if (!username || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
      return {
        success: false,
        message: `"${username}" は有効なGitHubユーザー名ではありません。`,
      };
    }

    try {
      // ユーザーのGitHub IDを取得
      const { data: user } = await this.octokit.users.getByUsername({
        username,
      });

      // Organization に招待を送信
      await this.octokit.orgs.createInvitation({
        org,
        invitee_id: user.id,
        role,
      });

      return {
        success: true,
        message: `${username} を ${org} に招待しました。`,
      };
    } catch (error) {
      if (error.status === 404) {
        return {
          success: false,
          message: `GitHubユーザー "${username}" が見つかりません。`,
        };
      }
      if (error.status === 422) {
        return {
          success: false,
          message: `${username} は既に ${org} のメンバーまたは招待済みです。`,
        };
      }
      return {
        success: false,
        message: `招待に失敗しました: ${error.message}`,
      };
    }
  }

  /**
   * Organization の保留中の招待一覧を取得する
   * @param {string} org - Organization名
   * @returns {Promise<{success: boolean, invitations?: Array, message?: string}>}
   */
  async listPendingInvitations(org) {
    try {
      const { data: invitations } =
        await this.octokit.orgs.listPendingInvitations({ org });

      return {
        success: true,
        invitations: invitations.map((inv) => ({
          login: inv.login,
          email: inv.email,
          role: inv.role,
          createdAt: inv.created_at,
        })),
      };
    } catch (error) {
      return {
        success: false,
        message: `招待一覧の取得に失敗しました: ${error.message}`,
      };
    }
  }

  /**
   * Organization の保留中の招待をキャンセルする
   * @param {string} org - Organization名
   * @param {string} username - キャンセルするユーザー名
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async cancelInvitation(org, username) {
    try {
      const { data: invitations } =
        await this.octokit.orgs.listPendingInvitations({ org });

      const invitation = invitations.find((inv) => inv.login === username);
      if (!invitation) {
        return {
          success: false,
          message: `${username} の保留中の招待が見つかりません。`,
        };
      }

      await this.octokit.orgs.cancelInvitation({
        org,
        invitation_id: invitation.id,
      });

      return {
        success: true,
        message: `${username} への招待をキャンセルしました。`,
      };
    } catch (error) {
      return {
        success: false,
        message: `招待のキャンセルに失敗しました: ${error.message}`,
      };
    }
  }
}

module.exports = GitHubClient;
