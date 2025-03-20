import express from "express";
import bodyParser from "body-parser";

const app = express();
const port = 3000;
let data = { //empty data set declear
    name : "",
    title : "",
    blog : "",
    date : "",
};
const storeData  = []; //to show all the blog post

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/home", (req, res) =>{
    res.json(storeData); 
});

app.post("/submit", (req, res) =>{
    data = { 
        id : Date.now() + Math.random(), //to have a unique identity of the blog
        date : new Date(),
        name : req.body["name"],
        title : req.body["title"],
        blog : req.body["blog"],
    }
    storeData.push(data); //push array
});

app.patch("/home/:id", (req, res) =>{
    const foundIndex = foundIndex.find(index => index.id === parseInt(req.params.id));
    if(foundIndex){                                                   
        foundIndex.name = name; 
        foundIndex.title = title;
        foundIndex.blog = blog;
         res.json(storeData)
    } else{
        res.status(404).send("Unable to update blog");
    }
    
});

app.delete("/home/:id", (req, res) =>{
    const foundId = storeData.findIndex(index => index.id === parseInt(req.params.id));
    if(foundId != -1){
        storeData.splice(foundId, 1); //splice is just remove it the second value is to ensure to remove only one data
        res.redirect("/home")
    } else{
        res.status(404).send("Unable to remove the blog");
    }
});

