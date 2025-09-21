import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import bcrypt, { hash } from "bcrypt";
import multer from "multer";
import { Octokit } from "@octokit/rest";
import { runChat } from "./public/js/agent.js";
import axios from "axios";

const app = express();
const port = 4000;
const saltRounds = 10;
const { Pool } = pg;
env.config();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "/public/uploads");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

const upload = multer({ storage: storage });

const storeData = []; //to show all the blog post

const db = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

app.post("/api/signup", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const email = req.body.email;
  const user_image_url =
    "https://cdn-icons-png.flaticon.com/512/12225/12225881.png";
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    if (result.rows.length == 0) {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.log(err);
        } else {
          await db.query(
            "INSERT INTO users (username, password, email, user_image_url) VALUES ($1, $2, $3, $4)",
            [username, hash, email, user_image_url]
          );
          console.log("User sign up successful");
          res.status(201).json({ message: "Signup successful" });
        }
      });
    } else {
      res.status(409).json({ message: "User already exist" });
    }
  } catch (error) {
    console.log(error);
    res.status(505).json({ message: "Internal server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const username = req.body.username;
  const loginPassword = req.body.password;
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    if (result.rows.length != 0) {
      const user = result.rows[0];
      const storePassword = user.password;
      bcrypt.compare(loginPassword, storePassword, (err, result) => {
        if (err) {
          console.log(err);
        } else {
          if (result) {
            res.status(200).json(user);
          } else {
            res.status(401).json({ message: "Username or password is wrong!" });
          }
        }
      });
    } else {
      res.status(401).json({ message: "User does not exist" });
    }
  } catch (error) {
    console.log(error);
    res.status(505).json({ message: "Internal server error" });
  }
});

app.post("/api/auth/google", async (req, res) => {
  const userData = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      userData.email,
    ]);
    if (result.rows.length === 0) {
      const newUser = await db.query(
        "INSERT INTO users(username, password, email, user_image_url) VALUES($1, $2, $3, $4) RETURNING *",
        [
          userData.username,
          userData.password,
          userData.email,
          userData.user_image_url,
        ]
      );
      res.status(201).json(newUser.rows[0]);
    } else {
      res.status(200).json(result.rows[0]);
    }
  } catch (error) {
    res.status(401).json({ message: "Error authentication using google" });
  }
});
///////////////////////////////Update the post table remove the starting, ending date and image_url///////////////////////////////////////////////////////////////////////////////////

app.post("/api/auth/github", async (req, res) => {
  const userData = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      userData.email,
    ]);
    if (result.rows.length === 0) {
      const newUser = await db.query(
        "INSERT INTO users(username, password, email, user_image_url, github_id, github_username, github_access_token) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [
          userData.username,
          userData.password,
          userData.email,
          userData.user_image_url,
          userData.github_id,
          userData.github_username,
          userData.github_access_token,
        ]
      );
      res.status(201).json(newUser.rows[0]);
    } else {
      res.status(200).json(result.rows[0]);
    }
  } catch (error) {
    res.status(401).json({ message: "Error authentication using github" });
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.patch("/user/github/:id/link-github", async (req, res) => {
  try {
    const userId = req.params.id;
    const { github_id, github_username, github_access_token } = req.body;
    console.log(userId);
    const result = await db.query(
      "UPDATE users SET github_id = $1, github_username = $2, github_access_token = $3 WHERE id = $4 RETURNING *",
      [github_id, github_username, github_access_token, userId]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(401).json({ message: "Error authentication using google" });
  }
});

async function repoGenerator(octokit, Response, owner, repo) {
  const blobSHAs = [];
  for (const file of Response) {
    const blobData = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: file.content,
      encoding: "utf-8",
    });
    blobSHAs.push({ path: file.path, sha: blobData.data.sha });
  }
  const treeArray = blobSHAs.map(({ path, sha }) => ({
    path,
    sha,
    mode: "100644",
    type: "blob",
  }));
  try {
    const refData = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: "heads/main",
    });
    const parentSha = refData.data.object.sha;
    const parentCommit = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: parentSha,
    });
    const treeData = await octokit.rest.git.createTree({
      owner,
      repo,
      tree: treeArray,
      base_tree: parentCommit.data.tree.sha,
    });
    const treeShaData = treeData.data.sha;
    const commitData = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: "Initial commit from the Project Diary",
      tree: treeShaData,
      parents: [parentSha],
    });
    const commitSha = commitData.data.sha;
    return await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: "heads/main",
      sha: commitSha,
      force: false,
    });
  } catch (error) {
    console.log(error);
  }
}

async function sendProgressUpdate(callbackURL, progressData) {
  try {
    await axios.post(callbackURL, progressData);
  } catch (error) {
    console.log("Failed to send progress update:", error.message);
  }
}

