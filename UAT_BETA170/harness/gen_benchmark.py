"""Synthetic benchmark replica for the BETA170 UAT.
Engineered so that the *true* answers equal the brief's benchmark figures:
  24,000 RESSUM rows · 22 perforations · 1,200 ft net · 35 % limestone / 65 % dolomite ·
  49 final zones · 3,450 psi probe pressure · 418.91 bbl CT volume balance.
Expected values below are derived from the construction, not from application output.
This proves calculation correctness on benchmark-shaped data; it does NOT reproduce the
customer's real benchmark job (different depths, logs and recordings)."""
import json, os, random
from openpyxl import Workbook
random.seed(4191)
D = os.path.join(os.path.dirname(__file__), "..", "data", "benchmark"); os.makedirs(D, exist_ok=True)
RKB = 82.0
L = [40, 55, 60, 35, 70, 45, 50, 65, 30, 80, 55, 60, 45, 50, 70, 40, 65, 55, 50, 60, 55, 65]
DOL = {0, 1, 2, 3, 4, 7, 9, 10, 11, 14, 16, 19, 21}            # 780 ft dolomite, 420 ft limestone
STEP = {1, 4, 9, 12, 14, 19}                                   # six perforations with one sharp permeability step
assert sum(L) == 1200 and sum(L[i] for i in DOL) == 780 and all(L[i] >= 30 for i in STEP)
LEVEL = [2, 5, 12, 30, 8, 3, 20, 45, 1.5, 6, 15, 25, 4, 10, 35, 2.5, 9, 18, 7, 40, 11, 3.5]

perfs, top = [], 10350.25
for i, l in enumerate(L):
    perfs.append(("K1", top, top + l)); top = top + l + [60, 120, 250, 400][i % 4]   # never adjacent -> 21 blank gaps

def perf_of(md):
    for i, (_, t, b) in enumerate(perfs):
        if t <= md <= b: return i
    return None

rows = []
for k in range(24000):
    md = 10000.0 + 0.5 * k; d = md - 10000.0
    tss = 8000.0 + 0.30 * d + 0.000004 * d * d
    i = perf_of(md)
    if i is None:
        perm = 10 ** random.uniform(-2, 2.5); lith = random.choice([8.5, 10.7, 12.8, 13.5]) + random.uniform(-0.2, 0.2)
    else:
        _, t, b = perfs[i]; perm = LEVEL[i]
        if i in STEP and md > (t + b) / 2: perm = 50.0 if LEVEL[i] < 10 else 1.0      # contrast >= 5x, step at perforation mid-point
        lith = (13.5 if i in DOL else 8.5) + random.uniform(-0.3, 0.3)              # stays inside the VDOL 1.0 / 0.0 bands
    phi = 0.04 + 0.03 * random.random()
    rows.append([md, tss + RKB, tss, perm, phi, 30.0, lith, perm * 0.5, phi * 0.5])

wb = Workbook(); ws = wb.active; ws.title = "RESSUM_Inputs"
ws.append(["ELAN MD (ft)", "ELAN TVD (ft)", "ELAN TVDSS (ft)", "ELAN Permeability (mD)", "ELAN Porosity fraction", "ELAN Water Saturation (%)", "ELAN Lithology Code", "ELAN kL (mD.ftMD)", "ELAN Phih", "",
           "OPS MD (ft)", "OPS TVD (ft)", "OPS TVDSS (ft)", "OPS Permeability (mD)", "OPS Porosity fraction", "OPS Water Saturation (%)", "OPS Lithology Code", "OPS kL (mD.ftMD)", "OPS Phih", "", "RKB"])
for k, r in enumerate(rows): ws.append(r + [None] + r + [None] + ([RKB] if k == 0 else []))
wb.save(os.path.join(D, "RESSUM_benchmark_24000.xlsx"))
json.dump({"rkb": RKB, "rows": rows}, open(os.path.join(D, "ressum_rows.json"), "w"))
json.dump(perfs, open(os.path.join(D, "perforations.json"), "w"))
open(os.path.join(D, "perforations.tsv"), "w").write("Layer\tTop MD\tBottom MD\n" + "\n".join("%s\t%.2f\t%.2f" % p for p in perfs))

# ---- CT recording: every pumped barrel inside the processing window; total 418.91 bbl ----
TOP, BOT, TARGET = 11000.0, 11500.0, 418.91
seg = []                                    # (n seconds, depth fn, rate, speed ft/min)
seg.append((60, lambda k: BOT, 0.0, 0.0))
seg.append((900, lambda k: BOT, 2.0, 0.0))                                   # fill
seg.append((1000, lambda k: BOT - 0.5 * (k + 1), 1.5, -30.0))                # soak up 30 ft/min
seg.append((600, lambda k: TOP, 0.0, 0.0))                                   # shut-in
seg.append((60, lambda k: TOP, 2.5, 0.0))                                    # restart
seg.append((500, lambda k: TOP + (k + 1), 2.5, 60.0))                        # run-in
seg.append((1500, lambda k: BOT - (k + 1) / 3, None, -20.0))                 # pass 1 (4.0 then 4.5)
seg.append((1500, lambda k: TOP + (k + 1) / 3, 4.5, 20.0))                   # pass 2
seg.append((1500, lambda k: BOT - (k + 1) / 3, "P3", -20.0))                 # pass 3, pumping stops at 5-ft arrival
seg.append((60, lambda k: TOP, 0.0, 0.0))
p3_pump = sum(1 for k in range(1500) if BOT - (k + 1) / 3 > TOP + 5)         # samples before arrival within 5 ft
fixed = 900 * 2.0 + 1000 * 1.5 + 60 * 2.5 + 500 * 2.5 + 750 * 4.0 + 750 * 4.5 + 1500 * 4.5
r3 = (TARGET * 60 - fixed) / p3_pump
recs, cum, t, prev_rate = [], 7.0, 23 * 3600 + 20 * 60, 0.0
for n, dep, rate, spd in seg:
    for k in range(n):
        r = rate
        if rate is None: r = 4.0 if k < 750 else 4.5
        if rate == "P3": r = r3 if k < p3_pump else 0.0
        cum += prev_rate / 60.0                                               # meter lags one sample: no volume at the first pumping sample
        d = dep(k)
        recs.append(["%02d:%02d:%02d" % ((t % 86400) // 3600, (t % 3600) // 60, t % 60), d, spd if r > 0 or spd == 0 else spd, 800 + 150 * r, 1500 + 400 * r, 3600 + 20 * r, 20 + 3 * r, r, cum])
        prev_rate = r; t += 1
total = sum(max(0.0, recs[i][8] - recs[i - 1][8]) for i in range(1, len(recs)) if recs[i][7] > .05 or recs[i - 1][7] > .05)
with open(os.path.join(D, "CT_benchmark_1s.txt"), "w") as f:
    f.write("TIME\tNOZZLE_DEPTH\tCT_SPEED\tWH_PRESS\tCIRC_PRESS\tANBHP\tFILTER_DP\tPUMP_RATE\tTOTAL_FLUID\n")
    for r in recs: f.write("\t".join([r[0]] + ["%.8f" % v for v in r[1:]]) + "\n")
exp = {"ressumRows": len(rows), "perforations": len(perfs), "netMD": sum(b - t for _, t, b in perfs), "dolomitePct": 65.0, "limestonePct": 35.0,
       "finalZones": 22 + len(STEP) + 21, "probePressure": 3450, "ctPumpedTotal": round(total, 6), "ctPass3Rate": r3}
json.dump(exp, open(os.path.join(D, "expected.json"), "w"), indent=1); print(exp)
