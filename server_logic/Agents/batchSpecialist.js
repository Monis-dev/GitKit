// In ai_agents/batchSpecialist.js
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import env from "dotenv";

env.config();

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash-lite", // Flash is great for this batch task
});

const batchPrompt = PromptTemplate.fromTemplate(
  `You are an efficient software developer. Your task is to generate the code for MULTIPLE files based on the request below.

  **PROJECT CONTEXT:**
  - Project Title: {{title}}
  - Technologies: {{technologies}}
  - Description: {{description}}
  
  You must respond with a single, valid JSON object. The root key of this object must be "files". The value should be an array of objects, where each object has a "path" and a "content" key.
  
  **CRITICAL REQUIREMENT:** You MUST ensure that any double quotes inside a file's "content" string are properly escaped with a backslash (\\").
  
  DO NOT add any explanations or markdown. Your entire output must be a single raw JSON object.
  
  **FILES TO GENERATE:**
  ---
  {{files_to_generate}}
  ---`,
  {
    templateFormat: "mustache",
  }
);

// This is our robust helper function to safely extract the array of files.
function extractFilesFromResponse(parsedJson) {
  if (parsedJson && Array.isArray(parsedJson.files)) {
    // Ideal case: The AI returned { "files": [...] }
    return parsedJson.files;
  } else if (parsedJson && Array.isArray(parsedJson)) {
    // Fallback case: The AI returned [...] directly.
    return parsedJson;
  } else {
    // Safety net: The AI returned something else entirely (e.g., an empty object, a string).
    // We return an empty array to PREVENT the orchestrator from crashing.
    console.warn(
      "Batch generation returned an unexpected data structure. Defaulting to an empty array."
    );
    return [];
  }
}

export async function generateBatchContent(batchTasks, projectDetails) {
  const batchChain = batchPrompt.pipe(model).pipe(new StringOutputParser());

  const filesToGenerate = batchTasks.map((task) => ({
    path: task.path,
    purpose: task.purpose,
  }));

  const rawResponse = await batchChain.invoke({
    title: projectDetails.title,
    technologies: projectDetails.tech_used,
    description: projectDetails.description,
    files_to_generate: JSON.stringify(filesToGenerate, null, 2),
  });

  try {
    // Updated regex to find an object OR an array, stripping markdown
    const jsonStringMatch = rawResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonStringMatch)
      throw new Error("No JSON object or array found in batch response.");

    const parsedJson = JSON.parse(jsonStringMatch[0]);
    return extractFilesFromResponse(parsedJson); // Use our robust helper
  } catch (error) {
    console.warn("AI returned malformed JSON. Attempting self-correction...");

    // The self-correction logic
    const repairPrompt = PromptTemplate.fromTemplate(
      `The following string is not valid JSON. Please fix it and return ONLY the raw, corrected JSON.
      BROKEN JSON STRING: --- {{json_string}} ---`,
      { templateFormat: "mustache" }
    );

    const repairChain = repairPrompt.pipe(model).pipe(new StringOutputParser());

    try {
      const repairedResponse = await repairChain.invoke({
        json_string: rawResponse,
      });
      const cleanRepairedString = repairedResponse.match(
        /\{[\s\S]*\}|\[[\s\S]*\]/
      )[0];
      const parsedRepairedJson = JSON.parse(cleanRepairedString);
      return extractFilesFromResponse(parsedRepairedJson); // Use the helper on the repaired response too
    } catch (repairError) {
      console.error(
        "Self-correction of batch JSON failed. Returning empty array.",
        repairError
      );
      return []; // FINAL safety net. If even the repair fails, return an empty array.
    }
  }
}
