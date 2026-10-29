"""Bounded source/staged audit. Outputs locations/kinds only, never secret values.

This is a heuristic audit, not proof that arbitrary content is safe. Findings need
review; explicit synthetic examples are not credentials. Historical tracked design
archives stay intact but nested text/path content is also inspected.
"""
import argparse, hashlib, io, json, pathlib, re, struct, subprocess, sys, zipfile, zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/implementation/baseline-20261029/frozen-source-manifest.json'
EXTRA = [
 'runtime-server/src/test/java/kr/ac/kdu/focurve/DashboardEventOrderingTest.java',
 'docs/implementation/baseline-20261029/review-file-classification.json',
 '.gitattributes',
 'docs/implementation/ADDITIONAL_MVP_BASELINE_HANDOFF.md',
 'docs/implementation/TEAM-START-20261029.md',
 'docs/implementation/tasks/TEAM-BASELINE-20261029.md',
 'docs/implementation/baseline-20261029/README.md',
 'docs/implementation/baseline-20261029/frozen-source-manifest.json',
 'docs/implementation/baseline-20261029/pr-semantic-resolutions.json',
 'docs/implementation/baseline-20261029/additional-migration-inventory.json',
 'docs/implementation/baseline-20261029/security-review.json',
 'docs/implementation/baseline-20261029/publication-repairs.json',
 'scripts/verify-team.ps1', 'scripts/verify-publication.py',
 'distribution/tests/fixtures/session_update_before_unused_renewal.py',
]
PATTERNS = {
 'private_key': re.compile(r'-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----'),
 'github_token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b'),
 'cloud_key': re.compile(r'\bAKIA[0-9A-Z]{16}\b'),
 'google_secret': re.compile(r'\bGOCSPX-[A-Za-z0-9_-]{20,}\b'),
 'jwt': re.compile(r'\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b'),
 'credential_url': re.compile(r'(?i)(?:https?|mysql)://[^/\s:@]+:[^/\s@]+@'),
 'sensitive_literal': re.compile(r'''(?im)(?:password|client[_-]?secret|refresh[_-]?token|access[_-]?token|api[_-]?key)\s*[:=]\s*["']([^"'\n]{8,})["']'''),
 'personal_execution_config': re.compile(r'(?i)(?:[A-Z]:[\\/]Users[\\/][^\s"\']+)'),
}
RISK = re.compile(r'(?i)(?:^|/)(?:Default|Profile 2|node_modules|target|\.local)(?:/|$)|\.(?:pfx|p12|jks|key|pem|sqlite3?|db|exe|dll|log)$|(?:^|/)\.env(?!\.example$)')

def git(*args):
 return subprocess.check_output(['git','--no-optional-locks',*args],cwd=ROOT)

def selected():
 m=json.loads(MANIFEST.read_text(encoding='utf-8'))
 return sorted(set([x['path'] for x in m['files']]+EXTRA))

def index_blobs(paths):
 assert all('\n' not in name for name in paths)
 result=subprocess.run(['git','cat-file','--batch'],input=''.join(':'+name+'\n' for name in paths).encode(),stdout=subprocess.PIPE,check=True,cwd=ROOT).stdout
 blobs={};offset=0
 for name in paths:
  end=result.index(b'\n',offset);header=result[offset:end].split()
  if len(header)!=3 or header[1]!=b'blob':raise ValueError('Missing staged source: '+name)
  size=int(header[2]);offset=end+1;blobs[name]=result[offset:offset+size];offset+=size+1
 return blobs

def audit(paths, staged=False, blobs=None):
 findings=[]; risks=[]; binaries=[]; archives=[]
 def scan(name, raw, depth=0):
  if RISK.search(name): risks.append(name)
  if name.lower().endswith('.png'):
   # Some pre-existing Figma exports are JPEGs named .png; browsers accept their genuine JPEG bytes.
   if raw.startswith(b'\xff\xd8\xff') and raw.endswith(b'\xff\xd9'):pass
   elif not raw.startswith(b'\x89PNG\r\n\x1a\n'):risks.append(name+':invalid image signature')
   else:
    offset=8;ended=False
    try:
     while offset<len(raw):
      length=struct.unpack('>I',raw[offset:offset+4])[0];kind=raw[offset+4:offset+8]
      data=raw[offset+8:offset+8+length];crc=struct.unpack('>I',raw[offset+8+length:offset+12+length])[0]
      if zlib.crc32(kind+data)&0xffffffff!=crc:raise ValueError('CRC')
      offset+=12+length
      if kind==b'IEND':ended=True;break
     if not ended:raise ValueError('IEND')
    except (ValueError,struct.error):risks.append(name+':invalid PNG chunks')
  if name.lower().endswith('.zip'):
   archives.append(name)
   if depth>2: risks.append(name+':nested archive limit');return
   with zipfile.ZipFile(io.BytesIO(raw)) as z:
    for info in z.infolist():
     if info.is_dir():continue
     if info.file_size>32_000_000: risks.append(name+'!'+info.filename+':oversize');continue
     scan(name+'!'+info.filename,z.read(info),depth+1)
   return
  try: text=raw.decode('utf-8-sig')
  except UnicodeDecodeError: binaries.append(name);return
  text_hash=hashlib.sha256(raw.replace(b'\r\n',b'\n')).hexdigest()
  for kind,pattern in PATTERNS.items():
   for match in pattern.finditer(text):
    findings.append({'path':name,'line':text.count('\n',0,match.start())+1,'kind':kind,'textLF_SHA256':text_hash})
 for name in paths:
  raw=blobs[name] if staged else (ROOT/name).read_bytes()
  scan(name,raw)
 return {'scope':'staged' if staged else 'selected working sources', 'filesScanned':len(paths), 'riskyPaths':risks, 'findings':findings,'binaryFiles':binaries,'archivesScanned':archives}

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--staged',action='store_true');parser.add_argument('--write-pathspec');parser.add_argument('--output');args=parser.parse_args()
 paths=selected()
 if args.write_pathspec:
  pathlib.Path(args.write_pathspec).write_bytes(b'\0'.join(x.encode() for x in paths)+b'\0')
 if args.staged:
  actual=set(git('diff','--cached','--name-only','-z').decode().split('\0'))-{''}
  unexpected=actual-set(paths)
  if unexpected: raise SystemExit('Staged file outside allowlist: '+json.dumps(sorted(unexpected)))
  # Scan every staged change plus unchanged tracked sources in the resulting index.
 blobs=index_blobs(paths) if args.staged else None
 report=audit(paths,args.staged,blobs)
 review_path='docs/implementation/baseline-20261029/security-review.json'
 review_raw=blobs[review_path] if args.staged else (ROOT/review_path).read_bytes()
 reviews=json.loads(review_raw)['findings']
 def key(x):return (x['path'],x['line'],x['kind'],x['textLF_SHA256'])
 approved={key(x) for x in reviews if x.get('reason')}
 report['unreviewedFindings']=[x for x in report['findings'] if key(x) not in approved]
 if args.output:pathlib.Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({k:v for k,v in report.items() if k not in ('findings','binaryFiles')},ensure_ascii=False))
 print('Reviewed findings:',len(report['findings'])-len(report['unreviewedFindings']),'; unreviewed:',len(report['unreviewedFindings']),'; values suppressed')
 sys.exit(1 if report['riskyPaths'] or report['unreviewedFindings'] else 0)
