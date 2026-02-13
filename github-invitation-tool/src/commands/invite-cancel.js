const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("github-invite-cancel")
    .setDescription("GitHubのOrganizationへの保留中の招待をキャンセルします")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("キャンセルするGitHubユーザー名")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, githubClient) {
    const username = interaction.options.getString("username");
    const org = process.env.GITHUB_ORG;

    await interaction.deferReply();

    const result = await githubClient.cancelInvitation(org, username);

    if (result.success) {
      await interaction.editReply({ content: `✅ ${result.message}` });
    } else {
      await interaction.editReply({ content: `❌ ${result.message}` });
    }
  },
};
