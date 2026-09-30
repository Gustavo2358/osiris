#!/usr/bin/env python3
"""Freeze independent producer-oracle reachability for bundled v5 examples.
The oracle path is explicit; this never writes to an analyzer checkout.
"""
import argparse,importlib.util,json,gzip,hashlib,collections,sys
sys.dont_write_bytecode=True
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--oracle',required=True,type=Path);p.add_argument('--out',required=True,type=Path)
a=p.parse_args()
if a.out.exists():p.error('Choose a fresh evidence file')
spec=importlib.util.spec_from_file_location('producer_oracle',a.oracle);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
root=Path(__file__).resolve().parents[1]
report={'oracle':str(a.oracle.resolve()),'oracleSha256':hashlib.sha256(a.oracle.read_bytes()).hexdigest(),'examples':{}}
for x in json.loads((root/'public/examples/index.json').read_text()):
 if not x.get('localRules'):continue
 b=json.loads(gzip.decompress((root/'public'/x['url']).read_bytes()));cfg=json.loads(b['artifacts']['cfg.json']);entries=[]
 for e in [n for n in cfg['nodes'] if n['kind']=='ENTRY']:
  scoped={**cfg,'transitions':[t for t in cfg['transitions'] if t['activationEntry']==e['entry']]}
  oracle=module.Paths(scoped);todo=collections.deque([(module.vertex(e['id']),())]);seen=set();pairs=set()
  while todo:
   point=todo.popleft()
   if point in seen:continue
   seen.add(point);successors=oracle.successors(*point);todo.extend(successors)
   if point[0] in oracle.rules:pairs.update((point[0][1],t[0][1]) for t in successors)
  entries.append({'entry':e['entry'],'states':len(seen),'reachable':sorted({at[1] for at,stack in seen}),'localPairs':sorted(pairs)})
 report['examples'][x['id']]=entries
 print(x['id'],[(e['states'],len(e['reachable']),len(e['localPairs'])) for e in entries])
a.out.write_text(json.dumps(report,indent=2)+'\n')
