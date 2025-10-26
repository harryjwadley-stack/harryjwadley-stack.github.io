document.addEventListener("DOMContentLoaded", () => {
  // ===== Grab elements =====
  const addBtn = document.getElementById("addExpenseBtn");
  const submittedTable = document.getElementById("submittedExpenses");
  const submittedTableBody = submittedTable.querySelector("tbody");
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

  // --- Overlay for outside-row delete dots ---
  // We'll attach an absolutely-positioned layer inside the same parent as the table,
  // and place one small 'd' per row aligned with that row.
  const tableContainer = submittedTable.closest(".table-container") || document.body;
  let deleteOverlay = document.getElementById("rowDeleteOverlay");
  if (!deleteOverlay) {
    deleteOverlay = document.createElement("div");
    deleteOverlay.id = "rowDeleteOverlay";
    // No CSS file changes required; style inline for reliability
    deleteOverlay.style.position = "absolute";
    deleteOverlay.style.top = "0";
    deleteOverlay.style.left = "0";
    deleteOverlay.style.pointerEvents = "none"; // children will enable their own
    tableContainer.style.position = tableContainer.style.position || "relative";
    tableContainer.appendChild(deleteOverlay);
  }

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

    // Rebuild and position outside delete dots
    queueMicrotask(positionDeleteDots);
  }

  function positionDeleteDots() {
    // Clear previous dots
    deleteOverlay.innerHTML = "";

    const tableRect = submittedTable.getBoundingClientRect();
    const containerRect = tableContainer.getBoundingClientRect();

    // Keep overlay the same size as container
    deleteOverlay.style.width = `${containerRect.width}px`;
    deleteOverlay.style.height = `${containerRect.height}px`;

    // Create a dot for each row
    const rows = Array.from(submittedTableBody.querySelectorAll("tr"));
    rows.forEach((tr) => {
      const id = Number(tr.getAttribute("data-row-id"));
      const r = tr.getBoundingClientRect();
      const topInContainer = r.top - containerRect.top;

      const dot = document.createElement("span");
      dot.className = "delete-mini-outer";
      dot.textContent = "d";
      dot.dataset.id = String(id);

      // Style inline to avoid relying on external CSS
      dot.style.position = "absolute";
      dot.style.left = `${(tableRect.right - containerRect.left) + 8}px`; // just outside table right edge
      dot.style.top = `${topInContainer + (r.height / 2) - 8}px`;
      dot.style.color = "#007bff";
      dot.style.cursor = "pointer";
      dot.style.fontSize = "14px";
      dot.style.fontWeight = "bold";
      dot.style.userSelect = "none";
      dot.style.lineHeight = "1";
      dot.style.pointerEvents = "auto";
      dot.style.transition = "transform 0.15s, color 0.15s";
      dot.addEventListener("mouseenter", () => {
        dot.style.transform = "scale(1.2)";
        dot.style.color = "#0056b3";
      });
      dot.addEventListener("mouseleave", () => {
        dot.style.transform = "scale(1)";
        dot.style.color = "#007bff";
      });

      deleteOverlay.appendChild(dot);
    });
  }

  // Reposition dots on resize (layout changes)
  window.addEventListener("resize", positionDeleteDots);

  // ===== Row actions: Details (in-table) & Delete (outside overlay) =====
  submittedTableBody.addEventListener("click", (evt) => {
    const detailsBtn = evt.target.closest(".show-details");
    if (!detailsBtn) return;

    const id = Number(detailsBtn.dataset.id);
    const exp = findExpenseById(id);
    const text = (exp && exp.details && exp.details.trim()) ? exp.details.trim() : "No details.";
    openDetailsModal(text);
  });

  deleteOverlay.addEventListener("click", (evt) => {
    const el = evt.target.closest(".delete-mini-outer");
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
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      if (!confirm("Are you sure you want to delete all expenses for this month?")) return;

      const data = getMonthData();
      data.expenses = [];
      data.categoryTotals = { Groceries: 0, Social: 0, Treat: 0, Unexpected: 0 };
      data.purchaseCount = 0;

      saveState();
      renderForCurrentMonth();
    });
  }

  // ===== Add Expense modal =====
  function ensureExpenseModal() {
    let overlay = document.getElementById("expenseModalOverlay");
    if (overlay) return overlay;

    // If no modal exists in HTML, inject a complete one:
    const tpl = document.createElement("div");
    tpl.innerHTML = `
      <div id="expenseModalOverlay" style="display:none; position:fixed; inset:0; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); z-index:9999;">
        <div class="expense-modal" style="width:min(92vw,420px); background:#fff; border-radius:12px; padding:18px 16px; box-shadow:0 10px 30px rgba(0,0,0,0.2); display:flex; flex-direction:column; gap:10px;">
          <h3 style="margin:0 0 6px 0;">Add Expense</h3>

          <label for="modalExpenseAmount" style="font-size:14px; color:#333;">Amount</label>
          <input id="modalExpenseAmount" type="number" step="0.01" min="0.01" placeholder="Enter amount" style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;" />

          <label for="modalExpenseCategory" style="font-size:14px; color:#333;">Category</label>
          <select id="modalExpenseCategory" style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;">
            <option value="Select">Select</option>
            <option value="Groceries">Groceries</option>
            <option value="Social">Social</option>
            <option value="Treat">Treat</option>
            <option value="Unexpected">Unexpected</option>
          </select>

          <label for="modalExpenseCard" style="font-size:14px; color:#333;">Select card</label>
          <select id="modalExpenseCard" style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;">
            <option value="Credit">Credit</option>
            <option value="Debit">Debit</option>
          </select>

          <label for="modalExpenseDetails" style="font-size:14px; color:#333;">Details (optional)</label>
          <textarea id="modalExpenseDetails" rows="2" placeholder="Enter details..." style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;"></textarea>

          <div class="modal-actions" style="display:flex; justify-content:flex-end; gap:10px; margin-top:6px;">
            <button id="modalCancelBtn" type="button">Cancel</button>
            <button id="modalSubmitBtn" type="button">Submit</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(tpl.firstElementChild);
    return document.getElementById("expenseModalOverlay");
  }

  const modalOverlay = ensureExpenseModal();
  const modalAmount  = () => document.getElementById("modalExpenseAmount");
  const modalCat     = () => document.getElementById("modalExpenseCategory");
  const modalCard    = () => document.getElementById("modalExpenseCard");
  const modalDetails = () => document.getElementById("modalExpenseDetails");
  const modalSubmit  = () => document.getElementById("modalSubmitBtn");
  const modalCancel  = () => document.getElementById("modalCancelBtn");

  function openExpenseModal() {
    modalAmount().value = "";
    modalCat().value = "Select";
    if (modalCard()) modalCard().value = "Credit";
    if (modalDetails()) modalDetails().value = "";
    modalOverlay.style.display = "flex";
    setTimeout(() => modalAmount().focus(), 0);
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
  modalCancel().addEventListener("click", closeExpenseModal);

  modalSubmit().addEventListener("click", () => {
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
  });

  if (addBtn) addBtn.addEventListener("click", openExpenseModal);

  // ===== Details Modal (view-only) =====
  function ensureDetailsModal() {
    let overlay = document.getElementById("detailsModalOverlay");
    if (overlay) return overlay;

    const tpl = document.createElement("div");
    tpl.innerHTML = `
      <div id="detailsModalOverlay" style="display:none; position:fixed; inset:0; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); z-index:9999;">
        <div class="expense-modal" style="width:min(92vw,520px); background:#fff; border-radius:12px; padding:18px 16px; box-shadow:0 10px 30px rgba(0,0,0,0.2); display:flex; flex-direction:column; gap:10px;">
          <h3 style="margin:0 0 6px 0;">Expense Details</h3>
          <div id="detailsModalBody" style="white-space:pre-wrap; line-height:1.35;"></div>
          <div class="modal-actions" style="display:flex; justify-content:flex-end; gap:10px; margin-top:6px;">
            <button id="detailsModalCloseBtn" type="button">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(tpl.firstElementChild);
    return document.getElementById("detailsModalOverlay");
  }

  const detailsOverlay = ensureDetailsModal();
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
  detailsClose().addEventListener("click", closeDetailsModal);

  // ===== Allowance Modal (unchanged core flow) =====
  function ensureAllowanceModal() {
    let overlay = document.getElementById("allowanceModalOverlay");
    if (overlay) return overlay;
    const tpl = document.createElement("div");
    tpl.innerHTML = `
      <div id="allowanceModalOverlay" style="display:none; position:fixed; inset:0; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); z-index:9999;">
        <div class="expense-modal" style="width:min(92vw,460px); background:#fff; border-radius:12px; padding:18px 16px; box-shadow:0 10px 30px rgba(0,0,0,0.2); display:flex; flex-direction:column; gap:10px;">
          <h3 style="margin:0 0 6px 0;">Set Global Allowance</h3>
          <div id="allowanceModalStage"></div>
          <div class="modal-actions" style="display:flex; justify-content:flex-end; gap:10px; margin-top:6px;">
            <button id="allowanceModalCancelBtn" type="button">Cancel</button>
            <button id="allowanceModalBackBtn" type="button" style="display:none;">Back</button>
            <button id="allowanceModalSubmitBtn" type="button" style="display:none;">Submit</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(tpl.firstElementChild);
    return document.getElementById("allowanceModalOverlay");
  }

  const allowanceModalOverlay = ensureAllowanceModal();
  const allowanceStage     = () => document.getElementById("allowanceModalStage");
  const allowanceCancelBtn = () => document.getElementById("allowanceModalCancelBtn");
  const allowanceBackBtn   = () => document.getElementById("allowanceModalBackBtn");
  const allowanceSubmitBtn = () => document.getElementById("allowanceModalSubmitBtn");

  let allowanceFlow = { mode: null };

  function openAllowanceModal() {
    showAllowanceChoice();
    allowanceModalOverlay.style.display = "flex";
  }
  function closeAllowanceModal() {
    allowanceModalOverlay.style.display = "none";
    allowanceFlow = { mode: null };
  }

  allowanceModalOverlay.addEventListener("click", (e) => {
    if (e.target === allowanceModalOverlay) closeAllowanceModal();
  });
  document.addEventListener("keydown", (e) => {
    if (allowanceModalOverlay.style.display === "flex" && e.key === "Escape") closeAllowanceModal();
  });
  allowanceCancelBtn().addEventListener("click", closeAllowanceModal);

  function showAllowanceChoice() {
    allowanceFlow.mode = null;
    allowanceBackBtn().style.display = "none";
    allowanceSubmitBtn().style.display = "none";
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
    allowanceBackBtn().style.display = "inline-block";
    allowanceSubmitBtn().style.display = "inline-block";
    allowanceSubmitBtn().textContent = "Set Global Allowance";
    allowanceStage().innerHTML = `
      <label for="allowanceManualInput" style="font-size:14px; color:#333;">Allowance Amount</label>
      <input id="allowanceManualInput" type="number" step="0.01" min="0" placeholder="Enter amount"
             style="padding:8px; font-size:16px; width:100%; box-sizing:border-box;" />
    `;
    const inp = document.getElementById("allowanceManualInput");
    inp.value = Number(settings.allowance || 0);
    inp.focus({ preventScroll:true });
    allowanceBackBtn().onclick = showAllowanceChoice;
    allowanceSubmitBtn().onclick = () => {
      const val = parseFloat(inp.value);
      if (isNaN(val) || val < 0) {
        alert("Please enter a valid allowance (0 or more).");
        inp.focus();
        return;
      }
      settings.allowance = val;
      saveSettings();
      renderForCurrentMonth();
      closeAllowanceModal();
    };
  }

  function showAllowanceCalc() {
    allowanceFlow.mode = "calc";
    allowanceBackBtn().style.display = "inline-block";
    allowanceSubmitBtn().style.display = "inline-block";
    allowanceSubmitBtn().textContent = "Set Global Allowance";
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
    allowanceBackBtn().onclick = showAllowanceChoice;
    allowanceSubmitBtn().onclick = () => {
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

  // ===== Set Allowance button → open modal =====
  if (setAllowanceBtn) {
    setAllowanceBtn.addEventListener("click", () => {
      if (allowanceContainer) allowanceContainer.innerHTML = "";
      openAllowanceModal();
    });
  }

  // ===== Initial render =====
  renderForCurrentMonth();
});
