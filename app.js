const APP_CONFIG = {
  email: "mikhaelgois1@gmail.com",
  pixKey: "mikhaelgois1@noh.pix",
  pixReceiverName: "MIKHAEL GOIS",
  pixReceiverCity: "SAO PAULO",
  whatsappNumber: "5519981237320",
  whatsappMessage: "Ola, Mikhael! Quero falar sobre criacao de site, edicao de video ou pagamento de corrida.",
};

const SERVICE_MESSAGES = {
  web: {
    subject: "Orcamento de site",
    body: [
      "Ola, Mikhael!",
      "",
      "Quero solicitar um orcamento para criacao de site.",
      "Pode me passar valores e prazo?",
      "",
      "Obrigado(a)!",
    ].join("\n"),
  },
  video: {
    subject: "Orcamento de edicao de video",
    body: [
      "Ola, Mikhael!",
      "",
      "Quero solicitar um orcamento para edicao de video.",
      "Pode me passar valores, formatos e prazo?",
      "",
      "Obrigado(a)!",
    ].join("\n"),
  },
};

const els = {
  btnMailWeb: document.getElementById("btnMailWeb"),
  btnMailWebBottom: document.getElementById("btnMailWebBottom"),
  btnMailVideo: document.getElementById("btnMailVideo"),
  btnMailVideoBottom: document.getElementById("btnMailVideoBottom"),
  themeToggle: document.getElementById("themeToggle"),
  btnWhatsApp: document.getElementById("btnWhatsApp"),
  rideAmount: document.getElementById("rideAmount"),
  generatePix: document.getElementById("generatePix"),
  copyPix: document.getElementById("copyPix"),
  pixOutput: document.getElementById("pixOutput"),
  pixStatus: document.getElementById("pixStatus"),
  openPixOverlay: document.getElementById("openPixOverlay"),
  closePixOverlay: document.getElementById("closePixOverlay"),
  pixOverlay: document.getElementById("pixOverlay"),
};

const STORAGE_KEY = "theme-mode";
const THEME_MODES = ["system", "light", "dark"];
let currentThemeMode = "system";
let navAnimating = false;

const BOOT_PROFILES = {
  hub: { loading: "Inicializando hub...", step: 4, tick: 28 },
  site: { loading: "Carregando modulo web...", step: 5, tick: 25 },
  video: { loading: "Carregando modulo video...", step: 4, tick: 24 },
  corrida: { loading: "Carregando modulo pix...", step: 6, tick: 22 },
  default: { loading: "Inicializando...", step: 4, tick: 28 },
};

const BOOT_LINES = {
  hub: "C:\\SERVICOS\\MIKHAEL> abrir hub de serviços",
  site: "C:\\SERVICOS\\MIKHAEL> abrir serviço de site",
  video: "C:\\SERVICOS\\MIKHAEL> abrir serviço de vídeo",
  corrida: "C:\\SERVICOS\\MIKHAEL> abrir pagamento de corrida",
  default: "C:\\SERVICOS\\MIKHAEL> inicializando",
};

function buildMailtoLink(serviceKey) {
  const data = SERVICE_MESSAGES[serviceKey];
  const params = new URLSearchParams({
    subject: data.subject,
    body: data.body,
  });
  return `mailto:${APP_CONFIG.email}?${params.toString()}`;
}

function buildWhatsAppLink() {
  const number = String(APP_CONFIG.whatsappNumber || "").replace(/\D/g, "");
  const params = new URLSearchParams({
    text: APP_CONFIG.whatsappMessage,
  });
  return `https://wa.me/${number}?${params.toString()}`;
}

function normalizeAmount(value) {
  const normalized = String(value).trim().replace(/\./g, "").replace(",", ".");
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount.toFixed(2);
}

