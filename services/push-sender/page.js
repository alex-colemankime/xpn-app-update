// The page staff send from (GET / on the Worker): a title, a message, what a
// tap opens, and the send key, kept only until the tab closes. It previews
// the notification, asks before sending, and sends a page of phones at a
// time (POST /send with the cursor the last page returned) until all have it.
// Self-contained: its script and style carry the request's nonce.

const STATIONS = [
  ["xpn", "WXPN"],
  ["xpn2", "XPN2"],
  ["homegrown", "Homegrown"],
];

export const sendPage = (nonce) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>WXPN notifications</title>
<style nonce="${nonce}">
  :root { --page: #f5f5f3; --ink: #111; --muted: #555; --line: #d6d6d2; --card: #fff; --send: #ef7149; --bad: #a3241b; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink); font: 16px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 40rem; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  h2 { font-size: 1rem; margin: 0 0 8px; }
  p.lead { margin: 0 0 24px; color: var(--muted); }
  label, legend { display: block; font-weight: 600; margin: 0 0 4px; }
  .hint { color: var(--muted); font-size: 0.875rem; font-weight: 400; margin: 2px 0 0; }
  input[type=text], input[type=url], input[type=password], textarea, select {
    width: 100%; font: inherit; color: inherit; background: var(--card);
    border: 1px solid #8a8a85; border-radius: 6px; padding: 8px 10px;
  }
  textarea { min-height: 5.5rem; resize: vertical; }
  :focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
  .field { margin: 0 0 20px; }
  fieldset { border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px 4px; margin: 0 0 20px; background: var(--card); }
  .choice { display: flex; gap: 8px; align-items: baseline; font-weight: 400; margin: 0 0 10px; }
  .more { margin: 0 0 14px 26px; }
  .more[hidden] { display: none; }
  .more .next { margin-top: 10px; }
  .preview { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; margin: 0 0 20px; }
  .preview .app { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .preview .t { font-weight: 600; margin-top: 2px; overflow-wrap: anywhere; }
  .preview .b { overflow-wrap: anywhere; white-space: pre-wrap; }
  .preview .tap { font-size: 0.875rem; color: var(--muted); margin-top: 8px; border-top: 1px solid var(--line); padding-top: 6px; overflow-wrap: anywhere; }
  button { font: inherit; font-weight: 600; border-radius: 999px; padding: 10px 22px; cursor: pointer; border: 1px solid var(--ink); background: transparent; color: var(--ink); }
  button.send { background: var(--send); border-color: var(--send); color: var(--ink); }
  button:disabled { opacity: 0.55; cursor: progress; }
  #result { margin-top: 20px; min-height: 1.5em; }
  #result.bad { color: var(--bad); font-weight: 600; }
  .count { font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<main>
  <h1>WXPN notifications</h1>
  <p class="lead">Sends a notification to every phone with "Notifications from WXPN" on.</p>
  <form id="form" novalidate>
    <div class="field">
      <label for="title">Title</label>
      <input id="title" type="text" maxlength="100" required autocomplete="off">
    </div>
    <div class="field">
      <label for="body">Message</label>
      <textarea id="body" maxlength="400" required></textarea>
      <p class="hint" id="body-count" aria-live="polite"></p>
    </div>

    <fieldset>
      <legend>What a tap opens</legend>
      <label class="choice"><input type="radio" name="action" value="listen" checked> Listen to a station</label>
      <div class="more" data-for="listen">
        <label for="stream">Station</label>
        <select id="stream">${STATIONS.map(([id, name]) => `<option value="${id}">${name}</option>`).join("")}</select>
      </div>
      <label class="choice"><input type="radio" name="action" value="open"> Open a link</label>
      <div class="more" data-for="open" hidden>
        <label for="url">Link (https)</label>
        <input id="url" type="url" placeholder="https://xpn.org/donate/" autocomplete="off">
      </div>
      <label class="choice"><input type="radio" name="action" value="watch"> Watch a video</label>
      <div class="more" data-for="watch" hidden>
        <label for="watch">Video address (https, YouTube or another video page)</label>
        <input id="watch" type="url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off">
        <label for="watch-title" class="next">Video title <span class="hint">(shown on the watch page)</span></label>
        <input id="watch-title" type="text" maxlength="200" autocomplete="off">
      </div>
      <label class="choice"><input type="radio" name="action" value="app"> Just open the app</label>
    </fieldset>

    <div class="field">
      <label for="kind">Kind of notice</label>
      <select id="kind">
        <option value="other">Something else</option>
        <option value="live">Live video</option>
        <option value="drives">Member drive</option>
      </select>
      <p class="hint">Everyone with notifications on gets every kind. Listeners still on the app's first version chose kinds, and get only those.</p>
    </div>

    <section aria-labelledby="preview-h">
      <h2 id="preview-h">Preview</h2>
      <div class="preview" aria-live="polite">
        <div class="app">WXPN</div>
        <div class="t" id="p-title"></div>
        <div class="b" id="p-body"></div>
        <div class="tap" id="p-tap"></div>
      </div>
    </section>

    <div class="field">
      <label for="key">Send key</label>
      <input id="key" type="password" autocomplete="off" required>
      <p class="hint">Kept in this tab only, until it closes.</p>
    </div>

    <button class="send" id="send" type="submit">Send…</button>
    <div id="result" role="status" aria-live="polite"></div>
  </form>
</main>
<script nonce="${nonce}">
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $("form"), result = $("result"), sendButton = $("send");
  const KEY = "wxpn-send-key";
  try { $("key").value = sessionStorage.getItem(KEY) || ""; } catch {}

  const action = () => form.querySelector("input[name=action]:checked").value;
  const stationName = () => $("stream").selectedOptions[0].textContent;

  // The notification's data, as the app reads it, or an error to show.
  function data() {
    const a = action();
    if (a === "listen") return { action: "listen", stream: $("stream").value };
    if (a === "open") {
      const url = $("url").value.trim();
      if (!/^https:\\/\\//i.test(url)) return { error: "The link must start with https://", field: "url" };
      return { action: "open", url };
    }
    if (a === "watch") {
      const watch = $("watch").value.trim();
      if (!/^https:\\/\\//i.test(watch)) return { error: "The video address must start with https://", field: "watch" };
      return { action: "watch", watch, title: $("watch-title").value.trim() };
    }
    return null;
  }

  function tapText() {
    const d = data();
    if (d && d.error) return "Tapping opens: (" + d.error + ")";
    if (!d) return "Tapping opens the app.";
    if (d.action === "listen") return "Tapping plays " + stationName() + ".";
    if (d.action === "open") return "Tapping opens " + d.url;
    return "Tapping opens the video " + (d.title ? "\\u201c" + d.title + "\\u201d " : "") + "in the app.";
  }

  function update() {
    for (const more of form.querySelectorAll(".more")) more.hidden = more.dataset.for !== action();
    $("p-title").textContent = $("title").value.trim() || "Title";
    $("p-body").textContent = $("body").value.trim() || "Message";
    $("p-tap").textContent = tapText();
    $("body-count").textContent = $("body").value.length + " of 400 characters";
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();

  function show(text, bad) {
    result.textContent = text;
    result.className = bad ? "bad" : "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("title").value.trim(), body = $("body").value.trim(), key = $("key").value;
    const d = data();
    const missing = !title ? "title" : !body ? "body" : d && d.error ? d.field : !key ? "key" : "";
    if (missing) {
      show(missing === "key" ? "Enter the send key." : d && d.error && missing === d.field ? d.error : "Fill in the " + (missing === "body" ? "message" : missing) + ".", true);
      $(missing).focus();
      return;
    }
    const kind = $("kind").value;
    if (!confirm("Send this to every phone with WXPN notifications on?\\n\\n" + title + "\\n" + body + "\\n\\n" + tapText())) return;
    try { sessionStorage.setItem(KEY, key); } catch {}

    sendButton.disabled = true;
    const total = { sent: 0, failed: 0, removed: 0 };
    const notes = new Set();
    let cursor = null;
    try {
      do {
        show("Sending\\u2026 " + total.sent + " sent so far.");
        const response = await fetch("send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ title, body, data: d, kind, cursor }),
        });
        const answer = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) { try { sessionStorage.removeItem(KEY); } catch {} }
          throw new Error(answer.error || "The sender answered " + response.status + ".");
        }
        total.sent += answer.sent; total.failed += answer.failed; total.removed += answer.removed;
        for (const n of [...(answer.errors || []), ...(answer.warnings || [])]) notes.add(n);
        cursor = answer.cursor;
      } while (cursor);
      const phones = (n) => n + (n === 1 ? " phone" : " phones");
      show("Sent to " + phones(total.sent) + ". " +
        (total.failed ? total.failed + " couldn't be reached. " : "") +
        (total.removed ? phones(total.removed) + " no longer had the app and were removed. " : "") +
        (notes.size ? "Notes: " + [...notes].join(" ") : ""), total.failed > 0 && total.sent === 0);
    } catch (error) {
      show((total.sent ? "Stopped after " + total.sent + " sent: " : "Not sent: ") + error.message, true);
    } finally {
      sendButton.disabled = false;
    }
  });
})();
</script>
</body>
</html>
`;
