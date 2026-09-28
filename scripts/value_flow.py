#!/usr/bin/env python3
"""Export native reaching definitions through the existing public regional API.
AIR/dependencies are never changed. Native results and runtime pins stay in a fresh
output directory; only lossless RD interning is used for the browser transport.
"""
import argparse, gzip, hashlib, json, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[1]
def key(value): return json.dumps(value, sort_keys=True, separators=(',', ':'))
def sha(data): return hashlib.sha256(data).hexdigest()
def write(path, value): path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n')
def generate(air_path, dependencies_path, out):
    out.mkdir(parents=True, exist_ok=False)
    air_bytes = air_path.read_bytes(); air = json.loads(air_bytes)
    dep = json.loads(dependencies_path.read_bytes())
    assert dep['publication']['localId'] == air['publication']['id']['localId']
    operations = {key(op['header']['id']): op for unit in air['publication']['units'] for seq in unit['sequences'] for op in seq['instructions']+[seq['terminator']]}
    scopes = {}
    for site in dep['sites'] + dep.get('fileDependencies', {}).get('sites', []):
        if not site.get('entry') or not any(s.get('kind') == 'VALUE_PRODUCER' for c in site.get('candidates', []) for s in c.get('supports', [])): continue
        op = operations.get(key(site.get('operation')), {})
        name = op.get('target', {}).get('name', {})
        # Typed read of a named object, shared by CALL and CICS PROGRAM/FILE targets.
        # Composite names and places deliberately remain unsupported, never guessed.
        obj = name.get('place', {}).get('object') if name.get('kind') == 'read' and name.get('place', {}).get('kind') == 'object' else None
        if not obj: continue
        scopes[key([site['entry'], obj])] = (site['entry'], obj)
    plan = []
    for entry, obj in scopes.values():
        subject = {'kind': 'NAMED_OBJECT', 'objectId': obj}
        def add(position, op=None, outcome=None):
            plan.append({'point': {'entryId': entry, 'operationId': op, 'position': position, 'outcome': outcome}, 'subject': subject})
        add('ENTRY')
        for unit in air['publication']['units']:
            if unit['id']['localId'] != entry['unit']: continue
            for seq in unit['sequences']:
                for op in seq['instructions']:
                    add('BEFORE', op['header']['id']); add('AFTER', op['header']['id'], {'kind':'normal'})
                term = seq['terminator']; add('BEFORE', term['header']['id'])
                if term['kind'] == 'invoke':
                    for outcome in term['outcomes']['known']:
                        add('OUTCOME', term['header']['id'], {k:v for k,v in outcome.items() if k in ['kind','tag']})
    write(out/'queries.json', plan)
    runtime = ROOT/'.cache/runtime'; cp = (runtime/'classpath.txt').read_text().strip()
    # Compile only this viewer-owned adapter against the pinned, existing runtime.
    classes = out/'adapter-classes'; classes.mkdir()
    source = ROOT/'bridge/ExportValueFlow.java'
    commands = [['javac','--release','21','-cp',cp,'-d',str(classes),str(source)],
                ['java','-Xmx4g','-cp',str(classes)+':'+cp,'ExportValueFlow',str(air_path.resolve()),str(out/'queries.json'),str(out/'regional.json')]]
    report = {'runtime': json.loads((runtime/'build.json').read_text()), 'airSha256':sha(air_bytes), 'adapterSha256':sha(source.read_bytes()), 'commands':[]}
    for i, cmd in enumerate(commands):
        r = subprocess.run(cmd,capture_output=True,text=True)
        (out/f'step-{i}.log').write_text(r.stdout+r.stderr)
        report['commands'].append({'command':cmd,'exitCode':r.returncode})
        write(out/'execution.json',report)
        r.check_returncode()
    native_bytes = (out/'regional.json').read_bytes(); native = json.loads(native_bytes)
    assert native['status'] == 'COMPLETE' and native['referenceAuthority'] == 'VALIDATED_AIR_PUBLICATION'
    facts=[]; by_fact={}; observations=[]
    for observation in native['observations']:
        rd = observation['rd']; k=key(rd)
        if k not in by_fact: by_fact[k]=len(facts); facts.append(rd)
        observations.append({'point':observation['point'],'subject':observation['subject'],'rd':by_fact[k]})
    compact = {'schema':'cobol-explorer-value-flow','version':'1.0.0','airSha256':sha(air_bytes),
               'nativeSha256':sha(native_bytes),'native':{k:v for k,v in native.items() if k not in ['observations','inventory']},
               'sourceScopes':native['inventory']['scopes'], 'facts':facts,'observations':observations}
    write(out/'value-flow.json', compact)
    report['nativeSha256']=sha(native_bytes); report['observations']=len(observations); report['uniqueFacts']=len(facts)
    write(out/'execution.json',report)
    print(f'{len(observations)} observations, {len(facts)} distinct RD facts: {out}',flush=True)
    return out/'value-flow.json'

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('bundle',type=pathlib.Path);p.add_argument('--out',required=True,type=pathlib.Path)
    args=p.parse_args();out=args.out.resolve();out.mkdir(parents=True,exist_ok=False)
    original=args.bundle.read_bytes(); bundle=json.loads(gzip.decompress(original) if original[:2]==b'\x1f\x8b' else original)
    (out/'input-bundle').write_bytes(original)
    for role in ['air','dependencies']: (out/(role+'.json')).write_text(bundle['artifacts'][role+'.json'])
    flow=generate(out/'air.json',out/'dependencies.json',out/'analysis')
    bundle['artifacts']['value-flow.json']=flow.read_text()
    bundle.setdefault('evidence',{})['valueFlow']={'inputBundleSha256':sha(original),**json.loads((out/'analysis/execution.json').read_text())}
    (out/'bundle.json.gz').write_bytes(gzip.compress(json.dumps(bundle,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
if __name__ == '__main__': main()
