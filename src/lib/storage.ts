/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * MinIO Object Storage Client & Media Upload Service
 * Supports direct multipart upload, public unsigned CDN URLs, and presigned signed URLs.
 */

import { getApiBase, getToken } from "./auth";

export interface StorageUploadResult {
  bucket: string;
  object_name: string;
  public_url: string;
  signed_url?: string;
  content_type: string;
  size: number;
}

export interface PresignedUploadResponse {
  upload_url: string;
  object_name: string;
  public_url: string;
  expires_seconds: number;
}

/**
 * Uploads an image or file asset directly to the MinIO cluster.
 * Validates file size (max 10MB) and sends multipart form data with the user's auth token.
 */
export async function uploadMedia(
  file: File,
  prefix: string = "avatars",
): Promise<StorageUploadResult> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required to upload media.");
  }

  // 10MB limit guard
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File exceeds 10MB limit. Please choose a smaller image.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("prefix", prefix);

  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/storage/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    let errMessage = "Failed to upload media file.";
    try {
      const errData = await res.json();
      if (errData.detail) errMessage = errData.detail;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  const json = await res.json();
  return json.data as StorageUploadResult;
}

/**
 * Requests a presigned PUT URL for direct browser-to-MinIO uploads.
 */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string = "image/jpeg",
  prefix: string = "avatars",
): Promise<PresignedUploadResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required.");
  }

  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/storage/presigned-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename,
      content_type: contentType,
      prefix,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to get presigned upload URL.");
  }

  const json = await res.json();
  return json.data as PresignedUploadResponse;
}

/**
 * Direct browser PUT upload using a presigned URL.
 */
export async function uploadDirectToPresigned(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!res.ok) {
    throw new Error("Direct upload to MinIO failed.");
  }
}

/**
 * Generates a signed GET URL with expiration for secure private files.
 */
export async function getPresignedDownloadUrl(
  objectName: string,
  expiresMinutes: number = 60,
): Promise<string> {
  const token = getToken();
  const apiBase = getApiBase();
  const res = await fetch(
    `${apiBase}/storage/presigned-url?object_name=${encodeURIComponent(
      objectName,
    )}&expires_minutes=${expiresMinutes}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!res.ok) {
    throw new Error("Failed to obtain signed URL.");
  }

  const json = await res.json();
  return json.data.signed_url;
}
