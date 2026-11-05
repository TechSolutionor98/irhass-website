/**
 * Blocks -> email HTML.
 *
 * This is the only place that writes the markup that goes to an inbox, and the rules
 * it follows are not the rules of a web page:
 *
 *   - Layout is tables. Outlook on Windows renders mail through Word's engine, which
 *     has no flexbox and no grid. A float or a flex row collapses into a stack.
 *   - Every style is inline on the element. Gmail removes <style> blocks entirely,
 *     so a class name is a style that works in the browser preview and nowhere else.
 *   - A button is a table with padding on its cell, not a padded <a>. Outlook ignores
 *     padding on an inline element, so a styled link becomes unclickable text.
 *   - Side-by-side cells carry explicit pixel widths. A percentage is rounded
 *     differently by Word and the columns stack.
 *
 * The browser-side canvas is a separate, deliberately approximate preview. The real
 * email is always this file's output -- one renderer, so the two cannot drift into
 * disagreeing about what was sent.
 */

import { EMAIL_THEME as T } from "../data/emailTheme.js"
import { toAbsoluteEmailUrl, getEmailLogoUrl } from "../utils/emailAssets.js"
import { getSiteOrigin } from "../utils/publicSiteUrl.js"

/** Escape for a text or attribute position. Never used on rich-text block content. */
export const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const px = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const align = (value) => (["left", "center", "right"].includes(value) ? value : "left")

/**
 * A link that is safe to put in href. Anything that is not http(s), mailto or a
 * merge field becomes the site root -- javascript: in an admin-authored template
 * would still be a stored payload aimed at whoever previews it.
 */
