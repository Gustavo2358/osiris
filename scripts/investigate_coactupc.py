#!/usr/bin/env python3
"""Check the COACTUPC COPY -> storage -> CICS frontier chain in real outputs.

Read-only: never adds edges or changes analyzer products. The two reproduction
runs must use CICS-COPY-FRONTIER.cbl with HOSTCTX missing/present, respectively.
"""
import argparse
from collections import defaultdict, deque
from functools import lru_cache
import hashlib
import json
from pathlib import Path


def identity(value):
    # AIR adds a domain tag that CFG transport omits; retain all identity fields.
    return json.dumps({k: v for k, v in value.items() if k != 'domain'}, sort_keys=True)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Run:
    def __init__(self, path):
        self.path = path
        self.docs = {name: json.loads((path / filename).read_text()) for name, filename in {
            'sp': 'sp/cobol-semantic-product.json', 'air': 'air.json',
            'cfg': 'cfg.json', 'links': 'links.json', 'dependencies': 'dependencies.json',
            'execution': 'execution.json',
        }.items()}
        self.sp = self.docs['sp']
        self.air = self.docs['air']['publication']
        assert len(self.air['units']) == 1, 'This diagnostic is scoped to one program unit'
        self.nodes = {identity(n['id']): n for n in self.docs['cfg']['nodes']}
        self.edges = defaultdict(list)
        for edge in self.docs['cfg']['transitions']:
            self.edges[identity(edge['from'])].append(identity(edge['to']))
        self.starts = {identity(e['from']) for e in self.docs['cfg']['transitions'] if e['kind'] == 'ENTRY'}
        self.reached = self.walk(self.starts)
        self.sequences = {identity(s['label']): s for u in self.air['units'] for s in u['sequences']}
        self.by_label = {identity(n['label']): k for k, n in self.nodes.items() if 'label' in n}
        self.statements = {s['header']['id']: s for s in self.sp['statements']}
        self.statement_nodes = defaultdict(set)
        for link in self.docs['links']['statements']:
            assert link['source']['unit'] == self.sp['unit']
            self.statement_nodes[link['source']['handle']].add(self.by_label[identity(link['label'])])
        self.proofs = {p['id']: p for p in self.sp['factDependencies']['proofs']}
        self.inputs = {i['id']: i for i in self.sp['factDependencies']['inputs']}
        self.bindings = {b['node']: b for b in self.sp['factDependencies']['bindings']}
        self.data_nodes = {n['data']: n for n in self.sp['storage']['nodes'] if n.get('data')}
        self.sites = self.docs['dependencies']['fileDependencies']['sites']
        assert all(e['exitCode'] == 0 for e in self.docs['execution']['executions'])
        assert self.docs['links']['spSha256'] == digest(path / 'sp/cobol-semantic-product.json')
        assert self.docs['links']['airSha256'] == digest(path / 'air.json')

    def walk(self, starts):
        seen = set(starts)
        pending = deque(starts)
        while pending:
            for node in self.edges[pending.popleft()]:
                if node not in seen:
                    seen.add(node)
                    pending.append(node)
        return seen

    @lru_cache(maxsize=None)
    def available(self, proof):
        p = self.proofs[proof]
        return p['localPremise'] and all(self.available(d) for d in p['dependencies']) and all(
            self.inputs[i]['available'] for i in p['inputs'])

    def operand(self, statement, option):
        ref = next(o['reference'] for o in statement['options'] if o['name'] == option)
        node = self.data_nodes[ref['logicalWholeItem']]
        binding = self.bindings[node['id']]
        proof_ids = set()
        pending = list(binding['dependencies'])
        while pending:
            p = pending.pop()
            if p not in proof_ids:
                proof_ids.add(p)
                pending.extend(self.proofs[p]['dependencies'])
        input_ids = {i for p in proof_ids for i in self.proofs[p]['inputs']}
        return {
            'reference': ref, 'storageNode': node['id'], 'binding': binding,
            'bindingAvailable': all(self.available(p) for p in binding['dependencies']),
            'proofs': [{**self.proofs[p], 'evaluatedAvailable': self.available(p)} for p in sorted(proof_ids)],
            'inputs': [{k: v for k, v in self.inputs[i].items()
                        if k not in ('contextScopes', 'closureScopes', 'declarationScopes')}
                       for i in sorted(input_ids)],
        }

    def provenance(self):
        return {'directory': str(self.path), 'execution': self.docs['execution'],
                'sha256': {f: digest(self.path / f) for f in (
                    'sp/cobol-semantic-product.json', 'air.json', 'cfg.json', 'links.json', 'dependencies.json')}}


