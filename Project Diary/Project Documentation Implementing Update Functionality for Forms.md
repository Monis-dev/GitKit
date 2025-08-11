**Document Version:** 1.0  
**Date:** October 27, 2023  
**Author:** Monis

#### **1. Objective**

The goal was to implement "Update" (Edit) functionality for project posts within the application. This required handling form submissions from an "Edit" page in a way that could be distinguished from a "Create" submission, while reusing the same EJS form partial to adhere to the DRY (Don't Repeat Yourself) principle.

#### **2. The Core Challenge: HTML Form Method Limitation**

Standard HTML <form> elements only support GET and POST as values for the method attribute. Modern RESTful API design conventions, however, use more specific HTTP verbs for different actions:

- **POST**: To **create** a new resource.
    
- **PUT / PATCH**: To **update** an existing resource.
    
- **DELETE**: To **delete** a resource.
    

Directly submitting an "Update" form via a PATCH method from a standard HTML form is not possible. This created a conflict where our "Edit" form would send a POST request, but our backend architecture needed a way to route this to an update-specific handler, distinct from the create handler.

#### **3. Chosen Solution: The "Method Override" Strategy**

To resolve this limitation, we implemented the **Method Override** pattern. This strategy uses a middleware on the server to "override" the incoming POST request's method based on a special value passed in the request itself. This allows the client (browser) to send a standard POST request while enabling the server to interpret it as a PATCH request, thus aligning with RESTful principles.

**Key Components of this Solution:**

- An **EJS Form Partial** (project-form.ejs) that dynamically adjusts its submission URL.
    
- The **method-override NPM package** used as middleware in the Frontend Server (client.js).
    
- A distinct **PATCH route handler** in the Frontend Server (client.js) to process the update logic.
    

#### **4. Implementation Steps**

The implementation was carried out in three main parts: Frontend (EJS), Frontend Server (Express Middleware), and Backend API.

**4.1. EJS Form Partial (project-form.ejs) Configuration**

The primary form partial was made "smart" to handle both Create and Edit states by using EJS variables passed from the main view (modify.ejs).

1. **Dynamic Form action Attribute:** The <form> tag's action attribute was modified to be conditional.
    
    - **In Create Mode (isEditing is false):** The action resolves to the standard create endpoint (e.g., /api/home).
        
    - **In Edit Mode (isEditing is true):** The action resolves to the specific resource's URL and, crucially, appends the method-override query string: /api/home/:id?_method=PATCH.
        
    - **Implementation:**
        
        codeHtml
        
        downloadcontent_copyexpand_less
        
        ```
        <form action="<%= isEditing ? formAction + '?_method=PATCH' : formAction %>" method="POST" ...>
        ```
        

**4.2. Frontend Server (client.js) Configuration**

The Frontend Server was configured to intercept and interpret the method override instruction before routing the request.

1. **Dependency Installation:** The method-override package was added to the project.
    
    - **Command:** npm install method-override
        
2. **Middleware Integration:** The middleware was imported and applied in client.js. It was configured to look for the override instruction in a query parameter named _method.
    
    - **Implementation:**
        
        codeJavaScript
        
        downloadcontent_copyexpand_less
        
        ```
        import methodOverride from 'method-override';
        // ...
        app.use(methodOverride('_method'));
        ```
        
    - **Placement:** This middleware was placed after bodyParser to ensure the request body is parsed, but before the application's route handlers.
        
3. **Route Handler Creation:** A dedicated route handler was created to listen for PATCH requests.
    
    - **The Problem:** The original POST /api/home/:id route was ambiguous and incorrect for updates.
        
    - **The Solution:** A new route, app.patch('/api/home/:id', ...) was created. This handler is now the designated endpoint for all update requests that have been processed by method-override.
        
4. **File Upload Handling:** Since an "Edit" action might include uploading a new image, the multer middleware (upload.single('image')) was also added to the app.patch(...) route handler, ensuring file data is parsed correctly for updates, just as it is for creates.
    

**4.3. Backend API Server (server.js) Interaction**

The PATCH handler in the Frontend Server (client.js) forwards the update request to the Backend API.

1. **axios.patch Request:** The client.js route handler makes an axios.patch call to the Backend API's corresponding endpoint (e.g., http://localhost:4000/home/:id).
    
2. **Backend Route:** The Backend API (server.js) contains an app.patch('/home/:id', ...) route that receives this request, processes the data, and performs the UPDATE operation on the PostgreSQL database.
    

#### **5. Result and Workflow Summary**

This implementation successfully separates the Create and Update logic while maintaining a single, reusable form.

**The final workflow is as follows:**

1. User clicks "Update" on the "Edit" page form.
    
2. The browser sends a **POST** request to .../?_method=PATCH.
    
3. The method-override middleware on the Frontend Server detects _method=PATCH and internally transforms the request method to **PATCH**.
    
4. The request is now routed to the app.patch('/api/home/:id', ...) handler.
    
5. This handler uses axios.patch to send the final, clean update request to the Backend API.
    
6. The Backend API updates the database record.