# KM Zonation WebAPP BETA170 — Independent User Acceptance Test

| Item | Value |
|---|---|
| Application under test | `KM_Zonation_WebApp_BETA170.html` (attached upload `52bb0c07-…`) |
| SHA-256 before / after testing | `64a3028ce0a1f9ba42b1497a6df1925b448c779cf77f0f877b33d6da615af200` / identical (unchanged) |
| Version markers | `<title>` "KM Zonation WebAPP · BETA170"; header subtitle `BETA170`; `calculationRevision:"BETA170"`; exports write `["KM Zonation WebAPP","BETA170"]` |
| Test date | 2026-09-28 |
| Browser | Chromium 141.0.7390.37 (Playwright 1.56.1), headless, isolated persistent profile per test, viewport 1600×1000, locale en-GB, emulated timezone Asia/Dubai |
| Host | Ubuntu 24.04.4, 4 vCPU, 15 GB RAM (cloud container) |
| Spreadsheet engine | **Microsoft Excel not available.** LibreOffice Calc 24.2.7 used for open/convert tests, plus independent XML inspection and openpyxl cell reads |
| Method | Real browser interactions (file choosers, typing, clicks, pointer drags, dialogs, clipboard, downloads). App internals are private to an IIFE, so observations came from the DOM, localStorage, IndexedDB, clipboard text and downloaded files. The full 6,065-line application script was also read. Independent Python reference calculations were used; no application function was called to produce expected values. |

---

## 1. Executive verdict

**Not suitable for release in the tested scope until D-01 and D-02 are fixed.** Both are High severity and can put incorrect values into saved matching results and the Bullheading KM schedule while the UI shows a normal status. Everything else in the core calculation chain was independently verified and is correct.

### What is correct (verified)
- **Zonation-to-KM calculation chain.** The independent recalculation matched every cell with 0 mismatches:
  - 1,659 cells per case, for Cases 1 and 3;
  - the same again after RKB 82 → 100, power-mean p = −1 and the OPS model switch;
  - worst relative difference 2.6 × 10⁻¹⁵.
  
  Quantities checked: TVD = TVDSS + RKB, interpolation, boundary-sample inclusion, power-mean k, MD/TVD kH, φ, lithology, VDOL/VCLC, case multipliers, zone pressure at mid-point, FG at zone top, VCLC·L/VDOL·L/φ·L, spurt-loss lookup and OPR/Keff/VDA factors.
- **Exports reconcile.**
  - Final_Zonation (1,501 cells) matches the independent values.
  - Case sheets and spurt sheets are identical to the clipboard.
  - RESSUM_Active 24,000 × 7 values show 0 differences.
  - CT speed is exported as "CT Speed [ft/s]" at full precision.
  - The matching export has exactly the required 7 sheets in the required order, with image-only chart sheets.
  - Both workbooks are well-formed, table headers match their cells, and both open in LibreOffice.
- **BETA170 regression items.** M1, M2, L1, L3, L4, L5, L6, M3 and the BETA169 analogue concurrency/notice fixes are verified (§8). L2 is only partially fixed (see D-01).
- **Analogue screening.**
  - Units: 33/33 combinations of format (Excel %, explicit "65 %", row/column styles, cell override, ambiguous/mixed columns, literal `"%"` number format, header-declared units) and mode (Auto/Fraction/Percent) behaved as documented.
  - Ranking: 7/7 scenarios matched an independently coded ranking (same-platform preference, outlier filter, credibility limit, LOW/BEST/HIGH, fewer than three).
- **Persistence and job isolation.** Reload restores the complete job. A new job is clean. Reset All and cancellation paths work. Pending imports never leak into another job.
- **Performance.** Reload to workspace takes 653 ms median. 200 page switches: median 299 ms, p99 532 ms, heap 39.9 → 40.2 MB. No console errors.

### What is wrong
| ID | Sev. | Summary |
|---|---|---|
| D-01 | **High** | CT Matching shift number box corrupts typed values ("-8.3" → saved −8.03, "-12.5" → −1.05). The 1-dp display hides the error ("MATCH SAVED · −8.0 bbl"). |
| D-02 | **High** | Bullheading processing with a blank Detection start counts the opening cumulative-meter reading as pumped volume. OPR-1 is inflated by 52 bbl, OPR-3 is truncated, a false Overflush row appears, and QA reports **PASS**. |
| D-03 | Medium | CT processing drops pumped volume outside the processed window (0.32–0.52 bbl in tests) without reporting it, while QA says "Unallocated volume = 0". |
| D-04 | Medium | A large analogue DB (40,000 rows) exceeds localStorage. From then on every save in the session fails. There is a warning, but edits made after the failure are lost on reload with no recovery message. |
| D-05 | Low | CT Actual chart pressure and depth tick labels use 0 dp. A 3000–3000.5 psi range reads "3000" ×8 then "3001". |
| D-06 | Low | Update toast says "manual boundaries retained" when there are no manual corrections. |
| D-07 | Low | Blank values are exported as empty text strings rather than empty cells. |
| D-08 | Low | After a platform-changing rename, the suggestions panel says "Connect the analogue workbook…" although a DB is connected. |
| D-09 | Low | The audit log records `EDIT_PRESSURE_INPUT` for no-op re-entries. |
| D-10 | Low | Latent code defect (source-verified, no observed impact): the chart-cache signature uses `state.splitmerge` (typo). |

