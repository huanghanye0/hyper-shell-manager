"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const PLUGIN_NAME = "hyper-shell-manager";
const CONFIG_KEY = "hyperShellManager";
const RELOAD_MARKER_PREFIX = "// hyper-shell-manager reload:";

let appRef = null;
let lastConfig = null;

function log(...args) {
  console.log(`[${PLUGIN_NAME}]`, ...args);
}

function fileExists(file) {
  try {
    return fs.existsSync(file);
  } catch (_) {
    return false;
  }
}

function getHyperDir() {
  const home = os.homedir();

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Hyper");
  }

  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(home, "AppData", "Roaming"),
      "Hyper",
    );
  }

  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(home, ".config"),
    "Hyper",
  );
}

function getStateFilePath() {
  return path.join(getHyperDir(), `${PLUGIN_NAME}.json`);
}

function getHyperConfigPath() {
  const home = os.homedir();

  const candidates = [
    path.join(getHyperDir(), ".hyper.js"),
    path.join(home, ".hyper.js"),
  ];

  return candidates.find(fileExists);
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {
    // ignore
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return {};
  }
}

function writeJson(file, data) {
  try {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    log("failed to write json:", error);
  }
}

function readState() {
  return readJson(getStateFilePath());
}

function writeState(state) {
  writeJson(getStateFilePath(), state);
}

function loadUserHyperRootConfigFromFile() {
  const configPath = getHyperConfigPath();

  if (!configPath) {
    log("no .hyper.js found");
    return {};
  }

  try {
    delete require.cache[require.resolve(configPath)];

    const exported = require(configPath);
    const rootConfig =
      exported && exported.__esModule ? exported.default : exported;

    return rootConfig || {};
  } catch (error) {
    log("failed to load .hyper.js:", configPath, error);
    return {};
  }
}

function normalizeRootConfig(root) {
  if (!root || typeof root !== "object") {
    return {};
  }

  if (root.config && typeof root.config === "object") {
    return root.config;
  }

  return root;
}

function getRuntimeConfig() {
  if (
    lastConfig &&
    typeof lastConfig === "object" &&
    Object.keys(lastConfig).length > 0
  ) {
    return lastConfig;
  }

  if (appRef && appRef.config && typeof appRef.config === "object") {
    return appRef.config;
  }

  const fileRoot = loadUserHyperRootConfigFromFile();
  return normalizeRootConfig(fileRoot);
}

function getManagerConfig(config) {
  const runtimeConfig = config || getRuntimeConfig();

  if (
    runtimeConfig &&
    typeof runtimeConfig === "object" &&
    runtimeConfig[CONFIG_KEY] &&
    typeof runtimeConfig[CONFIG_KEY] === "object"
  ) {
    return runtimeConfig[CONFIG_KEY];
  }

  const fileRoot = loadUserHyperRootConfigFromFile();
  const fileConfig = normalizeRootConfig(fileRoot);

  if (
    fileConfig &&
    typeof fileConfig === "object" &&
    fileConfig[CONFIG_KEY] &&
    typeof fileConfig[CONFIG_KEY] === "object"
  ) {
    return fileConfig[CONFIG_KEY];
  }

  return {};
}

function normalizeProfile(name, profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  if (!profile.shell || typeof profile.shell !== "string") {
    return null;
  }

  return {
    name,
    label: typeof profile.label === "string" ? profile.label : name,
    shell: profile.shell,
    shellArgs: Array.isArray(profile.shellArgs) ? profile.shellArgs : [],
    env: profile.env && typeof profile.env === "object" ? profile.env : {},
  };
}

function getProfiles(config) {
  const managerConfig = getManagerConfig(config);

  const rawProfiles =
    managerConfig.profiles && typeof managerConfig.profiles === "object"
      ? managerConfig.profiles
      : {};

  const profiles = {};

  Object.keys(rawProfiles).forEach((name) => {
    const profile = normalizeProfile(name, rawProfiles[name]);

    if (profile) {
      profiles[name] = profile;
    }
  });

  const names = Object.keys(profiles);

  if (names.length === 0) {
    return {
      profiles: {},
      names: [],
      activeName: null,
      activeProfile: null,
    };
  }

  const state = readState();
  const preferredName =
    state.activeProfile || managerConfig.defaultProfile || names[0];
  const activeName = profiles[preferredName] ? preferredName : names[0];

  return {
    profiles,
    names,
    activeName,
    activeProfile: profiles[activeName],
  };
}

