#!/usr/bin/env python3
"""Build the Super Bots Animation Bible: production rules, per-bot clip beats, VFX sheet list, generation recipe."""
import base64, html
SP = '/tmp/claude-0/-home-user-SuperBots/ecbb4a5a-5a11-5688-a626-127b16c03285/scratchpad'
BUILD = 'v42'
def uri(bid):
    with open(f'{SP}/spr/{bid}.png', 'rb') as f: return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()

CLIPS = [
    ('idle', '6 to 8', '8, loops', 'Breathing hold. One slow cycle, nothing leaves the silhouette. Feet and wheels stay planted on the baseline.'),
    ('fire', '8', '14', 'Missile shot. 1 anticipation frame (weapon drawn back), 1 flash frame (barrel forward, body pushed back, smear on the barrel), 2 recoil frames, 4 settle frames back to idle pose.'),
    ('jump', '6', '12', 'Frames 1 to 2 crouch (squash), frame 3 launch stretch, frames 4 to 6 airborne pose held with slight variation. The game keeps the airborne lean procedural, so keep the body upright.'),
    ('land', '5', '12', 'Frame 1 hard squash (widest, lowest), then rebound past neutral, then settle. Dust is a separate VFX sheet.'),
    ('hit', '4', '12', 'Frame 1 body knocked back and up with a white flash frame, frames 2 to 4 wobble back. Keep it small; the game adds its own shake.'),
    ('death', '8', '10', 'Two hit-stops, plates spring open, core light dies, a slump. The game fades the last frames out, so the final frame can be a wreck pose, not empty.'),
    ('s1', '8 to 10', '14', 'The bot performing Special 1. See the per-bot beats. The effect itself lives on a VFX sheet, so draw only what the body and weapon do.'),
    ('s2', '8 to 10', '14', 'The bot performing Special 2. Same rule.'),
]

