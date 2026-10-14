/**
 * The static site shells. The Flash shell drives Ruffle's self-hosted build;
 * the Java shell drives the CheerpJ CDN loader. Both expose a small
 * `window.__wr` object so the verify step can read start state, frame count,
 * errors, and runtime warnings without guessing.
 */

export interface CreditsInfo {
  sourceUrl?: string | null;
  captureTimestamp?: string | null;
  runtimeName: string;
  runtimeVersion?: string | null;
  licenseNote?: string | null;
  extra?: string[];
}

export interface FlashShellOptions {
  title: string;
  swfFile: string;
  width: number;
  height: number;
  flashvars?: Record<string, string>;
  /** Relative path to the Ruffle self-hosted dir inside the site (holds ruffle.js). */
  rufflePath: string;
  credits: CreditsInfo;
}

export interface JavaShellOptions {
  title: string;
  width: number;
  height: number;
  loaderUrl: string;
  /** For an applet: the applet class and its jar(s). */
  appletClass?: string | null;
  jarFiles: string[];
  /** For a plain application: the Main-Class to run. */
  mainClass?: string | null;
  credits: CreditsInfo;
}

const COMMON_HEAD = `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />`;

const COMMON_STYLE = `
    :root { color-scheme: dark light; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 12px; padding: 16px;
      background: #0f1115; color: #e6e6e6;
      font: 14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    #wr-status { opacity: 0.85; min-height: 1.2em; }
    #wr-stage { outline: none; background: #000; border: 1px solid #222; max-width: 100vw; }
    #wr-stage:focus { border-color: #5b9dd9; }
    button.wr-btn {
      background: #1b2029; color: #e6e6e6; border: 1px solid #333a47;
      border-radius: 6px; padding: 6px 12px; cursor: pointer;
    }
    button.wr-btn:hover { background: #232a36; }
    #wr-error {
      display: none; max-width: 90vw; white-space: pre-wrap; padding: 12px 14px;
      border: 1px solid #5a1f1f; border-radius: 8px; background: #2a1414; color: #ffb4b4;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
    }
    #wr-credits {
      max-width: 640px; font-size: 12px; opacity: 0.8; text-align: center;
      border-top: 1px solid #222; padding-top: 10px; margin-top: 6px;
    }
    #wr-credits a { color: #7fb2e5; }`;

const WR_RUNTIME = `
    window.__wr = { started: false, frames: 0, errors: [], warnings: [], metadata: null };
    (function () {
      var raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = function (cb) {
        return raf(function (t) { window.__wr.frames++; return cb(t); });
      };
      var warn = console.warn.bind(console);
      console.warn = function () {
        var m = Array.prototype.join.call(arguments, " ");
        window.__wr.warnings.push(m);
        return warn.apply(null, arguments);
      };
    })();
    function wrError(msg) {
      window.__wr.errors.push(String(msg));
      var el = document.getElementById("wr-error");
      if (el) { el.style.display = "block"; el.textContent = (el.textContent ? el.textContent + "\\n" : "") + msg; }
    }
    function wrStatus(text) { var el = document.getElementById("wr-status"); if (el) el.textContent = text; }
    window.addEventListener("error", function (e) { wrError(e.message || "error"); });
    window.addEventListener("unhandledrejection", function (e) { wrError("promise: " + (e.reason && e.reason.message || e.reason)); });`;

