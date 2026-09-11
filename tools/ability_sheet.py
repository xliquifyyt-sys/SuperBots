#!/usr/bin/env python3
"""Build the Super Bots ability sheet (HTML) from the sprite art and hand-verified numbers taken from defs.js / sim.js."""
import base64, html, os
SP = '/tmp/claude-0/-home-user-SuperBots/ecbb4a5a-5a11-5688-a626-127b16c03285/scratchpad'
BUILD = 'v40'
def uri(bid):
    with open(f'{SP}/spr/{bid}.png', 'rb') as f: return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()

# Numbers below are read from src/core/defs.js and src/core/sim.js at build v40.
# Speed = 33 x power x speedMul (missile x1.25). Knock = multiplier on the shared 0.336 units per damage point.
WEIGHT = {
    'heavy':  {'jump': '0.86x', 'knock': '0.6x', 'mass': 1.6},
    'medium': {'jump': '1.0x',  'knock': '1.0x', 'mass': 1.0},
    'light':  {'jump': '1.18x', 'knock': '1.3x', 'mass': 0.7},
}
GUIDE = {'low': '30%', 'medium': '55%', 'high': '85%'}

BOTS = [
 dict(id='bulwark', name='Bulwark', cls='Heavy tank', hp=140, weight='heavy', acc='medium', color='#4f7cff',
      tag='Anchors a fight. Walls off lanes and punishes clustering.',
      passive=('Wall immunity', 'Takes zero knockback while its Bastion Wall is standing.'),
      s1=dict(name='Bastion Wall', cd=3, kind='Deploy', stats=[('Segments', '3 x 0.4 x 0.85'), ('Wall HP', '40'), ('Lasts', '2 turns'), ('Offset', '1.35 toward aim')],
              how='Three stacked wall segments appear 1.35 units to the aimed side. Blocks projectiles (yours pass through). Breaks after 40 damage. Bulwark ignores knockback while it stands.'),
      s2=dict(name='Siege Shell', cd=4, kind='Projectile', stats=[('Damage', '55'), ('Radius', '1.5'), ('Speed', '0.8x'), ('Knock', '2.2x'), ('Gravity', '1.15x'), ('Size', '0.3')],
              how='Slow, heavy, drops fast. Biggest single hit in the game and the strongest shove of any projectile.')),
 dict(id='magmaw', name='Magmaw', cls='Heavy brawler', hp=140, weight='heavy', acc='low', color='#ff5a1f',
      tag='Gets in close and sets the ground on fire.',
      passive=('Fireproof', 'Immune to Burn. First lava contact each turn bounces it back up (vy -15) instead of killing it.'),
      s1=dict(name='Molten Slam', cd=3, kind='Jump + blast', stats=[('Damage', '35'), ('Radius', '2.5'), ('Knock', '1.3x'), ('Min power', '60%'), ('Patch', '4 wide, 3 turns, 15 dmg')],
              how='Jumps toward the aim (never below 60% power) and explodes on landing. Leaves a burning patch that deals 15 on contact. Self-safe.'),
      s2=dict(name='Ember Spit', cd=2, kind='Projectile x3', stats=[('Damage', '12 each'), ('Radius', '0.7'), ('Speed', '0.6x'), ('Spread', '-9, 0, +9 deg'), ('Size', '0.14'), ('Effect', 'Burn')],
              how='Three short-range globs in a narrow fan. Each hit applies Burn: 8 damage at the start of the next turn.')),
 dict(id='volt', name='Volt', cls='Medium marksman', hp=130, weight='medium', acc='high', color='#ffe23a',
      tag='The reliable marksman. Beams ignore walls.',
      passive=('Hot barrel', 'Basic missile flies 15% faster (47.4 units/s at full power instead of 41.3).'),
      s1=dict(name='Chain Arc', cd=3, kind='Instant beam', stats=[('Damage', '40'), ('Arc', '15 to 1 more bot'), ('Arc range', '6'), ('Hit width', '0.75 circle'), ('Pierces', 'terrain, walls, bots')],
              how='Straight line from Volt in the aim direction, across the whole map. Every bot on the line takes 40, then the beam arcs to the nearest untouched bot within 6 of the first hit for 15. No knockback.'),
      s2=dict(name='Static Field', cd=4, kind='Projectile', stats=[('Damage', '30'), ('Radius', '3'), ('Speed', '1.0x'), ('Effect', 'Shocked'), ('Field lasts', '1 turn')],
              how='Explodes on impact and leaves a 3-radius field for the rest of the turn. Bots inside are Shocked: no specials next turn.')),
 dict(id='warden', name='Warden', cls='Medium defender', hp=130, weight='medium', acc='medium', color='#3ddc97',
      tag='Turns enemy shots around and pins targets down.',
      passive=('Top armour', 'Takes 20% less damage from projectiles that hit from above.'),
      s1=dict(name='Deflector', cd=4, kind='Shield', stats=[('Lasts', '1 turn'), ('Hit pad', '+0.55 around body'), ('Damage', '0')],
              how='Dome for this turn. Any projectile that reaches the body (plus 0.55 padding) is flung straight back the way it came and now belongs to Warden.'),
      s2=dict(name='Anchor Bolt', cd=3, kind='Projectile', stats=[('Damage', '45'), ('Radius', '0.9'), ('Speed', '1.05x'), ('Effect', 'Rooted')],
              how='Fast bolt. Bots in the blast are Rooted: they cannot jump next turn (they can still shoot).')),
 dict(id='skyla', name='Skyla', cls='Medium aerial', hp=130, weight='medium', acc='high', color='#8fd3ff',
      tag='Owns the air. Repositions and shoots in one move.',
      passive=('Wind-proof', 'Map wind (gusts) does not push Skyla.'),
      s1=dict(name='Updraft', cd=2, kind='Jump + rain', stats=[('Height', '2x vertical'), ('Missiles', '3 x 18'), ('Radius', '0.9'), ('Spread', '-0.28, 0, +0.28'), ('Rain power', '75%')],
              how='A jump with doubled vertical speed. At the apex three missiles drop straight down. Skyla keeps flying to wherever the jump lands her.'),
      s2=dict(name='Gale Shot', cd=3, kind='Cone blast', stats=[('Damage', '20'), ('Reach', '13'), ('Cone', '60 deg'), ('Push', '17 x weight'), ('Also moves', 'projectiles +20, power-ups 3.5')],
              how='Instant wind cone. Every bot inside takes 20 and is shoved 17 units/s (scaled by its knockback weight). A bot already moving into the wind braces and takes as little as a quarter of the push. Also flings live projectiles and slides power-ups.')),
 dict(id='phantom', name='Phantom', cls='Light assassin', hp=120, weight='light', acc='high', color='#c46bff',
      tag='Appears next to you, then disappears.',
      passive=('Bloodlust', 'After a kill, the next special cast has its cooldown cut by 1 turn.'),
      s1=dict(name='Blink Strike', cd=3, kind='Teleport + shards', stats=[('Range', '60% of map width x power'), ('Shards', '4 x 9'), ('Radius', '0.8'), ('Speed', '0.85x'), ('Spread', '-21, -7, +7, +21 deg')],
              how='Teleports along the aim line until it hits terrain or the range limit. Shards then lock on to the nearest enemy within 9 units of the arrival point (else they follow the aim).'),
      s2=dict(name='Toxic Bomb', cd=3, kind='Projectile', stats=[('Tick', '5 every 0.4 s'), ('Cap', '35 per bot'), ('Radius', '2.4'), ('Impact damage', '0'), ('Cloud lasts', 'rest of turn')],
              how='No blast. Leaves a cloud that ticks 5 damage on every bot inside, up to 35 each, until the turn ends.')),
 dict(id='ricochet', name='Ricochet', cls='Light trickster', hp=120, weight='light', acc='medium', color='#ff4fa3',
      tag='Bank shots off everything. Map knowledge wins.',
      passive=('Bouncy', 'Its own jump bounces once off terrain (1.65x rebound when landing faster than 3).'),
      s1=dict(name='Pinball', cd=2, kind='Projectile', stats=[('Damage', '30 (+5 per bounce)'), ('Radius', '0.9'), ('Bounces', '1 to 4, pick before firing'), ('Rebound', '1.85x'), ('Size', '0.22')],
              how='Bounces off terrain the chosen number of times, then explodes on the next contact or on a bot. Each bounce adds 5 damage.'),
      s2=dict(name='Split Shot', cd=3, kind='Projectile', stats=[('Damage', '15 x 4'), ('Radius', '0.8'), ('Split speed', '1.1x'), ('Spread', '-32, -11, +11, +32 deg'), ('Child size', '0.14')],
              how='Splits into four at the top of its arc. Aim high for a wide carpet, low for a tight cluster.')),
 dict(id='gravitas', name='Gravitas', cls='Control', hp=130, weight='medium', acc='low', color='#9aa4b8',
      tag='Drags everyone together. Best friend of every Siege Shell.',
      passive=('Dense core', 'Heavy knockback resistance (0.6x) while keeping a Medium jump and Medium mass.'),
      s1=dict(name='Singularity', cd=4, kind='Projectile', stats=[('Damage', '0'), ('Pull radius', '9.1'), ('Pull', '16 units/s per s'), ('Half gravity', 'inside pull'), ('Lasts', '2.6 s')],
              how='On impact every bot within 9.1 units is dragged toward the point for 2.6 seconds, including Gravitas. Gravity is halved inside the pull so bots lift off ledges.'),
      s2=dict(name='Shockwave', cd=3, kind='Self blast', stats=[('Damage', '50'), ('Radius', '3'), ('Knock', '2.3x'), ('Self damage', '0')],
              how='Instant burst centred on Gravitas. Hits everyone within 3 for 50 with the hardest shove in the game. No aim needed.')),
]

