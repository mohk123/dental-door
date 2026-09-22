const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector("#admin-login-form");
const loginNote = document.querySelector("#login-note");
const adminNote = document.querySelector("#admin-note");
const logoutButton = document.querySelector(".admin-logout");
const themeToggle = document.querySelector(".theme-toggle");
const refreshButton = document.querySelector("#refresh-appointments");
const filtersForm = document.querySelector("#admin-filters");
const appointmentsList = document.querySelector("#appointments-list");
const statTotal = document.querySelector("#stat-total");
const statNew = document.querySelector("#stat-new");
const statBooked = document.querySelector("#stat-booked");
const tokenKey = "dental-door-admin-token";
const themeKey = "dental-door-theme";
const statuses = ["new", "contacted", "booked", "closed"];

const getToken = () => localStorage.getItem(tokenKey) || "";

const setSignedIn = (isSignedIn) => {
  loginPanel.hidden = isSignedIn;
  dashboard.hidden = !isSignedIn;
  logoutButton.hidden = !isSignedIn;
};

const applyTheme = (theme) => {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);

  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  }
};

const formatDate = (value) => {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const statusLabel = (status) => status.charAt(0).toUpperCase() + status.slice(1);
const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({ success: false, message: "Invalid server response" }));

  if (response.status === 401) {
    localStorage.removeItem(tokenKey);
    setSignedIn(false);
  }

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Request failed");
  }

  return result;
};

const renderStats = (appointments) => {
  statTotal.textContent = appointments.length;
  statNew.textContent = appointments.filter((appointment) => appointment.status === "new").length;
  statBooked.textContent = appointments.filter((appointment) => appointment.status === "booked").length;
};

const renderAppointments = (appointments) => {
  renderStats(appointments);

  if (!appointments.length) {
    appointmentsList.innerHTML = '<div class="empty-state">No appointment requests found.</div>';
    return;
  }

  appointmentsList.innerHTML = appointments
    .map(
      (appointment) => `
        <article class="appointment-card" data-id="${escapeHtml(appointment.id)}">
          <div class="appointment-main">
            <div>
              <div class="appointment-name-row">
                <h2>${escapeHtml(appointment.name)}</h2>
                <span class="status-pill status-${escapeHtml(appointment.status)}">${statusLabel(appointment.status || "new")}</span>
              </div>
              <p>${escapeHtml(appointment.service || "Service not selected")}</p>
            </div>
            <time datetime="${escapeHtml(appointment.created_at || "")}">${formatDate(appointment.created_at)}</time>
          </div>

          <div class="appointment-details">
            <a href="mailto:${escapeHtml(appointment.email)}">${escapeHtml(appointment.email)}</a>
            <a href="tel:${escapeHtml(appointment.phone)}">${escapeHtml(appointment.phone)}</a>
            <span>Email: ${escapeHtml(appointment.email_status || "pending")}</span>
          </div>

          ${appointment.message ? `<p class="appointment-message">${escapeHtml(appointment.message)}</p>` : ""}

          <form class="appointment-actions">
            <label>
              Status
              <select name="status">
                ${statuses
                  .map(
                    (status) =>
                      `<option value="${status}" ${status === appointment.status ? "selected" : ""}>${statusLabel(status)}</option>`
                  )
                  .join("")}
              </select>
            </label>
            <label>
              Notes
              <input name="admin_notes" value="${escapeHtml(appointment.admin_notes || "")}" placeholder="Follow-up notes" />
            </label>
            <button class="button button-primary" type="submit">Update</button>
          </form>
        </article>
      `
    )
    .join("");
};

const loadAppointments = async () => {
  adminNote.textContent = "Loading appointments...";
  const formData = new FormData(filtersForm);
  const params = new URLSearchParams();
  const search = String(formData.get("search") || "").trim();
  const status = String(formData.get("status") || "").trim();

  if (search) params.set("search", search);
  if (status) params.set("status", status);

  try {
    const result = await apiRequest(`/api/admin/appointments?${params.toString()}`);
    renderAppointments(result.appointments || []);
    adminNote.textContent = "Appointments loaded.";
  } catch (error) {
    adminNote.textContent = error.message || "Could not load appointments.";
  }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginNote.textContent = "Signing in...";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: loginForm.elements.password.value }),
    });
    const result = await response.json().catch(() => ({ success: false, message: "Invalid server response" }));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Login failed");
    }

    localStorage.setItem(tokenKey, result.token);
    loginForm.reset();
    loginNote.textContent = "";
    setSignedIn(true);
    await loadAppointments();
  } catch (error) {
    loginNote.textContent = error.message || "Login failed.";
  }
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem(tokenKey);
  setSignedIn(false);
});

themeToggle?.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";

  themeToggle.classList.remove("theme-toggle-animating");
  void themeToggle.offsetWidth;
  themeToggle.classList.add("theme-toggle-animating");

  applyTheme(nextTheme);
  localStorage.setItem(themeKey, nextTheme);
});

refreshButton.addEventListener("click", loadAppointments);
filtersForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadAppointments();
});

appointmentsList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".appointment-actions");
  if (!form) return;

  event.preventDefault();
  const card = form.closest(".appointment-card");
  const formData = new FormData(form);
  adminNote.textContent = "Updating appointment...";

  try {
    await apiRequest(`/api/admin/appointments/${card.dataset.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: formData.get("status"),
        admin_notes: formData.get("admin_notes"),
      }),
    });
    adminNote.textContent = "Appointment updated.";
    await loadAppointments();
  } catch (error) {
    adminNote.textContent = error.message || "Could not update appointment.";
  }
});

localStorage.removeItem(tokenKey);
const savedTheme = localStorage.getItem(themeKey);
if (savedTheme === "dark" || savedTheme === "light") {
  applyTheme(savedTheme);
}
setSignedIn(false);
