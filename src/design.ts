/** Layouts translated from assets/village-screens 3 and assets/o-an-quan 2.
 * The interface stays HTML: photographs are atmosphere, never fake content.
 * All actions remain ordinary links, forms and native disclosures. */
export const DESIGN_STYLE = `
body { padding-bottom: 0; }
body:has(.house-page), body:has(.join-page) { min-height: 100svh; }
header.chrome { min-height: 76px; padding: .6rem clamp(1.25rem, 5.25vw, 5.5rem); gap: .5rem 3rem; }
a.brand { text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
nav.site { gap: 0 2rem; }
.whoami { padding-left: 1.5rem; border-left: 1px solid var(--rule); }
.whoami .face { width: 2.25rem; height: 2.25rem; }
button, a, summary { -webkit-tap-highlight-color: transparent; }
button, summary, a { touch-action: manipulation; }
:where(p, h1, h2, h3, a, span) { overflow-wrap: anywhere; }

/* The village is one continuous scene. The copy rests on its open sky. */
.scene-village { min-height: max(760px, calc(100svh - 76px)); padding-top: 2rem; }
.scene-village::after { background: linear-gradient(to bottom, color-mix(in srgb, var(--paper) 67%, transparent), transparent 43%); }
.scene-village .scene-copy { color: var(--ink); text-shadow: none; }
.scene-village .scene-eyebrow { color: var(--sage-deep); margin-bottom: .2rem; }
.scene-village h1 { font-size: clamp(3.5rem, 5.7vw, 5.5rem); letter-spacing: -.06em; }
.scene-village .lede { color: var(--ink); font-family: var(--display); max-width: 44rem; font-size: clamp(1rem, 1.45vw, 1.5rem); }
.scene-village .scene-sub { color: var(--ink); background: none; padding: .15rem; max-width: 36rem; backdrop-filter: none; -webkit-backdrop-filter: none; line-height: 1.65; }
.scene-village .scene-hint { color: var(--ink); text-shadow: none; font-weight: 500; bottom: 12%; font-size: 1.7rem; }
.float-card { padding: .85rem 1.2rem; gap: .7rem; border-radius: 13px; }
.float-card .float-name { font-size: 1.18rem; }
.float-card .float-meta { display: flex; align-items: center; gap: .65rem; line-height: 1.45; font-size: .74rem; }
.float-meta .faces { flex-shrink: 0; }
.float-card .float-go, .float-card[data-kind="meeting"] .float-go { background: var(--sage-deep); width: 2rem; height: 2rem; flex-shrink: 0; font-size: 1.4rem; }
.village-foot { padding: .8rem 1.25rem 1.1rem; margin: 0 auto; font-size: .75rem; }
@media (min-width: 900px) {
  .scene-cards li { width: clamp(12.2rem, 15.2vw, 17rem); }
  .scene-cards li:nth-child(1) { left: 6.9%; top: 33%; }
  .scene-cards li:nth-child(2) { left: 37.8%; top: 40%; width: clamp(12rem, 12.2vw, 15rem); }
  .scene-cards li:nth-child(3) { left: 55.6%; top: 43%; width: clamp(12rem, 13vw, 15rem); }
  .scene-cards li:nth-child(4) { right: 5.4%; top: 32.7%; width: clamp(15.5rem, 16vw, 18rem); }
}

/* The family rooms share the reference's full-height photographic setting. */
.house-page { position: relative; isolation: isolate; min-height: calc(100svh - 76px); padding-bottom: 2rem; }
.house-page > .scene-room { position: static; isolation: auto; overflow: visible; min-height: 0; padding: 2rem clamp(1.5rem, 7vw, 8rem) 0; }
.house-page > .scene-room > .scene-photo { position: fixed; top: 0; right: 0; bottom: 0; left: 0; height: 100svh; z-index: -2; object-position: center; }
.house-page > .scene-room::before, .house-page > .scene-room::after { z-index: -1; border-radius: 0; }
.house-page > .scene-room::after { background: linear-gradient(to bottom, transparent 52%, color-mix(in srgb, var(--ink) 12%, transparent)); }
.home-page > .scene-room::before { background: linear-gradient(100deg, color-mix(in srgb, var(--paper) 91%, transparent), transparent 43%); }
.home-page .scene-copy { color: var(--ink); text-shadow: none; max-width: none; }
.home-page .scene-back, .home-page .scene-presence, .home-page .scene-eyebrow, .home-page .scene-copy .lede { color: var(--ink); }
.home-page .scene-copy h1 { font-size: clamp(2.5rem, 4vw, 4rem); letter-spacing: -.05em; }
.home-page .scene-copy .lede { font-family: var(--display); max-width: 24rem; }
.home-page .scene-eyebrow { font-size: .65rem; margin-top: .5rem; }
.home-page .scene-presence { margin-top: 1rem; }
.home-page > .scene-room { min-height: min(61svh, 540px); }
.room-hotspots { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
a.room-hotspot { position: absolute; top: 190px; right: 8%; display: flex; align-items: center; gap: 1rem; background: var(--paper); color: var(--ink); padding: 1rem 1.3rem; min-height: 72px; border-radius: 13px; box-shadow: var(--shadow-float); text-decoration: none; pointer-events: auto; }
a.room-hotspot:not(.album-hotspot) { top: 325px; right: 46%; }
.room-hotspot strong, .room-hotspot small { display: block; }
.room-hotspot strong { font-family: var(--display); font-size: .9rem; }
.room-hotspot small { font-size: .75rem; margin-top: .2rem; }
.hotspot-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px; font-size: 1.6rem; background: var(--hearth-fill); color: var(--on-hearth); }
.album-hotspot .hotspot-icon { background: var(--sage-deep); }
.home-page .layout-house { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 390px; gap: 1.25rem; max-width: 100rem; padding: 0 2rem; margin: 0 auto; align-items: start; }
.room-collection { min-width: 0; }
.home-page .room-collection { padding: 1.5rem; background: var(--paper); border-radius: 20px; box-shadow: var(--shadow-float); }
.room-collection > h2 { font-size: 1.15rem; margin: 0 0 1rem; }
.home-page #room > ol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.home-page li.thing { margin: 0; padding: 1.2rem; background: color-mix(in srgb, var(--paper) 68%, var(--card)); transform: none; }
.home-page .thing .body { font-family: var(--hand); font-size: 1.35rem; }
.panel-stack { min-width: 0; }
.memory-compose { padding: 1.5rem; margin: 0; background: var(--paper); border-radius: 20px; box-shadow: var(--shadow-float); }
.memory-compose h2 { font-size: 1.15rem; margin: 0 0 .6rem; }
.memory-compose label { font-size: .8rem; }
.memory-compose textarea { resize: vertical; min-height: 120px; }
.memory-compose button { justify-self: end; }
.memory-guide { font-size: .8rem; margin: 0 0 1rem; background: var(--paper); border-radius: 10px; }
.memory-guide summary { cursor: pointer; min-height: 44px; padding: .75rem 1rem; }
.memory-guide .card, .memory-guide .card-raised { border: 0; background: none; box-shadow: none; padding: .8rem 1rem; }
.memory-guide h3 { font-size: 1rem; margin-top: 0; }
.panel-stack > .quiet { background: var(--paper); padding: .6rem 1rem; border-radius: 8px; margin-top: .7rem; font-size: .75rem; }

/* An actual game and conversation side by side, with scores from GameView. */
.meeting-page { padding: 0 1.5rem 2rem; display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 1.5rem; align-items: start; }
.meeting-page > .scene-room { grid-column: 1 / -1; padding: 1.1rem 1rem 0; }
.meeting-page > .scene-room::before { background: linear-gradient(110deg, color-mix(in srgb, var(--scene-shadow) 75%, transparent), transparent 70%); }
.meeting-page .scene-copy { max-width: none; }
.meeting-page .scene-copy h1 { font-size: clamp(2.25rem, 3.5vw, 3.5rem); }
.meeting-page .scene-copy .scene-eyebrow { display: none; }
.meeting-page .scene-copy .lede { margin: .5rem 0; max-width: none; }
.meeting-page .scene-presence { font-size: .8rem; margin: .6rem 0; }
.meeting-page .table-area { max-width: none; width: 100%; padding: 1.65rem; margin: 0; background: var(--paper); border-radius: 20px; display: flex; flex-direction: column; gap: 1.25rem; box-shadow: var(--shadow-float); min-width: 0; align-items: stretch; }
.table-side > .card { border: 0; padding: 0; background: none; box-shadow: none; }
.table-side .rule-title { margin: 0; font-size: 1.7rem; }
.meeting-page:has(.board) .scene-copy h1 { font-size: 2.3rem; }
.meeting-page:has(.board) .scene-copy .lede { font-size: .9rem; }
.meeting-page:has(.board) .table-side .rule-title { font-size: 1rem; }
.meeting-page:has(.board) .table-side .rule-title .note { display: inline; font-size: .75rem; margin-left: .5rem; }
.table-side > .card { position: relative; }
.table-side > .card > form { float: right; }
.table-side .rule-title .note { display: block; font-family: var(--body); margin-top: .2rem; }
.table-side > .card > form { display: inline-flex; margin: .7rem 0 0; }
.table-side > .card > .note { font-size: .75rem; margin: .3rem 0; }
ul.chairs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; margin: 1.25rem 0 .5rem; }
li.chair { border: 1px solid var(--rule); background: var(--paper); border-radius: 12px; min-height: 82px; padding: 1rem; }
li.chair:has(.chair-name) { background: color-mix(in srgb, var(--sage) 6%, var(--paper)); }
.chair .face { width: 2.5rem; height: 2.5rem; }
li.chair .chair-score { font-size: 1.5rem; color: var(--sage-deep); }
.chair-score small { display: block; font: .65rem var(--body); color: var(--ink-soft); }
.board-status { padding: .8rem 1rem; border-radius: 8px; background: color-mix(in srgb, var(--sage) 10%, var(--paper)); color: var(--sage-deep); font-size: .9rem; }
.board-wrap { padding: .3rem 0; }
.board { gap: .5rem; padding: 1rem .8rem; background: var(--board); border: 2px solid var(--board-edge); box-shadow: inset 0 3px 12px color-mix(in srgb, var(--ink) 8%, transparent); border-radius: 160px; }
.board-rows { gap: .5rem; }
ul.pit-row { gap: .5rem; }
.pit { min-height: clamp(100px, 8vw, 136px); background: var(--pit); box-shadow: inset 0 0 0 1px var(--board-edge); border-radius: 10px; flex-direction: column; }
.pit-count { font: .85rem var(--body); position: absolute; bottom: .5rem; color: var(--ink); }
a.pit-pick { display: flex; flex-direction: column; background: var(--pit); box-shadow: inset 0 0 0 1px var(--board-edge); border-radius: 10px; }
a.pit-pick:hover { background: var(--paper); }
a.pit-pick[aria-current] { background: var(--paper); }
.pit-stones { position: relative; display: grid; grid-template-columns: repeat(3, 16px); gap: 7px; justify-content: center; align-content: center; max-width: 100%; padding: 8px 0 22px; }
.stone { display: block; width: 16px; height: 13px; border-radius: 48% 55% 44% 50%; background: var(--pebble); transform: rotate(-17deg); }
.stone:nth-child(2n) { background: var(--board-edge); transform: rotate(23deg); }
.stone:nth-child(3n) { transform: translateY(4px) rotate(-32deg); }
.quan-end { width: 10%; flex-shrink: 0; }
.quan-end .pit { width: 100%; border: 2px solid var(--board-edge); min-height: 100%; border-radius: 120px 0 0 120px; box-shadow: none; }
.quan-end:last-child .pit { border-radius: 0 120px 120px 0; }
.pit-quan, .pit-quan[data-stones="0"] { background: transparent; }
.pit-quan .pit-count, .pit-quan[data-stones="0"] .pit-count { color: var(--ink); bottom: 18%; }
.quan-stone { display: grid; place-items: center; width: 40px; height: 49px; border-radius: 50%; background: var(--hearth-fill); color: var(--on-hearth); font-size: .9rem; font-weight: 700; }
.quan-label { position: absolute; bottom: 7%; font-size: .6rem; letter-spacing: .05em; color: var(--ink); }
.pit-quan .pit-stones:not(:empty) { position: absolute; top: 15%; padding: 0; grid-template-columns: repeat(3, 10px); gap: 3px; }
.pit-quan .stone { width: 10px; height: 9px; }
.pit-quan .quan-stone + .pit-stones:empty { display: none; }
.board-side-label { font-size: .65rem; margin: .65rem 0; }
.move-guidance { margin-top: 1.5rem; }
.move-guidance .hand { font-size: 1.6rem; margin-bottom: .35rem; }
form.sow { gap: .75rem; justify-content: end; }
form.sow button { min-width: 140px; }
form.sow .cancel { order: -1; margin-right: auto; display: inline-flex; align-items: center; min-height: 44px; }
.meeting-page .layout-house { background: var(--paper); border-radius: 18px; margin: 0; max-width: none; padding: 1.3rem; display: flex; flex-direction: column; gap: .75rem; box-shadow: var(--shadow-float); }
.meeting-page .room-collection > h2 { font-size: 1.3rem; padding-bottom: 1rem; border-bottom: 1px solid var(--rule); }
.meeting-page .layout-house .lede { font-size: .8rem; line-height: 1.6; }
.meeting-page li.thread-msg { border: 0; background: none; box-shadow: none; padding: 0; gap: .5rem; margin: 0 0 1.4rem; }
.thread-msg .monogram { width: 1.9rem; height: 1.9rem; min-width: 1.9rem; font-size: .85rem; }
.thread-body > .body { background: color-mix(in srgb, var(--card) 45%, var(--paper)); border-radius: 0 12px 12px 12px; padding: .8rem; font-size: .87rem; line-height: 1.6; }
.thread-meta { gap: .2rem .5rem; font-size: .75rem; }
.thread-meta .chip-home { font-size: .6rem; padding: .1rem .35rem; }
.thread-msg .state, .thread-msg .note, .thread-msg .state-text { font-size: .7rem; }
.thread-msg .inline-perspective { display: grid; }
.thread-msg .inline-perspective input { min-width: 0; width: 100%; }
.meeting-page .panel-stack { width: 100%; display: flex; flex-direction: column; }
.meeting-page .memory-guide { order: 3; margin: .5rem 0; border: 1px solid var(--rule); }
.meeting-page .panel-stack > .quiet { order: 4; padding: 0; }
.meeting-page form.say { margin: .5rem 0 0; }
.meeting-page form.say input { width: 0; }

/* Native details gives the reference drawer a functional, script-free close. */
details.rules { margin-top: .75rem; }
details.rules > summary { display: flex; justify-content: space-between; gap: 1rem; padding: .5rem .9rem; border: 1px solid var(--rule); border-radius: 8px; width: fit-content; font-size: .85rem; }
details.rules[open] { position: fixed; z-index: 50; top: 90px; right: 24px; width: min(910px, calc(100vw - 48px)); max-height: calc(100svh - 114px); overflow-y: auto; margin: 0; padding: 1.75rem; background: var(--paper); border: 1px solid var(--rule); border-radius: 18px; box-shadow: 0 0 0 100vmax color-mix(in srgb, var(--ink) 48%, transparent), var(--shadow-float); }
details.rules[open] > summary { margin-left: auto; }
details.rules[open] > summary::after { content: '×'; font-size: 1.4rem; }
.rules-body { gap: 1.4rem 2rem; padding-top: .75rem; }
.rules-body > h3, .rules-legend, .capture-example { grid-column: 1 / -1; }
.rules-body > h3 { font-size: 1.75rem; margin: 0; }
.rules-body .rules-legend { padding: .75rem 1rem; background: color-mix(in srgb, var(--sage) 10%, var(--paper)); border-radius: 8px; font-size: .8rem; }
.rules-body h4 { font-size: 1rem; margin: 0 0 .6rem; }
.rules-body p { font-size: .85rem; line-height: 1.6; }
.rules-body .rule { margin: 0; }
.capture-example { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--card); border-radius: 8px; font-size: .8rem; flex-wrap: wrap; }
.example-pit { padding: .7rem 1rem; background: var(--pit); border: 1px solid var(--board-edge); border-radius: 6px; }
.example-capture { background: color-mix(in srgb, var(--sage) 10%, var(--paper)); border-color: var(--sage); }

/* Shelf albums are navigation; every memory card still contains real records. */
.shelf-page { max-width: 100rem; padding: 2rem clamp(1.25rem, 4vw, 4rem) 4rem; }
.shelf-head { margin-top: 0; }
.shelf-head-copy { max-width: 52rem; }
.shelf-head h1 { font-size: clamp(2.5rem, 4vw, 4rem); letter-spacing: -.045em; }
.shelf-head .lede { font: 1.15rem/1.6 var(--display); margin-bottom: .4rem; }
.shelf-decoration { display: flex; align-items: center; gap: 1.5rem; }
.shelf-decoration figure { width: 190px; transform: rotate(7deg); background: var(--paper); padding: 10px; box-shadow: var(--shadow-2); margin: 0; }
.shelf-decoration img { width: 100%; height: 115px; object-fit: cover; display: block; }
.shelf-decoration figcaption { font: 1rem var(--hand); padding-top: .3rem; color: var(--ink-soft); text-align: center; }
.shelf-aside { font-size: 1.65rem; }
form.shelf-filters { gap: .85rem; margin: 1.5rem 0 .6rem; }
form.shelf-filters select, form.shelf-filters input, form.shelf-filters button { min-height: 44px; }
form.shelf-filters select { min-width: 150px; }
form.shelf-filters input { width: 260px; max-width: 100%; }
.shelf-count { margin: .6rem 0 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--rule); }
.shelf-layout { display: grid; grid-template-columns: minmax(180px, 230px) minmax(0, 1fr); gap: 1.5rem; }
.house-albums { display: grid; gap: 1rem; align-content: start; }
a.house-album { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1.5rem 1rem; background: var(--sage-deep); color: var(--paper); border-radius: 7px; box-shadow: var(--shadow-2); text-decoration: none; border-left: 5px solid color-mix(in srgb, var(--ink) 25%, transparent); }
.house-album[data-house="hanoi"] { background: var(--hearth-deep); }
.house-album[data-house="canberra"] { background: var(--ink-soft); }
.house-album[data-house="meeting"] { background: var(--ink); }
.album-name { font: 1.15rem var(--display); }
.house-album > span:last-child { font-size: .65rem; text-transform: uppercase; letter-spacing: .1em; }
.shelf-memories { min-width: 0; }
.shelf-memories > .empty { background: var(--card); border: 1px dashed var(--rule); padding: 3rem; border-radius: 10px; font-size: 1.1rem; }
ol.wall { columns: 3 15rem; }
li.card-shelf { background: var(--paper); padding-top: 1.25rem; border-radius: 7px; box-shadow: var(--shadow-2); }
.card-shelf-body > .body { font: 1.5rem/1.4 var(--hand); padding: .8rem 0; }
.card-shelf .thing-title { line-height: 1.5; }
.card-shelf-who .state { font-size: .75rem; }

.join-page { max-width: 36rem; padding: 4rem 2rem; margin: 5vh auto; background: var(--paper); border: 1px solid var(--rule); border-radius: 18px; box-shadow: var(--shadow-2); }
.join-page h1 { font-size: 3rem; margin-top: .5rem; }
body:has(.join-page) { background: linear-gradient(color-mix(in srgb, var(--paper) 15%, transparent), color-mix(in srgb, var(--paper) 15%, transparent)), url('/img/village-1200.webp') center / cover fixed; padding-bottom: 3rem; }
/* A compact room composition keeps the board inside the first viewport. */
header.chrome { position: relative; z-index: 20; min-height: 72px; padding-top: .4rem; padding-bottom: .4rem; }
nav.site a, nav.site form.leave button { font-weight: 500; font-size: .84rem; }
nav.site form.leave button { color: var(--ink-soft); }
a.brand { font-size: 1.25rem; letter-spacing: -.04em; }
.meeting-page { grid-template-columns: minmax(0, 1fr) 324px; gap: 20px; padding: 0 28px 28px; }
.meeting-page > .scene-room { padding: .65rem .4rem; }
.meeting-page .scene-copy { display: flex; align-items: center; flex-wrap: wrap; gap: .25rem 1.4rem; }
.meeting-page .scene-back { font-size: .75rem; }
.meeting-page .scene-copy h1, .meeting-page:has(.board) .scene-copy h1 { font: 1rem/1.4 var(--display); letter-spacing: -.02em; margin: 0; }
.meeting-welcome { display: none; }
.meeting-page .scene-copy .lede { display: none; }
.meeting-page .scene-copy .scene-presence { margin: 0 0 0 auto; font-size: .75rem; }
.meeting-page .table-area { position: relative; padding: 28px 30px 24px; gap: 18px; border-radius: 16px; box-shadow: var(--shadow-float); }
.game-title-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-right: 320px; }
.game-title-row .eyebrow { font-size: .61rem; letter-spacing: .17em; margin: 0 0 .3rem; }
.game-title-row .rule-title, .meeting-page:has(.board) .table-side .rule-title { font-size: 1.85rem; line-height: 1.3; margin: 0; letter-spacing: -.045em; }
.game-attendance { font-size: .72rem; color: var(--ink-soft); margin: .8rem 0 0; white-space: nowrap; }
.table-side > .card { position: static; }
ul.chairs { gap: 20px; margin: 22px 0 14px; }
li.chair { min-height: 80px; padding: 14px 18px; border: 1px solid var(--rule); background: var(--paper); gap: .8rem; }
li.chair:has(.chair-name) { background: var(--paper); }
li.chair[data-turn="true"] { background: color-mix(in srgb, var(--sage) 7%, var(--paper)); border-color: color-mix(in srgb, var(--sage) 55%, var(--rule)); }
li.chair .chair-name { font-size: .9rem; font-weight: 600; }
.chair-name small { display: block; font-size: .69rem; color: var(--ink-soft); font-weight: 400; padding-top: .2rem; }
.chair .face { width: 38px; height: 38px; font-size: 1rem; }
li.chair .chair-score { font-size: 1.5rem; line-height: 1.4; }
.chair-score small { font-size: .62rem; }
.game-legend { display: flex; gap: 1.3rem; align-items: center; color: var(--ink-soft); font-size: .7rem; margin: 0; }
.game-legend span { display: inline-flex; gap: .4rem; align-items: center; }
.game-legend strong { font-weight: 500; color: var(--ink); }
.legend-dan { display: block; width: 10px; height: 8px; border-radius: 50%; background: var(--pebble); }
.legend-quan { display: block; width: 10px; height: 13px; border-radius: 50%; background: var(--hearth-fill); }
.game-options { position: absolute; top: 30px; right: 180px; z-index: 5; }
.game-options > summary { min-height: 44px; display: flex; align-items: center; gap: .6rem; font-size: .74rem; color: var(--ink-soft); padding: .4rem .8rem; cursor: pointer; border-radius: 7px; }
.game-options > summary::after { content: '⌄'; }
.game-options[open] { background: var(--paper); box-shadow: var(--shadow-2); border: 1px solid var(--rule); border-radius: 10px; }
.game-options > div { padding: 0 .8rem .8rem; width: 230px; }
.game-options form { margin: .5rem 0; }
.game-options button { width: 100%; font-size: .8rem; }
.game-options .note { font-size: .72rem; }
.table-board > details.rules:not([open]) { position: absolute; top: 28px; right: 30px; margin: 0; }
.table-board > details.rules > summary { font-size: .74rem; }
.board-status { font-size: .81rem; padding: .75rem .9rem; margin: 0 0 8px; display: flex; align-items: center; gap: .6rem; }
.board-status::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--sage); flex-shrink: 0; }
.board-side-label { margin: .5rem 0; font-size: .6rem; letter-spacing: .08em; }
.board { padding: 12px 10px; border-radius: 140px; border-width: 1.5px; gap: .45rem; }
.pit { min-height: clamp(94px, 8.3vw, 132px); border-radius: 8px; }
a.pit-pick { border-radius: 8px; }
a.pit-pick[aria-current] { box-shadow: inset 0 0 0 2.5px var(--hearth), 0 2px 6px color-mix(in srgb, var(--ink) 10%, transparent); }
.pit-stones { grid-template-columns: repeat(3, 18px); gap: 8px; }
.stone { width: 18px; height: 14px; box-shadow: inset 0 -1px 1px color-mix(in srgb, var(--ink) 8%, transparent); }
.stone:nth-child(1) { translate: -2px 2px; }
.stone:nth-child(4) { translate: 5px 0; }
.stone:nth-child(5) { translate: 1px 3px; }
.count-on-quan { opacity: 0; }
.move-guidance { margin: 16px 0 0; position: relative; padding-right: 310px; min-height: 56px; }
.move-guidance .hand { font-size: 1.45rem; margin: 0 0 .25rem; }
.move-guidance .note { font-size: .73rem; margin: 0; }
.move-guidance:has(form.sow) { min-height: 66px; }
form.sow { position: absolute; top: 0; right: 0; margin: 0; display: grid; grid-template-columns: auto 130px 130px; gap: .4rem .6rem; }
form.sow button { min-width: 0; font-size: .8rem; padding: .65rem .8rem; }
form.sow .cancel { order: -1; grid-column: auto; justify-self: end; font-size: .7rem; min-height: 44px; padding: .2rem; text-decoration: none; }
form.sow .cancel:hover { text-decoration: underline; }
.move-guidance:has(form.sow) { padding-right: 415px; padding-bottom: 0; }

/* The conversation has a quiet empty state, and actions disclose on demand. */
.meeting-page .layout-house { border-radius: 16px; padding: 22px; min-height: min(740px, calc(100svh - 176px)); gap: 0; }
.meeting-page .room-collection { flex: 1; width: 100%; }
.meeting-page .room-collection > h2 { font-size: 1.18rem; margin-bottom: 14px; padding-bottom: 16px; }
.meeting-page #who { font-size: .7rem; color: var(--ink-soft); margin: 0 0 22px; }
.conversation-empty { text-align: center; padding: 52px 10px 32px; }
.conversation-empty svg { color: var(--sage); margin-bottom: 14px; opacity: .65; }
.conversation-empty .hand { font-size: 1.6rem; margin: 0 0 .55rem; }
.conversation-empty .empty { color: var(--ink-soft); font-size: .8rem; line-height: 1.65; margin-bottom: .5rem; }
.conversation-empty .note { font-size: .72rem; line-height: 1.65; }
.meeting-page form.say { margin: 1rem 0 0; gap: .45rem; padding-top: 14px; border-top: 1px solid var(--rule); }
.meeting-page form.say input { font-size: .8rem; padding: .6rem .7rem; }
.meeting-page form.say button { font-size: .77rem; padding: .6rem .75rem; }
.meeting-page .memory-guide { border: 0; border-radius: 0; font-size: .69rem; margin: 8px 0 0; }
.meeting-page .memory-guide summary { padding: .55rem 0; }
.meeting-page .memory-guide .body-sm, .meeting-page .memory-guide .consequence { font-size: .75rem; }
.meeting-page .panel-stack > .quiet { margin: 0; font-size: .67rem; line-height: 1.6; font-style: normal; }
.typing { font-size: .7rem; min-height: .75rem; margin: .25rem 0 0; }
.meeting-page li.thread-msg { margin: 0 0 1.3rem; }
.thread-body > .body { background: var(--card); padding: 11px 13px; border-radius: 0 10px 10px 10px; font-size: .81rem; margin-bottom: .35rem; }
.thread-body .state-row { margin: 0; }
.thread-body .state-row .note { display: none; }
.thread-body .state { font-size: .6rem; letter-spacing: 0; font-weight: 500; }
.message-actions > summary, .memory-actions > summary { min-height: 44px; cursor: pointer; color: var(--ink-soft); font-size: .68rem; padding: .4rem 0; }
.message-actions[open] > summary, .memory-actions[open] > summary { color: var(--hearth-deep); }
.message-actions form.inline-perspective { margin: .2rem 0 .5rem; }
.thread-msg .inline-perspective button, .thread-msg .inline-perspective input { font-size: .75rem; min-height: 44px; }

/* Before anyone plays, the room itself is the main event. */
.meeting-page:not(:has(.board)) { min-height: calc(100svh - 72px); grid-template-rows: 1fr auto; padding-top: 28px; }
.meeting-page:not(:has(.board)) > .scene-room { grid-column: 1; grid-row: 1; padding: 26px 30px 42px; }
.meeting-page:not(:has(.board)) .scene-copy { display: block; }
.meeting-page:not(:has(.board)) .scene-copy .scene-eyebrow { display: block; margin: 20px 0 14px; font-size: .7rem; }
.meeting-page:not(:has(.board)) .meeting-name { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.meeting-page:not(:has(.board)) .meeting-welcome { display: block; font: 700 clamp(3rem, 4.2vw, 4.5rem)/1.15 var(--display); letter-spacing: -.055em; }
.meeting-page:not(:has(.board)) .scene-copy .lede { display: block; max-width: 340px; margin: 20px 0; font-size: 1rem; line-height: 1.65; }
.meeting-page:not(:has(.board)) .scene-copy .scene-presence { margin: 20px 0 0; }
.meeting-page:not(:has(.board)) > .layout-house { grid-column: 2; grid-row: 1 / span 2; min-height: calc(100svh - 128px); }
.meeting-page:not(:has(.board)) > #table { grid-column: 1; grid-row: 2; padding: 26px 30px; }
.game-invitation { display: grid; grid-template-columns: 1fr minmax(220px, 38%); gap: 16px; align-items: center; }
.game-invitation .eyebrow { font-size: .65rem; letter-spacing: .15em; margin: 0 0 8px; }
.game-invitation .rule-title { font-size: 2rem; letter-spacing: -.045em; margin: 0 0 10px; }
.game-invitation .body-sm { font-size: .87rem; line-height: 1.65; max-width: 325px; color: var(--ink-soft); }
.game-facts { display: flex; align-items: center; gap: .55rem; font-size: .7rem; color: var(--ink-soft); }
.game-invitation form { display: inline-flex; margin: 8px 0 0; }
.game-invitation form button { font-size: .8rem; min-height: 44px; padding: .7rem 1.1rem; }
.game-invitation form button span { margin-left: 18px; }
.game-illustration { width: 100%; height: auto; transform: rotate(-8deg); filter: drop-shadow(0 6px 8px color-mix(in srgb, var(--ink) 8%, transparent)); fill: var(--pebble); }
.cover-board { fill: var(--board); stroke: var(--board-edge); }
.cover-pit { fill: var(--pit); stroke: var(--board-edge); stroke-width: .6px; }
.cover-end { fill: none; stroke: var(--board-edge); stroke-width: .8px; }
.cover-quan { fill: var(--hearth-fill); }
.meeting-page:not(:has(.board)) .table-board { padding-right: 190px; }
.meeting-page:not(:has(.board)) .table-board > .board-status { background: none; color: var(--ink-soft); font-size: .7rem; padding: 0; margin: 0; }
.meeting-page:not(:has(.board)) .table-board > .board-status::before { display: none; }
.meeting-page:not(:has(.board)) .table-board > details.rules:not([open]) { top: auto; bottom: 22px; right: 30px; }

/* Less chrome lets the room and the notes carry the home page. */
.home-page .scene-copy .scene-eyebrow { color: var(--ink-soft); letter-spacing: .14em; }
.home-page .scene-copy h1 { letter-spacing: -.055em; font-size: clamp(3rem, 4.3vw, 4.5rem); }
.home-page .scene-copy .lede { font-size: 1.15rem; line-height: 1.55; max-width: 340px; }
.home-page .room-collection { border-radius: 16px; padding: 23px; }
.home-page #room > .lede { font-size: .75rem; margin-bottom: 1rem; }
.home-page li.thing { padding: 18px; border-radius: 5px; border-color: var(--rule); box-shadow: var(--shadow-1); border-left-width: 1px; }
.home-page .thing-title { font-size: .95rem; }
.home-page .thing .body { font-size: 1.4rem; margin: 1rem 0; line-height: 1.45; }
.home-page .thing .meta { font-size: .69rem; }
.home-page .state, .home-page .state-text > .note { font-size: .7rem; }
.home-page .panel-stack { display: flex; flex-direction: column; margin-top: -48px; }
.home-page .memory-compose { order: -1; padding: 24px; border-radius: 16px; gap: .55rem; }
.memory-compose h2 { font-size: 1.08rem; margin-bottom: .5rem; }
.memory-compose input, .memory-compose textarea { font-size: .8rem; background: transparent; border-width: 1px; }
.memory-compose textarea { min-height: 100px; }
.memory-compose label { font-size: .75rem; }
.memory-compose button { font-size: .8rem; padding: .65rem 1rem; margin-top: .25rem; }
.optional-date summary { min-height: 44px; display: flex; align-items: center; gap: .5rem; font-size: .75rem; color: var(--ink-soft); cursor: pointer; }
.optional-date summary::before { content: '+'; font-size: 1rem; }
.optional-date label { display: block; margin-bottom: .4rem; }
.optional-date input { width: 100%; }
.home-page .memory-guide { background: none; box-shadow: none; margin: 10px 0 0; }
.home-page .memory-guide summary { background: var(--paper); border-radius: 9px; font-size: .7rem; padding: .6rem 1rem; }
.home-page .memory-guide[open] { background: var(--paper); border-radius: 9px; }
.home-page .panel-stack > .quiet { font-size: .68rem; margin-top: .5rem; }

/* Albums become a short shelf of spines rather than a tall navigation wall. */
.shelf-page { padding-top: 36px; }
.shelf-head h1 { font-size: clamp(2.7rem, 4vw, 3.8rem); letter-spacing: -.055em; margin-bottom: 14px; }
.shelf-head .eyebrow { font-size: .65rem; letter-spacing: .16em; margin-bottom: 10px; }
.shelf-head .lede { font-size: 1.18rem; color: var(--ink); }
.shelf-head .note { font-size: .85rem; max-width: 570px; line-height: 1.65; }
.shelf-head-copy { max-width: 58%; }
.shelf-aside { font-size: 1.45rem; font-weight: 500; }
.shelf-decoration figure { width: 210px; }
.shelf-decoration img { height: 130px; }
.shelf-count { font-size: .75rem; }
.shelf-layout { display: flex; flex-direction: column; gap: 24px; }
.house-albums { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
a.house-album { position: relative; min-height: 124px; align-items: start; padding: 24px 22px 20px; gap: 18px; border-radius: 5px 9px 9px 5px; border-left-width: 7px; overflow: hidden; box-shadow: var(--shadow-1); }
a.house-album::after { content: ''; position: absolute; inset: 0 0 0 4px; border-left: 1px solid color-mix(in srgb, var(--paper) 17%, transparent); pointer-events: none; }
.house-album svg { position: absolute; width: 50px; height: 66px; right: 18px; bottom: 9px; opacity: .65; }
.album-name { position: relative; z-index: 1; max-width: calc(100% - 34px); font-size: 1.05rem; line-height: 1.5; }
.house-album > span:last-child { font-size: .61rem; letter-spacing: .12em; }
.shelf-memories > .empty { padding: 42px 30px; background: none; text-align: center; border: 0; font-size: 1rem; line-height: 1.7; max-width: 620px; margin: 1rem auto; }
ol.wall { columns: 3 18rem; column-gap: 22px; }
li.card-shelf { border-left: 1px solid var(--rule); padding-top: 12px; box-shadow: var(--shadow-1); }
.card-shelf-body > .body { font-size: 1.4rem; }
.card-shelf-body .thing-title { font-size: 1.08rem; }
.card-shelf .state { font-size: .7rem; }

@media (prefers-reduced-motion: no-preference) {
  .scene-village .scene-copy, .room-collection { animation: settle-in .4s ease-out both; }
  .float-card, .room-hotspot, .house-album { transition: transform .2s ease, box-shadow .2s ease; }
  .room-hotspot:hover, .house-album:hover { transform: translateY(-3px); box-shadow: var(--shadow-float); }
  details.rules[open] { animation: drawer-in .22s ease-out; }
  @keyframes settle-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes drawer-in { from { opacity: 0; translate: 16px 0; } to { opacity: 1; translate: 0 0; } }
}
@media (max-width: 1100px) {
  header.chrome { gap: .25rem 1.5rem; padding: .6rem 1.25rem; }
  nav.site { gap: 0 1rem; }
  .meeting-page { grid-template-columns: minmax(0, 1fr) 290px; padding: 0 1rem 2rem; gap: 1rem; }
  .meeting-page .table-area { padding: 1.1rem; }
  .home-page .layout-house { grid-template-columns: minmax(0, 1fr) 340px; padding: 0 1rem; }
  .home-page #room > ol { grid-template-columns: 1fr; }
  .shelf-decoration figure { display: none; }
  ul.chairs { gap: .6rem; }
  li.chair { padding: .7rem; flex-wrap: wrap; }
  .shelf-layout { grid-template-columns: 170px minmax(0, 1fr); }
}
@media (max-width: 899px) {
  .scene-village { min-height: calc(100svh - 120px); padding: 2rem 1.25rem; }
  .scene-village::after { background: linear-gradient(color-mix(in srgb, var(--paper) 80%, transparent), transparent); }
  .scene-cards { padding: 0; max-width: 36rem; width: 100%; margin: 1.8rem auto 0; gap: .65rem; }
  .float-card .float-meta br { display: none; }
  .float-card .float-name { font-size: 1.1rem; }
  .meeting-page { display: block; }
  .meeting-page > .scene-room { padding: 1.5rem .5rem; }
  .meeting-page .layout-house { margin-top: 1.25rem; }
  .home-page .layout-house { grid-template-columns: 1fr; }
  .home-page > .scene-room { min-height: 470px; padding: 1.5rem; }
  a.room-hotspot { right: 4%; top: 300px; }
  a.room-hotspot:not(.album-hotspot) { right: auto; left: 4%; top: 300px; }
  .home-page .panel-stack { display: flex; flex-direction: column; }
  .home-page .memory-compose { order: -1; margin-bottom: 1rem; }
  .home-page .room-collection { padding: 1.1rem; }
  .shelf-decoration { display: none; }
}
@media (max-width: 600px) {
  header.chrome { gap: .15rem .8rem; padding: .4rem 1rem; }
  .brand { font-size: 1.15rem; }
  .whoami { font-size: .75rem; padding-left: .5rem; }
  nav.site { order: 3; width: 100%; gap: .15rem .8rem; justify-content: space-between; }
  nav.site a, nav.site form.leave button { font-size: .7rem; }
  .scene-village h1 { font-size: 3.4rem; }
  .scene-village .lede { font-size: 1rem; }
  .scene-village .scene-sub { font-size: .8rem; }
  .scene-village .scene-copy { padding: 0 .3rem; }
  .scene-cards { margin-top: 1.5rem; }
  .float-card .float-meta { font-size: .73rem; }
  .home-page .scene-eyebrow { max-width: 230px; line-height: 1.6; }
  .home-page .scene-copy .lede { max-width: 270px; font-size: 1rem; }
  .home-page > .scene-room { min-height: 510px; }
  .room-hotspots { inset: auto; position: relative; display: grid; gap: .65rem; margin: 1rem 0; }
  a.room-hotspot, a.room-hotspot:not(.album-hotspot) { position: static; padding: .7rem 1rem; min-height: 64px; }
  .room-hotspot > span:last-child { margin-left: auto; }
  .house-page > .scene-room > .scene-photo { top: 0; height: 100svh; object-position: 40% top; }
  .home-page .layout-house { padding: 0 .8rem; }
  .meeting-page { padding: 0 .6rem 1rem; }
  .meeting-page .table-area { padding: .9rem; }
  .meeting-page .table-side .rule-title { font-size: 1.4rem; }
  .chair .face { width: 1.75rem; height: 1.75rem; }
  li.chair .chair-name { font-size: .75rem; flex-basis: 60%; }
  li.chair .chair-score { font-size: 1.15rem; margin-left: auto; }
  .board-status { font-size: .8rem; }
  .move-guidance .note { font-size: .75rem; }
  .board { min-width: 24rem; padding: .6rem .4rem; gap: .25rem; }
  .board-rows, ul.pit-row { gap: .25rem; }
  .pit { min-height: 84px; }
  .quan-stone { width: 28px; height: 36px; font-size: .7rem; }
  .board-wrap::before { content: "Swipe to see the whole board ↔"; display: block; font-size: .7rem; color: var(--ink-soft); margin-bottom: .4rem; }
  .pit-stones { grid-template-columns: repeat(3, 12px); gap: 4px; }
  .stone { width: 12px; height: 10px; }
  details.rules[open] { inset: 1rem .75rem auto; width: auto; max-height: calc(100svh - 2rem); padding: 1rem; }
  .rules-body { display: block; }
  .rules-body > h3 { font-size: 1.4rem; margin: 1rem 0; }
  .rules-body .rule, .capture-example { margin: 1rem 0; }
  .shelf-page { padding: 1.5rem 1rem; }
  .shelf-head h1 { font-size: 2.3rem; }
  .shelf-head .lede { font-size: 1rem; }
  form.shelf-filters { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; }
  form.shelf-filters input, form.shelf-filters select { width: 100%; min-width: 0; }
  form.shelf-filters > div:nth-child(3) { grid-column: 1 / -1; }
  .shelf-layout { display: flex; flex-direction: column; }
  .house-albums { display: grid; grid-template-columns: 1fr 1fr; }
  a.house-album { padding: 1rem .5rem; gap: .5rem; }
  .house-album svg { height: 50px; }
  .album-name { font-size: .95rem; }
  ol.wall { columns: 1; }
  .shelf-memories > .empty { padding: 1.5rem; font-size: 1rem; }
  .join-page { margin: 1rem; padding: 2rem 1.25rem; }
  .join-page h1 { font-size: 2.4rem; }
}
@media (min-width: 1200px) {
  body:has(.scene-village) header.chrome { position: absolute; top: 0; left: 32%; right: 0; z-index: 10; padding: .6rem 30px; gap: 1.5rem; border-radius: 0 0 0 13px; box-shadow: var(--shadow-1); }
  body:has(.scene-village) nav.site a[href="/"] { display: none; }
  body:has(.scene-village) nav.site { gap: 1.5rem; }
  body:has(.scene-village) .whoami { padding-left: 1rem; font-size: .75rem; }
  .scene-village { min-height: 100svh; padding-top: 112px; }
  .scene-cards li:nth-child(1) { top: 37%; }
  .scene-cards li:nth-child(2) { top: 44%; }
  .scene-cards li:nth-child(3) { top: 47%; }
  .scene-cards li:nth-child(4) { top: 36.5%; width: 17.5rem; }
  .float-card[data-kind="meeting"] .float-name { font-size: 1.05rem; white-space: nowrap; }
}
@media (max-width: 1199px) and (min-width: 900px) {
  .game-title-row { padding-right: 265px; display: block; }
  .game-attendance { margin: 4px 0 0; }
  .meeting-page .table-area { padding: 22px; }
  .game-options { right: 160px; top: 24px; }
  .game-options > summary { font-size: .7rem; padding: .4rem; }
  .table-board > details.rules:not([open]) { right: 22px; top: 22px; }
  .table-board > details.rules > summary { max-width: 130px; line-height: 1.35; }
  .move-guidance { padding-right: 0; }
  form.sow { position: static; display: flex; margin-top: .9rem; }
  .move-guidance:has(form.sow) { padding-right: 0; padding-bottom: 0; }
}
@media (max-width: 899px) {
  header.chrome { min-height: 72px; }
  .meeting-page { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; padding: 0 16px 24px; }
  .meeting-page > .scene-room { grid-column: 1; grid-row: auto; padding: 14px 6px; }
  .meeting-page .scene-copy { gap: 0 1rem; }
  .meeting-page .scene-copy .scene-presence { flex-basis: 100%; margin: .25rem 0 0; }
  .meeting-page .layout-house { margin-top: 0; min-height: 360px; }
  .meeting-page .table-area { padding: 24px; }
  .meeting-page:not(:has(.board)) { grid-template-rows: auto; min-height: calc(100svh - 72px); padding-top: 0; }
  .meeting-page:not(:has(.board)) > .scene-room { grid-column: 1; grid-row: auto; padding: 20px 8px 26px; }
  .meeting-page:not(:has(.board)) .meeting-welcome { font-size: 3.3rem; }
  .meeting-page:not(:has(.board)) > #table { grid-column: 1; grid-row: auto; padding: 24px; }
  .meeting-page:not(:has(.board)) > .layout-house { grid-column: 1; grid-row: auto; min-height: 360px; }
  .meeting-page:not(:has(.board)) .table-board { padding-right: 180px; }
  .conversation-empty { padding: 20px 12px; }
  .game-title-row { padding-right: 300px; }
  .game-options { top: 24px; right: 180px; }
  .table-board > details.rules:not([open]) { top: 24px; right: 24px; }
  .move-guidance { padding-right: 280px; }
  .home-page > .scene-room { min-height: 470px; }
  .home-page .panel-stack { margin-top: 0; }
  .shelf-head-copy { max-width: 100%; }
  .house-albums { gap: 12px; }
  a.house-album { padding: 18px 16px; }
  .album-name { font-size: .9rem; }
  .house-album svg { right: 8px; width: 38px; height: 50px; }
}
@media (max-width: 600px) {
  header.chrome { min-height: 0; padding: 10px 16px 0; gap: 0 12px; }
  a.brand { font-size: 1.1rem; }
  .whoami { padding-left: .7rem; font-size: .7rem; }
  .whoami .face { width: 30px; height: 30px; min-width: 30px; font-size: .75rem; }
  nav.site { display: grid; grid-template-columns: repeat(4, auto); gap: 0 12px; overflow: visible; }
  nav.site a, nav.site form.leave button { font-size: .64rem; white-space: nowrap; line-height: 1.25; }
  nav.site form.leave button { width: 100%; text-align: left; }
  .meeting-page { padding: 0 10px 18px; gap: 14px; }
  .meeting-page > .scene-room { padding: 8px 6px 10px; }
  .meeting-page .scene-copy h1, .meeting-page:has(.board) .scene-copy h1 { font-size: .85rem; }
  .meeting-page .scene-back { font-size: .7rem; }
  .meeting-page .scene-copy .scene-presence { font-size: .66rem; }
  .meeting-page .table-area { padding: 19px 16px; gap: 15px; border-radius: 13px; }
  .game-title-row { padding-right: 0; display: block; padding-bottom: 54px; }
  .game-title-row .rule-title, .meeting-page:has(.board) .table-side .rule-title { font-size: 1.7rem; }
  .game-attendance { position: absolute; top: 21px; right: 16px; font-size: .62rem; margin: 0; }
  .game-title-row .eyebrow { font-size: .56rem; }
  .game-options { top: 82px; left: 12px; right: auto; }
  .game-options summary { font-size: .7rem; }
  .table-board > details.rules:not([open]) { top: 80px; right: 16px; }
  .table-board > details.rules > summary { font-size: .7rem; }
  ul.chairs { gap: 10px; margin: 12px 0; }
  li.chair { padding: 12px; min-height: 84px; gap: .5rem; flex-wrap: nowrap; position: relative; padding-right: 42px; }
  li.chair .chair-name { font-size: .73rem; flex-basis: auto; }
  .chair-name small { font-size: .59rem; }
  .chair .face { width: 24px; height: 24px; min-width: 24px; font-size: .7rem; }
  li.chair .chair-score { position: absolute; right: 10px; top: 17px; font-size: 1.1rem; }
  .chair-score small { font-size: .5rem; }
  li.chair-empty { padding-right: 10px; flex-direction: column; align-items: start; justify-content: center; gap: .3rem; }
  li.chair-empty .chair-name { font-size: .7rem; }
  li.chair-empty button { font-size: .7rem; padding: .35rem .65rem; }
  .game-legend { font-size: .61rem; gap: .9rem; }
  .board-status { font-size: .74rem; line-height: 1.65; padding: .65rem .7rem; }
  .board { min-width: 24rem; padding: 10px 6px; }
  .pit { min-height: 90px; }
  .pit-stones { grid-template-columns: repeat(3, 12px); gap: 4px; }
  .stone { width: 12px; height: 10px; }
  .board-side-label { font-size: .55rem; }
  .board-wrap::before { font-size: .64rem; margin-bottom: 10px; }
  .move-guidance { padding-right: 0; margin-top: 12px; }
  .move-guidance .hand { font-size: 1.35rem; }
  .move-guidance .note { font-size: .66rem; line-height: 1.6; }
  form.sow { position: static; margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; }
  form.sow button { font-size: .76rem; }
  .move-guidance:has(form.sow) { padding-right: 0; padding-bottom: 0; }
  .meeting-page .layout-house { padding: 20px; min-height: 410px; }
  .meeting-page:not(:has(.board)) .meeting-welcome { font-size: 2.8rem; }
  .meeting-page:not(:has(.board)) .scene-copy .scene-eyebrow { font-size: .62rem; margin-top: 10px; }
  .meeting-page:not(:has(.board)) .scene-copy .lede { font-size: .85rem; max-width: 280px; margin: 14px 0; }
  .meeting-page:not(:has(.board)) > #table { padding: 22px; }
  .game-invitation { grid-template-columns: 1fr; gap: 0; position: relative; }
  .game-invitation-copy { position: relative; z-index: 1; }
  .game-invitation .rule-title { font-size: 1.8rem; }
  .game-invitation .body-sm { font-size: .8rem; max-width: 220px; }
  .game-facts { font-size: .64rem; gap: .45rem; }
  .game-illustration { position: absolute; width: 140px; top: -5px; right: 8px; opacity: .25; rotate: 12deg; }
  .meeting-page:not(:has(.board)) .table-board { padding: 0; }
  .meeting-page:not(:has(.board)) .table-board > .board-status { margin-bottom: 44px; font-size: .65rem; line-height: 1.5; }
  .meeting-page:not(:has(.board)) .table-board > details.rules:not([open]) { bottom: 14px; right: 22px; top: auto; }
  .home-page > .scene-room { min-height: 470px; padding: 18px 22px 0; }
  .home-page .scene-copy h1 { font-size: 3rem; }
  .home-page .scene-copy .lede { font-size: .95rem; max-width: 270px; }
  .home-page .scene-eyebrow { font-size: .6rem; max-width: 260px; }
  .home-page .room-collection { padding: 18px; border-radius: 13px; }
  .home-page .memory-compose { padding: 21px; border-radius: 13px; }
  .home-page .memory-guide { margin-top: 0; }
  .shelf-page { padding-top: 26px; }
  .shelf-head h1 { font-size: 2.6rem; }
  .shelf-head .lede { font-size: 1rem; }
  .shelf-head .note { font-size: .77rem; }
  .house-albums { grid-template-columns: 1fr 1fr; gap: 12px; }
  a.house-album { min-height: 105px; padding: 17px; gap: 12px; align-items: start; }
  .album-name { max-width: calc(100% - 20px); font-size: .88rem; }
  .house-album > span:last-child { font-size: .55rem; }
  .house-album svg { height: 43px; width: 33px; bottom: 9px; }
  .shelf-memories > .empty { padding: 20px 12px; font-size: .85rem; }
  .capture-example { gap: .6rem; font-size: .7rem; }
  .example-pit { padding: .7rem .6rem; }
  .rules-body > h3 { font-size: 1.45rem; }
}

@media (min-width: 900px) and (max-height: 820px) {
  .meeting-page > .scene-room { padding-top: .35rem; padding-bottom: .35rem; }
  .meeting-page .table-area { padding: 20px 24px; gap: 12px; }
  .game-title-row .rule-title, .meeting-page:has(.board) .table-side .rule-title { font-size: 1.55rem; }
  .game-options { top: 20px; }
  .table-board > details.rules:not([open]) { top: 20px; right: 24px; }
  ul.chairs { margin: 16px 0 10px; }
  li.chair { min-height: 68px; padding: 10px 15px; }
  .board-status { margin-bottom: 4px; padding: .6rem .8rem; }
  .pit { min-height: 90px; }
  .board-side-label { margin: .3rem 0; }
  .move-guidance { margin-top: 12px; }
  .meeting-page .layout-house { min-height: calc(100svh - 150px); }
}

.nav-short { display: none; }
@media (max-width: 600px) {
  .nav-full { display: none; }
  .nav-short { display: inline; }
  nav.site { grid-template-columns: repeat(3, 1fr) auto; gap: 0 10px; }
  nav.site a, nav.site form.leave button { font-size: .67rem; }
  nav.site form.leave button { min-width: 44px; justify-content: end; }
  form.sow .cancel { order: 2; grid-column: 1 / -1; justify-self: center; }
}

.house-page:has(details.rules[open]) { z-index: 30; }
details.rules[open] > summary { position: sticky; top: 0; z-index: 2; background: var(--paper); }
.room-empty { display: flex; align-items: start; gap: 18px; padding: 24px 2px 8px; }
.room-empty > svg { flex: 0 0 36px; color: var(--sage); opacity: .7; margin-top: 6px; }
.room-empty .hand { font-size: 1.55rem; margin: 0 0 8px; }
.room-empty .note { font-size: .8rem; line-height: 1.7; max-width: 520px; margin: 0; }
.room-empty a, .shelf-empty a { display: inline-flex; align-items: center; min-height: 44px; font-size: .77rem; text-underline-offset: 4px; }
.shelf-empty { text-align: center; padding: 28px 20px; max-width: 560px; margin: 1rem auto; }
.shelf-empty > svg { color: var(--sage); opacity: .65; margin-bottom: 12px; }
.shelf-empty h2 { font-size: 1.4rem; margin: 0 0 14px; letter-spacing: -.035em; }
.shelf-empty .empty { font-size: .83rem; line-height: 1.8; margin: 0 0 10px; }
@media (max-width: 600px) {
  .board { min-width: 21rem; }
  .room-empty { gap: 12px; padding: 12px 0; }
  .room-empty > svg { flex-basis: 28px; width: 28px; }
  .room-empty .hand { font-size: 1.35rem; }
  .room-empty .note { font-size: .75rem; }
  .shelf-empty { padding: 20px 4px; }
  .shelf-empty h2 { font-size: 1.2rem; }
}
@media (min-width: 380px) and (max-width: 600px) {
  .board-wrap::before { display: none; }
}

`;
