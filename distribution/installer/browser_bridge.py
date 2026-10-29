"""Browser transport boundary. No CDP, browser discovery, or manual proof import.

No production provider is currently registered. Adding one requires a separately
verified official connection and the same installation/safety/admission contract.
"""
OPERATIONS=frozenset({'identity','safety','ready','quiesce','openWeb'})
class BrowserUnavailable(RuntimeError):pass
class BrowserBridge:
 def __init__(self,provider=None):self._provider=provider
 def require_available(self):
  if self._provider is None:raise BrowserUnavailable('OFFICIAL_BROWSER_PROVIDER_NOT_CONFIGURED')
 def request(self,installation,record,operation):
  if operation not in OPERATIONS:raise BrowserUnavailable('BROWSER_OPERATION_OUT_OF_SCOPE')
  self.require_available()
  # The production provider must validate target, policy, ownership, deadline,
  # timeout and fresh operation-bound evidence. Existing installer gates remain.
  result=self._provider.request(installation,record,operation)
  if not isinstance(result,dict):raise BrowserUnavailable('BROWSER_REPLY_UNCONFIRMED')
  return result
