(function () {
  "use strict";

  var AGES = [
    { id: "tod", label: "Toddler", sub: "0–3" },
    { id: "kid", label: "Kid", sub: "4–7" },
    { id: "twe", label: "Tween", sub: "8–12" },
    { id: "teen", label: "Teen", sub: "13–17" },
    { id: "adult", label: "Adult", sub: "18–64" },
    { id: "senior", label: "Senior", sub: "65+" }
  ];

  var CATEGORIES = [
    { id: "tech", label: "Tech", emoji: "📱" },
    { id: "games", label: "Games", emoji: "🎮" },
    { id: "books", label: "Books", emoji: "📚" },
    { id: "sports", label: "Sports", emoji: "⚽" },
    { id: "outdoors", label: "Outdoors", emoji: "🏕️" },
    { id: "art", label: "Arts & Crafts", emoji: "🎨" },
    { id: "music", label: "Music", emoji: "🎸" },
    { id: "fashion", label: "Fashion", emoji: "🧣" },
    { id: "beauty", label: "Self-care", emoji: "🛁" },
    { id: "home", label: "Home & Kitchen", emoji: "🏠" },
    { id: "toys", label: "Toys", emoji: "🧸" },
    { id: "diy", label: "Science & DIY", emoji: "🔬" },
    { id: "experience", label: "Experiences", emoji: "🎟️" },
    { id: "food", label: "Food & Treats", emoji: "🍪" }
  ];

  var BUDGETS = [
    { id: 1, label: "Under $25" },
    { id: 2, label: "$25–$75" },
    { id: 3, label: "$75+" }
  ];

  var PRICE_LABEL = { 1: "$", 2: "$$", 3: "$$$" };
  var PAGE_SIZE = 8;
  var STORAGE_KEY = "wishlist-elf:v1";

  var catById = {};
  CATEGORIES.forEach(function (c) { catById[c.id] = c; });

  var gifts = window.GIFTS.map(function (g) {
    return { name: g[0], cat: g[1], ages: g[2].split(" "), price: g[3] };
  });

  var state = {
    age: null,
    cats: new Set(),
    budgets: new Set(),
    pool: [],
    cursor: 0,
    list: load()
  };

  var $ = function (id) { return document.getElementById(id); };

  // ---------- storage ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.list)); } catch (e) {}
    renderBadge();
  }

  // ---------- helpers ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "class") node.className = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function inList(name) {
    return state.list.some(function (i) { return i.name === name; });
  }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  // ---------- pickers ----------
  function renderPickers() {
    var ages = $("ages");
    AGES.forEach(function (a) {
      ages.appendChild(el("button", {
        class: "chip", type: "button", "aria-pressed": "false", "data-id": a.id,
        onclick: function () {
          state.age = state.age === a.id ? null : a.id;
          ages.querySelectorAll(".chip").forEach(function (b) {
            b.setAttribute("aria-pressed", String(b.dataset.id === state.age));
          });
          updateGenerate();
        }
      }, [document.createTextNode(a.label), el("span", { class: "sub", text: a.sub })]));
    });

    var cats = $("categories");
    CATEGORIES.forEach(function (c) {
      cats.appendChild(el("button", {
        class: "chip", type: "button", "aria-pressed": "false", "data-id": c.id,
        text: c.emoji + " " + c.label,
        onclick: function (e) { toggle(state.cats, c.id, e.currentTarget); updateToggleAll(); updateGenerate(); }
      }));
    });

    var budgets = $("budgets");
    BUDGETS.forEach(function (b) {
      budgets.appendChild(el("button", {
        class: "chip", type: "button", "aria-pressed": "false",
        text: b.label,
        onclick: function (e) { toggle(state.budgets, b.id, e.currentTarget); }
      }));
    });

    $("toggle-all").addEventListener("click", function () {
      var selectAll = state.cats.size < CATEGORIES.length;
      state.cats = new Set(selectAll ? CATEGORIES.map(function (c) { return c.id; }) : []);
      cats.querySelectorAll(".chip").forEach(function (b) { b.setAttribute("aria-pressed", String(selectAll)); });
      updateToggleAll();
      updateGenerate();
    });
  }

  function toggle(set, id, btn) {
    if (set.has(id)) set.delete(id); else set.add(id);
    btn.setAttribute("aria-pressed", String(set.has(id)));
  }

  function updateToggleAll() {
    $("toggle-all").textContent = state.cats.size === CATEGORIES.length ? "Clear" : "Select all";
  }

  function updateGenerate() {
    var btn = $("generate");
    btn.disabled = !state.age || state.cats.size === 0;
    btn.textContent = !state.age ? "Pick an age group" :
      state.cats.size === 0 ? "Pick at least one category" : "✨ Get gift ideas";
  }

  // ---------- ideas ----------
  function generate() {
    var matches = gifts.filter(function (g) {
      return g.ages.indexOf(state.age) !== -1 &&
        state.cats.has(g.cat) &&
        (state.budgets.size === 0 || state.budgets.has(g.price));
    });
    state.pool = shuffle(matches);
    state.cursor = 0;
    $("results-wrap").hidden = false;
    showPage();
    $("results-title").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showPage() {
    var results = $("results");
    results.innerHTML = "";
    var total = state.pool.length;

    if (total === 0) {
      results.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big", text: "🦌" }),
        el("p", { text: "No ideas match those picks. Try adding more categories or another budget." })
      ]));
      $("results-count").textContent = "";
      $("more").hidden = true;
      return;
    }

    if (state.cursor >= total) {
      state.pool = shuffle(state.pool);
      state.cursor = 0;
    }
    var page = state.pool.slice(state.cursor, state.cursor + PAGE_SIZE);
    state.cursor += PAGE_SIZE;

    page.forEach(function (g, i) {
      var card = ideaCard(g);
      card.style.animationDelay = (i * 40) + "ms";
      results.appendChild(card);
    });
    $("results-count").textContent = total + " match" + (total === 1 ? "" : "es");
    $("more").hidden = total <= PAGE_SIZE;
  }

  function ideaCard(g) {
    var cat = catById[g.cat];
    var added = inList(g.name);
    var btn = el("button", {
      class: "add", type: "button",
      "aria-pressed": String(added),
      "aria-label": (added ? "Remove " : "Add ") + g.name + " to my list",
      text: added ? "♥" : "♡",
      onclick: function () {
        if (inList(g.name)) {
          state.list = state.list.filter(function (i) { return i.name !== g.name; });
          toast("Removed from your list");
        } else {
          state.list.push({ name: g.name, cat: g.cat, price: g.price, done: false });
          toast("🎁 Added to your list");
        }
        save();
        var now = inList(g.name);
        btn.setAttribute("aria-pressed", String(now));
        btn.textContent = now ? "♥" : "♡";
      }
    });
    return el("div", { class: "card" }, [
      el("div", { class: "emoji", text: cat.emoji }),
      el("div", { class: "info" }, [
        el("div", { class: "name", text: g.name }),
        el("div", { class: "meta" }, [
          document.createTextNode(cat.label + " · "),
          el("span", { class: "price", text: PRICE_LABEL[g.price] })
        ])
      ]),
      btn
    ]);
  }

  // ---------- my list ----------
  function renderList() {
    var wrap = $("my-list");
    wrap.innerHTML = "";
    var n = state.list.length;
    $("list-count").textContent = n ? n + " item" + (n === 1 ? "" : "s") : "";
    $("share").hidden = $("clear").hidden = n === 0;

    if (n === 0) {
      wrap.appendChild(el("div", { class: "empty" }, [
        el("div", { class: "big", text: "🎅" }),
        el("p", { text: "Your list is empty. Tap ♡ on any idea to add it, or type your own above." })
      ]));
      return;
    }

    state.list.forEach(function (item, idx) {
      var cat = catById[item.cat];
      wrap.appendChild(el("div", { class: "card list-item" + (item.done ? " done" : "") }, [
        el("button", {
          class: "check", type: "button",
          "aria-label": item.done ? "Mark as not received" : "Mark as received",
          text: item.done ? "✓" : "",
          onclick: function () { item.done = !item.done; save(); renderList(); }
        }),
        el("div", { class: "emoji", text: cat ? cat.emoji : "⭐" }),
        el("div", { class: "info" }, [
          el("div", { class: "name", text: item.name }),
          el("div", { class: "meta", text: cat ? cat.label + " · " + PRICE_LABEL[item.price] : "My own idea" })
        ]),
        el("button", {
          class: "remove", type: "button", "aria-label": "Remove " + item.name, text: "×",
          onclick: function () { state.list.splice(idx, 1); save(); renderList(); }
        })
      ]));
    });
  }

  function renderBadge() {
    var b = $("badge");
    b.textContent = state.list.length;
    b.hidden = state.list.length === 0;
  }

  function listText() {
    return "🎄 My Christmas List\n\n" + state.list.map(function (i) {
      return (i.done ? "✅ " : "• ") + i.name;
    }).join("\n");
  }

  function share() {
    var text = listText();
    if (navigator.share) {
      navigator.share({ title: "My Christmas List", text: text }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast("📋 List copied"); },
        function () { toast("Couldn't copy the list"); });
    } else {
      toast("Sharing isn't supported here");
    }
  }

  // ---------- tabs ----------
  function showView(name) {
    document.querySelectorAll("nav.tabs button").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.dataset.view === name));
    });
    $("view-ideas").hidden = name !== "ideas";
    $("view-list").hidden = name !== "list";
    if (name === "list") renderList();
    else if (state.pool.length) showCurrentHearts();
    window.scrollTo(0, 0);
  }

  // Sync heart buttons after the list changed on the other tab.
  function showCurrentHearts() {
    var start = Math.max(0, state.cursor - PAGE_SIZE);
    var results = $("results");
    results.innerHTML = "";
    state.pool.slice(start, state.cursor).forEach(function (g) { results.appendChild(ideaCard(g)); });
  }

  // ---------- init ----------
  renderPickers();
  updateGenerate();
  renderBadge();

  $("generate").addEventListener("click", generate);
  $("more").addEventListener("click", function () {
    showPage();
    $("results-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("share").addEventListener("click", share);
  $("clear").addEventListener("click", function () {
    if (confirm("Clear your whole Christmas list?")) { state.list = []; save(); renderList(); }
  });
  $("custom-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("custom-input");
    var name = input.value.trim();
    if (!name) return;
    if (inList(name)) { toast("Already on your list"); return; }
    state.list.push({ name: name, cat: null, price: null, done: false });
    input.value = "";
    save();
    renderList();
  });
  document.querySelectorAll("nav.tabs button").forEach(function (b) {
    b.addEventListener("click", function () { showView(b.dataset.view); });
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
