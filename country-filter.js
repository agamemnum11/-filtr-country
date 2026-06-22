(function () {
  'use strict';

  var PLUGIN_NAME = 'CountryFilter';
  var STORE_KEY   = 'country_filter_blocked';

  var COUNTRIES = [
    { code: 'KR', name: 'Корея' },
    { code: 'CN', name: 'Китай' },
    { code: 'IN', name: 'Індія' },
    { code: 'JP', name: 'Японія' },
    { code: 'ID', name: 'Індонезія' },
    { code: 'TH', name: 'Таїланд' },
    { code: 'TW', name: 'Тайвань' },
    { code: 'HK', name: 'Гонконг' },
    { code: 'PH', name: 'Філіппіни' },
    { code: 'VN', name: 'В\'єтнам' },
    { code: 'MY', name: 'Малайзія' },
    { code: 'BD', name: 'Бангладеш' },
    { code: 'PK', name: 'Пакистан' },
    { code: 'TR', name: 'Туреччина' },
  ];

  /* ── Storage ── */
  function getBlocked() {
    try {
      var raw = Lampa.Storage.get(STORE_KEY, '[]');
      return JSON.parse(raw) || [];
    } catch (e) { return []; }
  }

  function saveBlocked(arr) {
    Lampa.Storage.set(STORE_KEY, JSON.stringify(arr));
  }

  function isBlocked(code) {
    var list = getBlocked();
    for (var i = 0; i < list.length; i++) {
      if (list[i] === code) return true;
    }
    return false;
  }

  function toggle(code) {
    var list = getBlocked();
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i] === code) { list.splice(i, 1); found = true; break; }
    }
    if (!found) list.push(code);
    saveBlocked(list);
  }

  /* ── Filter logic ── */
  function cardBlocked(card) {
    var blocked = getBlocked();
    if (!blocked.length) return false;
    var origins = [];
    if (card.origin_country && card.origin_country.length) {
      for (var i = 0; i < card.origin_country.length; i++) origins.push(card.origin_country[i]);
    }
    if (card.production_countries && card.production_countries.length) {
      for (var j = 0; j < card.production_countries.length; j++) {
        var pc = card.production_countries[j];
        if (pc && pc.iso_3166_1) origins.push(pc.iso_3166_1);
      }
    }
    if (!origins.length) return false;
    for (var k = 0; k < origins.length; k++) {
      for (var m = 0; m < blocked.length; m++) {
        if (origins[k] === blocked[m]) return true;
      }
    }
    return false;
  }

  function filterList(arr) {
    if (!arr || !arr.length) return arr;
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      if (!cardBlocked(arr[i])) out.push(arr[i]);
    }
    return out;
  }

  /* ── Patch Lampa.Api.call ── */
  function patchApi() {
    if (!Lampa.Api || !Lampa.Api.call) return;
    var orig = Lampa.Api.call;
    Lampa.Api.call = function (params, callback, error) {
      var cb = callback;
      if (typeof cb === 'function') {
        cb = function (data) {
          if (data && data.results) data.results = filterList(data.results);
          callback(data);
        };
      }
      return orig.call(this, params, cb, error);
    };
  }

  /* ── Settings UI ── */
  function buildRow(country) {
    var blocked = isBlocked(country.code);
    var row = document.createElement('div');
    row.className = 'cf-item selector';
    row.setAttribute('data-code', country.code);
    row.style.cssText = 'display:flex;align-items:center;padding:0.55em 0.8em;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;gap:0.9em;';

    var box = document.createElement('div');
    box.className = 'cf-box';
    box.style.cssText = 'width:20px;height:20px;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:2px solid ' + (blocked ? '#e74c3c' : '#555') + ';background:' + (blocked ? '#e74c3c' : 'transparent') + ';';
    if (blocked) box.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11"><polyline points="1,5.5 4,8.5 10,1.5" stroke="#fff" stroke-width="2" fill="none"/></svg>';

    var label = document.createElement('div');
    label.textContent = country.name;
    label.style.cssText = 'color:#fff;font-size:1em;';

    var hint = document.createElement('div');
    hint.textContent = country.code;
    hint.style.cssText = 'color:#666;font-size:0.8em;margin-left:auto;';

    row.appendChild(box);
    row.appendChild(label);
    row.appendChild(hint);

    row.addEventListener('click', function () {
      toggle(country.code);
      var now = isBlocked(country.code);
      box.style.border = '2px solid ' + (now ? '#e74c3c' : '#555');
      box.style.background = now ? '#e74c3c' : 'transparent';
      box.innerHTML = now ? '<svg width="11" height="11" viewBox="0 0 11 11"><polyline points="1,5.5 4,8.5 10,1.5" stroke="#fff" stroke-width="2" fill="none"/></svg>' : '';
    });

    return row;
  }

  function openSettings() {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:1em 0.5em;';

    var title = document.createElement('div');
    title.textContent = 'Фільтр країн';
    title.style.cssText = 'font-size:1.25em;font-weight:bold;color:#fff;margin-bottom:0.4em;padding:0 0.3em;';

    var desc = document.createElement('div');
    desc.textContent = 'Відмічені країни будуть приховані скрізь у Lampa';
    desc.style.cssText = 'color:#888;font-size:0.85em;margin-bottom:1em;padding:0 0.3em;';

    wrap.appendChild(title);
    wrap.appendChild(desc);

    for (var i = 0; i < COUNTRIES.length; i++) {
      wrap.appendChild(buildRow(COUNTRIES[i]));
    }

    var info = document.createElement('div');
    info.style.cssText = 'color:#e74c3c;font-size:0.85em;padding:0.8em 0.3em 0;';
    var n = getBlocked().length;
    info.textContent = n ? ('Заблоковано: ' + n + ' країн') : 'Всі країни показуються';
    wrap.appendChild(info);

    Lampa.Modal.open({
      title: '',
      html: wrap,
      size: 'medium',
      onBack: function () { Lampa.Modal.close(); }
    });
  }

  /* ── Register settings component ── */
  function registerSettings() {
    // Додаємо окремий компонент в налаштування
    Lampa.SettingsApi.addComponent({
      component: 'country_filter',
      name: '🌍 Фільтр країн',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
    });

    Lampa.SettingsApi.addParam({
      component: 'country_filter',
      param: {
        name: 'country_filter_open',
        type: 'button',
        default: '',
      },
      field: {
        name: 'Налаштувати фільтр',
        description: 'Вибрати які країни приховувати',
      },
      onChange: function () {
        openSettings();
      }
    });

    Lampa.SettingsApi.addParam({
      component: 'country_filter',
      param: {
        name: 'country_filter_info',
        type: 'static',
        default: '',
      },
      field: {
        name: 'Статус',
        description: function() {
          var n = getBlocked().length;
          return n ? ('Заблоковано ' + n + ' країн: ' + getBlocked().join(', ')) : 'Фільтр не активний';
        }
      }
    });
  }

  /* ── Init ── */
  function init() {
    patchApi();
    registerSettings();
    console.log('[' + PLUGIN_NAME + '] завантажено');
  }

  if (window.Lampa && Lampa.SettingsApi) {
    init();
  } else {
    var timer = setInterval(function () {
      if (window.Lampa && Lampa.SettingsApi) {
        clearInterval(timer);
        init();
      }
    }, 400);
  }

})();
