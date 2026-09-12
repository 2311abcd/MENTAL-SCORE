const API_URL = "https://mental-score-2-o3k2.onrender.com/predict";

const form = document.getElementById("predict-form");
const submitBtn = document.getElementById("submit-btn");
const apiErrorBox = document.getElementById("api-error");

const states = {
  idle: document.getElementById("state-idle"),
  loading: document.getElementById("state-loading"),
  error: document.getElementById("state-error"),
  done: document.getElementById("state-done"),
};

const errorMessageEl = document.getElementById("error-message");
const retryBtn = document.getElementById("retry-btn");
const resetBtn = document.getElementById("reset-btn");

const gaugeFill = document.getElementById("gauge-fill");
const gaugeValue = document.getElementById("gauge-value");
const resultLabel = document.getElementById("result-label");
const resultCopy = document.getElementById("result-copy");

// Field constraints mirrored from the StudentData Pydantic model
const FIELD_RULES = {
  age: { type: "number", min: 10, max: 100, message: "Enter an age between 10 and 100." },
  gender: { type: "select", message: "Choose a gender." },
  country: { type: "text", message: "Enter a country." },
  academic_Level: { type: "select", message: "Choose an academic level." },
  most_Used_Platform: { type: "select", message: "Choose a platform." },
  purpose_Of_Use: { type: "select", message: "Choose a purpose." },
  avg_Daily_Usage_Hours: { type: "number", min: 0, max: 24, message: "Enter a value between 0 and 24." },
  daily_Unlocks: { type: "number", min: 0, message: "Enter a value of 0 or more." },
  study_Hours: { type: "number", min: 0, max: 24, message: "Enter a value between 0 and 24." },
  physical_Activity_Hours: { type: "number", min: 0, max: 24, message: "Enter a value between 0 and 24." },
  sleep_Hours_Per_Night: { type: "number", min: 0, max: 24, message: "Enter a value between 0 and 24." },
  stress_Level: { type: "select", message: "Choose a stress level." },
};

const GAUGE_CIRCUMFERENCE = 251.2;

function setState(name) {
  Object.entries(states).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

function clearFieldError(name) {
  const field = document.getElementById(name).closest(".field");
  const errorEl = document.getElementById(`err-${name}`);
  field.classList.remove("has-error");
  errorEl.textContent = "";
}

function setFieldError(name, message) {
  const field = document.getElementById(name).closest(".field");
  const errorEl = document.getElementById(`err-${name}`);
  field.classList.add("has-error");
  errorEl.textContent = message;
}

function validateForm(formData) {
  let firstInvalid = null;
  let isValid = true;

  for (const [name, rule] of Object.entries(FIELD_RULES)) {
    clearFieldError(name);
    const raw = formData.get(name);

    const isEmpty = raw === null || raw === "" || raw === undefined;
    let hasError = false;

    if (isEmpty) {
      hasError = true;
    } else if (rule.type === "number") {
      const num = Number(raw);
      if (Number.isNaN(num)) hasError = true;
      if (!hasError && rule.min !== undefined && num < rule.min) hasError = true;
      if (!hasError && rule.max !== undefined && num > rule.max) hasError = true;
    }

    if (hasError) {
      setFieldError(name, rule.message);
      isValid = false;
      if (!firstInvalid) firstInvalid = document.getElementById(name);
    }
  }

  if (firstInvalid) firstInvalid.focus();
  return isValid;
}

function buildPayload(formData) {
  return {
    age: Number(formData.get("age")),
    gender: formData.get("gender"),
    country: formData.get("country").trim(),
    academic_Level: formData.get("academic_Level"),
    most_Used_Platform: formData.get("most_Used_Platform"),
    purpose_Of_Use: formData.get("purpose_Of_Use"),
    avg_Daily_Usage_Hours: Number(formData.get("avg_Daily_Usage_Hours")),
    daily_Unlocks: Number(formData.get("daily_Unlocks")),
    study_Hours: Number(formData.get("study_Hours")),
    physical_Activity_Hours: Number(formData.get("physical_Activity_Hours")),
    sleep_Hours_Per_Night: Number(formData.get("sleep_Hours_Per_Night")),
    stress_Level: formData.get("stress_Level"),
  };
}

function interpretScore(score) {
  // Assumes a 0–10 mental health score scale, typical of this dataset.
  // Higher score = better reported wellbeing.
  if (score >= 7.5) {
    return {
      label: "Looking steady",
      copy: "Your responses suggest a generally healthy balance right now.",
      color: "var(--accent)",
    };
  }
  if (score >= 5) {
    return {
      label: "Worth keeping an eye on",
      copy: "A few habits — sleep, activity, or screen time — may be worth adjusting.",
      color: "#6E7A56",
    };
  }
  return {
    label: "Some strain showing",
    copy: "These patterns often line up with higher stress. Consider talking to someone you trust.",
    color: "var(--concern)",
  };
}

function animateGauge(score) {
  const gaugeMax = score > 10 ? 100 : 10;
  const clamped = Math.max(0, Math.min(score, gaugeMax));
  const fraction = clamped / gaugeMax;
  const offset = GAUGE_CIRCUMFERENCE * (1 - fraction);

  const { label, copy, color } = interpretScore((score / gaugeMax) * 10);

  gaugeFill.style.stroke = color;
  gaugeValue.textContent = score.toFixed(2);
  resultLabel.textContent = label;
  resultCopy.textContent = copy;

  // Reset then animate on next frame so the transition always plays
  gaugeFill.style.strokeDashoffset = GAUGE_CIRCUMFERENCE;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gaugeFill.style.strokeDashoffset = offset;
    });
  });
}