### What could not be verified
- **Reproduction of the customer benchmark job:** 24,000 rows / 22 perfs / 1,200 ft / 35 % limestone and 65 % dolomite / 49 zones / 3,450 psi / 418.91 bbl. The real datasets were not supplied, so this remains BLOCKED. A synthetic benchmark replica engineered so that the true answers equal every one of these figures **passed all 8 checks** in the real app (§5.3). This verifies calculation correctness on benchmark-shaped data. It cannot prove that the real job reproduces the figures, because its depths, logs and CT recording differ.
- Genuine BETA169 → BETA170 upgrade (BETA169 not supplied).
- Microsoft Excel behaviour and repair prompts.
- Comparison with the previous UAT report and previous-version performance.
- VBA V48 parity for the HumanCluster boundary selection and the BH stage state machine. These were checked for internal consistency and volume reconciliation only.

### Which fixes should come first
D-01 → D-02 → D-03 → D-04, then the Low items (see §10).

---

## 2. Test inventory

- **Application:** 12 pages (Models, Perforations & Zonation, Base Summary, Pressure Data, Analogue Wells, KM Modelling Control, KM Input, Prediction Runs, Audit, CT Actual, Bullheading Actual, KM Matching & Final Results), 60 buttons with ids, 80 inputs, 6 textareas, 7 selects, 8 file inputs.
- **Charts (§6):** 3 Base Summary charts, the correction profile, CT/BH prediction, CT actual, BH actual (time and volume), CT match, BH match (per case) and the approved snapshot.
- **Storage:**
  - localStorage key `projecta-zonation-v48-fullcycle-beta33` (light state, including the analogue DB);
  - IndexedDB `ProjectA_Zonation_LocalDB` v4 with stores `actualRaw`, `reviewPrediction`, `matchingData` and `heavyState`;
  - job key `project::well::LAYER`, with rename binding through `storageIdentity`.
- **Supplied attachments:** only the HTML. No datasets, previous UAT report, reference workbooks or BETA169 build were supplied.
- **Synthetic test data** (deterministic generators in `harness/`):
  - `gen_data.py`: 24,000-row RESSUM (0.5 ft, ELAN + OPS, RKB 82, controlled gaps and zero perms), 22 perforations totalling exactly 1,200 ft with one adjacent pair, CT at 1 s / 5 s / 10 s crossing midnight (5 s and 10 s derived by keeping every 5th/10th row plus the last row), a CT meter-reset variant, BH MaxCO3 job, and prediction/matching tables;
  - `gen_analogue.py`: hand-built SpreadsheetML for cell/row/column format inheritance;
  - `gen_rank.py`, `gen_variants.py`, `gen_imports.py`.

## 3. Test matrix summary

251 test IDs in `evidence/test_matrix_final.json`, including 8 benchmark-replica checks. Raw run records, including re-scoring notes, are in `evidence/results.jsonl`.

| Status | Count |
|---|---|
| PASS | 217 |
| FAIL | 20 (9 distinct confirmed defects; several IDs share a root cause) |
| BLOCKED | 6 |
| NOT TESTED | 6 |
| REQUIREMENT CLARIFICATION | 2 (+5 listed in §9 from source/behaviour review) |

Re-scoring: 5 harness criteria were corrected after inspection. Each is recorded with a note in `results.jsonl` (M1 message criterion, CT-actual tick parser, double-click, split/merge counter reset, analogue/RESSUM quota). None of the corrections hides an application defect; the underlying storage-quota issue is kept as D-04.

| Area | Tests | Result |
|---|---|---|
| End-to-end workflow steps 1–24 | 17 | all PASS |
| Pressure validation M1 (20 field × value cases, generate, export, restore) | 23 | PASS |
| Pressure reversal L5 (equivalent format, 3450→3600→3450, intervening multiplier, pre-existing stale, reload between) | 6 | PASS |
| Matching M2 / L2 / BH cases | 12 | M2 PASS; L2 lock PASS; 2 FAIL (D-01); 1 clarification |
| Analogue units / malformed / concurrency | 42 | PASS (+ quota FAIL D-04) |
| Analogue ranking / edits / renames | 12 | PASS |
| Axis validation L4 (6 chart groups) | 6 | PASS (D-05 labels) |
| CT speed L3, multipliers L6, loadings | 7 | PASS |
| Perforations / split-merge / repeat Generate | 20 | PASS |
| CT processing variants | 8 | 7 FAIL for D-03 only; EOF case PASS |
| BH processing variants | 15 | 3 FAIL (D-02); 1 clarification |
| Persistence / lifecycle / storage | 10 | PASS (+ D-04) |
| Caching M3 / performance / stress | 9 | PASS |
| Imports / prediction paste / export scope | 14 | PASS |
| Calculation reconciliation (clipboard + exports) | 9 | PASS |
| Charts (decode, midnight, inventory) | 3 | PASS |

