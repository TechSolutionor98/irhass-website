/**
 * Code 128 (subset B) encoder.
 *
 * Written rather than pulled in: a barcode is a few hundred bytes of table and some
 * arithmetic, and the label sheet has to print from a stockroom machine that may be
 * offline. No dependency, no CDN, no runtime fetch.
 *
 * Subset B covers every printable ASCII character from space to DEL, which is all a
 * SKU like "IRH-0100" needs. Subset C would pack pure digits more tightly, but mixed
 * codes are the common case here and switching sets mid-string is not worth the bugs.
 */

// Each entry is the run length of six alternating modules, starting with a bar.
// Index is the Code 128 symbol value; 103-105 are the start codes and 106 is stop.
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
]

const START_B = 104
const STOP = 106

// Anything outside subset B's range would silently encode as the wrong glyph, so it
// is replaced rather than dropped -- a label that scans to the wrong SKU is worse
// than one with a visible substitution in it.
const sanitize = (text) =>
  String(text ?? "")
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0)
      return code >= 32 && code <= 126 ? ch : "?"
    })
    .join("")

/**
 * The bar pattern as a string of "1" (bar) and "0" (space), including the start code,
 * the modulo-103 check symbol and the stop pattern. Quiet zones are the caller's job.
 */
export const code128Modules = (text) => {
  const value = sanitize(text)
  if (!value) return ""

  const symbols = [START_B]
  let checksum = START_B

  for (let i = 0; i < value.length; i++) {
    const symbol = value.charCodeAt(i) - 32
    symbols.push(symbol)
    // Position is 1-based, which is why the weight is i + 1 and not i.
    checksum += symbol * (i + 1)
  }

  symbols.push(checksum % 103)
  symbols.push(STOP)

  return symbols
    .map((symbol) => {
      const runs = PATTERNS[symbol]
      return runs
        .split("")
        .map((width, index) => (index % 2 === 0 ? "1" : "0").repeat(Number(width)))
        .join("")
    })
    .join("")
}

/**
 * Bar geometry for rendering. Returns the x offset and width of each bar in modules,
 * so the caller can draw at whatever scale it likes without re-running the encoder.
 */
export const code128Bars = (text) => {
  const modules = code128Modules(text)
  const bars = []

  let run = 0
  for (let i = 0; i <= modules.length; i++) {
    if (modules[i] === "1") {
      run++
    } else if (run > 0) {
      bars.push({ x: i - run, width: run })
      run = 0
    }
  }

  return { bars, totalModules: modules.length }
}

export default code128Modules
