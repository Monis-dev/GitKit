import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import env from "dotenv";

env.config();

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.0-flash-exp",
});

const docsGenerationPrompt = PromptTemplate.fromTemplate(
  `You are an expert technical writer. Your specialty is creating clear, professional, and comprehensive documentation for software projects.

  Your task is to generate the complete content for the file located at "{path}".

  Project Title: {title}
  Project Description: {description}
  Technologies Used: {technologies}

  The specific purpose for this file is: "{purpose}"

  Based on all this information, write the full, high-quality markdown content for the file.
  Do not include any code unless specifically asked to in the purpose.
  Do not add any explanations, markdown code fences (\`\`\`), or any text other than the raw file content itself.`
);

export async function generateDocsContent(fileTask, projectDetails) {
  const docsChain = docsGenerationPrompt
    .pipe(model)
    .pipe(new StringOutputParser());

  const response = await docsChain.invoke({
    path: fileTask.path,
    purpose: fileTask.purpose,
    title: projectDetails.title,
    description: projectDetails.description,
    technologies: projectDetails.tech_used,
  });

  return response;
}
