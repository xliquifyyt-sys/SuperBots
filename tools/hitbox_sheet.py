import base64, cv2, json
SP='/tmp/claude-0/-home-user-SuperBots/ecbb4a5a-5a11-5688-a626-127b16c03285/scratchpad'
ext=json.load(open(f'{SP}/sprite_extent.json'))
HIT={'light':0.62,'medium':0.7,'heavy':0.8}
MASS={'light':'0.70','medium':'1.00','heavy':'1.60'}
BOTS=[
 ('bulwark','Bulwark','heavy','Heavy tank',140,'#4f7cff'),
 ('magmaw','Magmaw','heavy','Heavy brawler',140,'#ff5a1f'),
 ('volt','Volt','medium','Medium marksman',130,'#ffe23a'),
 ('warden','Warden','medium','Medium defender',130,'#3ddc97'),
 ('skyla','Skyla','medium','Medium aerial',130,'#8fd3ff'),
 ('gravitas','Gravitas','medium','Control',130,'#9aa4b8'),
 ('phantom','Phantom','light','Light assassin',120,'#c46bff'),
 ('ricochet','Ricochet','light','Light trickster',120,'#ff4fa3'),
]
def uri(bid):
    im=cv2.imread(f'{SP}/hb/{bid}.png')
    im=im[50:990, 50:990]                      # 3.13 world units across: fits the widest sprite with a margin
    im=cv2.resize(im,(680,680),interpolation=cv2.INTER_AREA)
    ok,buf=cv2.imencode('.jpg', im, [cv2.IMWRITE_JPEG_QUALITY,88])
    return 'data:image/jpeg;base64,'+base64.b64encode(buf.tobytes()).decode()

GROUPS=[('heavy','Heavy'),('medium','Medium'),('light','Light')]
sections=[]
for wk, wname in GROUPS:
    rows=[]
    for bid,name,w,cls,hp,color in BOTS:
        if w!=wk: continue
        sw,sh=ext[bid]
        reach=HIT[w]/(sw/2)*100
        rows.append(f'''
      <article class="bot" style="--bot:{color}">
        <figure><img src="{uri(bid)}" alt="{name} with its collision body and hit circle drawn over the sprite" loading="lazy"><figcaption>{name}</figcaption></figure>
        <div class="facts">
          <h3>{name}</h3>
          <p class="cls">{cls} &middot; {hp} HP</p>
          <dl>
            <div><dt>Collision body</dt><dd class="c-body">0.50</dd></div>
            <div><dt>Hit circle</dt><dd class="c-hit">{HIT[w]:.2f}</dd></div>
            <div><dt>Sprite width</dt><dd>{sw:.2f}</dd></div>
            <div><dt>Sprite height</dt><dd>{sh:.2f}</dd></div>
          </dl>
          <p class="reach"><span class="bar"><i style="width:{reach:.0f}%"></i></span><b>{reach:.0f}%</b> of the painted half-width sits inside the hit circle</p>
        </div>
      </article>''')
    hr=f'{HIT[wk]:.2f}'
    sections.append(f'''
  <section class="group" id="{wk}">
    <div class="group-head">
      <h2>{wname}</h2>
      <p>Hit circle <b class="c-hit">{hr}</b> &middot; collision body <b class="c-body">0.50</b> &middot; mass &times;{MASS[wk]}</p>
    </div>
    <div class="grid">{''.join(rows)}</div>
  </section>''')

