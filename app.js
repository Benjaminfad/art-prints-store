const grid = document.querySelector("#product-grid");
const year = document.querySelector("#year");

year.textContent = new Date().getFullYear();

const money = (currency, value) => `${currency}${Number(value).toLocaleString("en-NG")}`;

function orderLink(store, artwork, size) {
  const price = size.price ? money(store.currency, size.price) : "Please send me a quote";
  const message = [
    "Hi! I would like to order an art print.",
    `Artwork: ${artwork.title}`,
    `Print size: ${size.label} (${size.dimensions})`,
    `Price: ${price}`,
    "Please confirm availability and delivery cost. Thank you!",
  ].join("\n");

  return `https://wa.me/${store.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function artworkVisual(artwork, number) {
  if (artwork.image) {
    const image = document.createElement("img");
    image.src = artwork.image;
    image.alt = artwork.title;
    image.loading = "lazy";
    image.decoding = "async";
    return image;
  }

  const placeholder = document.createElement("div");
  placeholder.className = "artwork-placeholder";
  placeholder.style.background = artwork.palette;
  placeholder.innerHTML = `<span>${String(number).padStart(2, "0")}</span><i style="background:${artwork.accent}"></i>`;
  placeholder.setAttribute("role", "img");
  placeholder.setAttribute("aria-label", `Artwork placeholder for ${artwork.title}`);
  return placeholder;
}

function productCard(store, artwork, number) {
  const card = document.createElement("article");
  card.className = "product-card";

  const artFrame = document.createElement("div");
  artFrame.className = "art-frame";
  const art = document.createElement("div");
  art.className = "artwork";
  art.append(artworkVisual(artwork, number));
  artFrame.append(art);

  const originalSize = document.createElement("p");
  originalSize.textContent = artwork.originalSize;
  artFrame.append(originalSize);

  const copy = document.createElement("div");
  copy.className = "product-copy";
  copy.innerHTML = `<p class="eyebrow">Fine art reproduction</p><h3></h3><p class="story"></p>`;
  copy.querySelector("h3").textContent = artwork.title;
  copy.querySelector(".story").textContent = artwork.story;

  const picker = document.createElement("div");
  picker.className = "size-picker";
  picker.setAttribute("aria-label", `Choose a size for ${artwork.title}`);

  const selection = document.createElement("div");
  selection.className = "selection";
  const dimensions = document.createElement("span");
  const price = document.createElement("strong");
  selection.append(dimensions, price);

  const order = document.createElement("a");
  order.className = "order-button";
  order.target = "_blank";
  order.rel = "noreferrer";

  function selectSize(index) {
    const size = store.printSizes[index];
    picker.querySelectorAll("button").forEach((button, buttonIndex) => {
      button.classList.toggle("active", buttonIndex === index);
      button.setAttribute("aria-pressed", String(buttonIndex === index));
    });
    dimensions.textContent = size.dimensions;
    price.textContent = size.price ? money(store.currency, size.price) : "Get a quote";
    if (store.whatsappNumber) {
      order.href = orderLink(store, artwork, size);
      order.removeAttribute("aria-disabled");
      order.innerHTML = "Order on WhatsApp <span>↗</span>";
    } else {
      order.removeAttribute("href");
      order.setAttribute("aria-disabled", "true");
      order.textContent = "WhatsApp number not set";
    }
  }

  store.printSizes.forEach((size, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = size.label;
    button.addEventListener("click", () => selectSize(index));
    picker.append(button);
  });

  copy.append(picker, selection, order);
  card.append(artFrame, copy);
  selectSize(0);
  return card;
}

async function loadStore() {
  try {
    let response = await fetch("/api/store", { cache: "no-store" });
    if (!response.ok) response = await fetch("/data/store.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load store data");
    const store = await response.json();
    grid.replaceChildren(...store.artworks.filter((artwork) => artwork.active !== false).map((artwork, index) => productCard(store, artwork, index + 1)));
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<p class="load-error">The collection could not be loaded. Please refresh the page.</p>';
  }
}

loadStore();
