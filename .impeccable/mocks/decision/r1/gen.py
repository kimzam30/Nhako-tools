import html, json, os
OUT = os.path.dirname(os.path.abspath(__file__))
ACC = '#c7009b'
CC = {'pdf':'#e03131','img':'#1c7ed6','media':'#7048e8','calc':'#0ca678','dev':'#1098ad','my':'#f08c00'}
POPCAT = ['pdf','pdf','pdf','pdf','img','img','calc','calc']
LOGO = '''<svg class="logo" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><rect width="8" height="8" rx="1.4" fill="#ffd23f"/><rect x="1" y="1.2" width="6" height="2.8" fill="#e4002b"/><rect x="2" y="2" width="1" height="1" fill="#fff"/><rect x="5" y="2" width="1" height="1" fill="#fff"/><rect x="3.5" y="4" width="1" height="3.4" fill="#8a5a2b"/></svg>'''
FLY = '''<svg class="fly" viewBox="0 0 24 18" aria-hidden="true"><path d="M12 9C9 2 3 0 1.5 2.5S4 10 9 10.5C4 12 3 16 5.5 17S11 14 12 10c1 4 4 8 6.5 7s1.5-5-3.5-6.5c5-.5 9-5.5 7.5-8S15 2 12 9z" fill="var(--accent)"/></svg>'''
I = {
 'pdf':'<path d="M7 3h7l5 5v13H7z M14 3v5h5" />',
 'img':'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/>',
 'media':'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
 'calc':'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12v5M8 16h2M12 16h2"/>',
 'dev':'<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
 'my':'<path d="M5 21V4M5 4h11l-2 3.5L16 11H5"/>',
 'star':'<path d="M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7z"/>',
 'search':'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
 'up':'<path d="M12 16V5M7 10l5-5 5 5M5 19h14"/>',
 'home':'<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
 'grid':'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
 'check':'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 'shield':'<path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z"/>',
 'merge':'<path d="M6 4v5c0 3 6 3 6 7v4M18 4v5c0 3-6 3-6 7"/>',
 'person':'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5"/>',
 'word':'<path d="M7 3h7l5 5v13H7z"/><path d="M9.5 12l1.3 5 1.2-4 1.2 4 1.3-5"/>',
 'shrink':'<path d="M7 3h7l5 5v13H7z"/><path d="M10 11l2 2 2-2M10 17l2-2 2 2"/>',
}
def ic(n, s=20): return f'<svg class="ic" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{I[n]}</svg>'
CATS=[('pdf','PDF',24,'Merge, compress, convert, sign'),('img','Image',12,'Compress, resize, passport photo'),('media','Media',4,'Compress video, transcribe'),('calc','Calculators',2,'Take-home pay, CGPA'),('dev','Developer',9,'JSON, QR, Base64, diff'),('my','Malaysia',8,'SPA, salary, passport, CGPA')]
POP=[('shrink','Compress PDF to 500 KB','For SPA, UPU and scholarship portals'),('merge','Merge PDF','Combine files in the order you set'),('img','JPG to PDF','Photos into one PDF'),('word','PDF to Word','Editable .docx'),('person','Passport photo 35×50','White background, 4R print sheet'),('img','Compress image to 100 KB','Exact size for any portal'),('calc','Salary calculator','EPF, SOCSO, EIS, PCB 2026'),('calc','CGPA calculator','Semester GPA and target')]
PROMISE=['Free, no limits','No account','No ads, ever']
def page(title, css, body, w, h, font):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family={font}&display=swap" rel="stylesheet">
<style>:root{{--accent:{ACC}}}*{{box-sizing:border-box;margin:0}}body{{width:{w}px;height:{h}px;overflow:hidden}}
.ic{{flex:none}}.logo{{width:30px;height:30px;flex:none}}.fly{{width:22px;height:17px;flex:none}}
.acc-bg{{background:var(--accent);color:#fff}}.acc{{color:var(--accent)}}
.cc{{color:var(--c)}}.cc-bg{{background:var(--c);color:#fff}}.cc-tint{{background:color-mix(in srgb,var(--c) 11%,#fff);color:var(--c)}}
.tint{{background:color-mix(in srgb,var(--accent) 9%,#fff)}}.tint2{{background:color-mix(in srgb,var(--accent) 15%,#fff)}}
{css}</style></head><body>{body}</body></html>'''
def write(name, s): open(os.path.join(OUT,name),'w').write(s)

# ---------- A. Dompet: super-app clarity ----------
A_FONT='Manrope:wght@400;500;600;700;800'
A_CSS='''body{font-family:Manrope,system-ui,sans-serif;color:#14171a;background:#f5f6f8}
.top{height:72px;background:#fff;border-bottom:1px solid #e6e8ec;display:flex;align-items:center;gap:20px;padding:0 40px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px}
.sbar{flex:1;max-width:640px;margin:0 auto;height:48px;border-radius:24px;background:#f1f3f5;display:flex;align-items:center;gap:10px;padding:0 18px;color:#6a727b;font-size:15px}
.r{display:flex;gap:10px;align-items:center;font-weight:700;font-size:14px}.pill{border:1px solid #dde0e4;border-radius:999px;padding:7px 14px}
.wrap{padding:28px 40px}
.hero{border-radius:22px;padding:30px 34px;display:flex;justify-content:space-between;align-items:center}
.hero h1{font-size:38px;font-weight:800;letter-spacing:-.02em;line-height:1.1;max-width:640px}
.hero p{margin-top:10px;color:#4b535b;font-size:17px}
.prom{display:flex;gap:10px;margin-top:16px}.prom span{display:flex;gap:6px;align-items:center;background:#fff;border-radius:999px;padding:7px 13px;font-weight:700;font-size:13px}
.cats{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:22px}
.cat{background:#fff;border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:10px;border:1px solid #eceef1}
.cat .b{width:46px;height:46px;border-radius:14px;display:grid;place-items:center}
.cat b{font-size:16px}.cat small{color:#6a727b;font-size:13px}
h2{font-size:18px;font-weight:800;margin:26px 0 12px}
.pop{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.job{background:#fff;border-radius:16px;padding:16px;display:flex;gap:12px;align-items:center;border:1px solid #eceef1}
.top{border-bottom:3px solid var(--accent)}.ph .top{border-bottom-width:2px}
.job .b{width:40px;height:40px;border-radius:12px;display:grid;place-items:center}
.job b{display:block;font-size:15px}.job small{color:#6a727b;font-size:13px}
.tool{display:grid;grid-template-columns:1fr 380px;gap:22px;padding:26px 40px}
.crumb{color:#6a727b;font-size:14px;padding:22px 40px 0}
.tool h1{font-size:32px;font-weight:800;letter-spacing:-.02em}
.drop{margin-top:16px;background:#fff;border:2px dashed #cfd4da;border-radius:22px;height:360px;display:grid;place-items:center;text-align:center}
.drop .btn{display:inline-flex;gap:8px;align-items:center;border-radius:14px;padding:15px 26px;font-weight:800;font-size:17px;margin:14px 0 8px}
.panel{background:#fff;border-radius:22px;border:1px solid #eceef1;padding:22px;display:grid;gap:16px;align-content:start}
.f label{display:block;font-weight:700;font-size:13px;margin-bottom:6px}.f div{height:46px;border:1px solid #dde0e4;border-radius:12px;display:flex;align-items:center;padding:0 14px;font-size:15px}
.res{border-radius:18px;padding:18px}.res .n{font-size:34px;font-weight:800;letter-spacing:-.02em}.res s{color:#6a727b;font-size:18px;font-weight:600}
.save{border-radius:14px;padding:14px;text-align:center;font-weight:800}
/* phone */
.ph .top{height:60px;padding:0 16px}.ph .wrap{padding:16px}
.ph .hero{padding:20px;border-radius:18px;display:block}.ph .hero h1{font-size:24px}.ph .hero p{font-size:14px}
.ph .sbar2{margin-top:14px;height:46px;border-radius:23px;background:#fff;display:flex;align-items:center;gap:8px;padding:0 14px;color:#6a727b;font-size:14px}
.ph .cats{grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}.ph .cat{padding:12px;border-radius:16px;align-items:center;text-align:center;gap:6px}.ph .cat small{display:none}.ph .cat b{font-size:13px}
.ph h2{font-size:16px;margin:18px 0 10px}.ph .pop{grid-template-columns:1fr;gap:8px}.ph .job{padding:12px}
.tabs{position:absolute;left:12px;right:12px;bottom:14px;height:64px;background:#fff;border-radius:20px;box-shadow:0 8px 24px -8px rgba(20,23,26,.25);display:grid;grid-template-columns:repeat(4,1fr);align-items:center;text-align:center;font-size:11px;font-weight:700;color:#6a727b}
.tabs div{display:grid;justify-items:center;gap:3px}'''
def a_top(phone=False):
    if phone: return f'<div class="top">{LOGO}<b style="font-size:18px;font-weight:800">Nhako Tools</b><span style="margin-left:auto" class="pill">BM</span></div>'
    return f'<div class="top"><div class="brand">{LOGO}Nhako Tools</div><div class="sbar">{ic("search",18)}Search 50 tools, e.g. “compress pdf 500kb”, “gaji”</div><div class="r"><span>{ic("star",18)}</span><span class="pill">BM / EN</span></div></div>'
def a_cats(): return ''.join(f'<div class="cat" style="--c:{CC[i]}"><div class="b cc-tint">{ic(i,24)}</div><b>{n}</b><small>{c} tools · {d}</small></div>' for i,n,c,d in CATS)
def a_pop(k=8): return ''.join(f'<div class="job" style="--c:{CC[POPCAT[j]]}"><div class="b cc-tint">{ic(i,20)}</div><div><b>{n}</b><small>{d}</small></div></div>' for j,(i,n,d) in enumerate(POP[:k]))
write('A-home.html', page('Dompet home', A_CSS, f'''{a_top()}<div class="wrap"><div class="hero tint2"><div><h1>Every file job your forms ask for. Free, no catch.</h1><p>50 tools for PDFs, photos, video and Malaysian forms, running on your own device.</p><div class="prom">{''.join(f'<span>{ic("check",15)}{p}</span>' for p in PROMISE)}</div></div>{FLY.replace('class="fly"','class="fly" style="width:120px;height:90px"')}</div>
<div class="cats">{a_cats()}</div><h2>Popular with students</h2><div class="pop">{a_pop()}</div></div>''',1440,900,A_FONT))
write('A-tool.html', page('Dompet tool', A_CSS, f'''{a_top()}<div class="crumb"><span class="cc" style="--c:{CC['pdf']};font-weight:700">PDF</span> › Compress PDF</div><div class="tool" style="--c:{CC['pdf']}"><div><h1>Compress PDF</h1><p style="color:#4b535b;margin-top:6px">Shrink a PDF, or get it under an exact size for a portal. Runs on your device.</p>
<div class="drop" style="border-color:color-mix(in srgb,var(--c) 45%,#fff);background:color-mix(in srgb,var(--c) 4%,#fff)"><div><span class="cc">{ic("up",44)}</span><br><span class="btn cc-bg">{ic("pdf",20)}Choose PDF</span><br><small style="color:#6a727b">or drop it here · any size · nothing uploads</small></div></div></div>
<div class="panel"><div class="f"><label>Target size</label><div>Under 500 KB ▾</div></div><div class="f"><label>Mode</label><div>Recommended: shrinks images, keeps text ▾</div></div>
<div class="res" style="background:color-mix(in srgb,var(--c) 8%,#fff)"><small style="font-weight:700">scholarship-docs.pdf</small><div class="n"><s>5.7 MB</s> → 486 KB</div><small>Under 500 KB · 40 pages · 2.4 s</small></div><div class="save cc-bg">Save PDF</div></div></div>''',1440,900,A_FONT))
write('A-phone.html', page('Dompet phone', A_CSS, f'''<div class="ph" style="position:relative;height:844px">{a_top(True)}<div class="wrap"><div class="hero tint2"><h1>Every file job your forms ask for.</h1><p>Free, no limits, no account.</p><div class="sbar2">{ic("search",18)}Search 50 tools</div></div>
<div class="cats">{a_cats()}</div><h2>Popular with students</h2><div class="pop">{a_pop(3)}</div></div>
<div class="tabs"><div class="acc">{ic("home",22)}Home</div><div>{ic("grid",22)}Tools</div><div>{ic("star",22)}Saved</div><div>{ic("my",22)}Malaysia</div></div></div>''',390,844,A_FONT))

# ---------- B. Borang: civic form clarity, side rail ----------
B_FONT='Public+Sans:wght@400;500;600;700;800'
B_CSS='''body{font-family:'Public Sans',system-ui,sans-serif;color:#1b1f24;background:#fff;display:grid;grid-template-columns:264px 1fr}
.rail{background:#f6f7f9;border-right:1px solid #e3e6ea;height:900px;padding:22px 16px;display:flex;flex-direction:column;gap:4px}
.brand{display:flex;gap:10px;align-items:center;font-weight:800;font-size:19px;padding:0 8px 18px}
.nav{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:8px;font-weight:600;font-size:15px;color:#3b434c}
.nav small{margin-left:auto;color:#7a828b;font-weight:500}
.nav.on{color:var(--accent)}.nav.on{background:color-mix(in srgb,var(--accent) 10%,#fff)}
.sep{height:1px;background:#e3e6ea;margin:10px 8px}
.main{height:900px;overflow:hidden}
.bar{height:64px;border-bottom:1px solid #e3e6ea;display:flex;align-items:center;gap:16px;padding:0 36px}
.s{flex:1;max-width:560px;height:42px;border:1px solid #cdd2d8;border-radius:8px;display:flex;gap:10px;align-items:center;padding:0 14px;color:#6b737c;font-size:15px}
.lang{margin-left:auto;display:flex;border:1px solid #cdd2d8;border-radius:8px;overflow:hidden;font-weight:700;font-size:13px}.lang span{padding:7px 12px}.lang .on{background:#1b1f24;color:#fff}
.in{padding:34px 36px}
h1{font-size:36px;font-weight:800;letter-spacing:-.015em;line-height:1.15;max-width:760px}
.lead{margin-top:10px;font-size:18px;color:#4c545d;max-width:62ch}
.prom{display:flex;gap:22px;margin-top:14px;font-weight:700;font-size:14px}.prom span{display:flex;gap:6px;align-items:center}
.sect{margin-top:30px;display:flex;justify-content:space-between;align-items:baseline}.sect h2{font-size:19px;font-weight:800}.sect a{font-weight:700;font-size:14px}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:15px}
td{padding:14px 10px;border-top:1px solid #e3e6ea}td:first-child{width:44px}
td b{font-weight:700}.muted{color:#6b737c}
.go{font-weight:700;text-align:right}
.steps{display:flex;gap:0;margin-top:22px;border:1px solid #e3e6ea;border-radius:10px;overflow:hidden}
.step{flex:1;padding:14px 18px;display:flex;gap:10px;align-items:center;font-weight:700;font-size:15px;color:#6b737c;border-right:1px solid #e3e6ea}
.step i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-style:normal;border:2px solid currentColor;font-size:13px}
.step.on{color:#1b1f24}.step.on i{background:var(--accent);border-color:var(--accent);color:#fff}.step.done{color:var(--accent)}
.grid2{display:grid;grid-template-columns:1fr 340px;gap:24px;margin-top:20px}
.drop{border:2px dashed #b9c0c8;border-radius:12px;height:300px;display:grid;place-items:center;text-align:center;background:#fafbfc}
.btn{display:inline-flex;gap:8px;align-items:center;border-radius:8px;padding:13px 22px;font-weight:700;font-size:16px;margin:12px 0 6px}
.form{display:grid;gap:14px;align-content:start}.f label{display:block;font-weight:700;font-size:14px;margin-bottom:6px}.f div{height:44px;border:1px solid #cdd2d8;border-radius:8px;display:flex;align-items:center;padding:0 12px}
.f p{font-size:13px;color:#6b737c;margin-top:4px}
.res{border:1px solid #e3e6ea;border-radius:10px;padding:16px}.res .n{font-size:30px;font-weight:800}.res s{font-size:17px;color:#6b737c;font-weight:500}
/* phone */
.phb{display:block;width:390px;height:844px;font-family:'Public Sans',system-ui,sans-serif}
.phb .bar{padding:0 16px;height:58px}.phb .in{padding:18px 16px}.phb h1{font-size:25px}.phb .lead{font-size:15px}
.chips{display:flex;gap:8px;overflow:hidden;margin-top:16px}.chips span{flex:none;border:1px solid #cdd2d8;border-radius:999px;padding:8px 13px;font-weight:700;font-size:13px}.chips .on{border-color:var(--accent)}
.phb table{font-size:14px}.phb td{padding:12px 6px}'''
def b_rail(active):
    items=''.join(f'<div class="nav{" on" if n==active else ""}">{ic(i,20)}{n}<small>{c}</small></div>' for i,n,c,d in CATS)
    return f'<aside class="rail"><div class="brand">{LOGO}Nhako Tools</div><div class="nav{" on" if active=="Home" else ""}">{ic("home",20)}Home</div><div class="nav">{ic("star",20)}Favourites</div><div class="sep"></div>{items}<div style="margin-top:auto;font-size:13px;color:#6b737c;padding:8px">{FLY} Free · no limits · no account · no ads</div></aside>'
def b_bar(): return f'<div class="bar"><div class="s">{ic("search",18)}Search 50 tools</div><div class="lang"><span class="on">EN</span><span>BM</span></div></div>'
rows=''.join(f'<tr><td class="acc">{ic(i,22)}</td><td><b>{n}</b></td><td class="muted">{d}</td><td class="go acc">Open →</td></tr>' for i,n,d in POP[:7])
write('B-home.html', page('Borang home', B_CSS, f'''{b_rail("Home")}<div class="main">{b_bar()}<div class="in"><h1>Free tools for the PDFs, photos and forms you deal with every week.</h1><p class="lead">50 tools in English and Bahasa Melayu. They run on your own device, so there is nothing to upload and nothing to wait for.</p>
<div class="prom">{''.join(f'<span class="acc">{ic("check",16)}<span style="color:#1b1f24">{p}</span></span>' for p in PROMISE)}</div>
<div class="sect"><h2>Most used</h2><a class="acc">All 50 tools →</a></div><table>{rows}</table></div></div>''',1440,900,B_FONT))
write('B-tool.html', page('Borang tool', B_CSS, f'''{b_rail("PDF")}<div class="main">{b_bar()}<div class="in"><div class="muted" style="font-size:14px">PDF › Compress</div><h1 style="margin-top:6px">Compress PDF</h1><p class="lead">Shrink a PDF, or get it under the exact size a portal asks for.</p>
<div class="steps"><div class="step done"><i>{ic("check",14)}</i>1 Choose file</div><div class="step on"><i>2</i>2 Settings</div><div class="step"><i>3</i>3 Save</div></div>
<div class="grid2"><div class="drop"><div><b style="font-size:17px">scholarship-docs.pdf</b><br><span class="muted">40 pages · 5.7 MB</span><br><span class="btn acc-bg">Compress to under 500 KB</span><br><small class="muted">Nothing is uploaded</small></div></div>
<div class="form"><div class="f"><label>Target size</label><div>Under 500 KB</div><p>Aimed at 1,000 bytes per KB, so any portal accepts it.</p></div><div class="f"><label>Mode</label><div>Recommended</div></div><div class="res"><small class="muted">Estimated</small><div class="n"><s>5.7 MB</s> → ~490 KB</div></div></div></div></div></div>''',1440,900,B_FONT))
chip=''.join(f'<span{" class=on" if n=="PDF" else ""}>{n}</span>' for _,n,_,_ in CATS)
rowsm=''.join(f'<tr><td class="acc">{ic(i,20)}</td><td><b>{n}</b><br><span class="muted">{d}</span></td></tr>' for i,n,d in POP[:6])
write('B-phone.html', page('Borang phone', B_CSS, f'''<div class="phb"><div class="bar">{LOGO}<b style="font-size:17px">Nhako Tools</b><span style="margin-left:auto">{ic("search",22)}</span><span>{ic("grid",22)}</span></div><div class="in"><h1>Free tools for your PDFs, photos and forms.</h1><p class="lead">No upload, no account, no ads.</p><div class="chips">{chip}</div><table style="margin-top:14px">{rowsm}</table></div></div>''',390,844,B_FONT))

# ---------- C. Kaunter: search-first counter board ----------
C_FONT='Figtree:wght@400;500;600;700;800'
C_CSS='''body{font-family:Figtree,system-ui,sans-serif;color:#15181b;background:#fff}
.top{height:68px;display:flex;align-items:center;gap:30px;padding:0 56px;border-bottom:1px solid #eceef0}
.brand{display:flex;gap:10px;align-items:center;font-weight:800;font-size:20px}
.menu{display:flex;gap:26px;font-weight:600;font-size:15px;color:#40474e}.menu b{color:#15181b}
.r{margin-left:auto;display:flex;gap:16px;align-items:center;font-weight:700;font-size:14px}
.hero{text-align:center;padding:52px 0 28px}
.hero h1{font-size:50px;font-weight:800;letter-spacing:-.025em;line-height:1.05}
.hero p{margin-top:12px;color:#525a62;font-size:19px}
.big{width:760px;margin:26px auto 0;height:64px;border-radius:16px;border:2px solid #15181b;display:flex;align-items:center;gap:12px;padding:0 20px;font-size:18px;color:#5d656d;box-shadow:0 10px 30px -18px rgba(21,24,27,.45)}
.big span{margin-left:auto;border-radius:10px;padding:10px 18px;font-weight:800;font-size:15px}
.prom{display:flex;justify-content:center;gap:22px;margin-top:14px;font-weight:700;font-size:14px;color:#3d444b}.prom span{display:flex;gap:6px;align-items:center}
.board{display:grid;grid-template-columns:repeat(4,1fr);gap:0 40px;padding:26px 120px 0}
.col h3{font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6a727a;padding-bottom:8px;border-bottom:2px solid #15181b;display:flex;gap:8px;align-items:center}
.col a{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eceef0;font-weight:600;font-size:15px}
.col a em{font-style:normal;font-size:12px;font-weight:800;border-radius:6px;padding:2px 7px}
.tool{max-width:900px;margin:0 auto;padding:40px 0;text-align:center}
.tool h1{font-size:40px;font-weight:800;letter-spacing:-.02em}
.tool p{color:#525a62;font-size:18px;margin-top:8px}
.drop{margin-top:26px;border-radius:24px;height:300px;display:grid;place-items:center}
.drop .btn{display:inline-flex;gap:10px;align-items:center;border-radius:14px;padding:18px 34px;font-weight:800;font-size:19px;box-shadow:0 12px 26px -12px var(--accent)}
.opts{display:flex;justify-content:center;gap:12px;margin-top:20px}.opts span{border:1px solid #d9dde1;border-radius:999px;padding:9px 16px;font-weight:700;font-size:14px}.opts .on{border-color:var(--accent);color:var(--accent)}
.how{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:30px;text-align:left}.how div{font-size:15px;color:#525a62}.how b{display:block;color:#15181b;font-size:16px}
.ph .top{padding:0 16px;height:58px}.ph .hero{padding:26px 16px 14px}.ph .hero h1{font-size:30px}.ph .hero p{font-size:15px}
.ph .big{width:auto;margin:16px 16px 0;height:54px;font-size:15px}.ph .board{grid-template-columns:1fr;padding:18px 16px 0;gap:18px}'''
def c_top(): return f'<div class="top"><div class="brand">{LOGO}Nhako Tools</div><div class="menu"><b>PDF ▾</b><span>Image ▾</span><span>Media ▾</span><span>Calculators ▾</span><span>Developer ▾</span><span>Malaysia</span></div><div class="r"><span>{ic("star",18)}</span><span>BM</span></div></div>'
cols={'PDF':['Compress PDF','Merge PDF','PDF to Word','JPG to PDF','Sign PDF'],'Image':['Compress image','Passport photo','HEIC to JPG','Resize image','Remove background'],'Malaysia':['SPA MyRésumé photo','Salary calculator','CGPA calculator','Compress to 100 KB','Passport 35×50'],'Media':['Compress video','Audio to text','Extract audio','Teleprompter']}
board=''.join(f'<div class="col"><h3>{ic({"PDF":"pdf","Image":"img","Malaysia":"my","Media":"media"}[k],16)}{k}</h3>'+''.join(f'<a>{t}{"<em class=tint2>Popular</em>" if j==0 else ""}</a>' for j,t in enumerate(v))+'</div>' for k,v in cols.items())
write('C-home.html', page('Kaunter home', C_CSS, f'''{c_top()}<div class="hero"><h1>What do you need to do today?</h1><p>50 free tools for PDFs, photos, video and Malaysian forms, on your own device.</p>
<div class="big">{ic("search",22)}Compress PDF to 500 KB<span class="acc-bg">Search</span></div><div class="prom">{''.join(f'<span><span class="acc">{ic("check",16)}</span>{p}</span>' for p in PROMISE)}</div></div><div class="board">{board}</div>''',1440,900,C_FONT))
write('C-tool.html', page('Kaunter tool', C_CSS, f'''{c_top()}<div class="tool"><h1>Compress PDF</h1><p>Make a PDF smaller, or get it under the exact size a portal asks for.</p>
<div class="drop tint"><div><span class="btn acc-bg">{ic("pdf",22)}Choose PDF file</span><br><small style="display:block;margin-top:12px;color:#525a62">or drop it here · nothing is uploaded</small></div></div>
<div class="opts"><span>No target</span><span>Under 100 KB</span><span>Under 200 KB</span><span class="on">Under 500 KB</span><span>Under 1 MB</span></div>
<div class="how"><div><b>1. Choose your PDF</b>Any size, straight from your phone or computer.</div><div><b>2. Pick a target</b>We find the best quality that fits.</div><div><b>3. Save it</b>Ready for SPA, UPU or any portal.</div></div></div>''',1440,900,C_FONT))
pboard=''.join(f'<div class="col"><h3>{ic({"PDF":"pdf","Image":"img","Malaysia":"my","Media":"media"}[k],16)}{k}</h3>'+''.join(f'<a>{t}</a>' for t in v[:3])+'</div>' for k,v in list(cols.items())[:3])
write('C-phone.html', page('Kaunter phone', C_CSS, f'''<div class="ph"><div class="top">{LOGO}<b style="font-size:17px">Nhako Tools</b><span style="margin-left:auto">{ic("grid",22)}</span></div><div class="hero"><h1>What do you need to do today?</h1><p>Free, no limits, no account.</p></div><div class="big">{ic("search",20)}Search 50 tools</div><div class="board">{pboard}</div></div>''',390,844,C_FONT))

# ---------- D. Canon, against iLovePDF / Smallpdf / PDF24 ----------
D_CSS='''body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2430;background:#f6f7fb}
.top{height:64px;background:#fff;display:flex;align-items:center;gap:26px;padding:0 48px;box-shadow:0 1px 0 #e7e9ef}
.brand{display:flex;gap:10px;align-items:center;font-weight:800;font-size:20px}.menu{display:flex;gap:22px;font-weight:600;font-size:15px}
.cta{margin-left:auto;border-radius:8px;padding:9px 16px;font-weight:700}
.hero{text-align:center;padding:46px 0 26px}.hero h1{font-size:44px;font-weight:800;letter-spacing:-.02em}.hero p{margin-top:10px;font-size:19px;color:#5b6273}
.filters{display:flex;justify-content:center;gap:10px;margin-bottom:22px}.filters span{border-radius:999px;padding:8px 16px;font-weight:700;font-size:14px;background:#fff;border:1px solid #e1e4ea}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;padding:0 110px}
.t{background:#fff;border-radius:12px;padding:18px;height:146px;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.t .b{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;margin-bottom:10px}
.t b{display:block;font-size:16px}.t small{display:block;color:#5b6273;font-size:13px;margin-top:3px;line-height:1.35}
.tool{text-align:center;padding:60px 0}.tool h1{font-size:44px;font-weight:800}.tool p{font-size:19px;color:#5b6273;margin-top:10px}
.sel{display:inline-flex;gap:10px;align-items:center;border-radius:12px;padding:22px 52px;font-weight:800;font-size:22px;margin-top:36px;box-shadow:0 10px 24px -10px var(--accent)}
.ph .top{padding:0 16px;height:56px}.ph .hero{padding:24px 16px 14px}.ph .hero h1{font-size:26px}.ph .hero p{font-size:15px}
.ph .grid{grid-template-columns:1fr 1fr;padding:0 16px;gap:10px}.ph .t{height:auto;padding:14px}'''
tiles=''.join(f'<div class="t"><div class="b tint acc">{ic(i,22)}</div><b>{n}</b><small>{d}</small></div>' for i,n,d in POP+[('shield','Protect PDF','Add a password'),('img','HEIC to JPG','iPhone photos'),('media','Compress video','To a target size'),('pdf','Sign PDF','Draw or type')])
write('D-home.html', page('Canon home', D_CSS, f'''<div class="top"><div class="brand">{LOGO}Nhako Tools</div><div class="menu"><span>Merge PDF</span><span>Compress PDF</span><span>Convert ▾</span><span>All tools ▾</span></div><span class="cta acc-bg">BM / EN</span></div>
<div class="hero"><h1>Every tool you need for PDFs and images</h1><p>Free, no limits, no account, no ads. Your files stay on your device.</p></div><div class="filters"><span class="acc-bg">All</span><span>PDF</span><span>Image</span><span>Media</span><span>Calculators</span><span>Malaysia</span></div><div class="grid">{tiles}</div>''',1440,900,'Inter:wght@400'))
write('D-tool.html', page('Canon tool', D_CSS, f'''<div class="top"><div class="brand">{LOGO}Nhako Tools</div><div class="menu"><span>Merge PDF</span><span>Compress PDF</span><span>Convert ▾</span><span>All tools ▾</span></div><span class="cta acc-bg">BM / EN</span></div>
<div class="tool"><h1>Compress PDF</h1><p>Reduce file size while keeping the best quality.</p><span class="sel acc-bg">Select PDF file</span><p style="font-size:15px;margin-top:14px">or drop PDF here</p></div>''',1440,900,'Inter:wght@400'))
write('D-phone.html', page('Canon phone', D_CSS, f'''<div class="ph"><div class="top">{LOGO}<b style="font-size:17px">Nhako Tools</b><span style="margin-left:auto">{ic("grid",22)}</span></div><div class="hero"><h1>Every tool you need for PDFs and images</h1><p>Free, no limits, no account.</p></div><div class="grid">{''.join(f'<div class="t"><div class="b tint acc">{ic(i,20)}</div><b>{n}</b></div>' for i,n,d in POP[:8])}</div></div>''',390,844,'Inter:wght@400'))
print('ok')