BOTS = [
 dict(id='bulwark', name='Bulwark', color='#4f7cff', silhouette='Wheeled gun platform, low and wide. The cannon is the read.',
      idle='Suspension breathes 2 px, top hatch light pulses, barrel drifts up 1 degree and back.',
      fire='Cannon slams back into the hull on the flash frame, wheels rock backward one frame, hatch light spikes white.',
      jump='Wheels leave the ground last; the hull tilts nose-up on launch and nose-down before landing.',
      hit='Front armour plate pops up a few pixels and slaps back down.',
      death='Wheels collapse outward, hatch blows off frame 3, barrel droops, core goes dark.',
      s1=('Bastion Wall', 'Turret turns to the placement side, a projector iris opens on the hull front, arm thrusts forward and holds while the wall builds, then relaxes. Frames 3 to 8 hold a strong forward pose so the cast reads even at small size.', 'cast_bastionWall: blue holographic grid that sweeps outward from the projector for 6 frames. The wall itself is drawn by the game.'),
      s2=('Siege Shell', 'Big anticipation: the whole hull sinks on its suspension for 2 frames, the barrel extends by 15 percent, then a giant recoil that lifts the front wheels off the ground for 2 frames.', 'cast_siegeShell: heavy orange muzzle bloom with a smoke ring. explosion_big handles the impact.')),
 dict(id='magmaw', name='Magmaw', color='#ff5a1f', silhouette='Jawed brawler. The mouth is the read; the body is a furnace.',
      idle='Jaw opens 3 px and closes, furnace glow flickers between two brightness levels, ember flecks rise from the back vents (these can be painted in the frames).',
      fire='Jaw snaps open wide on the flash frame, head rears back, a tongue of flame hangs one frame after.',
      jump='Crouches on all limbs, launches head-first with the jaw open.',
      hit='Jaw clamps shut, body compresses.',
      death='Furnace overheats white, then cracks along the plating, jaw sags open, glow fades to ember red.',
      s1=('Molten Slam', 'Uses the jump clip for the flight. The s1 clip is the landing: frame 1 belly-flop squash to 70 percent height, frames 2 to 4 shockwave pose with the jaw open and limbs spread, frames 5 to 8 push back up.', 'cast_moltenSlam: ground-plane lava splash ring, 8 frames, drawn wide (6 units). molten_patch: looping 4-frame lava shimmer for the burning patch.'),
      s2=('Ember Spit', 'Three quick head bobs, one per glob, each with the jaw opening a different amount. Body leans forward across the clip.', 'cast_emberSpit: short 5-frame flame puff at the mouth. Ember globs are drawn by the game.')),
 dict(id='volt', name='Volt', color='#ffe23a', silhouette='Tall marksman with a rail rifle and an antenna. The rifle line is the read.',
      idle='Antenna tip sparks every other cycle, rifle sways 1 degree, shoulder pads rise and fall.',
      fire='Rifle kicks straight back along its own line, coils on the barrel glow in sequence front to back over the settle frames.',
      jump='Rifle tucks vertical for the launch, extends again at the apex.',
      hit='Antenna whips, body flinches sideways.',
      death='Sparks arc between the shoulder pads, the rifle drops, the body kneels and powers down.',
      s1=('Chain Arc', 'Plants both feet wide for 2 anticipation frames, the rifle coils charge to white, then a hold pose for 5 frames with the rifle pushed straight forward while the beam is live. The beam is a separate live effect.', 'cast_chainArc: electric charge gathering at the muzzle, 8 frames, then the beam is drawn by the game. Optional arc_hit: 6-frame lightning burst at each struck bot (not wired yet).'),
      s2=('Static Field', 'Underhand lob: the rifle swings down and up like a mortar, body pivots on the back foot.', 'cast_staticField: crackling yellow orb leaving the muzzle, 6 frames. The field on the ground uses explosion followed by the game\'s ring.')),
 dict(id='warden', name='Warden', color='#3ddc97', silhouette='Shield-bearer, squat. The shield face is the read.',
      idle='Shield tilts 2 degrees on a slow cycle, the eye slit scans left to right.',
      fire='The launcher on the off-shoulder fires; the shield stays still so the defensive read never breaks.',
      jump='Shield raised overhead on launch, brought back to the front before landing.',
      hit='Shield takes it: it jolts back into the body and the bot slides one step.',
      death='Shield splits down the middle, halves fall away, body slumps forward.',
      s1=('Deflector', 'Shield lifts and rotates to face the camera (planar, big), edge lights ignite ring by ring over 4 frames, then a proud hold.', 'deflector: looping 6-frame translucent green dome, 3.2 units wide, drawn on the bot while active. reflect: 5-frame white flash at each deflected projectile.'),
      s2=('Anchor Bolt', 'A harpoon rack rises from behind the shield in 2 frames, fires with a chain smear frame, then the rack drops.', 'cast_anchorBolt: green chain-flash at the rack, 6 frames.')),
 dict(id='skyla', name='Skyla', color='#8fd3ff', silhouette='Winged aerial. Wings are the read; keep them inside the frame at rest.',
      idle='Hover bob 4 px, wings feather at the tips, thruster flame flickers.',
      fire='Nose-mounted gun; the whole body dips on the flash frame and wings flare.',
      jump='Wings snap fully open on launch and stay open. This clip is also used for Updraft flight.',
      hit='One wing folds in, body rolls 15 degrees, recovers.',
      death='Thruster sputters, wings fold, she drops nose-first (the game handles the fall).',
      s1=('Updraft', 'This is the apex release: wings beat downward hard for 2 frames, belly bays open, five ports flash in sequence, bays close.', 'cast_updraft: white air burst beneath the wings, 6 frames, 3 units wide. The rain missiles are drawn by the game.'),
      s2=('Gale Shot', 'Wings sweep back, thruster overdrives, whole body leans into the blast for a 5-frame hold, then springs back.', 'gale: 8-frame wind cone, drawn 26 units long at scale 1 with the origin at the left edge centre. Paint streaks and dust, mostly transparent.')),
 dict(id='phantom', name='Phantom', color='#c46bff', silhouette='Hooded blade assassin, thin. The blade angle is the read.',
      idle='Cloak edge ripples, blade rotates a few degrees, eye light blinks out and back every cycle.',
      fire='Wrist launcher; a fast snap with a smear frame, nearly no body motion. She is precise.',
      jump='Curls into a crouch then extends into a straight dive pose.',
      hit='Cloak flares open showing the frame beneath, quick recover.',
      death='Blade falls first, cloak deflates, eye light goes out last.',
      s1=('Blink Strike', 'Two clips in one: frames 1 to 3 wind-up and dissolve (body stretches upward and thins), frames 4 to 6 re-form at the destination in a low landing pose, frames 7 to 9 blade sweep for the shard release. The game teleports between frame 3 and 4.', 'blink_out: 6-frame purple implosion at the origin. blink_in: 6-frame purple burst at the arrival. cast_blinkStrike: 5-frame shard flash at the blade.'),
      s2=('Toxic Bomb', 'Underhand toss from the hip with the cloak swinging opposite to the arm.', 'cast_toxicBomb: 5-frame green vapour puff at the hand. toxic_cloud: looping 8-frame drifting cloud, 4.8 units wide, transparent PNG (normal blend).')),
 dict(id='ricochet', name='Ricochet', color='#ff4fa3', silhouette='Sphere with a band. Rotation is the read.',
      idle='Rolls 5 degrees left and right on the spot, band lights chase.',
      fire='Pops open a hatch on the band, fires, snaps shut, and the whole sphere rolls back a quarter turn from recoil.',
      jump='Compresses to an oval, launches, and spins in the air (rotation drawn in the frames, 90 degrees across the clip).',
      hit='Dents inward on the hit side for 1 frame, pops back.',
      death='Band cracks, the sphere splits into two halves that rock apart.',
      s1=('Pinball', 'Spins up: 4 frames of increasing rotation blur (smear rings), then the hatch fires the big ball with a hard stop.', 'cast_pinball: pink spin-up ring, 6 frames. bounce flashes are drawn by the game.'),
      s2=('Split Shot', 'Charges by pulling the band tight (sphere squashes), fires, band snaps loose.', 'cast_splitShot: pink muzzle star, 5 frames.')),
 dict(id='gravitas', name='Gravitas', color='#9aa4b8', silhouette='Ringed orb. The ring tilt is the read.',
      idle='Ring precesses slowly, core dims and brightens, small debris orbits (paint 2 or 3 pebbles).',
      fire='A port on the orb opens and fires; the ring wobbles from the recoil.',
      jump='The ring flattens horizontal for the launch and rights itself at the apex.',
      hit='Ring skews hard, core flickers.',
      death='Ring falls off and rolls, core collapses to a point, orb cracks.',
      s1=('Singularity', 'Ring spins up to a blur over 4 frames, the core goes black with a white rim, a beat, then the launch port fires the seed.', 'cast_singularity: grey-white implosion rings at the orb, 6 frames. singularity: looping 8-frame swirl, 18 units wide at scale 1, mostly transparent.'),
      s2=('Shockwave', 'Whole body compresses to 80 percent for 3 frames, then expands past neutral to 115 percent with the ring blasting outward flat, then settles.', 'shockwave: 8-frame expanding ground ring plus a dome, 6 units wide at scale 1. The game scales it to the radius.')),
]

