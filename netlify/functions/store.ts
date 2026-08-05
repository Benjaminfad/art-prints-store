import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config } from "@netlify/functions";

const catalogue = getStore({ name: "muse-prints-catalogue", consistency: "strong" });

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

const validStore = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const store = value as Record<string, unknown>;
  return typeof store.whatsappNumber === "string" &&
    typeof store.currency === "string" &&
    Array.isArray(store.printSizes) &&
    Array.isArray(store.artworks);
};

export default async (request: Request) => {
  if (request.method === "GET") {
    const saved = await catalogue.get("store", { type: "json" });
    if (saved) return json(saved);

    const fallback = await fetch(new URL("/data/store.json", request.url));
    if (!fallback.ok) return json({ error: "Catalogue unavailable" }, 503);
    return new Response(await fallback.text(), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  if (request.method !== "PUT") return json({ error: "Method not allowed" }, 405);
  if (!(await getUser())) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => null);
  if (!validStore(body)) return json({ error: "Invalid catalogue" }, 400);

  await catalogue.setJSON("store", body);
  return json({ saved: true });
};

export const config: Config = { path: "/api/store" };
