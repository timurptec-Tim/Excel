"""Cell-level reconciliation of exported workbooks against the independent reference and app state."""
import json, os, sys, math
import openpyxl
sys.path.insert(0, os.path.dirname(__file__))
import ref_calc as R

EV = R.EV
cap = json.load(open(os.path.join(EV, "t05_capture.json")))
st = cap["state"]
out = {"audited": {}, "matching": {}}

def rows(ws): return [[c.value for c in r] for r in ws.iter_rows()]
def num(v): return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None
def close(a, b, tol=1e-9):
    if a is None or b is None: return a is None and (b is None or b == "")
    return abs(a - b) <= tol * max(1, abs(a))

A = openpyxl.load_workbook(os.path.join(EV, "E2E_audited.xlsx"))
out["audited"]["sheets"] = A.sheetnames
# Final_Zonation vs independent
fz = rows(A["Final_Zonation"]); hdr = fz[0]; body = fz[1:]
mism = []; cells = 0
for r in body:
    blank = str(r[1]).endswith("_Blank"); z = R.zone(r[2], r[3], blank)
    exp = [z["top"], z["bottom"], z["topTVD"], z["botTVD"], z["intMD"], z["intTVD"], z["k"], z["phi"], z["lith"], z["VCLC"], z["VDOL"], z["resP"], z["FG"],
           None if z["VCLC"] is None else z["VCLC"] * z["intMD"], None if z["VDOL"] is None else z["VDOL"] * z["intMD"], None if z["phi"] is None else z["phi"] * z["intMD"]] + list(z["ops"])
    for j, e in enumerate(exp):
        a = r[2 + j]; cells += 1
        a = None if a == "" else a
        if not close(e, a): mism.append((r[1], hdr[2 + j], e, a))
out["audited"]["Final_Zonation"] = {"rows": len(body), "headers": hdr, "cells": cells, "mismatches": mism[:20], "mismatchCount": len(mism)}
# Case sheets vs clipboard (exact)
for c in (1, 3):
    cs = rows(A["Case_%d" % c]); clip = R.parse_clip(cap["clip"]["zone_case%d" % c]); m = 0; n = 0
    for er, cr in zip(cs[1:], clip):
        for j in range(2, 23):
            n += 1; a = er[j]; b = cr[j]; a = None if a == "" else a
            if not ((a is None and b is None) or (a is not None and b is not None and a == b)): m += 1
    out["audited"]["Case_%d" % c] = {"rows": len(cs) - 1, "headers": cs[0], "cellsVsClipboard": n, "notIdentical": m}
    sp = rows(A["Spurt_Loss_%d" % c]); out["audited"]["Spurt_Loss_%d" % c] = {"headers": sp[0], "rows": len(sp) - 1,
        "identicalToClipboard": [[x for x in r[1:]] for r in sp[1:]] == [[None if v == "" else float(v) for v in l.split("\t")[1:]] for l in cap["clip"]["spurt_case%d" % c].split("\n")]}
# Case_Properties vs reference
rep = json.load(open(os.path.join(EV, "ref_zone_reconciliation.json")))
cp = rows(A["Case_Properties"]); out["audited"]["Case_Properties"] = {"headers": cp[0], "rows": cp[1:]}
s1 = rep["cases"]["1"]["sums"]
out["audited"]["Case_Properties_check"] = {
    "case1_MDkH": [cp[1][3], s1["sumKhMD"], close(cp[1][3], s1["sumKhMD"])],
    "case1_avgPermMD": [cp[1][7], s1["avgPermMD"], close(cp[1][7], s1["avgPermMD"])],
    "case3_MDkH_mult": [cp[2][4], None]}
# Summary block
sm = rows(A["Summary"]); out["audited"]["Summary"] = sm
# Job inputs types
ji = rows(A["Job_Inputs"]); out["audited"]["Job_Inputs"] = [[r[0], r[1], type(r[1]).__name__] for r in ji]
pf = rows(A["Perforations"]); out["audited"]["Perforations"] = {"rows": len(pf) - 1, "first": pf[1], "types": [type(x).__name__ for x in pf[1]]}
ra = rows(A["RESSUM_Active"]); raw = R.rows
diff = 0; blanksAsEmptyString = 0
for er, rr in zip(ra[1:], raw):
    for j, (a, b) in enumerate(zip(er[:7], [rr[0], rr[2] + R.RKB, rr[2], rr[3], rr[4], rr[5], rr[6]])):
        if a == "": blanksAsEmptyString += 1; a = None
        if not ((a is None and b is None) or (a is not None and b is not None and abs(a - b) <= 1e-9 * max(1, abs(b)))): diff += 1
