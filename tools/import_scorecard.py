#!/usr/bin/env python3
"""Prepare a reviewed academic-data CSV from an official College Scorecard institution CSV.
No network calls or fuzzy matches. Match exact UNITID first, then a unique normalized name+state.
The caller must supply the reporting year of THIS cohort file; 'latest' is not a reporting year.
"""
import argparse, csv, json, re, unicodedata
from collections import defaultdict
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MAP = {'UGDS':'undergrad_enrollment','ADM_RATE':'admission_rate','SATVR25':'sat_reading_25',
       'ACTCM25':'act_25','ACTCM75':'act_75','TUITIONFEE_IN':'tuition_in_state','TUITIONFEE_OUT':'tuition_out_state'}
# SAT section percentiles are not summed: their sums are not the percentile of total SAT.
MAP.pop('SATVR25')
STATES = dict(zip('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(),
'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'.split('|')))
def normalize(s):
    return re.sub(r'[^a-z0-9]+','',unicodedata.normalize('NFKD',str(s)).encode('ascii','ignore').decode().lower())
def number(value):
    if value in (None,'','NULL','PrivacySuppressed'): return None
    try:
        n=float(value)
        if n < 0 or not __import__('math').isfinite(n): return None
        return int(n) if n.is_integer() else n
    except (ValueError,TypeError): return None

def prepare(programs, institutions, year):
    ids=defaultdict(list); names=defaultdict(list)
    for r in institutions:
        if r.get('UNITID'): ids[str(r['UNITID'])].append(r)
        names[(normalize(r.get('INSTNM','')),normalize(STATES.get(r.get('STABBR'),r.get('STABBR',''))))].append(r)
    ready=[]; review=[]
    for p in programs:
        if p.get('record_status')=='hidden': continue
        explicit=str(p.get('ipeds_unitid') or '')
        matches=ids.get(explicit,[]) if explicit else names.get((normalize(p['name']),normalize(p.get('state',''))),[])
        if len(matches)!=1:
            review.append({'slug':p['slug'],'name':p['name'],'state':p.get('state',''),'reason':'no exact match' if not matches else 'ambiguous match'}); continue
        r=matches[0]; row={'slug':p['slug'],'name':p['name'],'level':p['level'],'ipeds_unitid':r['UNITID'],'academic_year':year,'academic_source_url':'https://collegescorecard.ed.gov/school/?'+str(r['UNITID'])}
        for src,dst in MAP.items():
            v=number(r.get(src))
            if v is not None: row[dst]=v
        # Public/private net-price definitions differ; never substitute sticker tuition.
        price=number(r.get('NPT4_PUB')) if str(r.get('CONTROL'))=='1' else number(r.get('NPT4_PRIV'))
        if price is not None: row['avg_net_price']=price
        # Explicitly limit to first-time/full-time four-year completion where published.
        grad=number(r.get('C150_4'))
        if grad is not None: row['grad_rate']=grad
        ready.append(row)
    return ready,review

def write_csv(path,rows,fields):
    with open(path,'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('scorecard_csv',type=Path);ap.add_argument('--year',required=True,help='actual cohort/reporting year, e.g. 2023-24')
    ap.add_argument('--programs',type=Path,default=ROOT/'data/programs.json');ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args()
    if not re.fullmatch(r'20\d{2}-(?:20)?\d{2}',args.year): ap.error('--year must identify the file reporting year (YYYY-YY or YYYY-YYYY)')
    with args.scorecard_csv.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f)
        if not {'UNITID','INSTNM','STABBR'} <= set(reader.fieldnames or []): ap.error('Use the institution-level official CSV with UNITID, INSTNM and STABBR')
        institutions=list(reader)
    doc=json.loads(args.programs.read_text());programs=doc['programs'] if isinstance(doc,dict) else doc
    ready,review=prepare(programs,institutions,args.year)
    fields=['slug','name','level','ipeds_unitid',*MAP.values(),'avg_net_price','grad_rate','academic_year','academic_source_url']
    # Different rows have different published fields. Split by column signature so absent values
    # never become blank imports that erase previously sourced data.
    groups=defaultdict(list)
    for row in ready: groups[tuple(k for k in fields if k in row)].append(row)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    outputs=[]
    for i,(columns,rows) in enumerate(groups.items(),1):
        path=args.output if len(groups)==1 else args.output.with_name(args.output.stem+f'_{i}'+args.output.suffix)
        write_csv(path,rows,columns);outputs.append(str(path))
    reviewpath=args.output.with_name(args.output.stem+'_unmatched.csv')
    write_csv(reviewpath,review,['slug','name','state','reason'])
    print(json.dumps({'matched':len(ready),'review':len(review),'imports':outputs,'unmatched':str(reviewpath)},indent=2))
if __name__=='__main__':main()