function formatEmv(id, value) {
  const size = String(value.length).padStart(2, "0");
  return `${id}${size}${value}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function generatePixCode(amount) {
  const merchantAccountInfo = formatEmv(
    "26",
    formatEmv("00", "br.gov.bcb.pix") + formatEmv("01", APP_CONFIG.pixKey)
  );

  const txidField = formatEmv("05", "***");
  const additionalData = formatEmv("62", txidField);

  const payloadBase = [
    formatEmv("00", "01"),
    formatEmv("01", "12"),
    merchantAccountInfo,
    formatEmv("52", "0000"),
    formatEmv("53", "986"),
    formatEmv("54", amount),
    formatEmv("58", "BR"),
    formatEmv("59", APP_CONFIG.pixReceiverName.slice(0, 25)),
    formatEmv("60", APP_CONFIG.pixReceiverCity.slice(0, 15)),
    additionalData,
    "6304",
  ].join("");

  const checksum = crc16(payloadBase);
  return payloadBase + checksum;
}

async function copyToClipboard(text) {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(temp);
    return ok;
  }
}

async function sharePixCode(text) {
  if (!text) return false;
  if (!navigator.share) return null;

  try {
    await navigator.share({
      title: "Pagamento de corrida - PIX",
      text,
    });
    return true;
  } catch {
    return false;
  }
}

function resolveEffectiveTheme(mode) {
  if (mode === "light" || mode === "dark") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode) {
  currentThemeMode = mode;
  const effective = resolveEffectiveTheme(mode);
  document.documentElement.setAttribute("data-theme", effective);
  if (els.themeToggle) {
    const label = mode === "system" ? "Sistema" : effective === "dark" ? "Escuro" : "Claro";
    els.themeToggle.textContent = "◐";
    els.themeToggle.setAttribute("aria-label", `Tema: ${label}`);
    els.themeToggle.setAttribute("title", `Tema: ${label}`);
  }
  localStorage.setItem(STORAGE_KEY, mode);
}

function cycleTheme() {
  const currentIndex = THEME_MODES.indexOf(currentThemeMode);
  const nextMode = THEME_MODES[(currentIndex + 1) % THEME_MODES.length];
  applyTheme(nextMode);
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const initial = THEME_MODES.includes(saved) ? saved : "system";
  applyTheme(initial);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    if (currentThemeMode === "system") {
      applyTheme("system");
    }
  });
}

function setPixStatus(message) {
  if (els.pixStatus) {
    els.pixStatus.textContent = message;
  }
}

function getCurrentSection() {
  return document.body.dataset.section || "default";
}

function createBootOverlay({ bootText, loadingLabel }) {
  const overlay = document.createElement("div");
  overlay.className = "boot-overlay";
  overlay.innerHTML = `
    <div class="boot-terminal" role="status" aria-live="polite">
      <p class="boot-typed"></p>
      <div class="boot-loading"><span class="boot-loading-label">${loadingLabel}</span> <span class="boot-percent">0%</span></div>
      <div class="boot-bar"><div class="boot-fill"></div></div>
    </div>
  `;

  const typedEl = overlay.querySelector(".boot-typed");
  const percentEl = overlay.querySelector(".boot-percent");
  const fillEl = overlay.querySelector(".boot-fill");
  typedEl.textContent = bootText;

  return { overlay, typedEl, percentEl, fillEl };
}

function runProgress({ percentEl, fillEl, from, to, step, tick, onDone }) {
  let progress = from;
  const direction = from <= to ? 1 : -1;

  const progressStep = window.setInterval(() => {
    progress += step * direction;

    const reached = direction === 1 ? progress >= to : progress <= to;
    const clamped = reached ? to : progress;

    percentEl.textContent = `${clamped}%`;
    fillEl.style.width = `${clamped}%`;

    if (reached) {
      window.clearInterval(progressStep);
      onDone();
    }
  }, tick);
}

function runBootSequence() {
  const bootlineEl = document.querySelector(".bootline");
  if (!bootlineEl) return;

  const section = getCurrentSection();
  const bootText = BOOT_LINES[section] || BOOT_LINES.default;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const profile = BOOT_PROFILES[section] || BOOT_PROFILES.default;
  const { overlay, typedEl, percentEl, fillEl } = createBootOverlay({
    bootText,
    loadingLabel: profile.loading,
  });

  document.body.appendChild(overlay);

  const finish = () => {
    overlay.classList.add("boot-overlay--done");
    window.setTimeout(() => {
      overlay.remove();
    }, 380);
  };

  const runLoading = () => {
    runProgress({
      percentEl,
      fillEl,
      from: 0,
      to: 100,
      step: prefersReducedMotion ? 20 : profile.step,
      tick: prefersReducedMotion ? 8 : profile.tick,
      onDone: () => window.setTimeout(finish, 220),
    });
  };

  if (prefersReducedMotion) {
    typedEl.textContent = bootText;
    runLoading();
    return;
  }

  let index = 0;
  const typeStep = window.setInterval(() => {
    index += 1;
    const visible = bootText.slice(0, index);
    typedEl.innerHTML = `${visible}<span class="boot-cursor">▌</span>`;

    if (index >= bootText.length) {
      window.clearInterval(typeStep);
      typedEl.textContent = bootText;
      runLoading();
    }
  }, 26);
}

function navigateWithBackAnimation(targetHref) {
  if (navAnimating) return;
  navAnimating = true;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const currentSection = getCurrentSection();
  const profile = BOOT_PROFILES[currentSection] || BOOT_PROFILES.default;
  const text = `C:\\SERVICOS\\MIKHAEL> return --hub`;
  const { overlay, percentEl, fillEl } = createBootOverlay({
    bootText: text,
    loadingLabel: "Encerrando modulo...",
  });

  document.body.appendChild(overlay);

  const go = () => {
    window.location.href = targetHref;
  };

  runProgress({
    percentEl,
    fillEl,
    from: 100,
    to: 0,
    step: prefersReducedMotion ? 25 : profile.step,
    tick: prefersReducedMotion ? 8 : profile.tick,
    onDone: () => window.setTimeout(go, 120),
  });
}

function openPixOverlay() {
  if (!els.pixOverlay) return;
  els.pixOverlay.classList.remove("hidden");
  document.body.classList.add("overlay-open");
}

function closePixOverlay() {
  if (!els.pixOverlay) return;
  els.pixOverlay.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

function init() {
  if (els.btnMailWeb) {
    els.btnMailWeb.href = buildMailtoLink("web");
  }
  if (els.btnMailWebBottom) {
    els.btnMailWebBottom.href = buildMailtoLink("web");
  }
  if (els.btnMailVideo) {
    els.btnMailVideo.href = buildMailtoLink("video");
  }
  if (els.btnMailVideoBottom) {
    els.btnMailVideoBottom.href = buildMailtoLink("video");
  }
  if (els.btnWhatsApp) {
    els.btnWhatsApp.href = buildWhatsAppLink();
  }

  if (els.generatePix && els.rideAmount && els.pixOutput) {
    els.generatePix.addEventListener("click", () => {
      const amount = normalizeAmount(els.rideAmount.value);
      if (!amount) {
        els.pixOutput.value = "";
        setPixStatus("Informe um valor valido. Ex.: 10,50");
        return;
      }

      els.pixOutput.value = generatePixCode(amount);
      setPixStatus(`PIX gerado para R$ ${amount}.`);
    });
  }

  if (els.copyPix && els.pixOutput) {
    els.copyPix.addEventListener("click", async () => {
      const ok = await copyToClipboard(els.pixOutput.value);
      setPixStatus(ok ? "PIX copiado com sucesso." : "Nao foi possivel copiar agora.");
    });
  }

  const sharePixButton = document.getElementById("sharePix");
  if (sharePixButton && els.pixOutput) {
    sharePixButton.addEventListener("click", async () => {
      if (!els.pixOutput.value) {
        setPixStatus("Gere o PIX antes de compartilhar.");
        return;
      }

      const shared = await sharePixCode(els.pixOutput.value);
      if (shared === true) {
        setPixStatus("Escolha o app no menu de compartilhamento.");
        return;
      }

      if (shared === null) {
        const copied = await copyToClipboard(els.pixOutput.value);
        setPixStatus(copied ? "Seu navegador nao suporta compartilhar. PIX copiado para colar no app." : "Nao foi possivel compartilhar ou copiar agora.");
        return;
      }

      setPixStatus("Compartilhamento cancelado.");
    });
  }

  const isPixModalMode = Boolean(els.openPixOverlay && els.closePixOverlay);
  if (isPixModalMode && els.pixOverlay) {
    els.openPixOverlay.addEventListener("click", openPixOverlay);
    els.closePixOverlay.addEventListener("click", closePixOverlay);

    els.pixOverlay.addEventListener("click", (event) => {
      if (event.target === els.pixOverlay) {
        closePixOverlay();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePixOverlay();
      }
    });
  }

  const isPixOverlayPageMode = Boolean(els.pixOverlay && !isPixModalMode);
  if (isPixOverlayPageMode) {
    els.pixOverlay.addEventListener("click", (event) => {
      if (event.target === els.pixOverlay) {
        navigateWithBackAnimation("index.html");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        navigateWithBackAnimation("index.html");
      }
    });
  }

  const backLinks = document.querySelectorAll("a.back-link");
  backLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigateWithBackAnimation(link.getAttribute("href"));
    });
  });

  if (els.themeToggle) {
    els.themeToggle.addEventListener("click", cycleTheme);
  }
  initTheme();
  runBootSequence();
}

init();
