/* Stag Wire · pre-launch core: email-first sign-up, reservation dialog. No inline handlers, no innerHTML (strict CSP + Trusted Types). */
(function () {
"use strict";
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

/* ---------- sign-up: one field, then the confirmation ---------- */
var API = "https://acp9reat3l.execute-api.us-east-1.amazonaws.com/signal/request-link";
var SITE = "stagwire.com";
var LANDING_RE = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]{0,199}$/;
var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;
function validEmail(v) { return v.length <= 254 && EMAIL_RE.test(v); }
function payload(email, hp) {
  // The request-link schema is strict: only email, hp, site, landing_path, tz, query are sent.
  var b = { email: email, hp: hp || "", site: SITE };
  if (LANDING_RE.test(location.pathname)) b.landing_path = location.pathname;
  try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz && tz.length <= 40) b.tz = tz; } catch (e) { /* no zone: the API falls back */ }
  var q = location.search;
  if (q && q.length <= 2048 && /[?&](utm_[a-z]+|ref)=/i.test(q)) b.query = q;
  return b;
}
function post(body) {
  var ctl = window.AbortController ? new AbortController() : null, timer = ctl ? window.setTimeout(function () { ctl.abort(); }, 15000) : 0;
  return fetch(API, { method: "POST", mode: "cors", credentials: "omit", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { window.clearTimeout(timer); return { status: r.status, code: j && j.error }; }); },
          function () { window.clearTimeout(timer); return { status: 0, code: "network" }; });
}
function errText(res) {
  var s = res.status, c = res.code;
  if (s === 400 && c === "invalid_email") return "That email address doesn't look right. Check it for a typo?";
  if (s === 400) return "Something in the form didn't go through. Please try again.";
  if (s === 415) return "Your browser sent the form in a format we can't read. Refresh the page and try again.";
  if (s === 429) return "Lots of sign-ups from your network just now. Wait a minute, then try again.";
  if (s === 403) return "Sign-up only works on our own site. Open stagwire.com and try again.";
  if (s >= 500) return "Our sign-up desk hit a snag. Please try again in a moment.";
  return "We couldn't reach the sign-up desk. Check your connection and try again.";
}
$$(".js-join").forEach(function (form) {
  var em = form.querySelector('input[type="email"]'), hp = form.querySelector('input[name="website"]'), err = $(".js-err", form);
  var btn = form.querySelector('button[type="submit"]'), ok = $(".js-ok", form.parentNode), busy = false;
  em.addEventListener("blur", function () {   // inline validation on blur, never only on submit
    var v = em.value.trim();
    if (v && !validEmail(v)) { err.textContent = "That email address doesn't look right yet."; em.setAttribute("aria-invalid", "true"); }
    else { err.textContent = ""; em.removeAttribute("aria-invalid"); }
  });
  em.addEventListener("input", function () { if (em.getAttribute("aria-invalid") && validEmail(em.value.trim())) { err.textContent = ""; em.removeAttribute("aria-invalid"); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var v = em.value.trim();
    if (!validEmail(v)) { err.textContent = "Please enter your email address, like name@example.com."; em.setAttribute("aria-invalid", "true"); em.focus(); return; }
    busy = true; btn.disabled = true; var label = btn.textContent; btn.textContent = "Sending…"; err.textContent = "";
    post(payload(v, hp ? hp.value : "")).then(function (res) {
      busy = false; btn.disabled = false; btn.textContent = label;
      if (res.status === 200) {
        form.hidden = true;
        if (ok) { $$(".js-email", ok).forEach(function (n) { n.textContent = v; }); ok.hidden = false; var hd = $("[tabindex='-1']", ok); if (hd) hd.focus(); }
        return;
      }
      err.textContent = errText(res);
      if (res.code === "invalid_email") { em.setAttribute("aria-invalid", "true"); em.focus(); }
    });
  });
});

/* ---------- reservation + Playbook dialog (Stripe connects here; no payment is taken in preview) ---------- */
var dlg = $("#checkout"), lastBtn = null;
if (dlg) {
  var INSIDER = "Reservation holders are insiders: first access to new features, products and prices, sneak peeks by email, and notes from the build room.";
  var open = function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); };
  var close = function () { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); };
  var li = function (t) { var n = document.createElement("li"); n.textContent = t; return n; };
  var fill = function (b) {
    var ul = $("#coGet"); while (ul.firstChild) ul.removeChild(ul.firstChild);
    (b.getAttribute("data-get") || "").split("|").forEach(function (t) { if (t) ul.appendChild(li(t)); });
    $("#co-h").textContent = b.getAttribute("data-title");
    $("#coPrice").textContent = b.getAttribute("data-price");
    $("#coSave").textContent = b.getAttribute("data-save");
    $("#coPay").textContent = b.getAttribute("data-pay");
    $("#coRefund").textContent = b.getAttribute("data-refund");
    var ins = $("#coInsider"); ins.textContent = INSIDER; ins.hidden = b.getAttribute("data-kind") !== "reserve";
    $("#coStatus").textContent = "";
  };
  $$(".js-checkout").forEach(function (b) { b.addEventListener("click", function () { lastBtn = b; fill(b); open(); }); });
  $("#coPay").addEventListener("click", function () { /* pay-wired */ var u = lastBtn && lastBtn.getAttribute("data-pay-url"); if (!u) { $("#coStatus").textContent = "Checkout is not open yet. Please try again shortly."; return; } $("#coStatus").textContent = "Opening secure checkout..."; window.location.assign(u); });
  $("#coClose").addEventListener("click", close);
  dlg.addEventListener("close", function () { if (lastBtn) lastBtn.focus(); });
}
})();
