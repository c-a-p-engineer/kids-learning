/** A visible stroke is always backed by the same ordered waypoints used for input validation. */
export type Point = readonly [number, number];
export interface Guide { label: string; strokes: readonly (readonly Point[])[]; }
export const TRACE_GUIDES: Record<string, Guide> = {
  'まっすぐ': { label: 'たての せん', strokes: [
    [[120,34],[120,56],[120,78],[120,100],[120,122],[120,144],[120,166],[120,188],[120,210]]
  ] },
  'よこ': { label: 'よこの せん', strokes: [
    [[32,120],[54,120],[76,120],[98,120],[120,120],[142,120],[164,120],[186,120],[208,120]]
  ] },
  'カーブ': { label: 'カーブ', strokes: [
    [[47,49],[66,44],[90,49],[114,69],[129,95],[135,125],[147,152],[170,173],[200,179]]
  ] },
  'なみ': { label: 'なみの せん', strokes: [
    [[30,124],[48,98],[70,83],[91,96],[109,126],[127,150],[148,155],[168,133],[188,103],[211,97]]
  ] },
  'ぐるり': { label: 'ぐるっと カーブ', strokes: [
    [[126,45],[94,49],[67,68],[52,100],[52,133],[68,160],[95,176],[129,179],[159,161],[178,132],[176,101]]
  ] },
  'く': { label: 'く', strokes: [
    [[185,40],[160,60],[135,82],[109,103],[83,122],[112,145],[140,168],[164,189],[184,207]]
  ] },
  'し': { label: 'し', strokes: [
    [[87,38],[87,64],[87,91],[87,119],[88,146],[94,174],[112,193],[138,198],[165,188],[185,166]]
  ] },
  'つ': { label: 'つ', strokes: [
    [[43,102],[66,92],[92,85],[119,82],[146,87],[173,101],[187,124],[180,151],[158,171],[129,179],[102,176]]
  ] },
  'へ': { label: 'へ', strokes: [
    [[39,160],[60,138],[81,109],[103,78],[123,91],[145,114],[167,138],[187,159],[204,171]]
  ] },
  'こ': { label: 'こ', strokes: [
    [[56,77],[80,71],[106,67],[133,67],[159,69],[185,75]],
    [[56,156],[72,171],[97,179],[125,181],[153,178],[183,165]]
  ] },
  'い': { label: 'い', strokes: [
    [[68,52],[65,80],[65,108],[68,136],[81,164],[107,179]],
    [[155,67],[165,83],[174,103],[185,127]]
  ] },
  // One continuous stroke: descend diagonally, round the lower left, arc right, turn up and inward.
  // The guide no longer makes a second loop or incorrectly crosses the start.
  'の': { label: 'の', strokes: [
    [[122,57],[101,73],[81,96],[67,123],[62,149],[73,171],
     [96,186],[125,186],[152,173],[175,152],[181,126],[174,102],
     [159,81],[140,72],[121,84],[111,104]]
  ] },
  'て': { label: 'て', strokes: [
    [[39,81],[69,79],[100,78],[132,74],[165,69],[198,64],[169,87],
     [149,107],[135,129],[130,153],[145,175],[171,185],[190,180]]
  ] }
};
export type TraceGlyph = keyof typeof TRACE_GUIDES;
export const PREWRITING = ['まっすぐ','よこ','カーブ','なみ','ぐるり'] as const;
export const KANA = ['く','し','つ','へ','こ','い','の','て'] as const;
/** One source of truth for the drawing and the allowed corridor. */
export function strokePath(points: readonly Point[]): string {
  return points.map(([x,y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ');
}
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const denominator = dx * dx + dy * dy;
  const t = denominator === 0 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / denominator));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}
export function distanceToStroke(point: Point, points: readonly Point[]): number {
  let min = Infinity;
  for (let i = 1; i < points.length; i++) {
    min = Math.min(min, distanceToSegment(point, points[i - 1], points[i]));
  }
  return min;
}
// 240×240 SVG coordinate system. A child may wobble inside this ~46px full-width lane.
// Completely leaving it fails only the current stroke, without XP or level penalty.
export const CORRIDOR_RADIUS = 23;
export const START_RADIUS = 25;
export const END_RADIUS = 29;