async function submitPrediction(payload) {
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    throw new Error(
      "Can't reach the API. Make sure the FastAPI server is running at http://127.0.0.1:8000."
    );
  }

  if (!response.ok) {
    if (response.status === 422) {
      let detail = "The server rejected one or more fields.";
      try {
        const body = await response.json();
        if (Array.isArray(body.detail) && body.detail.length) {
          detail = body.detail
            .map((d) => `${d.loc?.[d.loc.length - 1] ?? "field"}: ${d.msg}`)
            .join(" · ");
        }
      } catch (_) {
        /* fall back to default message */
      }
      throw new Error(detail);
    }
    throw new Error(`The server returned an error (status ${response.status}).`);
  }

  return response.json();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  apiErrorBox.hidden = true;

  const formData = new FormData(form);
  if (!validateForm(formData)) return;

  const payload = buildPayload(formData);

  submitBtn.disabled = true;
  submitBtn.classList.add("is-loading");
  setState("loading");

  try {
    const result = await submitPrediction(payload);
    animateGauge(result.predicted_mental_health_score);
    setState("done");
  } catch (err) {
    if (errorMessageEl) {
      errorMessageEl.textContent = err.message || "Something went wrong. Please try again.";
    }
    setState("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("is-loading");
  }
});

retryBtn.addEventListener("click", () => {
  form.requestSubmit();
});

// ---------------------------------------------
// Animated starfield background
// ---------------------------------------------
(function initStarfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width, height, stars, dpr;

  function makeStars() {
    const density = 0.00012; // stars per pixel
    const count = Math.round(width * height * density);
    stars = new Array(count).fill(0).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.3 + 0.3,
      baseAlpha: Math.random() * 0.6 + 0.25,
      twinkleSpeed: Math.random() * 0.015 + 0.005,
      twinklePhase: Math.random() * Math.PI * 2,
      driftSpeed: Math.random() * 0.06 + 0.02,
    }));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeStars();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, width, height);
    stars.forEach((s) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(230,235,255,${s.baseAlpha})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  let t = 0;
  function drawFrame() {
    t += 1;
    ctx.clearRect(0, 0, width, height);
    stars.forEach((s) => {
      // slow downward-diagonal drift, wrapping around the viewport
      s.y += s.driftSpeed;
      s.x += s.driftSpeed * 0.25;
      if (s.y > height + 2) s.y = -2;
      if (s.x > width + 2) s.x = -2;

      const twinkle = Math.sin(t * s.twinkleSpeed + s.twinklePhase) * 0.35;
      const alpha = Math.max(0, Math.min(1, s.baseAlpha + twinkle));

      ctx.beginPath();
      ctx.fillStyle = `rgba(230,235,255,${alpha})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(drawFrame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (prefersReducedMotion) {
    drawStatic();
  } else {
    requestAnimationFrame(drawFrame);
  }
})();

resetBtn.addEventListener("click", () => {
  form.reset();
  Object.keys(FIELD_RULES).forEach(clearFieldError);
  apiErrorBox.hidden = true;
  gaugeFill.style.strokeDashoffset = GAUGE_CIRCUMFERENCE;
  gaugeValue.textContent = "0.0";
  resultLabel.textContent = "—";
  resultCopy.textContent = "";
  setState("idle");
  form.querySelector("input, select")?.focus();
});
