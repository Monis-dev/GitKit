// FINAL AND COMPLETE /public/js/dashboard.js

document.addEventListener("DOMContentLoaded", () => {
  // --- Part 1: Mobile Sidebar Logic ---
  const menuToggle = document.getElementById("menuToggle");
  const closeSidebar = document.getElementById("closeSidebar");
  const sidebar = document.getElementById("sidebar");
  let mobileOverlay = document.getElementById("mobileOverlay");

  if (!mobileOverlay) {
    mobileOverlay = document.createElement("div");
    mobileOverlay.id = "mobileOverlay";
    mobileOverlay.className = "mobile-overlay";
    document.body.appendChild(mobileOverlay);
  }

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
  if (mobileOverlay) mobileOverlay.addEventListener("click", closeSidebarFunc);
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 768) closeSidebarFunc();
  });

  // --- Part 2: Modal and Deployment Logic ---
  const deployChoiceModalEl = document.getElementById("deployModal");
  const progressModalEl = document.getElementById("progressModal"); // Assumes your progress modal has this ID
  const deployForm = document.getElementById("deployForm");

  // Check if all required elements exist before proceeding
  if (!deployChoiceModalEl || !progressModalEl || !deployForm) {
    console.error("One or more modal elements are missing from the DOM.");
    return; // Stop execution if modals aren't found
  }

  // Create Bootstrap Modal instances to control them via JavaScript
  const choiceModal = new bootstrap.Modal(deployChoiceModalEl);
  const progressModal = new bootstrap.Modal(progressModalEl);

  let currentPostId = null;

  // 1. Prepare the Choice Modal when a "Commit" button is clicked
  deployChoiceModalEl.addEventListener("show.bs.modal", (event) => {
    const button = event.relatedTarget;
    currentPostId = button.getAttribute("data-post-id");
    const postTitle = button.getAttribute("data-post-title");

    const modalTitle = deployChoiceModalEl.querySelector("#modalProjectTitle");
    modalTitle.textContent = postTitle;

    // IMPORTANT: Clear the progress modal from any previous run
    resetProgressModal();
  });

  // 2. Handle the submission of the Choice Form
  deployForm.addEventListener("submit", (event) => {
    event.preventDefault(); // This is critical to stop the page from navigating

    const formData = new FormData(deployForm);
    const packType = formData.get("packType");

    // Hide the choice modal and immediately show the progress modal
    choiceModal.hide();
    progressModal.show();

    // 3. Initiate the deployment process in the background
    startDeployment(currentPostId, packType);
  });

  // 4. Function to start the fetch and connect to the event stream
  function startDeployment(postId, packType) {
    fetch(`/github/commit/${postId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ packType: packType }),
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`Server returned an error: ${response.statusText}`);
        return response.json();
      })
      .then((data) => {
        if (!data.jobId)
          throw new Error("Did not receive a valid Job ID from the server.");
        // 5. Success! Now connect to the progress stream
        connectToProgressStream(data.jobId);
      })
      .catch((error) => {
        console.error("Error starting deployment:", error);
        updateFinalStatus(
          "error",
          `Failed to start the process. Please check the console.`
        );
      });
  }

  // 6. Function to listen for Server-Sent Events (SSE)
  function connectToProgressStream(jobId) {
    const eventSource = new EventSource(`/github/commit/progress/${jobId}`);

    eventSource.onmessage = (event) => {
      const progressData = JSON.parse(event.data);

      // Update the multi-step UI based on the `step` from the server
      updateProgressStep(progressData.step, "success");

      if (progressData.status === "done") {
        updateFinalStatus("success", progressData.message);
        eventSource.close();
        // Reload the page after 3 seconds to show success
        setTimeout(() => window.location.reload(), 3000);
      } else if (progressData.status === "error") {
        updateFinalStatus("error", progressData.message);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      updateFinalStatus(
        "error",
        "Connection to progress stream failed. The server might be down."
      );
      eventSource.close();
    };
  }

  // --- UI Helper Functions ---

  function updateProgressStep(stepNameFromServer, status) {
    if (!stepNameFromServer) return; // Ignore messages without a 'step'
    // Use the step name directly, e.g., 'start', 'ai'
    const stepElement = document.getElementById(`step-${stepNameFromServer}`);
    if (stepElement) {
      stepElement.classList.add(status); // 'success' or 'error'
    }
  }

  function updateFinalStatus(status, message) {
    const finalStatusEl = document.getElementById("final-status");
    if (finalStatusEl) {
      const statusClass = status === "success" ? "text-success" : "text-danger";
      finalStatusEl.innerHTML = `<h5 class="${statusClass} mt-3">${message}</h5>`;

      if (status === "error") {
        finalStatusEl.innerHTML += `<button class="btn btn-secondary mt-2" data-bs-dismiss="modal">Close</button>`;
      }
    }
  }

  function resetProgressModal() {
    const progressSteps =
      progressModalEl.querySelectorAll(".progress-steps li");
    progressSteps.forEach((li) => {
      li.className = ""; // Remove 'success' or 'error' classes
    });

    const finalStatusEl = document.getElementById("final-status");
    if (finalStatusEl) {
      finalStatusEl.innerHTML = "";
    }
  }
});
