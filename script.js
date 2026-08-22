/* ===========================================================
   STEP & SWING DANCE CLUB — script.js
   Shared logic for index.html (registration) and president.html
   (login-gated dashboard + Excel export + auto-logout).

   Storage: all registrations are kept in the browser's
   localStorage under STORAGE_KEY, as a JSON array. Both pages
   read/write the same key, so anything a student submits on
   index.html immediately shows up in the president dashboard.

   Credentials for the President Portal are defined once below.
   Change PRESIDENT_USERNAME / PRESIDENT_PASSWORD to update login.
   =========================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "stepSwing_registrations";
  const SESSION_KEY = "stepSwing_presidentSession";

  const PRESIDENT_USERNAME = "Vatan Preet Singh";
  const PRESIDENT_PASSWORD = "Vat@123456";

  /* ---------------------------------------------------------
     Storage helpers
     --------------------------------------------------------- */
  function getRegistrations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Could not read registrations:", e);
      return [];
    }
  }

  function saveRegistration(entry) {
    const all = getRegistrations();
    all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return all;
  }

  /* ---------------------------------------------------------
     Toast helper (used on both pages)
     --------------------------------------------------------- */
  function showToast(message, isError) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("err", !!isError);
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  /* ---------------------------------------------------------
     Scroll-reveal animation & Scroll Controls (Progress & Back To Top)
     --------------------------------------------------------- */
  function initScrollReveal() {
    const targets = document.querySelectorAll(".reveal, .reveal-up, .reveal-down, .reveal-left, .reveal-right, .reveal-zoom");
    
    if (targets.length) {
      if (!("IntersectionObserver" in window)) {
        targets.forEach((el) => el.classList.add("in"));
      } else {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("in");
              }
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
        );

        targets.forEach((el) => observer.observe(el));
      }
    }

    // Scroll progress bar
    const progressEl = document.getElementById("scrollProgress");
    const backToTopBtn = document.getElementById("backToTop");

    window.addEventListener("scroll", function () {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      
      if (progressEl && docHeight > 0) {
        const scrolled = (scrollTop / docHeight) * 100;
        progressEl.style.width = scrolled + "%";
      }

      if (backToTopBtn) {
        if (scrollTop > 300) {
          backToTopBtn.classList.add("show");
        } else {
          backToTopBtn.classList.remove("show");
        }
      }
    });

    if (backToTopBtn) {
      backToTopBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  /* ---------------------------------------------------------
     Registration form (index.html)
     --------------------------------------------------------- */
  function initRegistrationForm() {
    const form = document.getElementById("regForm");
    if (!form) return;

    const fields = ["name", "rollNo", "department", "course", "year", "semester", "phone", "dance"];

    function setError(fieldName, hasError) {
      const wrap = form.querySelector(`[data-field="${fieldName}"]`);
      if (wrap) wrap.classList.toggle("error", hasError);
    }

    function validate() {
      let valid = true;
      const values = {};

      fields.forEach((name) => {
        const el = form.elements[name];
        const value = (el.value || "").trim();
        values[name] = value;

        let fieldValid = value.length > 0;

        if (name === "phone") {
          fieldValid = /^[0-9]{10}$/.test(value.replace(/\s+/g, ""));
        }
        if (name === "dance") {
          fieldValid = value.length >= 3;
        }

        setError(name, !fieldValid);
        if (!fieldValid) valid = false;
      });

      return { valid, values };
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const { valid, values } = validate();

      if (!valid) {
        showToast("Please check the highlighted fields.", true);
        return;
      }

      const entry = {
        name: values.name,
        rollNo: values.rollNo,
        department: values.department,
        course: values.course,
        year: values.year,
        semester: values.semester,
        phone: values.phone,
        dance: values.dance,
        submittedAt: new Date().toISOString(),
      };

      saveRegistration(entry);
      form.reset();
      showToast("You're in! Registration saved successfully.");
    });

    // Clear error styling as the student corrects a field
    fields.forEach((name) => {
      const el = form.elements[name];
      if (el) {
        el.addEventListener("input", () => setError(name, false));
      }
    });
  }

  /* ---------------------------------------------------------
     President Portal — login, dashboard, export, auto-logout
     --------------------------------------------------------- */
  function initPresidentPortal() {
    const loginShell = document.getElementById("loginShell");
    const dashboard = document.getElementById("dashboard");
    const loginForm = document.getElementById("loginForm");
    if (!loginShell || !dashboard || !loginForm) return; // not on this page

    const loginError = document.getElementById("loginError");
    const logoutBtn = document.getElementById("logoutBtn");
    const downloadBtn = document.getElementById("downloadBtn");

    function isLoggedIn() {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    }

    function showDashboard() {
      loginShell.style.display = "none";
      dashboard.classList.add("show");
      renderDashboard();
    }

    function showLogin() {
      dashboard.classList.remove("show");
      loginShell.style.display = "flex";
      loginForm.reset();
      loginError.classList.remove("show");
    }

    function logOut(silent) {
      sessionStorage.removeItem(SESSION_KEY);
      showLogin();
      if (!silent) showToast("Logged out.");
    }

    // ---- Login handling ----
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const username = loginForm.elements["username"].value.trim();
      const password = loginForm.elements["password"].value;

      if (username.toLowerCase() === PRESIDENT_USERNAME.toLowerCase() && password === PRESIDENT_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, "true");
        loginError.classList.remove("show");
        showDashboard();
      } else {
        loginError.classList.add("show");
      }
    });

    logoutBtn.addEventListener("click", () => logOut(false));

    // ---- Render dashboard table + stats ----
    function renderDashboard() {
      const data = getRegistrations();
      const tbody = document.getElementById("regBody");
      const emptyState = document.getElementById("emptyState");
      const table = document.getElementById("regTable");

      tbody.innerHTML = "";

      if (!data.length) {
        table.style.display = "none";
        emptyState.style.display = "block";
      } else {
        table.style.display = "table";
        emptyState.style.display = "none";

        data.forEach((r, i) => {
          const tr = document.createElement("tr");
          const submitted = r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—";
          tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.rollNo)}</td>
            <td>${escapeHtml(r.department)}</td>
            <td>${escapeHtml(r.course)}</td>
            <td>${escapeHtml(r.year)}</td>
            <td>${escapeHtml(r.semester)}</td>
            <td>${escapeHtml(r.phone)}</td>
            <td>${escapeHtml(r.dance)}</td>
            <td class="mono">${submitted}</td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Stats
      const depts = new Set(data.map((r) => (r.department || "").trim().toLowerCase()).filter(Boolean));
      const courses = new Set(data.map((r) => (r.course || "").trim().toLowerCase()).filter(Boolean));
      const todayStr = new Date().toDateString();
      const today = data.filter((r) => r.submittedAt && new Date(r.submittedAt).toDateString() === todayStr).length;

      document.getElementById("statTotal").textContent = data.length;
      document.getElementById("statDept").textContent = depts.size;
      document.getElementById("statCourse").textContent = courses.size;
      document.getElementById("statToday").textContent = today;
    }

    function escapeHtml(str) {
      return String(str || "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[c]));
    }

    // ---- Excel export (SheetJS) ----
    downloadBtn.addEventListener("click", function () {
      const data = getRegistrations();

      if (!data.length) {
        showToast("No registrations to export yet.", true);
        return;
      }

      if (typeof XLSX === "undefined") {
        showToast("Excel library failed to load. Check your connection.", true);
        return;
      }

      const rows = data.map((r, i) => ({
        "S.No": i + 1,
        "Full Name": r.name,
        "Roll No": r.rollNo,
        "Department": r.department,
        "Course": r.course,
        "Year": r.year,
        "Semester": r.semester,
        "Phone No": r.phone,
        "Dance Styles": r.dance,
        "Submitted On": r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Professional formatting: sensible column widths
      worksheet["!cols"] = [
        { wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
        { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 20 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `StepAndSwing_Registrations_${dateStamp}.xlsx`);
      showToast("Excel sheet downloaded.");
    });

    // ---- Initial state on load ----
    if (isLoggedIn()) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initScrollReveal();
    initRegistrationForm();
    initPresidentPortal();
  });
})();
