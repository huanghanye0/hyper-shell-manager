"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const PLUGIN_NAME = "hyper-shell-manager";
const CONFIG_KEY = "hyperShellManager";
const RELOAD_MARKER_PREFIX = "// hyper-shell-manager reload:";
const RPC_OPEN_PROFILE_TAB = `${PLUGIN_NAME}:open-profile-tab`;
const PENDING_SESSION_PROFILE_TTL_MS = 5000;

let appRef = null;
let lastConfig = null;
let pendingSessionProfiles = [];
let envProfileNameForSession = null;

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
    hotkey: typeof profile.hotkey === "string" ? profile.hotkey : "",
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


function isMacPlatform() {
  return process.platform === "darwin";
}

function normalizeHotkeyKey(key) {
  if (typeof key !== "string") {
    return "";
  }

  const normalized = key.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  const aliases = {
    " ": "space",
    spacebar: "space",
    space: "space",
    esc: "esc",
    escape: "esc",
    return: "enter",
    enter: "enter",
    plus: "+",
    add: "+",
    minus: "-",
    subtract: "-",
    dash: "-",
    arrowup: "up",
    up: "up",
    arrowdown: "down",
    down: "down",
    arrowleft: "left",
    left: "left",
    arrowright: "right",
    right: "right",
    del: "delete",
    delete: "delete",
  };

  if (/^[a-z]$/.test(normalized)) {
    return normalized;
  }

  if (/^key[a-z]$/.test(normalized)) {
    return normalized.slice(3);
  }


  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(normalized)) {
    return normalized;
  }

  return aliases[normalized] || "";
}

function isPrimaryModifierPart(part) {
  return (
    part === "ctrl" ||
    part === "control" ||
    part === "cmdorctrl" ||
    part === "commandorcontrol" ||
    (isMacPlatform() &&
      (part === "cmd" || part === "command" || part === "meta"))
  );
}

function isAltModifierPart(part) {
  return part === "alt" || part === "option" || part === "opt";
}

function isUnsupportedModifierPart(part) {
  return (
    part === "shift" ||
    part === "meta" ||
    part === "cmd" ||
    part === "command" ||
    part === "super" ||
    part === "win" ||
    part === "windows" ||
    part === "mod"
  );
}

function parseHotkey(hotkey) {
  if (typeof hotkey !== "string" || !hotkey.trim()) {
    return null;
  }

  const parts = hotkey
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .split("+")
    .filter(Boolean);

  let hasPrimaryModifier = false;
  let hasAltModifier = false;
  let hasAnyModifier = false;
  let key = "";

  for (const part of parts) {
    if (isPrimaryModifierPart(part)) {
      hasPrimaryModifier = true;
      hasAnyModifier = true;
      continue;
    }

    if (isAltModifierPart(part)) {
      hasAltModifier = true;
      hasAnyModifier = true;
      continue;
    }

    if (isUnsupportedModifierPart(part)) {
      return null;
    }

    const normalizedKey = normalizeHotkeyKey(part);

    if (!normalizedKey || !/^[a-z]$/.test(normalizedKey)) {
      return null;
    }

    key = normalizedKey;
  }

  if (!key) {
    return null;
  }

  // The plugin intentionally supports only Ctrl+Alt+<letter> as user-facing
  // syntax. On macOS this same config is matched as Cmd+Option+<letter>.
  // A bare letter like "p" is accepted as shorthand for that fixed combo.
  // Number keys such as Ctrl+Alt+1 are intentionally not supported.
  if (hasAnyModifier && (!hasPrimaryModifier || !hasAltModifier)) {
    return null;
  }

  return { key };
}

function formatHotkeyKeyLabel(key) {
  const normalized = normalizeHotkeyKey(key);

  if (!normalized) {
    return "";
  }

  const labels = {
    space: "Space",
    esc: "Esc",
    enter: "Enter",
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    delete: "Delete",
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(normalized)) {
    return normalized.toUpperCase();
  }

  if (/^[a-z]$/.test(normalized)) {
    return normalized.toUpperCase();
  }

  return normalized;
}

function formatHotkey(hotkey) {
  const parsed = parseHotkey(hotkey);

  if (!parsed) {
    return "";
  }

  const modifiers = isMacPlatform() ? ["Cmd", "Option"] : ["Ctrl", "Alt"];
  return [...modifiers, formatHotkeyKeyLabel(parsed.key)].join(" + ");
}

function getEventKey(event) {
  if (!event || typeof event.key !== "string") {
    return "";
  }

  return normalizeHotkeyKey(event.key);
}

