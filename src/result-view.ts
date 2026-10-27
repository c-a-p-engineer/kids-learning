import { GAMES, progressFor, MAX_LEVEL, CLEARS_PER_LEVEL } from './engine';
import type { LearningSave } from './engine';
import type { Session } from './session';
const safe = (s: string): string => s.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);

export function resultBody(session: Session, save: LearningSave, profileName: string): string {
  const game = GAMES.find(g => g.id === session?.gameId)!;
  const practice = session.gameId === 'trace' || session.gameId === 'lines' || session.gameId === 'digits' || session.gameId === 'move' || session.gameId === 'connect' || session.gameId === 'maze' || session.gameId === 'routine' || session.gameId === 'rhythm';
  const progress = progressFor(save.completed[game.id] ?? 0);
  const advance = progress.level > session.level;
  const replayLabel = advance ? '🌟 レベル ' + progress.level + ' へ すすむ' :
    '🔁 レベル ' + progress.level + ' を もういちど';
  return '<section class="result-card"><div class="result-emoji" aria-hidden="true">' + game.icon + '🏆</div>' +
    '<p class="eyebrow">QUEST CLEAR!</p><h1>クエスト クリア！</h1>' +
    '<p>' + safe(profileName) + '、' + safe(game.title) + ' を がんばったね！</p>' +
    '<div class="unlock-result">⭐ レベル ' + progress.level + '/' + MAX_LEVEL +
    (advance ? ' 🎊 つぎは レベル ' + progress.level + '！' :
      progress.maxed ? ' 🏆 ぜんレベル かいほう！' :
      ' · つぎまで ' + progress.current + '/' + CLEARS_PER_LEVEL + ' クリア') + '</div>' +
    (practice ?
      '<div class="result-scores"><div><strong>' + session.practiced + '</strong><small>やってみた</small></div>' +
      '<div><strong>' + session.skipped + '</strong><small>おやすみ</small></div>' +
      '<div><strong>' + session.deck.length + '</strong><small>あそんだ かず</small></div></div>' :
      '<div class="result-scores"><div><strong>' + session.right + '</strong><small>ひとりで できた</small></div>' +
      '<div><strong>' + session.helped + '</strong><small>ヒントで できた</small></div>' +
      '<div><strong>' + session.deck.length + '</strong><small>クリアした もんだい</small></div></div>') +
    '<p class="result-explain">' + (practice ?
      'てを うごかしたり、まねしたり。できた ことを たいせつにしよう。' :
      'あしたも おぼえていたら さらに すごい！<br>おぼえているか、また ためしてみよう。') + '</p>' +
    '<button type="button" class="primary-btn" data-action="home">ほかの クエストへ ➜</button>' +
    '<button type="button" class="secondary-btn" data-action="replay">' + replayLabel + '</button></section>';
}
