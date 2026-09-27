#!/usr/bin/env python3
"""Compile unmodified analyzer sources into this project's disposable cache.
Reads existing generated ANTLR Java. No Maven installs or writes to producer repos.
"""
import pathlib, subprocess, json, hashlib, os
ROOT=pathlib.Path(__file__).resolve().parents[1]; WS=ROOT.parent; OUT=ROOT/'.cache/runtime'; OUT.mkdir(parents=True,exist_ok=True)
M2=pathlib.Path(os.environ.get('MAVEN_REPO',str(pathlib.Path.home()/'.m2/repository')))
LIBS=['org/antlr/antlr4-runtime/4.13.2/antlr4-runtime-4.13.2.jar','org/slf4j/slf4j-api/2.0.18/slf4j-api-2.0.18.jar','ch/qos/logback/logback-classic/1.6.3/logback-classic-1.6.3.jar','ch/qos/logback/logback-core/1.6.3/logback-core-1.6.3.jar','com/fasterxml/jackson/core/jackson-databind/2.22.2/jackson-databind-2.22.2.jar','com/fasterxml/jackson/core/jackson-core/2.22.2/jackson-core-2.22.2.jar','com/fasterxml/jackson/core/jackson-annotations/2.22/jackson-annotations-2.22.jar','com/dynatrace/hash4j/hash4j/0.30.0/hash4j-0.30.0.jar']
jars=[M2/p for p in LIBS]
assert all(p.exists() for p in jars),'Missing runtime jars; build the analyzers first or set MAVEN_REPO'
CLASSES=OUT/'classes'; CLASSES.mkdir(exist_ok=True)
roots=[WS/'air-java/air-model/src/main/java',WS/'air-java/air-json/src/main/java',WS/'cobol-lower/core/src/main/java',WS/'cobol-lower/adapters/src/main/java']
roots += list((WS/'analysis-cfg').glob('*/src/main/java'))
roots += [WS/'proleap-poc/src/main/java', WS/'proleap-poc/target/generated-sources/antlr4',ROOT/'bridge']
assert list(roots[-2].rglob('*.java')),'Build frontend generated ANTLR sources first'
sources=sorted(p for root in roots for p in root.rglob('*.java'))
cp=os.pathsep.join(map(str,[CLASSES,WS/'proleap-poc/src/main/resources',*jars])); (OUT/'classpath.txt').write_text(cp)
args=OUT/'sources.txt';args.write_text('\n'.join('"'+str(p)+'"' for p in sources))
r=subprocess.run(['javac','--release','21','-encoding','UTF-8','-cp',cp,'-d',str(CLASSES),'@'+str(args)],capture_output=True,text=True)
(OUT/'compile.log').write_text(r.stdout+r.stderr);print(r.stdout+r.stderr);r.check_returncode()
def git(repo,*a):return subprocess.check_output(['git','-C',str(WS/repo),*a],text=True).strip()
info={'repos':{repo:{'sha':git(repo,'rev-parse','HEAD'),'status':git(repo,'status','--porcelain')} for repo in ['proleap-poc','cobol-lower','air-java','analysis-cfg','analysis-ir']},'java':subprocess.run(['java','-version'],capture_output=True,text=True).stderr,'sourceCount':len(sources),'sourcesSha256':hashlib.sha256(b''.join(str(p.relative_to(WS)).encode()+p.read_bytes() for p in sources)).hexdigest(),'libraries':{str(p.relative_to(M2)):hashlib.sha256(p.read_bytes()).hexdigest() for p in jars}}
(OUT/'build.json').write_text(json.dumps(info,indent=2)+'\n');print('Compiled',len(sources),'sources into',CLASSES)
