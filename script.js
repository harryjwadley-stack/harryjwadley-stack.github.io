const feedBtn = document.getElementById("feedBtn");
const surveyBtn = document.getElementById("surveyBtn");
const pageContent = document.getElementById("pageContent");

function showFeed() {
  feedBtn.classList.add("active");
  surveyBtn.classList.remove("active");

  pageContent.classList.remove("survey-page");
  pageContent.classList.add("feed-page");

  pageContent.innerHTML = `
    <h1>Feed Page</h1>
    <p>This is the green feed page.</p>
  `;
}

function showSurvey() {
  surveyBtn.classList.add("active");
  feedBtn.classList.remove("active");

  pageContent.classList.remove("feed-page");
  pageContent.classList.add("survey-page");

  pageContent.innerHTML = `
    <h1>Survey Page</h1>
    <p>This is the blue survey page.</p>
  `;
}

feedBtn.addEventListener("click", showFeed);
surveyBtn.addEventListener("click", showSurvey);
