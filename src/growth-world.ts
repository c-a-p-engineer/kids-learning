import { GAMES, unlockedLevel } from './engine';
import type { LearningSave } from './engine';

const STATIONS = [
  { at: 0, icon: '🚉', name: 'ちいさな えき', story: 'ぼうけんの はじまり！' },
  { at: 2, icon: '🚂', name: 'きつね ごう', story: 'れっしゃが やってきた！' },
  { at: 5, icon: '🌳', name: 'みどりの こうえん', story: 'えきの となりに こうえん！' },
  { at: 10, icon: '🌈', name: 'にじの はし', story: 'れっしゃの せかいが ひろがる！' },
  { at: 20, icon: '🏡', name: 'あたらしい まち', story: 'おうちが ふえたよ！' },
  { at: 40, icon: '🏰', name: 'まなびの おしろ', story: 'すてきな おしろが みえた！' }
] as const;
export function worldProgress(save: LearningSave) {
  const clears = GAMES.reduce((n, game) => n + (save.completed[game.id] ?? 0), 0);
  const unlocked = STATIONS.filter(s => clears >= s.at).length;
  const next = STATIONS.find(s => clears < s.at);
  return { clears, unlocked, total: STATIONS.length, next: next?.at ?? null };
}
export function worldHtml(save: LearningSave): string {
  const progress = worldProgress(save);
  const items = STATIONS.map(s => {
    const ready = progress.clears >= s.at;
    return '<div class="station-stop' + (ready ? ' reached' : ' waiting') +
      '" aria-label="' + s.name + (ready ? ' かいほう' : ' あと' + (s.at - progress.clears) + 'かい') + '">' +
      '<div class="station-art">' + (ready ? s.icon : '🔒') + '</div>' +
      '<div class="station-copy"><strong>' + s.name + '</strong><span>' +
      (ready ? s.story : 'あと ' + (s.at - progress.clears) + 'かい クリア') +
      '</span></div></div>';
  }).join('');
  const top = GAMES.filter(game => unlockedLevel(save.completed[game.id] ?? 0) >= 2)
    .slice(0, 4).map(game => game.icon + ' ' + game.title).join('　') || 'これから みつけよう！';
  return '<section class="station-world"><button type="button" class="growth-back" data-action="home">← ホームへ</button>' +
    '<h1>🚂 みんなの まなび てつどう</h1>' +
    '<p class="growth-lead">いろんな クエストを クリアすると、えきと まちが ひろがるよ！</p>' +
    '<div class="station-header"><span>🚉 ' + progress.unlocked + '/' + progress.total +
    ' こ みつけた！</span><span>🏆 ' + progress.clears + ' かい クリア</span></div>' +
    '<div class="station-rail">' + items + '</div>' +
    '<p class="station-footer">' + (progress.next === null ? '🌟 すべての えきを みつけたよ！' :
    'つぎの えきまで あと ' + (progress.next - progress.clears) + ' かい！') + '</p>' +
    '<h2>レベルが あがった ゲーム</h2><p class="station-favorites">' + top + '</p>' +
    '<button type="button" class="primary-btn" data-action="skills">🌳 スキルツリーから あそぶ</button>' +
    '<p class="growth-note">えきは学習のクリア数に応じて決まった順に増えます。ガチャやログインの義務はありません。休みの日に減ることもありません。</p></section>';
}
