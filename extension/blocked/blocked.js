const host = new URLSearchParams(location.search).get("host");
document.querySelector("#target").textContent = host ? `대상: ${host}` : "등록한 차단 대상 사이트";
