// tools/docs/diagramm-svg.mjs v0.1.0 – statisches SVG aus einer von Archify gelieferten HTML-Datei
//
// Archify hat keinen CLI-Export; der Viewer exportiert im Browser (serializeSvg). Dieses Modul baut den Export in Node nach:
// das eine <svg> der Datei, dazu nur die CSS-Regeln, die im SVG wirken (Selektoren svg, :root, [data-theme, [data-preset,
// .c-, .t-, .a-, .m-), die aufgelösten Theme-Variablen (hell als Standard, dunkel per prefers-color-scheme und
// svg[data-theme="dark"]), ein Hintergrund-Rechteck und die Schrift-Fallbacks. Laufzeit-Overlays und Bedienattribute
// werden entfernt. Ergebnis: eigenständige, wohlgeformte SVG-Datei für Markdown (<img>) auf GitHub und Pages.
//
// Aufruf: node tools/docs/diagramm-svg.mjs <eingabe.html> <ausgabe.svg> [--lang de|en]
// Modul:  import { extractSvg } from './diagramm-svg.mjs'; extractSvg(html, { lang }) → String
import fs from 'node:fs';

const KEEP = /^(svg|:root|\[data-theme|\[data-preset|\.c-|\.t-|\.a-|\.m-)/;
const REMOVE_ELEMENT_ATTRS = [
  'data-relationship-hit-overlay', 'data-legend-bridge-runtime', 'data-source-evidence-beacon', 'data-story-overlay',
  'data-story-carrier-overlay', 'data-chapter-handoff-overlay', 'data-intent-trace-overlay', 'data-route-probe-overlay',
  'data-route-journey-overlay', 'data-semantic-lens-overlay', 'data-relationship-pulse-overlay',
];
const STRIP_ATTR = /\s(data-detail|data-detail-anchor|tabindex|aria-pressed|aria-haspopup|aria-controls|aria-expanded|data-legend-[a-z-]+|data-story-[a-z-]+|data-focus-[a-z-]+|data-reach-[a-z-]+|data-route-[a-z-]+|data-chapter-[a-z-]+|data-lens-[a-z-]+|data-share-[a-z-]+|data-source-evidence-[a-z-]+)(="[^"]*")?(?=[\s/>])/g;
const FONT_STACK = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace";

// Top-Level-Regeln eines Stylesheets: [{ selector, body, at }] (at = @media/@keyframes-Blöcke, werden verworfen)
function splitRules(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth > 0) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    out.push({ selector: head, body: css.slice(open + 1, j - 1), at: head.startsWith('@') });
    i = j;
  }
  return out;
}

