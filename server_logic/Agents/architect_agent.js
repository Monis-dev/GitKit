import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import env from "dotenv";

env.config();

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.0-flash-exp",
});

const planningPrompt = PromptTemplate.fromTemplate(
  `You are an expert full-stack software architect. A user wants to build a "{pack_type}" project named "{title}" with the following description: "{description}". The technologies to be used are: "{technologies}".

  Your task is to generate a detailed technical plan in JSON format.
  The JSON must have a single key "file_structure" which is an array of objects.
  Each object must contain:
  1. "path": The full path of the file.
  2. "purpose": A concise, single-sentence description for the code-writing agent to follow.
  3. "dependencies": An array of other file paths that this file depends on. It can be empty.

  Analyze the request carefully and create a logical file structure with clear purposes and dependencies.
  For example, a route file depends on its corresponding controller or model file. A React component using other components lists them as dependencies.
  Generate only the raw JSON object, nothing else.`
);

export async function createArchitectPlan(
  packType,
  title,
  description,
  technologies
) {
  const planningChain = planningPrompt
    .pipe(model)
    .pipe(new StringOutputParser());
  const response = await planningChain.invoke({
    pack_type: packType,
    title: title,
    description: description,
    technologies: technologies,
  });
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch[0];
  return JSON.parse(jsonString);
}
