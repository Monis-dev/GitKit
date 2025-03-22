import express from "express";
import bodyParser from "body-parser";
import axios from "axios"


const app = express();
const port = 3000;
const API_URL = "http://localhost:4000";

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", async(req, res) =>{
    try {
        const response = await axios.get(`${API_URL}/home`)
        console.log(response.data)
        res.render("index.ejs", {storeData: response})
    } catch (error) {
        res.status(500).json({ message: "Error fetching posts" });
    }
})

app.get("/add", (req, res) =>{
    res.render("add.ejs")
})

app.post("/api/home", async(req, res) =>{
    try {
        const response = await axios.post(`${API_URL}/add`, req.body)
        res.redirect("/");
    } catch (error) {
        res.status(404).json({ message: "Error loading home page" });
    }
})


app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
  });