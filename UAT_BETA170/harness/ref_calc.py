"""Independent reference calculation for KM Zonation BETA170 UAT.
Written from the formula register (see report), NOT by calling application code.
Zone boundaries (top/bottom MD) are the only values taken from the application, because the
HumanCluster boundary-selection algorithm has no independent specification available.
"""
import json, math, os, sys, bisect
import openpyxl

S = os.path.join(os.path.dirname(__file__), "..")
D = os.path.join(S, "data"); EV = os.path.join(S, "evidence")
raw = json.load(open(os.path.join(D, "ressum_rows.json")))
RKB = raw["rkb"]
rows = sorted([r for r in raw["rows"] if r[0] is not None], key=lambda r: r[0])
perfs = json.load(open(os.path.join(D, "perforations.json")))
P = dict(probe=8500.0, press=3450.0, fg=0.817, conv=0.107)
POWER = 1.5

MD = [r[0] for r in rows]
TVD = [r[2] + RKB if r[2] is not None else None for r in rows]      # TVD = TVDSS + RKB

def interp_tvd(md):
    pts = [(m, t) for m, t in zip(MD, TVD) if t is not None]
    if md <= pts[0][0]: return pts[0][1]
    if md >= pts[-1][0]: return pts[-1][1]
    i = bisect.bisect_left(MD, md)
    if MD[i] == md: return TVD[i]
    a, b = i - 1, i
    return TVD[a] + (md - MD[a]) * (TVD[b] - TVD[a]) / (MD[b] - MD[a])

def include_bottom(bot):
    return any(abs(p[2] - bot) < 1e-7 for p in perfs) and not any(abs(p[1] - bot) < 1e-7 for p in perfs)

def window(top, bot, last):
    lo = bisect.bisect_left(MD, top)
    hi = bisect.bisect_right(MD, bot) if last else bisect.bisect_left(MD, bot)
    return rows[lo:hi]

def power_mean(vals, p):
    v = [x for x in vals if x is not None and x > 0]
    if not v: return None
    return (sum(x ** p for x in v) / len(v)) ** (1.0 / p)

def vdol(l):
    if l is None: return None
    return 1.0 if l > 13 else 0.8 if l >= 12.5 else 0.6 if l >= 11 else 0.4 if l >= 10.5 else 0.2 if l >= 9 else 0.0

def opf(l):
    if l is None: return (None, None, None)
    if l < 11: return (0.7, 1.0, 0.45)
    if l <= 18: return (0.46, 1.2, 1.0)
    return (None, None, None)

SPURT = [
  [8.21,8.68,9.35,11.69,16.56,26.63,19.389,17.108,13.686,8.1816,7.936152,7.77252,7.36344],
  [18.49,19.54,21.05,26.31,37.28,59.96,22.222,19.608,15.686,10.9802,10.65079,10.4312,9.88218],
  [28.76,30.39,32.75,40.94,57.99,93.29,41.894,36.965,29.572,14.34242,13.91215,13.6253,12.9082],
  [39.04,41.25,44.45,55.56,78.71,126.61,52.944,46.715,37.372,18.12542,17.58166,17.2192,16.3129],
  [49.31,52.11,56.15,70.19,99.43,159.97,55.777,49.215,39.372,19.09542,18.52256,18.1407,17.1859]]
LOAD_COL = {"175":0,"150":1,"125":2,"100":3,"75":4,"50":5,"BG50-75":6,"BG50-100":7,"BG50-120":8,
            "OPS 100-300":9,"OPS 100-400":10,"OPS 100-500":11,"OPS 100-600":12,"400":9,"500":10,"600":11}
def spurt(k, label):
    if k is None or k < 0: return None
    b = 0 if k <= 1 else 1 if k <= 10 else 2 if k <= 100 else 3 if k <= 1000 else 4
    return SPURT[b][LOAD_COL[label]]

def zone(top, bot, blank):
    last = (not blank) and include_bottom(bot)
    w = window(top, bot, last)
    k = power_mean([r[3] for r in w], POWER)
    phis = [r[4] for r in w if r[4] is not None and 0 <= r[4] <= 1]
    liths = [r[6] for r in w if r[6] is not None]
    phi = sum(phis) / len(phis) if phis else None
    lith = sum(liths) / len(liths) if liths else None
    ttop, tbot = interp_tvd(top), interp_tvd(bot)
    vd = vdol(lith); vc = None if vd is None else 1 - vd
    itvd = tbot - ttop if tbot >= ttop else None
    resp = P["press"] + ((ttop + tbot) / 2 - P["probe"]) * P["conv"]
    fgz = P["fg"] * (ttop - RKB) / ttop
    return dict(top=top, bottom=bot, topTVD=ttop, botTVD=tbot, intMD=bot - top, intTVD=itvd, k=k, phi=phi, lith=lith,
                VDOL=vd, VCLC=vc, resP=resp, FG=fgz, ops=opf(lith), n=len(w), blank=blank)

def case_row(z, xd, xl):
    m = None if z["VCLC"] is None else (xd if z["VCLC"] <= 0.4 else xl)
    pm = None if (z["k"] is None or m is None) else z["k"] * m
    f = lambda a, b: None if a is None or b is None else a * b
    return [z["top"], z["bottom"], z["topTVD"], z["botTVD"], z["intMD"], z["intTVD"], z["k"], pm, f(z["k"], z["intMD"]), f(pm, z["intMD"]),
            f(z["k"], z["intTVD"]), f(pm, z["intTVD"]), z["phi"], z["lith"], z["VCLC"], z["VDOL"], z["resP"], z["FG"],
            f(z["VCLC"], z["intMD"]), f(z["VDOL"], z["intMD"]), f(z["phi"], z["intMD"])]

