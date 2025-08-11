import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import env from "dotenv";
import multer from "multer";
import path from "path"; 
import { fileURLToPath } from "url";
import methodOverride from "method-override";

const app = express();
const port = 3000;
const API_URL = "http://localhost:4000";
env.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    // Create a unique filename to prevent overwriting
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

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
app.post("/api/home", upload.single("image"), async (req, res) => {
  try {
    const { name, title, description, starting_date, ending_date, tech_used } = req.body;
    let imagePath = null;
    if (req.file) {
      imagePath = req.file.path;
    }
    const response = await axios.post(`${API_URL}/add`, {
      name: name,
      title: title,
      description: description,
      starting_date: starting_date,
      ending_date: ending_date,
      tech_used: tech_used,
      imagePath: imagePath,
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

app.patch("/api/home/:id", upload.single("image"), async (req, res) => {
  try {
    const updatedData = { ...req.body };

    // If a new file was uploaded during the edit, add its path
    if (req.file) {
      updatedData.imagePath = req.file.path;
    }

    // Send the PATCH request to the backend API
    await axios.patch(`${API_URL}/home/${Number(req.params.id)}`, updatedData);

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
