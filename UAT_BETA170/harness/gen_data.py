"""Deterministic synthetic dataset generator for KM Zonation BETA170 UAT.
No customer datasets were supplied; every file here is synthetic and reproducible (seed 170).
Outputs to ../data/.
"""
import math, random, os, json
from openpyxl import Workbook
from openpyxl.styles import numbers

random.seed(170)
OUT = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT, exist_ok=True)
RKB = 82.0

# ---------------- RESSUM (24,000 rows, 0.5 ft) ----------------
def tvdss_of(md):
    d = md - 10000.0
    return 8000.0 + 0.30 * d + 0.000004 * d * d

rows = []
md = 10000.0
level_k = 5.0; level_len = 0; lith_level = 12.0; lith_len = 0
for i in range(24000):
    md = 10000.0 + 0.5 * i
    if level_len <= 0:
        level_k = 10 ** random.uniform(-2.3, 2.6)
        level_len = random.randint(6, 120)
    if lith_len <= 0:
        lith_level = random.choice([8.5, 9.5, 10.7, 11.5, 12.8, 13.5, 14.5])
        lith_len = random.randint(10, 200)
    level_len -= 1; lith_len -= 1
    perm = level_k * math.exp(random.gauss(0, 0.25))
    phi = min(0.35, max(0.01, 0.05 + 0.04 * math.log10(perm + 0.01) + random.gauss(0, 0.01)))
    sw = min(100, max(5, 40 + random.gauss(0, 8)))
    lith = lith_level + random.gauss(0, 0.2)
    tss = tvdss_of(md)
    r = [md, tss + RKB, tss, perm, phi, sw, lith, perm * 0.5, phi * 0.5]
    # controlled data gaps
    if i % 997 == 0: r[3] = None          # missing perm
    if i % 1493 == 0: r[6] = None         # missing lithology
    if i % 2011 == 0: r[4] = None         # missing porosity
    if i % 3001 == 0: r[3] = 0.0          # zero perm (excluded from power mean)
    rows.append(r)

wb = Workbook(); ws = wb.active; ws.title = "RESSUM_Inputs"
hdr = ["ELAN MD (ft)","ELAN TVD (ft)","ELAN TVDSS (ft)","ELAN Permeability (mD)","ELAN Porosity fraction","ELAN Water Saturation (%)","ELAN Lithology Code","ELAN kL (mD.ftMD)","ELAN Phih","",
       "OPS MD (ft)","OPS TVD (ft)","OPS TVDSS (ft)","OPS Permeability (mD)","OPS Porosity fraction","OPS Water Saturation (%)","OPS Lithology Code","OPS kL (mD.ftMD)","OPS Phih","","RKB"]
ws.append(hdr)
for i, r in enumerate(rows):
    ops = list(r); ops[3] = None if r[3] is None else r[3] * 1.3
    line = r + [None] + ops + [None] + ([RKB] if i == 0 else [])
    ws.append(line)
wb.save(os.path.join(OUT, "RESSUM_synthetic_24000.xlsx"))
json.dump({"rkb": RKB, "rows": rows}, open(os.path.join(OUT, "ressum_rows.json"), "w"))

# ---------------- Perforations: 22 intervals, 1,200 ft net ----------------
lengths = [40, 55, 60, 35, 70, 45, 50, 65, 30, 80, 55, 60, 45, 50, 70, 40, 65, 55, 50, 60, 55, 65]
assert sum(lengths) == 1200 and len(lengths) == 22
perfs = []; top = 10350.25
for j, L in enumerate(lengths):
    bot = top + L
    perfs.append(("K1", round(top, 2), round(bot, 2)))
    gap = 0 if j == 4 else (random.choice([60, 120, 250, 400]))   # interval 5/6 adjacent
    top = bot + gap
