const COMMON_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u00c3\u00a1/g, "\u00e1"],
  [/\u00c3\u00a0/g, "\u00e0"],
  [/\u00c3\u00a2/g, "\u00e2"],
  [/\u00c3\u00a3/g, "\u00e3"],
  [/\u00c3\u00a9/g, "\u00e9"],
  [/\u00c3\u00aa/g, "\u00ea"],
  [/\u00c3\u00ad/g, "\u00ed"],
  [/\u00c3\u00b3/g, "\u00f3"],
  [/\u00c3\u00b4/g, "\u00f4"],
  [/\u00c3\u00b5/g, "\u00f5"],
  [/\u00c3\u00ba/g, "\u00fa"],
  [/\u00c3\u00a7/g, "\u00e7"],
  [/\u00c3\u0081/g, "\u00c1"],
  [/\u00c3\u0089/g, "\u00c9"],
  [/\u00c3\u008d/g, "\u00cd"],
  [/\u00c3\u0093/g, "\u00d3"],
  [/\u00c3\u0094/g, "\u00d4"],
  [/\u00c3\u0095/g, "\u00d5"],
  [/\u00c3\u009a/g, "\u00da"],
  [/\u00c3\u0087/g, "\u00c7"],
  [/\u00e2\u20ac\u201c/g, "\u2013"],
  [/\u00e2\u20ac\u201d/g, "\u2014"],
  [/\u00e2\u20ac\u2122/g, "\u2019"],
  [/\u00e2\u20ac\u0153/g, "\u201c"],
  [/\u00e2\u20ac\u009d/g, "\u201d"],
  [/\u00c2/g, ""],
];

const MOJIBAKE_HINT = /(?:\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u0080-\u00bf]{2}|\ufffd)/;

function applyCommonReplacements(value: string): string {
  let output = value;
  for (const [pattern, replacement] of COMMON_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

function decodeLatin1AsUtf8(value: string): string | null {
  if (typeof TextDecoder === "undefined") return null;

  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }

  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

export function normalizeUtf8Text(value?: string | null): string {
  if (!value) return "";

  let normalized = String(value);

  for (let pass = 0; pass < 3; pass += 1) {
    let next = applyCommonReplacements(normalized);

    if (MOJIBAKE_HINT.test(next)) {
      const decoded = decodeLatin1AsUtf8(next);
      if (decoded && decoded !== next) {
        next = decoded;
      }
    }

    if (next === normalized) break;
    normalized = next;
  }

  return normalized.normalize("NFC");
}
