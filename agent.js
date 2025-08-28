import { GoogleGenerativeAI } from "@google/generative-ai";
import { parse } from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "process";
import * as dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config();

const API_KEY = process.env.MY_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);

const rl = readline.createInterface({ input, output });

const SYSTEM_PROMT = {
  role: "user",
  parts: [
    {
      text: `You are a project scaffolding bot. Your sole purpose is to generate a project's file structure and content, outputting everything in a strict JSON format.

    The user will provide you with their name, project title, and a description. You MUST parse this information and generate a single JSON object.

    The JSON object MUST have this exact structure:
    {
      "name": "The user's name",
      "title": "The project title",
      "fileStructure": "An array of objects, where each object represents a file with its path and content. This array MUST include an entry for 'README.md'."
    }

    The 'fileStructure' value MUST be a native JSON array. Each object inside the array must contain a 'path' (string) and 'content' (string) property. The content for 'README.md' must be a professionally formatted Markdown string containing newline characters (\\n). Other file content should be simple, illustrative examples.

    You MUST infer a complete and logical file structure based on the project description.
    For a "full-stack" application, this MUST include basic frontend files (e.g., 'public/index.html', 'public/style.css', 'public/client.js') and necessary backend files.
    The goal is to provide a comprehensive starting point.

    EXAMPLE:
    User Input: "Name: Bob, Title: Cool Web Scraper, Description: A Python tool to scrape websites for data."
    Your Output:
    {
      "name": "Bob",
      "title": "Cool Web Scraper",
      "fileStructure": [
        {
          "path": "README.md",
          "content": "# Cool Web Scraper\\n\\n## Description\\n\\nA Python tool designed to efficiently scrape websites for valuable data.\\n\\n## Features\\n* Fast and reliable scraping.\\n* Easy to configure with a JSON file.\\n* Exports data to CSV."
        },
        {"path": "scraper.py", "content": "import requests\\n\\nprint('Hello, Scraper!')"},
        {"path": "requirements.txt", "content": "requests==2.28.0"}
      ]
    }

    Your entire response MUST BE ONLY the raw JSON object. Do not wrap it in Markdown. Do not add any conversational text.`,
    },
  ],
};

const modelAck = {
  role: "model",
  parts: [
    {
      text: "Understood. I will generate a JSON object containing the project name, title, and a complete fileStructure array, including the README.md file.",
    },
  ],
};

async function runChat() {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const chat = model.startChat({
    history: [SYSTEM_PROMT, modelAck],
    generationConfig: {
      maxOutputTokens: 2048,
    },
  });

  console.log("Welcome to AI Agent! Type exit to quit");

  while (true) {
    const userInput = await rl.question("You: ");

    if (userInput.toLowerCase() === "exit") {
      console.log("Agent: Goodbye!");
      rl.close();
      break;
    }
    const result = await chat.sendMessage(userInput);
    const response = result.response;
    const rawText = response.text();

    try {
      const parsedResponse = JSON.parse(rawText);

      if (
        parsedResponse.fileStructure &&
        Array.isArray(parsedResponse.fileStructure)
      ) {
        // Find the README.md object within the fileStructure array
        const readmeFile = parsedResponse.fileStructure.find(
          (file) => file.path === "README.md"
        );

        if (readmeFile) {
          console.log(
            `\n--- 📜 Generated README for ${parsedResponse.title} ---\n`
          );
          console.log(readmeFile.content); // Log the content of the found file

          // Save the README.md file
          await fs.writeFile("README.md", readmeFile.content);
          console.log("\n✅ Success! The README.md file has been saved!");
        } else {
          console.warn(
            "Warning: The 'fileStructure' array did not contain a 'README.md' file."
          );
        }

        // Display the entire file structure, including the README
        console.log(`\n--- 🗂️  Suggested Project Structure ---\n`);
        parsedResponse.fileStructure.forEach((file) => {
          console.log(`📄 Path: ${file.path}`);
        });
      } else {
        console.warn(
          "Warning: The AI response did not contain a valid 'fileStructure' array."
        );
      }
    } catch (error) {
      console.error(
        "--- 🚨 Error: Failed to parse the AI response as JSON. ---"
      );
      console.log("Here is the raw output that caused the error:\n");
      console.log(rawText);
    }
  }
}

runChat();

//I am Monin and i have build full stack web application called Commit, which helps developer to manage there project ideas and also provide an efficient and easy way to initialize the repositro with all the necessary file like readme file, js file or py file etc. I used nodejs and express js to build this website
