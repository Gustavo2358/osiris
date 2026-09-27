#!/usr/bin/env python3
"""Compare two real COACTUPC runs without changing products or adding edges."""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path

from investigate_coactupc import Run, identity


def without_publication(value):
    """Only rename the publication namespace; retain every local identity/field."""
    if isinstance(value, dict):
        return {k: without_publication(v) for k, v in value.items() if k != 'publication'}
    if isinstance(value, list):
        return [without_publication(v) for v in value]
    return value


def component_inventory(run):
    undirected = defaultdict(set)
    for edge in run.docs['cfg']['transitions']:
        source, target = identity(edge['from']), identity(edge['to'])
        assert source in run.nodes and target in run.nodes
        undirected[source].add(target)
        undirected[target].add(source)
    unseen = set(run.nodes)
    components = []
    while unseen:
        start = min(unseen)
        pending, members = [start], {start}
        while pending:
            for target in undirected[pending.pop()] - members:
                members.add(target)
                pending.append(target)
        unseen -= members
        components.append({
            'nodes': len(members),
            'reachableFromEntry': len(members & run.reached),
            'nodeKinds': dict(Counter(run.nodes[n]['kind'] for n in members)),
        })
    assert sum(c['nodes'] for c in components) == len(run.nodes)
    return sorted(components, key=lambda c: -c['nodes'])


def command_frontier(run, kind, option):
    statements = [s for s in run.sp['statements'] if s.get('commandKind') == kind]
    assert len(statements) == 1, 'Diagnostic expects a unique source command'
    statement = statements[0]
    operand = run.operand(statement, option)
    controls = []
    for node in sorted(run.statement_nodes[statement['header']['id']]):
        sequence = run.sequences[identity(run.nodes[node]['label'])]
        term = sequence['terminator']
        refs = {identity(u) for u in term['header']['uncertainties']}
        controls.append({
            'node': run.nodes[node]['id'],
            'reachableFromEntry': node in run.reached,
            'successors': [run.nodes[n]['id'] for n in run.edges[node]],
            'terminator': term['kind'],
            'uncertainties': [u['code'] for u in run.air['uncertainties']
                              if identity(u['id']) in refs],
        })
    return {
        'statement': statement['header']['id'],
        'provenance': statement['header']['provenance'],
        'option': option,
        'reference': operand['reference'],
        'binding': operand['binding'],
        'bindingAvailable': operand['bindingAvailable'],
        'proofs': operand['proofs'],
        'inputCount': len(operand['inputs']),
        'inputIds': [i['id'] for i in operand['inputs']],
        'inputOrigins': dict(Counter(i['provenance']['original']['file']
                                    for i in operand['inputs'])),
        'controls': controls,
    }


def summary(run):
    assert len(run.nodes) == len(run.docs['cfg']['nodes'])
    starts = {identity(n['id']) for n in run.docs['cfg']['nodes'] if n['kind'] == 'ENTRY'}
    assert len(starts) == 1 and starts == run.starts
    sites = []
    for family, values in [('call', run.docs['dependencies']['sites']), ('file', run.sites)]:
        for site in values:
            node = run.by_label[identity(site['sequence'])]
            reachable = node in run.reached
            assert (site['reachability'] == 'REACHABLE') == reachable
            sites.append({'family': family, 'node': run.nodes[node]['id'],
                          'reachableFromEntry': reachable, 'reachability': site['reachability'],
                          'candidates': site['candidates']})
    return {
        'provenance': run.provenance(),
        'contracts': {'sp': run.sp['contractVersion'], 'cfg': run.docs['cfg']['schemaVersion'],
                      'dependencies': run.docs['dependencies']['version']},
        'stages': run.docs['execution']['executions'],
        'nodes': len(run.nodes), 'transitions': len(run.docs['cfg']['transitions']),
        'reachableFromEntry': len(run.reached), 'unreachableFromEntry': len(run.nodes)-len(run.reached),
        'weakComponents': component_inventory(run),
        'modelAssumedSymbols': sum(s.get('modelAssumed', False) for s in run.sp['nominalValues']['symbols']),
        'inputsByKind': dict(Counter(i['kind'] for i in run.inputs.values())),
        'coverage': run.sp['coverage'],
        'dependencyStatus': run.docs['dependencies']['analysisStatus'],
        'receive': command_frontier(run, 'RECEIVE_MAP', 'INTO'),
        'send': command_frontier(run, 'SEND_MAP', 'FROM'),
        'sites': sites,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before', type=Path)
    parser.add_argument('after', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    if args.out.exists():
        parser.error('Use a fresh output path; previous evidence is preserved')
    before, after = Run(args.before), Run(args.after)
    assert before.docs['execution']['sourceSha256'] == after.docs['execution']['sourceSha256']
    old, new = summary(before), summary(after)
    same = {field: without_publication(before.docs['cfg'][field]) ==
                  without_publication(after.docs['cfg'][field]) for field in ('nodes', 'transitions')}
    report = {
        'status': 'COMPARISON_COMPLETED',
        'result': 'CONNECTED' if len(new['weakComponents']) == 1 else 'STILL_DISCONNECTED',
        'method': 'Undirected components and directed entry reachability use only original CFG transitions. '
                  'Source -> control correlations use StatementLink -> LabelId. '
                  'Topology equality only removes the publication namespace, preserving all other fields.',
        'topologyEqualAfterPublicationRename': same,
        'before': old, 'after': new,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n')
    print(json.dumps({'result': report['result'], 'equalTopology': same,
                      'before': {k: old[k] for k in ('nodes', 'transitions', 'reachableFromEntry', 'weakComponents')},
                      'after': {k: new[k] for k in ('nodes', 'transitions', 'reachableFromEntry', 'weakComponents')}}, indent=2))


if __name__ == '__main__':
    main()
