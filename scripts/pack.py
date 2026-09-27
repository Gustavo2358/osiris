#!/usr/bin/env python3
"""Package exact analyzer UTF-8 bytes. Logical source names must be explicit."""
import argparse,pathlib,json,gzip,hashlib

def pack(files,sources,title,output,evidence=None):
    output=pathlib.Path(output)
    if output.exists():raise ValueError('Output exists; choose a fresh path')
    artifacts={name:pathlib.Path(path).read_text(encoding='utf-8') for name,path in files.items() if path}
    bundle={'schema':'cobol-explorer-bundle','version':'1.0.0','title':title,'artifacts':artifacts,'sources':{name:pathlib.Path(path).read_text(encoding='utf-8') for name,path in sources.items()},'evidence':evidence or {}}
    encoded=json.dumps(bundle,ensure_ascii=False,separators=(',',':')).encode()
    output.write_bytes(gzip.compress(encoded,mtime=0) if output.suffix=='.gz' else encoded)
    return output

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for role in ['air','cfg','sp','links','dependencies']:parser.add_argument('--'+role,type=pathlib.Path,required=role in ['air','cfg'])
    parser.add_argument('--source',action='append',default=[],metavar='LOGICAL_NAME=PATH');parser.add_argument('--title',default='Publicação local');parser.add_argument('--out',type=pathlib.Path,required=True)
    args=parser.parse_args();sources={}
    for item in args.source:
        name,path=item.split('=',1)
        if name in sources:parser.error('Repeated logical source name: '+name)
        sources[name]=path
    files={r+'.json':getattr(args,r) for r in ['air','cfg','sp','links','dependencies']}
    print(pack(files,sources,args.title,args.out))
