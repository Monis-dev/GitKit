// In orchestrator.js

// --- Make sure you have these imports at the top ---
import { db } from "../../server.js";
import axios from "axios";
import { createArchitectPlan } from "./architect_agent.js";
import { generateModuleContent } from "./moduleBuilder_agnet.js"; // CRITICAL: This is our new workhorse
// We no longer need specialist, reviewer, or batch specialist for this simpler flow
import { createAndPushToRepo } from "../repoGeneration.js";

// Your `sendProgress` function remains the same.
async function sendProgress(callbackURL, data) {
  try {
    await axios.post(callbackURL, data);
  } catch (e) {
    console.log("Failed to send progress update:", e.message);
  }
}

// This is our new helper function to group files into logical modules.
// This simple grouping is surprisingly effective.
function groupFilesIntoModules(fileTasks) {
  const modules = {
    config_and_setup: [],
    backend_core: [],
    frontend_services: [],
    frontend_components: [],
  };

  fileTasks.forEach((task) => {
    // We prioritize backend first, as frontend often depends on it.
    if (task.path.startsWith("backend/")) {
      modules.backend_core.push(task);
    } else if (task.path.includes("services") || task.path.includes("api")) {
      modules.frontend_services.push(task);
    } else if (task.path.startsWith("frontend/")) {
      modules.frontend_components.push(task);
    } else {
      // Everything else (package.json, README, .gitignore) is setup.
      modules.config_and_setup.push(task);
    }
  });

  // Return modules in a logical build order: Setup -> Backend -> Frontend Services -> Frontend Components
  return [
    modules.config_and_setup,
    modules.backend_core,
    modules.frontend_services,
    modules.frontend_components,
  ].filter((module) => module.length > 0); // Ensure we don't process empty modules
}

// ========================================================================
//                 THE FINAL, ROBUST RUNORCHESTRATOR
// ========================================================================
export async function runOrchestrator(
  userId,
  postId,
  jobId,
  packType,
  callbackURL
) {
  try {
    // --- Phase 1: SETUP ---
    await db.query("UPDATE jobs SET status = 'in_progress' WHERE id = $1", [
      jobId,
    ]);
    await sendProgress(callbackURL, {
      step: "start",
      message: "Fetching project data...",
    });
    console.log("Fetching project data...");

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

    // --- Phase 2: ARCHITECT ---
    // The simplified architect will produce a plan without a 'purpose' for each file.
    await sendProgress(callbackURL, {
      step: "architect",
      message: "Architect is designing the blueprint...",
    });
    console.log("Architect is designing the blueprint...");
    const plan = await createArchitectPlan(
      packType,
      postData.title,
      postData.description,
      postData.tech_used
    );

    console.log("======================================================");
    console.log("======= FINAL VALIDATED ARCHITECT PLAN (DEBUG) =======");
    console.log(JSON.stringify(plan, null, 2));
    console.log("======================================================");

    await db.query("UPDATE jobs SET plan_json = $1 WHERE id = $2", [
      JSON.stringify(plan),
      jobId,
    ]);

    // ========================================================================
    // --- Phase 3: THE NEW MODULE-BASED BUILD ENGINE ---
    // ========================================================================
    await sendProgress(callbackURL, {
      step: "build_start",
      message: "Code generation phase initiated.",
    });

    const allFileTasks = plan.file_structure;
    if (!allFileTasks || !Array.isArray(allFileTasks)) {
      throw new Error(
        "Architect did not produce a valid 'file_structure' array."
      );
    }
    const modulesToBuild = groupFilesIntoModules(allFileTasks);
    const generatedCode = {}; // Store all generated code here.

    // Process each module sequentially. This is simpler and more reliable.
    for (const moduleTasks of modulesToBuild) {
      // Use the first file's path to create a simple name for logging
      const moduleNameGuess = moduleTasks[0].path.split("/")[0] || "Setup";
      await sendProgress(callbackURL, {
        step: "build_module",
        message: `Building module: ${moduleNameGuess}`,
      });
      console.log(
        `Building module: ${moduleNameGuess} (${moduleTasks.length} files)`
      );

      // A single, powerful API call to generate all files in the module
      const moduleFiles = await generateModuleContent(
        moduleTasks,
        postData,
        plan
      );

      if (!moduleFiles || !Array.isArray(moduleFiles)) {
        console.warn(
          `ModuleBuilder for ${moduleNameGuess} returned invalid data. Skipping.`
        );
        continue; // Skip this module but don't crash the whole process
      }

      // Add the generated files to our main code object
      moduleFiles.forEach((file) => {
        if (file && file.path && file.content) {
          generatedCode[file.path] = file.content;
        }
      });

      await sendProgress(callbackURL, {
        step: "complete_module",
        message: `Module ${moduleNameGuess} completed.`,
      });
      console.log(`Module ${moduleNameGuess} completed.`);
    }

    // --- Phase 4: SAVE TO DATABASE (Bulk insert) ---
    // (This part remains the same)
    const allGeneratedFiles = Object.entries(generatedCode).map(
      ([path, content]) => {
        return db.query(
          "INSERT INTO generated_files(job_id, file_path, file_content) VALUES ($1, $2, $3)",
          [jobId, path, content]
        );
      }
    );
    await Promise.all(allGeneratedFiles);

    // --- Phase 5: GITHUB ASSEMBLY ---
    // (This part remains the same)
    await sendProgress(callbackURL, {
      step: "assembly",
      message: "All files generated. Pushing to GitHub...",
    });
    console.log("All files generated. Pushing to GitHub...");
    const filesForGithub = Object.entries(generatedCode).map(
      ([path, content]) => ({ path, content })
    );
    await createAndPushToRepo(
      userData.github_access_token,
      postData,
      filesForGithub,
      (data) => sendProgress(callbackURL, data)
    );

    // --- Phase 6: SUCCESS ---
    // (This part remains the same)
    await db.query("UPDATE jobs SET status = 'completed' WHERE id = $1", [
      jobId,
    ]);
    await sendProgress(callbackURL, {
      status: "done",
      message: "Success! Repository created.",
    });
    console.log("Success! Repository created.");
  } catch (error) {
    // (Your existing error handling is perfect)
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