function getUiConfig(config) {
  const managerConfig = getManagerConfig(config);

  const ui =
    managerConfig.ui && typeof managerConfig.ui === "object"
      ? managerConfig.ui
      : {};

  const allowedThemes = ["system", "dark", "light"];

  return {
    label: typeof ui.label === "string" ? ui.label : "",
    theme: allowedThemes.includes(ui.theme) ? ui.theme : "system",
    width: typeof ui.width === "string" ? ui.width : "56px",
    top: typeof ui.top === "string" ? ui.top : "9px",
    right: typeof ui.right === "string" ? ui.right : "156px",
    left: typeof ui.left === "string" ? ui.left : "",
  };
}

function triggerHyperConfigReload() {
  const configPath = getHyperConfigPath();

  if (!configPath) {
    log("cannot find .hyper.js, skip reload trigger");
    return;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");

    const lines = raw
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith(RELOAD_MARKER_PREFIX));

    lines.push(`${RELOAD_MARKER_PREFIX} ${Date.now()}`);

    fs.writeFileSync(
      configPath,
      lines.join("\n").replace(/\s*$/, "\n"),
      "utf8",
    );

    log("config reload triggered:", configPath);
  } catch (error) {
    log("failed to trigger config reload:", error);
  }
}

function setActiveProfile(name) {
  const { profiles } = getProfiles();
  const profile = profiles[name];

  if (!profile) {
    log("unknown profile:", name);
    return false;
  }

  writeState({
    activeProfile: name,
    updatedAt: new Date().toISOString(),
  });

  log("profile switched:", name, profile.shell);
  triggerHyperConfigReload();

  return true;
}

function removeOldDom(doc) {
  [
    "hyper-shell-manager-switcher",
    "hyper-shell-manager-tip",
    "hyper-shell-manager-style",
  ].forEach((id) => {
    const el = doc.getElementById(id);

    if (el) {
      el.remove();
    }
  });
}

function cleanupWindow(win) {
  if (!win || typeof win.__hyperShellManagerCleanup !== "function") {
    return;
  }

  try {
    win.__hyperShellManagerCleanup();
  } catch (_) {
    // ignore
  }

  win.__hyperShellManagerCleanup = null;
}

