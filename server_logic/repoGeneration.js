
import { Octokit } from "@octokit/rest";

async function repoGenerator(octokit, filesToUpload, owner, repo) {
  try {
    const blobSHAs = [];
    for (const file of filesToUpload) {
      const blobData = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: "utf-8",
      });
      blobSHAs.push({ path: file.path, sha: blobData.data.sha });
    }

    const treeArray = blobSHAs.map(({ path, sha }) => ({
      path,
      sha,
      mode: "100644", // file mode
      type: "blob",
    }));

    const refData = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: "heads/main",
    });
    const parentSha = refData.data.object.sha;

    const treeData = await octokit.rest.git.createTree({
      owner,
      repo,
      tree: treeArray,
      base_tree: parentSha,
    });
    const treeShaData = treeData.data.sha;

    const commitData = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: "Initial commit of project files",
      tree: treeShaData,
      parents: [parentSha],
    });
    const commitSha = commitData.data.sha;

    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: "heads/main",
      sha: commitSha,
    });
    console.log("All project files committed successfully.");
  } catch (error) {
    console.error("Error during batch file commit (repoGenerator):", error);
    throw new Error("Failed to commit project files to GitHub.");
  }
}

export async function createAndPushToRepo(
  githubToken,
  postDetails,
  fileStructure,
  sendProgressUpdate
) {
  const octokit = new Octokit({ auth: githubToken });
  const repoName = postDetails.title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-");

  await sendProgressUpdate({
    step: "repo_create",
    message: `Creating GitHub repository: ${repoName}...`,
  });
  const repoCreationResponse = await octokit.request("POST /user/repos", {
    name: repoName,
    description: postDetails.description,
    private: true,
    auto_init: true,
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));
  const owner = repoCreationResponse.data.owner.login;

  const readmeIndex = fileStructure.findIndex(
    (file) => file.path.toLowerCase() === "readme.md"
  );
  if (readmeIndex > -1) {
    await sendProgressUpdate({
      step: "readme",
      message: "Updating README.md...",
    });
    const readmeFile = fileStructure[readmeIndex];
    const encodedContent = Buffer.from(readmeFile.content).toString("base64");
    const { data: currentReadme } = await octokit.rest.repos.getContent({
      owner,
      repo: repoName,
      path: "README.md",
    });
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: "README.md",
      message: "Update README.md with project details",
      content: encodedContent,
      sha: currentReadme.sha,
    });
  }

  const otherFiles = fileStructure.filter(
    (file) => file.path.toLowerCase() !== "readme.md"
  );
  if (otherFiles.length > 0) {
    await sendProgressUpdate({
      step: "files",
      message: `Uploading ${otherFiles.length} project files...`,
    });
    await repoGenerator(octokit, otherFiles, owner, repoName);
  }
}
