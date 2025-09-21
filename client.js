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
import { v4 as uuidv4 } from "uuid";

const app = express();
const port = 3000;
const API_URL = "http://localhost:4000";
const activeClients = {};
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

app.get("/home", async (req, res) => {
  if (req.isAuthenticated()) {
    const errorMessage = req.flash("error")[0];
    const successMessage = req.flash("success")[0];
    res.render("chat.ejs", {
      // storeData: response.data,
      currentUser: req.user,
      currentPage: "chat",
      errorMessage: errorMessage,
      successMessage: successMessage,
    });
    // console.log(req.user)
  } else {
    res.redirect("/");
  }
});

app.get("/dashboard", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }
  try {
    const response = await axios.get(`${API_URL}/home?userId=${req.user.id}`);
    const storeData = response.data; // The list of projects

    res.render("dashboard.ejs", {
      currentUser: req.user,
      storeData: storeData, // Pass the project list to the dashboard view
      currentPage: "dashboard", // For the active sidebar link
    });
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    res.redirect("/"); // Redirect on error
  }
});

//upload data
app.post("/api/home", async (req, res) => {
  if(!req.isAuthenticated()){
    return res.redirect("/login")
  }
  try {
    const name = req.user.username;
    console.log(name)
    const { title, description, tech_used, pack } = req.body;
    const userId = req.user.id;
    const response = await axios.post(`${API_URL}/add`, {
      name: name,
      title: title,
      description: description,
      tech_used: tech_used,
      pack: pack.toLowerCase(),
      userId: userId,
    });
    req.flash("success", "Project idea saved!");
    res.redirect("/home");
  } catch (error) {
    console.error("Error saving project:", error.message);
    req.flash("error", "Failed to save your project idea.");
    res.status(404).json({ message: "Error loading home page" });
  }
});

//render edit page

app.post("/github/commit/:projectId", async (req, res) => {
  if (!req.isAuthenticated() || !req.user || !req.user.github_access_token) {
    return res.status(401).json({ error: "Authentication required." });
  }
  const userId = req.user.id;
  const postId = req.params.projectId;
  const packType = req.body.packType;
  console.log(packType)
  console.log("Checking pack type: ", packType);
  const jobId = uuidv4();
  res.status(202).json({ jobId });
  try {
    const callbackURL = `${req.protocol}://${req.get(
      "host"
    )}/internal/commit-progress/${jobId}`;
    console.log("Constructed Callback URL:", callbackURL);
    console.log("--- CLIENT IS SENDING ---");
    console.log("About to call worker with this body:");
    const requestBody = {
      userId: userId,
      postId: postId,
      packType: packType,
      jobId: jobId,
      callbackURL: callbackURL, // Check this variable name
    };
    console.log(requestBody);
    console.log("-------------------------");
    axios.post(`${API_URL}/github/commit/user`, requestBody);
  } catch (error) {
    console.error(`Error starting job ${jobId}:`, error.message);
    const client = activeClients[jobId];
    if (client) {
      // If the browser managed to connect, send it an error message
      const errorData = {
        status: "error",
        message: "Failed to communicate with worker server.",
      };
      client.write(`data: ${JSON.stringify(errorData)}\n\n`);
      client.end();
    }
  }
});

app.get("/github/commit/progress/:jobId", (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  activeClients[jobId] = res;
  console.log(`Browser connected for job ${jobId}`);

  req.on("close", () => {
    delete activeClients[jobId];
    console.log(`Browser disconnected for job ${jobId}`);
  });
});

app.post("/internal/commit-progress/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const progressData = req.body;
  const client = activeClients[jobId];
  if (client) {
    client.write(`data: ${JSON.stringify(progressData)}\n\n`);
    if (progressData.status === "done" || progressData.status === "error") {
      client.end();
    }
  }
  res.status(200).send();
});

app.delete("/delete/:id", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;
    await axios.delete(`${API_URL}/home/${postId}?userId=${userId}`);
    req.flash("success", "Project deleted successfully!")
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Failed to delete project:", error); 
    req.flash("error", "Unable to delete the project. Please try again.");
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
