"""Optional cross-check against the existing RC2 reason composition oracle.
Requires the existing contract requirements.lock dependencies. No product effects.
"""
import itertools
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'contracts/additional-mvp/rc1/tests'))
from reference_model import reasons

names = ['quota', 'block_window', 'outside', 'adult', 'keyword', 'adult_except', 'keyword_except']
mapping = {'quota': 'DAILY_LIMIT', 'block_window': 'BLOCK_WINDOW', 'outside': 'OUTSIDE_ALLOW_WINDOW',
           'adult': 'ADULT_DOMAIN', 'keyword': 'KEYWORD'}
cases = []
for access in ['ALLOW', 'BLOCK', 'RECORD']:
    for flags in itertools.product([False, True], repeat=len(names)):
        kwargs = dict(zip(names, flags))
        candidate, expected = reasons(access, **kwargs)
        cases.append({'input': {'focusAccess': access,
                               'runtimeReasons': [mapping[k] for k in mapping if kwargs[k]],
                               'exceptions': {'adultDomain': kwargs['adult_except'], 'keyword': kwargs['keyword_except']}},
                      'expected': {'localOnly': True, 'candidateAccess': candidate,
                                   'requiresRestriction': bool(expected), 'localReasons': expected}})
script = """
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {composePolicyReasons} from './extension/src/additional-policy-reasons.js';
const cases=JSON.parse(readFileSync(0,'utf8'));
for(const row of cases)assert.deepEqual(composePolicyReasons(row.input),row.expected);
console.log(JSON.stringify({status:'PASS',cases:cases.length,scope:'existing RC2 reasons oracle; no authority/effects'}));
"""
raise SystemExit(subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT,
                              input=json.dumps(cases), text=True, check=False).returncode)
