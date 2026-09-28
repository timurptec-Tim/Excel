"""Hand-built analogue XLSX workbooks (raw SpreadsheetML) so that cell / row / column
number-format inheritance can be controlled exactly. Synthetic data, seed-free."""
import zipfile, os, json
OUT = os.path.join(os.path.dirname(__file__), "..", "data")

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="170" formatCode="0.0&quot;%&quot;"/></numFmts>
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="170" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs></styleSheet>"""
# style 0 General, 1 = 0%, 2 = 0.00%, 3 = 0.00 (explicit non-percent), 4 = 0.0"%" (literal % text, NOT a percent format)

def col(i):
    s = ""; i += 1
    while i: i, r = divmod(i - 1, 26); s = chr(65 + r) + s
    return s

def cell(ref, v, s=None):
    sa = '' if s is None else ' s="%d"' % s
    if v is None: return ''
    if isinstance(v, str):
        v = v.replace("&", "&amp;").replace("<", "&lt;")
        return '<c r="%s"%s t="inlineStr"><is><t>%s</t></is></c>' % (ref, sa, v)
    return '<c r="%s"%s><v>%r</v></c>' % (ref, sa, v)

def make_xlsx(path, sheets):
    """sheets: list of dict(name, rows=[[value or (value, style)]], col_styles={colIdx:style}, row_styles={rowIdx:style})"""
    z = zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED)
    ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    for i, _ in enumerate(sheets):
        ct += '<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' % (i + 1)
    z.writestr("[Content_Types].xml", ct + "</Types>")
    z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
    rel = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    for i, sh in enumerate(sheets):
        wb += '<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (sh["name"], i + 1, i + 1)
        rel += '<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>' % (i + 1, i + 1)
        cols = ''
        if sh.get("col_styles"):
            cols = '<cols>' + ''.join('<col min="%d" max="%d" width="12" style="%d" customWidth="1"/>' % (c + 1, c + 1, s) for c, s in sorted(sh["col_styles"].items())) + '</cols>'
        body = ''
        for ri, r in enumerate(sh["rows"]):
            rs = sh.get("row_styles", {}).get(ri)
            ra = '' if rs is None else ' s="%d" customFormat="1"' % rs
            cells = ''
            for ci, v in enumerate(r):
                s = None
                if isinstance(v, tuple): v, s = v
                cells += cell(col(ci) + str(ri + 1), v, s)
            body += '<row r="%d"%s>%s</row>' % (ri + 1, ra, cells)
        z.writestr("xl/worksheets/sheet%d.xml" % (i + 1), '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">%s<sheetData>%s</sheetData></worksheet>' % (cols, body))
    z.writestr("xl/workbook.xml", wb + "</sheets></workbook>")
    z.writestr("xl/_rels/workbook.xml.rels", rel + '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
    z.writestr("xl/styles.xml", STYLES)
    z.close()

H = ["Well", "Formation", "Limestone %", "Dolomite %", "TVD KH before", "TVD KH after match", "TVD height of perf interval", "MD KH before", "MD KH after match", "MD perf", "Average perm per MD"]

def main_db(n6=18.417, dol6=0.454):
    """Ranking scenario. multiplier = (MDKHafter/MDperf)/n6. Lithology given in % columns with mixed
    representations: Excel % format (style 1), explicit text '65%', plain numbers."""
    def row(well, form, lime, dol, mult, perf=100.0, avg=18.0):
        kafter = mult * n6 * perf
        return [well, form, lime, dol, 1000.0, 2000.0, 50.0, avg * perf, kafter, perf, avg]
    rows = [["KM analogue wells database (synthetic)"], [], H]
    rows += [
        row("NFQ22-1", "K1", (0.55, 1), (0.45, 1), 2.0),          # Excel % fmt; dol 45 -> best lith (|0.45-0.454|)
        row("NFQ22-2", "K1", "60%", "40%", 1.2),                    # explicit text; dol 40
        row("NFQ22-3", " k1 ", 50, 50, 3.1),                        # trimmed/lower formation; dol 50
        row("NFQ22-5", "K1", 45, 55, 6.0),                          # dol 55 -> within +10 pts? |0.55-.454|=.096 vs best .004 -> limit .104 -> credible
        row("NFQ22-6", "K1", 30, 70, 0.4),                          # dol 70 -> not credible for LOW
        row("NFQ22-7", "K1", 56, 44, 40.0),                         # outlier multiplier (>3x median) -> excluded
        row("NFQ22-8", "K1", 55, 45, 2.5, perf=0.0),                # invalid MD perf -> excluded
        row("NFQ22-1", "K2", 55, 45, 9.0),                          # same well other reservoir -> excluded
        row("NFQ23-1", "K1", 54.6, 45.4, 1.5),                      # other platform, exact lith -> must be ignored (same-platform pool exists)
        row("NFQ30-2", "K1", 54.0, 46.0, 1.1),
    ]
    make_xlsx(os.path.join(OUT, "analogue_main.xlsx"), [{"name": "Notes", "rows": [["readme"]]}, {"name": "Analogue DB", "rows": rows}])

def unit_variants():
    base = ["W1-1", "K1", None, None, 1000, 2000, 50, 1800, 3600, 100, 18]
    def db(lime, dol, hdr_l="Limestone", hdr_d="Dolomite", extra=None, **kw):
        rows = [["Well", "Formation", hdr_l, hdr_d, "TVD KH before", "TVD KH after match", "TVD height of perf interval", "MD KH before", "MD KH after match", "MD perf", "Average perm per MD"]]
        r = list(base); r[2] = lime; r[3] = dol; rows.append(r)
        for e in (extra or []):
            r2 = list(base); r2[0] = e[0]; r2[2] = e[1]; r2[3] = e[2]; rows.append(r2)
        return [dict(name="DB", rows=rows, **kw)]
    V = {}
    V["A_unformatted_fraction"] = db(0.35, 0.65)
    V["B_unformatted_percent"] = db(35, 65)
    V["C_mixed_column"] = db(0.35, 0.65, extra=[("W1-2", 40, 60)])
    V["D_column_style_percent"] = db(0.35, 0.65, col_styles={2: 1, 3: 2})
    V["E_row_style_percent"] = db(0.35, 0.65, row_styles={1: 1})
    V["F_cell_overrides_column"] = db((0.35, 3), (0.65, 3), col_styles={2: 1, 3: 1})
    V["G_text_percent"] = db("35%", "65%")
    V["H_literal_pct_numfmt"] = db((35, 4), (65, 4))       # 0.0"%" is NOT a percent format; stored 35
    V["I_header_fraction"] = db(0.35, 0.65, hdr_l="Limestone fraction", hdr_d="Dolomite fraction")
    V["J_excel_pct_65"] = db((0.35, 1), (0.65, 1), hdr_l="Limestone %", hdr_d="Dolomite %")
    V["K_total_not_100"] = db(30, 60)
    for k, sh in V.items():
        make_xlsx(os.path.join(OUT, "analogue_%s.xlsx" % k), sh)
    # malformed / wrong
    make_xlsx(os.path.join(OUT, "analogue_wrong_headers.xlsx"), [{"name": "X", "rows": [["Foo", "Bar"], [1, 2]]}])
    open(os.path.join(OUT, "analogue_empty.xlsx"), "wb").write(b"")
    open(os.path.join(OUT, "analogue_not_zip.xlsx"), "wb").write(b"this is not a zip")
    # header only
    make_xlsx(os.path.join(OUT, "analogue_header_only.xlsx"), [{"name": "DB", "rows": [H]}])
    # large workbook for concurrency (slow parse)
    big = [H] + [["NFQ22-%d" % (i % 90 + 10), "K1", 50, 50, 1, 2, 50, 1800, 3600, 100, 18] for i in range(40000)]
    make_xlsx(os.path.join(OUT, "analogue_big_40000.xlsx"), [{"name": "DB", "rows": big}])

if __name__ == "__main__":
    import sys
    n6 = float(sys.argv[1]) if len(sys.argv) > 1 else 18.417
    main_db(n6)
    unit_variants()
    print("ok")
