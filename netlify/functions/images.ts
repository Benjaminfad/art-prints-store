import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const images = getStore({ name: "muse-prints-images", consistency: "strong" });
const json = (value: unknown, status = 200) => Response.json(value, { status });

export default async (request: Request, context: Context) => {
  const key = context.params.key;

  if (request.method === "GET" && key) {
    const [data, metadata] = await Promise.all([
      images.get(key, { type: "arrayBuffer" }),
      images.getMetadata(key),
    ]);
    if (!data) return new Response("Not found", { status: 404 });
    return new Response(data, {
      headers: {
        "Content-Type": String(metadata?.metadata?.contentType || "application/octet-stream"),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const user = await getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  if (request.method === "POST") {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return json({ error: "Choose a valid image" }, 400);
    }
    if (file.size > 5 * 1024 * 1024) return json({ error: "Image must be 5 MB or smaller" }, 413);

    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
    const imageKey = `${crypto.randomUUID()}.${extension}`;
    await images.set(imageKey, await file.arrayBuffer(), {
      metadata: { contentType: file.type, uploadedAt: new Date().toISOString() },
    });
    return json({ url: `/api/images/${encodeURIComponent(imageKey)}` }, 201);
  }

  if (request.method === "DELETE" && key) {
    await images.delete(key);
    return json({ deleted: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: ["/api/images", "/api/images/:key"],
};