app.post("/github/commit/user", async (req, res) => {
  const { userId, postId, jobId, packType,callbackURL } = req.body;

  try {
    res.status(202).json({ message: `Job ${jobId} accepted.` });

    const userDetails = await db.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    const postDetails = await db.query("SELECT * FROM post WHERE id = $1", [
      postId,
    ]);

    await sendProgressUpdate(callbackURL, {
      step: "start",
      message: "Fetching user & project data...",
    });

    if (userDetails.rows.length === 0 || postDetails.rows.length === 0) {
      throw new Error("User or Post not found in the database.");
    }

    const user = userDetails.rows[0];
    const post = postDetails.rows[0];

    console.log(packType)

    if (!user.github_access_token) {
      throw new Error("GitHub account not connected or access token is missing.");
    }

    await sendProgressUpdate(callbackURL, {
      step: "ai",
      message: "Generating file structure with AI...",
    });
    const rawAIResponse = await runChat(
      packType,
      post.title,
      post.description,
      post.tech_used
    );

    const jsonString = rawAIResponse.match(/\{[\s\S]*\}/);
    if (!jsonString) {
      throw new Error(
        "Could not parse a valid JSON structure from the AI response."
      );
    }
    const cleanJson = jsonString[0];
    const aiData = JSON.parse(cleanJson);
    const fileStructure = aiData.fileStructure;

    const sanitizedFileStructure = fileStructure.filter(
      (file) => file.path && file.path.trim() !== "" && !file.path.endsWith("/")
    );

    const octokit = new Octokit({ auth: user.github_access_token });
    const repoName = post.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/--+/g, "-");

    await sendProgressUpdate(callbackURL, {
      step: "repo_create",
      message: "Creating GitHub repository...",
    });
    const repoCreationResponse = await octokit.request("POST /user/repos", {
      name: repoName,
      description: "This is your first repository",
      private: true,
      auto_init: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const readmeIndex = sanitizedFileStructure.findIndex(
      (file) => file.path.toLowerCase() === "readme.md"
    );
    await sendProgressUpdate(callbackURL, {
      step: "readme",
      message: "Updating README.md...",
    });
    if (readmeIndex > -1) {
      const readmeFileObject = sanitizedFileStructure[readmeIndex];
      const encodedReadmeString = Buffer.from(
        readmeFileObject.content
      ).toString("base64");
      const { data: currentReadme } = await octokit.rest.repos.getContent({
        owner: repoCreationResponse.data.owner.login,
        repo: repoCreationResponse.data.name,
        path: "README.md",
      });
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: repoCreationResponse.data.owner.login,
        repo: repoCreationResponse.data.name,
        path: "README.md",
        message: "Update README.md from Project Diary",
        content: encodedReadmeString,
        sha: currentReadme.sha,
        branch: "main",
      });
      console.log("README.md file successfully updated.");
    }

    const otherFiles = sanitizedFileStructure.filter(
      (file) => file.path.toLowerCase() !== "readme.md"
    );
    if (otherFiles.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await sendProgressUpdate(callbackURL, {
        step: "files",
        message: "Uploading project files...",
      });
      await repoGenerator(
        octokit,
        otherFiles,
        repoCreationResponse.data.owner.login,
        repoCreationResponse.data.name
      );
      console.log("All other files added successfully.");
    }

    await sendProgressUpdate(callbackURL, {
      status: "done",
      message: "Success! Repository created.",
      redirectUrl: "/home",
      successFlash: "Successfully created GitHub repository!",
    });
  } catch (error) {
    console.error("!!! A FATAL ERROR OCCURRED IN THE WORKER PROCESS !!!");
    console.error("Error Message:", error.message);

    await sendProgressUpdate(callbackURL, {
      status: "error",
      message: `An error occurred: ${
        error.message || "Unknown error. Please check server logs."
      }`,
    });
  }
});

app.get("/api/user/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const response = await db.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    if (response.rows.length > 0) {
      res.status(200).json(response.rows[0]);
    } else {
      console.log("User session does not exist");
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/home", async (req, res) => {
  const userId = req.query.userId; // First, get the string value, THEN parse it.

  // Safety check for invalid IDs
  if (isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user ID provided." });
  }

  const response = await db.query(
    "SELECT * FROM post WHERE user_id = $1 ORDER BY id DESC",
    [userId]
  );
  res.json(response.rows);
});

app.get("/home/:id", async (req, res) => {
  const response = await db.query("SELECT * FROM post WHERE id = $1", [
    req.params.id,
  ]);
  if (response.rows.length > 0) {
    res.json(response.rows[0]);
  } else {
    res.status(404).json({
      error: "Id not found",
    });
  }
});

app.post("/add", async (req, res) => {
  try {
    const { name, title, description, tech_used, pack, userId } = req.body;
    const result = await db.query(
      "INSERT INTO post(name, title, description, tech_used, pack, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *", [
        name, title ,description, tech_used, pack, userId
      ]
    );
    res.status(202).json(result.rows[0]);
  } catch (error) {
    console.err("API Error in POST /add", error);
    res.status(500).json({message: "Failed to create project"})
  }
});

app.delete("/home/:id", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = parseInt(req.query.userId);
    await db.query("DELETE FROM post WHERE id = $1 AND user_id = $2", [
      postId,
      userId,
    ]);
    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(404).json({ message: "Post not found" });
  }
});

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
