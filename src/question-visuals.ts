import type { Visual } from './engine';
const safe = (s: string): string => s.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
export function dots(n: number, faded = 0): string {
  // Exactly five per group, including 10/15/20. On phones groups wrap rather than shrinking dots.
  let html = '<div class="dot-row dot-groups" aria-hidden="true">';
  for (let start = 0; start < n; start += 5) {
    html += '<span class="dot-pack">';
    for (let i = start; i < Math.min(start + 5, n); i++) {
      html += '<span class="dot' + (i >= n - faded ? ' dot-faded' : '') + '"></span>';
    }
    html += '</span>';
  }
  return html + '</div>';
}
function analogClock(hour: number, minute: number): string {
  const h = (hour % 12) * 30 + minute * 0.5 - 90, m = minute * 6 - 90;
  const hand = (angle: number, radius: number): string => {
    const rad = angle * Math.PI / 180;
    return (100 + Math.cos(rad) * radius).toFixed(1) + ',' + (100 + Math.sin(rad) * radius).toFixed(1);
  };
  let ticks = '';
  for (let i = 1; i <= 12; i++) {
    const pos = hand(i * 30 - 90, 72).split(',');
    ticks += '<text x="' + pos[0] + '" y="' + pos[1] + '" text-anchor="middle" dominant-baseline="middle">' + i + '</text>';
  }
  return '<svg class="clock" viewBox="0 0 200 200" role="img" aria-label="はりの ついた アナログとけい">' +
    '<circle cx="100" cy="100" r="94" fill="#fff" stroke="#8293c8" stroke-width="7"/>' + ticks +
    '<polyline points="100,100 ' + hand(h, 49) + '" stroke="#32436e" stroke-width="9" stroke-linecap="round"/>' +
    '<polyline points="100,100 ' + hand(m, 69) + '" stroke="#ee7593" stroke-width="5" stroke-linecap="round"/>' +
    '<circle cx="100" cy="100" r="7" fill="#32436e"/></svg>';
}
export function visualHtml(visual: Visual, preview: boolean): string {
  const a = visual.a ?? 0, b = visual.b ?? 0;
  switch (visual.kind) {
    case 'dots': return '<div class="visual-group"><span class="floating-symbol">🛡️</span>' + dots(a) + '</div>';
    case 'add': return '<div class="visual-group"><div class="math-line">' + a + ' ＋ ' + b + ' ＝ ❓</div>' +
      '<div class="visual-math">' + dots(a) + '<b>＋</b>' + dots(b) + '</div></div>';
    case 'subtract': return '<div class="visual-group"><div class="math-line">' + a + ' − ' + b + ' ＝ ❓</div>' +
      dots(a, b) + '<small>うすい まるは とった かず</small></div>';
    case 'sequence': return '<div class="track">' + (visual.numbers ?? []).map(n => '<span>' + (n < 0 ? '？' : n) + '</span>').join('') + '</div>';
    case 'compare': return ''; // cards are the answer surface
    case 'picture': return '<div class="big-emoji" aria-hidden="true">' + safe(visual.symbol ?? '') + '</div>';
    case 'shape': return '<div class="big-shape" aria-hidden="true">' + safe(visual.symbol ?? '') + '</div>';
    case 'clock': return analogClock(visual.hour ?? 1, visual.minute ?? 0);
    case 'bond': return '<div class="visual-group"><div class="math-line">' + a +
      ' ＋ ❓ ＝ 10</div>' + dots(a) + '<small>10まで あと いくつ？</small></div>';
    case 'pattern': return '<div class="pattern-line">' +
      (visual.preview ?? []).map(x => '<span>' + safe(x) + '</span>').join('') + '<span class="pattern-missing">❔</span></div>';
    case 'category': return '<div class="big-emoji" aria-hidden="true">' + safe(visual.symbol ?? '') + '</div>';
    case 'odd': return '<div class="odd-line">' +
      (visual.preview ?? []).map((x, i) => '<div class="odd-item"><span>' + safe(x) +
      '</span><strong>' + (i + 1) + '</strong></div>').join('') + '</div>';
    case 'color': return '<div class="color-swatch" style="--swatch:' + safe(visual.symbol ?? '') +
      '" role="img" aria-label="いろの ついた まる"></div>';
    case 'memory': return preview ? '<div class="memory-preview">' + (visual.preview ?? []).map(x => '<span>' + safe(x) + '</span>').join('') + '</div>' :
      '<div class="memory-hidden">✨ ❔ ✨<small>おぼえた えを えらぼう！</small></div>';
  }
  // Interaction-only visuals are rendered by activity-ui.ts, not by this choice renderer.
  return '';
}
