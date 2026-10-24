# BGM 音频

本目录包含游戏使用的三首 MP3：

| 场景 | 曲名 | 文件 |
| --- | --- | --- |
| 标题画面 / 结算画面 | MiracleMirinaeMirage - 宇宙巫女帰還する | `assets/audio/menu.mp3` |
| 常规波次 / 小怪战 | MiracleMirinaeMirage - 遥か３８万キロのボヤージュ | `assets/audio/normal.mp3` |
| Boss 战 | MiracleMirinaeMirage - パンデモニックプラネット | `assets/audio/boss.mp3` |

游戏在标题、普通战斗、Boss 战与结算之间自动淡入淡出切换，BGM 音量在 `game.js` 的 `BGM_TRACKS` 中调整。

`星海笃行.html` 单文件版由 `tools/build_standalone.py` 构建，构建时会把三首 MP3 以 Base64 内联进 HTML，因此分享单文件时无需额外携带本目录；源码版 `index.html` 则直接读取本目录的 MP3。
