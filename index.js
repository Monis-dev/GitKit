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

app.get("/", (req, res) => {
    res.render("login.ejs"); // Render the landing page
});

//display
app.get("/home", (req, res) =>{
    res.render("index.ejs", {storeData}); //sending empty storeData so that it matches the condition of if storeData exsist
});

//server side
//create blog page render 
app.get("/add", (req, res) =>{ 
    res.render("add.ejs")
});

//client side
//taking values
app.post("/submit", (req, res) =>{
    data = { 
        id : Date.now() + Math.random(), //to have a unique identity of the blog
        date : new Date(),
        name : req.body["name"],
        title : req.body["title"],
        blog : req.body["blog"],
    }
    storeData.push(data); //push array
    res.redirect("/home")
});

//server side
//render edit page
app.get("/edit", (req, res) => {
    const {id} = req.query;  //getting the selected id by req.query 
    const foundData = storeData.find(item => item.id === Number(id)); //finding the matching id from storeData also using Number(id) 
    if (foundData) {                                                  //is to convert the id in numerice form because we are checking the data type(===)
        res.render("edit.ejs", { data: foundData });  //data: foundData sending the entire data that matches the data in storeData
    } else {
        res.status(404).send("Blog not found");
    }
});

//patch and delete are done in client side but intiaited in server side
//client side
//display new blog
app.post("/submit-edit", (req, res) =>{
    const {id, name, title, blog} = req.body; //req.body is to send the data to the index page 
    const foundIndex = storeData.find(index => index.id === Number(id));//this foundIndex is the part that hold the values of the founded id in storeData
    if(foundIndex){                                                     //so when we change it, it makes the changes in the storeData array
        foundIndex.name = name; //assignening the new values 
        foundIndex.title = title;
        foundIndex.blog = blog;
        res.redirect("/home")
    } else{
        res.status(404).send("Unable to update blog");
    }
    
});
        
// delete the blog
app.post("/delete", (req, res) =>{
    const {id} = req.body;
    const foundId = storeData.findIndex(index => index.id === Number(id));
    if(foundId){
        storeData.splice(foundId, 1); //splice is just remove it the second value is to ensure to remove only one data
        res.redirect("/home")
    } else{
        res.status(404).send("Unable to remove the blog");
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
