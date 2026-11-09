import { Readable } from "node:stream";
import type { RequestHandler } from "express";

type AttachmentRow = {
  b2_url: string;
  filename: string;
  original_name: string | null;
  mime_type: string | null;
};

const configuration = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Attachment download configuration is incomplete");
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), supabaseAnonKey };
};

const trustedHosts = () => [process.env.B2_PUBLIC_URL, process.env.VITE_B2_PUBLIC_URL, process.env.B2_ENDPOINT]
  .filter((value): value is string => Boolean(value))
  .flatMap((value) => {
    try {
      return [new URL(value).hostname];
    } catch {
      return [];
    }
  });

const safeFilename = (value: string) => value
  .split(/[\\/]/)
  .pop()!
  .replace(/[\r\n";]/g, "_") || "attachment";

export const downloadAttachment: RequestHandler = async (request, response) => {
  const attachmentId = request.params.attachmentId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attachmentId)) {
    response.status(400).json({ error: "Invalid attachment" });
    return;
  }

  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    response.status(401).json({ error: "Authentication is required" });
    return;
  }

  try {
    const { supabaseUrl, supabaseAnonKey } = configuration();
    const authHeaders = { apikey: supabaseAnonKey, Authorization: authorization };
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(10_000),
    });
    if (!userResponse.ok) {
      response.status(401).json({ error: "Your sign-in session has expired" });
      return;
    }

    const query = new URLSearchParams({
      id: `eq.${attachmentId}`,
      select: "b2_url,filename,original_name,mime_type",
      limit: "1",
    });
    const attachmentResponse = await fetch(`${supabaseUrl}/rest/v1/attachments?${query}`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(10_000),
    });
    if (!attachmentResponse.ok) {
      response.status(404).json({ error: "Attachment not found" });
      return;
    }
    const attachments = await attachmentResponse.json() as AttachmentRow[];
    const attachment = attachments[0];
    if (!attachment) {
      response.status(404).json({ error: "Attachment not found" });
      return;
    }

    const fileUrl = new URL(attachment.b2_url);
    const allowedHosts = trustedHosts();
    if (fileUrl.protocol !== "https:" || !(allowedHosts.includes(fileUrl.hostname) || fileUrl.hostname.endsWith(".backblazeb2.com"))) {
      response.status(400).json({ error: "Attachment URL is not trusted" });
      return;
    }

    const fileResponse = await fetch(fileUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    if (!fileResponse.ok || !fileResponse.body) {
      response.status(502).json({ error: "Attachment could not be downloaded" });
      return;
    }

    const filename = safeFilename(attachment.original_name || attachment.filename);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", attachment.mime_type || "application/octet-stream");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    const contentLength = fileResponse.headers.get("content-length");
    if (contentLength) response.setHeader("Content-Length", contentLength);
    Readable.fromWeb(fileResponse.body as import("node:stream/web").ReadableStream).pipe(response);
  } catch {
    if (!response.headersSent) response.status(502).json({ error: "Attachment could not be downloaded" });
    else response.destroy();
  }
};