out["audited"]["RESSUM_Active"] = {"rows": len(ra) - 1, "headers": ra[0], "cellDiffs": diff, "missingWrittenAsEmptyText": blanksAsEmptyString}
cta = rows(A["CT_Actual"]); out["audited"]["CT_Actual"] = {"headers": cta[0], "rows": cta[1:],
    "speedFullPrecision": all((r[9] == o["speed"]) for r, o in zip(cta[1:], st["actual"]["ct"]["output"])),
    "volFullPrecision": all((r[5] == o["vol"]) for r, o in zip(cta[1:], st["actual"]["ct"]["output"]))}
bha = rows(A["BH_Actual"]); out["audited"]["BH_Actual"] = {"headers": bha[0], "rows": len(bha) - 1, "identical": all(r[5] == o["vol"] and r[8] == o["bhp"] for r, o in zip(bha[1:], st["actual"]["bh"]["output"]))}
dl = rows(A["Diverter_Loadings"]); out["audited"]["Diverter_Loadings"] = {"headers": dl[0], "first3": dl[1:4], "types": [[type(x).__name__ for x in r] for r in dl[1:4]]}
ac = rows(A["Analogue_Candidates"]); out["audited"]["Analogue_Candidates"] = ac
al = rows(A["Audit_Log"]); out["audited"]["Audit_Log"] = {"headers": al[0], "n": len(al) - 1, "sample": al[1:3], "timeType": type(al[1][0]).__name__}
for nm in ("CT_Prediction_Chart", "BH_Base_Case_Chart", "BH_Case_3_Chart"): out["audited"][nm] = rows(A[nm])

M = openpyxl.load_workbook(os.path.join(EV, "E2E_matching.xlsx"))
out["matching"]["sheets"] = M.sheetnames
out["matching"]["Summary"] = rows(M["Summary"])
fzm = rows(M["Final_Zonation"]); out["matching"]["Final_Zonation_identical_to_audited"] = fzm == fz
for nm in ("CT Wash Match", "Final Bullheading Match"): out["matching"][nm] = {"cells": rows(M[nm]), "images": len(M[nm]._images)}
json.dump(out, open(os.path.join(EV, "export_cells.json"), "w"), indent=1, default=str)
a = out["audited"]
print("Final_Zonation", {k: a["Final_Zonation"][k] for k in ("rows", "cells", "mismatchCount")}, a["Final_Zonation"]["mismatches"][:3])
for c in (1, 3): print("Case", c, a["Case_%d" % c]["rows"], a["Case_%d" % c]["notIdentical"], "spurt identical", a["Spurt_Loss_%d" % c]["identicalToClipboard"], a["Spurt_Loss_%d" % c]["headers"])
print("CaseProps", a["Case_Properties_check"]); print("Props hdr", a["Case_Properties"]["headers"]);
for r in a["Case_Properties"]["rows"]: print("  ", r)
print("Summary"); [print("  ", r) for r in a["Summary"]]
print("Job_Inputs", a["Job_Inputs"])
print("Perfs", a["Perforations"])
print("RESSUM", a["RESSUM_Active"])
print("CT", a["CT_Actual"]["headers"], a["CT_Actual"]["speedFullPrecision"], a["CT_Actual"]["volFullPrecision"])
print("BH", a["BH_Actual"])
print("Div", a["Diverter_Loadings"])
print("Analogue", a["Analogue_Candidates"])
print("Audit", a["Audit_Log"])
for nm in ("CT_Prediction_Chart", "BH_Base_Case_Chart", "BH_Case_3_Chart"): print(nm, a[nm])
print("MATCHING", out["matching"]["sheets"]); [print("  ", r) for r in out["matching"]["Summary"]]
print("FZ identical", out["matching"]["Final_Zonation_identical_to_audited"], {k: out["matching"][k]["images"] for k in ("CT Wash Match", "Final Bullheading Match")}, out["matching"]["CT Wash Match"]["cells"])