---

## 4. Defect register

Severity reflects engineering impact. Implementation priority is in §10. "Line" refers to the attached HTML.

### D-01 — CT Matching shift numeric entry corrupts the typed value (High)
- **Page/function:** KM Matching → CT Wash Match → shift number box; `setCtMatchingShift` (line 12983), `renderCtMatching` (line 12979 rewrites `numBox.value = shift.toFixed(1)`), and the `input` listener (line 12999).
- **Dataset:** golden job (synthetic), CT match saved at −12.5 bbl.
- **Steps:**
  1. Open KM Matching.
  2. Click **Edit saved alignment** → OK.
  3. Click the CT shift number box, select all, and type `-8.3`.
  4. Tab.
  5. Click **Save CT match**.
- **Expected:** shift = −8.3 bbl (the value entered). Basis: L2 "Saving again persists the new shift".
- **Actual:** every keystroke re-renders and rewrites the box to 1 dp, so later keystrokes append to "-8.0". Trace: `-` → "", `8` → "-8.0", `.` → "-8.0", `3` → "-8.03".
  - Saved `matching.ct.shift = -8.03`; UI shows "MATCH SAVED · −8.0 bbl".
  - "-12.5" became −1.05. Any multi-digit entry is affected.
  - The BH shift box does not have this problem (same input gives −8.3).
- **Impact:** a wrong alignment is silently saved and flows into the chart, the matching export Summary ("CT Wash Match shift bbl") and the CT Wash Match image. The display rounding hides the error.
- **Evidence:** `D-CT-SHIFT-TYPING-run1/run2`, `L2-unchanged-shift`, `L2-resave-persist`, `evidence/r01_ct_shift_run*.png`, `evidence/D01_ct_shift_saved.png`.
- **Reproduced:** 2/2 (and within L2 runs). Survives reload: yes (wrong value persisted). Affects calculation input, display and export.
- **Root cause (verified in source and behaviour):** a synchronous full re-render on each `input` event overwrites the field being edited.
- **Recommendation:** mirror the BH implementation. On `input`, update state, the display and the chart without rewriting the box that has focus; format only on `change`/blur.
- **Regression tests:** type multi-digit, negative and decimal values; paste a value; use the arrow keys; then save, reload and export.

### D-02 — BH processing counts the opening cumulative-meter reading as pumped volume when Detection start is blank (High)
- **Page/function:** Bullheading Actual → Process; `bhBuildBlocks` (line 10944): `inc = prev==null ? max(0, c − startCum)` with `startCum = 0` when no cutoff (`processBHCore`, line 11047).
- **Dataset:** `BH_start_mid_opr.txt` (same job as `BH_actual_1s.txt`, but the recording starts 100 s into OPR-1, with TMT Slur = 52.08 bbl at the first sample). J4 5, J5 100, J6 150, J7 450, J8 3, J9 2; plan MaxCO3-1 125/100, MaxCO3-2 split 0/30 + 100/70.
- **Steps:**
  1. Load the file on the 1 Sec card.
  2. Leave Detection start blank.
  3. Click **Process**.
- **Expected:** only volume observed in the recording is allocated: OPR-1 = 108.33 bbl. The app's own instruction says a blank start means "process from the beginning". Setting the start to the first sample (08:05:00) gives OPR-1 = 107.92 bbl (the first sample becomes the baseline).
- **Actual:**
  - OPR-1 = **160 bbl** (it includes the 52.08 bbl already on the meter);
  - the J7 cap pushes OPR-3 down to 140 bbl and creates a false **Overflush 10 bbl** row;
  - status **PASS**.
  - With the standard file shifted to start at 120 bbl, QA reports "Excluded initial unclassified volume = 130" and "Detected pumped volume = 880" against 760 bbl actually pumped.
