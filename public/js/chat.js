class ChatApp {
  constructor() {
    this.chatStarted = false;
    this.currentQuestion = 0;
    this.projectData = {
      title: "",
      description: "",
      tech_used: "",
    };

    this.questions = [
      "What is your project title?",
      "Provide a small description of your project.",
      "What technologies and languages do you want to use?",
    ];

    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    this.chatMessages = document.getElementById("chatMessages");
    this.userInput = document.getElementById("userInput");
    this.sendBtn = document.getElementById("sendBtn");
    this.initialView = document.getElementById("initial-view");
  }

  bindEvents() {
    this.sendBtn.addEventListener("click", () => this.handleUserResponse());
    this.userInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleUserResponse();
      }
    });
    this.userInput.addEventListener("focus", () => this.startChat());

    // Event delegation for dynamic buttons
    this.chatMessages.addEventListener("click", (e) => {
      if (e.target && e.target.id === "saveProjectBtn") {
        e.preventDefault();
        this.sendDataToServer();
      }
    });

    // Mobile sidebar functionality
    this.initializeSidebarEvents();
  }

  initializeSidebarEvents() {
    const menuToggle = document.getElementById("menuToggle");
    const closeSidebar = document.getElementById("closeSidebar");
    const sidebar = document.getElementById("sidebar");
    const mobileOverlay = document.getElementById("mobileOverlay");

    const openSidebar = () => {
      if (sidebar) {
        sidebar.classList.add("show");
        if (mobileOverlay) mobileOverlay.classList.add("show");
        document.body.style.overflow = "hidden";
      }
    };

    const closeSidebarFunc = () => {
      if (sidebar) {
        sidebar.classList.remove("show");
        if (mobileOverlay) mobileOverlay.classList.remove("show");
        document.body.style.overflow = "auto";
      }
    };

    if (menuToggle) menuToggle.addEventListener("click", openSidebar);
    if (closeSidebar) closeSidebar.addEventListener("click", closeSidebarFunc);
    if (mobileOverlay)
      mobileOverlay.addEventListener("click", closeSidebarFunc);

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768) {
        closeSidebarFunc();
      }
    });
  }

  addMessage(sender, message, isBot = false) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "mb-3";

    const senderDiv = document.createElement("div");
    senderDiv.className = "fw-bold text-white";

    const contentDiv = document.createElement("div");
    contentDiv.className = "d-inline-block p-3 rounded mt-1";
    contentDiv.style.maxWidth = "80%";

    if (isBot) {
      senderDiv.innerHTML = '<i class="bi bi-robot"></i> GitKit';
      contentDiv.className += " text-white";
      contentDiv.style.backgroundColor = "#374151";
    } else {
      senderDiv.innerHTML = '<i class="bi bi-person-fill"></i> You';
      contentDiv.className += " bg-primary text-white ms-auto";
      contentDiv.style.marginLeft = "auto";
      messageDiv.className += " d-flex flex-column align-items-end";
    }

    contentDiv.innerHTML = message;
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(contentDiv);
    this.chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  handleUserResponse() {
    if (!this.chatStarted) return;
    const answer = this.userInput.value.trim();
    if (!answer) return;

    // Add user message to chat
    this.addMessage("You", answer, false);

    // Store the answer
    this.storeAnswer(answer);

    // Clear input
    this.userInput.value = "";

    // Move to next question or show summary
    setTimeout(() => {
      if (this.currentQuestion < 3) {
        this.askNextQuestion();
      } else {
        this.showProjectSummary();
      }
    }, 1000);
  }

  storeAnswer(answer) {
    const fieldMap = {
      1: "title",
      2: "description",
      3: "tech_used",
    };

    const field = fieldMap[this.currentQuestion];
    if (field) {
      this.projectData[field] = answer;
    }
  }

  askNextQuestion() {
    this.currentQuestion++;
    const questionText = `<strong>Question ${this.currentQuestion}:</strong> ${
      this.questions[this.currentQuestion - 1]
    }`;
    this.addMessage("GitKit", questionText, true);
  }

  showProjectSummary() {
    const summary = `
      <strong>Great! Here's your project summary:</strong><br><br>
      <strong>📝 Title:</strong> ${this.projectData.title}<br>
      <strong>📋 Description:</strong> ${this.projectData.description}<br>
      <strong>🛠️ Technologies:</strong> ${this.projectData.tech_used}<br>
      <strong>🛠️ Pack:</strong> ${this.projectData.pack}<br><br>
      Ready to start building your project!
      <button class="btn btn-primary mt-2" type="submit" id="saveProjectBtn">Save</button>
    `;
    this.addMessage("GitKit", summary, true);

    // Disable input after completion
    this.userInput.placeholder = "Project setup complete!";
    this.userInput.disabled = true;
    this.sendBtn.disabled = true;
  }

  startChat() {
    if (this.chatStarted) return;

    this.chatStarted = true;
    this.currentQuestion = 1;
    this.userInput.placeholder = "Type your answer here...";

    this.initialView.classList.add("fade-out");
    this.initialView.addEventListener(
      "transitionend",
      () => {
        this.initialView.remove();
        this.chatMessages.classList.remove("initial-state");
        setTimeout(() => {
          this.addMessage(
            "GitKit",
            `<strong>Question 1:</strong> ${this.questions[0]}`,
            true
          );
        }, 500);
      },
      { once: true }
    );
  }

  async sendDataToServer() {
    const saveBtn = document.getElementById("saveProjectBtn");
    if (!saveBtn) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = "Saving...";

    try {
      // The URL and data are correct.
      const response = await fetch("/api/home", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.projectData),
      });

      // THIS IS THE CRITICAL CHANGE: Check 'response.ok' instead of 'data.success'
      if (response.ok) {
        saveBtn.innerHTML = "Success!";
        saveBtn.classList.remove("btn-primary");
        saveBtn.classList.add("btn-success");

        // Hardcode the redirect to the dashboard after a short delay
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1000); // 1-second delay
      } else {
        // This will now properly catch server-side errors
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error saving project:", error);
      saveBtn.innerHTML = "Error! Try Again";
      saveBtn.disabled = false;
      saveBtn.classList.remove("btn-primary");
      saveBtn.classList.add("btn-danger");

      this.addMessage(
        "GitKit",
        `<strong>⚠️ Error:</strong> Failed to save project. Please try again.`,
        true
      );
    }
  }
}

// Initialize the chat application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
