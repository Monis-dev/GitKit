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
import GitHubStrategy from "passport-github2";
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

// app.use((req, res, next) => {
//   console.log(`--> INCOMING REQUEST: ${req.method} ${req.originalUrl}`);
//   next();
// });

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

app.get(
  "/auth/github",
  passport.authenticate("github", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/github/callback",
  passport.authenticate("github", {
    successRedirect: "/home",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get(
  "/connect/github",
  passport.authorize("github", {
    scope: ["repo"],
  })
);

app.get(
  "/connect/github/callback",
  passport.authorize("github"),
  (req, res) => {
    res.redirect("/home");
  }
);

//get home page
app.get("/home", async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      const response = await axios.get(`${API_URL}/home?userId=${req.user.id}`);
      const errorMessage = req.flash("error")[0];
      const successMessage = req.flash("success")[0];
      res.render("index.ejs", {
        storeData: response.data,
        currentUser: req.user,
        errorMessage: errorMessage,
        successMessage: successMessage
      });
      // console.log(req.user)
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

//render add page
app.get("/add", (req, res) => {
  // console.log(req.user);
  res.render("modify.ejs", { currentUser: req.user });
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

app.post("/github/commit/:projectId", async (req, res) => {
  try {
    if (req.isAuthenticated()) {
      if (req.user && req.user.github_access_token) {
        const userId = req.user.id;
        const postId = req.params.projectId;
        const packType = req.body.packType;
        const response = await axios.post(`${API_URL}/github/commit/user`, {
          userId: userId,
          postId: postId,
          packType: packType,
        });
        console.log("Backend call successful. Redirecting to home.");
        req.flash("success", "Successfully created GitHub repository!");
        res.redirect("/home");
      } else {
        console.log("User has not connected a GitHub account");
        const errorMessage = req.flash(
          "error",
          "Please connect your GitHub account first to create a repository."
        );
        res.redirect("/home");
      }
    } else {
      res.redirect("/login");
      console.log("session not found");
    }
  } catch (error) {
    console.error("Error in commit process:", error);
    req.flash("error", "An unexpected error occurred. Please try again.");
    res.redirect("/home");
  }
});

app.get("/edit/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `${API_URL}/home/${parseInt(req.params.id)}`
    );
    res.render("modify.ejs", { data: response.data, currentUser: req.user });
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
    await axios.patch(
      `${API_URL}/api/home/${Number(req.params.id)}`,
      updatedData
    );
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
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    async (acessToken, refreshToken, profile, cb) => {
      // console.log(profile);
      try {
        const userData = {
          username: profile.displayName,
          password: "google",
          email: profile.emails[0].value,
          user_image_url: profile.photos[0].value,
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

passport.use(
  "github",
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/github/callback",
      passReqToCallback: true,
    },
    async (req, acessToken, refreshToken, profile, cb) => {
      console.log(profile);
      if (req.user) {
        const userId = req.user.id;
        const githubProfileData = {
          github_id: profile.id,
          github_username: profile.username,
          github_access_token: acessToken,
        };
        // console.log(githubProfileData);
        const response = await axios.patch(
          `${API_URL}/user/github/${userId}/link-github`,
          githubProfileData
        );
        return cb(null, req.user);
      } else {
        try {
          const userData = {
            username: profile.displayName,
            password: "Github",
            email: profile.emails[0].value,
            user_image_url: profile.photos[0].value,
            github_id: profile.id,
            github_username: profile.username,
            github_access_token: acessToken,
          };
          const response = await axios.post(
            `${API_URL}/api/auth/github`,
            userData
          );
          return cb(null, response.data);
        } catch (error) {
          console.log(error);
          return cb(null, false);
        }
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