- **Impact:** a wrong KM actual schedule (stage volumes and labels) with a PASS status. It affects the processed schedule, the clipboard copy, BH_Actual in the audited export and downstream KM matching.
- **Evidence:** `D-BH-START-CUM-run1/run2`, `BH-var-meter-starts-at-120-bbl`, `D-BH-START-CUM-firstsample-cutoff`, `evidence/r02_bh_midopr_run*.png`.
- **Reproduced:** 2/2 (plus a variant). Survives reload: yes (the schedule is persisted).
- **Root cause (verified):** without a cutoff the baseline is 0 rather than the first retained sample.
- **Recommendation:** use the first valid sample's cumulative as the baseline when Detection start is blank, and report "volume before recording" separately.
- **Regression tests:** recordings starting at zero, at a non-zero meter reading, in a low-rate pre-stage and mid-OPR, each with and without a cutoff.

### D-03 — CT pumped volume outside the processed window is excluded without being reported (Medium)
- **Function:** `processCTCore` (lines 10852–10889). The window starts at the first pumping sample `ps`, and `posVol` counts from `ps+1`, so the increment into `ps` is excluded. The window ends at `p3e`, the pass-3 endpoint detected within the 5 ft target tolerance, so pumping after `p3e` is excluded. QA prints "Unallocated volume = 0.000000" relative to the window only.
- **Dataset:** `CT_actual_1s.txt`. The file contains 219.083 bbl pumped (independent: positive cumulative increments with either adjacent rate > 0.05 bpm). The processed window is 218.56 bbl, so 0.525 bbl is excluded: 0.025 bbl from the first increment plus 0.500 bbl from the 15 s pumped after the pass-3 endpoint at 11,005 ft.
- **Steps:**
  1. Load CT 1 s.
  2. Set Top 11000, Bottom 11500, unit ft/min.
  3. Click **Process**.
- **Expected:** "Account separately for any fill or excluded volume not represented in the schedule rows" (UAT requirement §11). Fill is accounted; the other exclusions are not.
- **Actual:** the unreported exclusion was 0.52 bbl at 1 s, 0.49 bbl at 5 s, 0.32 bbl at 10 s, and 0.52 bbl for the meter-reset, missing-row, duplicate-row and unsorted variants. The 3rd Up Pass is understated by 0.5 bbl (1 %).
- **Evidence:** `CT-var-*`, the §5 reconciliation table and `ref_calc` output.
- **Reproduced:** 7/7 datasets.
- **Recommendation:** report "pumped before processing window" and "pumped after final pass endpoint" in QA. Consider allocating post-endpoint pumping to the last pass, or flag it for REVIEW, subject to a requirement decision.

### D-04 — Large analogue database exhausts localStorage; later work is not persisted (Medium)
- **Function:** `localStateSnapshot` (line 9062) keeps `analogueDb` in the light snapshot; `saveState` (line 9085) throws QuotaExceeded.
- **Steps:**
  1. Connect `analogue_big_40000.xlsx` (40,000 rows).
  2. Change the formation pressure to 3500.
  3. Reload.
- **Actual:** a "SAVE WARNING — browser persistence failed…" bar and toast appear, which is good. After reload, the job returns to the last committed state (10-row DB, 3450 psi) with no recovery banner explaining that edits were lost. Every save attempt fails while the large DB is loaded.
- **Impact:** persistence only; calculations remain correct in-session. The row threshold depends on row width (not measured; a 10-row DB is unaffected).
- **Recommendation:** store `analogueDb` in IndexedDB (as the RESSUM log is), and show a recovery banner when the last session failed to save.

### D-05 — CT Actual chart axis labels lack precision at small ranges (Low)
Line 10685 (`ppv.toFixed(0)`) and line 10686 (depth). With a manual pressure range of 3000–3000.5 psi, the labels read 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3001. The other five charts show 3000, 3000.1 … 3000.5 through `formatAxisTick`. Evidence: `L4-CT-actual`.

### D-06 — Misleading thin-zone message (Low)
`runStep` (line 11279). On the baseline job, with no split/merge rows, Update says "Review 5 zones thinner than 8 ft; manual boundaries retained." The thin zones come from generated HumanCluster boundaries (5 ft minimum), not manual boundaries.

### D-07 — Blank values exported as empty text (Low)
`xlsxCellXml` (line 11442) writes `null`/`""` as `t="inlineStr"` with empty text: RESSUM_Active 53 cells, Diverter_Loadings 22, CT_Actual 7, BH_Actual 15. In Excel, `ISBLANK()` is FALSE for these cells and arithmetic on them gives `#VALUE!`. Recommendation: omit the cell or write an empty `<c r=".."/>`.

### D-08 — Wrong placeholder after a platform-changing rename (Low)
`renderSuggestedCases` (line 12531). Suggestions are correctly cleared, and the toast correctly says "click Select Cases again", but the panel says "Connect the analogue workbook, then click Select Cases." while a DB is connected.

### D-09 — Audit log records no-op pressure edits (Low)
The second `change` listener (line 12367) logs unconditionally. Re-entering an unchanged value adds `EDIT_PRESSURE_INPUT` entries (6 entries for 4 fields in the E2E audit export), even though no state changed.

