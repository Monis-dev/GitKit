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

let isAuthenticated = false;
const Userauthentication = {
    username : "Monis",
    password : "123",
}

const storeData  = []; //to show all the blog post

function checkAuthentication(req, res, next) {
    if (isAuthenticated) {
        next(); // User is authenticated, proceed to the next route
    } else {
        res.redirect('/'); // User is not authenticated, redirect to login page
    }
}

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));


app.get("/", (req, res) => {
    res.render("login.ejs"); // Render the landing page
});

app.post("/home", checkAuthentication, (req, res)=>{
    const getData = {
        username : req.body["username"],
        password : req.body["password"],
    }
    if( Userauthentication.username === getData.username &&
        Userauthentication.password === getData.password){
            isAuthenticated = true
            res.render("index.ejs", {storeData, isAuthenticated}); //sending empty storeData so that it matches the condition of if storeData exsist
            
    } else{
        res.status(401).json({ alert: "Incorrect Password or Username" });
        isAuthenticated = false;
        res.redirect("/");
    }
    
})

app.get("/home", checkAuthentication, (req, res)=>{
    res.render("index.ejs", {storeData, isAuthenticated})
})

//create blog page render 
app.get("/add", (req, res) =>{ 
    res.render("add.ejs")
});

//taking values
app.post("/submit", checkAuthentication, (req, res) =>{
    data = { 
        id : Date.now() + Math.random(), //to have a unique identity of the blog
        date : new Date(),
        name : req.body["name"],
        title : req.body["title"],
        blog : req.body["blog"],
    };
    storeData.push(data); //push array
    res.render("index.ejs", {storeData, isAuthenticated});
});

//render edit page
app.get("/edit", checkAuthentication, (req, res) => {
    const {id} = req.query;  //getting the selected id by req.query 
    const foundData = storeData.find(item => item.id === Number(id)); //finding the matching id from storeData also using Number(id) 
    if (foundData) {                                                  //is to convert the id in numerice form because we are checking the data type(===)
        res.render("edit.ejs", { data: foundData, isAuthenticated});  //data: foundData sending the entire data that matches the data in storeData
    } else {
        res.status(404).send("Blog not found");
    }
});
//display new blog
app.post("/submit-edit", checkAuthentication, (req, res) =>{
    const {id, name, title, blog} = req.body; //req.body is to send the data to the index page 
    const foundIndex = storeData.find(index => index.id === Number(id));//this foundIndex is the part that hold the values of the founded id in storeData
    if(foundIndex){                                                     //so when we change it, it makes the changes in the storeData array
        foundIndex.name = name; //assignening the new values 
        foundIndex.title = title;
        foundIndex.blog = blog;
        res.render("index.ejs", {storeData, isAuthenticated});
    } else{
        res.status(404).send("Unable to update blog");
    }
    
});
// delete the blog
app.post("/delete", checkAuthentication, (req, res) =>{
    const {id} = req.body;
    const foundId = storeData.findIndex(index => index.id === Number(id));
    if(foundId){
        storeData.splice(foundId, 1); //splice is just remove it the second value is to ensure to remove only one data
        res.render("index.ejs", {storeData, isAuthenticated});   
    } else{
        res.status(404).send("Unable to remove the blog");
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });