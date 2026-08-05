import { getDeployStore, getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

const validSize = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const size = value as Record<string, unknown>;
  return typeof size.label === "string" && size.label.trim().length > 0 &&
    typeof size.dimensions === "string" && size.dimensions.trim().length > 0 &&
    (size.price === null || (typeof size.price === "number" && Number.isFinite(size.price) && size.price >= 0));
};

const validArtwork = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const artwork = value as Record<string, unknown>;
  return typeof artwork.id === "string" &&
    typeof artwork.title === "string" &&
    Array.isArray(artwork.printSizes) &&
    artwork.printSizes.length > 0 &&
    artwork.printSizes.every(validSize);
};

const validStore = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const store = value as Record<string, unknown>;
  return typeof store.whatsappNumber === "string" &&
    typeof store.currency === "string" &&
    Array.isArray(store.artworks) &&
    store.artworks.length > 0 &&
    store.artworks.every(validArtwork);
};

const normalizeStore = (value: unknown) => {
  if (!value || typeof value !== "object") return value;
  const store = value as Record<string, unknown>;
  const legacySizes = Array.isArray(store.printSizes) ? store.printSizes : [];
  if (!Array.isArray(store.artworks)) return store;

  return {
    ...store,
    artworks: store.artworks.map((value) => {
      if (!value || typeof value !== "object") return value;
      const artwork = value as Record<string, unknown>;
      const ownSizes = Array.isArray(artwork.printSizes) ? artwork.printSizes : [];
      return {
        ...artwork,
        printSizes: ownSizes.length ? ownSizes : legacySizes.map((size) => ({ ...(size as Record<string, unknown>) })),
      };
    }),
  };
};

const catalogueFor = (context: Context) => context.deploy.context === "production"
  ? getStore({ name: "muse-prints-catalogue", consistency: "strong" })
  : getDeployStore({ name: "muse-prints-catalogue", consistency: "strong" });

export default async (request: Request, context: Context) => {
  const catalogue = catalogueFor(context);
  if (request.method === "GET") {
    const saved = await catalogue.get("store", { type: "json" });
    if (saved) return json(normalizeStore(saved));

    const fallback = await fetch(new URL("/data/store.json", request.url));
    if (!fallback.ok) return json({ error: "Catalogue unavailable" }, 503);
    return json(normalizeStore(await fallback.json()));
  }

  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  if (!(await getUser())) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => null);
  if (!validStore(body)) return json({ error: "Invalid catalogue" }, 400);

  await catalogue.setJSON("store", body);
  return json({ saved: true });
};

export const config: Config = { path: "/api/store" };
