// 0 -> A, 25 -> Z, 26 -> AA, ... (spreadsheet-style column naming). The letters
// scheme of the drawing grid's edge labels (see label-scheme.ts).
export function columnLetter(index: number): string {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}
