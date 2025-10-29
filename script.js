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

  // Remove any old per-month allowance fields
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

  // --- Right-side rail (now supports edit + delete)
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

    // Rebuild and position right-hand edit/delete dots
    queueMicrotask(positionEditDeleteDots);
  }

  function positionEditDeleteDots() {
    if (!deleteRail) return;
    deleteRail.innerHTML = "";

    const containerRect = tableWrap.getBoundingClientRect();
    const tableRect = submittedTable.getBoundingClientRect();
    const rows = Array.from(submittedTableBody.querySelectorAll("tr"));

    rows.forEach((tr) => {
      const id = Number(tr.getAttribute("data-row-id"));
      const r = tr.getBoundingClientRect();
      const topInContainer = r.top - containerRect.top + (r.height / 2) - 8;

      // --- Edit button (e) ---
      const edit = document.createElement("span");
      edit.className = "edit-mini";
      edit.textContent = "e";
      edit.dataset.id = String(id);
      edit.style.position = "absolute";
      edit.style.top = `${topInContainer}px`;
      // position both outside the table (to the right of table edge)
      edit.style.left = `${(tableRect.right - containerRect.left) + 8}px`;

      // --- Delete button (d) ---
      const dot = document.createElement("span");
      dot.className = "delete-mini";
      dot.textContent = "d";
      dot.dataset.id = String(id);
      dot.style.position = "absolute";
      dot.style.top = `${topInContainer}px`;
      dot.style.left = `${(tableRect.right - containerRect.left) + 28}px`; // 20px gap from edit

      deleteRail.appendChild(edit);
      deleteRail.appendChild(dot);
    });
  }

  // Reposition dots on resize
  window.addEventListener("resize", positionEditDeleteDots);

  // ===== Row actions: Details (in-table) & Edit/Delete (rail) =====
  submittedTableBody.addEventListener("click", (evt) => {
    const detailsBtn = evt.target.closest(".show-details");
    if (!detailsBtn) return;

    const id = Number(detailsBtn.dataset.id);
    const exp = findExpenseById(id);
    const text = (exp && exp.details && exp.details.trim()) ? exp.details.trim() : "No details.";
    openDetailsModal(text);
  });

  deleteRail?.addEventListener("click", (evt) => {
    const editEl = evt.target.closest(".edit-mini");
    const delEl  = evt.target.closest(".delete-mini");

    if (editEl) {
      const id = Number(editEl.dataset.id);
      const exp = findExpenseById(id);
      if (exp) openExpenseModal(exp); // open in edit mode (prefilled)
      return;
    }

    if (delEl) {
      const id = Number(delEl.dataset.id);

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
    }
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

  // ===== Add/Edit Expense modal (existing HTML) =====
  const expenseOverlay = document.getElementById("expenseModalOverlay");
  const modalAmount  = () => document.getElementById("modalExpenseAmount");
  const modalCat     = () => document.getElementById("modalExpenseCategory");
  const modalCard    = () => document.getElementById("modalExpenseCard");
  const modalDetails = () => document.getElementById("modalExpenseDetails");
  const modalSubmit  = () => document.getElementById("modalSubmitBtn");
  const modalCancel  = () => document.getElementById("modalCancelBtn");
  const modalTitle   = () => expenseOverlay.querySelector(".expense-modal h3");

  // Track whether we're editing; if so, which id
  let editingId = null;

  function openExpenseModal(expense = null) {
    if (expense) {
      editingId = expense.id;
      modalTitle().textContent = "Edit Expense";
      modalAmount().value = expense.amount;
      modalCat().value = expense.category;
      modalCard().value = expense.card || "Credit";
      modalDetails().value = expense.details || "";
    } else {
      editingId = null;
      modalTitle().textContent = "Add Expense";
      modalAmount().value = "";
      modalCat().value = "Groceries";
      modalCard().value = "Credit";
      modalDetails().value = "";
    }
    expenseOverlay.style.display = "flex";
    setTimeout(() => modalAmount()?.focus(), 0);
  }
  function closeExpenseModal() { expenseOverlay.style.display = "none"; editingId = null; }

  expenseOverlay.addEventListener("click", (e) => { if (e.target === expenseOverlay) closeExpenseModal(); });
  document.addEventListener("keydown", (e) => {
    if (expenseOverlay.style.display === "flex" && e.key === "Escape") closeExpenseModal();
  });
  modalCancel()?.addEventListener("click", closeExpenseModal);

  modalSubmit()?.addEventListener("click", () => {
    try {
      const amount = parseFloat(modalAmount().value);
      const category = modalCat().value;
      const card = (modalCard() ? modalCard().value : "").trim();
      const details = (modalDetails() ? modalDetails().value : "").trim();

      if (isNaN(amount) || amount <= 0) { alert("Please enter a valid amount."); modalAmount().focus(); return; }
      if (!["Groceries","Social","Treat","Unexpected"].includes(category)) { alert("Please select a valid category."); modalCat().focus(); return; }
      if (!["Credit","Debit"].includes(card)) { alert("Please choose Credit or Debit."); modalCard().focus(); return; }

      const data = getMonthData();

      if (editingId !== null) {
        // Update existing expense
        const idx = data.expenses.findIndex(e => e.id === editingId);
        if (idx !== -1) {
          const old = data.expenses[idx];
          // Adjust old category total
          data.categoryTotals[old.category] = Math.max(0, (data.categoryTotals[old.category] || 0) - (old.amount || 0));

          // Apply updates
          data.expenses[idx] = { ...old, amount, category, card, details };

          // Add to new category total
          data.categoryTotals[category] = (data.categoryTotals[category] || 0) + amount;
        }
      } else {
        // Add new expense
        data.purchaseCount += 1;
        data.expenses.push({ id: data.purchaseCount, amount, category, card, details });
        data.categoryTotals[category] += amount;
      }

      saveState();
      renderForCurrentMonth();
      closeExpenseModal();
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Something went wrong adding/updating the expense. Check the console for details.");
    }
  });

  addBtn?.addEventListener("click", () => openExpenseModal());

  // ===== Details Modal (view-only) =====
  const detailsOverlay = document.getElementById("detailsModalOverlay");
  const detailsBody    = () => document.getElementById("detailsModalBody");
  const detailsClose   = () => document.getElementById("detailsModalCloseBtn");

  function openDetailsModal(text) {
    detailsBody().textContent = text || "No details.";
    detailsOverlay.style.display = "flex";
  }
  function closeDetailsModal() { detailsOverlay.style.display = "none"; }

  detailsOverlay.addEventListener("click", (e) => { if (e.target === detailsOverlay) closeDetailsModal(); });
  document.addEventListener("keydown", (e) => {
    if (detailsOverlay.style.display === "flex" && e.key === "Escape") closeDetailsModal();
  });
  detailsClose()?.addEventListener("click", closeDetailsModal);

  // ===== Allowance Modal (Manual / Calculate flow) =====
  const allowanceOverlay = document.getElementById("allowanceModalOverlay");
  const allowanceStage   = () => document.getElementById("allowanceModalStage");
  const allowanceCancel  = () => document.getElementById("allowanceModalCancelBtn");
  const allowanceBack    = () => document.getElementById("allowanceModalBackBtn");
  const allowanceSubmit  = () => document.getElementById("allowanceModalSubmitBtn");

  let allowanceFlow = { mode: null };

  function openAllowanceModal() {
    showAllowanceChoice();
    allowanceOverlay.style.display = "flex";
  }
  function closeAllowanceModal() {
    allowanceOverlay.style.display = "none";
    allowanceFlow = { mode: null };
  }

  function showAllowanceChoice() {
    allowanceFlow.mode = null;
    allowanceBack().style.display = "none";
    allowanceSubmit().style.display = "none";
    allowanceStage().innerHTML = `
      <p>How would you like to set your global allowance?</p>
      <div style="display:flex; gap:10px;">
        <button id="allowanceManualBtn" type="button">Manual</button>
        <button id="allowanceCalcBtn" type="button">Calculate</button>
      </div>
    `;
    document.getElementById("allowanceManualBtn").addEventListener("click", showAllowanceManual);
    document.getElementById("allowanceCalcBtn").addEventListener("click", showAllowanceCalc);
  }

  function showAllowanceManual() {
    allowanceFlow.mode = "manual";
    allowanceBack().style.display = "inline-block";
    allowanceSubmit().style.display = "inline-block";
    allowanceSubmit().textContent = "Set Global Allowance";
    allowanceStage().innerHTML = `
      <label for="allowanceManualInput" style="font-size:14px; color:#333;">Allowance Amount</label>
      <input id="allowanceManualInput" type="number" step="0.01" min="0" placeholder="Enter amount"
             style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;" />
    `;
    const inp = document.getElementById("allowanceManualInput");
    inp.value = Number(settings.allowance || 0);
    inp.focus({ preventScroll:true });
    allowanceBack().onclick = showAllowanceChoice;
    allowanceSubmit().onclick = () => {
      const val = parseFloat(inp.value);
      if (isNaN(val) || val < 0) { alert("Please enter a valid allowance (0 or more)."); inp.focus(); return; }
      settings.allowance = val;
      saveSettings();
      renderForCurrentMonth();
      closeAllowanceModal();
    };
  }

  function showAllowanceCalc() {
    allowanceFlow.mode = "calc";
    allowanceBack().style.display = "inline-block";
    allowanceSubmit().style.display = "inline-block";
    allowanceSubmit().textContent = "Set Global Allowance";
    allowanceStage().innerHTML = `
      <p>Allowance = Income − (Rent + Car + Bills + Savings + Other)</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${["Income","Rent","Car Payments","Bills","Ideal Savings","Other"].map(label => `
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="font-size:14px; color:#333;">${label}</span>
            <input type="number" step="0.01" min="0" placeholder="${label}" data-allowance="${label}"
                   style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;" value="0" />
          </label>
        `).join("")}
      </div>
    `;
    allowanceBack().onclick = showAllowanceChoice;
    allowanceSubmit().onclick = () => {
      const vals = {};
      document.querySelectorAll('[data-allowance]').forEach(el => {
        vals[el.dataset.allowance] = parseFloat(el.value) || 0;
      });
      const income  = vals["Income"];
      const costs   = vals["Rent"] + vals["Car Payments"] + vals["Bills"] + vals["Ideal Savings"] + vals["Other"];
      const result  = income - costs;
      settings.allowance = result;
      saveSettings();
      renderForCurrentMonth();
      closeAllowanceModal();
    };
  }

  // Allowance modal wiring
  allowanceOverlay.addEventListener("click", (e) => { if (e.target === allowanceOverlay) closeAllowanceModal(); });
  document.addEventListener("keydown", (e) => {
    if (allowanceOverlay.style.display === "flex" && e.key === "Escape") closeAllowanceModal();
  });
  allowanceCancel()?.addEventListener("click", closeAllowanceModal);

  // Set Allowance button → open modal
  setAllowanceBtn?.addEventListener("click", openAllowanceModal);

  // ===== Initial render =====
  renderForCurrentMonth();
});