def baseline(run):
    receive = next(s for s in run.sp['statements'] if s.get('commandKind') == 'RECEIVE_MAP')
    sid = receive['header']['id']
    node_ids = run.statement_nodes[sid]
    assert len(node_ids) == 1
    at = next(iter(node_ids))
    assert at in run.reached and not run.edges[at]
    term = run.sequences[identity(run.nodes[at]['label'])]['terminator']
    assert term['kind'] == 'opaque' and term['envelope']['control']['known'] == []
    uncertainties = [u for u in run.air['uncertainties']
                     if identity(u['id']) in {identity(i) for i in term['header']['uncertainties']}]
    assert any(u['code'] == 'EXECUTABLE_CAPABILITY_NOT_READY' for u in uncertainties)
    normal = next(o for o in run.sp['controlTopology']['outcomes']
                  if o['statement'] == sid and o['role'] == 'normal')
    assert normal['kind'] == 'NORMAL' and normal['target']['kind'] == 'OCCURRENCE'
    continuation_ids = run.statement_nodes[normal['target']['reference']]
    assert len(continuation_ids) == 1
    continuation = next(iter(continuation_ids))
    downstream = run.walk([continuation])
    assert len(run.reached) == 966 and len(run.sites) == 7
    sites = []
    for site in run.sites:
        node = run.by_label[identity(site['sequence'])]
        assert node not in run.reached and node in downstream
        assert site['reachability'] == 'UNREACHABLE_IN_MODEL' and not site['candidates']
        sites.append({'node': run.nodes[node]['id'], 'site': site,
                      'reachableFromEntry': False, 'reachableFromSpContinuationNode': True})
    into = run.operand(receive, 'INTO')
    assert not into['bindingAvailable'] and len(into['inputs']) == 2
    assert all(i['kind'] == 'MISSING_COPY' and not i['available'] for i in into['inputs'])
    send = next(s for s in run.sp['statements'] if s.get('commandKind') == 'SEND_MAP')
    send_from = run.operand(send, 'FROM')
    assert not send_from['bindingAvailable']
    frontiers = []
    for n in sorted(run.reached):
        if run.edges[n]:
            continue
        node = run.nodes[n]
        origins = [{'statement': h, 'provenance': run.statements[h]['header']['provenance']}
                   for h, ns in run.statement_nodes.items() if n in ns]
        frontiers.append({'node': node, 'statements': origins})
    return {'provenance': run.provenance(), 'nodes': len(run.nodes), 'reachedFromEntry': len(run.reached),
            'receiveStatement': receive, 'receiveNode': run.nodes[at], 'receiveTerminator': term,
            'receiveUncertainties': uncertainties, 'receiveIntoAdmission': into,
            'sendFromAdmission': send_from, 'sourceNormalOutcome': normal,
            'continuationNode': run.nodes[continuation], 'reachedFromContinuation': len(downstream),
            'reachableTerminals': frontiers, 'files': sites,
            'note': 'Reachability from the continuation is a diagnostic traversal of existing edges. No edge was inserted.'}


def reproduction(run, expected):
    receive = next(s for s in run.sp['statements'] if s.get('commandKind') == 'RECEIVE_MAP')
    at = next(iter(run.statement_nodes[receive['header']['id']]))
    assert len(run.sites) == 1
    site = run.sites[0]
    assert site['reachability'] == expected
    available = run.operand(receive, 'INTO')['bindingAvailable']
    assert available == (expected == 'REACHABLE')
    if available:
        assert run.edges[at] and [c['referenceName'] for c in site['candidates']] == ['ACCOUNTS']
    else:
        assert not run.edges[at] and site['candidates'] == []
    return {'provenance': run.provenance(), 'receiveIntoBindingAvailable': available,
            'receiveSuccessors': [run.nodes[n]['id'] for n in run.edges[at]],
            'site': site, 'nodes': len(run.nodes), 'edges': len(run.docs['cfg']['transitions'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline', type=Path)
    parser.add_argument('missing', type=Path)
    parser.add_argument('present', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    actual, missing, present = (Run(p) for p in (args.baseline, args.missing, args.present))
    assert missing.docs['execution']['sourceSha256'] == present.docs['execution']['sourceSha256']
    assert actual.docs['execution']['build'] == missing.docs['execution']['build'] == present.docs['execution']['build']
    report = {'status': 'DIAGNOSIS_CONFIRMED', 'baseline': baseline(actual),
              'copyMissing': reproduction(missing, 'UNREACHABLE_IN_MODEL'),
              'copyPresent': reproduction(present, 'REACHABLE'),
              'limits': ['The original CardDemo was not rerun with genuine IBM copybooks.',
                         'The synthetic complete case retains a FILE source value remainder.']}
    with args.out.open('x') as file:
        json.dump(report, file, ensure_ascii=False, indent=2)
        file.write('\n')
    print('PASS: original COPY proof chain; RECEIVE frontier; all 7 FILE sites downstream; missing/present reproduction')
    print(args.out)


if __name__ == '__main__':
    main()
