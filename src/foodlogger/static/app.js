"use strict";

const $ = (id) => document.getElementById(id);
const state = { foods: [], photoUrl: null, predictionVersion: 0, journalVersion: 0, toastTimer: null, saving: false, predicting: false };
const format = (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Please check your entry and try again.");
  }
  return response.status === 204 ? null : response.json();
}

function toast(message, error = false) {
  clearTimeout(state.toastTimer);
  $("toast").textContent = message;
  $("toast").className = error ? "toast error" : "toast";
  $("toast").hidden = false;
  state.toastTimer = setTimeout(() => { $("toast").hidden = true; }, 5000);
}

function predictionMessage(message, kind = "") {
  $("prediction-message").textContent = message;
  $("prediction-message").className = `prediction-message ${kind}`;
  $("prediction-message").hidden = !message;
}

function updateEstimate() {
  const food = state.foods.find((item) => item.id === $("food-select").value);
  const grams = Number($("grams").value);
  if (!food || !Number.isFinite(grams) || grams < 1 || grams > 2000) {
    $("portion-estimate").textContent = food ? "Enter a portion between 1 and 2,000 grams." : "Choose a food to see your portion estimate.";
    return;
  }
  $("portion-estimate").textContent = `${format(food.calories * grams / 100)} kcal · ${format(food.protein * grams / 100)} g protein · ${format(food.carbs * grams / 100)} g carbs · ${format(food.fat * grams / 100)} g fat`;
}

function selectFood(foodId) {
  $("food-select").value = foodId;
  document.querySelectorAll(".candidate").forEach((button) => button.classList.toggle("selected", button.dataset.foodId === foodId));
  updateEstimate();
}

function updateBusyState() {
  const busy = state.saving || state.predicting;
  $("food-photo").disabled = busy;
  $("drop-zone").classList.toggle("busy", busy);
  $("meal-form").querySelectorAll("input, select, button").forEach((control) => { control.disabled = busy; });
}

async function analyzePhoto(file) {
  if (!file || state.saving || state.predicting) return;
  const version = ++state.predictionVersion;
  $("candidates").replaceChildren();
  selectFood("");
  if (file.size > 8 * 1024 * 1024) {
    predictionMessage("This image is too large. Choose one under 8 MiB.", "error");
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    predictionMessage("Choose a JPEG, PNG or WebP photo.", "error");
    return;
  }
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  state.photoUrl = URL.createObjectURL(file);
  $("preview-image").src = state.photoUrl;
  $("upload-prompt").hidden = true;
  $("image-preview").hidden = false;
  state.predicting = true;
  updateBusyState();
  predictionMessage("Looking at your food… The first prediction may take a minute to load the model.");
  const body = new FormData();
  body.append("file", file);
  try {
    const result = await request("/api/predict", { method: "POST", body });
    if (version !== state.predictionVersion) return;
    const recognized = result.status === "recognized";
    predictionMessage(recognized ? "A possible match. Confirm the food and enter its weight before saving." : (result.unmapped_label ? `The model suggested “${result.unmapped_label.replaceAll("_", " ")}”, which has no nutrition entry. Choose a catalog food manually.` : "No confident match. Choose a food manually, or try a clearer photo of one food."), recognized ? "" : "warning");
    for (const candidate of result.candidates) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "candidate";
      button.dataset.foodId = candidate.food_id;
      button.textContent = `${candidate.emoji} ${candidate.name} · ${format(candidate.score * 100)}%`;
      button.title = "Model score; not a measured accuracy or calibrated probability";
      button.addEventListener("click", () => selectFood(candidate.food_id));
      $("candidates").append(button);
    }
    if (recognized && result.candidates.length) selectFood(result.candidates[0].food_id);
  } catch (error) {
    if (version === state.predictionVersion) predictionMessage(error.message, "error");
  } finally {
    if (version === state.predictionVersion) {
      state.predicting = false;
      updateBusyState();
    }
  }
}

function renderMeal(meal) {
  const row = document.createElement("article");
  row.className = "meal-entry";
  const emoji = document.createElement("span");
  emoji.className = "meal-emoji";
  emoji.setAttribute("aria-hidden", "true");
  emoji.textContent = meal.emoji;
  const details = document.createElement("div");
  details.className = "meal-main";
  const title = document.createElement("h3");
  title.textContent = meal.name;
  const subtitle = document.createElement("p");
  subtitle.textContent = `${meal.meal_type} · ${format(meal.grams)} g`;
  const macros = document.createElement("small");
  macros.textContent = `P ${format(meal.protein)} g · C ${format(meal.carbs)} g · F ${format(meal.fat)} g`;
  details.append(title, subtitle, macros);
  const energy = document.createElement("div");
  energy.className = "meal-energy";
  const amount = document.createElement("strong");
  amount.textContent = format(meal.calories);
  const unit = document.createElement("span");
  unit.textContent = "kcal";
  energy.append(amount, unit);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-meal";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `Delete ${meal.name}`);
  remove.addEventListener("click", async () => {
    remove.disabled = true;
    try {
      await request(`/api/meals/${encodeURIComponent(meal.id)}`, { method: "DELETE" });
      toast("Meal removed from your journal.");
      await loadJournal();
    } catch (error) { toast(error.message, true); remove.disabled = false; }
  });
  row.append(emoji, details, energy, remove);
  return row;
}

