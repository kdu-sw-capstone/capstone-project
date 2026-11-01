"""Optional cross-check: actual JS evaluator vs Python zoneinfo endpoint resolution.
Synthetic policy/time input; not a privileged clock, pinned product tzdb or Chrome test.
Requires Node24 and jsonschema (existing contract requirement).
"""
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
cases = [
    ('America/New_York', '2026-03-08T07:00:00.000Z', '02:10', '03:10', 0),
    ('America/New_York', '2026-03-08T06:45:00.000Z', '01:30', '02:30', 0),
    ('America/New_York', '2026-11-01T05:35:00.000Z', '01:30', '01:45', 0),
    ('America/New_York', '2026-11-01T06:35:00.000Z', '01:30', '01:45', 0),
    ('America/New_York', '2026-11-01T06:35:00.000Z', '00:30', '02:30', 0),
    ('Australia/Lord_Howe', '2026-04-04T14:45:00.000Z', '01:40', '01:50', 0),
    ('Australia/Lord_Howe', '2026-04-04T15:15:00.000Z', '01:40', '01:50', 0),
    ('Australia/Lord_Howe', '2026-10-03T15:35:00.000Z', '02:10', '02:40', 0),
    ('Asia/Seoul', '2026-11-02T15:30:00.000Z', '23:00', '01:00', 1),
    ('Europe/Berlin', '2026-10-25T00:35:00.000Z', '02:30', '02:45', 0),
    ('Europe/Berlin', '2026-10-25T01:35:00.000Z', '02:30', '02:45', 0),
    ('Pacific/Apia', '2011-12-30T10:30:00.000Z', '23:00', '01:00', 1),
    ('America/Juneau', '1867-10-19T06:00:00.000Z', '14:00', '13:00', 1),
    ('Asia/Kathmandu', '2026-11-02T06:20:00.000Z', '12:00', '12:15', 0),
]
formats = FormatChecker()
@formats.checks('iana-zone')
def zone_format(value):
    if not isinstance(value, str): return True
    try: ZoneInfo(value); return True
    except (KeyError, ValueError): return False
@formats.checks('date-time')
def utc_format(value):
    if not isinstance(value, str): return True
    try: return value.endswith('Z') and datetime.fromisoformat(value.replace('Z', '+00:00')).tzinfo == timezone.utc
    except ValueError: return False
schema = json.loads((ROOT / 'contracts/additional-mvp/rc1/schema.json').read_text(encoding='utf-8'))
validator = Draft202012Validator({'$ref': '#/$defs/SiteTimePolicy', '$defs': schema['$defs']}, format_checker=formats)
inputs, expected = [], []
for zone, at, start, end, offset in cases:
    z, now = ZoneInfo(zone), datetime.fromisoformat(at.replace('Z', '+00:00'))
    # All weekdays isolates endpoint/membership geometry from weekday composition.
    when = dict(recurrence='WEEKLY', weekdays=[1,2,3,4,5,6,7], start_local=start, end_local=end,
                end_day_offset=offset, timezone=zone, dst_gap='SKIP', dst_overlap='EARLIER_ONCE')
    policy = dict(kind='SITE_TIME', policy_id=str(uuid4()), version=1, site_id=None,
                  scope=dict(host='example.test', include_subdomains=True), enabled=True,
                  tracking_scope='BROWSER_ALWAYS', daily_limit_ms=None,
                  windows=[dict(window_id=str(uuid4()), kind='BLOCK_WINDOW', enabled=True, when=when)])
    validator.validate(policy)
    def resolve(day, hour):
        naive = datetime.fromisoformat(day.isoformat() + 'T' + hour)
        candidate = naive.replace(tzinfo=z, fold=0).astimezone(timezone.utc)
        return candidate if candidate.astimezone(z).replace(tzinfo=None) == naive else None
    result = False
    for delta in [-1, 0, 1]:
        day = now.astimezone(z).date() + timedelta(days=delta)
        a, b = resolve(day, start), resolve(day + timedelta(days=offset), end)
        if a is not None and b is not None and a <= now < b: result = True
    inputs.append(dict(policies=[policy], host='example.test', nowAt=at)); expected.append(result)
script = """import {readFileSync} from 'node:fs';
const {evaluateSiteTimeWindows}=await import(process.argv[1]);
console.log(JSON.stringify(JSON.parse(readFileSync(0,'utf8')).map(x=>evaluateSiteTimeWindows(x).decision==='WINDOW_BLOCK_REQUIRED')));"""
actual = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script,
    (ROOT / 'extension/src/additional-site-time-windows.js').as_uri()], input=json.dumps(inputs), text=True))
for i, (want, got) in enumerate(zip(expected, actual, strict=True)):
    assert want == got, (i, cases[i], want, got)
print(f'Frozen Schema positive vectors {len(inputs)}/{len(inputs)} PASS; JS vs Python zoneinfo {len(inputs)}/{len(inputs)} PASS')
