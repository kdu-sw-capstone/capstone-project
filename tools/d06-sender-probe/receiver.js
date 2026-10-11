// Observation-only receiver. Every message is denied authorization/effects.
if (!globalThis.__focurveSenderProbe) {
  const instance = crypto.randomUUID();
  globalThis.__focurveSenderProbe = {instance};
  chrome.runtime.onMessage.addListener((message,sender,reply) => {
    if (message?.probe !== 'D06_SENDER_PROBE') return;
    reply({channel:'content-runtime',instance,authorized:false,effects:0,
      claimedSource:message.claimedSource ?? null,sender:senderObservation(sender)});
  });
}
