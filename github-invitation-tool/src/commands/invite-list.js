const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("github-invite-list")
    .setDescription("GitHubのOrganizationの保留中の招待一覧を表示します")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, githubClient) {
    const org = process.env.GITHUB_ORG;

    await interaction.deferReply();

    const result = await githubClient.listPendingInvitations(org);

    if (!result.success) {
      await interaction.editReply({ content: `❌ ${result.message}` });
      return;
    }

    if (result.invitations.length === 0) {
      await interaction.editReply({
        content: "保留中の招待はありません。",
      });
      return;
    }

    const lines = result.invitations.map((inv) => {
      const name = inv.login || inv.email || "不明";
      const date = new Date(inv.createdAt).toLocaleDateString("ja-JP");
      return `• **${name}** (${inv.role}) - ${date}`;
    });

    await interaction.editReply({
      content: `📋 **${org}** の保留中の招待一覧:\n${lines.join("\n")}`,
    });
  },
};
