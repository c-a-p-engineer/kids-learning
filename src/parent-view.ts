import { GAMES, countDue } from './engine';
import type { LearningSave } from './engine';
import { parentPeriod } from './parent-report';
import { backupDelta } from './storage';
import type { Backup } from './storage';
const safe = (s: string): string => s.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);

export function parentBody(save: LearningSave, profileName: string, resetArmed: boolean, backupDraft: Backup | null, backupError: string, now = now): string {
  const due = GAMES.reduce((n, game) => n + countDue(game.id, save, now.getTime()), 0);
  const mastered = Object.values(save.reviews).filter(r => r.stage >= 1 && r.correct).length;
  const rows = GAMES.map(game => '<tr><th scope="row">' + safe(game.title) + '</th><td>' +
    (save.completed[game.id] ?? 0) + ' 回</td><td>' + countDue(game.id, save, now.getTime()) + ' 件</td></tr>').join('');
  return '<section class="parent"><h1>ほごしゃダッシュボード</h1><p>' + safe(profileName) +
    ' の端末内記録です。ゲームの点数は診断やIQ測定ではありません。</p>' +
    '<div class="parent-stats"><div><strong>' + save.xp + '</strong><span>経験値</span></div>' +
    '<div><strong>' + save.sessions + '</strong><span>完了セッション</span></div>' +
    '<div><strong>' + due + '</strong><span>復習待ち</span></div>' +
    '<div><strong>' + mastered + '</strong><span>再想起の実績※</span></div></div>' +
    '<p class="footnote">※習得の推定値です。学校の到達度評価や発達診断ではありません。</p>' +
    '<h2>さいきんの きろく</h2><div class="parent-periods">' +
    [7, 30, 90].map(days => {
      const p = parentPeriod(save, now, days);
      return '<div class="parent-period"><strong>' + days + 'にち</strong>' +
        '<span>' + p.days + 'にち がくしゅう</span><span>ひとりで ' + p.independent +
        'こ</span><span>れんしゅう ' + p.practiced + 'こ</span><span>' + p.clears +
        'クリア</span></div>';
    }).join('') + '</div>' +
    '<button type="button" class="secondary-btn" data-action="export-csv">📄 90にちの きろくを CSVに ほぞん</button>' +
    '<h2>ゲーム別の進捗</h2><div class="table-wrap"><table><thead><tr><th>ゲーム</th><th>クリア</th><th>復習待ち</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' +
    '<div class="parent-actions"><button type="button" class="secondary-btn" data-action="export">⬇ このキャラのきろくを ほぞん</button>' +
    '<h2>バックアップから ふくげん</h2>' +
    '<p>このキャラのV2バックアップだけ復元できます。いまの記録は上書きされるので、先に保存してね。</p>' +
    '<label class="backup-file-label" for="backup-file">📂 バックアップJSONを えらぶ</label>' +
    '<input id="backup-file" type="file" accept=".json,application/json" aria-label="バックアップJSONファイル" />' +
    (backupError ? '<p class="backup-error" role="alert">' + safe(backupError) + '</p>' : '') +
    (backupDraft ? '<div class="backup-preview"><strong>ふくげんする データ（かくにん）</strong>' +
      '<p>' + safe(profileName) + '：' + safe(backupDraft.exportedAt.slice(0, 10)) + ' のバックアップ</p>' +
      (() => { const delta = backupDelta(save, backupDraft.data);
        return '<p>XP：' + delta.xp[0] + ' → ' + delta.xp[1] +
          ' / クリア：' + delta.clears[0] + ' → ' + delta.clears[1] +
          ' / きろくの日：' + delta.days[0] + ' → ' + delta.days[1] + '</p>'; })() +
      '<div class="reset-actions"><button type="button" class="danger-btn" data-action="backup-confirm">このキャラに ふくげんする</button>' +
      '<button type="button" class="secondary-btn" data-action="backup-cancel">やめる</button></div></div>' : '') +
    '<h2>きろくの リセット</h2>' +
    '<p>このキャラの学習記録（XP・クリア・復習）だけを最初に戻します。音量設定、ほかの3キャラ、旧版データは残ります。</p>' +
    (resetArmed ? '<div class="reset-confirm" role="alert"><strong>ほんとうに ' + safe(profileName) +
      ' のきろくを けしますか？</strong><p>もどせません。必要なら先に「きろくを ほぞん」してください。</p>' +
      '<div class="reset-actions"><button type="button" class="danger-btn" data-action="reset-now">はい、リセットする</button>' +
      '<button type="button" class="secondary-btn" data-action="reset-cancel">やめる</button></div></div>' :
      '<button type="button" class="reset-open" data-action="reset-open">🗑️ このキャラのきろくを リセット</button>') +
    '<p>旧版の学習記録は削除しません。新版は別のキーに保存しています。</p></div></section>';
}