function declarations(body) {
  const vars = {};
  for (const part of body.split(';')) {
    const m = /^\s*(--[a-zA-Z0-9-]+)\s*:\s*([^;]+?)\s*$/.exec(part);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

// Variablen für ein Thema auflösen: Basis (:root / [data-theme="dark"]) → Thema → Preset+Thema (Reihenfolge wie im Stylesheet)
function resolveVars(rules, theme, preset) {
  const merged = {};
  const passes = [
    (s) => /:root/.test(s) || (/\[data-theme="dark"\]/.test(s) && !/\[data-preset/.test(s)),
    (s) => new RegExp('\\[data-theme="' + theme + '"\\]').test(s) && !/\[data-preset/.test(s),
    (s) => new RegExp('\\[data-preset="' + preset + '"\\]').test(s) && (new RegExp('\\[data-theme="' + theme + '"\\]').test(s) || !/\[data-theme/.test(s)),
  ];
  for (const pass of passes) {
    for (const r of rules) {
      if (r.at) continue;
      if (r.selector.split(',').some((s) => pass(s.trim()))) Object.assign(merged, declarations(r.body));
    }
  }
  return merged;
}

// Element mit einem der Laufzeit-Attribute samt Inhalt entfernen (balancierter Tag-Scanner)
function removeElements(svg, attrs) {
  for (const attr of attrs) {
    for (;;) {
      const at = svg.search(new RegExp('<([a-zA-Z]+)[^>]*\\s' + attr + '(=|[\\s/>])'));
      if (at < 0) break;
      const tagEnd = svg.indexOf('>', at);
      const name = /<([a-zA-Z]+)/.exec(svg.slice(at))[1];
      if (svg[tagEnd - 1] === '/') { svg = svg.slice(0, at) + svg.slice(tagEnd + 1); continue; }
      let depth = 1, pos = tagEnd + 1;
      const openRe = new RegExp('<' + name + '[\\s>]', 'g'), closeRe = new RegExp('</' + name + '>', 'g');
      while (depth > 0) {
        openRe.lastIndex = pos; closeRe.lastIndex = pos;
        const o = openRe.exec(svg), c = closeRe.exec(svg);
        if (!c) throw new Error('unbalanced <' + name + '> at ' + at);
        if (o && o.index < c.index) { const selfClose = svg.indexOf('>', o.index); if (svg[selfClose - 1] !== '/') depth++; pos = selfClose + 1; }
        else { depth--; pos = c.index + c[0].length; }
      }
      svg = svg.slice(0, at) + svg.slice(pos);
    }
  }
  return svg;
}

function wellFormed(xml) {
  const stack = [];
  const re = /<(\/)?([a-zA-Z][\w:-]*)[^>]*?(\/)?>|<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (!m[2]) continue;
    if (m[1]) { if (stack.pop() !== m[2]) return false; }
    else if (!m[3]) stack.push(m[2]);
  }
  return stack.length === 0;
}

export function extractSvg(html, opts) {
  const lang = (opts && opts.lang) || 'de';
  const count = (html.match(/<svg[\s>]/g) || []).length;
  if (count !== 1) throw new Error('erwartet genau ein <svg> in der HTML (Deliver-Artefakt), gefunden ' + count);
  const start = html.search(/<svg[\s>]/), end = html.indexOf('</svg>', start);
  let svg = html.slice(start, end + 6);
  const styleStart = html.indexOf('<style>'), styleEnd = html.indexOf('</style>', styleStart);
  if (styleStart < 0 || styleEnd < 0) throw new Error('kein <style> in der HTML');
  const css = html.slice(styleStart + 7, styleEnd).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = splitRules(css).filter((r) => !r.at && r.selector.split(',').some((s) => KEEP.test(s.trim())));
  const preset = (/data-preset="([^"]+)"/.exec(svg.slice(0, svg.indexOf('>'))) || [null, 'classic'])[1];
  const light = resolveVars(rules, 'light', preset), dark = resolveVars(rules, 'dark', preset);
  const vars = (v) => Object.keys(v).map((k) => k + ': ' + v[k] + ';').join(' ');
  const viewBox = /viewBox="([^"]+)"/.exec(svg);
  if (!viewBox) throw new Error('svg ohne viewBox');
  const [, , w, h] = viewBox[1].trim().split(/[\s,]+/).map(Number);
  // Wurzel-Tag neu aufbauen
  const rootEnd = svg.indexOf('>');
  let root = svg.slice(0, rootEnd + 1);
  root = root.replace(/\s(style|data-view-scale|width|height|lang|data-theme|xmlns)="[^"]*"/g, '');
  root = root.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg" lang="' + lang + '" width="' + w + '" height="' + h + '"');
  svg = root + svg.slice(rootEnd + 1);
  svg = removeElements(svg, REMOVE_ELEMENT_ATTRS);
  svg = svg.replace(STRIP_ATTR, '');
  svg = svg.replace(/\srole="button"/g, '');
  const style = [
    [400, 500, 600, 700].map((wt) => "@font-face { font-family: 'JetBrains Mono'; font-weight: " + wt + "; src: local('JetBrains Mono'), local('JetBrainsMono-Regular'); }").join('\n'),
    'svg { font-family: ' + FONT_STACK + '; }',
    rules.map((r) => r.selector + ' {' + r.body + '}').join('\n'),
    ':root, svg { ' + vars(light) + ' }',
    '@media (prefers-color-scheme: dark) { :root, svg { ' + vars(dark) + ' } }',
    'svg[data-theme="light"] { ' + vars(light) + ' }',
    'svg[data-theme="dark"] { ' + vars(dark) + ' }',
    'rect.c-bg-rect { fill: var(--bg); }',
  ].join('\n');
  const insert = '<style><![CDATA[\n' + style + '\n]]></style><rect class="c-bg-rect" width="100%" height="100%"/>';
  const rootLen = svg.indexOf('>') + 1;
  svg = svg.slice(0, rootLen) + insert + svg.slice(rootLen);
  const out = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg + '\n';
  if (!wellFormed(out)) throw new Error('SVG nicht wohlgeformt (Tag-Balance)');
  if (Object.keys(light).length < 10) throw new Error('zu wenige Theme-Variablen aufgelöst (' + Object.keys(light).length + ')');
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('diagramm-svg.mjs')) {
  const [input, output, ...rest] = process.argv.slice(2);
  if (!input || !output) { console.error('Aufruf: node tools/docs/diagramm-svg.mjs <eingabe.html> <ausgabe.svg> [--lang de|en]'); process.exit(2); }
  const lang = rest.includes('--lang') ? rest[rest.indexOf('--lang') + 1] : 'de';
  const svg = extractSvg(fs.readFileSync(input, 'utf8'), { lang });
  fs.writeFileSync(output, svg);
  console.log(output + ': ' + Buffer.byteLength(svg) + ' Byte');
}
