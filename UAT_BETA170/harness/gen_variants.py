import json,os,random
random.seed(7)
D=os.path.join(os.path.dirname(__file__),'..','data')
src=open(os.path.join(D,'CT_actual_1s.txt')).read().strip().split('\n'); h,b=src[0],src[1:]
open(os.path.join(D,'CT_eof_before_target.txt'),'w').write('\n'.join([h]+b[:len(b)-400])+'\n')   # stops mid pass-3
gap=b[:3000]+b[3200:]; open(os.path.join(D,'CT_missing_200rows.txt'),'w').write('\n'.join([h]+gap)+'\n')
dup=[]; [dup.extend([r,r]) if i%50==0 else dup.append(r) for i,r in enumerate(b)]; open(os.path.join(D,'CT_duplicate_rows.txt'),'w').write('\n'.join([h]+dup)+'\n')
un=list(b); 
for i in range(4000,4010,2): un[i],un[i+1]=un[i+1],un[i]
open(os.path.join(D,'CT_unsorted_pairs.txt'),'w').write('\n'.join([h]+un)+'\n')
# BH variants
bh=json.load(open(os.path.join(D,'bh_series.json')))
def fmt(s): s=int(round(s))%86400; return '%02d:%02d:%02d'%(s//3600,(s%3600)//60,s%60)
H="Time\tTR PRESS\tAN PRESS\tInjection Rate\tTMT Slur\tBHP FracCAT\tStim-DP FracCAT"
def write(name,rows): open(os.path.join(D,name),'w').write(H+'\n'+'\n'.join('\t'.join([fmt(r[0])]+['%.6f'%v for v in r[1:]]) for r in rows)+'\n')
off=[[r[0],r[1],r[2],r[3],r[4]+120.0,r[5],r[6]] for r in bh]; write('BH_nonzero_start_cum.txt',off)      # meter starts at 120 bbl
mid=[[r[0]+15*3600+59*60,r[1],r[2],r[3],r[4],r[5],r[6]] for r in bh]; write('BH_midnight.txt',mid)     # starts 23:59:00
def thr(rate):
    out=[];cum=0;t=8*3600
    for vol,r in [(150,25),(120,rate),(150,25),(120,10),(150,25),(60,20)]:
        n=int(round(vol/(r/60)))
        for k in range(n): cum+=r/60; out.append([t,1200,150,r,cum,3450+12*r,12*r]); t+=1
    return out
for rv in (9.5,10.5,10.51,9.49): write('BH_div1_rate_%s.txt'%rv,thr(rv))
sp=[list(r) for r in bh]
for i,r in enumerate(sp):
    if 900<=i<=902: r[3]=26.0   # 3-second spike inside diverter 1 (10 bpm)
cum=0;prev=None
for r in sp: 
    cum+= r[3]/60; r[4]=cum
write('BH_spike_in_diverter.txt',sp)
print('ok')
