import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import env from "dotenv";

env.config();

// Note: Using a specific model like 1.5-flash might be more cost-effective for code generation. Pro is great but might be overkill. Your choice.
const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-pro", // Changed from 2.5-pro for stability, 2.5 is not a standard API name yet. Use gemini-1.5-pro or gemini-1.5-flash.
});

const codeGenerationPrompt = PromptTemplate.fromTemplate(
  `You are an expert software developer specializing in "{{technologies}}".
  Your task is to write the complete code for the file located at "{{path}}".
  
  CONTEXT:
  - Project Title: "{{title}}"
  // Removed Project Description as it's less relevant than File's Purpose
  - File's Purpose: "{{purpose}}"
  
  {{feedback_section}}
  
  **DEPENDENCY SOURCE CODE (for your reference):**
  ---
  {{dependency_source_code}}
  ---
  
  **FULL PROJECT SPECIFICATION (for high-level reference):**
  ---
  {{project_plan}}
  ---
  
  Instructions:
  - Write only the complete, clean, production-ready code for "{{path}}".
  - You MUST use the provided dependency source code correctly. For example, if a function is defined in a dependency, you must import and call it with the correct signature.
  - Do not add any explanations, markdown formatting (like \`\`\`javascript), or other text.`,
  {
    templateFormat: "mustache",
  }
);

export async function generateFileContent(
  fileTask,
  projectDetails,
  fullPlan,
  feedbackHistory,
  dependencySourceCode // Added missing parameter
) {
  const codeChain = codeGenerationPrompt
    .pipe(model)
    .pipe(new StringOutputParser());

  let feedbackSection = "";
  // The check for "Awaiting first generation." should be in the orchestrator.
  // This function should just check if the array is not empty.
  if (feedbackHistory && feedbackHistory.length > 0) {
    const historyText = feedbackHistory.join("\n");
    feedbackSection = `
      **CRITICAL:** Previous attempts to generate this code failed code review. You MUST address all points from the feedback history below. Do not repeat past mistakes.

      **FEEDBACK HISTORY:**
      ---
      ${historyText}
      ---`;
  }
  const response = await codeChain.invoke({
    technologies: projectDetails.tech_used,
    path: fileTask.path,
    title: projectDetails.title,
    purpose: fileTask.purpose,
    project_plan: JSON.stringify(fullPlan, null, 2),
    feedback_section: feedbackSection,
    dependency_source_code: dependencySourceCode || "No dependencies provided.", // Added missing variable
  });
  return response;
}