function injectSwitcher(win) {
  const doc = win && win.document;

  if (!doc || !doc.head || !doc.body) {
    return;
  }

  cleanupWindow(win);
  removeOldDom(doc);

  const { profiles, names, activeName } = getProfiles();
  const ui = getUiConfig();

  if (!names || names.length === 0) {
    log(`no ${CONFIG_KEY}.profiles found, switcher hidden`);
    return;
  }

  const positionCss = ui.left
    ? `left: ${ui.left} !important; right: auto !important;`
    : `right: ${ui.right} !important; left: auto !important;`;

  const tipPositionCss = ui.left
    ? `left: ${ui.left} !important; right: auto !important;`
    : `right: ${ui.right} !important; left: auto !important;`;

  const style = doc.createElement("style");
  style.id = "hyper-shell-manager-style";

  style.textContent = `
    #hyper-shell-manager-switcher {
      --hsm-bg: rgba(24, 25, 34, 0.62);
      --hsm-border: rgba(255, 255, 255, 0.11);
      --hsm-text: rgba(255, 255, 255, 0.92);
      --hsm-muted: rgba(255, 255, 255, 0.56);
      --hsm-select-bg: rgba(255, 255, 255, 0.11);
      --hsm-select-hover: rgba(255, 255, 255, 0.16);
      --hsm-select-active: rgba(255, 255, 255, 0.21);
      --hsm-focus: rgba(120, 158, 255, 0.68);
      --hsm-shadow: 0 3px 10px rgba(0, 0, 0, 0.18);

      position: fixed !important;
      top: ${ui.top} !important;
      ${positionCss}
      z-index: 2147483647 !important;

      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;

      height: 16px !important;
      padding: 1px 3px 1px 5px !important;
      box-sizing: border-box !important;

      color: var(--hsm-text) !important;
      background: var(--hsm-bg) !important;
      border: 1px solid var(--hsm-border) !important;
      border-radius: 999px !important;
      box-shadow: var(--hsm-shadow) !important;

      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei UI", sans-serif !important;
      font-size: 10px !important;
      line-height: 1 !important;

      user-select: none !important;
      -webkit-user-select: none !important;
      -webkit-app-region: no-drag !important;

      backdrop-filter: blur(12px) saturate(1.25) !important;
      -webkit-backdrop-filter: blur(12px) saturate(1.25) !important;

      transition:
        background 140ms ease,
        border-color 140ms ease,
        box-shadow 140ms ease,
        opacity 140ms ease !important;
    }

    #hyper-shell-manager-switcher:hover {
      --hsm-border: rgba(255, 255, 255, 0.2);
      --hsm-bg: rgba(30, 31, 42, 0.72);
    }

    #hyper-shell-manager-switcher .hsm-label {
      display: inline-flex !important;
      align-items: center !important;
      height: 100% !important;
      color: var(--hsm-muted) !important;
      font-weight: 600 !important;
      letter-spacing: 0.01em !important;
      white-space: nowrap !important;
      text-transform: none !important;
    }

    #hyper-shell-manager-select-wrap {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      height: 14px !important;
      min-width: ${ui.width} !important;
      max-width: ${ui.width} !important;
      -webkit-app-region: no-drag !important;
    }

    #hyper-shell-manager-select {
      width: 100% !important;
      height: 14px !important;
      margin: 0 !important;
      padding: 0 14px 0 5px !important;
      box-sizing: border-box !important;

      appearance: none !important;
      -webkit-appearance: none !important;

      color: var(--hsm-text) !important;
      background: var(--hsm-select-bg) !important;
      border: 1px solid transparent !important;
      border-radius: 999px !important;
      outline: none !important;

      font: inherit !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      line-height: 14px !important;

      cursor: pointer !important;
      -webkit-app-region: no-drag !important;

      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;

      transition:
        background 120ms ease,
        border-color 120ms ease,
        box-shadow 120ms ease !important;
    }

    #hyper-shell-manager-select:hover {
      background: var(--hsm-select-hover) !important;
    }

    #hyper-shell-manager-select:active {
      background: var(--hsm-select-active) !important;
    }

    #hyper-shell-manager-select:focus {
      border-color: var(--hsm-focus) !important;
      box-shadow: 0 0 0 1px rgba(126, 166, 255, 0.22) !important;
    }

    #hyper-shell-manager-select option {
      color: #111 !important;
      background: #fff !important;
      font-size: 12px !important;
    }

    #hyper-shell-manager-select-arrow {
      position: absolute !important;
      right: 5px !important;
      top: 50% !important;
      width: 4px !important;
      height: 4px !important;
      pointer-events: none !important;
      border-right: 1.2px solid var(--hsm-muted) !important;
      border-bottom: 1.2px solid var(--hsm-muted) !important;
      transform: translateY(-65%) rotate(45deg) !important;
      transform-origin: 50% 50% !important;
      opacity: 0.9 !important;
      transition:
        transform 140ms ease,
        opacity 140ms ease,
        border-color 140ms ease !important;
    }

    #hyper-shell-manager-select-wrap.is-open #hyper-shell-manager-select-arrow {
      transform: translateY(-35%) rotate(225deg) !important;
      opacity: 1 !important;
    }

    #hyper-shell-manager-tip {
      --hsm-tip-bg: rgba(25, 26, 36, 0.96);
      --hsm-tip-text: rgba(255, 255, 255, 0.92);
      --hsm-tip-border: rgba(255, 255, 255, 0.14);

      position: fixed !important;
      top: calc(${ui.top} + 22px) !important;
      ${tipPositionCss}
      z-index: 2147483647 !important;

      display: block !important;
      max-width: 220px !important;
      padding: 5px 7px !important;
      box-sizing: border-box !important;

      color: var(--hsm-tip-text) !important;
      background: var(--hsm-tip-bg) !important;
      border: 1px solid var(--hsm-tip-border) !important;
      border-radius: 7px !important;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24) !important;

      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei UI", sans-serif !important;
      font-size: 10px !important;
      line-height: 1.4 !important;

      pointer-events: none !important;
      opacity: 0 !important;
      transform: translateY(-3px) scale(0.98) !important;
      transition:
        opacity 130ms ease,
        transform 130ms ease !important;

      backdrop-filter: blur(12px) saturate(1.25) !important;
      -webkit-backdrop-filter: blur(12px) saturate(1.25) !important;
      -webkit-app-region: no-drag !important;
    }

    #hyper-shell-manager-tip.show {
      opacity: 1 !important;
      transform: translateY(0) scale(1) !important;
    }

    @media (prefers-color-scheme: light) {
      #hyper-shell-manager-switcher[data-hsm-theme="system"] {
        --hsm-bg: rgba(255, 255, 255, 0.64);
        --hsm-border: rgba(0, 0, 0, 0.11);
        --hsm-text: rgba(20, 22, 28, 0.9);
        --hsm-muted: rgba(20, 22, 28, 0.5);
        --hsm-select-bg: rgba(0, 0, 0, 0.055);
        --hsm-select-hover: rgba(0, 0, 0, 0.085);
        --hsm-select-active: rgba(0, 0, 0, 0.12);
        --hsm-focus: rgba(45, 105, 255, 0.6);
        --hsm-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
      }

      #hyper-shell-manager-tip[data-hsm-theme="system"] {
        --hsm-tip-bg: rgba(255, 255, 255, 0.96);
        --hsm-tip-text: rgba(20, 22, 28, 0.9);
        --hsm-tip-border: rgba(0, 0, 0, 0.1);
      }
    }

    #hyper-shell-manager-switcher[data-hsm-theme="light"] {
      --hsm-bg: rgba(255, 255, 255, 0.64);
      --hsm-border: rgba(0, 0, 0, 0.11);
      --hsm-text: rgba(20, 22, 28, 0.9);
      --hsm-muted: rgba(20, 22, 28, 0.5);
      --hsm-select-bg: rgba(0, 0, 0, 0.055);
      --hsm-select-hover: rgba(0, 0, 0, 0.085);
      --hsm-select-active: rgba(0, 0, 0, 0.12);
      --hsm-focus: rgba(45, 105, 255, 0.6);
      --hsm-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
    }

    #hyper-shell-manager-tip[data-hsm-theme="light"] {
      --hsm-tip-bg: rgba(255, 255, 255, 0.96);
      --hsm-tip-text: rgba(20, 22, 28, 0.9);
      --hsm-tip-border: rgba(0, 0, 0, 0.1);
    }

    @media (prefers-reduced-motion: reduce) {
      #hyper-shell-manager-switcher,
      #hyper-shell-manager-select,
      #hyper-shell-manager-select-arrow,
      #hyper-shell-manager-tip {
        transition: none !important;
      }
    }
  `;

  const box = doc.createElement("div");
  box.id = "hyper-shell-manager-switcher";
  box.dataset.hsmTheme = ui.theme;

  if (ui.label) {
    const label = doc.createElement("span");
    label.className = "hsm-label";
    label.textContent = ui.label;
    box.appendChild(label);
  }

  const selectWrap = doc.createElement("div");
  selectWrap.id = "hyper-shell-manager-select-wrap";

  const select = doc.createElement("select");
  select.id = "hyper-shell-manager-select";
  select.title = "Switch shell profile; effective for new tabs or windows";

  names.forEach((name) => {
    const option = doc.createElement("option");
    option.value = name;
    option.textContent = profiles[name].label || name;
    select.appendChild(option);
  });

  select.value = activeName;

  const arrow = doc.createElement("span");
  arrow.id = "hyper-shell-manager-select-arrow";

  const tip = doc.createElement("div");
  tip.id = "hyper-shell-manager-tip";
  tip.dataset.hsmTheme = ui.theme;

  let tipTimer = null;

  const openArrow = () => {
    selectWrap.classList.add("is-open");
  };

  const closeArrow = () => {
    selectWrap.classList.remove("is-open");
  };

  const onPointerDownSelect = () => {
    openArrow();
  };

  const onFocusSelect = () => {
    openArrow();
  };

  const onBlurSelect = () => {
    closeArrow();
  };

  const onKeyDownSelect = (event) => {
    if (event.key === "Escape" || event.key === "Tab") {
      closeArrow();
    }
  };

  const onPointerDownDocument = (event) => {
    if (!box.contains(event.target)) {
      closeArrow();
    }
  };

  const onChangeSelect = () => {
    const name = select.value;
    const profile = profiles[name];

    closeArrow();

    const ok = setActiveProfile(name);

    if (ok) {
      tip.textContent = `Switched to ${profile.label || name}, effective for new tabs/windows.`;
      tip.classList.add("show");

      if (tipTimer) {
        clearTimeout(tipTimer);
      }

      tipTimer = setTimeout(() => {
        tip.classList.remove("show");
        tipTimer = null;
      }, 1800);
    }
  };

  select.addEventListener("pointerdown", onPointerDownSelect);
  select.addEventListener("focus", onFocusSelect);
  select.addEventListener("blur", onBlurSelect);
  select.addEventListener("keydown", onKeyDownSelect);
  select.addEventListener("change", onChangeSelect);
  doc.addEventListener("pointerdown", onPointerDownDocument);

  selectWrap.appendChild(select);
  selectWrap.appendChild(arrow);

  box.appendChild(selectWrap);

  doc.head.appendChild(style);
  doc.body.appendChild(box);
  doc.body.appendChild(tip);

  win.__hyperShellManagerCleanup = () => {
    if (tipTimer) {
      clearTimeout(tipTimer);
      tipTimer = null;
    }

    select.removeEventListener("pointerdown", onPointerDownSelect);
    select.removeEventListener("focus", onFocusSelect);
    select.removeEventListener("blur", onBlurSelect);
    select.removeEventListener("keydown", onKeyDownSelect);
    select.removeEventListener("change", onChangeSelect);
    doc.removeEventListener("pointerdown", onPointerDownDocument);
    removeOldDom(doc);
  };

  log("DOM switcher injected");
}