async function loadJournal() {
  const day = $("journal-date").value;
  const version = ++state.journalVersion;
  if (!day || !$("journal-date").checkValidity()) {
    $("journal-entries").replaceChildren();
    $("empty-journal").hidden = true;
    $("meal-count").textContent = "—";
    $("journal-day-label").textContent = "Select a date";
    $("export-button").removeAttribute("href");
    $("export-button").setAttribute("aria-disabled", "true");
    for (const key of ["calories", "protein", "carbs", "fat"]) $("total-" + key).textContent = "—";
    $("journal-error").textContent = "Choose a valid journal date to see your meals.";
    $("journal-error").hidden = false;
    return;
  }
  $("journal-error").hidden = true;
  $("export-button").removeAttribute("aria-disabled");
  $("export-button").href = `/api/export?day=${encodeURIComponent(day)}`;
  try {
    const data = await request(`/api/meals?day=${encodeURIComponent(day)}`);
    if (version !== state.journalVersion) return;
    $("journal-entries").replaceChildren(...data.meals.map(renderMeal));
    $("empty-journal").hidden = data.meals.length > 0;
    $("meal-count").textContent = data.summary.count;
    for (const key of ["calories", "protein", "carbs", "fat"]) $("total-" + key).textContent = format(data.summary[key]);
    $("journal-day-label").textContent = day === today() ? "Today" : new Date(day + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch (error) {
    if (version !== state.journalVersion) return;
    $("journal-entries").replaceChildren();
    $("empty-journal").hidden = true;
    $("meal-count").textContent = "—";
    for (const key of ["calories", "protein", "carbs", "fat"]) $("total-" + key).textContent = "—";
    $("journal-error").textContent = `Could not load this day. ${error.message}`;
    $("journal-error").hidden = false;
  }
}

$("meal-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.saving || state.predicting) return;
  if (!$("meal-form").reportValidity() || !$("journal-date").reportValidity()) return;
  const meal = { food_id: $("food-select").value, grams: Number($("grams").value), meal_type: $("meal-type").value, day: $("journal-date").value };
  state.saving = true;
  updateBusyState();
  try {
    await request("/api/meals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meal) });
    toast(`Meal added to your journal for ${meal.day}.`);
    selectFood("");
    $("grams").value = 100;
    $("candidates").replaceChildren();
    predictionMessage("");
    $("food-photo").value = "";
    $("upload-prompt").hidden = false;
    $("image-preview").hidden = true;
    if (state.photoUrl) { URL.revokeObjectURL(state.photoUrl); state.photoUrl = null; }
    await loadJournal();
  } catch (error) { toast(error.message, true); }
  finally { state.saving = false; updateBusyState(); }
});

$("food-photo").addEventListener("change", (event) => analyzePhoto(event.target.files[0]));
$("food-select").addEventListener("change", () => selectFood($("food-select").value));
$("grams").addEventListener("input", updateEstimate);
$("journal-date").addEventListener("change", loadJournal);
for (const event of ["dragenter", "dragover"]) $("drop-zone").addEventListener(event, (e) => { e.preventDefault(); $("drop-zone").classList.add("dragging"); });
for (const event of ["dragleave", "drop"]) $("drop-zone").addEventListener(event, (e) => { e.preventDefault(); $("drop-zone").classList.remove("dragging"); });
$("drop-zone").addEventListener("drop", (e) => { if (!$("food-photo").disabled) analyzePhoto(e.dataTransfer.files[0]); });
for (const id of ["about-button", "model-info-button"]) $(id).addEventListener("click", () => $("about-dialog").showModal());
$("close-dialog").addEventListener("click", () => $("about-dialog").close());
$("about-dialog").addEventListener("click", (e) => { if (e.target === $("about-dialog")) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });

async function initialize() {
  $("journal-date").value = today();
  try {
    const data = await request("/api/foods");
    state.foods = data.foods;
    for (const category of [...new Set(data.foods.map((food) => food.category))]) {
      const group = document.createElement("optgroup");
      group.label = category;
      for (const food of data.foods.filter((item) => item.category === category)) {
        const option = document.createElement("option");
        option.value = food.id;
        option.textContent = `${food.emoji} ${food.name}`;
        group.append(option);
      }
      $("food-select").append(group);
    }
  } catch (error) { predictionMessage(`Could not load foods. Refresh to retry. ${error.message}`, "error"); }
  await loadJournal();
}
initialize();
