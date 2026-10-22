// Mobile menu toggle. Everything else on the site works without JavaScript.
const button = document.querySelector(".menu-btn");
const nav = document.getElementById("site-nav");
if (button && nav) {
  button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("open")) {
      nav.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      button.focus();
    }
  });
}
