import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import bcrypt, { hash } from "bcrypt";
import multer from "multer";

const app = express();
const port = 4000;
const saltRounds = 10;
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

const db = new pg.Client({
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

app.patch("/home/:id", async (req, res) => {
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
