export interface SelectionInfo {
  text: string;
  rect: DOMRect;
}

export function getSelectionInfo(): SelectionInfo | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const text = selection.toString();
  if (!text.trim()) return null;

  const range = selection.getRangeAt(0);
  let rect = range.getBoundingClientRect();

  if (!rect || (rect.width === 0 && rect.height === 0)) {
    const rects = range.getClientRects();
    if (rects.length === 0) return null;
    rect = rects[0];
  }

  return { text, rect };
}
