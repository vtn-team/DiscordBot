const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("github-invite")
    .setDescription("GitHubのOrganizationにユーザーを招待します")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("招待するGitHubユーザー名")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("role")
        .setDescription("招待するロール")
        .addChoices(
          { name: "メンバー", value: "direct_member" },
          { name: "管理者", value: "admin" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, githubClient) {
    const username = interaction.options.getString("username");
    const role = interaction.options.getString("role") || "direct_member";
    const org = process.env.GITHUB_ORG;

    await interaction.deferReply();

    const result = await githubClient.inviteUser(org, username, role);

    if (result.success) {
      await interaction.editReply({
        content: `✅ ${result.message}`,
      });
    } else {
      await interaction.editReply({
        content: `❌ ${result.message}`,
      });
    }
  },
};
