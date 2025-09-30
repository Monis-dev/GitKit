document.addEventListener("DOMContentLoaded", () => {
  const currentPath = window.location.pathname;

  const pathToMatch = currentPath === "/" ? "/home" : currentPath;

  const navLinks = document.querySelectorAll("#sidebar-nav-menu .nav-link");

  navLinks.forEach((link) => {
    link.classList.remove("active");

    if (link.getAttribute("href") === pathToMatch) {
      link.classList.add("active");
    }
  });
});


