import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import env from "dotenv";

env.config();

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.0-flash-exp",
});

const codeGenerationPrompt = PromptTemplate.fromTemplate(
  `You are an expert software developer specializing in {technologies}.
  Your task is to write the complete code for the file located at "{path}".

  Project Title: {title}
  Project Description: {description}
  File's Purpose: {purpose}

  Refer to this overall project plan for context on how your file fits in with others, but DO NOT generate code for any other file:
  {project_plan}

  Instructions:
  - Write only the complete, clean, production-ready code for the file "{path}".
  - Do not add any explanations, markdown formatting (like \`\`\`javascript), or intro/outro sentences.
  - Your output will be saved directly to a file.`
);

export async function generateFileContent(fileTask, projectDetails, fullPlan) {
  const codeChain = codeGenerationPrompt
    .pipe(model)
    .pipe(new StringOutputParser());
  const response = await codeChain.invoke({
    technologies: projectDetails.tech_used,
    path: fileTask.path,
    title: projectDetails.title,
    description: projectDetails.description,
    purpose: fileTask.purpose,
    project_plan: JSON.stringify(fullPlan, null, 2),
  });
  return response;
}
