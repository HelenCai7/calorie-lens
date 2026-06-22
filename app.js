const foodLibrary = [
  { name: "米饭", kcalPer100g: 116, density: 0.78 },
  { name: "鸡胸肉", kcalPer100g: 165, density: 0.95 },
  { name: "煎蛋", kcalPer100g: 196, density: 0.82 },
  { name: "西兰花", kcalPer100g: 34, density: 0.36 },
  { name: "牛油果", kcalPer100g: 160, density: 0.64 },
  { name: "三文鱼", kcalPer100g: 208, density: 0.92 },
  { name: "面条", kcalPer100g: 138, density: 0.68 },
  { name: "土豆", kcalPer100g: 77, density: 0.72 },
  { name: "苹果", kcalPer100g: 52, density: 0.61 },
  { name: "自定义食物", kcalPer100g: 120, density: 0.7 }
];

const colors = ["#287a63", "#c46b2f", "#466ca6", "#bf4f5f", "#6d6a2e", "#6c58a8"];
const historyKey = "calorie-lens-history";

const state = {
  stream: null,
  hasPhoto: false,
  photoDataUrl: "",
  fistVolumeMl: 350,
  foods: [],
  history: loadHistory()
};

const els = {
  camera: document.querySelector("#camera"),
  photoPreview: document.querySelector("#photoPreview"),
  canvas: document.querySelector("#snapshotCanvas"),
  cameraBtn: document.querySelector("#cameraBtn"),
  captureBtn: document.querySelector("#captureBtn"),
  fileInput: document.querySelector("#fileInput"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  addFoodBtn: document.querySelector("#addFoodBtn"),
  saveMealBtn: document.querySelector("#saveMealBtn"),
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  overlayLayer: document.querySelector("#overlayLayer"),
  foodList: document.querySelector("#foodList"),
  template: document.querySelector("#foodItemTemplate"),
  totalCalories: document.querySelector("#totalCalories"),
  totalGrams: document.querySelector("#totalGrams"),
  confidence: document.querySelector("#confidence"),
  fistVolume: document.querySelector("#fistVolume"),
  fistVolumeLabel: document.querySelector("#fistVolumeLabel"),
  emptyState: document.querySelector("#emptyState"),
  historyList: document.querySelector("#historyList")
};

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(historyKey)) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(historyKey, JSON.stringify(state.history.slice(0, 8)));
}

function formatCalories(grams, kcalPer100g) {
  return Math.round((grams * kcalPer100g) / 100);
}

function foodByName(name) {
  return foodLibrary.find((food) => food.name === name) || foodLibrary[foodLibrary.length - 1];
}

function buildFoodEstimate(food, volumeShare, position) {
  const grams = Math.max(20, Math.round(state.fistVolumeMl * volumeShare * food.density));
  return {
    id: crypto.randomUUID(),
    name: food.name,
    kcalPer100g: food.kcalPer100g,
    grams,
    position
  };
}

function confidenceLabel(value) {
  if (value >= 0.72) return "较高";
  if (value >= 0.46) return "中等";
  return "较低";
}

function mockAnalyzePlate() {
  const picks = [foodLibrary[0], foodLibrary[1], foodLibrary[3]];
  const shares = [0.72, 0.58, 0.42];
  const positions = [
    { left: 18, top: 28 },
    { left: 48, top: 22 },
    { left: 34, top: 58 }
  ];

  state.foods = picks.map((food, index) => buildFoodEstimate(food, shares[index], positions[index]));
  els.confidence.textContent = "中等";
  render();
}

async function analyzePlate() {
  if (!state.photoDataUrl) {
    alert("请先拍照或上传照片。");
    return;
  }

  els.analyzeBtn.disabled = true;
  els.analyzeBtn.textContent = "识别中...";
  els.confidence.textContent = "识别中";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: state.photoDataUrl,
        fistVolumeMl: state.fistVolumeMl
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "图片识别失败。");
    }

    state.foods = result.foods.map((food) => ({
      id: crypto.randomUUID(),
      name: food.name,
      kcalPer100g: food.kcalPer100g,
      grams: food.grams,
      confidence: food.confidence,
      notes: food.notes,
      position: food.position
    }));

    els.confidence.textContent = confidenceLabel(result.overallConfidence);
    render();
  } catch (error) {
    mockAnalyzePlate();
    els.confidence.textContent = "模拟结果";
    alert(`${error.message}\n\n已先使用本地模拟结果。配置 OPENAI_API_KEY 后可以启用真实图片识别。`);
  } finally {
    els.analyzeBtn.disabled = !state.hasPhoto;
    els.analyzeBtn.textContent = "分析照片";
  }
}

