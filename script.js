const API_BASE_URL = "https://mindsense-ml-3.onrender.com";

const form = document.getElementById("predict-form");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");

const resultPlaceholder = document.getElementById("result-placeholder");
const resultCard = document.getElementById("result-card");
const scoreValueEl = document.getElementById("score-value");
const scoreMeterEl = document.getElementById("score-meter");
const scoreNoteEl = document.getElementById("score-note");
const resetBtn = document.getElementById("reset-btn");

const NUMERIC_FIELDS = new Set([
  "age",
  "avg_daily_usage_hours",
  "daily_unlocks",
  "study_hours",
  "physical_activity_hours",
  "sleep_hours_per_night",
]);

const INTEGER_FIELDS = new Set(["age", "daily_unlocks"]);

function clearFieldErrors() {
  document.querySelectorAll(".error").forEach((el) => (el.textContent = ""));
  formError.textContent = "";
}

function showFieldError(fieldName, message) {
  const target = document.querySelector(`[data-error-for="${fieldName}"]`);
  if (target) {
    target.textContent = message;
  } else {
    formError.textContent = message;
  }
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("loading", isLoading);
}

function buildPayload(formData) {
  const payload = {};
  for (const [key, rawValue] of formData.entries()) {
    if (NUMERIC_FIELDS.has(key)) {
      const num = INTEGER_FIELDS.has(key) ? parseInt(rawValue, 10) : parseFloat(rawValue);
      payload[key] = Number.isNaN(num) ? rawValue : num;
    } else {
      payload[key] = rawValue.trim();
    }
  }
  return payload;
}

function fieldNameFromLoc(loc) {
  // FastAPI/Pydantic error "loc" looks like ["body", "age"]
  if (Array.isArray(loc) && loc.length) {
    return loc[loc.length - 1];
  }
  return null;
}

function describeScore(score) {
  if (score >= 7.5) {
    return "This is on the higher end of the scale the model produces, based on the habits and rhythm you entered.";
  }
  if (score >= 5) {
    return "This sits in the middle of the scale the model produces — a mix of stronger and weaker signals in your inputs.";
  }
  return "This is on the lower end of the scale the model produces, based on the habits and rhythm you entered.";
}

function showResult(score) {
  resultPlaceholder.hidden = true;
  resultCard.hidden = false;

  scoreValueEl.textContent = score.toFixed(2).replace(/\.00$/, ".0");
  scoreNoteEl.textContent = describeScore(score);

  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  scoreMeterEl.style.width = "0%";
  requestAnimationFrame(() => {
    scoreMeterEl.style.width = `${pct}%`;
  });
}

function resetResult() {
  resultCard.hidden = true;
  resultPlaceholder.hidden = false;
}

async function handleSubmit(event) {
  event.preventDefault();
  clearFieldErrors();

  if (!form.reportValidity()) {
    return;
  }

  const payload = buildPayload(new FormData(form));
  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 422) {
      const body = await response.json();
      const details = Array.isArray(body.detail) ? body.detail : [];
      if (details.length) {
        details.forEach((d) => {
          const field = fieldNameFromLoc(d.loc);
          showFieldError(field, d.msg || "This value isn't valid.");
        });
      } else {
        formError.textContent = "Some of the details you entered aren't valid. Please check the form.";
      }
      return;
    }

    if (!response.ok) {
      let message = `The server returned an error (status ${response.status}).`;
      try {
        const body = await response.json();
        if (body && body.detail) message = String(body.detail);
      } catch (_) {
        /* response body wasn't JSON — keep the default message */
      }
      formError.textContent = message;
      return;
    }

    const data = await response.json();
    if (typeof data.predicted_mental_health_score !== "number") {
      formError.textContent = "The server responded, but didn't include a score. Please try again.";
      return;
    }

    showResult(data.predicted_mental_health_score);
  } catch (err) {
    formError.textContent =
      "Couldn't reach the MindSense API. Make sure the backend is running at " + API_BASE_URL + " and try again.";
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", handleSubmit);
resetBtn.addEventListener("click", () => {
  resetResult();
});
