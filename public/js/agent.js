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

const SYSTEM_PROMT_SP = {
  role: "user",
  parts: [
    {
      text: `You are a project scaffolding bot. Your sole purpose is to generate a project's file structure and content, outputting everything in a strict JSON format.

    The user will provide you with their project title, a description and technologies used by then. You MUST parse this information and generate a single JSON object.

    The JSON object MUST have this exact structure:
    {
      "name": "The user's name",
      "title": "The project title",
      "fileStructure": "An array of objects, where each object represents a file with its path and content. This array MUST include an entry for 'README.md'."
    }

    The 'fileStructure' value MUST be a native JSON array. Each object inside the array must contain a 'path' (string) and 'content' (string) property. The content for 'README.md' must be a professionally formatted Markdown string containing newline characters (\\n). Other file content should be simple, illustrative examples.

    You MUST infer a complete and logical file structure based on the project description.
    For a "full-stack" application, this MUST include basic frontend files (e.g., 'public/index.html', 'public/style.css', 'public/client.js') and necessary backend files.
    The goal is to provide a comprehensive starting point. MAKE SHURE THAT you do not provide the visual file representation in the readme content.

    !Important: made the readme text a bit longer with details of what the project is about and how it can help others.
    
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

const SYSTEM_PROMT_CP = {
  role: "user",
  parts: [
    {
      text: `You are an expert software architect and developer bot. Your sole purpose is to generate a complete, functional, and well-structured project scaffold based on a user's request, outputting everything in a strict JSON format.

    The user will provide you with their project title, a description, and the technologies they want to use. You MUST generate a single JSON object.

    The JSON object MUST have this exact structure:
    {
      "title": "The project title",
      "fileStructure": "An array of objects representing a complete file structure. This array MUST include a detailed 'README.md'."
    }
    
    !Important: The 'fileStructure' array must contain objects with 'path' and 'content' properties. The 'content' for every file MUST be the complete, production-quality, and fully functional code. Do not use placeholders.

    You MUST infer a complete and logical file structure. For a "full-stack" application, this includes logically separated frontend and backend files. For a backend, this includes routes, controllers, and server initialization.
    
    !Important: Your goal is to generate code of the quality and completeness shown in the example below.

    EXAMPLE:
    User Input: "Title: Simple Todo API, Description: A backend API to manage a list of tasks, Technologies: Node.js, Express"
    Your Output:
    {
      "title": "Simple Todo API",
      "fileStructure": [
        {
          "path": "README.md",
          "content": "# Simple Todo API\\n\\n## Description\\n\\nThis is a lightweight and efficient backend API for managing a todo list. It provides RESTful endpoints to create, read, update, and delete tasks.\\n\\n## API Endpoints\\n* \`GET /tasks\`: Retrieve all tasks.\\n* \`POST /tasks\`: Create a new task.\\n* \`DELETE /tasks/:id\`: Delete a task by its ID."
        },
        {
          "path": "package.json",
          "content": "{\\n  \\"name\\": \\"simple-todo-api\\",\\n  \\"version\\": \\"1.0.0\\",\\n  \\"description\\": \\"A backend API to manage a list of tasks\\",\\n  \\"main\\": \\"server.js\\",\\n  \\"scripts\\": { \\"start\\": \\"node server.js\\" },\\n  \\"dependencies\\": { \\"express\\": \\"^4.18.2\\", \\"cors\\": \\"^2.8.5\\" }\\n}"
        },
        {
          "path": "server.js",
          "content": "const express = require('express');\\nconst cors = require('cors');\\nconst app = express();\\nconst port = 3001;\\n\\napp.use(cors());\\napp.use(express.json());\\n\\nlet tasks = [{ id: 1, text: 'Learn Node.js', completed: false }];\\nlet currentId = 2;\\n\\napp.get('/tasks', (req, res) => {\\n  res.json(tasks);\\n});\\n\\napp.post('/tasks', (req, res) => {\\n  const newTask = { id: currentId++, text: req.body.text, completed: false };\\n  tasks.push(newTask);\\n  res.status(201).json(newTask);\\n});\\n\\napp.delete('/tasks/:id', (req, res) => {\\n  tasks = tasks.filter(t => t.id !== parseInt(req.params.id));\\n  res.status(204).send();\\n});\\n\\napp.listen(port, () => {\\n  console.log(\`Server running at http://localhost:\${port}\`);\\n});"
        }
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

export async function runChat(packType, Title, description, tech_used) {
  let Pack
  let count
  let API_modal
  if (packType == 'starter') {
    Pack = SYSTEM_PROMT_SP;
    count = 2048;
    API_modal = "gemini-1.5-flash-latest";
  } else if (packType == 'complete') {
    Pack = SYSTEM_PROMT_CP;
    count = 8192;
    API_modal = "gemini-2.5-pro";
  }
  const model = genAI.getGenerativeModel({
    model: API_modal,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const chat = model.startChat({
    history: [Pack, modelAck],
    generationConfig: {
      maxOutputTokens: count,
    },
  });

  console.log("Welcome to AI Agent! Type exit to quit");

  // const userInput = await rl.question("You: ");
   const userInput = `Hi my project name is ${Title} and ${description}. I also used these technologies ${tech_used}`
  const result = await chat.sendMessage(userInput);
  const response = result.response;
  const rawText = response.text();


  return rawText
  // while (true) {
  //   

  //   if (userInput.toLowerCase() === "exit") {
  //     console.log("Agent: Goodbye!");
  //     rl.close();
  //     break;
  //   }

  //   console.log(rawText);
  // }
}


// runChat();

//I am Monin and i have build full stack web application called Commit, which helps developer to manage there project ideas and also provide an efficient and easy way to initialize the repositro with all the necessary file like readme file, js file or py file etc. I used nodejs and express js to build this website