### D-10 — Latent cache-signature typo (Low; source-verified hypothesis of future risk)
`renderFinalCharts` (line 12121) uses `state.splitmerge` (undefined) instead of `state.splitMerge`. There is no observed impact: every split/merge edit increments `chartRevision170` through `invalidateFrom('splitmerge')`, and Update re-renders (`M3-splitmerge-refresh-recheck`). It would become a stale-chart bug if a split/merge path ever bypassed `invalidateFrom`.

---

## 5. Calculation reconciliation

**Tolerance:** absolute ≤ 1 × 10⁻⁹ or relative ≤ 1 × 10⁻⁹. The app and the reference start from the same raw IEEE-754 doubles, so any genuine formula difference would be orders of magnitude larger. Identifiers, row counts, zone names, stage order and selected cases are compared exactly, and expected values are not rounded.

### 5.1 Formula register

Written independently in `harness/ref_calc.py`.

| Quantity | Formula / rule | Source columns & units | Datum | Inclusion / missing | Basis |
|---|---|---|---|---|---|
| TVD | TVDSS + RKB (the workbook TVD column is ignored when TVDSS exists) | C (ft), U2 (ft) | RKB | TVDSS missing → column B | App message "TVD = TVDSS + RKB"; RESSUM template |
| Zone top/bottom TVD | linear interpolation on MD; clamped outside the log | A, C | RKB | rows with valid MD and TVD | HL_InterpTVDFromMD (VBA parity comment) |
| Zone sample window | MD ≥ top and MD < bottom; MD = bottom included only for a zone ending at a perforation bottom that is not also another perforation's top | A | MD | — | App rule (VBA parity); verified by reproduction |
| Perm QA | power mean ((1/n)·Σkᵖ)^(1/p), p = 1.5 (also tested p = −1) | D (mD) | — | k > 0 only (0 and blank excluded) | Models page "Power mean" |
| φ | arithmetic mean of 0 ≤ φ ≤ 1 | E (fraction) | — | blanks excluded | — |
| Lithology | arithmetic mean of lithology code | G | — | blanks excluded | — |
| VDOL | >13 → 1.0; ≥12.5 → 0.8; ≥11 → 0.6; ≥10.5 → 0.4; ≥9 → 0.2; else 0; VCLC = 1 − VDOL | — | — | missing lithology → blank | calcVDOL |
| Case multiplier | VCLC ≤ 0.4 → ×Dol, else ×Lime; 0 allowed, negative rejected | KM Control | — | incomplete pair → blank case | L6 |
| kH | k × ΔMD and k × ΔTVD (base and case) | — | — | — | — |
| Net / averages | Σ over non-blank zones; averages weighted by ΔMD; Dol % = 100·Σ(VDOL·ΔMD)/ΣΔMD | — | — | blank zones excluded | — |
| Zone reservoir P | P_probe + ((TVD_top + TVD_bot)/2 − TVD_probe) × conversion | Pressure Data (psi, ft, psi/ft) | mid-zone TVD | — | App comment "zone-table reservoir pressure is corrected to zone midpoint" |
| FG at zone top | FG_TVDSS × (TVD_top − RKB)/TVD_top | psi/ft | zone top | — | App comment |
| Spurt loss | bucket k ≤ 1, ≤ 10, ≤ 100, ≤ 1000, > 1000 × loading column (175…50, BG, OPS); numeric 400/500/600 → OPS 100-300/400/500; 300/700 unsupported | case k (mD) | — | — | NT_GetSpurtLossValues; OPS lookup |
| OPR/Keff/VDA | lithology < 11 → 0.7 / 1.0 / 0.45; ≤ 18 → 0.46 / 1.2 / 1.0 | — | — | — | operationalFactors |
| Prediction/matching dP | KM BHP − probe formation pressure | psi | — | — | App label; verified 3900 − 3600 = 300 |
| CT volume | Σ positive cumulative increments where either adjacent rate > 0.05 bpm | TOTAL_FLUID (bbl) | — | resets ignored | App QA text |
| CT speed | ft/min ÷ 60 → ft/s (declared ft/s: unchanged); sign preserved | CT_SPEED | — | — | L3 |
| BH stage volumes | Σ positive TMT Slur increments per rate block; 9.5 ≤ rate ≤ 10.5 → diverter | TMT Slur (bbl) | — | — | App rules |

### 5.2 Results

