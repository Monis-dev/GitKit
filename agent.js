import { GoogleGenerativeAI } from "@google/generative-ai";
import { parse } from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "process";
import * as dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.MY_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);

const rl = readline.createInterface({ input, output });

const SYSTEM_PROMT = {
  role: "user",
  parts: [
    {
      text: `You are a README file generator bot. Your sole purpose is to create a professional README text and output it in a strict JSON format.

            The user will provide you with their name, project title, 
            and a description. You MUST parse this information 
            and generate a JSON object.

            The JSON object MUST have this exact structure:
            {
              "name": "The user's name",
              "title": "The project title",
              "readmeText": "A complete, professionally 
                            formatted Markdown string for the README file."
            }

            The 'readmeText' value must be a single JSON string 
            containing proper Markdown formatting with newline 
            characters (\\n) for line breaks.

            EXAMPLE:
            User Input: "Name: Bob, Title: Cool Web Scraper, 
            Description: A Python tool to scrape websites for data."
            Your Output:
            {
              "name": "Bob",
              "title": "Cool Web Scraper",
              "readmeText": "# Cool Web Scraper\\n\\n## Description\\n\\nA Python tool designed to efficiently scrape websites for valuable data. It is built for speed and ease of use.\\n\\n## Features\\n* Fast and reliable scraping.\\n* Easy to configure with a JSON file.\\n* Exports data to CSV."
            }

            You MUST NOT provide any other text, conversation, 
            or explanation. Your entire response must be ONLY the 
            raw JSON object.`,
    },
  ],
};

async function runChat() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const chat = model.startChat({
    history: [SYSTEM_PROMT],
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
    const rawText = response.text().replace(/```json\n|```/g,"".trim())

    try {
      const parsedResponse = JSON.parse(rawText)

      if(parsedResponse.readmeText){
        console.log(`\n--- Generated README for ${parsedResponse.title} ---\n`);
        console.log(parsedResponse.readmeText)
      } else {
        console.error(
          "Error: The AI response was valid JSON but missing the 'readmeText' field."
        );
      }
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
