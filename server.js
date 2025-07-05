import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import bcrypt, { hash } from "bcrypt";

const app = express();
const port = 4000;
const saltRounds = 10;
env.config();

let data = {
  //empty data set declear
  id: "",
  name: "",
  title: "",
  blog: "",
  date: "",
};
const storeData = []; //to show all the blog post

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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

app.get("/home", (req, res) => {
  res.json(storeData);
});

app.get("/home/:id", (req, res) => {
  const Foundpost = storeData.find((post) => post.id === Number(req.params.id));
  if (!Foundpost) {
    res.status(404).json({
      error: "Id not found",
    });
  }
  res.json(Foundpost);
});

app.post("/add", (req, res) => {
  data = {
    id: Date.now() + Math.random(), //to have a unique identity of the blog
    date: new Date(),
    name: req.body.name,
    title: req.body.title,
    blog: req.body.blog,
  };
  storeData.push(data); //push array
  res.status(202).json(data);
});

app.patch("/home/:id", (req, res) => {
  const post = storeData.find((index) => index.id === Number(req.params.id));
  console.log(post);
  if (!post) {
    return res.status(404).json({ message: "Error loading home page" });
  }

  if (req.body.name) post.name = req.body.name;
  if (req.body.blog) post.blog = req.body.blog;
  if (req.body.title) post.title = req.body.title;

  res.json(post);
});

app.delete("/home/:id", (req, res) => {
  const idToDelete = Number(req.params.id);
  const indexToDelete = storeData.findIndex((item) => item.id === idToDelete);

  if (indexToDelete > -1) {
    storeData.splice(indexToDelete, 1);
    console.log(`Successfully deleted item at index: ${indexToDelete}`);
    res.json({ message: "Post deleted successfully" });
  } else {
    console.log(`Could not find item with ID: ${idToDelete} to delete.`);
    res.status(404).json({ message: "Unable to find the post to delete" });
  }
});

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
