document.addEventListener("DOMContentLoaded", () => {
  // ===== Grab elements =====
  const addBtn = document.getElementById("addExpenseBtn");
  const submittedTable = document.getElementById("submittedExpenses");

  // Ensure a <tbody> exists (prevents null errors on render)
  let submittedTableBody = submittedTable.querySelector("tbody");
  if (!submittedTableBody) {
    submittedTableBody = document.createElement("tbody");
    submittedTable.appendChild(submittedTableBody);
  }

  const totalsDiv = document.getElementById("categoryTotals");
  const clearAllBtn = document.getElementById("clearAllBtn");

  const setAllowanceBtn = document.getElementById("setAllowanceBtn");
  const allowanceContainer = document.getElementById("allowanceContainer");
  const allowanceDisplay = document.getElementById("allowanceDisplay");
  const allowanceRemainingDiv = document.getElementById("allowanceRemaining");

  // Month controls
  const prevBtn = document.getElementById("prevMonthBtn");
  const nextBtn = document.getElementById("nextMonthBtn");
  const monthSelect = document.getElementById("monthSelect");
  const yearSelect = document.getElementById("yearSelect");
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  // ===== Chart.js setup =====
  const ctx = document.getElementById("categoryChart").getContext("2d");
  const categoryChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Groceries", "Social", "Treat", "Unexpected"],
      datasets: [{
        label: "Category Breakdown",
        data: [0, 0, 0, 0],
        backgroundColor: ["#36A2EB", "#FF6384", "#FFCE56", "#4BC0C0"]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });

  // ===== Storage & state =====
  const STATE_KEY = "savr-monthly-state-v1";
  const SETTINGS_KEY = "savr-settings-v1"; // holds global allowance

  let monthlyState = loadJSON(STATE_KEY) || {};
  let settings = loadJSON(SETTINGS_KEY) || { allowance: 0 };

  function saveState() { saveJSON(STATE_KEY, monthlyState); }
  function saveSettings() { saveJSON(SETTINGS_KEY, settings); }

  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  }
  function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // Light migration cleanup (remove any old per-month allowance fields)
  Object.keys(monthlyState).forEach(k => {
    if (monthlyState[k] && typeof monthlyState[k].allowance !== "undefined") {
      delete monthlyState[k].allowance;
    }
  });

  function yyyymmKey(y, mIndex) {
    return `${y}-${String(mIndex + 1).padStart(2, "0")}`;
  }

  let currentYear, currentMonthIndex;

  function ensureMonth(key) {
    if (!monthlyState[key]) {
      monthlyState[key] = {
        expenses: [],
        categoryTotals: { Groceries: 0, Social: 0, Treat: 0, Unexpected: 0 },
        purchaseCount: 0
      };
    }
    return monthlyState[key];
  }
  function currentKey() {
    return yyyymmKey(currentYear, currentMonthIndex);
  }
  function getMonthData() {
    return ensureMonth(currentKey());
  }
  function findExpenseById(id) {
    return getMonthData().expenses.find(e => e.id === id);
  }

  // ===== Init month pickers =====
  (function initMonthYearPickers() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonthIndex = now.getMonth();

    if (monthSelect) {
      monthNames.forEach((name, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = name;
        monthSelect.appendChild(opt);
      });
      monthSelect.value = currentMonthIndex;
      monthSelect.addEventListener("change", () => {
        currentMonthIndex = Number(monthSelect.value);
        renderForCurrentMonth();
      });
    }

    if (yearSelect) {
      const startYear = currentYear - 3;
      const endYear   = currentYear + 3;
      for (let y = startYear; y <= endYear; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      }
      yearSelect.value = currentYear;
      yearSelect.addEventListener("change", () => {
        currentYear = Number(yearSelect.value);
        renderForCurrentMonth();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        currentMonthIndex--;
        if (currentMonthIndex < 0) {
          currentMonthIndex = 11;
          currentYear--;
          if (yearSelect) yearSelect.value = currentYear;
        }
        if (monthSelect) monthSelect.value = currentMonthIndex;
        renderForCurrentMonth();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        currentMonthIndex++;
        if (currentMonthIndex > 11) {
          currentMonthIndex = 0;
          currentYear++;
          if (yearSelect) yearSelect.value = currentYear;
        }
        if (monthSelect) monthSelect.value = currentMonthIndex;
        renderForCurrentMonth();
      });
    }
  })();

  // ===== Ensure table header has an Actions column =====
  (function ensureActionsHeader() {
    const theadRow = submittedTable.querySelector("thead tr");
    if (!theadRow) return;
    const ths = Array.from(theadRow.children);
    const hasActions = ths.some(th => th.textContent.trim().toLowerCase() === "actions");
    if (!hasActions) {
      const th = document.createElement("th");
      th.textContent = "Actions";
      theadRow.appendChild(th);
    }
  })();

  // ===== Render helpers =====
  function updateAllowanceRemaining() {
    const data = getMonthData();
    const totalSpent = Object.values(data.categoryTotals).reduce((sum, val) => sum + val, 0);
    const remaining = (settings.allowance || 0) - totalSpent;
    allowanceRemainingDiv.textContent = `Allowance Remaining: ${remaining.toFixed(2)}`;
  }

  function updatePieChart() {
    const data = getMonthData();
    categoryChart.data.datasets[0].data = [
      data.categoryTotals.Groceries,
      data.categoryTotals.Social,
      data.categoryTotals.Treat,
      data.categoryTotals.Unexpected
    ];
    categoryChart.update();
  }

  // --- Right-side delete rail (match HTML/CSS: #deleteRail + .delete-mini)
  const tableWrap = document.querySelector(".table-wrap") || document.body;
  const deleteRail = document.getElementById("deleteRail");

  function renderForCurrentMonth() {
    const data = getMonthData();
    const globalAllowance = Number(settings.allowance) || 0;
    allowanceDisplay.textContent = `Allowance: ${globalAllowance.toFixed(2)}`;

    // Rebuild table rows
    submittedTableBody.innerHTML = "";
    data.expenses.forEach((e, idx) => {
      const row = document.createElement("tr");
      row.setAttribute("data-row-id", e.id);
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td>${e.amount.toFixed(2)}</td>
        <td>${e.category}</td>
        <td>${e.card || "-"}</td>
        <td>
          <button class="show-details" data-id="${e.id}">details</button>
        </td>
      `;
      submittedTableBody.appendChild(row);
    });

    // Totals
    totalsDiv.innerHTML = `
      Groceries: ${data.categoryTotals.Groceries.toFixed(2)}<br>
      Social: ${data.categoryTotals.Social.toFixed(2)}<br>
      Treat: ${data.categoryTotals.Treat.toFixed(2)}<br>
      Unexpected: ${data.categoryTotals.Unexpected.toFixed(2)}
    `;

    updateAllowanceRemaining();
    updatePieChart();

    // Rebuild and position right-hand delete dots
    queueMicrotask(positionDeleteDots);
  }

  function positionDeleteDots() {
    if (!deleteRail) return;
    deleteRail.innerHTML = "";

    const containerRect = tableWrap.getBoundingClientRect();
    const rows = Array.from(submittedTableBody.querySelectorAll("tr"));

    rows.forEach((tr) => {
      const id = Number(tr.getAttribute("data-row-id"));
      const r = tr.getBoundingClientRect();
      const topInContainer = r.top - containerRect.top;

      const dot = document.createElement("span");
      dot.className = "delete-mini";
      dot.textContent = "d";
      dot.dataset.id = String(id);
      dot.style.top = `${topInContainer + (r.height / 2) - 8}px`;

      deleteRail.appendChild(dot);
    });
  }

  // Reposition dots on resize
  window.addEventListener("resize", positionDeleteDots);

  // ===== Row actions: Details (in-table) & Delete (rail) =====
  submittedTableBody.addEventListener("click", (evt) => {
    const detailsBtn = evt.target.closest(".show-details");
    if (!detailsBtn) return;

    const id = Number(detailsBtn.dataset.id);
    const exp = findExpenseById(id);
    const text = (exp && exp.details && exp.details.trim()) ? exp.details.trim() : "No details.";
    openDetailsModal(text);
  });

  deleteRail?.addEventListener("click", (evt) => {
    const el = evt.target.closest(".delete-mini");
    if (!el) return;
    const id = Number(el.dataset.id);

    const data = getMonthData();
    const i = data.expenses.findIndex(x => x.id === id);
    if (i === -1) return;

    const exp = data.expenses[i];
    data.categoryTotals[exp.category] = Math.max(
      0,
      (data.categoryTotals[exp.category] || 0) - (exp.amount || 0)
    );
    data.expenses.splice(i, 1);

    saveState();
    renderForCurrentMonth();
  });

  // ===== Clear All =====
  clearAllBtn?.addEventListener("click", () => {
    if (!confirm("Are you sure you want to delete all expenses for this month?")) return;

    const data = getMonthData();
    data.expenses = [];
    data.categoryTotals = { Groceries: 0, Social: 0, Treat: 0, Unexpected: 0 };
    data.purchaseCount = 0;

    saveState();
    renderForCurrentMonth();
  });

  // ===== Add Expense modal (use existing HTML modal) =====
  const modalOverlay = document.getElementById("expenseModalOverlay");
  const modalAmount  = () => document.getElementById("modalExpenseAmount");
  const modalCat     = () => document.getElementById("modalExpenseCategory");
  const modalCard    = () => document.getElementById("modalExpenseCard");
  const modalDetails = () => document.getElementById("modalExpenseDetails");
  const modalSubmit  = () => document.getElementById("modalSubmitBtn");
  const modalCancel  = () => document.getElementById("modalCancelBtn");

  function openExpenseModal() {
    // Default to valid values so Submit "just works"
    if (modalAmount())  modalAmount().value = "";
    if (modalCat())     modalCat().value = "Groceries";  // <- no "Select" default
    if (modalCard())    modalCard().value = "Credit";
    if (modalDetails()) modalDetails().value = "";
    modalOverlay.style.display = "flex";
    setTimeout(() => modalAmount()?.focus(), 0);
  }
  function closeExpenseModal() {
    modalOverlay.style.display = "none";
  }

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeExpenseModal();
  });
  document.addEventListener("keydown", (e) => {
    if (modalOverlay.style.display === "flex" && e.key === "Escape") closeExpenseModal();
  });
  modalCancel()?.addEventListener("click", closeExpenseModal);

  modalSubmit()?.addEventListener("click", () => {
    try {
      const amount = parseFloat(modalAmount().value);
      const category = modalCat().value;
      const card = (modalCard() ? modalCard().value : "").trim();
      const details = (modalDetails() ? modalDetails().value : "").trim();

      if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount.");
        modalAmount().focus();
        return;
      }
      if (!["Groceries","Social","Treat","Unexpected"].includes(category)) {
        alert("Please select a valid category.");
        modalCat().focus();
        return;
      }
      if (!["Credit","Debit"].includes(card)) {
        alert("Please choose Credit or Debit.");
        modalCard().focus();
        return;
      }

      const data = getMonthData();
      data.purchaseCount += 1;
      data.expenses.push({ id: data.purchaseCount, amount, category, card, details });
      data.categoryTotals[category] += amount;

      saveState();
      renderForCurrentMonth();
      closeExpenseModal();
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Something went wrong adding the expense. Check the console for details.");
    }
  });

  addBtn?.addEventListener("click", openExpenseModal);

  // ===== Details Modal (view-only) =====
  const detailsOverlay = document.getElementById("detailsModalOverlay");
  const detailsBody    = () => document.getElementById("detailsModalBody");
  const detailsClose   = () => document.getElementById("detailsModalCloseBtn");

  function openDetailsModal(text) {
    detailsBody().textContent = text || "No details.";
    detailsOverlay.style.display = "flex";
  }
  function closeDetailsModal() {
    detailsOverlay.style.display = "none";
  }

  detailsOverlay.addEventListener("click", (e) => {
    if (e.target === detailsOverlay) closeDetailsModal();
  });
  document.addEventListener("keydown", (e) => {
    if (detailsOverlay.style.display === "flex" && e.key === "Escape") closeDetailsModal();
  });
  detailsClose()?.addEventListener("click", closeDetailsModal);

  // ===== Set Allowance button → simple prompt flow (existing UI preserved) =====
  setAllowanceBtn?.addEventListener("click", () => {
    if (allowanceContainer) allowanceContainer.innerHTML = "";
    const val = parseFloat(prompt("Set your global allowance:", settings.allowance || 0));
    if (!isNaN(val) && val >= 0) {
      settings.allowance = val;
      saveSettings();
      renderForCurrentMonth();
    }
  });

  // ===== Initial render =====
  renderForCurrentMonth();
});
