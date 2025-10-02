import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  StringOutputParser,
  JsonOutputParser,
} from "@langchain/core/output_parsers";
import env from "dotenv";

env.config();

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash-lite", // Use the more powerful Pro model for the critical planning phase
});

// The prompt you designed to fix the "Project" bias. It's excellent.
const planningPrompt = PromptTemplate.fromTemplate(
  `You are a Lead Software Architect designing a high-level scaffold.
  Your task is to produce a JSON object defining the key contracts and the file paths for an application.

  - Application Name: "{{title}}"
  - User's Core Request: "{{description}}"
  - Technologies: "{{technologies}}"

  Based on the user's request, you must generate a specification with three keys: "database_schema", "api_contract", and "file_structure".

  1.  **"database_schema"**: An ARRAY of objects defining the database models and their fields.
  2.  **"api_contract"**: An ARRAY of objects defining the API endpoints.
  3.  **"file_structure"**: A flat ARRAY of objects. Each object represents a single file and must contain ONLY two keys: "path" and "dependencies". **DO NOT include a "purpose" key.**

  CRITICAL: The dependency graph must not contain circular references.
  Your output must be ONLY the raw JSON object.`,
  { templateFormat: "mustache" }
);

// The self-reviewing architect function we designed.
export async function createArchitectPlan(
  packType,
  title,
  description,
  technologies
) {
  const planningChain = planningPrompt
    .pipe(model)
    .pipe(new StringOutputParser());
  const rawInitialPlan = await planningChain.invoke({
    pack_type: packType, // packType is not in the prompt, but it's okay to pass extra variables
    title: title,
    description: description,
    technologies: technologies,
  });

  const reviewArchitectPrompt = PromptTemplate.fromTemplate(
    `You are a meticulous Senior QA Architect. Your job is to find and fix inconsistencies in the technical specification below.
    Critically analyze the plan. Are there fields in the API contract missing from the database schema? Are there any contradictions?
    If the plan is consistent and logical, return the original JSON.
    If you find inconsistencies, fix them and return the corrected, complete JSON plan.
    You MUST return only the raw JSON object.
    
    PLAN TO REVIEW AND FIX:
    ---
    {{initial_plan}}
    ---`,
    { templateFormat: "mustache" }
  );

  const selfReviewChain = reviewArchitectPrompt
    .pipe(model)
    .pipe(new JsonOutputParser());
  const finalValidatedPlan = await selfReviewChain.invoke({
    initial_plan: rawInitialPlan,
  });

  return finalValidatedPlan;
}