legend_img = uri('warden')
page = f'''<title>Super Bots Hitbox Sheet</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root{{
  --ground:#eef1f5; --surface:#ffffff; --sunk:#e3e8ef; --line:#c6d0dc; --line-soft:#dde4ec;
  --ink:#111820; --ink-2:#3e4b5c; --ink-3:#6c7a8c;
  --c-body:#0d8ba3; --c-hit:#cc3a3a;
  --display:"Chakra Petch","Segoe UI",system-ui,sans-serif;
  --body:"IBM Plex Sans",system-ui,-apple-system,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{
  --ground:#0d1218; --surface:#151c26; --sunk:#101720; --line:#2a3543; --line-soft:#1e2833;
  --ink:#e6edf6; --ink-2:#a8b6c6; --ink-3:#74839a;
  --c-body:#3fe9ff; --c-hit:#ff5f5f;
}}}}
:root[data-theme="dark"]{{
  --ground:#0d1218; --surface:#151c26; --sunk:#101720; --line:#2a3543; --line-soft:#1e2833;
  --ink:#e6edf6; --ink-2:#a8b6c6; --ink-3:#74839a;
  --c-body:#3fe9ff; --c-hit:#ff5f5f;
}}
*{{box-sizing:border-box}}
body{{background:var(--ground);color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.6;margin:0;padding-block:0 80px;padding-inline:20px}}
.wrap{{max-width:1020px;margin:0 auto}}
.c-body{{color:var(--c-body)}} .c-hit{{color:var(--c-hit)}}

header{{padding-block:48px 26px;border-bottom:2px solid var(--ink)}}
.eyebrow{{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3)}}
h1{{font-family:var(--display);font-size:clamp(32px,5.4vw,46px);line-height:1.04;margin:6px 0 12px;text-wrap:balance}}
header>p{{max-width:62ch;color:var(--ink-2);margin:0}}

.legend{{display:grid;grid-template-columns:minmax(0,260px) 1fr;gap:26px;align-items:center;padding-block:28px;border-bottom:1px solid var(--line)}}
.legend img{{display:block;width:100%;max-width:100%;height:auto;border:1px solid var(--line);background:var(--sunk)}}
.keys{{display:flex;flex-direction:column;gap:14px}}
.key{{display:grid;grid-template-columns:30px 1fr;gap:14px;align-items:start}}
.swatch{{height:30px;border-radius:50%;margin-top:2px}}
.swatch.body{{border:3px solid var(--c-body)}}
.swatch.hit{{border:3px dashed var(--c-hit)}}
.swatch.art{{border:3px solid var(--line);border-radius:4px}}
.key b{{font-family:var(--display);font-size:15px;display:block}}
.key p{{margin:0;font-size:14px;color:var(--ink-2)}}

.constants{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin-block:26px}}
.constants div{{background:var(--surface);padding:12px 14px}}
.constants dt{{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)}}
.constants dd{{margin:2px 0 0;font-family:var(--mono);font-size:19px;font-weight:600;font-variant-numeric:tabular-nums}}

.group{{padding-block:34px 10px}}
.group+.group{{border-top:1px solid var(--line-soft)}}
.group-head{{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 18px;margin-bottom:18px}}
.group-head h2{{font-family:var(--display);font-size:26px;margin:0;letter-spacing:.02em}}
.group-head p{{margin:0;font-family:var(--mono);font-size:13px;color:var(--ink-2)}}
.group-head b{{font-weight:600}}

.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px}}
.bot{{display:grid;grid-template-columns:minmax(0,196px) 1fr;gap:16px;align-items:start;background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--bot);padding:14px}}
.bot figure{{margin:0}}
.bot img{{display:block;width:100%;max-width:100%;height:auto;background:var(--sunk)}}
.bot figcaption{{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);padding-top:6px}}
.facts h3{{font-family:var(--display);font-size:20px;margin:0}}
.cls{{margin:0 0 10px;font-size:13px;color:var(--ink-3)}}
.facts dl{{margin:0;display:grid;gap:3px}}
.facts dl div{{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dotted var(--line);padding-bottom:2px}}
.facts dt{{font-size:13px;color:var(--ink-2)}}
.facts dd{{margin:0;font-family:var(--mono);font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}}
.reach{{margin:12px 0 0;font-size:12.5px;color:var(--ink-2);line-height:1.45}}
.reach b{{font-family:var(--mono);color:var(--ink)}}
.bar{{display:block;height:5px;background:var(--sunk);border:1px solid var(--line);margin-bottom:7px}}
.bar i{{display:block;height:100%;background:var(--c-hit)}}

footer{{margin-top:34px;padding-top:22px;border-top:1px solid var(--line);font-size:14px;color:var(--ink-2);max-width:66ch}}
footer h2{{font-family:var(--display);font-size:18px;margin:0 0 8px;color:var(--ink)}}
footer p{{margin:0 0 10px}}
footer code{{font-family:var(--mono);font-size:13px;background:var(--sunk);padding:1px 5px;border:1px solid var(--line-soft)}}
@media (max-width:430px){{.legend{{grid-template-columns:1fr}}.bot{{grid-template-columns:1fr}}}}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">Super Bots &middot; collision reference &middot; build v37</div>
  <h1>Every bot, measured</h1>
  <p>Two circles decide what happens to a bot. One stops it against terrain, the other is what a shot has to reach. They are not the same size, and neither matches the painted art. All figures are in world units, where one unit is one grid square on the map sheet.</p>
</header>

<div class="legend">
  <img src="{legend_img}" alt="Warden drawn at 150 pixels per world unit with both circles and a half-unit grid">
  <div class="keys">
    <div class="key"><span class="swatch body"></span><div><b>Collision body, solid cyan</b><p>Radius 0.50 for every bot. This is what platforms, ramps and walls push against, and what decides whether a gap is passable.</p></div></div>
    <div class="key"><span class="swatch hit"></span><div><b>Hit circle, dashed red</b><p>What a missile, blast or mine must reach to deal damage. It scales with weight class, so heavier bots are easier to hit.</p></div></div>
    <div class="key"><span class="swatch art"></span><div><b>Grid and ground line</b><p>Faint lines are half a unit apart. The dashed horizontal line is where the bot rests on a surface.</p></div></div>
  </div>
</div>

<dl class="constants">
  <div><dt>Collision radius</dt><dd>0.50</dd></div>
  <div><dt>Hit radius, light</dt><dd class="c-hit">0.62</dd></div>
  <div><dt>Hit radius, medium</dt><dd class="c-hit">0.70</dd></div>
  <div><dt>Hit radius, heavy</dt><dd class="c-hit">0.80</dd></div>
  <div><dt>Sprite scale</dt><dd>1.25&times;</dd></div>
</dl>
{''.join(sections)}

<footer>
  <h2>Reading the sheet</h2>
  <p>The painted sprites are wider than both circles, by design: a cannon barrel, a wing or a shield emitter can overlap an enemy without either bot registering a touch. The bar on each card shows how far the hit circle reaches across the sprite's own half-width, so a low number means more of what you see is cosmetic.</p>
  <p>Ricochet reads truest at 82%, because it is drawn as a ball. Warden reads loosest at 46%, since its shield emitter and harpoon stretch well past the body. If shots look like they should connect and do not, that gap is why.</p>
  <p>Both radii live in <code>PHYS</code> in <code>src/core/defs.js</code>. The collision radius is shared by every bot; the hit radii are keyed to weight class in <code>PHYS.hitRadius</code>.</p>
</footer>
</div>
'''
open(f'{SP}/hitbox-sheet.html','w').write(page)
print(len(page)//1024,'KB')
