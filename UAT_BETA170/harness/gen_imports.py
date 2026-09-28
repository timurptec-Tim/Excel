import os,json
from openpyxl import Workbook
D=os.path.join(os.path.dirname(__file__),'..','data')
raw=json.load(open(D+'/ressum_rows.json'));rows=raw['rows'][:4000]
# CSV direct (ELAN columns only, header row, TVDSS present)
with open(D+'/RESSUM_direct.csv','w') as f:
    f.write('MD,TVD,TVDSS,Perm,Phi,Sw,Lith,kL,Phih\n')
    for r in rows: f.write(','.join('' if v is None else repr(v) for v in r)+'\n')
# workbook with numeric text + thousands separators + trailing blank rows + RKB missing
wb=Workbook();ws=wb.active;ws.title='RESSUM_Inputs';ws.append(['MD','TVD','TVDSS','Perm','Phi','Sw','Lith','kL','Phih'])
for r in rows: ws.append(['{:,.2f}'.format(r[0])]+[None if v is None else str(v) for v in r[1:]])
for i in range(5): ws.append([None]*9)
wb.save(D+'/RESSUM_numeric_text.xlsx')
# wrong workbook: first sheet unrelated
wb=Workbook();ws=wb.active;ws.title='Notes';ws.append(['hello']);wb.save(D+'/RESSUM_wrong.xlsx')
# duplicate MD rows
wb=Workbook();ws=wb.active;ws.title='RESSUM_Inputs';ws.append(['MD'])
for r in rows[:1000]+rows[500:501]: ws.append(r)
wb.save(D+'/RESSUM_duplicate_md.xlsx')
# prediction paste variants
base=open(D+'/CT_prediction.tsv').read().strip().split('\n')
h=base[0].split('\t');body=[l.split('\t') for l in base[1:]]
order=[3,0,4,2,1]
open(D+'/CT_pred_reordered.tsv','w').write('\n'.join('\t'.join(r[i] for i in order) for r in [h]+body))
open(D+'/CT_pred_noheader.tsv','w').write('\n'.join('\t'.join(r) for r in body))
open(D+'/CT_pred_blank_trailing.tsv','w').write('\n'.join(['\t'.join(h)]+['\t'.join(r) for r in body[:50]]+['','\t\t\t\t']+['\t'.join(r) for r in body[50:]]+['','','']))
open(D+'/CT_pred_unsorted_dupvol.tsv','w').write('\n'.join(['\t'.join(h)]+['\t'.join(r) for r in body[::-1]]+['\t'.join([body[10][0],'1','2','3','4'])]))
open(D+'/CT_pred_textcells.tsv','w').write('\n'.join(['\t'.join(h)]+['\t'.join(r) for r in body[:5]]+['abc\t1\t2\t3\t4','5,000.5\tn/a\t2\t3\t4']+['\t'.join(r) for r in body[5:]]))
open(D+'/CT_pred_4cols.tsv','w').write('\n'.join('\t'.join(r[:4]) for r in [h]+body))
print('ok')
