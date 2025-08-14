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

let data = {
  //empty data set declear
  id: "",
  name: "",
  title: "",
  description: "",
  starting_date: "",
  ending_date: "",
  tech_used: "",
  imagePath: "",
};

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
            "INSERT INTO users (username, password, email) VALUES ($1, $2, $3)",
            [username, hash, email]
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
            res.status(200).json({ message: "Signup successful" });
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

app.get("/api/user/:id", async (req, res) => {
  try {
    const userID = req.params.id;
    const response = await db.query("SELECT * FROM users WHERE id = $1", [
      userID,
    ]);
    if (response.rows.length > 0) {
      console.log("User session successful");
      res.status(200).json(response.rows[0]);
    } else {
      console.log("User session does not exist");
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/home/", async (req, res) => {
  const response = await db.query("SELECT * FROM post WHERE user_id = $1", [
    req.query.userId,
  ]);
  res.json(response);
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
  const userId = req.body.userId
  const userPost = {
    name: req.body.name,
    title: req.body.title,
    description: req.body.description,
    starting_date: req.body.starting_date,
    ending_date: req.body.ending_date,
    tech_used: req.body.tech_used,
    imagePath: req.body.imagePath,
  };
  const result = await db.query(
    "INSERT INTO post(name, title, description, starting_date, ending_date, tech_used, image_path, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      userPost.name,
      userPost.title,
      userPost.description,
      userPost.starting_date,
      userPost.ending_date,
      userPost.tech_used,
      userPost.imagePath,
      userId,
    ]
  );
  res.status(202).json(result.rows);
});

app.patch("/home/:id", async (req, res) => {
  const userId = req.body.userId;
  const response = await db.query(
    "UPDATE post SET name = $1, title = $2, starting_date  = $3, ending_date = $4, description = $5, tech_used = $6 WHERE id = $ AND user_id = $8",
    [
      req.body.name,
      req.body.title,
      req.body.description,
      req.body.starting_date,
      req.body.ending_date,
      req.body.tech_used,
      req.params.id,
      userId
    ]
  );
  res.json(response);
});

app.delete("/home/:id", async(req, res) => {
  const respone = await db.query("DELETE FROM post WHERE id = $1 AND user_id = $2", [req.params.id, req.body.userId])
});

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
