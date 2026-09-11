import base64, cv2, json
SP='/tmp/claude-0/-home-user-SuperBots/ecbb4a5a-5a11-5688-a626-127b16c03285/scratchpad'
ext=json.load(open(f'{SP}/sprite_extent.json'))
import re
hulls=json.loads(re.search(r'BOT_HULLS = (.*);', open('/home/user/SuperBots/src/core/hulls.js').read()).group(1))
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
        H=hulls[bid]; xs=[q[0] for q in H]; ys=[q[1] for q in H]
        hw=max(xs)-min(xs); hh=max(ys)-min(ys)
        cover=hw/sw*100
        rows.append(f'''
      <article class="bot" style="--bot:{color}">
        <figure><img src="{uri(bid)}" alt="{name} with its collision body and hit circle drawn over the sprite" loading="lazy"><figcaption>{name}</figcaption></figure>
        <div class="facts">
          <h3>{name}</h3>
          <p class="cls">{cls} &middot; {hp} HP</p>
          <dl>
            <div><dt>Outline width</dt><dd class="c-body">{hw:.2f}</dd></div>
            <div><dt>Outline height</dt><dd class="c-body">{hh:.2f}</dd></div>
            <div><dt>Outline points</dt><dd>{len(H)}</dd></div>
            <div><dt>Sprite width</dt><dd>{sw:.2f}</dd></div>
          </dl>
          <p class="reach"><span class="bar"><i style="width:{min(100,cover):.0f}%"></i></span><b>{cover:.0f}%</b> of the painted width is inside the outline</p>
        </div>
      </article>''')
    sections.append(f'''
  <section class="group" id="{wk}">
    <div class="group-head">
      <h2>{wname}</h2>
      <p>mass &times;{MASS[wk]} &middot; one outline per bot, used for terrain, other bots, shots and blasts</p>
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
  <div class="eyebrow">Super Bots &middot; collision reference &middot; build v38</div>
  <h1>Every bot, measured</h1>
  <p>One outline decides everything that happens to a bot. It is the convex shape of the bot's own painted body, and it is what terrain pushes against, what other bots bump, and what a shot or blast has to reach. It flips with the bot's facing. All figures are in world units, where one unit is one grid square on the map sheet.</p>
</header>

<div class="legend">
  <img src="{legend_img}" alt="Warden drawn at 150 pixels per world unit with both circles and a half-unit grid">
  <div class="keys">
    <div class="key"><span class="swatch body"></span><div><b>Body outline, cyan</b><p>The one collider. Platforms, ramps and walls push against it, bots bump each other with it, and a missile, blast or mine must reach it to deal damage. The dots are its corners.</p></div></div>
    <div class="key"><span class="swatch hit"></span><div><b>Derived from the art</b><p>Each outline is traced from the sprite's own pixels, so a wide bot like Warden is wide to hit and wide to fit. Regenerate with the hull tool after any sprite change.</p></div></div>
    <div class="key"><span class="swatch art"></span><div><b>Grid and ground line</b><p>Faint lines are half a unit apart. The dashed horizontal line is where the bot rests on a surface.</p></div></div>
  </div>
</div>

<dl class="constants">
  <div><dt>Narrowest body</dt><dd class="c-body">1.50</dd></div>
  <div><dt>Widest body</dt><dd class="c-body">2.99</dd></div>
  <div><dt>Body height</dt><dd class="c-body">1.25 &ndash; 1.51</dd></div>
  <div><dt>Pits and gaps</dt><dd>3.20</dd></div>
  <div><dt>Sprite scale</dt><dd>1.25&times;</dd></div>
</dl>
{''.join(sections)}

<footer>
  <h2>Reading the sheet</h2>
  <p>Because the outline is the painted body, a cannon barrel or a shield emitter that touches an enemy is a real contact, and a shot that visibly crosses a bot connects. The trade is that bots are now two to three units wide, so every pit and gap on the maps was widened to 3.2 units: the narrowest body fits with room and the widest just drops through.</p>
  <p>The bar on each card shows how much of the sprite's pixel width the outline covers; the remainder is thin detail such as antennae and mist that the trace deliberately ignores so it cannot snag on terrain.</p>
  <p>The outlines live in <code>src/core/hulls.js</code> and are regenerated from the sprites by <code>tools/gen_hulls.py</code>.</p>
</footer>
</div>
'''
open(f'{SP}/hitbox-sheet.html','w').write(page)
print(len(page)//1024,'KB')
