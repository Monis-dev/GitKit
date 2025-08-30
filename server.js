import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import bcrypt, { hash } from "bcrypt";
import multer from "multer";
import { Octokit } from "@octokit/rest";
import { runChat } from "./agent.js";

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

app.post("/github/commit/user", async (req, res) => {
  try {
    const { userId, postId } = req.body;
    console.log(postId);
    const userDetails = await db.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    try {
      const postDetails = await db.query("SELECT * FROM post WHERE id = $1", [
        postId,
      ]);
      if (userDetails.rows.length != 0) {
        if (postDetails.rows.length != 0) {
          const user = userDetails.rows[0];
          const post = postDetails.rows[0];
          const rawAIResponse = await runChat(
            post.title,
            post.description,
            post.tech_used
          );

          const jsonString = rawAIResponse.match(/\{[\s\S]*\}/);
          const cleanJson = jsonString[0];
          const aiData = JSON.parse(cleanJson);
          const fileStructure = aiData.fileStructure;
          console.log(fileStructure);

          const octokit = new Octokit({
            auth: user.github_access_token,
          });

          const repoName = post.title
            .replace(/\s+/g, "-")
            .replace(/[^a-zA-Z0-9-_]/g, "")
            .replace(/--+/g, "-")
            .replace(/^-|-$/g, '');

          const sanitizationDecription = post.description
            .replace(/[\n\r\t]/g, ' ')
            .replace(/[\s+]/g, ' ')
            .trim();
          const repoCreationResponse = await octokit.request(
            "POST /user/repos",
            {
              name: repoName,
              description: "This is your first repository",
              homepage: "https://github.com",
              private: true,
              has_issues: true,
              has_projects: true,
              has_wiki: true,
              auto_init: true,
              headers: {
                "X-GitHub-Api-Version": "2022-11-28",
              },
            }
          );
          // console.log("Owner", repoCreationResponse.data.owner.login);
          // console.log("Repo name:", repoCreationResponse.data.name);

          console.log("Waiting for 3 seconds to allow ref to propagate...");
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const readmeIndex = fileStructure.findIndex(
            (file) => file.path.toLowerCase() === "readme.md"
          );
          if (readmeIndex > -1) {
            const removedObject = fileStructure.splice(0, 1);
            const readmeFileObject = removedObject[0];
            const readmeString = readmeFileObject.content;
            const encodedReadmeString =
              Buffer.from(readmeString).toString("base64");
            try {
              const currentReadme = await octokit.rest.repos.getContent({
                owner: repoCreationResponse.data.owner.login,
                repo: repoCreationResponse.data.name,
                path: "README.md",
              });
              await octokit.rest.repos.createOrUpdateFileContents({
                owner: repoCreationResponse.data.owner.login,
                repo: repoCreationResponse.data.name,
                path: readmeFileObject.path,
                message: "Updated commit form the Project Diary",
                content: encodedReadmeString,
                sha: currentReadme.data.sha,
                branch: "main",
              });
              console.log("Readme file sucessfully updated");
            } catch (error) {
              await octokit.rest.repos.createOrUpdateFileContents({
                owner: repoCreationResponse.data.owner.login,
                repo: repoCreationResponse.data.name,
                message: "Initial commit form the Project Diary",
                content: encodedReadmeString,
              });
              console.log("Readme file sucessfully uploaded");
            }
          }
          if (fileStructure.length > 0) {
            console.log("Waiting for 2 seconds to allow ref to propagate...");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await repoGenerator(
              octokit,
              fileStructure,
              repoCreationResponse.data.owner.login,
              repoCreationResponse.data.name
            );
            console.log("All files added successfully");
          }

          res.status(201).json({
            message: "commit successful",
            redirectLink: `https://github.com/${user.github_username}/${post.title}`,
          });
        } else {
          res.status(400).json({ message: "Post not found" });
        }
      } else {
        res
          .status(403)
          .json("User fail to authorize webapp to access user github");
      }
    } catch (error) {
      console.log("Post error:", error.message);
    }
  } catch (error) {
    console.error("Octokit API Error:", error.message);
    res.status(400).json({ message: "faild to commit" });
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
  const rawStartDate = req.body.starting_date;
  const rawEndDate = req.body.ending_date;

  const startDate = rawStartDate ? rawStartDate : null;
  const endDate = rawEndDate ? rawEndDate : null;

  const userPost = {
    name: req.body.name,
    title: req.body.title,
    description: req.body.description,
    starting_date: req.body.starting_date,
    ending_date: req.body.ending_date,
    tech_used: req.body.tech_used,
    image_path: req.body.image_path,
  };
  const result = await db.query(
    "INSERT INTO post(name, title, description, starting_date, ending_date, tech_used, image_path, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      userPost.name,
      userPost.title,
      userPost.description,
      startDate,
      endDate,
      userPost.tech_used,
      userPost.image_path,
      req.body.userId,
    ]
  );
  res.status(202).json(result.rows);
});

app.patch("/api/home/:id", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.body.userId;
    const checkResult = await db.query(
      "SELECT * FROM post WHERE id = $1 AND user_id = $2",
      [postId, userId]
    );
    if (checkResult.rows.length === 0) {
      res.status(404).json({ message: "Post not found..." });
    }

    const originalPost = checkResult.rows[0];
    const updatedPost = {
      name: req.body.name || originalPost.name,
      title: req.body.title || originalPost.title,
      starting_date: req.body.starting_date || originalPost.starting_date,
      ending_date: req.body.ending_date || originalPost.ending_date,
      description: req.body.description || originalPost.description,
      tech_used: req.body.tech_used || originalPost.tech_used,
      image_path: req.file || originalPost.image_path,
    };
    const updateQuery = `
      UPDATE post
      SET name = $1, title = $2, description = $3, starting_date = $4, ending_date = $5, tech_used = $6, image_path = $7
      WHERE id = $8 AND user_id = $9
      RETURNING *;
    `;

    const result = await db.query(updateQuery, [
      updatedPost.name,
      updatedPost.title,
      updatedPost.description,
      updatedPost.starting_date,
      updatedPost.ending_date,
      updatedPost.tech_used,
      updatedPost.image_path,
      postId,
      userId,
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
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
