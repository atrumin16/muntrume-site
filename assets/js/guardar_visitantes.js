document.addEventListener("DOMContentLoaded", async () => {
  const ipResponse = await fetch('https://api.ipify.org?format=json');
  const { ip } = await ipResponse.json();
  const navegador = navigator.userAgent;

  await fetch("https://script.google.com/macros/s/AKfycbwdIYLnfIpGqGrJtwWDHSEA584Y4KtxJHytgwBHVYtXKy3AKOS9i7Ax9EkZBeQH5qpTMQ/exec", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `ip=${encodeURIComponent(ip)}&navegador=${encodeURIComponent(navegador)}`
  });
});
