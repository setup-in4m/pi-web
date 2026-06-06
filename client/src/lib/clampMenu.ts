/**
 * Adjust context menu position to stay within viewport.
 * Returns { left, top } style values for fixed-position menus.
 */
export function clampContextMenu(
  x: number,
  y: number,
  menuWidth = 180,
  menuHeight = 200,
  padding = 8
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = x;
  let top = y;

  // Clamp right edge
  if (left + menuWidth > vw - padding) {
    left = vw - menuWidth - padding;
  }
  // Clamp bottom edge
  if (top + menuHeight > vh - padding) {
    top = vh - menuHeight - padding;
  }
  // Clamp left edge
  if (left < padding) left = padding;
  // Clamp top edge
  if (top < padding) top = padding;

  return { left, top };
}
