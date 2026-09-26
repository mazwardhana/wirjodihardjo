/**
 * YouTube URL validation and embed ID extraction.
 * Supports youtube.com/watch?v= and youtu.be/ patterns only.
 */

export function parseYouTubeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  // Pattern: youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // Pattern: youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  return null;
}

export function isValidYouTubeUrl(url: string | null | undefined): boolean {
  return parseYouTubeUrl(url) !== null;
}

export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  const videoId = parseYouTubeUrl(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}
