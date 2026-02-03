export function canvaEmbedUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("canva.com")) return url; // still allow iframe attempt

    // Canva embed usually works with /design/<id>/view?embed or /design/<id>/view?embed&... 
    // Normalize any /design/<id>/... to /design/<id>/view?embed
    const parts = u.pathname.split("/").filter(Boolean);
    const designIdx = parts.indexOf("design");
    if (designIdx >= 0 && parts[designIdx + 1]) {
      const designId = parts[designIdx + 1];
      return `https://www.canva.com/design/${designId}/view?embed`;
    }

    // fallback: just add embed query
    u.searchParams.set("embed", "");
    return u.toString();
  } catch {
    return url || null;
  }
}
