const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const enharmonics: Record<string, string> = {
  Cb: "B",
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  "E#": "F",
  "B#": "C",
};
export const isChord = (v: string) =>
  /^[A-G](#|b)?(m|maj|min|dim|aug|sus|add)?[0-9b#]*(\/[A-G](#|b)?)?$/.test(v);
export function transpose(chord: string, steps: number) {
  if (!isChord(chord) || !steps) return chord;
  return chord
    .split("/")
    .map((part) =>
      part.replace(
        /^[A-G][#b]?/,
        (base) =>
          notes[
            (((notes.indexOf(enharmonics[base] ?? base) + steps) % 12) + 12) %
              12
          ],
      ),
    )
    .join("/");
}
export function escapeHTML(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
/** Normalize iOS HTML into safe text and chord spans; do not execute imported markup. Browser only. */
export function renderContent(content: string, steps = 0): string {
  const doc = new DOMParser().parseFromString(
    content
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(
        /<span\b(?=[^>]*class\s*=\s*['"][^'"]*subline)[^>]*>/gi,
        "\n<span>",
      )
      .replace(/<\/div>|<\/p>|<\/pre>/gi, "$&\n"),
    "text/html",
  );
  doc
    .querySelectorAll("script,style,iframe,object,embed,svg,math,template")
    .forEach((n) => n.remove());
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE)
      return escapeHTML(node.textContent ?? "").replace(
        /\[([A-G][^\]\n]*)\]/g,
        (whole, c: string) =>
          isChord(c)
            ? `<span class="chord">${transpose(c, steps)}</span>`
            : whole,
      );
    if (node instanceof Element && node.tagName === "SPAN") {
      const c = (node.textContent ?? "").trim();
      if (isChord(c))
        return `<span class="chord">${transpose(c, steps)}</span>`;
    }
    return Array.from(node.childNodes).map(walk).join("");
  };
  const result = walk(doc.body).replace(/\u2060/g, "");
  return result
    .split("\n")
    .map((line) => {
      if (!line.includes("<span") && line.trim().split(/\s+/).every(isChord))
        return line.replace(
          /\S+/g,
          (chord) => `<span class="chord">${transpose(chord, steps)}</span>`,
        );
      return line;
    })
    .join("\n");
}
export function textToContent(text: string) {
  return escapeHTML(text)
    .replace(/\[([A-G][^\]\n]*)\]/g, (whole, c: string) =>
      isChord(c) ? `<span class="podbor__chord">${c}</span>` : whole,
    )
    .split("\n")
    .map((line) =>
      line.trim() && line.trim().split(/\s+/).every(isChord)
        ? line.replace(/\S+/g, (c) => `<span class="podbor__chord">${c}</span>`)
        : line,
    )
    .join("\n");
}
export function contentToText(content: string) {
  const doc = new DOMParser().parseFromString(
    content.replace(/<br\s*\/?>/gi, "\n").replace(/<\/div>|<\/p>/gi, "$&\n"),
    "text/html",
  );
  doc.querySelectorAll("script,style,iframe").forEach((n) => n.remove());
  doc.querySelectorAll("span").forEach((n) => {
    const c = (n.textContent ?? "").trim();
    if (isChord(c)) n.textContent = `[${c}]`;
  });
  return doc.body.textContent ?? "";
}