function renderOverlay() {
  els.overlayLayer.innerHTML = "";
  state.foods.forEach((food, index) => {
    const tag = document.createElement("div");
    tag.className = "food-tag";
    tag.dataset.foodId = food.id;
    tag.style.left = `${food.position.left}%`;
    tag.style.top = `${food.position.top}%`;
    tag.style.color = colors[index % colors.length];
    tag.innerHTML = `
      <strong>${food.name}</strong>
      <span>${food.grams}g · ${formatCalories(food.grams, food.kcalPer100g)} kcal</span>
    `;
    tag.addEventListener("pointerdown", (event) => startTagDrag(event, food.id));
    els.overlayLayer.appendChild(tag);
  });
}

function startTagDrag(event, foodId) {
  const tag = event.currentTarget;
  const food = state.foods.find((item) => item.id === foodId);
  if (!food) return;

  tag.setPointerCapture(event.pointerId);
  tag.classList.add("is-dragging");

  const moveTag = (moveEvent) => {
    const layerRect = els.overlayLayer.getBoundingClientRect();
    const tagRect = tag.getBoundingClientRect();
    const left = ((moveEvent.clientX - layerRect.left - tagRect.width / 2) / layerRect.width) * 100;
    const top = ((moveEvent.clientY - layerRect.top - tagRect.height / 2) / layerRect.height) * 100;
    food.position.left = Math.min(88, Math.max(2, left));
    food.position.top = Math.min(88, Math.max(2, top));
    tag.style.left = `${food.position.left}%`;
    tag.style.top = `${food.position.top}%`;
  };

  const stopDrag = () => {
    tag.classList.remove("is-dragging");
    tag.removeEventListener("pointermove", moveTag);
    tag.removeEventListener("pointerup", stopDrag);
    tag.removeEventListener("pointercancel", stopDrag);
  };

  tag.addEventListener("pointermove", moveTag);
  tag.addEventListener("pointerup", stopDrag);
  tag.addEventListener("pointercancel", stopDrag);
}

function populateFoodSelect(select, currentName) {
  select.innerHTML = "";
  foodLibrary.forEach((food) => {
    const option = document.createElement("option");
    option.value = food.name;
    option.textContent = food.name;
    option.selected = food.name === currentName;
    select.appendChild(option);
  });
}

function renderFoodList() {
  els.foodList.innerHTML = "";

  if (!state.foods.length) {
    const empty = document.createElement("div");
    empty.className = "reference-card";
    empty.innerHTML = "<div><h2>还没有食物条目</h2><p>拍照后点击分析，或手动添加食物并输入重量。</p></div>";
    els.foodList.appendChild(empty);
    return;
  }

  state.foods.forEach((food, index) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    const marker = node.querySelector(".food-marker");
    const select = node.querySelector(".food-select");
    const gramsInput = node.querySelector(".grams-input");
    const kcalInput = node.querySelector(".kcal-input");
    const caloriesOutput = node.querySelector(".calories-output");
    const densityOutput = node.querySelector(".density-output");
    const deleteBtn = node.querySelector(".delete-food");

    marker.style.background = colors[index % colors.length];
    populateFoodSelect(select, food.name);
    gramsInput.value = food.grams;
    kcalInput.value = food.kcalPer100g;
    caloriesOutput.textContent = `${formatCalories(food.grams, food.kcalPer100g)} kcal`;
    densityOutput.textContent = `${food.kcalPer100g} kcal/100g`;

    select.addEventListener("change", () => {
      const selected = foodByName(select.value);
      food.name = selected.name;
      food.kcalPer100g = selected.kcalPer100g;
      render();
    });

    kcalInput.addEventListener("input", () => {
      food.kcalPer100g = Math.max(1, Number(kcalInput.value) || 1);
      renderTotals();
      renderOverlay();
      caloriesOutput.textContent = `${formatCalories(food.grams, food.kcalPer100g)} kcal`;
      densityOutput.textContent = `${food.kcalPer100g} kcal/100g`;
    });

    gramsInput.addEventListener("input", () => {
      food.grams = Math.max(1, Number(gramsInput.value) || 1);
      renderTotals();
      renderOverlay();
      caloriesOutput.textContent = `${formatCalories(food.grams, food.kcalPer100g)} kcal`;
    });

    deleteBtn.addEventListener("click", () => {
      state.foods = state.foods.filter((item) => item.id !== food.id);
      render();
    });

    els.foodList.appendChild(node);
  });
}

