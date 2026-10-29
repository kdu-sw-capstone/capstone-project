// Confirmation only: send the original input and keep Server validation authoritative.
// Preserve subdomains; a matching response/readback must not confirm a different site.
export function submittedSiteHost(input: string): string | null {
  try {
    const value = input.trim();
    const url = new URL(value.includes("://") ? value : "https://" + value);
    return url.hostname.toLowerCase().replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}
