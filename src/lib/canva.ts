export function canvaEmbedUrl(input?: string): string | null {
  if (!input) return null;

  // Canva embed typically works as:
  //   https://www.canva.com/design/<DESIGN_ID>/view?embed
  // We normalize share links like /edit, /view, etc. to that embed URL.
  try {
    const u = new URL(input);

    // If it's not Canva, allow an iframe attempt anyway.
    if (!u.hostname.includes("canva.com")) return input;

    const parts = u.pathname.split("/").filter(Boolean);
    const designIdx = parts.indexOf("design");
    if (designIdx >= 0 && parts[designIdx + 1]) {
      const designId = parts[designIdx + 1];
      const maybeToken = parts[designIdx + 2];

      // Canva share links often include a second path segment token:
      //   /design/<DESIGN_ID>/<TOKEN>/view
      // Preserve it, otherwise embeds can show "no permission" even if the link is open.
      if (maybeToken && maybeToken !== "view" && maybeToken !== "edit") {
        return `https://www.canva.com/design/${designId}/${maybeToken}/view?embed`;
      }

      return `https://www.canva.com/design/${designId}/view?embed`;
    }

    // Fallback: keep URL but add embed hint.
    u.searchParams.set("embed", "");
    return u.toString();
  } catch {
    return input || null;
  }
}

export async function tryCanvaOembed(input?: string): Promise<
  | { title?: string; thumbnail_url?: string; html?: string }
  | null
> {
  if (!input) return null;
  try {
    // Canva has historically supported an oEmbed endpoint at /_oembed.
    // This is best-effort; if CORS blocks, we silently fall back.
    const oembedUrl = `https://www.canva.com/_oembed?url=${encodeURIComponent(input)}`;
    const res = await fetch(oembedUrl, { method: "GET" });
    if (!res.ok) return null;
    return (await res.json()) as any;
  } catch {
    return null;
  }
}