function scheduleInjectSwitcher(win) {
  if (!win) {
    return;
  }

  const run = () => {
    try {
      injectSwitcher(win);
    } catch (error) {
      log("failed to inject switcher:", error);
    }
  };

  if (win.document && win.document.readyState === "loading") {
    win.document.addEventListener("DOMContentLoaded", run, { once: true });
    return;
  }

  setTimeout(run, 0);
}

function applyProfileToConfig(config) {
  const baseConfig = config || {};
  lastConfig = baseConfig;

  const { activeProfile } = getProfiles(baseConfig);

  if (!activeProfile) {
    return config;
  }

  return Object.assign({}, baseConfig, {
    shell: activeProfile.shell,
    shellArgs: activeProfile.shellArgs,
    env: Object.assign({}, baseConfig.env || {}, activeProfile.env || {}),
  });
}

exports.decorateConfig = (config) => applyProfileToConfig(config);

exports.decorateEnv = (env) => {
  const { activeProfile } = getProfiles();

  if (!activeProfile || !activeProfile.env) {
    return env;
  }

  return Object.assign({}, env || {}, activeProfile.env);
};

exports.onApp = (app) => {
  appRef = app;
};

exports.onRendererWindow = (win) => {
  scheduleInjectSwitcher(win);
};

exports.onWindow = (win) => {
  if (win && win.document) {
    scheduleInjectSwitcher(win);
  }
};