| Comparison | Rows / cells | Mismatches | Worst rel. diff |
|---|---|---|---|
| Case 1 zone table (clipboard, full precision), 79 zones (59 perforated + 20 blank) | 1,659 | 0 | 2.3e-15 |
| Case 3 zone table (×1.99995507446) | 1,659 | 0 | 2.3e-15 |
| Spurt loss, Cases 1 and 3 (3 stages each) | 474 | 0 | exact |
| RKB = 100 / p = −1 / OPS model (perm × 1.3) | 3 × 1,659 | 0 | 2.6e-15 |
| Final_Zonation sheet vs reference | 1,501 | 0 | — |
| Summary: net MD 1200 ft; base MD kH 22,100.896447 mD·ft; TVD kH 7,116.690263; Σ TVD interval 389.5716 ft; avg k 18.417414 mD; dol/lime 45.375 / 54.625 %; φ 0.057224 | 8 | 0 | ≤ 4e-16 |
| Zone coverage | 79 zones contiguous, unique names; gross 10350.25–15910.25 ft; perforated net 1200.0 ft = Σ perforation lengths | — | — |
| Analogue selection (main DB) | Case 2 NFQ22-2 (1.19997304467), Case 3 NFQ22-1 (1.99995507446), Case 4 NFQ22-5 (5.99986522337); NFQ22-6 / NFQ22-7 excluded as outliers; NFQ23-1 / NFQ30-2 ignored (same-platform pool exists) | exact | — |
| BH schedule (standard file) | 11 rows: OPR 150/150/150, VDA 10+10 per package, MaxCO3-1 100 "125 ppt", split MaxCO3-2 VDA 30 + 70 "100 ppt", Displacement 60; BHP 3750/3720/3690 | exact | — |
| BH volume balance | detected 760 = excluded pre-stage 10 + allocated 750 | 0 | — |
| CT schedule (1 s) | 8 rows; fill 15.01, soak 16.47, transition 0.20, run-in 18.63, passes 25.00 + 30.63 / 62.50 / 50.13; window 218.56 = allocated 218.56 | window closes; **0.525 bbl unreported outside window (D-03)** | — |
| CT speeds | soak −30 ft/min → −0.5 ft/s; passes ∓20 ft/min → ∓0.33333 ft/s; clipboard 4 dp; export full precision | exact | — |

### 5.3 Benchmark replica (synthetic)

`harness/gen_benchmark.py` builds a dataset whose true answers equal the brief's benchmark figures. The expected values come from the construction, not from app output:
- **Lithology:** each perforation has uniform lithology, code 13.5 → VDOL 1 or 8.5 → VDOL 0. 780 of 1,200 ft are dolomite, so the expected split is exactly 65 % dolomite / 35 % limestone.
- **Permeability:** 16 perforations have constant permeability (1 zone each) and 6 have a single sharp step (1 ↔ 50 mD, 2 zones each). All 22 perforations are separated by gaps, giving 21 blank zones, so 16 + 12 + 21 = 49 final zones.
- **CT recording:** the meter lags one sample and pumping stops at the 5-ft arrival, so every pumped barrel lies inside the processing window. The total pumped is 418.910000 bbl.

The replica ran through the real UI on a clean profile (`t22_benchmark.js`) and was reconciled independently (`ref_bench.py`).

| Check | Expected | Actual | Status |
|---|---|---|---|
| RESSUM rows | 24,000 | 24,000 | PASS |
| Perforation intervals | 22 | 22 | PASS |
| Net perforated MD | 1,200.0 ft | 1200.0 | PASS |
| Limestone / dolomite (Base Summary and KM Input) | 35.0 % / 65.0 % | 35.0 % / 65.0 % | PASS |
| Final zones, baseline configuration | 49 (21 blank) | 49 (21 blank); Prediction Runs shows 49 | PASS |
| Probe reservoir pressure | 3,450 psi | 3450.0 psi | PASS |
| CT volume balance | 418.91 bbl | processed window 418.91 = allocated 418.91; unallocated 0.000000; status PASS | PASS |
| Independent recalculation of all 49 zones | 0 mismatches | 1,029 cells, 0 mismatches (worst rel. 2.2e-13); net 1200.0; dolomite 65.000 % | PASS |

This replica was built to avoid the D-03 condition (no pumping outside the processing window). With real recordings, D-03 can make the reported balance differ from the true pumped total.

---

## 6. Import, export and chart reconciliation

**Imports:**
- RESSUM: XLSX, CSV, numbers stored as text with thousands separators, trailing blank rows, missing RKB (keeps the job RKB), wrong workbook (rejected; model retained), duplicate MD (Generate blocked), and the downloaded template round trip.
- Perforations: with and without header, "10,350.25", unsorted input (identical zonation), empty, non-numeric, bottom = top, bottom < top, overlap, duplicate, wrong layer, outside coverage, and first/last log samples.
- Prediction paste: reordered columns, no header, blank and trailing rows, unsorted with duplicate volume (sorted, 161 rows), text cells, and 4 columns (rejected).
- Pasted source columns are unchanged after display refresh and a pressure round trip.

