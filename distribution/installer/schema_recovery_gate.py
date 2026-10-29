"""Read-only eligibility gate for the confirmed dataset-query defect.

This is not a recovery executor or a caller-supplied observation endpoint.
No status, lock, browser, database or admission is changed here. A production
executor must collect fresh observations through the product-owned channel.
"""
import datetime
import re


class GateError(RuntimeError):
    pass


def require(value, code):
    if not value:
        raise GateError(code)


def eligible(record, failure, grant, evidence, current, now):
    """Validate trusted internal inputs; return eligibility, never READY."""
    require(now.tzinfo is not None, 'CLOCK_UNCONFIRMED')
    require(record.get('status') == 'PRODUCT_HOLD_PRESERVED', 'NOT_PRODUCT_HOLD')
    ident = record.get('id')
    require(isinstance(ident, str) and re.fullmatch('[a-f0-9]{32}', ident), 'INSTALLATION_UNCONFIRMED')
    require(record.get('schema') == 'focurve_user_' + ident, 'SCHEMA_BINDING_MISMATCH')
    require(failure.get('code') == 'PRODUCT_SCHEMA_UNCONFIRMED' and
            failure.get('exceptionType') == 'RuntimeFailure' and
            failure.get('preserved') is True, 'CAUSE_NOT_SUPPORTED')
    # The old stage label was stale. Independent pinned evidence is mandatory;
    # neither that label nor the failure code alone proves the cause.
    require(evidence.get('contract') == 'FOCURVE_SCHEMA_QUERY_CAUSE_1' and
            evidence.get('installationId') == ident and
            evidence.get('launchId') == record.get('launchId') and
            bool(record.get('launchId')), 'CAUSE_BINDING_UNCONFIRMED')
    for name in ('recordSHA256', 'failureSHA256', 'originalRuntimeSHA256', 'fixedRuntimeSHA256'):
        expected = evidence.get(name)
        require(isinstance(expected, str) and re.fullmatch('[a-f0-9]{64}', expected) and
                current.get(name) == expected, 'EVIDENCE_OR_PATCH_CHANGED')
    require(evidence.get('connectionDefaultDatabaseWasNull') is True and
            evidence.get('explicitSchemaReadPassed') is True and
            evidence.get('focusAdmissionNeverOpened') is True and
            evidence.get('focusSTART_ENDPerformed') is False, 'CAUSE_NOT_PROVEN')
    require(grant.get('approved') is True and grant.get('installationId') == ident and
            grant.get('scope') == 'SCHEMA_QUERY_RECOVERY_FOCUS_LOCKED', 'CURRENT_APPROVAL_REQUIRED')
    try:
        start = datetime.datetime.fromisoformat(grant['notBeforeUTC'])
        end = datetime.datetime.fromisoformat(grant['notAfterUTC'])
        observed = datetime.datetime.fromisoformat(current['observedAtUTC'])
    except (ValueError, TypeError, KeyError):
        raise GateError('TIME_UNCONFIRMED') from None
    require(all(t.tzinfo is not None for t in (start, end, observed)), 'TIME_UNCONFIRMED')
    require(start <= now and now + datetime.timedelta(minutes=4) < end and
            end - start <= datetime.timedelta(minutes=15), 'EXECUTION_WINDOW_INVALID')
    require(start <= observed <= now and now - observed <= datetime.timedelta(seconds=30),
            'CURRENT_OBSERVATION_REQUIRED')
    for name in ('identityVerified', 'payloadVerified', 'originalEvidencePreserved',
                 'priorServiceOwnersExited', 'noConflictingOwner', 'focusAdmissionClosed',
                 'freshProductLocalClear', 'freshIndependentDBClear'):
        require(current.get(name) is True, 'UNSAFE_OR_UNKNOWN_' + name.upper())
    require(current.get('STOPPresent') is False and current.get('recoveryAlreadyConsumed') is False,
            'STOP_OR_DUPLICATE_RECOVERY')
    return {'eligible': True, 'focusAdmission': 'CLOSED', 'mutated': False,
            'requiresProductOwnedExecutor': True}
