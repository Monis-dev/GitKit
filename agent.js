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
      text: `You are a project scaffolding bot. Your sole purpose is to generate a professional README file and a suggested file structure, outputting everything in a strict JSON format.

    The user will provide you with their name, project title, and a description. You MUST parse this information and generate a single JSON object.

    The JSON object MUST have this exact structure:
    {
      "name": "The user's name",
      "title": "The project title",
      "readmeText": "A complete, professionally formatted Markdown string for the README file.",
      "fileStructure": "An array of objects, where each object represents a file with its path and sample content."
    }

    The 'fileStructure' value MUST be a native JSON array. Each object inside the array must contain a 'path' (string) and 'content' (string). The file content should be a simple, illustrative example.

    EXAMPLE:
    User Input: "Name: Bob, Title: Cool Web Scraper, Description: A Python tool to scrape websites for data."
    Your Output:
    {
      "name": "Bob",
      "title": "Cool Web Scraper",
      "readmeText": "# Cool Web Scraper\\n\\n## Description\\n\\nA Python tool designed to efficiently scrape websites for valuable data. It is built for speed and ease of use.\\n\\n## Features\\n* Fast and reliable scraping.\\n* Easy to configure with a JSON file.\\n* Exports data to CSV.",
      "fileStructure": [
        {"path": "scraper.py", "content": "import requests\\n\\nprint('Hello, Scraper!')"},
        {"path": "requirements.txt", "content": "requests==2.28.0"},
        {"path": "config.json", "content": "{ \\"url_to_scrape\\": \\"http://example.com\\" }"}
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
      text: "Understood. I will generate a JSON object containing the README and file structure based on the user's description.",
    },
  ],
};

async function runChat() {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest",
    generationConfig: {
      responseMimeType: "application/json"
    }
   });

  const chat = model.startChat({
    history: [SYSTEM_PROMT, modelAck],
    generationConfig: {
      maxOutputTokens: 600,
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
    const rawText = response
      .text()
      .replace(/```json\n|```/g, "")
      .trim();

    
    try {
      const parsedResponse = JSON.parse(rawText)

      if(parsedResponse.readmeText){
        console.log(`\n--- Generated README for ${parsedResponse.title} ---\n`);
        console.log(parsedResponse.readmeText)
        await fs.writeFile("README.md", parsedResponse.readmeText);
        console.log(
          "\n✅ Success! The README.md file has been saved to your project folder!"
        );
        console.log("File Structure:", parsedResponse.fileStructure)
      } else {
        console.error(
          "Error: The AI response was valid JSON but missing the 'readmeText' field."
        );
      }
      // if (parsedResponse.fileStructure && Array.isArray(parsedResponse.fileStructure)) {
      //   console.log(`\n--- 🗂️ Suggested File Structure ---\n`);
      //   parsedResponse.fileStructure.forEach(file => {
      //     console.log(`📄 Path: ${file.path}`);
      //     console.log(`   Content: "${file.content.substring(0, 50)}..."`); // Show a snippet
      //   });
      //   console.log("\n✅ Successfully generated project structure!");
      // } else {
      //    console.warn("Warning: The AI response did not contain a valid 'fileStructure' array.");
      // }
    } catch (error) {
      console.error("--- Error: Failed to parse the AI response as JSON. ---");
      console.log(
        "The AI did not follow formatting instructions. Here is the raw output:\n"
      );
      console.log(rawText);
    }

  }
}

runChat();
