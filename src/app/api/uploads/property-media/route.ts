import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 16 * 1024 * 1024;
const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png"];
const VIDEO_CONTENT_TYPES = ["video/mp4", "video/3gpp"];

const deleteSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(20),
});

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
}

function isManagedBlobUrl(value: string) {
  try {
    return new URL(value).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const token = blobToken();
    if (!token) return jsonError("BLOB_NOT_CONFIGURED", "Blob storage is not configured.", 503);

    const body = (await request.json()) as HandleUploadBody;
    if (body.type === "blob.generate-client-token") {
      const session = await requireSession();
      requireRole(session, ["ADMIN"]);
    }

    const result = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let kind: "image" | "video" | undefined;
        let scope: "project" | "property" | undefined;
        try {
          const parsed = JSON.parse(clientPayload || "{}") as { kind?: unknown; scope?: unknown };
          if (parsed.kind === "image" || parsed.kind === "video") kind = parsed.kind;
          if (parsed.scope === "project" || parsed.scope === "property") scope = parsed.scope;
        } catch {
          kind = undefined;
          scope = undefined;
        }

        const expectedPrefix = scope === "project" && kind === "image"
          ? "projects/images/"
          : scope === "property" && kind === "image"
            ? "properties/images/"
            : scope === "property" && kind === "video"
              ? "properties/videos/"
              : "";
        if (!expectedPrefix || !pathname.startsWith(expectedPrefix) || !/^(properties\/(images|videos)|projects\/images)\/[a-zA-Z0-9._-]+$/.test(pathname)) {
          throw new Error("INVALID_PROPERTY_MEDIA_PATH");
        }

        return {
          addRandomSuffix: false,
          allowedContentTypes: kind === "image" ? IMAGE_CONTENT_TYPES : VIDEO_CONTENT_TYPES,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
          maximumSizeInBytes: kind === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES,
        };
      },
    });

    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    const token = blobToken();
    if (!token) return jsonError("BLOB_NOT_CONFIGURED", "Blob storage is not configured.", 503);

    const { urls } = deleteSchema.parse(await request.json());
    const managedUrls = urls.filter(isManagedBlobUrl);
    if (managedUrls.length) await del(managedUrls, { token });

    return jsonOk({ deleted: managedUrls.length });
  } catch (error) {
    return handleApiError(error);
  }
}
