// In ai_agents/moduleBuilder_agent.js
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import env from "dotenv";

env.config();

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-pro", // We need a powerful model for this complex task
});

const moduleBuilderPrompt = PromptTemplate.fromTemplate(
  `You are an expert full-stack developer. Your task is to write the complete source code for a set of related files that form a "module" of a larger application.

  **OVERALL PROJECT GOAL:**
  - Project Title: {{title}}
  - Project Description: {{description}}

  **SYSTEM ARCHITECTURE (Your Source of Truth):**
  ---
  {{architecture_plan}}
  ---

  **FILES YOU MUST GENERATE FOR THIS MODULE:**
  - A list of file paths: {{file_paths}}

  Based on all the provided context, generate the complete, production-ready source code for ALL of the requested files.

  **YOUR OUTPUT FORMAT:**
  You must respond with a single, raw JSON object. The object should have a single root key, "files". The value of "files" must be an array of objects, where each object has two keys: "path" and "content".

  Example:
  {
    "files": [
      {
        "path": "backend/models/User.js",
        "content": "const mongoose = require('mongoose'); ..."
      },
      {
        "path": "backend/controllers/authController.js",
        "content": "const User = require('../models/User'); ..."
      }
    ]
  }`,
  { templateFormat: "mustache" }
);

export async function generateModuleContent(
  moduleTasks,
  projectDetails,
  fullPlan
) {
  const moduleFilePaths = moduleTasks.map((task) => task.path);
  const moduleChain = moduleBuilderPrompt
    .pipe(model)
    .pipe(new JsonOutputParser());

  const response = await moduleChain.invoke({
    title: projectDetails.title,
    description: projectDetails.description,
    architecture_plan: JSON.stringify(fullPlan, null, 2),
    file_paths: JSON.stringify(moduleFilePaths),
  });

  return response.files; // Returns the array of {path, content}
}
