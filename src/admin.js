import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  updateUser,
} from "@netlify/identity";

const app = document.querySelector("#admin-app");
let store = null;
let currentUser = null;
let busy = false;

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const uid = () => `artwork-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function notice(message, error = false) {
  const old = document.querySelector(".notice");
  if (old) old.remove();
  const node = document.createElement("div");
  node.className = `notice${error ? " error" : ""}`;
  node.textContent = message;
  document.querySelector(".intro")?.after(node);
  setTimeout(() => node.remove(), 5000);
}

function authScreen(mode = "login", token = "") {
  const invited = mode === "invite";
  const recovering = mode === "recovery";
  const settingPassword = invited || recovering;
  const heading = invited ? "Set your owner password." : recovering ? "Choose a new password." : "Owner dashboard.";
  const description = invited
    ? "Create a password to accept your private dashboard invitation."
    : recovering
      ? "Enter the new password you want to use for your owner account."
      : "Sign in with the email invited from your Netlify project.";
  const action = invited ? "Accept invitation" : recovering ? "Save new password" : "Sign in";

  app.innerHTML = `<section class="auth-wrap"><div class="auth-card"><div class="brand">Uncleluwa</div><h1>${heading}</h1><p>${description}</p><form class="auth-form">${settingPassword ? "" : '<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>'}<div class="field"><label for="password">${settingPassword ? "New password" : "Password"}</label><input id="password" name="password" type="password" autocomplete="${settingPassword ? "new-password" : "current-password"}" minlength="8" required></div><button class="button" type="submit">${action}</button>${settingPassword ? "" : '<button class="button secondary" id="forgot-password" type="button">Forgot password?</button>'}<p id="auth-error" role="alert"></p></form></div></section>`;
  app.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector("button");
    const error = document.querySelector("#auth-error");
    button.disabled = true;
    error.textContent = "";
    try {
      if (invited) currentUser = await acceptInvite(token, form.get("password"));
      else if (recovering) currentUser = await updateUser({ password: form.get("password") });
      else currentUser = await login(form.get("email"), form.get("password"));
      history.replaceState(null, "", "/admin/");
      await openDashboard();
    } catch (cause) {
      error.textContent = cause?.message || "Could not sign in.";
      button.disabled = false;
    }
  });

  if (!settingPassword) {
    app.querySelector("#forgot-password").addEventListener("click", async () => {
      const email = app.querySelector("#email");
      const error = app.querySelector("#auth-error");
      if (!email.reportValidity()) return;
      error.textContent = "Sending password reset email…";
      try {
        await requestPasswordRecovery(email.value.trim());
        error.textContent = "Check your email for the password reset link.";
      } catch (cause) {
        error.textContent = cause?.message || "Could not send the password reset email.";
      }
    });
  }
}

function sizeRow(size = { label: "", dimensions: "", price: null }) {
  const row = document.createElement("div");
  row.className = "size-row";
  row.innerHTML = `<div class="field"><span>Label</span><input data-key="label" value="${escapeHtml(size.label)}" required></div><div class="field"><span>Dimensions</span><input data-key="dimensions" value="${escapeHtml(size.dimensions)}" required></div><div class="field"><span>Price</span><input data-key="price" type="number" min="0" step="1" value="${size.price ?? ""}" placeholder="Quote"></div><button class="button danger remove" type="button">Remove</button>`;
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  return row;
}

function artCard(artwork = {}) {
  const inheritedSizes = Array.isArray(artwork.printSizes)
    ? artwork.printSizes
    : artwork.id && Array.isArray(store?.printSizes)
      ? store.printSizes
      : [];
  const art = {
    id: uid(),
    title: "",
    story: "",
    originalSize: "",
    image: "",
    palette: "linear-gradient(145deg,#173f4f,#61aab1,#ed6847)",
    accent: "#d6ff45",
    active: true,
    ...artwork,
    printSizes: inheritedSizes.length ? inheritedSizes : [{ label: "", dimensions: "", price: null }],
  };
  const card = document.createElement("article");
  card.className = "art-card";
  card.dataset.id = art.id;
  card.innerHTML = `<div><div class="art-preview">${art.image ? `<img src="${escapeHtml(art.image)}" alt="">` : "No image yet"}</div><div class="upload-row"><input class="image-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><button class="button secondary upload" type="button">Upload</button></div></div><div class="art-fields"><div class="field"><span>Title</span><input data-key="title" value="${escapeHtml(art.title)}"></div><div class="field"><span>Original size</span><input data-key="originalSize" value="${escapeHtml(art.originalSize)}"></div><div class="field full"><span>Description</span><textarea data-key="story">${escapeHtml(art.story)}</textarea></div><div class="field"><span>Placeholder background</span><input data-key="palette" value="${escapeHtml(art.palette)}"></div><div class="field"><span>Accent colour</span><input data-key="accent" type="color" value="${escapeHtml(art.accent || "#d6ff45")}"></div><div class="art-sizes"><div class="art-sizes-head"><div><h3>Print sizes & prices</h3><p>These options apply only to this artwork.</p></div><button class="button secondary add-art-size" type="button">Add size</button></div><div class="list art-size-list"></div></div><input data-key="image" type="hidden" value="${escapeHtml(art.image)}"><label class="toggle"><input data-key="active" type="checkbox" ${art.active !== false ? "checked" : ""}> Show in shop</label><button class="button danger remove-art" type="button">Remove artwork</button></div>`;
  const sizeList = card.querySelector(".art-size-list");
  art.printSizes.forEach((size) => sizeList.append(sizeRow(size)));
  card.querySelector(".add-art-size").addEventListener("click", () => sizeList.append(sizeRow()));
  card.querySelector(".remove-art").addEventListener("click", () => card.remove());
  card.querySelector(".upload").addEventListener("click", () => uploadImage(card));
  return card;
}

