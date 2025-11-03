/**
 * Utility functions for finding unsubscribe links in emails
 */

/**
 * Extract unsubscribe URL from email body HTML
 * Looks for links with "unsubscribe" or "un-subscribe" in:
 * - The link URL itself
 * - The link text
 * - Text immediately adjacent to the link
 */
export function findUnsubscribeLinkInBody(htmlBody: string): string | null {
  if (!htmlBody) {
    console.log(`[Unsubscribe Debug] No email body provided`);
    return null;
  }

  console.log(`[Unsubscribe Debug] Parsing email body (${htmlBody.length} chars)`);
  console.log(`[Unsubscribe Debug] Body sample: ${htmlBody.substring(0, 200)}...`);

  // Pattern 1: Find all <a> tags with href attributes (more flexible regex)
  // This handles: <a href="...">, <a class="..." href="...">, etc.
  const anchorRegex = /<a\s+[^>]*?href=["']([^"']+)["'][^>]*?>(.*?)<\/a>/gis;
  const matches = [...htmlBody.matchAll(anchorRegex)];

  console.log(`[Unsubscribe Debug] Found ${matches.length} anchor tags in email body`);

  for (const match of matches) {
    const href = match[1];
    const linkText = match[2] || "";

    // Strip HTML tags and decode entities from link text
    const cleanLinkText = linkText
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    console.log(`[Unsubscribe Debug] Checking link: href="${href.substring(0, 50)}...", text="${cleanLinkText}"`);

    // Check if "unsubscribe" appears in URL
    if (/unsubscribe|un-subscribe|unsub/i.test(href)) {
      console.log(`[Unsubscribe Debug] ✓ Found unsubscribe in URL`);
      return cleanUrl(href);
    }

    // Check if "unsubscribe" appears in link text
    if (/unsubscribe|un-subscribe|unsub/i.test(cleanLinkText)) {
      console.log(`[Unsubscribe Debug] ✓ Found unsubscribe in link text: "${cleanLinkText}"`);
      return cleanUrl(href);
    }
  }

  // Pattern 2: Look for text mentioning unsubscribe near a link
  // Find patterns like "Click here to unsubscribe: http://..."
  // or "Unsubscribe: <a href=...>"
  const contextRegex = /(?:unsubscribe|un-subscribe)[^<]*?<a\s+[^>]*?href=["']([^"']+)["'][^>]*?>/i;
  const contextMatch = htmlBody.match(contextRegex);
  if (contextMatch && contextMatch[1]) {
    return cleanUrl(contextMatch[1]);
  }

  // Pattern 3: Reverse - link followed by unsubscribe text
  // <a href="...">Click here</a> to unsubscribe
  const reverseLinkRegex = /<a\s+[^>]*?href=["']([^"']+)["'][^>]*?>.*?<\/a>\s*(?:to\s+)?(?:unsubscribe|un-subscribe)/i;
  const reverseMatch = htmlBody.match(reverseLinkRegex);
  if (reverseMatch && reverseMatch[1]) {
    return cleanUrl(reverseMatch[1]);
  }

  // Pattern 4: Find standalone URLs with unsubscribe in them (not in <a> tags)
  // Remove all <a> tags first, then search for URLs
  const withoutAnchors = htmlBody.replace(/<a\s+[^>]*?>.*?<\/a>/gi, "");
  const urlRegex = /(https?:\/\/[^\s<>"]+)/gi;
  const urlMatches = [...withoutAnchors.matchAll(urlRegex)];

  for (const urlMatch of urlMatches) {
    const url = urlMatch[1];
    if (/unsubscribe|un-subscribe/i.test(url)) {
      console.log(`[Unsubscribe Debug] ✓ Found unsubscribe in standalone URL`);
      return cleanUrl(url);
    }
  }

  console.log(`[Unsubscribe Debug] ✗ No unsubscribe link found in email body`);
  return null;
}

/**
 * Clean and validate URL
 * - Decode HTML entities
 * - Remove trailing punctuation
 * - Ensure it's a valid HTTP/HTTPS URL
 */
function cleanUrl(url: string): string {
  // Decode common HTML entities
  let cleaned = url
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove trailing punctuation that might have been captured
  cleaned = cleaned.replace(/[.,;!?]+$/, "");

  // Remove any surrounding whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extract unsubscribe URL from List-Unsubscribe header
 * Prefers HTTP/HTTPS URLs over mailto links
 */
export function findUnsubscribeLinkInHeader(listUnsubscribeHeader: string): string | null {
  if (!listUnsubscribeHeader) return null;

  // List-Unsubscribe can contain URLs in angle brackets: <http://...>, <mailto:...>
  // We prefer HTTP/HTTPS URLs over mailto
  const urlMatches = listUnsubscribeHeader.match(/<(https?:\/\/[^>]+)>/);
  if (urlMatches && urlMatches[1]) {
    return urlMatches[1];
  }

  // If no HTTP URL found, try mailto
  const mailtoMatches = listUnsubscribeHeader.match(/<(mailto:[^>]+)>/);
  if (mailtoMatches && mailtoMatches[1]) {
    return mailtoMatches[1];
  }

  return null;
}
