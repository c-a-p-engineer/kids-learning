import type { LearningSave } from './engine';
/** Pure settings UI, independent of session, persistence and audio. */
export function optionsBody(settings: LearningSave['settings']): string {
  return '<section class="options-panel">' +
    '<p class="eyebrow">SETTINGS</p><h1>⚙️ せってい</h1>' +
    '<p class="options-lead">もじの おおきさ・おと・バイブを すきな ように かえてね。</p>' +
    '<div class="options-group text-size-options">' +
    '<div class="options-heading"><div><strong>🔤 もじの おおきさ</strong>' +
    '<small>もんだい・こたえ・ヒントの もじを かえられるよ</small></div></div>' +
    '<div class="volume-heading"><label for="text-size">もじの サイズ</label><output id="text-size-output" for="text-size">' +
    settings.textSize + '%</output></div>' +
    '<input type="range" class="volume-slider text-size-slider" id="text-size" data-text-size ' +
    'min="80" max="160" step="10" value="' + settings.textSize +
    '" aria-label="もじの おおきさ" aria-valuetext="' + settings.textSize + 'パーセント" />' +
    '<div class="volume-ends"><span>ちいさく</span><span>おおきく</span></div>' +
    '<div class="text-size-preview" aria-label="もじの サイズ みほん"><span>もんだい：3 ＋ 2 ＝ ❓</span>' +
    '<strong>こたえ：5　どうぶつ</strong><small>ヒント：まるを かぞえてみよう</small></div>' +
    '<button type="button" class="sample-sound" data-action="text-default">100%に もどす</button>' +
    '</div>' +
    '<div class="options-group"><div class="options-heading"><div><strong>🎵 BGM（おんがく）</strong>' +
    '<small>ゲームの あいだに ながれる おんがく</small></div>' +
    '<button type="button" class="toggle-btn" data-action="bgm" aria-pressed="' + settings.bgm +
    '">' + (settings.bgm ? 'ON 🔊' : 'OFF 🔇') + '</button></div>' +
    '<div class="volume-heading"><label for="bgm-volume">BGMの おおきさ</label><output id="bgm-output" for="bgm-volume">' + settings.bgmVolume + '%</output></div>' +
    '<input type="range" class="volume-slider" id="bgm-volume" data-volume="bgm" min="0" max="100" step="5" value="' +
    settings.bgmVolume + '" aria-label="BGMの おおきさ" />' +
    '<div class="volume-ends"><span>ちいさい</span><span>おおきい</span></div></div>' +
    '<div class="options-group"><div class="options-heading"><div><strong>✨ SE（こうかおん）</strong>' +
    '<small>せいかい・タップ・クリアの おと</small></div>' +
    '<button type="button" class="toggle-btn" data-action="sound" aria-pressed="' + settings.sound +
    '">' + (settings.sound ? 'ON 🔊' : 'OFF 🔇') + '</button></div>' +
    '<div class="volume-heading"><label for="se-volume">こうかおんの おおきさ</label><output id="se-output" for="se-volume">' + settings.seVolume + '%</output></div>' +
    '<input type="range" class="volume-slider" id="se-volume" data-volume="se" min="0" max="100" step="5" value="' +
    settings.seVolume + '" aria-label="こうかおんの おおきさ" />' +
    '<div class="volume-ends"><span>ちいさい</span><span>おおきい</span></div>' +
    '<button type="button" class="sample-sound" data-action="test-se">🔔 こうかおんを ためす</button></div>' +
    '<div class="options-group"><div class="options-heading"><div><strong>📳 バイブ（しんどう）</strong>' +
    '<small>せいかい・ざんねん・クリアで ちいさく ふるえるよ。たいおう たんまつだけ。</small></div>' +
    '<button type="button" class="toggle-btn" data-action="haptics" aria-pressed="' + settings.haptics +
    '">' + (settings.haptics ? 'ON 📳' : 'OFF 🌙') + '</button></div>' +
    '<button type="button" class="sample-sound" data-action="test-haptics">📳 バイブを ためす</button></div>' +
    '<div class="options-group"><div class="options-heading"><div><strong>🌟 ひかる えんしゅつ</strong>' +
    '<small>キラキラ・かみふぶきを へらせるよ</small></div>' +
    '<button type="button" class="toggle-btn" data-action="quiet" aria-pressed="' + !settings.quiet +
    '">' + (settings.quiet ? 'OFF 🌙' : 'ON ✨') + '</button></div></div>' +
    '<p class="options-footnote">おとが でないときは、たんまつの おんりょう・マナーモードも かくにんしてね。</p>' +
    '<button type="button" class="primary-btn options-back" data-action="back-options">← ゲームに もどる</button>' +
    '</section>';
}
