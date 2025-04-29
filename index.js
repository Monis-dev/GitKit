import express from "express";
import bodyParser from "body-parser";

const app = express();
const port = 4000;
let data = { //empty data set declear
    id: "",
    name : "",
    title : "",
    blog : "",
    date : "",
};
const storeData  = []; //to show all the blog post

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.get("/home", (req, res) =>{
    res.json(storeData); 
});


app.get("/home/:id", (req, res) =>{
    const Foundpost = storeData.find( post => post.id === Number(req.params.id));
    if(!Foundpost){
      res.status(404).json({
        error: 'Id not found'
      })
    } res.json(Foundpost);
});

app.post("/add", (req, res) =>{
    data = { 
        id : Date.now() + Math.random(), //to have a unique identity of the blog
        date : new Date(),
        name : req.body.name,
        title : req.body.title,
        blog : req.body.blog,
    }
    storeData.push(data); //push array
    res.status(202).json(data);
});

app.patch("/home/:id", (req, res) =>{
    const post = storeData.find(index => index.id === Number(req.params.id));
    console.log(post);
    if(!post){return res.status(404).json({ message: "Error loading home page" });}

    if(req.body.name) post.name = req.body.name;
    if(req.body.blog) post.blog = req.body.blog;
    if(req.body.title) post.title = req.body.title;
    
    res.json(post);
});

app.delete("/home/:id", (req, res) =>{
    const foundId = storeData.find(index => index.id === Number(req.params.id));
    if(foundId != -1){
        storeData.splice(foundId, 1); //splice is just remove it the second value is to ensure to remove only one data
        res.json("Post deleted");
    } else{
        res.status(404).send("Unable to remove the blog");
    }
});

app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
  });