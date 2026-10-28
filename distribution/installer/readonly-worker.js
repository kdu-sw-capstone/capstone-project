/* Temporary diagnostic entry only. Never ship as the normal product Worker.
 * Apply only while the dedicated Chrome is stopped, under a bounded approval.
 * Normal product imports, events, timers, messages and recovery stay unstarted.
 * Close the diagnostic Chrome before restoring the exact original entry.
 */
'use strict';
globalThis.FOCURVE_READONLY_BOOTSTRAP=Object.freeze({contract:'FOCURVE_READONLY_BOOTSTRAP_1',productInitialized:false});
