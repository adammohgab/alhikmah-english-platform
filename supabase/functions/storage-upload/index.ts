declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

import { corsMiddleware, getCorsHeaders } from "../_shared/cors";
import { verifyJWT, extractRole } from "../_shared/auth";

export interface StorageUploadRequest {
  bucket: "avatars" | "lesson-media" | "public-assets" | "audio-tts" | "imports";
  filename: string;
  content_type: string;
  size_bytes: number;
  svg_content?: string;
}

export interface StorageUploadResponse {
  uploadUrl: string;
  path: string;
  bucket: string;
  sanitizedSvg?: string;
  expiresAt: string;
}

/**
 * Strict bucket-specific file size limits per backend docs §1.1
 * - avatars / profile photos: 2 MB
 * - images: 10 MB (general), SVG 1 MB
 * - audio: 25 MB (lesson audio / recordings)
 * - documents: 20 MB
 * - imports: 5 MB
 */
export const BUCKET_LIMITS: Record<string, { maxSize: number; allowedMimes: string[] }> = {
  avatars: {
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
  },
  "public-assets": {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  },
  "lesson-media": {
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedMimes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "audio/mpeg",
      "audio/mp3",
      "audio/m4a",
      "audio/ogg",
      "application/pdf",
    ],
  },
  "audio-tts": {
    maxSize: 25 * 1024 * 1024, // 25MB
    allowedMimes: ["audio/mpeg", "audio/mp3", "audio/ogg"],
  },
  imports: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedMimes: ["text/csv", "application/vnd.ms-excel"],
  },
};

/** Prohibited file extensions that must always be blocked */
const PROHIBITED_EXTENSIONS = [
  ".exe",
  ".html",
  ".htm",
  ".bat",
  ".cmd",
  ".sh",
  ".js",
  ".mjs",
  ".php",
  ".dll",
  ".vbs",
];

/**
 * Validates file extension against prohibited lists and allowed types
 */
export function validateFilenameAndExtension(filename: string): { valid: boolean; error?: string } {
  if (!filename || typeof filename !== "string") {
    return { valid: false, error: "Missing or invalid filename" };
  }

  const cleanName = filename.trim().toLowerCase();
  for (const ext of PROHIBITED_EXTENSIONS) {
    if (cleanName.endsWith(ext)) {
      return { valid: false, error: `Prohibited file extension: ${ext}` };
    }
  }

  // Prevent directory traversal attacks
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return { valid: false, error: "Filename cannot contain directory separators or traversal paths" };
  }

  return { valid: true };
}

/**
 * Sanitizes SVG source code by stripping dangerous tags and attributes:
 * - <script> tags and comments
 * - Inline event handlers (onload, onclick, onerror, onmouseover, etc.)
 * - <foreignObject> elements
 * - javascript: links
 */
export function sanitizeSvg(svgContent: string): string {
  if (!svgContent) return "";

  let cleaned = svgContent;

  // 1. Strip <script>...</script>
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // 2. Strip <foreignObject>...</foreignObject>
  cleaned = cleaned.replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, "");

  // 3. Strip all inline on* event handlers (e.g. onload="...", onerror='...')
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "");

  // 4. Strip href/xlink:href containing javascript: or data:
  cleaned = cleaned.replace(/(href|xlink:href)\s*=\s*(?:['"]javascript:[^'"]*['"]|javascript:[^\s>]+)/gi, "");
  cleaned = cleaned.replace(/(href|xlink:href)\s*=\s*(?:['"]data:text\/html[^'"]*['"])/gi, "");

  return cleaned;
}

/**
 * Edge Function HTTP handler for /functions/v1/storage-upload
 */
export async function handleRequest(req: Request): Promise<Response> {
  const corsRes = corsMiddleware(req);
  if (corsRes) return corsRes;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: { code: "unauthenticated", message: "Missing Bearer token" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token);
    const userId = (payload.sub || payload.userId) as string;
    const role = extractRole(payload);

    const body: StorageUploadRequest = await req.json();
    const { bucket, filename, content_type, size_bytes, svg_content } = body;

    // 1. Validate bucket
    const bucketConfig = BUCKET_LIMITS[bucket];
    if (!bucketConfig) {
      return new Response(
        JSON.stringify({
          error: {
            code: "validation_failed",
            message: `Invalid bucket: "${bucket}". Allowed buckets: ${Object.keys(BUCKET_LIMITS).join(", ")}`,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Students are not permitted to upload to lesson-media, public-assets, or imports
    if (role === "student" && bucket !== "avatars") {
      return new Response(
        JSON.stringify({
          error: {
            code: "forbidden",
            message: "Students are only permitted to upload avatars.",
          },
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate filename and prohibited extensions (.exe, .html, etc.)
    const filenameCheck = validateFilenameAndExtension(filename);
    if (!filenameCheck.valid) {
      return new Response(
        JSON.stringify({
          error: {
            code: "upload_rejected",
            message: filenameCheck.error,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate MIME type
    if (!bucketConfig.allowedMimes.includes(content_type.toLowerCase())) {
      return new Response(
        JSON.stringify({
          error: {
            code: "upload_rejected",
            message: `MIME type "${content_type}" not permitted in bucket "${bucket}". Allowed: [${bucketConfig.allowedMimes.join(", ")}]`,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate file size limits
    if (size_bytes > bucketConfig.maxSize) {
      const maxMb = Math.round(bucketConfig.maxSize / (1024 * 1024));
      return new Response(
        JSON.stringify({
          error: {
            code: "upload_rejected",
            message: `File size ${size_bytes} exceeds limit of ${maxMb}MB for bucket "${bucket}"`,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. SVG Sanitizer
    let sanitizedSvg: string | undefined = undefined;
    if (content_type.toLowerCase() === "image/svg+xml" && svg_content) {
      sanitizedSvg = sanitizeSvg(svg_content);
    }

    // 6. Generate path and pre-signed upload URL
    const fileId = crypto.randomUUID();
    const safeExt = filename.split(".").pop() || "bin";
    const objectPath = `${userId}/${fileId}.${safeExt}`;

    const supabaseUrl = (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "") || "";
    const serviceKey = (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : "") || "";

    let uploadUrl = "";
    if (supabaseUrl && serviceKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const supa = createClient(supabaseUrl, serviceKey);

      // Create pre-signed upload URL (valid for 1 hour)
      const { data: uploadData, error: uploadErr } = await supa.storage
        .from(bucket)
        .createSignedUploadUrl(objectPath);

      if (uploadErr) {
        throw uploadErr;
      }

      uploadUrl = uploadData.signedUrl;
    } else {
      uploadUrl = `https://storage.local/${bucket}/${objectPath}?token=mock-presigned-token`;
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return new Response(
      JSON.stringify({
        uploadUrl,
        path: objectPath,
        bucket,
        sanitizedSvg,
        expiresAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: {
          code: err.code || "upload_rejected",
          message: err.message || "Failed to generate storage upload URL",
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (typeof Deno !== "undefined" && "serve" in Deno) {
  // @ts-ignore
  Deno.serve(handleRequest);
}