STATUS = [
    ('Burn', '8 damage at the start of the next turn. Magmaw is immune.', 'Ember Spit'),
    ('Poison', '10 damage per turn for 3 turns.', 'Toxin power-up'),
    ('Shocked', 'No specials next turn.', 'Static Field, Shockwire'),
    ('Rooted', 'No jump next turn.', 'Anchor Bolt'),
    ('Frozen', 'No jump next turn.', 'Frost power-up'),
]

def card(b):
    W = WEIGHT[b['weight']]
    def special(slot, s):
        rows = ''.join(f'<div class="kv"><dt>{html.escape(k)}</dt><dd>{html.escape(v)}</dd></div>' for k, v in s['stats'])
        return f'''<section class="move" aria-label="{html.escape(s['name'])}">
  <header><span class="slot">{slot}</span><h3>{html.escape(s['name'])}</h3><span class="kind">{html.escape(s['kind'])}</span><span class="cd">CD {s['cd']}</span></header>
  <dl class="stats">{rows}</dl>
  <p class="how">{html.escape(s['how'])}</p>
</section>'''
    return f'''<article class="bot" id="{b['id']}" style="--bot:{b['color']}">
  <div class="plate">
    <img src="{uri(b['id'])}" alt="{html.escape(b['name'])} sprite" loading="lazy">
    <h2>{html.escape(b['name'])}</h2>
    <p class="cls">{html.escape(b['cls'])}</p>
    <p class="tag">{html.escape(b['tag'])}</p>
    <dl class="core">
      <div><dt>HP</dt><dd>{b['hp']}</dd></div>
      <div><dt>Weight</dt><dd>{b['weight'].title()}</dd></div>
      <div><dt>Jump</dt><dd>{W['jump']}</dd></div>
      <div><dt>Knockback taken</dt><dd>{'0.6x' if b['id']=='gravitas' else W['knock']}</dd></div>
      <div><dt>Mass</dt><dd>{W['mass']}</dd></div>
      <div><dt>Aim guide</dt><dd>{GUIDE[b['acc']]} ({b['acc']})</dd></div>
    </dl>
  </div>
  <div class="moves">
    <section class="move passive"><header><span class="slot">Passive</span><h3>{html.escape(b['passive'][0])}</h3></header><p class="how">{html.escape(b['passive'][1])}</p></section>
    {special('S1', b['s1'])}
    {special('S2', b['s2'])}
  </div>
</article>'''

