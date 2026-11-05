/**
 * The Grabian Coin mark. One component so the asset path and its fallback live in a
 * single place — the coin replaces the generic award icon everywhere a customer sees
 * loyalty points.
 *
 * `size` is in pixels and is applied to both dimensions, since the artwork is square.
 */
const GrabCoin = ({ size = 20, className = "", alt = "Grabian Coin" }) => (
  <img
    src="/grabcoin.webp"
    alt={alt}
    width={size}
    height={size}
    // Loyalty marks are decoration next to text that already says what they are, so they
    // must never hold up the rest of the page.
    loading="lazy"
    decoding="async"
    draggable={false}
    className={`inline-block flex-shrink-0 object-contain select-none ${className}`}
    style={{ width: size, height: size }}
  />
)

export default GrabCoin
