"""Optional cross-check against the existing RC2 contract-only Python oracle.
Requires contracts/additional-mvp/rc1/requirements.lock dependencies, not Chrome.
No production authority, ledger mutation, storage or policy execution.
"""
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'contracts/additional-mvp/rc1/tests'))
from decision_reference import ConservativeBudget

cases = []
for limit in (60000, 60001, 86400000):
    for debit in (0, 10000, limit, 9007199254740991):
        for reserved in (0, 5000, limit, 9007199254740991):
            for gap in (False, True):
                model = ConservativeBudget(limit, debit)
                model.reserve('known-fixture', 'known-source-fixture', reserved)
                known = model.remaining()
                exhausted = known == 0
                if gap:
                    model.reserve('unknown-fixture', 'unknown-source-fixture', None)
                cases.append({
                    'input': {'limitMs': limit, 'debitMs': debit,
                              'provisionalMs': reserved, 'hasUnconfirmedGap': gap},
                    'expected': {'localOnly': True, 'knownRemainingMs': None if gap else known,
                                 'enforcementRemainingMs': model.remaining(),
                                 'measurementUnconfirmed': gap, 'requiresLimitedSiteHold': gap,
                                 'limitExhausted': exhausted, 'requiresBudgetRestriction': exhausted or gap,
                                 'localReasons': (['DAILY_LIMIT'] if exhausted else [])
                                     + (['MEASUREMENT_UNCONFIRMED'] if gap else [])},
                })
script = """
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {calculateConservativeBudget} from './extension/src/additional-conservative-budget.js';
const cases=JSON.parse(readFileSync(0,'utf8'));
for(const row of cases)assert.deepEqual(calculateConservativeBudget(row.input),row.expected);
console.log(JSON.stringify({status:'PASS',cases:cases.length,scope:'RC2 arithmetic oracle; no authority/storage/Chrome'}));
"""
result = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT,
                        input=json.dumps(cases), text=True, check=False)
raise SystemExit(result.returncode)
