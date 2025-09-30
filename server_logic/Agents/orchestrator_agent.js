import { db } from "../../server.js";
import axios from "axios";
import { generateFileContent } from "./specialist_agent.js";
import { createArchitectPlan } from "./architect_agent.js";
import { createAndPushToRepo } from "../repoGeneration.js";
import { generateDocsContent } from "./docs_agent.js";

async function sendProgress(callbackURL, data) {
  try {
    await axios.post(callbackURL, data);
  } catch (error) {
    console.log("Failed to send progress update:", error.message);
  }
}

export async function runOrchestrator(
  userId,
  postId,
  jobId,
  packType,
  callbackURL
) {
  try {
    await db.query("UPDATE jobs SET status = 'in_progress' WHERE id = $1", [
      jobId,
    ]);
    console.log("Fetching project data...");
    await sendProgress(callbackURL, {
      step: "start",
      message: "Fetching project data...",
    });

    const postResult = await db.query(
      "SELECT title, description, tech_used FROM post WHERE id = $1",
      [postId]
    );
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    if (postResult.rows.length === 0 || userResult.rows.length === 0) {
      throw new Error("Could not find required project or user data.");
    }
    const postData = postResult.rows[0];
    const userData = userResult.rows[0];
    console.log("Architect is designing the blueprint...");
    await sendProgress(callbackURL, {
      step: "architect",
      message: "Architect is designing the blueprint...",
    });
    const plan = await createArchitectPlan(
      packType,
      postData.title,
      postData.description,
      postData.tech_used
    );
    await db.query("UPDATE jobs SET plan_json = $1 WHERE id = $2", [
      JSON.stringify(plan),
      jobId,
    ]);

    const fileTasks = plan.file_structure;
    await Promise.all(
      fileTasks.map(async (task) => {
        console.log(`Generating ${task.path}...`);
        await sendProgress(callbackURL, {
          step: "build",
          message: `Generating ${task.path}...`,
        });
        let content;
        if (task.path.toLowerCase().endsWith(".md")) {
          content = await generateDocsContent(task, postData);
        } else {
          content = await generateFileContent(task, postData, plan);
        }
        await db.query(
          "INSERT INTO generated_files(job_id, file_path, file_content) VALUES ($1, $2, $3)",
          [jobId, task.path, content]
        );
      })
    );
    console.log("All files generated. Pushing to GitHub...");
    await sendProgress(callbackURL, {
      step: "assembly",
      message: "All files generated. Pushing to GitHub...",
    });
    const filesResult = await db.query(
      "SELECT file_path, file_content FROM generated_files WHERE job_id = $1",
      [jobId]
    );
    const filesForGithub = filesResult.rows.map((row) => ({
      path: row.file_path,
      content: row.file_content,
    }));

    await createAndPushToRepo(
      userData.github_access_token,
      postData,
      filesForGithub,
      (data) => sendProgress(callbackURL, data)
    );

    await db.query("UPDATE jobs SET status = 'completed' WHERE id = $1", [
      jobId,
    ]);
    console.log("Success! Repository created.");
    await sendProgress(callbackURL, {
      status: "done",
      message: "Success! Repository created.",
    });
  } catch (error) {
    console.error(
      `[Orchestrator Error for Job ${jobId}]:`,
      error.message,
      error.stack
    );
    await db.query(
      "UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2",
      [error.message, jobId]
    );
    await sendProgress(callbackURL, {
      status: "error",
      message: `An error occurred: ${error.message}`,
    });
  }
}