VFX = [
    ('explosion', '10 to 12', '24', '2.4', 'black, additive', 'Missile and special impacts under radius 1.4. Fireball, spike flash, then smoke ring.'),
    ('explosion_big', '12', '24', '3.2', 'black, additive', 'Siege Shell, Molten Slam, mines, large blasts.'),
    ('muzzle', '4', '30', '1.2', 'black, additive', 'Basic missile flash at the barrel. Drawn facing right; the game mirrors it.'),
    ('land_dust', '6', '20', '1.6', 'transparent', 'Two dust puffs splitting left and right.'),
    ('jump_dust', '5', '20', '1.4', 'transparent', 'Small ring of dust at take-off.'),
    ('blink_out / blink_in', '6', '24', '2.2', 'black, additive', 'Phantom implosion and burst.'),
    ('gale', '8', '20', '26 x 26 (cone in the left half)', 'black, additive', 'Wind cone pointing right from the left-edge centre of the frame.'),
    ('singularity', '8, loops', '16', '18.2', 'black, additive', 'Slow inward swirl, faint.'),
    ('toxic_cloud', '8, loops', '12', '4.8', 'transparent', 'Green drifting cloud.'),
    ('deflector', '6, loops', '12', '3.2', 'black, additive', 'Translucent dome with edge lights.'),
    ('molten_patch', '4, loops', '10', '3', 'black, additive', 'Lava shimmer on the ground.'),
    ('shockwave', '8', '24', '6', 'black, additive', 'Expanding ring plus a short dome.'),
    ('reflect', '5', '24', '1.8', 'black, additive', 'White flash at the deflection point.'),
    ('teleport_out / teleport_in', '6', '24', '2.2', 'black, additive', 'Map pad teleports.'),
    ('mine_blast', '8', '24', '2.6', 'black, additive', 'Spike mine detonation.'),
    ('geyser', '8', '20', '2 (tall: 1 x 3 ratio is fine)', 'transparent', 'Water or steam column.'),
    ('wall_break', '6', '20', '1.6', 'transparent', 'Blue shards flying out.'),
    ('cast_<specialId>', '5 to 8', '18', '2.6', 'black, additive', 'One per special, drawn over the caster: bastionWall, siegeShell, moltenSlam, emberSpit, chainArc, staticField, deflector, anchorBolt, updraft, galeShot, blinkStrike, toxicBomb, pinball, splitShot, singularity.'),
]

