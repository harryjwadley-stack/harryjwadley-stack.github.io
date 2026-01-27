const feedBtn = document.getElementById("feedBtn");
const surveyBtn = document.getElementById("surveyBtn");
const pageContent = document.getElementById("pageContent");

function showFeed() {
  feedBtn.classList.add("active");
  surveyBtn.classList.remove("active");

  document.body.style.background = "var(--royal-blue)";

  pageContent.innerHTML = `
    <h1>Feed</h1>
  `;
}

function showSurvey() {
  surveyBtn.classList.add("active");
  feedBtn.classList.remove("active");

  document.body.style.background = "var(--sea-green)";

  pageContent.innerHTML = `
    <h1>Survey</h1>
  `;
}

feedBtn.addEventListener("click", showFeed);
surveyBtn.addEventListener("click", showSurvey);
