import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { sha256 } from "./core.mjs";

const limit = 240_000;
const safeText = (value, max) => String(value ?? "").replaceAll("\u0000", "").slice(0, max);
const safeHeader = (value, max) => safeText(value, max).replace(/[\u0001-\u001f\u007f]/gu, " ").trim();

export function sanitizeMessageHtml(value) {
  return sanitizeHtml(safeText(value, limit), {
    allowedTags: ["p", "div", "span", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i",
      "u", "s", "blockquote", "pre", "code", "ul", "ol", "li", "hr", "table", "thead", "tbody",
      "tfoot", "tr", "th", "td", "caption", "sub", "sup"],
    allowedAttributes: {},
    nonTextTags: ["script", "style", "textarea", "title", "iframe", "object", "noscript", "template", "svg", "math"],
    nestingLimit: 20,
  });
}

export async function parseMail(raw, envelopeFrom, fingerprint) {
  const parsed = await simpleParser(Buffer.from(raw), { skipImageLinks: true, skipTextToHtml: true });
  const messageId = safeHeader(parsed.messageId, 512).toLowerCase();
  return {
    sender: safeHeader(parsed.from?.text || envelopeFrom || "Remetente desconhecido", 512),
    subject: safeHeader(parsed.subject, 512) || "(Sem assunto)",
    messageId: messageId || null,
    dedupeKey: messageId ? sha256(JSON.stringify([envelopeFrom.toLowerCase(), messageId])) : fingerprint,
    sentAt: parsed.date && Number.isFinite(parsed.date.getTime()) ? parsed.date : null,
    textBody: safeText(parsed.text, limit),
    htmlBody: sanitizeMessageHtml(parsed.html || ""),
  };
}