COLS = ["Top MD","Bottom MD","Top TVD","Bottom TVD","Interval MD","Interval TVD","Perm QA","Perm Multi","KH QA MD","KH MD Multi","KH QA TVD","KH TVD Multi","Phi","Lithology","VCLC","VDOL","ResP@mid","FG@top","VCLC*L","VDOL*L","Phi*L"]

def cmp(exp, act, rtol=1e-9, atol=1e-9):
    if exp is None and (act is None or act == ""): return ("match-blank", 0, 0)
    if exp is None or act is None or act == "": return ("MISMATCH-blank", None, None)
    a = abs(exp - act); r = a / abs(exp) if exp else a
    return ("ok" if (a <= atol or r <= rtol) else "MISMATCH", a, r)

def parse_clip(txt):
    out = []
    for line in txt.strip("\n").split("\n"):
        c = line.split("\t")
        out.append([c[0], c[1]] + [float(x) if x != "" else None for x in c[2:]])
    return out

if __name__ == "__main__":
    cap = json.load(open(os.path.join(EV, "t05_capture.json"))); wf = {"clip": cap["clip"], "kminput_spurthead_case1": cap["disp"]["case1"]["spurtHead"], "kminput_spurthead_case3": cap["disp"]["case3"]["spurtHead"]}
    report = {"tolerance": "abs<=1e-9 or rel<=1e-9 (double precision; app and reference use the same raw doubles)", "cases": {}}
    xs = {1: (1.0, 1.0), 3: (1.99995507446, 1.99995507446)}
    for cno in (1, 3):
        clip = parse_clip(wf["clip"]["zone_case%d" % cno])
        mism = []; n = 0; worst = {}
        zones = []
        for r in clip:
            blank = r[1].endswith("_Blank")
            z = zone(r[2], r[3], blank); zones.append(z)
            exp = case_row(z, *xs[cno]); act = r[2:]
            for j, (e, a) in enumerate(zip(exp, act)):
                st, ad, rd = cmp(e, a); n += 1
                if st.startswith("MISMATCH"): mism.append({"zone": r[1], "col": COLS[j], "exp": e, "act": a, "abs": ad, "rel": rd})
                if ad is not None: worst[COLS[j]] = max(worst.get(COLS[j], 0), rd or 0)
        # coverage: no gaps/overlaps, contiguity and perforation union
        cont = all(abs(clip[i][3] - clip[i + 1][2]) < 1e-9 for i in range(len(clip) - 1))
        nonblank = [z for z in zones if not z["blank"]]
        net = sum(z["intMD"] for z in nonblank)
        names = [r[1] for r in clip]
        sums = {"sumIntervalMD": net, "sumKhMD": sum(z["k"] * z["intMD"] for z in nonblank), "sumIntervalTVD": sum(z["intTVD"] for z in nonblank),
                "sumKhTVD": sum(z["k"] * z["intTVD"] for z in nonblank)}
        sums["avgPermMD"] = sums["sumKhMD"] / net
        sums["avgDolPct"] = 100 * sum(z["VDOL"] * z["intMD"] for z in nonblank) / net
        sums["avgLimePct"] = 100 * sum(z["VCLC"] * z["intMD"] for z in nonblank) / net
        sums["avgPhi"] = sum(z["phi"] * z["intMD"] for z in nonblank) / net
        # spurt
        sp = parse_clip("\n".join("x\t" + l for l in wf["clip"]["spurt_case%d" % cno].split("\n")))
        labels = [h.replace("Spurt_Loss ", "") for h in wf["kminput_spurthead_case%d" % cno][1:]]
        spm = []; spn = 0
        for z, r in zip(zones, sp):
            pm = case_row(z, *xs[cno])[7]
            for j, lab in enumerate(labels):
                e = spurt(pm, lab); a = r[2 + j]; spn += 1
                if (e is None) != (a is None) or (e is not None and abs(e - a) > 1e-12): spm.append({"zone": r[1], "label": lab, "exp": e, "act": a})
        report["cases"][cno] = {"zones": len(clip), "nonblank": len(nonblank), "blank": len(clip) - len(nonblank), "cells": n, "mismatches": mism[:50], "mismatchCount": len(mism),
                                "worstRelDiff": worst, "contiguous": cont, "uniqueNames": len(set(names)) == len(names), "sums": sums,
                                "spurtCells": spn, "spurtMismatches": spm[:20], "spurtMismatchCount": len(spm),
                                "grossTop": clip[0][2], "grossBottom": clip[-1][3], "perfNet": sum(p[2] - p[1] for p in perfs)}
    json.dump(report, open(os.path.join(EV, "ref_zone_reconciliation.json"), "w"), indent=1)
    for c, v in report["cases"].items():
        print("Case", c, {k: v[k] for k in ("zones", "nonblank", "cells", "mismatchCount", "spurtCells", "spurtMismatchCount", "contiguous", "uniqueNames")})
        print("  sums", {k: round(x, 6) for k, x in v["sums"].items()})
        print("  worst rel", {k: "%.1e" % x for k, x in v["worstRelDiff"].items()})
        for m in v["mismatches"][:8]: print("  MISMATCH", m)
