import json,os,sys
sys.path.insert(0,os.path.dirname(__file__))
import ref_calc as R
out=json.load(open(os.path.join(R.EV,'t21_clip.json')))
def check(name,clip,rkb=82.0,power=1.5,permscale=1.0):
    R.RKB=rkb;R.TVD=[r[2]+rkb if r[2] is not None else None for r in R.rows];R.POWER=power
    if permscale!=1.0:
        R.rows=[[r[0],r[1],r[2],None if r[3] is None else r[3]*permscale]+r[4:] for r in json.load(open(os.path.join(R.D,'ressum_rows.json')))['rows']]
    rows=R.parse_clip(clip);mm=0;n=0;worst=0
    for r in rows:
        z=R.zone(r[2],r[3],r[1].endswith('_Blank'));exp=R.case_row(z,1.0,1.0)
        for e,a in zip(exp,r[2:]):
            st,ad,rd=R.cmp(e,a);n+=1;mm+=st.startswith('MISMATCH');worst=max(worst,rd or 0)
    rec={'id':'REF-'+name,'area':'Calculation','title':'Independent reconciliation after '+name,'expected':'0 mismatches (rel ≤1e-9)','actual':{'zones':len(rows),'cells':n,'mismatches':mm,'worstRel':worst},'status':'PASS' if mm==0 else 'FAIL'}
    open(os.path.join(R.EV,'results.jsonl'),'a').write(json.dumps(rec)+'\n');print(rec)
check('RKB=100',out['rkb100'],rkb=100.0)
check('power mean p=-1',out['pm_neg1'],power=-1.0)
check('OPS model (perm×1.3)',out['ops'],permscale=1.3)