def bot_card(b):
    rows = [('Idle', b['idle']), ('Fire', b['fire']), ('Jump', b['jump']), ('Hit', b['hit']), ('Death', b['death'])]
    base = ''.join(f'<tr><th scope="row">{k}</th><td>{html.escape(v)}</td></tr>' for k, v in rows)
    sp = ''
    for slot, (name, beats, vfx) in (('S1', b['s1']), ('S2', b['s2'])):
        sp += f'<div class="special"><div class="sp-head"><span class="slot">{slot}</span><h4>{html.escape(name)}</h4></div><p><strong>Body:</strong> {html.escape(beats)}</p><p><strong>Effect sheets:</strong> {html.escape(vfx)}</p></div>'
    return f'''<article class="bot" id="{b['id']}" style="--bot:{b['color']}">
  <div class="plate"><img src="{uri(b['id'])}" alt="{html.escape(b['name'])} still, the reference for every frame"><h3>{html.escape(b['name'])}</h3><p class="sil">{html.escape(b['silhouette'])}</p></div>
  <div class="body">
    <table class="beats"><tbody>{base}</tbody></table>
    {sp}
  </div>
</article>'''

clip_rows = ''.join(f'<tr><th scope="row"><code>{c}</code></th><td>{n}</td><td>{f}</td><td>{html.escape(d)}</td></tr>' for c, n, f, d in CLIPS)
vfx_rows = ''.join(f'<tr><th scope="row"><code>{k}</code></th><td>{n}</td><td>{f}</td><td>{s}</td><td>{bg}</td><td>{html.escape(d)}</td></tr>' for k, n, f, s, bg, d in VFX)
cards = '\n'.join(bot_card(b) for b in BOTS)
toc = ''.join(f'<a href="#{b["id"]}" style="--bot:{b["color"]}">{b["name"]}</a>' for b in BOTS)