const safeUrl = (value) => {
  const raw = String(value || "").trim()
  if (!raw) return ""
  if (/^\{\{[a-z0-9_]+\}\}$/i.test(raw)) return raw
  if (/^(https?:\/\/|mailto:)/i.test(raw)) return raw
  if (raw.startsWith("/")) return `${getSiteOrigin()}${raw}`
  return ""
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** A full-width row with the padding the whole email shares. */
const row = (inner, { padding = "0 32px", background = "" } = {}) => `
<tr>
  <td style="padding:${padding};${background ? `background-color:${background};` : ""}">
    ${inner}
  </td>
</tr>`

/**
 * A button. Table, not a link with padding -- see the note at the top of the file.
 */
const buttonHtml = ({ label, url, background, color, radius = 0, fullWidth = false, align: a = "left" }) => {
  const href = safeUrl(url)
  const cell = `
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;${fullWidth ? "width:100%;" : ""}mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
      <td align="center" bgcolor="${background}" style="background-color:${background};border-radius:${px(radius)}px;${fullWidth ? "width:100%;" : ""}">
        <a href="${esc(href || getSiteOrigin())}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${T.fontBody};font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${color};text-decoration:none;border-radius:${px(radius)}px;">${esc(label)}</a>
      </td>
    </tr>
  </table>`

  if (a === "left") return cell
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="${a}">${cell}</td></tr></table>`
}

const imageHtml = ({ src, alt, width, href, radius = 0 }) => {
  const absolute = toAbsoluteEmailUrl(src)
  // A picture nobody can fetch is worse than no picture: it shows as a broken icon
  // with the alt text spilling out of it.
  if (!absolute) return ""

  const img = `<img src="${esc(absolute)}" alt="${esc(alt || "")}"${width ? ` width="${px(width)}"` : ""} style="display:block;border:0;outline:none;text-decoration:none;max-width:100%;height:auto;${radius ? `border-radius:${px(radius)}px;` : ""}-ms-interpolation-mode:bicubic;" />`

  const link = safeUrl(href)
  return link ? `<a href="${esc(link)}" target="_blank" style="text-decoration:none;">${img}</a>` : img
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const renderers = {
  heading: (b) => row(`
    <h2 style="margin:0;font-family:${T.fontHeading};font-size:${px(b.fontSize, 28)}px;line-height:1.3;font-weight:normal;color:${b.color || T.ink};text-align:${align(b.align)};">${b.html || esc(b.text || "")}</h2>`,
    { padding: `${px(b.paddingTop, 24)}px 32px ${px(b.paddingBottom, 12)}px` }),

  text: (b) => row(`
    <div style="margin:0;font-family:${T.fontBody};font-size:${px(b.fontSize, 15)}px;line-height:1.7;color:${b.color || T.text};text-align:${align(b.align)};">${b.html || esc(b.text || "")}</div>`,
    { padding: `${px(b.paddingTop, 0)}px 32px ${px(b.paddingBottom, 16)}px` }),

  // Lists get explicit margins and padding because every client defaults them differently.
  list: (b) => {
    const tag = b.ordered ? "ol" : "ul"
    const items = (Array.isArray(b.items) ? b.items : [])
      .map((item) => `<li style="margin:0 0 8px 0;padding:0;">${esc(item)}</li>`)
      .join("")
    return row(`
    <${tag} style="margin:0;padding:0 0 0 22px;font-family:${T.fontBody};font-size:${px(b.fontSize, 15)}px;line-height:1.7;color:${b.color || T.text};">${items}</${tag}>`,
      { padding: `${px(b.paddingTop, 0)}px 32px ${px(b.paddingBottom, 16)}px` })
  },

  image: (b) => {
    const html = imageHtml({ src: b.src, alt: b.alt, width: b.fullWidth ? T.contentWidth : b.width, href: b.href, radius: b.radius })
    if (!html) return ""
    return b.fullWidth
      ? `<tr><td style="padding:0;font-size:0;line-height:0;">${html}</td></tr>`
      : row(`<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="${align(b.align || "center")}">${html}</td></tr></table>`,
          { padding: `${px(b.paddingTop, 8)}px 32px ${px(b.paddingBottom, 8)}px` })
  },

  button: (b) => row(
    buttonHtml({
      label: b.label || "Shop now",
      url: b.url,
      background: b.background || T.ink,
      color: b.color || T.white,
      radius: b.radius,
      fullWidth: b.fullWidth,
      align: align(b.align || "center"),
    }),
    { padding: `${px(b.paddingTop, 12)}px 32px ${px(b.paddingBottom, 20)}px` }),

  /**
   * Video. No mail client plays an embedded one, so this is what a video block has
   * to be: a still with a play badge drawn on it, linking out to where it plays.
   */
  video: (b) => {
    const poster = imageHtml({ src: b.poster, alt: b.alt || "Watch the video", width: T.contentWidth - 64, href: b.url, radius: b.radius })
    if (!poster) return ""
    return row(`
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center">${poster}</td></tr>
      <tr><td align="center" style="padding-top:12px;">
        ${buttonHtml({ label: b.label || "Watch the film", url: b.url, background: T.ink, color: T.white, align: "center" })}
      </td></tr>
    </table>`, { padding: `${px(b.paddingTop, 12)}px 32px ${px(b.paddingBottom, 20)}px` })
  },

  /**
   * Columns. Every cell carries a pixel width: Word rounds percentages its own way
   * and drops the cells onto separate lines when they no longer fit.
   */
  columns: (b) => {
    const cols = Array.isArray(b.columns) ? b.columns : []
    if (!cols.length) return ""

    const gutter = px(b.gutter, 16)
    const available = T.contentWidth - 64 - gutter * (cols.length - 1)
    const width = Math.floor(available / cols.length)

    const cells = cols
      .map((col, index) => {
        const inner = [
          col.image ? imageHtml({ src: col.image, alt: col.alt, width, href: col.href, radius: col.radius }) : "",
          col.heading
            ? `<p style="margin:12px 0 6px 0;font-family:${T.fontHeading};font-size:16px;line-height:1.4;color:${T.ink};">${esc(col.heading)}</p>`
            : "",
          col.text
            ? `<p style="margin:0;font-family:${T.fontBody};font-size:13px;line-height:1.6;color:${T.muted};">${esc(col.text)}</p>`
            : "",
          col.buttonLabel
            ? `<div style="margin-top:12px;">${buttonHtml({ label: col.buttonLabel, url: col.href, background: T.ink, color: T.white })}</div>`
            : "",
        ].join("")

        const spacer = index < cols.length - 1 ? `<td width="${gutter}" style="width:${gutter}px;font-size:0;line-height:0;">&nbsp;</td>` : ""
        return `<td width="${width}" valign="top" style="width:${width}px;">${inner}</td>${spacer}`
      })
      .join("")

    return row(`
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>${cells}</tr>
    </table>`, { padding: `${px(b.paddingTop, 8)}px 32px ${px(b.paddingBottom, 16)}px` })
  },

  /**
   * A product, as a snapshot. Everything shown here was copied when the block was
   * built -- see the note on the product picker route.
   */
  product: (b) => {
    const image = imageHtml({ src: b.image, alt: b.name, width: b.layout === "stacked" ? T.contentWidth - 64 : 240, href: b.url })
    const price = b.price ? `<span style="font-family:${T.fontBody};font-size:17px;font-weight:bold;color:${T.ink};">${esc(b.price)}</span>` : ""
    const was = b.oldPrice ? ` <span style="font-family:${T.fontBody};font-size:14px;color:${T.muted};text-decoration:line-through;">${esc(b.oldPrice)}</span>` : ""
    const badge = b.badge
      ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:10px;"><tr><td bgcolor="${T.gold}" style="background-color:${T.gold};padding:4px 10px;font-family:${T.fontBody};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${T.white};">${esc(b.badge)}</td></tr></table>`
      : ""

    const details = `
      ${badge}
      ${b.category ? `<p style="margin:0 0 6px 0;font-family:${T.fontBody};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${T.muted};">${esc(b.category)}</p>` : ""}
      <p style="margin:0 0 8px 0;font-family:${T.fontHeading};font-size:19px;line-height:1.35;color:${T.ink};">${esc(b.name || "")}</p>
      ${b.description ? `<p style="margin:0 0 10px 0;font-family:${T.fontBody};font-size:13px;line-height:1.6;color:${T.muted};">${esc(b.description)}</p>` : ""}
      <p style="margin:0 0 16px 0;">${price}${was}</p>
      ${buttonHtml({ label: b.buttonLabel || "Shop now", url: b.url, background: T.ink, color: T.white })}`

    const body = b.layout === "stacked"
      ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
           <tr><td>${image}</td></tr>
           <tr><td style="padding-top:16px;">${details}</td></tr>
         </table>`
      : `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
           <tr>
             <td width="240" valign="top" style="width:240px;">${image}</td>
             <td width="16" style="width:16px;font-size:0;line-height:0;">&nbsp;</td>
             <td valign="top" style="width:280px;">${details}</td>
           </tr>
         </table>`

    return row(body, { padding: `${px(b.paddingTop, 16)}px 32px ${px(b.paddingBottom, 20)}px` })
  },

  coupon: (b) => row(`
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td align="center" bgcolor="${b.background || T.cream}" style="background-color:${b.background || T.cream};border:2px dashed ${b.borderColor || T.gold};padding:26px 20px;">
          ${b.heading ? `<p style="margin:0 0 8px 0;font-family:${T.fontBody};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${T.goldDark};">${esc(b.heading)}</p>` : ""}
          <p style="margin:0 0 10px 0;font-family:${T.fontHeading};font-size:30px;line-height:1.2;color:${T.ink};">${esc(b.code || "")}</p>
          ${b.description ? `<p style="margin:0 0 16px 0;font-family:${T.fontBody};font-size:13px;line-height:1.6;color:${T.text};">${esc(b.description)}</p>` : ""}
          ${b.buttonLabel ? buttonHtml({ label: b.buttonLabel, url: b.url, background: T.ink, color: T.white, align: "center" }) : ""}
          ${b.expiry ? `<p style="margin:14px 0 0 0;font-family:${T.fontBody};font-size:11px;color:${T.muted};">${esc(b.expiry)}</p>` : ""}
        </td>
      </tr>
    </table>`, { padding: `${px(b.paddingTop, 12)}px 32px ${px(b.paddingBottom, 20)}px` }),

  divider: (b) => row(`
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
      <td style="border-top:${px(b.thickness, 1)}px solid ${b.color || T.border};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>`, { padding: `${px(b.paddingTop, 8)}px 32px ${px(b.paddingBottom, 8)}px` }),

  // font-size and line-height are zeroed as well as the height set: Outlook gives an
  // empty cell a line box of its own and the gap comes out taller than asked for.
  spacer: (b) => `<tr><td style="height:${px(b.height, 24)}px;font-size:0;line-height:0;">&nbsp;</td></tr>`,

  social: (b) => {
    const links = (Array.isArray(b.links) ? b.links : []).filter((l) => l.url && l.label)
    if (!links.length) return ""
    const cells = links
      .map(
        (l) => `<td style="padding:0 10px;"><a href="${esc(safeUrl(l.url))}" target="_blank" style="font-family:${T.fontBody};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${b.color || T.muted};text-decoration:none;">${esc(l.label)}</a></td>`,
      )
      .join("")
    return row(`
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
    </td></tr></table>`, { padding: `${px(b.paddingTop, 12)}px 32px ${px(b.paddingBottom, 12)}px` })
  },

  footer: (b) => `
<tr>
  <td bgcolor="${b.background || T.ink}" style="background-color:${b.background || T.ink};padding:32px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center" style="font-family:${T.fontBody};font-size:12px;line-height:1.8;color:#a8a29e;">
        ${b.companyName ? `<p style="margin:0 0 6px 0;font-family:${T.fontHeading};font-size:16px;color:${T.white};">${esc(b.companyName)}</p>` : ""}
        ${b.address ? `<p style="margin:0 0 6px 0;">${esc(b.address)}</p>` : ""}
        ${b.contact ? `<p style="margin:0 0 14px 0;">${esc(b.contact)}</p>` : ""}
        <p style="margin:0;">
          <a href="{{unsubscribe_url}}" style="color:#a8a29e;text-decoration:underline;">Unsubscribe</a>
          &nbsp;&middot;&nbsp;
          <a href="${esc(getSiteOrigin())}" style="color:#a8a29e;text-decoration:underline;">Visit the shop</a>
        </p>
        ${b.note ? `<p style="margin:12px 0 0 0;font-size:11px;color:#78716c;">${esc(b.note)}</p>` : ""}
      </td></tr>
    </table>
  </td>
</tr>`,

  // Admin-authored escape hatch. Passed through as written -- that is what it is for.
  html: (b) => row(String(b.html || ""), { padding: `${px(b.paddingTop, 0)}px 32px ${px(b.paddingBottom, 0)}px` }),
}

/** The logo-left masthead every built-in design opens with. */
const mastheadHtml = (b = {}) => {
  const logo = imageHtml({ src: b.logo || getEmailLogoUrl(), alt: b.companyName || "Irha's Wardrobe", width: px(b.logoWidth, 150), href: getSiteOrigin() })
  return `
<tr>
  <td bgcolor="${b.background || T.white}" style="background-color:${b.background || T.white};padding:24px 32px;border-bottom:1px solid ${T.border};">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td width="170" valign="middle" style="width:170px;">${logo}</td>
        <td valign="middle" align="right" style="font-family:${T.fontBody};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${T.muted};">${esc(b.tagline || "")}</td>
      </tr>
    </table>
  </td>
</tr>`
}

renderers.masthead = mastheadHtml

export const BLOCK_TYPES = Object.keys(renderers)

const renderBlock = (block) => {
  if (!block || typeof block !== "object") return ""
  const render = renderers[block.type]
  if (!render) return ""
  try {
    return render(block)
  } catch (error) {
    console.error(`[emailRenderer] block "${block.type}" failed to render:`, error.message)
    return ""
  }
}

/**
 * Render a template's blocks into a complete email document.
 *
 * @param {object} template { subject, preheader, blocks }
 * @returns {string} html
 */
export const renderEmail = ({ subject = "", preheader = "", blocks = [] } = {}) => {
  const body = (Array.isArray(blocks) ? blocks : []).map(renderBlock).join("\n")

  // The preheader is the grey line the inbox shows after the subject. It is real text
  // in the document, hidden from the rendered body, then padded so the client cannot
  // pull the first words of the first block in after it.
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${T.cream};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>`
    : ""

  // The XHTML doctype is what Word's engine expects; an HTML5 one makes it fall back
  // to quirks and the fixed widths stop being honoured.
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>${esc(subject)}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${T.cream};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${preheaderHtml}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${T.cream};mso-table-lspace:0pt;mso-table-rspace:0pt;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${T.contentWidth}" style="width:${T.contentWidth}px;max-width:${T.contentWidth}px;background-color:${T.white};border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
${body}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export default { renderEmail, BLOCK_TYPES, esc }