async function uploadImage(card) {
  const input = card.querySelector(".image-file");
  const button = card.querySelector(".upload");
  if (!input.files[0]) return notice("Choose an image first.", true);
  const form = new FormData();
  form.append("file", input.files[0]);
  button.disabled = true;
  button.textContent = "Uploading…";
  try {
    const response = await fetch("/api/images", { method: "POST", body: form, credentials: "include" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Upload failed");
    card.querySelector('[data-key="image"]').value = result.url;
    card.querySelector(".art-preview").innerHTML = `<img src="${escapeHtml(result.url)}" alt="">`;
    notice("Image uploaded. Save changes to publish it on the artwork.");
  } catch (cause) {
    notice(cause.message || "Image upload failed.", true);
  } finally {
    button.disabled = false;
    button.textContent = "Upload";
  }
}

function renderDashboard() {
  app.innerHTML = `<div class="shell"><header class="topbar"><div class="brand">Uncleluwa</div><div class="top-actions"><span class="user">${escapeHtml(currentUser?.email || "Store owner")}</span><a class="button secondary" href="/" target="_blank">View shop</a><button class="button secondary" id="logout" type="button">Sign out</button></div></header><section class="intro"><h1>Store<br>dashboard.</h1><p>Update your contact details, artwork-specific pricing and collection. Saved changes appear on the public shop immediately.</p></section><section class="panel"><div class="panel-head"><h2>Store settings</h2></div><div class="grid"><div class="field"><label for="whatsapp">WhatsApp number</label><input id="whatsapp" inputmode="numeric" value="${escapeHtml(store.whatsappNumber)}"><span class="hint">International format without + or spaces.</span></div><div class="field"><label for="currency">Currency symbol</label><input id="currency" value="${escapeHtml(store.currency)}" maxlength="4"><span class="hint">International currency.</span></div></div></section><section class="panel"><div class="panel-head"><div><h2>Artworks</h2><p class="panel-note">Set unique print sizes and prices inside each artwork.</p></div><button class="button secondary" id="add-art" type="button">Add artwork</button></div><div class="list" id="artworks"></div></section><div class="savebar"><p>Review your changes, then publish them to the shop.</p><button class="button" id="save" type="button">Save & publish</button></div></div>`;
  const artworks = document.querySelector("#artworks");
  store.artworks.forEach((art) => artworks.append(artCard(art)));
  document.querySelector("#add-art").addEventListener("click", () => artworks.append(artCard()));
  document.querySelector("#save").addEventListener("click", saveStore);
  document.querySelector("#logout").addEventListener("click", async () => { await logout(); authScreen(); });
}

function collectStore() {
  return {
    whatsappNumber: document.querySelector("#whatsapp").value.trim().replace(/\D/g, ""),
    currency: document.querySelector("#currency").value.trim() || "₦",
    artworks: [...document.querySelectorAll(".art-card")].map((card) => ({
      id: card.dataset.id,
      title: card.querySelector('[data-key="title"]').value.trim(),
      story: card.querySelector('[data-key="story"]').value.trim(),
      originalSize: card.querySelector('[data-key="originalSize"]').value.trim(),
      image: card.querySelector('[data-key="image"]').value,
      palette: card.querySelector('[data-key="palette"]').value,
      accent: card.querySelector('[data-key="accent"]').value,
      active: card.querySelector('[data-key="active"]').checked,
      printSizes: [...card.querySelectorAll(".size-row")].map((row) => ({
        label: row.querySelector('[data-key="label"]').value.trim(),
        dimensions: row.querySelector('[data-key="dimensions"]').value.trim(),
        price: row.querySelector('[data-key="price"]').value === "" ? null : Number(row.querySelector('[data-key="price"]').value),
      })),
    })),
  };
}

async function saveStore() {
  if (busy) return;
  const button = document.querySelector("#save");
  busy = true;
  button.disabled = true;
  button.textContent = "Publishing…";
  try {
    const next = collectStore();
    if (!next.artworks.length) throw new Error("Keep at least one artwork.");
    if (next.artworks.some((artwork) => !artwork.printSizes.length)) throw new Error("Every artwork needs at least one print size.");
    if (next.artworks.some((artwork) => artwork.printSizes.some((size) => !size.label || !size.dimensions))) throw new Error("Every print size needs a label and dimensions.");
    const response = await fetch("/api/store", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(next) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save changes");
    store = next;
    notice("Your storefront is updated.");
  } catch (cause) {
    notice(cause.message || "Could not save changes.", true);
  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = "Save & publish";
  }
}

async function openDashboard() {
  const response = await fetch("/api/store", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load store data");
  store = await response.json();
  renderDashboard();
}

async function start() {
  try {
    const callback = await handleAuthCallback();
    if (callback?.type === "invite") return authScreen("invite", callback.token);
    if (callback?.type === "recovery") {
      currentUser = callback.user;
      return authScreen("recovery");
    }
    currentUser = callback?.user || await getUser();
    if (!currentUser) return authScreen();
    await openDashboard();
  } catch (cause) {
    authScreen();
    const error = document.querySelector("#auth-error");
    if (error) error.textContent = cause?.message || "Could not open the dashboard.";
  }
}

start();