page = f'''<title>Super Bots Animation Bible</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{{ --bg:#0e1117; --panel:#161b25; --sunk:#0b0e14; --line:#2a3245; --line-soft:#1f2634; --text:#e7ebf4; --muted:#8f99ad; --faint:#5d6779; --accent:#ffd84f; --ok:#5cff7a;
  --display:'Rajdhani','Bahnschrift','Arial Narrow',sans-serif; --body:'IBM Plex Sans','Segoe UI',system-ui,sans-serif; --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace; color-scheme:dark; }}
@media (prefers-color-scheme: light){{ :root:not([data-theme="dark"]){{ --bg:#f3f4f7; --panel:#fff; --sunk:#e9ebf1; --line:#cfd5e1; --line-soft:#e2e6ee; --text:#161b25; --muted:#5a6478; --faint:#8a94a8; --accent:#b8860b; --ok:#1f8f3a; color-scheme:light; }} }}
:root[data-theme="light"]{{ --bg:#f3f4f7; --panel:#fff; --sunk:#e9ebf1; --line:#cfd5e1; --line-soft:#e2e6ee; --text:#161b25; --muted:#5a6478; --faint:#8a94a8; --accent:#b8860b; --ok:#1f8f3a; color-scheme:light; }}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--text);font-family:var(--body);font-size:15px;line-height:1.55;padding-block:28px 64px;padding-inline:clamp(16px,4vw,48px)}}
h1,h2,h3,h4{{font-family:var(--display);text-wrap:balance;margin:0}}
.wrap{{max-width:1180px;margin:0 auto}}
h1{{font-size:clamp(34px,6vw,54px);font-weight:700;line-height:1}}
.sub{{color:var(--muted);max-width:70ch;margin:8px 0 0}}
.build{{display:inline-block;font-family:var(--display);font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:12px;color:var(--accent);border:1px solid currentColor;padding:2px 8px;margin-top:12px}}
.toc{{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}}
.toc a{{font-family:var(--display);font-weight:600;font-size:15px;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;color:var(--text);border-bottom:3px solid var(--bot,var(--accent));padding:2px 4px}}
section.block{{margin-top:34px}}
section.block > h2{{font-size:28px;margin-bottom:10px}}
section.block > h2 span{{color:var(--faint);font-weight:500;font-size:16px;letter-spacing:.1em;text-transform:uppercase;margin-left:10px}}
.rules{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1px;background:var(--line-soft);border:1px solid var(--line)}}
.rules > div{{background:var(--panel);padding:14px 16px}}
.rules h3{{font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:6px}}
.rules p, .rules li{{margin:0;font-size:14px}}
.rules ul{{margin:0;padding-left:18px}}
table{{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);font-size:14px}}
th,td{{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line-soft);vertical-align:top}}
thead th{{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600}}
th[scope=row]{{white-space:nowrap;font-weight:600}}
code{{font-family:var(--mono);font-size:13px;background:var(--sunk);padding:1px 5px;border-radius:3px;overflow-wrap:anywhere}}
pre{{font-family:var(--mono);font-size:13px;background:var(--sunk);border:1px solid var(--line);padding:12px 14px;overflow-x:auto;margin:0}}
.tablewrap{{overflow-x:auto}}
.roster{{display:grid;gap:22px;margin-top:14px}}
.bot{{display:grid;grid-template-columns:260px 1fr;background:var(--panel);border:1px solid var(--line);scroll-margin-top:16px}}
.plate{{background:linear-gradient(160deg,color-mix(in srgb,var(--bot) 22%,var(--sunk)),var(--sunk) 70%);padding:18px;border-right:1px solid var(--line-soft)}}
.plate img{{display:block;width:100%;max-width:100%;height:auto;filter:drop-shadow(0 10px 14px rgba(0,0,0,.45))}}
.plate h3{{font-size:34px;font-weight:700;line-height:1;margin-top:10px;color:var(--bot)}}
.sil{{color:var(--muted);font-size:14px;font-style:italic;margin:6px 0 0}}
.body{{padding:8px 0 8px}}
.beats{{border:0;background:transparent}}
.beats th[scope=row]{{width:90px;font-family:var(--display);font-size:16px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}}
.special{{padding:12px 16px 14px;border-top:1px solid var(--line-soft);background:color-mix(in srgb,var(--bot) 6%,transparent)}}
.sp-head{{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}}
.slot{{font-family:var(--display);font-weight:700;font-size:13px;letter-spacing:.14em;color:var(--bot);background:color-mix(in srgb,var(--bot) 18%,transparent);padding:1px 7px}}
.special h4{{font-size:22px;font-weight:600}}
.special p{{margin:4px 0 0;font-size:14px;max-width:80ch}}
.steps{{counter-reset:s;display:grid;gap:10px}}
.steps > div{{background:var(--panel);border:1px solid var(--line);padding:12px 16px 12px 52px;position:relative}}
.steps > div::before{{counter-increment:s;content:counter(s);position:absolute;left:14px;top:10px;font-family:var(--display);font-weight:700;font-size:24px;color:var(--accent)}}
.steps h3{{font-size:18px;margin-bottom:4px}}
.steps p{{margin:0;font-size:14px;max-width:80ch}}
.check li{{margin:4px 0}}
@media (max-width:760px){{ .bot{{grid-template-columns:1fr}} .plate{{border-right:0;border-bottom:1px solid var(--line-soft)}} .plate img{{max-width:220px}} }}
</style>
<div class="wrap">
<header>
  <h1>Super Bots Animation Bible</h1>
  <p class="sub">How every bot moves, what each special looks like on the body versus on its effect sheet, and the exact files to hand the game. The engine already plays anything you drop in and keeps its procedural fallback for anything you have not made yet.</p>
  <span class="build">Build {BUILD}</span>
  <nav class="toc" aria-label="Bots">{toc}</nav>
</header>

<section class="block"><h2>What A-grade means here <span>principles</span></h2>
<div class="rules">
  <div><h3>Silhouette first</h3><p>Every pose must read as a black shape at 60 px tall, which is how big bots are on a phone. If the weapon and the body merge, the frame fails. Each bot has one "read" (Bulwark's cannon, Warden's shield) and every clip protects it.</p></div>
  <div><h3>Anticipation, action, recovery</h3><p>Every clip is three parts: 1 to 2 frames winding up (the opposite direction), 1 to 2 frames of the action with a smear or stretch, and the rest settling with a little overshoot. Brawlbots reads snappy because the action frames are few and the settle is long.</p></div>
  <div><h3>Frame rates</h3><p>Bodies at 12 to 14 fps for actions and 8 fps for idle. Effects at 20 to 30 fps. Held frames are free: a 2-frame hold on the strongest pose sells the move better than two similar frames.</p></div>
  <div><h3>Body and effect are separate sheets</h3><p>The bot clip has only the bot. Flames, rings, lightning and dust are their own sheets and the game composites them (additive for light, normal for smoke). This keeps the body reusable and lets an effect scale with the move's radius.</p></div>
  <div><h3>Squash and stretch, but metal</h3><p>Robots deform by mechanism: suspension compresses, plates open, a ring tilts. Reserve rubbery squash for Ricochet and the landing frame. Everything else moves like machinery under load.</p></div>
  <div><h3>Light stays put</h3><p>Same key light (upper left, slightly warm) in every frame, same rim light colour as the still. Only the bot's own emissives change brightness. A frame with shifted lighting flickers in motion.</p></div>
  <div><h3>Baseline lock</h3><p>The contact point with the ground never moves in idle, fire, hit, s1 and s2. Only jump and land may leave the baseline. The intake tool aligns all frames with one transform, so a bot drawn higher in one frame will visibly hop.</p></div>
  <div><h3>Secondary motion</h3><p>One secondary element per bot (antenna, cloak, orbiting debris, hatch light) keeps idle alive without touching the silhouette. It lags the main motion by one frame in actions.</p></div>
</div>
</section>

<section class="block"><h2>Frame spec <span>technical</span></h2>
<div class="rules">
  <div><h3>Canvas and framing</h3><ul><li>Generate at 1024 x 1024 per frame; the intake tool downsizes to 512.</li><li>Bot faces right in every frame. The game mirrors for left.</li><li>Match the still: same camera height, same scale (body fills about 85 percent of the width at idle), same paint style.</li><li>Leave a margin so wings, recoil and smears never touch the frame edge.</li></ul></div>
  <div><h3>Backdrop</h3><ul><li>Transparent PNG, or a flat green <code>#3CC828</code>. The tool keys any flat colour that touches the border.</li><li>No shadows on the ground, no glow bleeding into the backdrop.</li><li>Effects for additive sheets are painted on pure black instead.</li></ul></div>
  <div><h3>Delivery</h3><ul><li>Contact sheet: <code>art/sprites/raw/anim/&lt;bot&gt;_&lt;clip&gt;_&lt;cols&gt;x&lt;rows&gt;.png</code>, frames row-major, empty trailing cells allowed.</li><li>Or a folder of frames: <code>art/sprites/raw/anim/&lt;bot&gt;/&lt;clip&gt;/01.png ...</code></li><li>Effects: <code>art/vfx/raw/&lt;key&gt;_&lt;cols&gt;x&lt;rows&gt;.png</code> or <code>art/vfx/raw/&lt;key&gt;/</code></li></ul></div>
  <div><h3>Build</h3><pre>python3 tools/intake_anim.py        # all bots
python3 tools/intake_anim.py volt   # one bot
python3 tools/intake_vfx.py</pre><p style="margin-top:8px">Both tools print frame counts and keep any fps or loop tuning you edit in the manifests.</p></div>
</div>
<div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>Clip</th><th>Frames</th><th>fps</th><th>What happens</th></tr></thead><tbody>{clip_rows}</tbody></table></div>
</section>

<section class="block"><h2>Per-bot beats <span>eight bots, sixteen specials</span></h2>
<p class="sub" style="margin-bottom:6px">The still on each card is the reference image for every frame of that bot. "Body" is what to draw in the bot clip. "Effect sheets" names the VFX keys the game will look for.</p>
<div class="roster">
{cards}
</div>
</section>

<section class="block"><h2>Effect sheets <span>vfx keys</span></h2>
<p class="sub" style="margin-bottom:10px">Square frames, one strip. Sizes are the drawn width in world units at scale 1 (a bot is about 1.5 units wide); the game scales impacts by their blast radius. Anything painted on black is composited additively, so keep backgrounds truly black. Smoke and dust need real alpha.</p>
<div class="tablewrap"><table><thead><tr><th>Key</th><th>Frames</th><th>fps</th><th>Size</th><th>Backdrop</th><th>Content</th></tr></thead><tbody>{vfx_rows}</tbody></table></div>
</section>

<section class="block"><h2>Generation recipe <span>with an image model</span></h2>
<div class="steps">
  <div><h3>Lock the reference</h3><p>Use the bot's existing still as the image reference for every request, plus the fire-pose references already in <code>art/reference/</code>. Never generate a clip without it; consistency comes from the reference, not the prompt.</p></div>
  <div><h3>Keyframes before inbetweens</h3><p>For each clip, first request a 3 or 4 cell sheet of the extreme poses only (anticipation, action, recovery). Judge silhouette and lighting on those. Only then request the full 8-cell sheet with those keyframes described cell by cell.</p></div>
  <div><h3>Prompt template</h3><pre>Animation contact sheet, 4 columns x 2 rows, 8 cells, same robot as the reference image,
identical paint style, identical camera and scale, robot faces right in every cell,
flat green background #3CC828, no ground shadow, no text, no borders.
Clip: FIRE. Cell 1 weapon drawn back (anticipation). Cell 2 muzzle flash, barrel thrust
forward, body pushed back, motion smear on the barrel. Cells 3-4 recoil settling.
Cells 5-8 return to the idle pose. Key light upper left, warm rim light as in reference.</pre></div>
  <div><h3>Fix cells, not sheets</h3><p>When one cell drifts (wrong scale, extra limb, shifted light), regenerate just that cell with the neighbouring cells as references and paste it back. The intake tool accepts a folder of single frames for exactly this.</p></div>
  <div><h3>Effects on black</h3><p>Request effect sheets as "8 cells on pure black, additive light effect, no character". Keep each effect centred in its cell except <code>gale</code>, whose cone starts at the left-edge centre and points right.</p></div>
  <div><h3>Check in motion</h3><p>Run the intake tool, then open the game: every clip plays in the match the moment its file exists. Watch idle for hop (baseline drift), fire for the flash frame reading at small size, and death for the last frame being a wreck rather than a blank.</p></div>
</div>
</section>

<section class="block"><h2>Production order <span>what to make first</span></h2>
<div class="rules">
  <div><h3>Pass 1, feel</h3><ul class="check"><li>All 8 bots: idle, fire, hit</li><li>Effects: explosion, explosion_big, muzzle, land_dust</li></ul><p>This alone makes the game look animated. Jump and land stay procedural for now (the squash is already decent).</p></div>
  <div><h3>Pass 2, mobility</h3><ul class="check"><li>All 8 bots: jump, land, death</li><li>Effects: jump_dust, mine_blast, teleport_out and teleport_in</li></ul></div>
  <div><h3>Pass 3, specials</h3><ul class="check"><li>s1 and s2 for every bot, following the beats above</li><li>The 15 cast_ sheets plus shockwave, gale, singularity, toxic_cloud, deflector, molten_patch, blink_out and blink_in</li></ul><p>Order the specials by how often they are seen: Chain Arc, Siege Shell, Shockwave and Blink Strike first.</p></div>
  <div><h3>Acceptance</h3><ul class="check"><li>No frame touches the canvas edge</li><li>Idle plays for 10 seconds without a visible hop</li><li>Silhouette test passes at 60 px</li><li>File size under 1 MB per clip after intake (the tool reports it)</li></ul></div>
</div>
</section>
<p class="sub" style="margin-top:28px;font-size:13px;color:var(--faint)">Engine support in build {BUILD}: painted clips per bot state with per-clip fps and loop, VFX sheets with additive or normal blend, per-event fallbacks to the procedural effects, and intake tools that key, align and register everything.</p>
</div>
'''
open(f'{SP}/anim-bible.html', 'w').write(page)
open('/home/user/SuperBots/art/ANIMATION_BIBLE.html', 'w').write(page)
print('written', len(page))