**Exports:**
- Audited workbook: 20 sheets. With Case 3 deselected, only Case 1 sheets are exported.
- Matching workbook: 7 sheets in the required order. Chart images are 1.5× PNGs anchored at the native size (CT 1920×906 px, BH 2400×1314 px).
- The Summary distinguishes the current design pressure (3600) from the approved probe pressure (3450) after a pressure change.
- No formulas are used, so there are no formula errors or cached values to reconcile.
- The audit timestamp is an Excel datetime of local time plus a timezone column.
- A real double-click produces one download.
- Structure checks, per `export_structure.json`: well-formed XML, content types present, table header text equal to cell text, and image relationships valid. The zip contains directory entries (a JSZip default); LibreOffice tolerates them, but Excel tolerance is unverified.

**Charts:**
- The inventory is in `evidence/chart_inventory.json`. Every series is clipped to its plot rectangle.
- CT Prediction polylines decoded back to data values: 4 series × 160 points, first and last points within 1 % of the source values.
- The approved BH snapshot and working plot were decoded: snapshot dP = BHP − 3450 and working dP = BHP − 3600, with labels "Probe Res P 3450/3600 psi".
- The CT Actual time axis is monotonic across midnight (23:30 → 01:33).
- Display thinning keeps extremes: 7,380 CT samples become 1,400 points per series.
- Exported images were checked visually: the shift is applied, no shift annotation is drawn, legends and fibre boxes are present, and the Final Interpretation appears in the BH image only.
- NOT TESTED: tooltip value spot checks for every chart.

## 7. Persistence and upgrade

| Test | Result |
|---|---|
| Normal reload of a completed job: state, raw CT/BH, predictions, KM matching rows, approved snapshot, CT lock | PASS (identical) |
| Exit → continue; cancelled new job; confirmed new job (NFW/NFQ40-1/K2), with old IndexedDB records removed and no old charts | PASS |
| Reset All cancel / confirm | PASS |
| Well rename within platform, across platforms, then reload (datasets stay bound through `storageIdentity`) | PASS |
| Pending analogue import during a job switch; error notice isolation | PASS |
| Storage failure (quota) | warning shown; data after the failure is lost on reload (D-04) |
| Upgrade | **Genuine BETA169 → BETA170: BLOCKED.** Simulation (stored job relabelled `calculationRevision:"BETA169"`) kept all schedules, bindings, alignment and approval: PASS |

## 8. BETA170 regression results

| Item | Classification | Evidence |
|---|---|---|
| M2 approved snapshot vs working plot | **Fixed and verified.** The snapshot stays at 3450 after 3600, the working plot is labelled "WORKING · NOT APPROVED", the difference is explained, re-approval is explicit, the export distinguishes the two pressures, and an injected render failure leaves the working pressure and axes untouched. | M2-* |
| M1 pressure validation and readiness | **Fixed and verified.** Field messages appear; copy, template and export are blocked while a value is invalid; the domain matches the code (probe TVD and conversion ≥ 0; P and FG > 0). | M1-* |
| L2 saved CT alignment protection | **Partially fixed.** Lock, disabled controls, cancel/confirm unlock and persistence all work, but editing then re-saving corrupts the value (D-01). Re-pasting a CT KM table unlocks without confirmation (clarification C-01). | L2-*, D-CT-SHIFT-* |
| L3 CT speed units | **Fixed and verified.** Declared units, conversion, sign, 4-dp display and clipboard, "[ft/s]" header and full-precision export. | L3-*, EXP-ct-speed |
| L4 axis-range validation | **Fixed and verified** on 6 chart groups. D-05 (CT tick labels) is an existing, unrelated display issue. | L4-* |
| L5 pressure reversal | **Fixed and verified**, including with an intervening multiplier change, pre-existing staleness and a reload between. | L5-* |
| L1 empty well name | **Fixed and verified.** | L1-empty-well |
| L6 multiplier messages / zero preserved | **Fixed and verified.** | L6-* |
| M3 caching without stale charts | **Fixed and verified.** D-10 is a latent typo. | M3-* |
| BETA169 analogue concurrency and job-specific notices | **Fixed and verified.** | AN-concurrency-*, AN-job-switch-pending, AN-error-notice-isolation |
| Existing calculations and 7-sheet matching export | **Verified.** | §5, §6 |
| New findings D-01…D-04 | **Unable to verify** whether these are new regressions: BETA169 and the previous report were not supplied. | — |