function renderTotals() {
  const totalGrams = state.foods.reduce((sum, food) => sum + Number(food.grams), 0);
  const totalCalories = state.foods.reduce(
    (sum, food) => sum + formatCalories(food.grams, food.kcalPer100g),
    0
  );

  els.totalCalories.textContent = `${totalCalories} kcal`;
  els.totalGrams.textContent = `${Math.round(totalGrams)} g`;
  els.saveMealBtn.disabled = !state.foods.length;
  if (!state.hasPhoto && !state.foods.length) {
    els.confidence.textContent = "等待照片";
  }
}

function render() {
  renderTotals();
  renderOverlay();
  renderFoodList();
  renderHistory();
}

function renderHistory() {
  els.historyList.innerHTML = "";

  if (!state.history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "保存后会显示最近的用餐记录。";
    els.historyList.appendChild(empty);
    return;
  }

  state.history.forEach((meal) => {
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <div>
        <strong>${meal.totalCalories} kcal</strong>
        <span>${meal.totalGrams}g · ${meal.foods.length} 项</span>
      </div>
      <time>${meal.time}</time>
    `;
    els.historyList.appendChild(item);
  });
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("当前浏览器不支持直接调用相机，请使用上传照片。");
    return;
  }

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }

  state.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
  });

  els.camera.srcObject = state.stream;
  els.camera.style.display = "block";
  els.photoPreview.style.display = "none";
  els.captureBtn.disabled = false;
  els.emptyState.style.display = "none";
}

function setPhoto(src) {
  state.hasPhoto = true;
  state.photoDataUrl = src;
  els.photoPreview.src = src;
  els.photoPreview.style.display = "block";
  els.camera.style.display = "none";
  els.analyzeBtn.disabled = false;
  els.emptyState.style.display = "none";
}

function capturePhoto() {
  const video = els.camera;
  const canvas = els.canvas;
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(video, 0, 0, width, height);
  setPhoto(canvas.toDataURL("image/jpeg", 0.92));
}

function addManualFood() {
  const food = foodLibrary[foodLibrary.length - 1];
  const count = state.foods.length;
  state.foods.push({
    id: crypto.randomUUID(),
    name: food.name,
    kcalPer100g: food.kcalPer100g,
    grams: 100,
    position: { left: 18 + ((count * 16) % 52), top: 24 + ((count * 13) % 46) }
  });
  els.confidence.textContent = state.hasPhoto ? "手动校准" : "手动输入";
  render();
}

function saveMeal() {
  if (!state.foods.length) return;

  const totalGrams = state.foods.reduce((sum, food) => sum + Number(food.grams), 0);
  const totalCalories = state.foods.reduce(
    (sum, food) => sum + formatCalories(food.grams, food.kcalPer100g),
    0
  );

  state.history.unshift({
    id: crypto.randomUUID(),
    time: new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date()),
    totalCalories,
    totalGrams: Math.round(totalGrams),
    foods: state.foods.map((food) => ({
      name: food.name,
      grams: food.grams,
      kcalPer100g: food.kcalPer100g
    }))
  });

  saveHistory();
  els.confidence.textContent = "已保存";
  render();
}

function resetApp() {
  state.foods = [];
  state.hasPhoto = false;
  state.photoDataUrl = "";
  els.photoPreview.removeAttribute("src");
  els.photoPreview.style.display = "none";
  els.analyzeBtn.disabled = true;
  els.emptyState.style.display = "flex";
  els.confidence.textContent = "等待照片";
  render();
}

els.cameraBtn.addEventListener("click", () => {
  startCamera().catch(() => {
    alert("无法打开相机。请检查浏览器权限，或改用上传照片。");
  });
});

els.captureBtn.addEventListener("click", capturePhoto);

els.fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => setPhoto(String(reader.result || "")));
  reader.readAsDataURL(file);
});

els.analyzeBtn.addEventListener("click", analyzePlate);
els.addFoodBtn.addEventListener("click", addManualFood);
els.saveMealBtn.addEventListener("click", saveMeal);
els.clearHistoryBtn.addEventListener("click", () => {
  state.history = [];
  saveHistory();
  renderHistory();
});
els.resetBtn.addEventListener("click", resetApp);

els.fistVolume.addEventListener("input", () => {
  const previous = state.fistVolumeMl;
  state.fistVolumeMl = Number(els.fistVolume.value);
  els.fistVolumeLabel.textContent = `${state.fistVolumeMl} ml`;

  if (state.foods.length && previous) {
    const ratio = state.fistVolumeMl / previous;
    state.foods = state.foods.map((food) => ({
      ...food,
      grams: Math.max(1, Math.round(food.grams * ratio))
    }));
    els.confidence.textContent = "已校准";
    render();
  }
});

render();
