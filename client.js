import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import e from "express";

const app = express();
const port = 3000;
const API_URL = "http://localhost:4000";
env.config();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.get("/", (req, res) => {
  res.render("loginPage.ejs", { loginError: null });
});

app.get("/signup", (req, res) => {
  res.render("SignUpPage.ejs");
});

app.get("/login", (req, res) => {
  res.redirect("/");
});

app.post("/signup", async (req, res) => {
  const getData = {
    username: req.body["username"],
    password: req.body["password"],
    email: req.body["email"],
  };
  try {
    await axios.post(`${API_URL}/api/signup`, getData);
    res.redirect("/");
    console.log("Login Successful");
  } catch (error) {
    console.log(error);
  }
});

app.post("/login", async (req, res) => {
  const getData = {
    username: req.body["username"],
    password: req.body["password"],
  };
  try {
    await axios.post(`${API_URL}/api/login`, getData);
    res.redirect("/home");
    console.log("Login successful")
  } catch (error) {
    res.render("loginPage.ejs", {loginError: true})
    console.log(error);
  }
});

//get home page
app.get("/home", async (req, res) => {
  try {
    const response = await axios.get(`${API_URL}/home`);
    res.render("index.ejs", { storeData: response.data });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

//render add page
app.get("/add", (req, res) => {
  res.render("modify.ejs");
});

//upload data
app.post("/api/home", async (req, res) => {
  try {
    const { name, title, blog } = req.body;
    const response = await axios.post(`${API_URL}/add`, {
      name: name,
      title: title,
      blog: blog,
    });
    res.redirect("/home");
  } catch (error) {
    res.status(404).json({ message: "Error loading home page" });
  }
});

//render edit page

app.get("/edit/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `${API_URL}/home/${Number(req.params.id)}`
    );
    res.render("modify.ejs", { data: response.data });
  } catch (error) {
    res.status(500).json({ message: "Error fetching post" });
  }
});

app.post("/api/home/:id", async (req, res) => {
  try {
    const response = await axios.patch(
      `${API_URL}/home/${Number(req.params.id)}`,
      req.body
    );
    res.redirect("/home");
  } catch (error) {
    res.status(404).json({ message: "Error loading Edited home page" });
  }
});

app.get("/delete/:id", async (req, res) => {
  try {
    await axios.delete(`${API_URL}/home/${Number(req.params.id)}`);
    res.redirect("/home");
  } catch (error) {
    res.status(404).json({ message: "Unable to delete the blog!" });
  }
});

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