cards = '\n'.join(card(b) for b in BOTS)
toc = ''.join(f'<a href="#{b["id"]}" style="--bot:{b["color"]}">{html.escape(b["name"])}</a>' for b in BOTS)
status_rows = ''.join(f'<tr><th scope="row">{a}</th><td>{b}</td><td>{c}</td></tr>' for a, b, c in STATUS)

page = f'''<title>Super Bots Ability Sheet</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
:root{{
  --bg:#0e1117; --panel:#161b25; --sunk:#0b0e14; --line:#2a3245; --line-soft:#1f2634;
  --text:#e7ebf4; --muted:#8f99ad; --faint:#5d6779; --accent:#ffd84f;
  --display:'Rajdhani','Bahnschrift','Arial Narrow',sans-serif; --body:'IBM Plex Sans','Segoe UI',system-ui,sans-serif;
  color-scheme:dark;
}}
@media (prefers-color-scheme: light){{ :root:not([data-theme="dark"]){{ --bg:#f3f4f7; --panel:#ffffff; --sunk:#e9ebf1; --line:#cfd5e1; --line-soft:#e2e6ee; --text:#161b25; --muted:#5a6478; --faint:#8a94a8; --accent:#b8860b; color-scheme:light; }} }}
:root[data-theme="light"]{{ --bg:#f3f4f7; --panel:#ffffff; --sunk:#e9ebf1; --line:#cfd5e1; --line-soft:#e2e6ee; --text:#161b25; --muted:#5a6478; --faint:#8a94a8; --accent:#b8860b; color-scheme:light; }}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);font-size:15px;line-height:1.5;padding-block:28px 64px;padding-inline:clamp(16px,4vw,48px)}}
h1,h2,h3{{font-family:var(--display);text-wrap:balance;margin:0}}
.top{{max-width:1180px;margin:0 auto 26px}}
.top h1{{font-size:clamp(34px,6vw,54px);font-weight:700;letter-spacing:.01em;line-height:1}}
.top .sub{{color:var(--muted);max-width:66ch;margin:8px 0 0}}
.build{{display:inline-block;font-family:var(--display);font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:12px;color:var(--accent);border:1px solid currentColor;padding:2px 8px;margin-top:12px}}
.toc{{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}}
.toc a{{font-family:var(--display);font-weight:600;font-size:15px;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;color:var(--text);border-bottom:3px solid var(--bot);padding:2px 4px}}
.toc a:hover,.toc a:focus-visible{{background:var(--panel);outline:none}}
.rules{{max-width:1180px;margin:0 auto 28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1px;background:var(--line-soft);border:1px solid var(--line)}}
.rules > div{{background:var(--panel);padding:14px 16px}}
.rules h3{{font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:6px}}
.rules p{{margin:0;font-size:14px}}
.rules dl{{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:14px}}
.rules dt{{color:var(--muted)}} .rules dd{{margin:0;font-variant-numeric:tabular-nums}}
.roster{{max-width:1180px;margin:0 auto;display:grid;gap:22px}}
.bot{{display:grid;grid-template-columns:300px 1fr;background:var(--panel);border:1px solid var(--line);scroll-margin-top:16px}}
.plate{{background:linear-gradient(160deg,color-mix(in srgb,var(--bot) 22%,var(--sunk)),var(--sunk) 70%);padding:18px 20px 20px;border-right:1px solid var(--line-soft)}}
.plate img{{display:block;width:100%;max-width:100%;height:auto;filter:drop-shadow(0 10px 14px rgba(0,0,0,.45))}}
.plate h2{{font-size:38px;font-weight:700;line-height:1;margin-top:10px;color:var(--bot)}}
.plate .cls{{font-family:var(--display);font-weight:600;font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:2px 0 8px}}
.plate .tag{{margin:0 0 14px;font-style:italic;color:var(--muted);font-size:14px}}
.core{{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}}
.core div{{border-top:1px solid var(--line-soft);padding-top:4px}}
.core dt{{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}}
.core dd{{margin:0;font-family:var(--display);font-weight:600;font-size:19px;font-variant-numeric:tabular-nums;line-height:1.1}}
.moves{{display:grid;grid-template-rows:auto 1fr 1fr}}
.move{{padding:14px 20px 16px;border-bottom:1px solid var(--line-soft)}}
.move:last-child{{border-bottom:0}}
.move header{{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 12px;margin-bottom:8px}}
.slot{{font-family:var(--display);font-weight:700;font-size:13px;letter-spacing:.14em;color:var(--bot);background:color-mix(in srgb,var(--bot) 18%,transparent);padding:1px 7px}}
.move h3{{font-size:24px;font-weight:600}}
.kind{{color:var(--muted);font-size:13px;letter-spacing:.06em;text-transform:uppercase}}
.cd{{margin-left:auto;font-family:var(--display);font-weight:700;font-size:15px;letter-spacing:.06em;color:var(--accent)}}
.stats{{margin:0 0 8px;display:flex;flex-wrap:wrap;gap:6px 18px}}
.kv{{display:flex;gap:6px;align-items:baseline}}
.kv dt{{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);white-space:nowrap}}
.kv dd{{margin:0;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}}
.how{{margin:0;color:var(--text);max-width:70ch}}
.passive .how{{color:var(--muted)}}
.passive{{background:color-mix(in srgb,var(--bot) 6%,transparent)}}
.status{{max-width:1180px;margin:30px auto 0}}
.status h2{{font-size:26px;margin-bottom:8px}}
.status table{{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);font-size:14px}}
.status th,.status td{{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line-soft);vertical-align:top}}
.status th[scope=row]{{font-family:var(--display);font-size:17px;font-weight:600;white-space:nowrap}}
.status thead th{{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600}}
.foot{{max-width:1180px;margin:28px auto 0;color:var(--faint);font-size:13px}}
@media (max-width:760px){{ .bot{{grid-template-columns:1fr}} .plate{{border-right:0;border-bottom:1px solid var(--line-soft)}} .plate img{{max-width:240px}} }}
@media (prefers-reduced-motion: no-preference){{ .toc a{{transition:background .15s}} }}
</style>
<header class="top">
  <h1>Super Bots Ability Sheet</h1>
  <p class="sub">Every bot, its passive and both specials, with the numbers the simulation actually uses. Comment on anything you want changed: damage, radius, cooldown, how a move behaves, or a whole new idea for a slot.</p>
  <span class="build">Build {BUILD}</span>
  <nav class="toc" aria-label="Bots">{toc}</nav>
</header>
<section class="rules" aria-label="Shared rules">
  <div><h3>Every bot has</h3><dl><dt>Missile</dt><dd>25 dmg, radius 1, speed 41.3 at full power, knock 1.25x</dd><dt>Jump</dt><dd>19.6 units/s at full power x weight</dd><dt>Self-destruct</dt><dd>30 dmg, radius 1.5 to nearby enemies on death</dd></dl></div>
  <div><h3>Knockback</h3><p>Every damaging hit shoves 0.336 units per damage point, times the move's knock multiplier, times the target's weight factor (light 1.3x, medium 1.0x, heavy 0.6x).</p></div>
  <div><h3>Cooldowns</h3><p>CD is the number of turns before the special is usable again. Fast cooldowns setting takes 1 off every CD (minimum 1). Shocked bots skip their specials for a turn.</p></div>
  <div><h3>Weights</h3><dl><dt>Light</dt><dd>jump 1.18x, shoved 1.3x, mass 0.7</dd><dt>Medium</dt><dd>jump 1.0x, shoved 1.0x, mass 1.0</dd><dt>Heavy</dt><dd>jump 0.86x, shoved 0.6x, mass 1.6</dd></dl></div>
</section>
<main class="roster">
{cards}
</main>
<section class="status">
  <h2>Status effects</h2>
  <table><thead><tr><th>Effect</th><th>What it does</th><th>Applied by</th></tr></thead><tbody>{status_rows}</tbody></table>
</section>
<p class="foot">Sizes and distances are in world units (one unit is the old bot width; bots are drawn at 1.25x). Speed multipliers are relative to the 33 units/s base projectile speed at full power. Values read from defs.js and sim.js at build {BUILD}.</p>
'''
open(f'{SP}/ability-sheet.html', 'w').write(page)
open('/home/user/SuperBots/art/ABILITY_SHEET.html', 'w').write(page)
print('written', len(page))
