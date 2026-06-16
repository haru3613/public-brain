// CJK-aware reading-time estimate. The prototype carried a hand-set "7 分鐘";
// we compute it from the body so the Obsidian → site flow needs no extra field.

const CJK = /[㐀-鿿぀-ヿ가-힯]/g;
// Average reading pace: ~340 CJK chars/min, ~200 latin words/min.
const CJK_PER_MIN = 340;
const WORDS_PER_MIN = 200;

export function readingTime(body: string): string {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ') // drop code fences
    .replace(/[#>*_`~\-]/g, ' '); // drop md punctuation

  const cjkCount = (text.match(CJK) || []).length;
  const latin = text.replace(CJK, ' ');
  const wordCount = (latin.match(/[A-Za-z0-9]+/g) || []).length;

  const minutes = Math.max(1, Math.round(cjkCount / CJK_PER_MIN + wordCount / WORDS_PER_MIN));
  return `${minutes} 分鐘`;
}

// "2026-06-14" style mono date used across rows and article headers.
export function monoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
