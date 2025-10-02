import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import bcrypt, { hash } from "bcrypt";
import multer from "multer";
import { Octokit } from "@octokit/rest";
import { runOrchestrator } from "./server_logic/Agents/orchestrator_agent.js";
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

export const db = new Pool({
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

app.post("/github/commit/user", async (req, res) => {
  try {
    const { userId, postId, jobId, packType, callbackURL } = req.body;

    await db.query(
      "INSERT INTO jobs (id , user_id, post_id) VALUES ($1, $2, $3)",
      [jobId, userId, postId]
    );
    res.status(202).json({ message: `Job ${jobId} accepted.` });
    runOrchestrator(userId, postId, jobId, packType, callbackURL);
  } catch (error) {
    console.error(
      "FATAL: Failed to create a new job in the database:",
      error.message
    );
    res
      .status(500)
      .json({
        message:
          "Could not start the generation process due to a server error.",
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
      "INSERT INTO post(name, title, description, tech_used, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, title, description, tech_used, userId]
    );
    res.status(202).json(result.rows[0]);
  } catch (error) {
    console.err("API Error in POST /add", error);
    res.status(500).json({ message: "Failed to create project" });
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
