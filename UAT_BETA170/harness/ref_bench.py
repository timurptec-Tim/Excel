import json,os,sys
sys.path.insert(0,os.path.dirname(__file__));import ref_calc as R
B=os.path.join(R.D,'benchmark');raw=json.load(open(os.path.join(B,'ressum_rows.json')))
R.RKB=raw['rkb'];R.rows=sorted(raw['rows'],key=lambda r:r[0]);R.MD=[r[0] for r in R.rows];R.TVD=[r[2]+R.RKB for r in R.rows]
R.perfs=json.load(open(os.path.join(B,'perforations.json')))
out=json.load(open(os.path.join(R.EV,'t22_benchmark.json')));rows=R.parse_clip(out['zoneClip'])
n=mm=0;worst=0;nb=[]
for r in rows:
  z=R.zone(r[2],r[3],r[1].endswith('_Blank'));
  if not z['blank']:nb.append(z)
  for e,a in zip(R.case_row(z,1.0,1.0),r[2:]):
    st,ad,rd=R.cmp(e,a);n+=1;mm+=st.startswith('MISMATCH');worst=max(worst,rd or 0)
net=sum(z['intMD'] for z in nb);dol=100*sum(z['VDOL']*z['intMD'] for z in nb)/net
rec={'id':'BENCH-ref-cells','area':'Benchmark replica','title':'Independent recalculation of all 49 zones (benchmark replica)','expected':'0 mismatches; net 1200; dol 65 %','actual':{'zones':len(rows),'cells':n,'mismatches':mm,'worstRel':worst,'net':net,'dolPct':dol},'status':'PASS' if mm==0 and len(rows)==49 and abs(dol-65)<1e-9 else 'FAIL'}
open(os.path.join(R.EV,'results.jsonl'),'a').write(json.dumps(rec)+'\n');print(rec)
