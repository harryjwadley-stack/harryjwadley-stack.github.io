const feedBtn = document.getElementById("feedBtn");
const surveyBtn = document.getElementById("surveyBtn");
const pageContent = document.getElementById("pageContent");

function showFeed() {
  feedBtn.classList.add("active");
  surveyBtn.classList.remove("active");

  document.body.style.background = "var(--royal-blue)";

  pageContent.classList.remove("survey-page");
  pageContent.classList.add("feed-page");

  const posts = [
    {
      category: "Example",
      stat: "100% of examples are examples",
      summary:
        "Examples are a useful way to not have to remember any information",
      sourceLabel: "Harry's brain 1h ago",
      sourceUrl: "https://www.instagram.com/harrywadleyy/",
    },
    {
      category: "Mindset & Stress",
      stat: "48% of Gen Z say they do not feel financially secure",
      summary:
        "Deloitte’s 2025 survey reports that financial insecurity rose year over year, with nearly half of Gen Z (and 46% of millennials) saying they don’t feel financially secure. It also links lower financial security with poorer well‑being and less positive feelings about work.",
      sourceLabel: "Deloitte (May 2025) – 2025 Gen Z & Millennial Survey",
      sourceUrl: "https://www.deloitte.com/global/en/issues/work/genz-millennial-survey.html",
    },
    {
      category: "Mindset & Stress (Canada)",
      stat: "64% of Gen Z Canadians experience financial stress multiple times a week",
      summary:
        "TD’s survey piece highlights the pressure many Gen Z Canadians feel to present ‘financial stability’ online. It reports that only 37% feel in control of their money and nearly two‑thirds feel financial stress multiple times a week, alongside broader concerns tied to cost of living and social pressure.",
      sourceLabel: "TD Stories (Oct 2025) – ‘Fake financial stability’ survey",
      sourceUrl:
        "https://stories.td.com/ca/en/news/2025-10-14-more-than-half-of-gen-z-canadians-feel-pressured-to-27fake-27-f",
    },
    {
      category: "Savings & Emergencies",
      stat: "63% of adults would cover a $400 emergency expense using cash (or its equivalent)",
      summary:
        "The Federal Reserve’s SHED data visualization shows the share of adults who could fully cover a $400 emergency expense using cash or an equivalent. It also breaks this metric down by demographics (like age, education, race/ethnicity, and metro status).",
      sourceLabel: "Federal Reserve SHED Data Viz (May 2025) – $400 emergency expense",
      sourceUrl:
        "https://www.federalreserve.gov/consumerscommunities/sheddataviz/unexpectedexpenses.html",
    },
    {
      category: "Savings (Gen Z)",
      stat: "29% of Gen Z report having zero emergency savings (U.S., 2025)",
      summary:
        "Bankrate’s report on emergency savings finds that a sizable share of Americans have no emergency fund at all, and it breaks this out by generation—reporting 29% for Gen Z and 34% for millennials. The piece discusses economic pressures and how many people are struggling to build or maintain a buffer.",
      sourceLabel: "Bankrate (Aug 2025) – Americans without emergency savings",
      sourceUrl: "https://www.bankrate.com/banking/americans-without-emergency-savings/",
    },
    {
      category: "Debt (Student Loans)",
      stat: "Median student debt is between $20,000 and $24,999 for borrowers with their own education debt",
      summary:
        "In the Fed’s Economic Well‑Being report, most student loan borrowers with outstanding debt owe less than $25,000, with a median balance between $20,000 and $24,999. The report notes balances vary by education level and race/ethnicity, and discusses differences by institution type and repayment status.",
      sourceLabel: "Federal Reserve (May 2024/May 2025) – Higher Education & Student Loans (SHED)",
      sourceUrl:
        "https://www.federalreserve.gov/publications/2024-economic-well-being-of-us-households-in-2023-higher-education-student-loans.htm",
    },
  ];

  const postsHtml = posts
    .map(
      (p) => `
      <article class="feed-post">
        <div class="post-top">
          <span class="post-category">${p.category}</span>

          <div class="post-actions">
            <button type="button" class="post-action-btn" data-modal="author">About the author</button>
            <button type="button" class="post-action-btn" data-modal="org">About the organization</button>
          </div>
        </div>

        <div class="post-stat">${p.stat}</div>
        <div class="post-summary">${p.summary}</div>

        <div class="post-readmore">
          <span>Read more:</span>
          <a href="${p.sourceUrl}" target="_blank" rel="noopener noreferrer">
            ${p.sourceLabel}
          </a>
        </div>
      </article>
    `
    )
    .join("");

  pageContent.innerHTML = `
    <div class="feed-posts">
      ${postsHtml}
    </div>
  `;
}

