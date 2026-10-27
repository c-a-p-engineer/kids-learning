import type { Question } from './engine';
export function makeHint(q: Question): string {
  switch (q.gameId) {
    case 'count': return 'ひとつずつ ゆびで かぞえてみよう。';
    case 'add': return 'まず ひだりの まる、そのあと みぎの まるを かぞえよう。';
    case 'subtract': return 'うすい まるは もう ないよ。のこりを かぞえよう。';
    case 'sequence': return 'となりの かずは いくつ ふえているかな？';
    case 'compare': return 'まるの かずを くらべてみよう。';
    case 'kana': return 'えの なまえを こえに だしてみよう。';
    case 'words': return 'えを みて、なまえを いってみよう。';
    case 'shapes': return 'かど と まるみを よく みよう。';
    case 'memory': return 'さっき みた えを あたまに うかべてみよう。';
    case 'clock': return 'みじかい はりは なんじを さしているかな？';
    case 'bond': return '10まで あと いくつ たりないかな？';
    case 'pattern': return 'おなじ じゅんばんが くりかえされているよ。';
    case 'category': return 'どこで みかける ものかな？';
    case 'odd': return 'いちばん おおい えと ちがう えを さがそう。';
    case 'colors': return 'まわりに おなじ いろの ものは あるかな？';
    case 'trace': return 'あおい スタートから、きいろの わくの なかを ひとふでで なぞろう。';
    case 'lines': return 'まず まっすぐな せんから、ゆっくり なぞってみよう。';
    case 'digits': return 'すうじの あおい スタートから、きいろい みちを なぞろう。';
    case 'blocks': return '5こずつ まとめて かぞえてみよう。';
    case 'train': return 'えの なまえを ゆっくり こえに だしてみよう。';
    case 'move': return 'できる ところだけ まねしてみよう。むりしなくて いいよ。';
    case 'connect': return '1から じゅんに ゆびを はなさず なぞろう。';
    case 'maze': return 'でんしゃから ほしまで みちを なぞってみよう。';
    case 'clockhands': return 'あおい みじかい はりと オレンジの ながい はりを つかんで うごかそう。';
    case 'shop': return '1えん・5えん・10えんを つかって ぴったりに しよう。';
    case 'routine': return 'つぎに なにを するかな？ えを みて ならべよう。';
    case 'split': return 'いしを みぎと ひだりの はこに わけよう。';
    case 'rhythm': return 'いろの じゅんばんを みて たいこを たたこう。';
  }
}
