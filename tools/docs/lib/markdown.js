// tools/docs/lib/markdown.js – schlanker Markdown-Tokenizer mit Zeilennummern für check-docs.js (keine Abhängigkeiten)
//
// Liefert je Datei: Zeilen, Code-Blöcke (Bereiche + Sprache), Überschriften, Links, Bilder, Code-Spans, Absätze (mit Länge),
// Tabellenzellen, Fakt-/Startwert-Marker, Front Matter, Platzhalter-Kennung. Alles außerhalb von Code-Blöcken, außer wo gesagt.
'use strict';

function parse(text) {
  const lines = text.split('\n');
  const doc = { lines, code: [], headings: [], links: [], images: [], codeSpans: [], paragraphs: [], cells: [], markers: [], h1: 0,
    frontMatter: null, imAufbau: /<!--\s*im-aufbau\s*-->/.test(text), rawBlocks: [] };
  // Front Matter
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) { doc.frontMatter = lines.slice(1, end).join('\n'); i = end + 1; }
  }
  // Code-Blöcke (``` oder ~~~) und {% raw %}
  let inCode = null;
  const inCodeAt = new Array(lines.length).fill(false);
  for (let n = i; n < lines.length; n++) {
    const l = lines[n];
    const fence = /^\s*(```+|~~~+)\s*([\w+-]*)/.exec(l);
    if (inCode === null && fence) { inCode = { start: n, lang: fence[2] || '', fence: fence[1] }; inCodeAt[n] = true; continue; }
    if (inCode !== null) { inCodeAt[n] = true; if (l.trim().startsWith(inCode.fence)) { doc.code.push({ start: inCode.start, end: n, lang: inCode.lang }); inCode = null; } }
  }
  if (inCode !== null) doc.code.push({ start: inCode.start, end: lines.length - 1, lang: inCode.lang, offen: true });
  doc.inCode = (n) => inCodeAt[n];
  let inRaw = false;
  for (let n = i; n < lines.length; n++) {
    const l = lines[n];
    if (/\{%\s*raw\s*%\}/.test(l)) inRaw = true;
    doc.rawBlocks[n] = inRaw;
    if (/\{%\s*endraw\s*%\}/.test(l)) inRaw = false;
    if (inCodeAt[n]) continue;
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (h) { doc.headings.push({ level: h[1].length, text: h[2], line: n + 1 }); if (h[1].length === 1) doc.h1++; continue; }
    // Bilder vor Links (Links-Regex würde ![..](..) sonst mitnehmen)
    const noCode = l.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
    let m;
    const imgRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    while ((m = imgRe.exec(noCode))) doc.images.push({ line: n + 1, alt: m[1], src: m[2] });
    const linkRe = /(^|[^!])\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    while ((m = linkRe.exec(noCode))) doc.links.push({ line: n + 1, text: m[2], target: m[3] });
    const spanRe = /`([^`]+)`/g;
    while ((m = spanRe.exec(l))) doc.codeSpans.push({ line: n + 1, text: m[1] });
    const mRe = /<!--\s*(fact|def|zr|hwt|hwp):([\w.]+)\s*-->(.*?)<!--\s*\/\1\s*-->/g;
    while ((m = mRe.exec(l))) doc.markers.push({ line: n + 1, art: m[1], key: m[2], value: m[3].trim() });
    const tRe = /<!--\s*(\/?)tabelle(?::(\w+))?\s*-->/g;
    while ((m = tRe.exec(l))) doc.markers.push({ line: n + 1, art: m[1] ? 'tabelle-ende' : 'tabelle', key: m[2] || '', value: '' });
    if (/^\s*\|/.test(l) && !/^\s*\|\s*-{3,}/.test(l)) {
      const cells = l.trim().replace(/^\||\|$/g, '').split('|');
      for (const c of cells) doc.cells.push({ line: n + 1, text: c.trim() });
    }
  }
  // Absätze: zusammenhängende Textzeilen außerhalb von Code, Tabellen, Überschriften, Listen
  let para = null;
  for (let n = i; n <= lines.length; n++) {
    const l = n < lines.length ? lines[n] : '';
    const isText = n < lines.length && !inCodeAt[n] && l.trim() !== '' && !/^\s*(#|\||[-*+]\s|\d+\.\s|>|<!--|---)/.test(l);
    if (isText) { if (!para) para = { start: n + 1, text: '' }; para.text += (para.text ? ' ' : '') + l.trim(); }
    else if (para) { doc.paragraphs.push(para); para = null; }
  }
  return doc;
}

module.exports = { parse };