json.dump(perfs, open(os.path.join(OUT, "perforations.json"), "w"))
with open(os.path.join(OUT, "perforations_with_header.tsv"), "w") as f:
    f.write("Layer\tTop MD\tBottom MD\n")
    for p in perfs: f.write("%s\t%s\t%s\n" % (p[0], "{:,.2f}".format(p[1]), "{:,.2f}".format(p[2])))
with open(os.path.join(OUT, "perforations_no_header.tsv"), "w") as f:
    for p in perfs: f.write("%s\t%s\t%s\n" % p)

# ---------------- CT actual (1 s), crossing midnight ----------------
def ct_series():
    top, bot = 11000.0, 11500.0
    t0 = 23 * 3600 + 30 * 60
    out = []; cum = 5.0; t = t0
    def add(n, depth_fn, rate_fn, speed_fn):
        nonlocal cum, t
        for k in range(n):
            d = depth_fn(k); r = rate_fn(k)
            cum += r / 60.0
            out.append([t % 86400, d, speed_fn(k), 800 + 150 * r, 1500 + 400 * r, 3600 + 20 * r - 0.2 * (bot - d) / 10, 20 + 3 * r, r, cum])
            t += 1
    add(60, lambda k: bot, lambda k: 0.0, lambda k: 0.0)                          # idle at bottom
    add(600, lambda k: bot, lambda k: 1.5, lambda k: 0.0)                         # fill 15 bbl
    add(1000, lambda k: bot - 0.5 * (k + 1), lambda k: 1.0, lambda k: -30.0)      # soak up 30 ft/min
    add(600, lambda k: top, lambda k: 0.0, lambda k: 0.0)                         # shut-in
    add(60, lambda k: top, lambda k: 2.0, lambda k: 0.0)                          # restart
    add(500, lambda k: top + 1.0 * (k + 1), lambda k: 2.0, lambda k: 60.0)        # run-in 60 ft/min
    add(1500, lambda k: bot - (k + 1) / 3.0, lambda k: 2.0 if k < 750 else 2.5, lambda k: -20.0)  # pass 1 up
    add(1500, lambda k: top + (k + 1) / 3.0, lambda k: 2.5, lambda k: 20.0)       # pass 2 down
    add(1500, lambda k: bot - (k + 1) / 3.0, lambda k: 2.0, lambda k: -20.0)      # pass 3 up
    add(60, lambda k: top, lambda k: 0.0, lambda k: 0.0)
    return out