function getEventCodeKey(event) {
  if (!event || typeof event.code !== "string") {
    return "";
  }

  return normalizeHotkeyKey(event.code);
}

function getEventLegacyKey(event) {
  if (!event) {
    return "";
  }

  const code = Number(event.which || event.keyCode || 0);

  if (code >= 65 && code <= 90) {
    return String.fromCharCode(code).toLowerCase();
  }

  return "";
}

function getEventKeyCandidates(event) {
  return [getEventKey(event), getEventCodeKey(event), getEventLegacyKey(event)]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function hotkeyMatchesEvent(hotkey, event) {
  const parsed = parseHotkey(hotkey);

  if (!parsed || !event || event.isComposing || event.repeat) {
    return false;
  }

  const primaryModifierDown = isMacPlatform()
    ? Boolean(event.metaKey) && !Boolean(event.ctrlKey)
    : Boolean(event.ctrlKey) && !Boolean(event.metaKey);

  if (!primaryModifierDown || !Boolean(event.altKey) || Boolean(event.shiftKey)) {
    return false;
  }

  return getEventKeyCandidates(event).includes(parsed.key);
}

function getHotkeyMap(config) {
  const managerConfig = getManagerConfig(config);
  const { profiles, names } = getProfiles(config);
  const hotkeys = {};

  names.forEach((name) => {
    if (profiles[name] && profiles[name].hotkey) {
      hotkeys[name] = profiles[name].hotkey;
    }
  });

  if (managerConfig.hotkeys && typeof managerConfig.hotkeys === "object") {
    Object.keys(managerConfig.hotkeys).forEach((name) => {
      const hotkey = managerConfig.hotkeys[name];

      if (profiles[name] && typeof hotkey === "string" && hotkey.trim()) {
        hotkeys[name] = hotkey;
      }
    });
  }

  return hotkeys;
}


function enqueuePendingSessionProfile(name) {
  const token = `${Date.now()}:${Math.random().toString(16).slice(2)}`;

  pendingSessionProfiles.push({
    token,
    name,
    expiresAt: Date.now() + PENDING_SESSION_PROFILE_TTL_MS,
  });

  return token;
}

function removePendingSessionProfile(token) {
  pendingSessionProfiles = pendingSessionProfiles.filter(
    (item) => item.token !== token,
  );
}

function consumePendingSessionProfile() {
  const now = Date.now();

  pendingSessionProfiles = pendingSessionProfiles.filter(
    (item) => item.expiresAt > now,
  );

  const item = pendingSessionProfiles.shift();
  return item ? item.name : null;
}

function openProfileInNewTab(win, name, activeUid) {
  const { profiles } = getProfiles();
  const profile = profiles[name];

  if (!profile) {
    log("unknown profile for new tab:", name);
    return false;
  }

  if (!win || !win.rpc || typeof win.rpc.emit !== "function") {
    log("window rpc unavailable, cannot open profile tab:", name);
    return false;
  }

  const token = enqueuePendingSessionProfile(name);

  try {
    const payload = activeUid ? { activeUid } : {};
    win.rpc.emit("termgroup add req", payload);
    log("new tab requested:", name, profile.shell);
    return true;
  } catch (error) {
    removePendingSessionProfile(token);
    log("failed to request new tab:", error);
    return false;
  }
}

function cleanupMainWindow(win) {
  if (!win || typeof win.__hyperShellManagerMainCleanup !== "function") {
    return;
  }

  try {
    win.__hyperShellManagerMainCleanup();
  } catch (_) {
    // ignore
  }

  win.__hyperShellManagerMainCleanup = null;
}

function registerWindowRpc(win) {
  if (!win || !win.rpc || typeof win.rpc.on !== "function") {
    return;
  }

  cleanupMainWindow(win);

  const onOpenProfileTab = (payload) => {
    const data = payload && typeof payload === "object" ? payload : {};
    const name = data.profile || data.name;

    if (typeof name !== "string" || !name) {
      log("missing profile name for new tab request");
      return;
    }

    openProfileInNewTab(win, name, data.activeUid);
  };

  win.rpc.on(RPC_OPEN_PROFILE_TAB, onOpenProfileTab);

  win.__hyperShellManagerMainCleanup = () => {
    if (win.rpc && typeof win.rpc.removeListener === "function") {
      win.rpc.removeListener(RPC_OPEN_PROFILE_TAB, onOpenProfileTab);
      return;
    }

    if (win.rpc && typeof win.rpc.off === "function") {
      win.rpc.off(RPC_OPEN_PROFILE_TAB, onOpenProfileTab);
    }
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
  const hotkeys = getHotkeyMap();

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
  select.title = "Switch default shell profile; hotkeys open a new tab with the matching shell";

  names.forEach((name) => {
    const option = doc.createElement("option");
    const hotkey = hotkeys[name];

    const label = profiles[name].label || name;
    const displayHotkey = formatHotkey(hotkey);

    option.value = name;
    option.textContent = displayHotkey ? `${label} · ${displayHotkey}` : label;

    if (hotkey) {
      option.title = displayHotkey ? `${label} (${displayHotkey})` : label;
    }

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

  const showTip = (message) => {
    tip.textContent = message;
    tip.classList.add("show");

    if (tipTimer) {
      clearTimeout(tipTimer);
    }

    tipTimer = setTimeout(() => {
      tip.classList.remove("show");
      tipTimer = null;
    }, 1800);
  };

  const switchToProfile = (name) => {
    const profile = profiles[name];

    if (!profile) {
      return;
    }

    closeArrow();

    if (select.value !== name) {
      select.value = name;
    }

    const ok = setActiveProfile(name);

    if (ok) {
      showTip(
        `Switched to ${profile.label || name}, effective for new tabs/windows.`,
      );
    }
  };

  const getActiveUid = () => {
    try {
      const store = win.store;
      const state = store && typeof store.getState === "function"
        ? store.getState()
        : null;
      const termGroups = state && state.termGroups;

      if (!termGroups) {
        return null;
      }

      if (typeof termGroups.get === "function") {
        const activeRootGroup = termGroups.get("activeRootGroup");
        const activeSessions = termGroups.get("activeSessions");

        return activeSessions && activeRootGroup
          ? activeSessions[activeRootGroup]
          : null;
      }

      return termGroups.activeSessions && termGroups.activeRootGroup
        ? termGroups.activeSessions[termGroups.activeRootGroup]
        : null;
    } catch (_) {
      return null;
    }
  };

  const requestNewTabForProfile = (name) => {
    const profile = profiles[name];

    if (!profile) {
      return;
    }

    closeArrow();

    if (win.rpc && typeof win.rpc.emit === "function") {
      win.rpc.emit(RPC_OPEN_PROFILE_TAB, {
        profile: name,
        activeUid: getActiveUid(),
      });

      showTip(`Opening new ${profile.label || name} tab (${formatHotkey(hotkeys[name]) || "hotkey"}).`);
      return;
    }

    showTip("Unable to open a profile tab: Hyper RPC is unavailable.");
  };

  const onChangeSelect = () => {
    switchToProfile(select.value);
  };

  const onKeyDownDocument = (event) => {
    if (!event || event.defaultPrevented) {
      return;
    }

    const entries = Object.keys(hotkeys);

    for (const name of entries) {
      if (hotkeyMatchesEvent(hotkeys[name], event)) {
        event.preventDefault();
        event.stopPropagation();
        requestNewTabForProfile(name);
        break;
      }
    }
  };

  select.addEventListener("pointerdown", onPointerDownSelect);
  select.addEventListener("focus", onFocusSelect);
  select.addEventListener("blur", onBlurSelect);
  select.addEventListener("keydown", onKeyDownSelect);
  select.addEventListener("change", onChangeSelect);
  doc.addEventListener("pointerdown", onPointerDownDocument);
  doc.addEventListener("keydown", onKeyDownDocument, true);

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
    doc.removeEventListener("keydown", onKeyDownDocument, true);
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

exports.decorateSessionClass = (Session) => {
  return class HyperShellManagerSession extends Session {
    constructor(options) {
      const profileName = consumePendingSessionProfile();
      const { profiles } = getProfiles();
      const profile = profileName ? profiles[profileName] : null;

      if (profile) {
        const nextOptions = Object.assign({}, options || {}, {
          shell: profile.shell,
          shellArgs: profile.shellArgs,
        });

        envProfileNameForSession = profileName;

        try {
          super(nextOptions);
        } finally {
          envProfileNameForSession = null;
        }

        this.hyperShellManagerProfile = profileName;
        return;
      }

      super(options);
    }
  };
};

exports.decorateConfig = (config) => applyProfileToConfig(config);

exports.decorateEnv = (env) => {
  if (envProfileNameForSession) {
    const { profiles } = getProfiles();
    const profile = profiles[envProfileNameForSession];

    if (profile && profile.env) {
      return Object.assign({}, env || {}, profile.env);
    }
  }

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
  registerWindowRpc(win);

  if (win && win.document) {
    scheduleInjectSwitcher(win);
  }
};
