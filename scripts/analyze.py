#!/usr/bin/env python3
"""Run real analyzer entrypoints into a NEW directory and package their outputs.
No writes to analyzer repositories. Build the runtime with prepare_runtime.py first.
"""
import argparse,pathlib,subprocess,json,hashlib,sys
from pack import pack
from value_flow import generate as generate_value_flow
ROOT=pathlib.Path(__file__).resolve().parents[1];WS=ROOT.parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=pathlib.Path);parser.add_argument('--out',required=True,type=pathlib.Path)
parser.add_argument('--copybooks',type=pathlib.Path,action='append',default=[])
parser.add_argument('--compilation',action='store_true',help='Use the multi-unit SP envelope')
parser.add_argument('--storage-profile',default='unspecified');parser.add_argument('--logical-text',default='auto',choices=['auto','enabled','disabled']);parser.add_argument('--entry-storage-state',default='unknown',choices=['unknown','initial','preserved']);parser.add_argument('--cics-entry-mode',default='unknown',choices=['unknown','new-logical-level','disabled'])
parser.add_argument('--experimental-physical', action='store_true', help='Use the analyzer physical storage mode for FILE values')
args=parser.parse_args();source=args.source.resolve();out=args.out.resolve()
if not source.is_file():parser.error('Source does not exist')
if out.exists():parser.error('Choose a new output directory; existing evidence is never replaced')
runtime=ROOT/'.cache/runtime';cp=(runtime/'classpath.txt').read_text();out.mkdir(parents=True);front=out/'sp';front.mkdir()
report={'build':json.loads((runtime/'build.json').read_text()),'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'executions':[]}
def run(phase,arguments,cwd):
    cmd=['java','-cp',cp,*arguments];result=subprocess.run(cmd,cwd=cwd,capture_output=True,text=True)
    (out/(phase+'.log')).write_text(result.stdout+result.stderr);report['executions'].append({'phase':phase,'command':cmd,'exitCode':result.returncode})
    (out/'execution.json').write_text(json.dumps(report,indent=2)+'\n')
    if result.returncode:print(phase+' failed. See '+str(out/(phase+'.log')),file=sys.stderr);sys.exit(result.returncode)
    print(phase+': OK',flush=True)
run('frontend',['io.github.gustavo2358.cobolexplorer.ExplorerMain','--source',str(source),'--output',str(front),'--copybooks',','.join(str(p.resolve()) for p in args.copybooks) or str(source.parent),'--storage-profile',args.storage_profile,'--entry-storage-state',args.entry_storage_state,'--cics-entry-mode',args.cics_entry_mode,'--logical-text',args.logical_text],WS/'proleap-poc')
sp=front/('cobol-semantic-compilation.json' if args.compilation else 'cobol-semantic-product.json')
run('lower',['ExportLinks',str(sp),str(out/'air.json'),str(out/'links.json'),str(out/'source-evidence.json')],ROOT)
run('cfg',['io.github.gustavo2358.analysis.cfg.launcher.AnalysisCfg',str(out/'air.json'),str(out/'cfg.json')],ROOT)
run('dependencies',['io.github.gustavo2358.analysis.launcher.AnalysisDependencies',str(out/'air.json'),str(out/'dependencies.json'),'--source-evidence',str(out/'source-evidence.json'),*(['--experimental-physical'] if args.experimental_physical else [])],ROOT)
files={'sp.json':sp,**{r+'.json':out/(r+'.json') for r in ['air','cfg','links','dependencies']}}
files['value-flow.json']=generate_value_flow(out/'air.json',out/'dependencies.json',out/'value-flow')
report['valueFlow']=json.loads((out/'value-flow/execution.json').read_text())
# Never open paths discovered in untrusted provenance. Include only explicit source
# and preprocessed file. Additional copybooks can be passed to pack.py by name.
print(pack(files,{source.name:source,'<preprocessed>':front/'preprocessed.cbl'},source.stem,out/'bundle.json.gz',report))
