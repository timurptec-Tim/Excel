"""Independent XLSX structure + cell inspection of BETA170 exports (no Excel available)."""
import zipfile, re, sys, json, os, struct
import xml.dom.minidom as MD
import openpyxl

S = os.path.join(os.path.dirname(__file__), "..")
EV = os.path.join(S, "evidence")

def png_size(b):
    return struct.unpack(">II", b[16:24]) if b[:8] == b"\x89PNG\r\n\x1a\n" else None

def structure(path):
    z = zipfile.ZipFile(path); out = {"file": os.path.basename(path), "issues": [], "sheets": [], "tables": [], "images": []}
    names = z.namelist()
    for n in names:
        if n.endswith(".xml") or n.endswith(".rels"):
            try: MD.parseString(z.read(n))
            except Exception as e: out["issues"].append("XML not well-formed: %s %s" % (n, e))
    ct = z.read("[Content_Types].xml").decode()
    for n in names:
        if n.endswith("/"): out.setdefault("dirEntries", []).append(n); continue
        ext = n.rsplit(".", 1)[-1]
        if ('PartName="/%s"' % n) not in ct and ('Extension="%s"' % ext) not in ct: out["issues"].append("no content type for " + n)
    wb = z.read("xl/workbook.xml").decode()
    out["sheets"] = re.findall(r'<sheet name="([^"]+)"', wb)
    for i, sh in enumerate(out["sheets"]):
        xml = z.read("xl/worksheets/sheet%d.xml" % (i + 1)).decode()
        dim = re.search(r'<dimension ref="([^"]+)"', xml).group(1)
        rels = "xl/worksheets/_rels/sheet%d.xml.rels" % (i + 1)
        if rels in names:
            r = z.read(rels).decode()
            for tgt in re.findall(r'Target="\.\./tables/(table\d+)\.xml"', r):
                t = z.read("xl/tables/%s.xml" % tgt).decode()
                ref = re.search(r' ref="([^"]+)"', t).group(1); cols = re.findall(r'<tableColumn id="\d+" name="([^"]*)"', t)
                # header cells of the table's first row
                first = re.match(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", ref); hr = first.group(2)
                row = re.search(r'<row r="%s"[^>]*>(.*?)</row>' % hr, xml).group(1)
                cells = [html_unescape(x) for x in re.findall(r'<t(?: [^>]*)?>([^<]*)</t>', row)]
                ok = cells[:len(cols)] == [html_unescape(c) for c in cols]
                out["tables"].append({"sheet": sh, "table": tgt, "ref": ref, "cols": len(cols), "headerMatchesCells": ok})
                if not ok: out["issues"].append("table header mismatch %s %s" % (sh, tgt))
            for d in re.findall(r'Target="\.\./drawings/(drawing\d+)\.xml"', r):
                dx = z.read("xl/drawings/%s.xml" % d).decode(); ext = re.search(r'<xdr:ext cx="(\d+)" cy="(\d+)"', dx)
                dr = z.read("xl/drawings/_rels/%s.xml.rels" % d).decode(); img = re.search(r'Target="\.\./media/([^"]+)"', dr).group(1)
                w, h = png_size(z.read("xl/media/" + img))
                out["images"].append({"sheet": sh, "image": img, "png_px": [w, h], "anchor_px": [int(ext.group(1)) // 9525, int(ext.group(2)) // 9525], "bytes": len(z.read("xl/media/" + img))})
        if 't="inlineStr"><is><t></t>' in xml: out.setdefault("emptyStringCells", {})[sh] = xml.count('t="inlineStr"><is><t></t>')
        if "<f>" in xml: out.setdefault("formulas", []).append(sh)
    return out

def html_unescape(s): return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')

def sheet_rows(path, name):
    wb = openpyxl.load_workbook(path, data_only=False)
    ws = wb[name]; return [[c.value for c in r] for r in ws.iter_rows()]

if __name__ == "__main__":
    res = {}
    for f in sys.argv[1:]:
        res[f] = structure(os.path.join(EV, f))
    json.dump(res, open(os.path.join(EV, "export_structure.json"), "w"), indent=1)
    for f, r in res.items():
        print(f, "sheets", len(r["sheets"]), "tables", len(r["tables"]), "images", r["images"], "issues", r["issues"], "dirs", r.get("dirEntries"), "emptyStr", r.get("emptyStringCells"), "formulas", r.get("formulas"))