function showSurvey() {
  surveyBtn.classList.add("active");
  feedBtn.classList.remove("active");

  document.body.style.background = "var(--sea-green)";

  pageContent.classList.remove("feed-page");
  pageContent.classList.add("survey-page");

  pageContent.innerHTML = `

    <form id="financeSurvey" class="survey-form">

      <p class="survey-intro">
        This short survey helps us understand how people feel about managing money and what would make a finance app more comfortable and motivating to use. There are no right or wrong answers.
      </p>

      <h2>Section 1: Comfort & Mindset</h2>

      <label>How comfortable do you feel managing your personal finances?</label>
      <div class="options">
        <label><input type="radio" name="comfort"> Very uncomfortable</label>
        <label><input type="radio" name="comfort"> Somewhat uncomfortable</label>
        <label><input type="radio" name="comfort"> Neutral</label>
        <label><input type="radio" name="comfort"> Somewhat comfortable</label>
        <label><input type="radio" name="comfort"> Very comfortable</label>
      </div>

      <label>Which emotions best describe how you feel when dealing with money? (Select all that apply)</label>
      <div class="options">
        <label><input type="checkbox"> Stress</label>
        <label><input type="checkbox"> Confusion</label>
        <label><input type="checkbox"> Guilt</label>
        <label><input type="checkbox"> Motivation</label>
        <label><input type="checkbox"> Confidence</label>
        <label><input type="checkbox"> Indifference</label>
        <label><input type="checkbox"> Other: <input type="text" class="inline-text"></label>
      </div>

      <label>What part of managing money feels most intimidating to you?</label>
      <div class="options">
        <label><input type="radio" name="intimidating"> Tracking spending</label>
        <label><input type="radio" name="intimidating"> Budgeting</label>
        <label><input type="radio" name="intimidating"> Saving</label>
        <label><input type="radio" name="intimidating"> Debt</label>
        <label><input type="radio" name="intimidating"> Investing</label>
        <label><input type="radio" name="intimidating"> I’m not sure where to start</label>
      </div>

      <h2>Section 2: Current Behavior</h2>

      <label>How do you currently track your finances (if at all)?</label>
      <div class="options">
        <label><input type="radio" name="tracking"> Mobile app</label>
        <label><input type="radio" name="tracking"> Spreadsheet</label>
        <label><input type="radio" name="tracking"> Notebook</label>
        <label><input type="radio" name="tracking"> Mental tracking</label>
        <label><input type="radio" name="tracking"> I don’t track my finances</label>
      </div>

      <label>How often do you check your financial accounts?</label>
      <div class="options">
        <label><input type="radio" name="frequency"> Daily</label>
        <label><input type="radio" name="frequency"> A few times a week</label>
        <label><input type="radio" name="frequency"> Weekly</label>
        <label><input type="radio" name="frequency"> Monthly</label>
        <label><input type="radio" name="frequency"> Only when necessary</label>
      </div>

      <label>What usually causes you to stop tracking your finances?</label>
      <div class="options">
        <label><input type="radio" name="stop"> Takes too much time</label>
        <label><input type="radio" name="stop"> Too confusing</label>
        <label><input type="radio" name="stop"> Makes me anxious</label>
        <label><input type="radio" name="stop"> I forget</label>
        <label><input type="radio" name="stop"> I don’t see the benefit</label>
        <label><input type="radio" name="stop"> I’ve never really tried</label>
      </div>

      <h2>Section 3: Motivation & Gamification</h2>

      <label>What helps you stay consistent with habits? (Select up to 2)</label>
      <div class="options">
        <label><input type="checkbox"> Seeing progress over time</label>
        <label><input type="checkbox"> Rewards or achievements</label>
        <label><input type="checkbox"> Streaks or challenges</label>
        <label><input type="checkbox"> Reminders or nudges</label>
        <label><input type="checkbox"> Competing with others</label>
        <label><input type="checkbox"> Accountability (self or app)</label>
      </div>

      <label>Which of these would make tracking finances feel more engaging?</label>
      <div class="options">
        <label><input type="radio" name="engaging"> Visual progress bars</label>
        <label><input type="radio" name="engaging"> Levels or experience points</label>
        <label><input type="radio" name="engaging"> Badges or achievements</label>
        <label><input type="radio" name="engaging"> Daily or weekly challenges</label>
        <label><input type="radio" name="engaging"> A story, theme, or avatar</label>
        <label><input type="radio" name="engaging"> None of these</label>
      </div>

      <label>How do you feel about competition in apps?</label>
      <div class="options">
        <label><input type="radio" name="competition"> I enjoy it</label>
        <label><input type="radio" name="competition"> I’m neutral</label>
        <label><input type="radio" name="competition"> I prefer to avoid it</label>
      </div>

      <h2>Section 4: Saving & Goals</h2>

      <label>Do you currently have a savings goal?</label>
      <div class="options">
        <label><input type="radio" name="goal"> Yes</label>
        <label><input type="radio" name="goal"> No</label>
        <label><input type="radio" name="goal"> I had one but stopped</label>
      </div>

      <label>What usually prevents you from saving consistently?</label>
      <div class="options">
        <label><input type="radio" name="prevent"> Unexpected expenses</label>
        <label><input type="radio" name="prevent"> Forgetting</label>
        <label><input type="radio" name="prevent"> Lack of motivation</label>
        <label><input type="radio" name="prevent"> Not knowing how much to save</label>
        <label><input type="radio" name="prevent"> My income feels too tight</label>
      </div>

      <label>Which would make saving easier for you?</label>
      <div class="options">
        <label><input type="radio" name="saving-easier"> Small automatic amounts</label>
        <label><input type="radio" name="saving-easier"> Visual progress toward a goal</label>
        <label><input type="radio" name="saving-easier"> Rewards for saving</label>
        <label><input type="radio" name="saving-easier"> Saving challenges</label>
        <label><input type="radio" name="saving-easier"> Clear guidance or suggestions</label>
      </div>

      <h2>Section 5: Feedback & Tone</h2>

      <label>If you overspend, how should an app respond?</label>
      <div class="options">
        <label><input type="radio" name="overspend"> Encouraging and supportive</label>
        <label><input type="radio" name="overspend"> Neutral and factual</label>
        <label><input type="radio" name="overspend"> With advice on what to do next</label>
        <label><input type="radio" name="overspend"> No notification</label>
      </div>

      <label>Which tone would you prefer in a finance app?</label>
      <div class="options">
        <label><input type="radio" name="tone"> Friendly</label>
        <label><input type="radio" name="tone"> Coach-like</label>
        <label><input type="radio" name="tone"> Professional</label>
        <label><input type="radio" name="tone"> Playful</label>
      </div>

      <label>How often would you want reminders or nudges?</label>
      <div class="options">
        <label><input type="radio" name="nudges"> Daily</label>
        <label><input type="radio" name="nudges"> Weekly</label>
        <label><input type="radio" name="nudges"> Only when something important happens</label>
        <label><input type="radio" name="nudges"> Never</label>
      </div>

      <h2>Section 6: Open-Ended</h2>

      <label>What frustrates you most about managing your money today?</label>
      <textarea></textarea>

      <label>If a finance app could do one thing perfectly for you, what would it be?</label>
      <textarea></textarea>

      <button type="submit" class="submit-btn">Submit</button>

    </form>
  `;
}



