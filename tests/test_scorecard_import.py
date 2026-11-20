import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('scorecard',Path(__file__).parents[1]/'tools/import_scorecard.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ImportTests(unittest.TestCase):
 def test_exact_match_keeps_real_prices_and_source(self):
  ready,review=m.prepare([{'slug':'a','name':'Example College','level':'NCAA D3','state':'Georgia'}],[{'UNITID':'123','INSTNM':'Example College','STABBR':'GA','CONTROL':'1','NPT4_PUB':'13500','ADM_RATE':'0.5','UGDS':'1000','SATVR25':'500'}],'2023-24')
  self.assertEqual(len(ready),1);self.assertEqual(review,[]);self.assertEqual(ready[0]['avg_net_price'],13500);self.assertNotIn('sat_25',ready[0]);self.assertEqual(ready[0]['academic_year'],'2023-24')
 def test_ambiguous_or_fuzzy_match_is_not_automatic(self):
  p={'slug':'a','name':'Example College','level':'NAIA','state':'Georgia'}
  r={'UNITID':'123','INSTNM':'Example College','STABBR':'GA'}
  self.assertEqual(len(m.prepare([p],[r,r],'2023-24')[0]),0)
  r['INSTNM']='Example University';self.assertEqual(len(m.prepare([p],[r],'2023-24')[0]),0)
 def test_unitid_wins_but_invalid_id_does_not_fall_back(self):
  p={'slug':'a','name':'Changed Name','level':'NAIA','state':'Georgia','ipeds_unitid':123}
  r={'UNITID':'123','INSTNM':'Old Name','STABBR':'GA'}
  self.assertEqual(len(m.prepare([p],[r],'2023-24')[0]),1)
  p['ipeds_unitid']=999;self.assertEqual(len(m.prepare([p],[r],'2023-24')[0]),0)
if __name__=='__main__':unittest.main()