export function flashShell(o: FlashShellOptions): string {
  const flashvars = JSON.stringify(o.flashvars ?? {});
  return `<!doctype html>
<html lang="en">
<head>${COMMON_HEAD}
  <title>${escapeHtml(o.title)}</title>
  <style>${COMMON_STYLE}
    #wr-stage { width: ${o.width}px; height: ${o.height}px; }
  </style>
</head>
<body>
  <div id="wr-status">Loading…</div>
  <div id="wr-stage" tabindex="0"></div>
  <button class="wr-btn" id="wr-fullscreen">Fullscreen</button>
  <pre id="wr-error"></pre>
  ${creditsHtml(o.credits)}
  <script>${WR_RUNTIME}
    window.RufflePlayer = window.RufflePlayer || {};
    var stage = document.getElementById("wr-stage");
    stage.addEventListener("click", function () { stage.focus(); });
    window.addEventListener("load", function () { stage.focus(); });
    window.addEventListener("DOMContentLoaded", function () {
      try {
        var ruffle = window.RufflePlayer.newest();
        var player = ruffle.createPlayer();
        player.style.width = "100%";
        player.style.height = "100%";
        stage.appendChild(player);
        player.addEventListener("loadedmetadata", function () {
          try { window.__wr.metadata = player.metadata; } catch (e) {}
          window.__wr.started = true;
          wrStatus("Running");
        });
        document.getElementById("wr-fullscreen").addEventListener("click", function () {
          if (player.requestFullscreen) player.requestFullscreen();
        });
        var core = player.ruffle ? player.ruffle() : player;
        core.load({ url: ${JSON.stringify(o.swfFile)}, parameters: ${flashvars}, autoplay: "on", unmuteOverlay: "hidden" })
          .then(function () { window.__wr.started = true; wrStatus("Running"); stage.focus(); })
          .catch(function (e) { wrError("Ruffle load failed: " + (e && e.message || e)); });
      } catch (e) {
        wrError("Ruffle could not start: " + (e && e.message || e));
      }
    });
  </script>
  <script src="${escapeHtml(o.rufflePath)}/ruffle.js"></script>
</body>
</html>
`;
}

export function javaShell(o: JavaShellOptions): string {
  const archive = o.jarFiles.map((f) => escapeHtml(f)).join(",");
  const appletTag = o.appletClass
    ? `<applet id="wr-applet" archive="${archive}" code="${escapeHtml(o.appletClass)}" width="${o.width}" height="${o.height}"></applet>`
    : "";
  const runApp = o.appletClass
    ? ""
    : `
      cheerpjCreateDisplay(${o.width}, ${o.height}, document.getElementById("wr-stage"));
      ${
        o.mainClass
          ? `cheerpjRunMain(${JSON.stringify(o.mainClass)}, ${JSON.stringify("/app/" + (o.jarFiles[0] ?? ""))});`
          : `cheerpjRunJar(${JSON.stringify("/app/" + (o.jarFiles[0] ?? ""))});`
      }`;
  return `<!doctype html>
<html lang="en">
<head>${COMMON_HEAD}
  <title>${escapeHtml(o.title)}</title>
  <script src="${escapeHtml(o.loaderUrl)}"></script>
  <style>${COMMON_STYLE}
    #wr-stage { width: ${o.width}px; height: ${o.height}px; }
  </style>
</head>
<body>
  <div id="wr-status">Loading…</div>
  <div id="wr-stage" tabindex="0">${appletTag}</div>
  <pre id="wr-error"></pre>
  ${creditsHtml(o.credits)}
  <script>${WR_RUNTIME}
    var stage = document.getElementById("wr-stage");
    stage.addEventListener("click", function () { stage.focus(); });
    // CheerpJ renders into a canvas once it is ready. Watch for it to call the game started.
    var poll = setInterval(function () {
      var c = document.querySelector("canvas");
      if (c) { window.__wr.started = true; window.__wr.metadata = { canvasWidth: c.width, canvasHeight: c.height }; wrStatus("Running"); clearInterval(poll); }
    }, 250);
    setTimeout(function () { clearInterval(poll); }, 45000);
    window.addEventListener("load", function () {
      try {
        cheerpjInit().then(function () {${runApp}
          wrStatus(window.__wr.started ? "Running" : "Started CheerpJ");
        }).catch(function (e) { wrError("cheerpjInit failed: " + (e && e.message || e)); });
      } catch (e) {
        wrError("CheerpJ could not start: " + (e && e.message || e));
      }
    });
  </script>
</body>
</html>
`;
}

function creditsHtml(c: CreditsInfo): string {
  const lines: string[] = [];
  if (c.sourceUrl) {
    lines.push(`Original: <a href="${escapeHtml(c.sourceUrl)}">${escapeHtml(c.sourceUrl)}</a>`);
  }
  if (c.captureTimestamp) lines.push(`Internet Archive capture: ${escapeHtml(c.captureTimestamp)}`);
  lines.push(`Runtime: ${escapeHtml(c.runtimeName)}${c.runtimeVersion ? " " + escapeHtml(c.runtimeVersion) : ""}`);
  if (c.licenseNote) lines.push(escapeHtml(c.licenseNote));
  for (const e of c.extra ?? []) lines.push(escapeHtml(e));
  return `<div id="wr-credits">${lines.join("<br/>")}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
