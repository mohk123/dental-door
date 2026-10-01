const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navItems = document.querySelectorAll(".nav-links a");
const themeToggle = document.querySelector(".theme-toggle");
const sections = document.querySelectorAll("main section[id]");
const form = document.querySelector("#appointment-form");
const formNote = document.querySelector(".form-note");
const formSubmitButton = form?.querySelector('button[type="submit"]');
const backTopLink = document.querySelector(".footer-back-top");
const themeKey = "dental-door-theme";
const MAIL_API_URL = "/api/send-appointment";

const updateBackTopVisibility = () => {
  if (!backTopLink) return;
  backTopLink.classList.toggle("is-visible", window.scrollY > 180);
};

const applyTheme = (theme) => {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);

  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  }
};

const savedTheme = localStorage.getItem(themeKey);

if (savedTheme === "dark" || savedTheme === "light") {
  applyTheme(savedTheme);
}

themeToggle?.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";

  themeToggle.classList.remove("theme-toggle-animating");
  void themeToggle.offsetWidth;
  themeToggle.classList.add("theme-toggle-animating");

  applyTheme(nextTheme);
  localStorage.setItem(themeKey, nextTheme);
});

menuToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      navItems.forEach((item) => {
        item.classList.toggle("active", item.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);

sections.forEach((section) => observer.observe(section));

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const originalLabel = formSubmitButton?.textContent || "Send Request";
  if (formSubmitButton) {
    formSubmitButton.disabled = true;
    formSubmitButton.textContent = "Sending...";
  }
  formNote.textContent = "Sending your request...";

  try {
    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      service: form.elements.service.value,
      message: form.elements.message.value.trim(),
    };

    const response = await fetch(MAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({ success: false, message: "Invalid server response" }));
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Submission failed");
    }

    form.reset();
    formNote.textContent = "Thank you. Your request has been sent successfully.";
  } catch (error) {
    const serverMessage = error instanceof Error ? error.message : "Could not send request";
    formNote.textContent = `${serverMessage} Please call 8306787496 or email mohak1802bhal@gmail.com if needed.`;
  } finally {
    if (formSubmitButton) {
      formSubmitButton.disabled = false;
      formSubmitButton.textContent = originalLabel;
    }
  }
});

backTopLink?.addEventListener("click", (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", updateBackTopVisibility, { passive: true });
updateBackTopVisibility();