def fmt_clock(s):
    s = int(round(s)) % 86400
    return "%02d:%02d:%02d" % (s // 3600, (s % 3600) // 60, s % 60)

ct = ct_series()
ct_hdr = "TIME\tNOZZLE_DEPTH\tCT_SPEED\tWH_PRESS\tCIRC_PRESS\tANBHP\tFILTER_DP\tPUMP_RATE\tTOTAL_FLUID"
def write_ct(name, series, step):
    with open(os.path.join(OUT, name), "w") as f:
        f.write(ct_hdr + "\n")
        for i, r in enumerate(series):
            if i % step and i != len(series) - 1: continue
            f.write("\t".join([fmt_clock(r[0])] + ["%.6f" % v for v in r[1:]]) + "\n")
write_ct("CT_actual_1s.txt", ct, 1)
write_ct("CT_actual_5s.txt", ct, 5)    # derived by retaining every 5th row + last row
write_ct("CT_actual_10s.txt", ct, 10)  # derived by retaining every 10th row + last row
# meter-reset variant: TOTAL_FLUID resets to 0 during shut-in
ctr = [list(r) for r in ct]; off = None
for i, r in enumerate(ctr):
    if 60 + 600 + 1000 + 300 <= i:
        if off is None: off = r[8]
        r[8] = r[8] - off
write_ct("CT_actual_1s_meter_reset.txt", ctr, 1)
json.dump(ct, open(os.path.join(OUT, "ct_series.json"), "w"))

# ---------------- BH actual (1 s) ----------------
def bh_series():
    out = []; cum = 0.0; t = 8 * 3600
    def add(vol, rate):
        nonlocal cum, t
        n = int(round(vol / (rate / 60.0)))
        for k in range(n):
            cum += rate / 60.0
            bhp = 3450 + 12 * rate + (150 if rate == 10 else 0)
            out.append([t, 1200 + 60 * rate, 150.0, rate, cum, bhp, bhp - 3450])
            t += 1
    add(10, 3.0)      # opening low-rate volume -> excluded pre-stage
    add(150, 25.0)    # OPR-1
    add(120, 10.0)    # diverter 1 (J5 100 + 20)
    add(150, 25.0)    # OPR-2
    add(120, 10.0)    # diverter 2
    add(150, 25.0)    # OPR-3
    add(60, 20.0)     # displacement
    return out
bh = bh_series()
with open(os.path.join(OUT, "BH_actual_1s.txt"), "w") as f:
    f.write("Time\tTR PRESS\tAN PRESS\tInjection Rate\tTMT Slur\tBHP FracCAT\tStim-DP FracCAT\n")
    for r in bh:
        f.write("\t".join([fmt_clock(r[0])] + ["%.6f" % v for v in r[1:]]) + "\n")
json.dump(bh, open(os.path.join(OUT, "bh_series.json"), "w"))

# ---------------- Prediction and matching tables ----------------
def ct_pred():
    lines = ["Cumulative Volume\tFracture Pressure\tRate BPM\tBHP psi\tWHP psi"]
    v = 0.0
    for i in range(160):
        rate = 2.0 if i < 80 else 2.5
        v += rate * 0.5
        lines.append("%.4f\t%.3f\t%.3f\t%.3f\t%.3f" % (v, 7200 + i, rate, 3900 + 3 * i, 1300 + 2 * i))
    return "\n".join(lines)
open(os.path.join(OUT, "CT_prediction.tsv"), "w").write(ct_pred())

def bh_pred(scale=1.0):
    lines = ["Injected Volume\tFrac Pressure\tRate bpm\tBHP psi\tWHP psi"]
    v = 0.0
    plan = [(150, 25), (120, 10), (150, 25), (120, 10), (150, 25), (60, 20)]
    for vol, rate in plan:
        n = int(vol / 5)
        for k in range(n):
            v += 5
            lines.append("%.3f\t%.3f\t%.3f\t%.3f\t%.3f" % (v, 7300, rate, (3700 + 8 * rate + 0.2 * k) * scale, 1500 + 40 * rate))
    return "\n".join(lines)
open(os.path.join(OUT, "BH_prediction_base.tsv"), "w").write(bh_pred())
open(os.path.join(OUT, "BH_prediction_case3.tsv"), "w").write(bh_pred(1.02))

def ct_match():
    lines = ["Volume\tKM Rate\tKM BHP\tKM WHP"]
    v = 0.0
    for i in range(300):
        rate = 2.0 if i < 150 else 2.5
        v += 0.35
        lines.append("%.4f\t%.4f\t%.3f\t%.3f" % (v, rate, 3700 + i, 1400 + i))
    return "\n".join(lines)
open(os.path.join(OUT, "CT_matching.tsv"), "w").write(ct_match())
bm = bh_pred().split("\n")
bm[0] = "Volume\tFrac Pressure\tKM Rate\tKM BHP\tKM WHP"
open(os.path.join(OUT, "BH_matching_case1.tsv"), "w").write("\n".join(bm))
# same row count, different values
bm2 = [bm[0]] + ["\t".join(l.split("\t")[:3] + [str(float(l.split("\t")[3]) + 50), l.split("\t")[4]]) for l in bm[1:]]
open(os.path.join(OUT, "BH_matching_case1_samecount_changed.tsv"), "w").write("\n".join(bm2))
print("perfs", perfs[:3], "... last", perfs[-1])
print("CT rows", len(ct), "BH rows", len(bh))
