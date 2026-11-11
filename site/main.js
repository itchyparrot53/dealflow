// biome-ignore-all format: kept compact to meet the landing-site 200-line budget
/* eslint-disable */
(() => {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const header = $("[data-header]");
  if (header) {
    const setScrolled = () => header.classList.toggle("is-scrolled", scrollY > 24);
    setScrolled();
    addEventListener("scroll", setScrolled, { passive: true });
  }
  const menuButton = $("[data-menu-button]");
  const menu = $("#mobile-menu");
  if (menuButton && menu) {
    const items = () => $$("a[href], button:not([disabled])", menu);
    const close = (restore) => {
      if (menu.hidden) return;
      menu.hidden = true;
      menuButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
      if (restore) menuButton.focus();
    };
    const open = () => {
      menu.hidden = false;
      menuButton.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
      items()[0]?.focus();
    };
    menuButton.addEventListener("click", () => (menu.hidden ? open() : close(true)));
    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) close(true);
    });
    document.addEventListener("pointerdown", (event) => {
      if (!menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) close(true);
    });
    document.addEventListener("keydown", (event) => {
      if (menu.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = items();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    });
    matchMedia("(min-width: 900px)").addEventListener("change", (event) => {
      if (event.matches) close(false);
    });
  }
  const tablist = $("[data-tablist]");
  if (tablist) {
    const tabs = $$('[role="tab"]', tablist);
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
    const selectTab = (index, moveFocus) => {
      tabs.forEach((tab, position) => {
        const selected = position === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[position]?.classList.toggle("is-active", selected);
      });
      if (moveFocus) tabs[index].focus();
    };
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => selectTab(index, false));
      tab.addEventListener("keydown", (event) => {
        const step = moves[event.key];
        let next = step ? (index + step + tabs.length) % tabs.length : null;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        selectTab(next, true);
      });
    });
    selectTab(0, false);
  }
  const faqItems = $$(".faq-item");
  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) {
        faqItems.forEach((other) => {
          if (other !== item) other.open = false;
        });
      }
    });
  });
  const starNodes = $$("[data-stars]");
  const cacheKey = "dealflow:stars";
  const formatStars = (value) => (value > 999 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(value));
  const paintStars = (value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    const label = formatStars(value);
    starNodes.forEach((node) => {
      node.textContent = label;
      node.hidden = false;
    });
  };
  const loadStars = async () => {
    let cached = 0;
    try {
      const parsed = JSON.parse(localStorage.getItem(cacheKey));
      if (parsed && Date.now() - parsed.at < 3600000) cached = parsed.stars;
    } catch { /* ignore a blocked cache read */ }
    if (cached > 0) {
      paintStars(cached);
      return;
    }
    try {
      const response = await fetch("https://api.github.com/repos/itchyparrot53/dealflow", {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) return;
      const value = (await response.json())?.stargazers_count;
      if (!Number.isFinite(value) || value <= 0) return;
      paintStars(value);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), stars: value }));
      } catch { /* ignore a blocked cache write */ }
    } catch { /* keep the fallback copy; never show an error or a zero */ }
  };
  if (starNodes.length) loadStars();
  const announcer = $("#copy-status");
  const announce = (message) => {
    if (!announcer) return;
    announcer.textContent = message;
    setTimeout(() => {
      announcer.textContent = "";
    }, 1500);
  };
  const selectText = (element) => {
    const selection = getSelection();
    if (!selection) return;
    selection.selectAllChildren(element);
  };
  $$("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.getAttribute("data-copy-target"));
      if (!target) return;
      const text = target.textContent
        .split("\n")
        .map((line) => line.replace(/^\$ /, ""))
        .join("\n")
        .trim();
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        selectText(target);
      }
      announce("Copied to clipboard");
      const label = button.textContent;
      if (button.classList.contains("copy-btn")) {
        button.textContent = "Copied";
        setTimeout(() => {
          button.textContent = label;
        }, 1500);
        return;
      }
      const chip = button.closest(".install-chip");
      if (chip) {
        chip.classList.add("is-copied");
        setTimeout(() => chip.classList.remove("is-copied"), 1500);
      }
    });
  });

  const reveals = $$(".reveal");
  if (reveals.length && !reduceMotion.matches && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    reveals.forEach((element) => {
      element.classList.add("reveal-armed");
      observer.observe(element);
    });
  }
  root.classList.remove("no-js");
})();
