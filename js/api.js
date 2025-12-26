const API_URL = "https://script.google.com/macros/s/AKfycbx5jjksqS5mzm7zZtcAjQ4yf1aG88T6qfl99PYO_4jKc48nCxJEeiivfp7ZjvhMSDRhgg/exec";

async function api(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  return res.json();
}