/* =========================
   Modal helpers (Feed posts)
========================= */
const infoModal = document.getElementById("infoModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalOkBtn = document.getElementById("modalOkBtn");

function openModal(titleText, bodyText) {
  if (!infoModal || !modalBody || !modalTitle) return;

  modalTitle.textContent = titleText;
  modalBody.textContent = bodyText;

  infoModal.classList.add("open");
  infoModal.setAttribute("aria-hidden", "false");

  // Focus for accessibility (best effort)
  if (modalOkBtn) modalOkBtn.focus();
}

function closeModal() {
  if (!infoModal) return;
  infoModal.classList.remove("open");
  infoModal.setAttribute("aria-hidden", "true");
}

function handleModalClick(e) {
  // Close if clicking the dark backdrop (not the modal itself)
  if (e.target === infoModal) closeModal();
}

if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
if (modalOkBtn) modalOkBtn.addEventListener("click", closeModal);
if (infoModal) infoModal.addEventListener("click", handleModalClick);

// Esc to close
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && infoModal && infoModal.classList.contains("open")) {
    closeModal();
  }
});

// Event delegation for dynamically-rendered posts
pageContent.addEventListener("click", (e) => {
  const btn = e.target.closest(".post-action-btn");
  if (!btn) return;

  const which = btn.dataset.modal;
  if (which === "author") {
    openModal("About the author", "info currently unaviable");
  } else if (which === "org") {
    openModal("About the organization", "yippeeeeee");
  }
});

feedBtn.addEventListener("click", showFeed);
surveyBtn.addEventListener("click", showSurvey);

// Optional: load feed by default on first load
showFeed();