## 9. Requirement clarifications (no defect raised)
- **C-01** — Re-pasting a CT KM output table while a match is saved unlocks it without confirmation, although the shift value is kept.
- **C-02** — A 3-second 26 bpm spike inside a 10 bpm diverter splits the stage. The job is flagged REVIEW, so it is not silent. The prediction and matching detector ignores windows under 5 bbl, but Actual processing has no spike filter.
- **C-03** — CT pass and soak endpoints use a 5 ft arrival tolerance. The soak ends at 11,005 ft, and the remaining 10 s of soak movement is reported in "Wash restart / transition" (0.20 bbl). Run-in averaging includes the stationary restart samples; pass averages exclude them.
- **C-04** — Analogue import treats a cell with no `s` attribute as inheriting row (customFormat) and then column percent format. Under the OOXML/Excel semantics, such a cell uses style 0 (General). Real Excel files normally write an explicit `s`.
- **C-05** — The bare text loading "OPS" maps to OPS 100-600 (lookup table). Confirm that this is intended.
- **C-06** — Fraction mode applied to unformatted values such as 35 produces 3,500 %, and Percent mode applied to 0.35 produces 0.35 %. There is no range warning, consistent with the instruction not to add range rejection. A non-blocking notice may help users.
- **C-07** — Shift limits are applied silently: CT is clamped to ±5,000 (slider ±1,000) and BH to ±10,000 (slider ±1,500).

## 10. Recommended implementation order
1. **D-01** — a one-function UI fix with high data-integrity impact. Retest L2 fully.
2. **D-02** — baseline correction in `bhBuildBlocks`/`processBHCore`, with QA reporting "volume before recording". Retest every BH variant in `t16_ctbh.js`.
3. **D-03** — QA disclosure of pre-window and post-endpoint pumped volume. Decide the allocation rule for post-endpoint pumping.
4. **D-04** — move `analogueDb` to IndexedDB and add a recovery banner after a failed save.
5. D-07, D-05, D-06, D-08, D-09, D-10 (low effort), then resolve C-01…C-07 with the product owner.

## 11. Performance

Measured in Chromium 141 headless on 4 vCPU (details in `evidence/perf.json`). There is no previous-version baseline, so no pass/fail thresholds are applied.

| Operation | Dataset | Median | p90 / max |
|---|---|---|---|
| Reload to restored workspace (5 runs) | 24k-row job, all data | 653 ms | 704 ms |
| RESSUM import (file chooser → rows shown) | 24,000 rows, 3.4 MB | 8.4 s (1 run) | — |
| Refresh / Generate / Update | 22 perfs, 79 zones | 0.37 / 0.55 / 0.53 s | Generate + Update 0.73–0.79 s |
| First page visit (12 pages) | — | 212–516 ms | — |
| 200 page switches | 8-page cycle | 299 ms | p99 532, max 549 ms; heap 39.9 → 40.2 MB |
| CT process (7,380 rows) | 1 s | 523 ms | 578 ms |
| BH process (2,900 rows) | 1 s | 559 ms | 598 ms |
| Matching export | 7 sheets + 2 PNGs | 6.35 s | 6.68 s |
| Audited export | 20 sheets + 3 PNGs | 6.61 s | 6.78 s |

Stress (15 rapid Generate clicks, 8 rapid Process clicks, double-clicked exports) produced no console errors, unhandled rejections, duplicate results or duplicate downloads.

## 12. Evidence and reproducibility (`UAT_BETA170/`)
- `harness/lib.js`: Playwright helpers (isolated profiles, file choosers, dialogs, clipboard, downloads, localStorage and IndexedDB reads).
- `harness/t01…t21*.js`, `r01…r04*.js`: test scripts, one per area.
- `harness/gen_*.py`: deterministic synthetic data. `ref_calc.py`, `ref_params.py`: independent calculations. `export_inspect.py`, `export_cells.py`: export checks.
- `evidence/`: `results.jsonl` (every executed check), `test_matrix_final.json`, reconciliation JSON, `perf.json`, exported workbooks, screenshots, extracted chart images, LibreOffice conversions, SHA-256 files.
- To reproduce: `python3 harness/gen_data.py && python3 harness/gen_analogue.py && python3 harness/gen_rank.py && python3 harness/gen_variants.py && python3 harness/gen_imports.py && python3 harness/gen_benchmark.py`; place the BETA170 HTML at `src/BETA170.html`; then run `node harness/t01_baseline.js`, `t02…`, `t03…`, `t04…` and `t05…` in order. Copy `profiles/baseline` to `profiles/golden`, then run the remaining `t1x` scripts.
- **Not committed:** the application HTML and extracted script. The instruction was not to upload application code to external services.

## 13. Untested areas and missing inputs
- **Missing inputs:** benchmark datasets and the reference numbers in §4 of the brief; the previous UAT report; the BETA169 build and job; reference calculation workbooks and VBA V48; Microsoft Excel.
- **Not tested:**
  - pasting clipboard tables into the real KM workbook;
  - two simultaneous tabs (IndexedDB `onblocked` path);
  - non-Chromium browsers;
  - other viewports and zoom levels;
  - per-chart tooltip values;
  - the Bullheading OPS diverter type (MaxCO3 only);
  - HumanCluster boundary-selection parity with VBA (only consistency and coverage were checked; the 49-zone benchmark configuration passed on a synthetic replica, §5.3).
