import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import env from "dotenv";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import methodOverride from "method-override";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import { userInfo } from "os";
import { error } from "console";
import flash from "connect-flash";

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

app.use(
  session({
    secret: process.env.PG_SESSION,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

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
  const errorMessage = req.flash("error");
  res.render("loginPage.ejs", {
    errorMessage: errorMessage.length > 0 ? errorMessage[0] : null,
  });
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
    console.log("SignUp successful");
  } catch (error) {
    console.log(error);
  }
});

// app.post("/login", async (req, res) => {
//   const getData = {
//     username: req.body["username"],
//     password: req.body["password"],
//   };
//   try {
//     await axios.post(`${API_URL}/api/login`, getData);
//     res.redirect("/home");
//     console.log("Login successful");
//   } catch (error) {
//     res.render("loginPage.ejs", { loginError: true });
//     console.log(error);
//   }
// });

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/home",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/home",
    failureRedirect: "/login",
  })
);

//get home page
app.get("/home", async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      const response = await axios.get(`${API_URL}/home?userId=${req.user.id}`);
      res.render("index.ejs", { storeData: response.data, currentUser: req.user });
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

//render add page
app.get("/add", (req, res) => {
  console.log(req.user)
  res.render("modify.ejs",{currentUser: req.user});
});

//upload data
app.post("/api/home", upload.single("image"), async (req, res) => {
  try {
    const { name, title, description, starting_date, ending_date, tech_used } =
      req.body;
    let image_path = null;
    const userId = req.user.id;
    if (req.file) {
      image_path = req.file.path;
    }
    const response = await axios.post(`${API_URL}/add`, {
      name: name,
      title: title,
      description: description,
      starting_date: starting_date,
      ending_date: ending_date,
      tech_used: tech_used,
      image_path: image_path,
      userId: userId,
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
      `${API_URL}/home/${parseInt(req.params.id)}`
    );
    res.render("modify.ejs", { data: response.data, currentUser: req.user});
  } catch (error) {
    res.status(500).json({ message: "Error fetching post" });
  }
});

app.patch("/api/home/:id", upload.single("image"), async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedData = { ...req.body, userId };
    if (req.file) {
      updatedData.image_path = req.file.path;
    }
    await axios.patch(`${API_URL}/home/${Number(req.params.id)}`, updatedData);
    res.redirect("/home");
  } catch (error) {
    res.status(404).json({ message: "Error loading Edited home page" });
  }
});

app.delete("/delete/:id", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;
    await axios.delete(`${API_URL}/home/${postId}?userId=${userId}`);
    res.redirect("/home");
  } catch (error) {
    res.status(404).json({ message: "Unable to delete the blog!" });
  }
});

app.get("/logout", (req, res) => {
  req.logout((e) => {
    if (e) {
      return next(e);
    }
    res.redirect("/");
  });
});

passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const response = await axios.post(`${API_URL}/api/login`, {
        username,
        password,
      });
      return cb(null, response.data);
    } catch (error) {
      console.log(error);
      cb(null, false, { message: "Username or password is worng" });
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    async (acessToken, refreshToken, profile, cb) => {
      console.log(profile);
      try {
        const userData = {
          username: profile.displayName,
          password: "google",
          email: profile.emails[0].value,
          user_image_url: profile.photos[0].value
        };
        const response = await axios.post(
          `${API_URL}/api/auth/google`,
          userData
        );
        return cb(null, response.data);
      } catch (error) {
        console.log(error);
        return cb(null, false);
      }
    }
  )
);

passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
  try {
    const response = await axios.get(`${API_URL}/api/user/${id}`);
    cb(null, response.data);
  } catch (error) {
    console.log(error);
    cb(error);
  }
});

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
