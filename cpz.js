/* Creative Plug Zambia - shared code.
   Talks to Supabase over plain HTTPS, so no extra library is needed. */
(function () {
  'use strict';
  var cfg = window.CPZ_CONFIG || {};
  var URL_ = String(cfg.SUPABASE_URL || '').replace(/\/+$/, '');
  var KEY = String(cfg.SUPABASE_ANON_KEY || '');
  var configured = (/^https:\/\//.test(URL_) || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(URL_)) && URL_.indexOf('PASTE') === -1 && KEY.length > 20 && KEY.indexOf('PASTE') === -1;

  function CpzError(code, message, status) {
    this.code = code; this.message = message; this.status = status || 0;
  }
  CpzError.prototype = Object.create(Error.prototype);

  function api(path, o) {
    o = o || {};
    if (!configured) {
      return Promise.reject(new CpzError('not_configured', 'The app is not connected to the database yet.'));
    }
    var headers = { apikey: KEY, Authorization: 'Bearer ' + (o.token || KEY), 'Content-Type': 'application/json' };
    if (o.prefer) headers.Prefer = o.prefer;
    return fetch(URL_ + path, {
      method: o.method || 'GET',
      headers: headers,
      body: o.body === undefined ? undefined : JSON.stringify(o.body)
    }).catch(function () {
      throw new CpzError('network', 'No internet connection. Check your data or Wi-Fi and try again.');
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
        if (!res.ok) {
          var msg = (data && (data.message || data.msg || data.error_description || data.error)) || ('Request failed (' + res.status + ')');
          throw new CpzError(res.status === 401 || res.status === 403 ? 'auth' : 'server', String(msg), res.status);
        }
        return data;
      });
    });
  }

  function money(n) {
    n = Number(n) || 0;
    var s = (Math.round(n * 100) % 100 === 0) ? String(Math.round(n)) : n.toFixed(2);
    return 'K' + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function timeAgo(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    if (s < 604800) return Math.floor(s / 86400) + ' day' + (s >= 172800 ? 's' : '') + ' ago';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function statusClass(s) { return 'st-' + String(s).replace(/\s+/g, '-'); }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    [].concat(kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  var toastTimer;
  function toast(msg, bad) {
    var t = document.getElementById('toast');
    if (!t) { t = el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, bad ? 6000 : 3200);
  }

  /* ---------- Customer functions (no login) ---------- */
  var customer = {
    services: function () {
      return api('/rest/v1/services?select=id,name,price,price_is_starting,sort_order&active=eq.true&order=sort_order.asc,name.asc');
    },
    createOrder: function (o) {
      return api('/rest/v1/rpc/create_order', { method: 'POST', body: {
        p_service_id: o.serviceId, p_quantity: o.quantity, p_name: o.name, p_phone: o.phone,
        p_email: o.email || null, p_date: o.date || null, p_instructions: o.instructions || null
      } });
    },
    getOrder: function (num, phone) {
      return api('/rest/v1/rpc/get_order', { method: 'POST', body: { p_order_number: num, p_phone: phone } })
        .then(function (rows) { return (rows && rows[0]) || null; });
    }
  };

  /* ---------- Admin functions (login required) ---------- */
  var SKEY = 'cpz_admin_session';
  function saveSession(j) {
    var s = { access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600) };
    try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function loadSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function clearSession() { try { localStorage.removeItem(SKEY); } catch (e) {} }

  var refreshing = null;   // one shared refresh, so two requests never refresh at the same time
  function freshToken() {
    var s = loadSession();
    if (!s) return Promise.reject(new CpzError('auth', 'Please log in.'));
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s.access_token);
    if (refreshing) return refreshing;
    refreshing = api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } })
      .then(function (j) { refreshing = null; return saveSession(j).access_token; })
      .catch(function (e) {
        refreshing = null;
        if (e.code === 'network') throw e;
        clearSession(); throw new CpzError('auth', 'Your session ended. Please log in again.');
      });
    return refreshing;
  }
  function authed(path, o) {
    o = o || {};
    return freshToken().then(function (t) { o.token = t; return api(path, o); });
  }
  function written(rows, what) {
    if (!rows || !rows.length) throw new CpzError('auth', what + ' was not saved. Log out, log in again and retry.');
    return rows[0];
  }

  var admin = {
    hasSession: function () { return !!loadSession(); },
    login: function (email, password) {
      return api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: password } })
        .then(function (j) { saveSession(j); return admin.check(); })
        .catch(function (e) {
          if (e.code === 'server' || e.code === 'auth') {
            if (/invalid login/i.test(e.message)) throw new CpzError('auth', 'Wrong email or password.');
          }
          throw e;
        });
    },
    check: function () {
      return authed('/rest/v1/rpc/is_admin', { method: 'POST', body: {} }).then(function (ok) {
        if (ok !== true) { clearSession(); throw new CpzError('auth', 'This account is not set up as a CPZ admin yet. Run the admin step from the setup guide.'); }
        return true;
      });
    },
    logout: function () { clearSession(); },
    orders: function () { return authed('/rest/v1/orders?select=*&order=created_at.desc&limit=500'); },
    updateOrder: function (id, patch) {
      return authed('/rest/v1/orders?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: patch, prefer: 'return=representation' })
        .then(function (r) { return written(r, 'The change'); });
    },
    services: function () { return authed('/rest/v1/services?select=*&order=sort_order.asc,name.asc'); },
    updateService: function (id, patch) {
      return authed('/rest/v1/services?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: patch, prefer: 'return=representation' })
        .then(function (r) { return written(r, 'The service change'); });
    },
    addService: function (svc) {
      return authed('/rest/v1/services', { method: 'POST', body: svc, prefer: 'return=representation' })
        .then(function (r) { return written(r, 'The new service'); });
    }
  };

  window.CPZ = { configured: configured, config: cfg, api: api, money: money, digits: digits, timeAgo: timeAgo,
    statusClass: statusClass, el: el, toast: toast, customer: customer, admin: admin, CpzError: CpzError };

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
