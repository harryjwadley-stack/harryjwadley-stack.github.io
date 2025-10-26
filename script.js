document.addEventListener("DOMContentLoaded", () => {
  // === Shorthands / utils ===
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.flat().forEach(k => n.append(k));
    return n;
  };
  const setHTML = (node, html) => (node.innerHTML = html, node);
  const setShow = (node, shown) => (node.style.display = shown ? "flex" : "none", node);

  // === Elements ===
  const addBtn                = $("#addExpenseBtn");
  const submittedTable        = $("#submittedExpenses");
  const submittedTableBody    = $("tbody", submittedTable);
  const totalsDiv             = $("#categoryTotals");
  const clearAllBtn           = $("#clearAllBtn");
  const setAllowanceBtn       = $("#setAllowanceBtn");
  const allowanceContainer    = $("#allowanceContainer");
  const allowanceDisplay      = $("#allowanceDisplay");
  const allowanceRemainingDiv = $("#allowanceRemaining");
  const prevBtn               = $("#prevMonthBtn");
  const nextBtn               = $("#nextMonthBtn");
  const monthSelect           = $("#monthSelect");
  const yearSelect            = $("#yearSelect");

  // === Constants / state ===
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const CATS   = ["Groceries","Social","Treat","Unexpected"];
  const STATE_KEY = "savr-monthly-state-v1";
  const SETTINGS_KEY = "savr-settings-v1";

  const loadJSON = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } };
  const saveJSON = (k,v) => localStorage.setItem(k, JSON.stringify(v));

  let monthlyState = loadJSON(STATE_KEY) || {};
  let settings     = loadJSON(SETTINGS_KEY) || { allowance: 0 };

  // migration: remove old per-month allowance fields
  Object.keys(monthlyState).forEach(k => { if ("allowance" in (monthlyState[k] || {})) delete monthlyState[k].allowance; });

  const saveState     = () => saveJSON(STATE_KEY, monthlyState);
  const saveSettings  = () => saveJSON(SETTINGS_KEY, settings);
  const yyyymmKey     = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
  let currentYear, currentMonthIndex;

  const ensureMonth = key => (monthlyState[key] ??= { expenses: [], categoryTotals: Object.fromEntries(CATS.map(c=>[c,0])), purchaseCount: 0 });
  const currentKey  = () => yyyymmKey(currentYear, currentMonthIndex);
  const getData     = () => ensureMonth(currentKey());
  const findById    = id => getData().expenses.find(e => e.id === id);

  // === Chart ===
  const chart = new Chart($("#categoryChart").getContext("2d"), {
    type: "pie",
    data: { labels: CATS, datasets: [{ label: "Category Breakdown", data: [0,0,0,0], backgroundColor: ["#36A2EB","#FF6384","#FFCE56","#4BC0C0"] }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });

  // === Month pickers ===
  (function initPickers(){
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonthIndex = now.getMonth();

    if (monthSelect) {
      MONTHS.forEach((name,i)=> monthSelect.append(el("option",{value:i, textContent:name})));
      monthSelect.value = currentMonthIndex;
      monthSelect.addEventListener("change", () => { currentMonthIndex = +monthSelect.value; render(); });
    }
    if (yearSelect) {
      for (let y = currentYear - 3; y <= currentYear + 3; y++) yearSelect.append(el("option",{value:y, textContent:y}));
      yearSelect.value = currentYear;
      yearSelect.addEventListener("change", () => { currentYear = +yearSelect.value; render(); });
    }
    prevBtn?.addEventListener("click", () => { if (--currentMonthIndex < 0) { currentMonthIndex = 11; yearSelect && (yearSelect.value = --currentYear); } monthSelect && (monthSelect.value = currentMonthIndex); render(); });
    nextBtn?.addEventListener("click", () => { if (++currentMonthIndex > 11) { currentMonthIndex = 0; yearSelect && (yearSelect.value = ++currentYear); } monthSelect && (monthSelect.value = currentMonthIndex); render(); });
  })();

  // === Ensure Actions header ===
  (function ensureActionsHeader(){
    const row = $("thead tr", submittedTable);
    if (row && !$$("th", row).some(th => th.textContent.trim().toLowerCase() === "actions")) row.append(el("th",{textContent:"Actions"}));
  })();

  // === Outside-row delete overlay ===
  const tableContainer = submittedTable.closest(".table-container") || document.body;
  tableContainer.style.position ||= "relative";
  const deleteOverlay = el("div",{ id:"rowDeleteOverlay", style:"position:absolute;top:0;left:0;pointer-events:none;" });
  tableContainer.append(deleteOverlay);

  // === Render ===
  function render() {
    const data = getData();
    allowanceDisplay.textContent = `Allowance: ${(Number(settings.allowance)||0).toFixed(2)}`;

    // rows
    setHTML(submittedTableBody, "");
    data.expenses.forEach((e, i) => {
      submittedTableBody.append(el("tr", { dataset:{ id: e.id } },
        el("td",{ textContent: i+1 }),
        el("td",{ textContent: e.amount.toFixed(2) }),
        el("td",{ textContent: e.category }),
        el("td",{ textContent: e.card || "-" }),
        el("td",{}, el("button",{ className:"show-details", dataset:{ id:e.id }, textContent:"details" }))
      ));
    });

    // totals
    totalsDiv.innerHTML = CATS.map(c=>`${c}: ${data.categoryTotals[c].toFixed(2)}`).join("<br>");

    // allowance remaining
    const totalSpent = CATS.reduce((s,c)=>s+data.categoryTotals[c],0);
    allowanceRemainingDiv.textContent = `Allowance Remaining: ${(settings.allowance - totalSpent).toFixed(2)}`;

    // chart
    chart.data.datasets[0].data = CATS.map(c => data.categoryTotals[c]);
    chart.update();

    // position delete dots next tick
    queueMicrotask(positionDeleteDots);
  }

  function positionDeleteDots() {
    deleteOverlay.innerHTML = "";
    const tableRect = submittedTable.getBoundingClientRect();
    const containerRect = tableContainer.getBoundingClientRect();
    Object.assign(deleteOverlay.style, { width: `${containerRect.width}px`, height: `${containerRect.height}px` });

    $$("tr", submittedTableBody).forEach(tr => {
      const id = +tr.dataset.id;
      const r = tr.getBoundingClientRect();
      const y = r.top - containerRect.top + r.height/2 - 8;
      const x = tableRect.right - containerRect.left + 8;

      const dot = el("span", {
        className:"delete-mini-outer",
        dataset:{ id },
        textContent:"d",
        style: `position:absolute;left:${x}px;top:${y}px;color:#007bff;cursor:pointer;font-size:14px;font-weight:bold;user-select:none;line-height:1;pointer-events:auto;transition:transform .15s,color .15s;`
      });
      dot.addEventListener("mouseenter", () => (dot.style.transform="scale(1.2)", dot.style.color="#0056b3"));
      dot.addEventListener("mouseleave", () => (dot.style.transform="scale(1)",   dot.style.color="#007bff"));
      deleteOverlay.append(dot);
    });
  }
  window.addEventListener("resize", positionDeleteDots);

  // === Table actions (details) ===
  submittedTableBody.addEventListener("click", e => {
    const btn = e.target.closest(".show-details");
    if (!btn) return;
    const exp = findById(+btn.dataset.id);
    openDetailsModal((exp?.details || "").trim() || "No details.");
  });

  // === Delete via overlay ===
  deleteOverlay.addEventListener("click", e => {
    const elDot = e.target.closest(".delete-mini-outer");
    if (!elDot) return;
    const id = +elDot.dataset.id;

    const data = getData();
    const i = data.expenses.findIndex(x => x.id === id);
    if (i < 0) return;

    const exp = data.expenses[i];
    data.categoryTotals[exp.category] = Math.max(0, (data.categoryTotals[exp.category] || 0) - (exp.amount || 0));
    data.expenses.splice(i,1);

    saveState();
    render();
  });

  // === Clear All ===
  clearAllBtn?.addEventListener("click", () => {
    if (!confirm("Delete all expenses for this month?")) return;
    const data = getData();
    data.expenses = [];
    data.categoryTotals = Object.fromEntries(CATS.map(c=>[c,0]));
    data.purchaseCount = 0;
    saveState();
    render();
  });

  // === Add Expense modal (idempotent binding even if modal exists in HTML) ===
  const expenseOverlay = ensureExpenseModal();
  const modalAmount    = () => $("#modalExpenseAmount");
  const modalCat       = () => $("#modalExpenseCategory");
  const modalCard      = () => $("#modalExpenseCard");
  const modalDetails   = () => $("#modalExpenseDetails");

  function bindExpenseModalHandlers(overlay){
    if (overlay.dataset.bound) return; // avoid duplicate bindings
    overlay.addEventListener("click", e => { if (e.target === overlay) closeExpenseModal(); });
    document.addEventListener("keydown", e => { if (overlay.style.display==="flex" && e.key==="Escape") closeExpenseModal(); });
    $("#modalCancelBtn", overlay)?.addEventListener("click", closeExpenseModal);
    $("#modalSubmitBtn", overlay)?.addEventListener("click", submitExpense);
    overlay.dataset.bound = "1";
  }

  function ensureExpenseModal(){
    let overlay = $("#expenseModalOverlay");
    if (overlay) { bindExpenseModalHandlers(overlay); return overlay; }

    overlay = el("div", { id:"expenseModalOverlay", style:"display:none;position:fixed;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999;" },
      el("div",{ className:"expense-modal" },
        el("h3",{ textContent:"Add Expense" }),
        el("label",{ htmlFor:"modalExpenseAmount", textContent:"Amount" }),
        el("input",{ id:"modalExpenseAmount", type:"number", step:"0.01", min:"0.01", placeholder:"Enter amount" }),
        el("label",{ htmlFor:"modalExpenseCategory", textContent:"Category" }),
        el("select",{ id:"modalExpenseCategory" }, el("option",{value:"Select",textContent:"Select"}), ...CATS.map(c=>el("option",{value:c,textContent:c}))),
        el("label",{ htmlFor:"modalExpenseCard", textContent:"Select card" }),
        el("select",{ id:"modalExpenseCard" }, el("option",{value:"Credit",textContent:"Credit"}), el("option",{value:"Debit",textContent:"Debit"})),
        el("label",{ htmlFor:"modalExpenseDetails", textContent:"Details (optional)" }),
        el("textarea",{ id:"modalExpenseDetails", rows:"2", placeholder:"Enter details..." }),
        el("div",{ className:"modal-actions" },
          el("button",{ id:"modalCancelBtn", type:"button", textContent:"Cancel" }),
          el("button",{ id:"modalSubmitBtn", type:"button", textContent:"Submit" })
        )
      )
    );
    document.body.append(overlay);
    bindExpenseModalHandlers(overlay);
    return overlay;
  }

  function openExpenseModal(){ modalAmount().value=""; modalCat().value="Select"; modalCard().value="Credit"; modalDetails().value=""; setShow(expenseOverlay,true); setTimeout(()=>modalAmount().focus(),0); }
  function closeExpenseModal(){ setShow(expenseOverlay,false); }

  function submitExpense(){
    const amount   = parseFloat(modalAmount().value);
    const category = modalCat().value;
    const card     = modalCard().value.trim();
    const details  = modalDetails().value.trim();

    if (!(amount > 0)) return modalAmount().focus(), alert("Please enter a valid amount.");
    if (!CATS.includes(category)) return modalCat().focus(), alert("Please select a valid category.");
    if (!["Credit","Debit"].includes(card)) return modalCard().focus(), alert("Please choose Credit or Debit.");

    const data = getData();
    data.purchaseCount += 1;
    data.expenses.push({ id: data.purchaseCount, amount, category, card, details });
    data.categoryTotals[category] += amount;

    saveState();
    render();
    closeExpenseModal();
  }

  addBtn?.addEventListener("click", openExpenseModal);

  // === Details Modal ===
  const detailsOverlay = ensureDetailsModal();
  const detailsBody    = () => $("#detailsModalBody");

  function bindDetailsModalHandlers(overlay){
    if (overlay.dataset.bound) return;
    overlay.addEventListener("click", e => { if (e.target === overlay) closeDetailsModal(); });
    document.addEventListener("keydown", e => { if (overlay.style.display==="flex" && e.key==="Escape") closeDetailsModal(); });
    $("#detailsModalCloseBtn", overlay)?.addEventListener("click", closeDetailsModal);
    overlay.dataset.bound = "1";
  }

  function ensureDetailsModal(){
    let overlay = $("#detailsModalOverlay");
    if (overlay) { bindDetailsModalHandlers(overlay); return overlay; }
    overlay = el("div",{ id:"detailsModalOverlay", style:"display:none;position:fixed;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999;" },
      el("div",{ className:"expense-modal" },
        el("h3",{ textContent:"Expense Details" }),
        el("div",{ id:"detailsModalBody", style:"white-space:pre-wrap;line-height:1.35;" }),
        el("div",{ className:"modal-actions" },
          el("button",{ id:"detailsModalCloseBtn", type:"button", textContent:"Close" })
        )
      )
    );
    document.body.append(overlay);
    bindDetailsModalHandlers(overlay);
    return overlay;
  }

  function openDetailsModal(text){ detailsBody().textContent = text || "No details."; setShow(detailsOverlay,true); }
  function closeDetailsModal(){ setShow(detailsOverlay,false); }

  // === Allowance Modal (unchanged behavior; idempotent bindings) ===
  const allowanceOverlay = ensureAllowanceModal();
  const stage = () => $("#allowanceModalStage");
  const back  = () => $("#allowanceModalBackBtn");
  const sub   = () => $("#allowanceModalSubmitBtn");

  function bindAllowanceModalHandlers(overlay){
    if (overlay.dataset.bound) return;
    overlay.addEventListener("click", e => { if (e.target === overlay) closeAllowanceModal(); });
    document.addEventListener("keydown", e => { if (overlay.style.display==="flex" && e.key==="Escape") closeAllowanceModal(); });
    $("#allowanceModalCancelBtn", overlay)?.addEventListener("click", closeAllowanceModal);
    overlay.dataset.bound = "1";
  }

  function ensureAllowanceModal(){
    let overlay = $("#allowanceModalOverlay");
    if (overlay) { bindAllowanceModalHandlers(overlay); return overlay; }
    overlay = el("div",{ id:"allowanceModalOverlay", style:"display:none;position:fixed;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999;" },
      el("div",{ className:"expense-modal" },
        el("h3",{ textContent:"Set Global Allowance" }),
        el("div",{ id:"allowanceModalStage" }),
        el("div",{ className:"modal-actions" },
          el("button",{ id:"allowanceModalCancelBtn", type:"button", textContent:"Cancel" }),
          el("button",{ id:"allowanceModalBackBtn", type:"button", textContent:"Back", style:"display:none;" }),
          el("button",{ id:"allowanceModalSubmitBtn", type:"button", textContent:"Submit", style:"display:none;" })
        )
      )
    );
    document.body.append(overlay);
    bindAllowanceModalHandlers(overlay);
    return overlay;
  }

  function openAllowanceModal(){ showChoice(); setShow(allowanceOverlay,true); }
  function closeAllowanceModal(){ setShow(allowanceOverlay,false); }

  function showChoice(){
    back().style.display = sub().style.display = "none";
    stage().innerHTML = `
      <p>How would you like to set your global allowance?</p>
      <div style="display:flex;gap:10px;">
        <button id="allowanceManualBtn" type="button">Manual</button>
        <button id="allowanceCalcBtn" type="button">Calculate</button>
      </div>`;
    $("#allowanceManualBtn").onclick = showManual;
    $("#allowanceCalcBtn").onclick = showCalc;
  }
  function showManual(){
    back().style.display = sub().style.display = "inline-block";
    sub().textContent = "Set Global Allowance";
    stage().innerHTML = `
      <label for="allowanceManualInput">Allowance Amount</label>
      <input id="allowanceManualInput" type="number" step="0.01" min="0" placeholder="Enter amount"/>`;
    const inp = $("#allowanceManualInput"); inp.value = Number(settings.allowance || 0); inp.focus({preventScroll:true});
    back().onclick = showChoice;
    sub().onclick = () => {
      const val = parseFloat(inp.value);
      if (!(val >= 0)) return inp.focus(), alert("Please enter a valid allowance (0 or more).");
      settings.allowance = val; saveSettings(); render(); closeAllowanceModal();
    };
  }
  function showCalc(){
    back().style.display = sub().style.display = "inline-block";
    sub().textContent = "Set Global Allowance";
    const labels = ["Income","Rent","Car Payments","Bills","Ideal Savings","Other"];
    stage().innerHTML = `
      <p>Allowance = Income − (Rent + Car + Bills + Savings + Other)</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${labels.map(l=>`<label style="display:flex;flex-direction:column;gap:6px;">
          <span>${l}</span><input type="number" step="0.01" min="0" placeholder="${l}" data-allow="${l}" value="0"/></label>`).join("")}
      </div>`;
    back().onclick = showChoice;
    sub().onclick = () => {
      const vals = {}; $$('[data-allow]').forEach(i => vals[i.dataset.allow] = parseFloat(i.value)||0);
      settings.allowance = vals["Income"] - (vals["Rent"] + vals["Car Payments"] + vals["Bills"] + vals["Ideal Savings"] + vals["Other"]);
      saveSettings(); render(); closeAllowanceModal();
    };
  }
  setAllowanceBtn?.addEventListener("click", () => { allowanceContainer && (allowanceContainer.innerHTML=""); openAllowanceModal(); });

  // === Kickoff ===
  addBtn && addBtn.addEventListener("click", openExpenseModal);
  render();
});
