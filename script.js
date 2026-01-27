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
      category: "Mindset & Stress",
      stat: "48% of Gen Z say they do not feel financially secure",
      summary:
        "Nearly half of Gen Z report feeling financially insecure — a big signal that finance tools need to reduce anxiety and increase clarity.",
      sourceLabel: "Deloitte 2025 Gen Z & Millennial Survey",
      sourceUrl: "https://www.deloitte.com/global/en/issues/work/genz-millennial-survey.html",
    },
    {
      category: "Mindset & Stress (Canada)",
      stat: "64% of Gen Z Canadians experience financial stress multiple times a week",
      summary:
        "For many young Canadians, money stress is not occasional — it’s recurring. Tone and UX matter: supportive beats shaming.",
      sourceLabel: "TD Newsroom (Oct 2025)",
      sourceUrl:
        "https://stories.td.com/ca/en/news/2025-10-14-more-than-half-of-gen-z-canadians-feel-pressured-to-27fake-27-f",
    },
    {
      category: "Savings & Emergencies",
      stat: "63% of adults would cover a $400 emergency expense using cash (or equivalent)",
      summary:
        "A meaningful chunk of people still can’t handle small emergencies without credit or borrowing — which often creates spiraling stress.",
      sourceLabel: "Federal Reserve (SHED data viz / Economic Well-Being)",
      sourceUrl:
        "https://www.federalreserve.gov/consumerscommunities/sheddataviz/unexpectedexpenses.html",
    },
    {
      category: "Savings (Gen Z)",
      stat: "34% of Gen Z report having zero emergency savings (2025)",
      summary:
        "One in three Gen Zers having no emergency fund suggests ‘small wins’ and habit-building features can be more useful than complex budgeting.",
      sourceLabel: "Bankrate (Aug 2025)",
      sourceUrl: "https://www.bankrate.com/banking/americans-without-emergency-savings/",
    },
    {
      category: "Debt (Student Loans)",
      stat: "Median student debt in 2024 was between $20,000 and $24,999 (for borrowers with their own education debt)",
      summary:
        "Student debt is common and often mid-sized rather than massive — which makes repayment planning and ‘next best action’ guidance powerful.",
      sourceLabel: "Federal Reserve: Economic Well-Being (2024 report section)",
      sourceUrl:
        "https://www.federalreserve.gov/publications/2025-economic-well-being-of-us-households-in-2024-higher-education-and-student-loans.htm",
    },
  ];

  const postsHtml = posts
    .map(
      (p) => `
      <article class="feed-post">
        <div class="post-top">
          <span class="post-category">${p.category}</span>
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
    <h1>Feed</h1>
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
    <h1>Survey</h1>

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

      <button type="submit" class="submit-btn">Submit Survey</button>

    </form>
  `;
}

feedBtn.addEventListener("click", showFeed);
surveyBtn.addEventListener("click", showSurvey);
