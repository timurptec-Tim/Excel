import json,os,sys
sys.path.insert(0,os.path.dirname(__file__))
from gen_analogue import make_xlsx,H
D=os.path.join(os.path.dirname(__file__),'..','data')
n6=18.417413706149762; dol6=0.45375; lime6=0.54625
def row(well,form,lime,dol,mult,perf=100.0,avg=18.0): return [well,form,lime,dol,1000.0,2000.0,50.0,avg*perf,mult*n6*perf,perf,avg]
S={
 'none': [row('NFQ22-1','K2',55,45,2.0)],
 'one': [row('NFQ22-1','K1',55,45,2.0)],
 'two': [row('NFQ22-1','K1',55,45,2.0),row('NFQ22-2','K1',60,40,1.5)],
 'exact_tie': [row('NFQ22-1','K1',54.625,45.375,2.0),row('NFQ22-2','K1',54.625,45.375,2.2),row('NFQ22-3','K1',50,50,1.0),row('NFQ22-5','K1',40,50,3.0)],
 'dup_names': [row('NFQ22-1','K1',55,45,2.0),row('NFQ22-1','K1',50,50,1.1),row('NFQ22-1','K1',45,55,2.9)],
 'other_platform_only': [row('NFQ23-1','K1',55,45,2.0),row('NFQ30-2','K1',50,50,1.5),row('NFQ31-1','K1',60,40,2.5)],
 'low_not_credible': [row('NFQ22-1','K1',55,45,2.0),row('NFQ22-2','K1',20,80,1.0),row('NFQ22-3','K1',50,50,2.5)],
}
exp={}
def select(rows,well='NFQ22-4'):
    plat=lambda w: (__import__('re').match(r'^([A-Z]+\d+)',w.upper().replace(' ','')) or [None,''])[1] if w else ''
    c=[]
    for i,r in enumerate(rows):
        if str(r[1]).strip().upper()!='K1': continue
        lime,dol,kaf,intv,avg=r[2],r[3],r[8],r[9],r[10]
        if intv<=0 or kaf<=0: continue
        m=(kaf/intv)/n6
        c.append(dict(i=i,well=r[0],m=m,ls=abs(dol/100-dol6),lm=abs(lime/100-lime6),kh=abs(avg-n6)/max(abs(n6),1),same=plat(r[0])==plat(well)))
    if not c: return []
    same=[x for x in c if x['same']]
    if same: c=same
    if len(c)>=3:
        s=sorted(x['m'] for x in c); med=s[len(s)//2] if len(s)%2 else (s[len(s)//2-1]+s[len(s)//2])/2
        c=[x for x in c if med/3<=x['m']<=med*3]
    c.sort(key=lambda x:(x['ls'],x['lm'],x['kh'],x['i']))
    best=c[0]; cred=[x for x in c[1:] if x['ls']<=best['ls']+0.10+1e-12]
    lo=sorted([x for x in cred if x['m']<best['m']],key=lambda x:x['m']); hi=sorted([x for x in cred if x['m']>best['m']],key=lambda x:-x['m'])
    out=[]
    if lo: out.append((2,lo[0]['i'],round(lo[0]['m'],9)))
    out.append((3,best['i'],round(best['m'],9)))
    if hi: out.append((4,hi[0]['i'],round(hi[0]['m'],9)))
    return out
for k,rows in S.items():
    make_xlsx(os.path.join(D,'rank_%s.xlsx'%k),[{'name':'DB','rows':[H]+rows}])
    exp[k]=select(rows)
json.dump(exp,open(os.path.join(D,'rank_expected.json'),'w'),indent=1);print(json.dumps(exp))
