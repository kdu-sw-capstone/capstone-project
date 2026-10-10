document.querySelectorAll('button').forEach(button => button.addEventListener('click', async () => {
  const output = document.querySelector('#result');
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const response = await chrome.tabs.sendMessage(tab.id, {type:button.dataset.type});
    output.textContent = JSON.stringify(response,null,2);
  } catch (error) {
    output.textContent = 'YouTube 탭을 새로고침한 뒤 다시 시도하세요. ' + error.message;
  }
}));
