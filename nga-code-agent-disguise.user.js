// ==UserScript==
// @name         NGA Code Agent Disguise
// @namespace    https://github.com/aromaw/nga-code-agent-disguise
// @version      4.1.3
// @description  Disguise NGA forum pages as a Claude Code / Codex CLI session. Backtick toggles outside text fields, /help lists commands, and reply/quote post through the site's own form after a confirm step.
// @author       aromaw
// @match        *://bbs.nga.cn/*
// @match        *://ngabbs.com/*
// @match        *://bbs.ngacn.cc/*
// @match        *://nga.178.com/*
// @updateURL    https://raw.githubusercontent.com/aromaw/nga-code-agent-disguise/main/nga-code-agent-disguise.user.js
// @downloadURL  https://raw.githubusercontent.com/aromaw/nga-code-agent-disguise/main/nga-code-agent-disguise.user.js
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    const TEST = typeof globalThis !== 'undefined' && !!globalThis.__CAD_TEST;
    const VERSION = '4.1.3';
    const POST_PREVIEW_LINES = 14;

    /* ================= settings ================= */
    const store = {
        get on()       { return GM_getValue('cad_on', true); },
        get style()    { return GM_getValue('cad_style', 'claude'); },
        get mode()     { return GM_getValue('cad_mode', 'dark'); },
        get img()      { return GM_getValue('cad_img', false); },
        get opOnly()   { return GM_getValue('cad_op_only', false); },
        get expand()   { return GM_getValue('cad_expand', false); },
        get vim()      { return GM_getValue('cad_vim', false); },
        get autopage() { return GM_getValue('cad_autopage', true); },
        get compact()  { return GM_getValue('cad_compact', false); },
        get toggleKey(){ return GM_getValue('cad_toggle', '`'); },
        set on(v)       { GM_setValue('cad_on', v); },
        set style(v)    { GM_setValue('cad_style', v); },
        set mode(v)     { GM_setValue('cad_mode', v); },
        set img(v)      { GM_setValue('cad_img', v); },
        set opOnly(v)   { GM_setValue('cad_op_only', v); },
        set expand(v)   { GM_setValue('cad_expand', v); },
        set vim(v)      { GM_setValue('cad_vim', v); },
        set autopage(v) { GM_setValue('cad_autopage', v); },
        set compact(v)  { GM_setValue('cad_compact', v); },
        set toggleKey(v){ GM_setValue('cad_toggle', v); },
    };

    const FAKE_DIR = '~/projects/api-server';
    const COVER_DIFF = [
        { kind: 'hunk', text: '@@ src/server.ts @@' },
        { kind: '', oldN: 1, newN: 1, text: "import { service } from './service';" },
        { kind: '', oldN: 2, newN: 2, text: "import { response } from './errors';" },
        { kind: '', oldN: 3, newN: 3, text: '' },
        { kind: 'hunk', text: '@@ handleRequest @@' },
        { kind: '', oldN: 41, newN: 41, text: 'export async function handleRequest(req: Request) {' },
        { kind: '', oldN: 42, newN: 42, text: '  const result = await service.run(req);' },
        { kind: 'del', oldN: 43, newN: '', text: '  return response.ok(result);' },
        { kind: 'add', oldN: '', newN: 43, text: '  if (!result.ok) return response.error(result.error);' },
        { kind: 'add', oldN: '', newN: 44, text: '  return response.ok(result);' },
        { kind: '', oldN: 44, newN: 45, text: '}' },
        { kind: '', oldN: 45, newN: 46, text: '' },
        { kind: 'hunk', text: '@@ supports @@' },
        { kind: '', oldN: 47, newN: 48, text: 'export function supports(method: string) {' },
        { kind: 'del', oldN: 48, newN: '', text: '  return method === "GET";' },
        { kind: 'add', oldN: '', newN: 49, text: '  return method === "GET" || method === "POST";' },
        { kind: '', oldN: 49, newN: 50, text: '}' },
    ];
    const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#0d0d0d"/><text x="50" y="70" font-size="62" text-anchor="middle" fill="#fff" font-family="monospace">›</text></svg>'
    );

    /* ================= styles ================= */
    const css = /* css */ `
    html.cad-on body > *:not(#cad__root) { display:none !important; }
    html.cad-on body { overflow:hidden !important; background:#0d0d0d; }
    html:not(.cad-on) #cad__root { display:none !important; }

    #cad__root { --radius:10px; }
    #cad__root.cad-claude.cad-dark {
        --bg:#21201e; --bg-input:#2b2a27; --bg-side:#181715; --bg-elev:#282724;
        --text:#eceae4; --dim:#a6a49d; --faint:#76746e;
        --accent:#d97757; --accent2:#e5947a; --border:rgba(255,250,240,.09); --border-strong:rgba(255,250,240,.17); --link:#e5947a;
        --bullet:#d97757; --green:#8ed898; --band:rgba(217,119,87,.12); --hover:rgba(255,250,240,.055);
        --card-bg:#262522; --user-bubble:#2e2d29; --quote-bg:#252421;
    }
    #cad__root.cad-claude.cad-light {
        --bg:#faf9f5; --bg-input:#ffffff; --bg-side:#f2f0e8; --bg-elev:#f4f2eb;
        --text:#1d1c1a; --dim:#5c5a54; --faint:#8a877f;
        --accent:#c96442; --accent2:#ae5132; --border:rgba(28,25,20,.09); --border-strong:rgba(28,25,20,.17); --link:#2d5f8a;
        --bullet:#c96442; --green:#22743c; --band:rgba(201,100,66,.10); --hover:rgba(28,25,20,.045);
        --card-bg:#f4f2eb; --user-bubble:#efede5; --quote-bg:#f4f2ea;
    }
    #cad__root.cad-codex.cad-dark {
        --bg:#0d0d0d; --bg-input:#171717; --bg-side:#111111; --bg-elev:#181818;
        --text:#ededed; --dim:#9e9e9e; --faint:#686868;
        --accent:#10a37f; --accent2:#3ee0b0; --border:rgba(255,255,255,.085); --border-strong:rgba(255,255,255,.16); --link:#3ee0b0;
        --bullet:#10a37f; --green:#3ee0b0; --band:rgba(16,163,127,.13); --hover:rgba(255,255,255,.05);
        --card-bg:#151515; --user-bubble:#1d1d1d; --quote-bg:#131313;
    }
    #cad__root.cad-codex.cad-light {
        --bg:#ffffff; --bg-input:#ffffff; --bg-side:#f7f7f8; --bg-elev:#f4f4f6;
        --text:#0d0d0d; --dim:#5d5d65; --faint:#8e8e96;
        --accent:#0b7a5e; --accent2:#0b7a5e; --border:rgba(0,0,0,.08); --border-strong:rgba(0,0,0,.15); --link:#0b7a5e;
        --bullet:#0b7a5e; --green:#0b7a5e; --band:rgba(11,122,94,.09); --hover:rgba(0,0,0,.04);
        --card-bg:#f7f7f8; --user-bubble:#f2f2f4; --quote-bg:#f7f7f8;
    }

    #cad__root {
        position:fixed; inset:0; z-index:2147483000;
        display:flex; flex-direction:column;
        background:var(--bg); color:var(--text);
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif;
        font-size:15px; line-height:1.68; letter-spacing:-0.005em;
        -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
    }
    #cad__root, #cad__root * { box-sizing:border-box; }
    #cad__root button { font:inherit; color:inherit; }
    #cad__root a:focus-visible, #cad__root button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    /* The shell is one column inside the fixed root, so the post list scrolls and the prompt stays put. */
    .cad-app { flex:1; min-height:0; display:flex; flex-direction:row; overflow:hidden; }
    .cad-main { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; background:var(--bg); }
    .cad-side { width:256px; flex-shrink:0; min-width:0; border-right:1px solid var(--border); background:var(--bg-side, var(--bg)); display:flex; flex-direction:column; min-height:0; overflow-x:hidden; overflow-y:auto; padding:12px 10px 14px; user-select:none; }
    .cad-side-top { display:flex; align-items:center; justify-content:space-between; padding:2px 6px 10px; }
    .cad-traffic { display:inline-flex; align-items:center; gap:7px; opacity:.8; }
    .cad-traffic i { width:11px; height:11px; border-radius:50%; display:block; }
    .cad-traffic i:nth-child(1) { background:#ff5f57; }
    .cad-traffic i:nth-child(2) { background:#febc2e; }
    .cad-traffic i:nth-child(3) { background:#28c840; }
    .cad-brand { font-weight:650; font-size:15px; padding:4px 8px 10px; color:var(--text); letter-spacing:-0.015em; display:flex; align-items:center; gap:8px; }
    .cad-brand-badge { font-size:11px; font-weight:600; padding:1px 6px; border-radius:999px; background:var(--band); color:var(--accent2); }
    .cad-newbtn { display:flex; align-items:center; gap:8px; width:100%; border:1px solid var(--border-strong); background:var(--bg-elev); color:var(--text); border-radius:9px; padding:7px 11px; margin:2px 0 6px; font-size:13px; font-weight:550; cursor:pointer; transition:background .12s, border-color .12s; }
    .cad-newbtn:hover { background:var(--hover); border-color:var(--accent); }
    .cad-newbtn .cad-kbd { margin-left:auto; font-size:11px; color:var(--faint); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .cad-claude .cad-newbtn { background:rgba(217,119,87,.12); border-color:rgba(217,119,87,.25); color:var(--accent2); }
    .cad-claude .cad-newbtn:hover { background:rgba(217,119,87,.2); border-color:var(--accent); }
    .cad-side-label { font-size:11px; letter-spacing:.05em; text-transform:uppercase; color:var(--faint); padding:14px 10px 5px; font-weight:650; }
    .cad-side a, .cad-side button.cad-sideitem { display:flex; align-items:center; gap:8px; width:100%; max-width:100%; text-align:left; border:0; background:transparent; color:var(--dim); border-radius:8px; padding:6px 10px; margin:1px 0; text-decoration:none; font-size:13.5px; transition:background .12s, color .12s; }
    .cad-side a span, .cad-side button.cad-sideitem span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cad-side a:hover, .cad-side button.cad-sideitem:hover { background:var(--hover); color:var(--text); }
    .cad-side .cad-onitem { background:var(--hover); color:var(--text); font-weight:600; }
    .cad-side-ico { width:14px; height:14px; flex-shrink:0; opacity:.72; }
    .cad-side-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; background:var(--faint); opacity:.65; }
    .cad-onitem .cad-side-dot { background:var(--accent); opacity:1; }
    .cad-side-foot { margin-top:auto; padding-top:10px; border-top:1px solid var(--border); display:flex; align-items:center; gap:9px; padding-left:6px; padding-right:6px; }
    .cad-avatar { width:26px; height:26px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:650; background:var(--band); color:var(--accent2); flex-shrink:0; }
    .cad-side-footmeta { min-width:0; flex:1; line-height:1.25; }
    .cad-side-footname { font-size:12.5px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cad-side-footsub { font-size:11px; color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cad-pill { border:1px solid var(--border); border-radius:999px; padding:2px 9px; font-size:12px; font-weight:500; color:var(--dim); background:var(--bg-elev); transition:all .12s; cursor:pointer; }
    .cad-pill:hover { border-color:var(--border-strong); color:var(--text); }
    .cad-crumb { font-size:13.5px; color:var(--text); font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cad-modal { margin:8px 0 12px; }
    .cad-modal-card { border:1px solid var(--border-strong); border-radius:14px; padding:14px 16px; background:var(--bg-input); color:var(--text); box-shadow:0 8px 28px rgba(0,0,0,.22); }
    #cad__root pre, #cad__root .cad-preview { background:transparent !important; color:var(--text) !important; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px; }
    #cad__root .cad-body { min-height:0; overflow-x:hidden; overscroll-behavior:contain; }

    .cad-topbar { flex-shrink:0; height:48px; display:flex; align-items:center; gap:8px; padding:0 18px; user-select:none; border-bottom:1px solid var(--border); background:var(--bg); }
    .cad-action { border:0; background:none; color:var(--dim); cursor:pointer; padding:3px 7px; border-radius:6px; transition:background .12s, color .12s; }
    .cad-action:hover { color:var(--text); background:var(--hover); }
    .cad-topbar .cad-action { font-size:12px; font-weight:500; display:inline-flex; align-items:center; gap:4px; }
    .cad-topbar-btn { border:1px solid var(--border); background:var(--bg-elev); border-radius:7px; padding:3px 9px !important; }
    .cad-topbar-btn:hover { border-color:var(--border-strong); }

    .cad-welcome {
        border:1px solid var(--border); border-radius:16px; background:var(--bg-elev);
        display:flex; gap:24px; padding:18px 22px; margin:4px 0 20px; align-items:center;
    }
    .cad-welcome .left { min-width:210px; display:flex; flex-direction:column; justify-content:center; gap:5px; }
    .cad-welcome .logo { font-size:17px; font-weight:650; display:flex; align-items:center; gap:9px; letter-spacing:-0.015em; }
    .cad-welcome .right { border-left:1px solid var(--border); padding-left:24px; color:var(--dim); font-size:13.5px; }
    .cad-welcome .sec { color:var(--accent2); font-weight:650; }
    .cad-welcome .dim { color:var(--faint); font-size:12.5px; }

    .cad-body { flex:1; overflow-y:auto; padding:8px 0 18px; scrollbar-width:thin; scrollbar-color:var(--border) transparent; }
    .cad-measure { max-width:110ch; margin:0 auto; padding:14px 28px 10px; }
    #cad__root ::selection { background:var(--accent); color:var(--bg); }
    .cad-trow { margin:2px -12px; padding:9px 14px; border-radius:10px; font-variant-numeric:tabular-nums; display:grid; grid-template-columns:34px 56px minmax(0,1fr); column-gap:4px; align-items:baseline; transition:background .12s; }
    .cad-trow:hover { background:var(--hover); }
    .cad-trow a.cad-tlink { color:var(--text); text-decoration:none; min-width:0; font-weight:500; }
    .cad-trow:hover a.cad-tlink { color:var(--accent2); }
    .cad-trow .cad-meta { grid-column:3; font-size:12.5px; color:var(--faint); margin-top:2px; }
    .cad-trep { display:inline-block; min-width:44px; text-align:center; padding:1px 7px; margin-right:10px; border-radius:999px; font-size:11.5px; font-weight:600; background:var(--bg-elev); border:1px solid var(--border); color:var(--dim); }
    .cad-sect { color:var(--accent2) !important; font-weight:600; font-size:12.5px; letter-spacing:.02em; text-transform:uppercase; }
    .cad-line { white-space:pre-wrap; word-break:break-word; }
    .cad-meta { color:var(--dim); font-size:13px; }
    .cad-dim { color:var(--dim); }
    .cad-faint { color:var(--faint); }
    .cad-img { display:block; max-width:min(480px, 100%); max-height:320px; border-radius:10px; margin:8px 0; border:1px solid var(--border); }
    .cad-imghide { display:none; }
    .cad-cmd { display:inline-flex; align-items:center; gap:8px; color:var(--dim); font-size:12.5px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; background:var(--bg-elev); border:1px solid var(--border); border-radius:8px; margin:4px 0 8px; padding:4px 11px; }
    .cad-topicnum { color:var(--faint); display:inline-block; min-width:34px; font-size:12px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
    .cad-pagelink { color:var(--link) !important; text-decoration:none !important; padding:0 3px; }
    .cad-pagelink:hover { text-decoration:underline !important; }
    .cad-op { background:var(--band); color:var(--accent2); border:1px solid rgba(217,119,87,.28); border-radius:999px; padding:0 7px; font-weight:650; font-size:11px; }
    .cad-codex .cad-op { border-color:rgba(16,163,127,.3); }
    .cad-ps1 { color:var(--accent2); }
    .cad-body::-webkit-scrollbar { width:8px; }
    .cad-body::-webkit-scrollbar-thumb { background:var(--border-strong); border-radius:4px; }
    .cad-title { font-size:22px; line-height:1.35; font-weight:680; margin:6px 0 4px; letter-spacing:-0.02em; }
    .cad-kicker { color:var(--faint); font-size:13px; margin-bottom:14px; }
    /* Desktop conversation turns: OP reads as user prompt bubble; replies read as Claude / Codex assistant turns */
    .cad-post { position:relative; margin:0 0 10px; padding:14px 16px; border-radius:14px; border:1px solid transparent; transition:background .12s, border-color .12s; }
    .cad-post-op { background:var(--user-bubble); border:1px solid var(--border); padding:16px 18px; margin:4px 0 16px; }
    .cad-claude .cad-post:not(.cad-post-op) { border-radius:0; border-bottom:1px solid var(--border); padding:14px 4px 16px; margin-bottom:4px; }
    .cad-codex .cad-post:not(.cad-post-op) { border-radius:0; border-left:2px solid var(--border); padding:10px 0 14px 18px; margin:0 0 10px 8px; }
    .cad-post .cad-posthead { display:flex; flex-wrap:wrap; align-items:center; gap:8px; color:var(--faint); font-size:13px; margin:0 0 8px; }
    .cad-post.cad-collapsed { cursor:pointer; }
    .cad-post.cad-collapsed:hover { background:var(--hover); }
    .cad-turn-ico { width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; font-size:11px; font-weight:650; }
    .cad-claude .cad-turn-ico-bot { background:rgba(217,119,87,.14); color:var(--accent); }
    .cad-codex .cad-turn-ico-bot { background:rgba(16,163,127,.14); color:var(--accent); }
    .cad-turn-ico-user { background:var(--bg-elev); border:1px solid var(--border-strong); color:var(--text); }
    .cad-floor { color:var(--dim); font-weight:600; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:11.5px; background:var(--bg-elev); border:1px solid var(--border); padding:0 6px; border-radius:5px; }
    .cad-author { color:var(--text); font-weight:600; padding:0 2px; }
    .cad-likes { color:var(--accent2); font-size:12px; font-weight:550; }
    .cad-post .cad-text { color:var(--text); line-height:1.7; }
    .cad-qline { color:var(--dim); white-space:pre-wrap; word-break:break-word; margin:8px 0 10px; padding:8px 12px; border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:8px; background:var(--quote-bg); font-size:13.5px; }
    .cad-codex .cad-qline { border-left:1px solid var(--border); border-radius:10px; padding:0; overflow:hidden; }
    .cad-codex .cad-qline > div:last-child { padding:8px 12px; }
    .cad-codex .cad-qhead { background:var(--hover); border-bottom:1px solid var(--border); padding:5px 12px; margin-bottom:0; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12px; color:var(--dim); }
    .cad-expand { display:inline-flex; width:auto; margin-top:10px; padding:4px 12px; border:1px solid var(--border); border-radius:999px; background:var(--bg-elev); font-size:12.5px; color:var(--dim); }
    .cad-expand:hover { border-color:var(--accent); color:var(--accent2); }
    .cad-blocktag { display:inline-flex; align-items:center; gap:6px; padding:2px 9px; border-radius:999px; font-weight:600; background:var(--bg-elev); border:1px solid var(--border); color:var(--dim); font-size:11.5px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; margin:8px 0 6px; }
    .cad-banner { border:1px solid var(--border); border-radius:14px; background:var(--bg-elev); padding:12px 16px; color:var(--dim); margin-bottom:14px; font-size:13px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
    .cad-banner b { color:var(--text); }
    .cad-hints { flex-shrink:0; display:flex; flex-wrap:wrap; gap:5px; align-items:center; width:100%; box-sizing:border-box; padding:4px max(28px, calc((100% - 110ch) / 2)) 4px; background:var(--bg); position:relative; z-index:3; }
    .cad-hint { border:1px solid var(--border); border-radius:999px; padding:1.5px 9px; font-size:11.5px; color:var(--faint); background:transparent; }
    .cad-hint:hover { border-color:var(--border-strong); color:var(--text); background:var(--hover); }
    .cad-inputbar {
        flex-shrink:0; position:relative; cursor:text;
        background:var(--bg);
        display:flex; flex-direction:column; align-items:stretch; color:var(--text);
        width:100%; box-sizing:border-box;
        padding:4px max(28px, calc((100% - 110ch) / 2)) 12px;
    }
    .cad-composer-box {
        background:var(--bg-input); border:1px solid var(--border-strong); border-radius:16px;
        box-shadow:0 4px 22px rgba(0,0,0,.18); transition:border-color .15s, box-shadow .15s;
        display:flex; flex-direction:column; overflow:hidden;
    }
    .cad-codex .cad-composer-box { border-radius:18px; }
    .cad-composer-box:focus-within {
        border-color:color-mix(in srgb, var(--accent) 60%, var(--border-strong));
        box-shadow:0 4px 26px rgba(0,0,0,.24);
    }
    .cad-real {
        width:100%; min-height:46px; max-height:180px; resize:vertical; background:transparent; color:var(--text);
        border:0; outline:none; font:inherit; font-size:14.5px; padding:13px 16px 6px; caret-color:var(--text);
    }
    .cad-composer-foot { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 10px 9px 14px; }
    .cad-composer-meta { display:flex; align-items:center; gap:8px; min-width:0; font-size:12px; color:var(--faint); }
    .cad-composer-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
    .cad-model-pill { display:inline-flex; align-items:center; gap:6px; border:0; background:var(--hover); color:var(--dim); border-radius:999px; padding:4px 10px; font-size:12px; font-weight:550; cursor:pointer; transition:background .12s, color .12s; }
    .cad-model-pill:hover { background:var(--band); color:var(--text); }
    .cad-send { display:inline-flex; align-items:center; justify-content:center; background:var(--accent); color:#fff; border:0; border-radius:9px; min-width:30px; height:30px; padding:0 10px; cursor:pointer; font-weight:600; font-size:12.5px; transition:opacity .12s, transform .1s; }
    .cad-codex .cad-send { border-radius:999px; background:var(--text); color:var(--bg); }
    .cad-send:hover { opacity:0.9; transform:scale(1.03); }
    .cad-send:active { transform:scale(0.97); }
    .cad-real::placeholder { color:var(--faint); opacity:0.75; }
    .cad-statusbar {
        flex-shrink:0; height:26px; display:flex; align-items:center; gap:8px;
        padding:0 16px; color:var(--faint); font-size:11.5px; user-select:none; overflow:hidden; white-space:nowrap;
        background:var(--bg-side, var(--bg)); border-top:1px solid var(--border);
    }
    .cad-statusbar .seg { color:var(--dim); }
    .cad-statusbar .seg.hi { color:var(--accent2); font-weight:550; }
    .cad-statusbar .sep { color:var(--faint); opacity:.55; }
    .cad-statusbar .grow { flex:1; }
    .cad-statusbar .cad-flag { padding:1px 5px; font-size:11.5px; }
    .cad-pagesep { color:var(--faint); margin:14px 0 6px; font-size:12px; display:flex; align-items:center; gap:10px; user-select:none; }
    .cad-pagesep::before, .cad-pagesep::after { content:''; flex:1; border-top:1px solid var(--border); }
    .cad-panel { max-height:min(62vh, 540px); overflow:auto; border:1px solid var(--border-strong); border-radius:14px; background:var(--bg-input); color:var(--text); padding:14px 16px; margin:0 0 14px; box-shadow:0 8px 28px rgba(0,0,0,.2); }
    .cad-panelhead { display:flex; justify-content:space-between; align-items:center; gap:12px; color:var(--accent2); font-weight:600; position:sticky; top:0; background:var(--bg-input); padding-bottom:6px; }
    .cad-compose { width:100%; min-height:7em; margin:8px 0; background:var(--bg-elev); color:inherit; border:1px solid var(--border-strong); border-radius:10px; font:inherit; padding:10px 12px; resize:vertical; }
    .cad-preview { white-space:pre-wrap; word-break:break-word; margin:8px 0; padding:10px 12px; border:1px dashed var(--border-strong); border-radius:8px; }
    /* cad-covered is on #cad__root. The cover is a full-viewport layer above the app chrome. */
    .cad-covered .cad-app, .cad-covered .cad-side, .cad-covered .cad-topbar, .cad-covered .cad-main,
    .cad-covered .cad-body, .cad-covered .cad-inputbar, .cad-covered .cad-statusbar, .cad-covered .cad-panel, .cad-covered .cad-hints { display:none !important; }
    .cad-statusline { margin-top:14px; padding:8px 12px; border:1px solid var(--border); border-radius:10px; background:var(--bg-elev); }
    .cad-statusline.cad-error { border-color:var(--accent); }
    .cad-qhead { color:var(--text); font-weight:600; font-size:13px; margin-bottom:4px; }
    .cad-slash { position:absolute; left: max(28px, calc((100% - 110ch) / 2)); right: max(28px, calc((100% - 110ch) / 2)); bottom: calc(100% + 4px); z-index: 6; background:var(--bg-input); color:var(--text); border:1px solid var(--border-strong); border-radius:14px; box-shadow:0 12px 40px rgba(0,0,0,.35); padding:6px; max-height:min(320px, 50vh); overflow-y:auto; overflow-x:hidden; }
    .cad-slash button, .cad-slash-item { display:flex; align-items:center; justify-content:space-between; width:100%; text-align:left; border:0; background:transparent; color:var(--text); border-radius:8px; padding:8px 12px; font-size:14px; cursor:pointer; }
    .cad-slash button:hover, .cad-slash-item:hover, .cad-slash-item.cad-slash-on, .cad-slash .cad-slash-on { background:var(--band); color:var(--text); }
    .cad-slash-cmd { font-weight:650; }
    .cad-slash-hint { color:var(--dim); font-size:12.5px; margin-left:12px; }
    .cad-cover { position:absolute; inset:0; z-index:40; display:flex; flex-direction:column; overflow:hidden; background:#0e0f11; color:#d7dbe0; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px; }
    .cad-cover-bar { flex-shrink:0; height:38px; display:flex; align-items:center; gap:8px; padding:0 12px; background:#16181c; border-bottom:1px solid #2a2e34; color:#9aa3ad; }
    .cad-cover-bar i { width:10px; height:10px; border-radius:50%; display:block; }
    .cad-cover-bar i:nth-child(1){background:#ff5f57;} .cad-cover-bar i:nth-child(2){background:#febc2e;} .cad-cover-bar i:nth-child(3){background:#28c840;}
    .cad-cover-bar-title { flex:1; text-align:center; font-size:12px; color:#c5ccd3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cad-cover-work { flex:1; min-height:0; display:flex; overflow:hidden; }
    .cad-cover-tree { width:200px; flex-shrink:0; background:#121417; border-right:1px solid #2a2e34; padding:12px 0; overflow:auto; color:#9aa3ad; }
    .cad-cover-tree .cad-cover-dir { padding:4px 14px; color:#7f8790; font-size:11px; letter-spacing:.04em; text-transform:uppercase; }
    .cad-cover-tree .cad-cover-file { padding:4px 18px; color:#c5ccd3; }
    .cad-cover-tree .cad-cover-file.cad-onitem { background:#1c3a4a; color:#dcefff; }
    .cad-cover-editor { flex:1; min-width:0; display:flex; flex-direction:column; background:#0e0f11; }
    .cad-cover-tabs { flex-shrink:0; display:flex; border-bottom:1px solid #2a2e34; background:#14161a; }
    .cad-cover-tab { padding:8px 14px; color:#8b939c; border-right:1px solid #2a2e34; }
    .cad-cover-tab.cad-onitem { color:#e8edf2; background:#0e0f11; }
    .cad-cover-diff { flex:1; overflow:auto; padding:8px 0 8px; }
    .cad-cover-foot { flex-shrink:0; height:28px; display:flex; align-items:center; padding:0 14px; background:#16181c; border-top:1px solid #2a2e34; color:#8b939c; font-size:11.5px; }
    .cad-cover-hunk { color:#8b939c; padding:8px 16px; }
    .cad-dline { display:grid; grid-template-columns:52px 52px 1fr; font-variant-numeric:tabular-nums; line-height:1.7; white-space:pre; }
    .cad-dline span:nth-child(1), .cad-dline span:nth-child(2) { text-align:right; padding:0 8px; color:#66707a; border-right:1px solid #2a2e34; }
    .cad-dline span:nth-child(3) { padding:0 14px; color:#d7dbe0; }
    .cad-dline.cad-del { background:rgba(200,60,60,.14); }
    .cad-dline.cad-del span:nth-child(3) { color:#ffb4b0; }
    .cad-dline.cad-add { background:rgba(46,160,90,.14); }
    .cad-dline.cad-add span:nth-child(3) { color:#b6f0c6; }
    .cad-idlebtn { color:var(--link); }
    @media (max-width:760px) {
        .cad-welcome .right { display:none; }
        .cad-welcome .left { min-width:0; }
        .cad-body { padding:4px 0 16px; }
        .cad-measure, .cad-hints, .cad-inputbar { padding-left:16px; padding-right:16px; }
        .cad-cmd { margin-left:-12px; margin-right:-12px; padding-left:12px; padding-right:12px; }
        .cad-trow { margin:0 -12px; padding:3px 12px; }
        .cad-inputbar, .cad-panel { padding-left:12px; padding-right:12px; }
        .cad-statusbar { padding:0 12px; }
        .cad-statusbar .cad-secondary { display:none; }
        .cad-img { max-width:100%; }
        .cad-topbar { padding:0 8px; }
    }
    `;

    let startupGuard = null;
    const injectStyle = () => {
        const add = () => {
            if (typeof GM_addStyle === 'function') GM_addStyle(css);
            else {
                const s = document.createElement('style');
                s.textContent = css;
                (document.head || document.documentElement).appendChild(s);
            }
        };
        if (document.head || document.documentElement) add();
        else {
            const obs = new MutationObserver(() => {
                if (document.head || document.documentElement) { obs.disconnect(); add(); }
            });
            obs.observe(document, { childList: true });
        }
    };
    injectStyle();

    // Hide the forum as soon as <html> exists. Main already waits for documentElement
    // before observing; this keeps that guard and still drops the class if boot never paints an input.
    const armEarlyHide = () => {
        if (!store.on || !document.documentElement) return;
        document.documentElement.classList.add('cad-on');
    };
    if (!TEST) {
        if (document.documentElement) armEarlyHide();
        else {
            const obs = new MutationObserver(() => {
                if (document.documentElement) { obs.disconnect(); armEarlyHide(); }
            });
            obs.observe(document, { childList: true });
        }
        if (store.on) {
            startupGuard = setTimeout(() => {
                if (!document.querySelector('#cad__root .cad-real') && document.documentElement)
                    document.documentElement.classList.remove('cad-on');
            }, 4000);
        }
    }

    const stripMetaRefresh = () => {
        const kill = () => document.querySelectorAll('meta[http-equiv="refresh" i]').forEach(m => m.remove());
        kill();
        if (document.readyState !== 'loading') return;
        const start = target => new MutationObserver((_, obs) => {
            kill();
            if (document.head) obs.disconnect();
        }).observe(target, { childList: true, subtree: true });
        if (document.documentElement) start(document.documentElement);
        else {
            const bootObs = new MutationObserver(() => {
                if (document.documentElement) { bootObs.disconnect(); start(document.documentElement); }
            });
            bootObs.observe(document, { childList: true });
        }
    };
    stripMetaRefresh();

    const vendored = (() => {
        const exports = {};
        const module = { exports };
        // Private CommonJS scope: do not publish preact/htm on the page and do not take the page AMD loader.
!function(n,l){"object"==typeof exports&&"undefined"!=typeof module?l(exports):"function"==typeof define&&define.amd?define(["exports"],l):l((n||self).preact={})}(this,function(n){var l,t,u,i,o,e,r,f,c,s,h,a,p=65536,v=1<<17,d={},y=[],w=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,_=Array.isArray;function g(n,l){for(var t in l)n[t]=l[t];return n}function b(n){n&&n.parentNode&&n.parentNode.removeChild(n)}function m(n,t,u){var i,o,e,r={};for(e in t)"key"==e?i=t[e]:"ref"==e?o=t[e]:r[e]=t[e];if(arguments.length>2&&(r.children=arguments.length>3?l.call(arguments,2):u),"function"==typeof n&&null!=n.defaultProps)for(e in n.defaultProps)void 0===r[e]&&(r[e]=n.defaultProps[e]);return k(n,r,i,o,null)}function k(n,l,i,o,e){var r={type:n,props:l,key:i,ref:o,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,constructor:void 0,__v:null==e?++u:e,__i:-1,__u:0};return null==e&&null!=t.vnode&&t.vnode(r),r}function x(n){return n.children}function S(n,l){this.props=n,this.context=l}function C(n,l){if(null==l)return n.__?C(n.__,n.__i+1):null;for(var t;l<n.__k.length;l++)if(null!=(t=n.__k[l])&&null!=t.__e)return t.__e;return"function"==typeof n.type?C(n):null}function M(n){var l,t;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(t=n.__k[l])&&null!=t.__e){n.__e=n.__c.base=t.__e;break}return M(n)}}function P(n){(!n.__d&&(n.__d=!0)&&o.push(n)&&!T.__r++||e!==t.debounceRendering)&&((e=t.debounceRendering)||r)(T)}function T(){var n,l,u,i,e,r,c,s;for(o.sort(f);n=o.shift();)n.__d&&(l=o.length,i=void 0,r=(e=(u=n).__v).__e,c=[],s=[],u.__P&&((i=g({},e)).__v=e.__v+1,t.vnode&&t.vnode(i),O(u.__P,i,e,u.__n,u.__P.namespaceURI,32&e.__u?[r]:null,c,null==r?C(e):r,!!(32&e.__u),s),i.__v=e.__v,i.__.__k[i.__i]=i,z(c,i,s),i.__e!=r&&M(i)),o.length>l&&o.sort(f));T.__r=0}function $(n,l,t,u,i,o,e,r,f,c,s){var h,a,v,w,_,g=u&&u.__k||y,b=l.length;for(t.__d=f,I(t,l,g),f=t.__d,h=0;h<b;h++)null!=(v=t.__k[h])&&(a=-1===v.__i?d:g[v.__i]||d,v.__i=h,O(n,v,a,i,o,e,r,f,c,s),w=v.__e,v.ref&&a.ref!=v.ref&&(a.ref&&V(a.ref,null,v),s.push(v.ref,v.__c||w,v)),null==_&&null!=w&&(_=w),v.__u&p||a.__k===v.__k?f=H(v,f,n):"function"==typeof v.type&&void 0!==v.__d?f=v.__d:w&&(f=w.nextSibling),v.__d=void 0,v.__u&=-196609);t.__d=f,t.__e=_}function I(n,l,t){var u,i,o,e,r,f=l.length,c=t.length,s=c,h=0;for(n.__k=[],u=0;u<f;u++)null!=(i=l[u])&&"boolean"!=typeof i&&"function"!=typeof i?(e=u+h,(i=n.__k[u]="string"==typeof i||"number"==typeof i||"bigint"==typeof i||i.constructor==String?k(null,i,null,null,null):_(i)?k(x,{children:i},null,null,null):void 0===i.constructor&&i.__b>0?k(i.type,i.props,i.key,i.ref?i.ref:null,i.__v):i).__=n,i.__b=n.__b+1,o=null,-1!==(r=i.__i=L(i,t,e,s))&&(s--,(o=t[r])&&(o.__u|=v)),null==o||null===o.__v?(-1==r&&h--,"function"!=typeof i.type&&(i.__u|=p)):r!==e&&(r==e-1?h--:r==e+1?h++:(r>e?h--:h++,i.__u|=p))):i=n.__k[u]=null;if(s)for(u=0;u<c;u++)null!=(o=t[u])&&0==(o.__u&v)&&(o.__e==n.__d&&(n.__d=C(o)),q(o,o))}function H(n,l,t){var u,i;if("function"==typeof n.type){for(u=n.__k,i=0;u&&i<u.length;i++)u[i]&&(u[i].__=n,l=H(u[i],l,t));return l}n.__e!=l&&(l&&n.type&&!t.contains(l)&&(l=C(n)),t.insertBefore(n.__e,l||null),l=n.__e);do{l=l&&l.nextSibling}while(null!=l&&8===l.nodeType);return l}function L(n,l,t,u){var i=n.key,o=n.type,e=t-1,r=t+1,f=l[t];if(null===f||f&&i==f.key&&o===f.type&&0==(f.__u&v))return t;if(u>(null!=f&&0==(f.__u&v)?1:0))for(;e>=0||r<l.length;){if(e>=0){if((f=l[e])&&0==(f.__u&v)&&i==f.key&&o===f.type)return e;e--}if(r<l.length){if((f=l[r])&&0==(f.__u&v)&&i==f.key&&o===f.type)return r;r++}}return-1}function j(n,l,t){"-"===l[0]?n.setProperty(l,null==t?"":t):n[l]=null==t?"":"number"!=typeof t||w.test(l)?t:t+"px"}function A(n,l,t,u,i){var o;n:if("style"===l)if("string"==typeof t)n.style.cssText=t;else{if("string"==typeof u&&(n.style.cssText=u=""),u)for(l in u)t&&l in t||j(n.style,l,"");if(t)for(l in t)u&&t[l]===u[l]||j(n.style,l,t[l])}else if("o"===l[0]&&"n"===l[1])o=l!==(l=l.replace(/(PointerCapture)$|Capture$/i,"$1")),l=l.toLowerCase()in n||"onFocusOut"===l||"onFocusIn"===l?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+o]=t,t?u?t.t=u.t:(t.t=c,n.addEventListener(l,o?h:s,o)):n.removeEventListener(l,o?h:s,o);else{if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==t?"":t;break n}catch(n){}"function"==typeof t||(null==t||!1===t&&"-"!==l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==t?"":t))}}function F(n){return function(l){if(this.l){var u=this.l[l.type+n];if(null==l.u)l.u=c++;else if(l.u<u.t)return;return u(t.event?t.event(l):l)}}}function O(n,l,u,i,o,e,r,f,c,s){var h,a,p,v,d,y,w,b,m,k,C,M,P,T,I,H,L=l.type;if(void 0!==l.constructor)return null;128&u.__u&&(c=!!(32&u.__u),e=[f=l.__e=u.__e]),(h=t.__b)&&h(l);n:if("function"==typeof L)try{if(b=l.props,m="prototype"in L&&L.prototype.render,k=(h=L.contextType)&&i[h.__c],C=h?k?k.props.value:h.__:i,u.__c?w=(a=l.__c=u.__c).__=a.__E:(m?l.__c=a=new L(b,C):(l.__c=a=new S(b,C),a.constructor=L,a.render=B),k&&k.sub(a),a.props=b,a.state||(a.state={}),a.context=C,a.__n=i,p=a.__d=!0,a.__h=[],a._sb=[]),m&&null==a.__s&&(a.__s=a.state),m&&null!=L.getDerivedStateFromProps&&(a.__s==a.state&&(a.__s=g({},a.__s)),g(a.__s,L.getDerivedStateFromProps(b,a.__s))),v=a.props,d=a.state,a.__v=l,p)m&&null==L.getDerivedStateFromProps&&null!=a.componentWillMount&&a.componentWillMount(),m&&null!=a.componentDidMount&&a.__h.push(a.componentDidMount);else{if(m&&null==L.getDerivedStateFromProps&&b!==v&&null!=a.componentWillReceiveProps&&a.componentWillReceiveProps(b,C),!a.__e&&(null!=a.shouldComponentUpdate&&!1===a.shouldComponentUpdate(b,a.__s,C)||l.__v===u.__v)){for(l.__v!==u.__v&&(a.props=b,a.state=a.__s,a.__d=!1),l.__e=u.__e,l.__k=u.__k,l.__k.some(function(n){n&&(n.__=l)}),M=0;M<a._sb.length;M++)a.__h.push(a._sb[M]);a._sb=[],a.__h.length&&r.push(a);break n}null!=a.componentWillUpdate&&a.componentWillUpdate(b,a.__s,C),m&&null!=a.componentDidUpdate&&a.__h.push(function(){a.componentDidUpdate(v,d,y)})}if(a.context=C,a.props=b,a.__P=n,a.__e=!1,P=t.__r,T=0,m){for(a.state=a.__s,a.__d=!1,P&&P(l),h=a.render(a.props,a.state,a.context),I=0;I<a._sb.length;I++)a.__h.push(a._sb[I]);a._sb=[]}else do{a.__d=!1,P&&P(l),h=a.render(a.props,a.state,a.context),a.state=a.__s}while(a.__d&&++T<25);a.state=a.__s,null!=a.getChildContext&&(i=g(g({},i),a.getChildContext())),m&&!p&&null!=a.getSnapshotBeforeUpdate&&(y=a.getSnapshotBeforeUpdate(v,d)),$(n,_(H=null!=h&&h.type===x&&null==h.key?h.props.children:h)?H:[H],l,u,i,o,e,r,f,c,s),a.base=l.__e,l.__u&=-161,a.__h.length&&r.push(a),w&&(a.__E=a.__=null)}catch(n){if(l.__v=null,c||null!=e){for(l.__u|=c?160:128;f&&8===f.nodeType&&f.nextSibling;)f=f.nextSibling;e[e.indexOf(f)]=null,l.__e=f}else l.__e=u.__e,l.__k=u.__k;t.__e(n,l,u)}else null==e&&l.__v===u.__v?(l.__k=u.__k,l.__e=u.__e):l.__e=N(u.__e,l,u,i,o,e,r,c,s);(h=t.diffed)&&h(l)}function z(n,l,u){l.__d=void 0;for(var i=0;i<u.length;i++)V(u[i],u[++i],u[++i]);t.__c&&t.__c(l,n),n.some(function(l){try{n=l.__h,l.__h=[],n.some(function(n){n.call(l)})}catch(n){t.__e(n,l.__v)}})}function N(n,u,i,o,e,r,f,c,s){var h,a,p,v,y,w,g,m=i.props,k=u.props,x=u.type;if("svg"===x?e="http://www.w3.org/2000/svg":"math"===x?e="http://www.w3.org/1998/Math/MathML":e||(e="http://www.w3.org/1999/xhtml"),null!=r)for(h=0;h<r.length;h++)if((y=r[h])&&"setAttribute"in y==!!x&&(x?y.localName===x:3===y.nodeType)){n=y,r[h]=null;break}if(null==n){if(null===x)return document.createTextNode(k);n=document.createElementNS(e,x,k.is&&k),c&&(t.__m&&t.__m(u,r),c=!1),r=null}if(null===x)m===k||c&&n.data===k||(n.data=k);else{if(r=r&&l.call(n.childNodes),m=i.props||d,!c&&null!=r)for(m={},h=0;h<n.attributes.length;h++)m[(y=n.attributes[h]).name]=y.value;for(h in m)if(y=m[h],"children"==h);else if("dangerouslySetInnerHTML"==h)p=y;else if(!(h in k)){if("value"==h&&"defaultValue"in k||"checked"==h&&"defaultChecked"in k)continue;A(n,h,null,y,e)}for(h in k)y=k[h],"children"==h?v=y:"dangerouslySetInnerHTML"==h?a=y:"value"==h?w=y:"checked"==h?g=y:c&&"function"!=typeof y||m[h]===y||A(n,h,y,m[h],e);if(a)c||p&&(a.__html===p.__html||a.__html===n.innerHTML)||(n.innerHTML=a.__html),u.__k=[];else if(p&&(n.innerHTML=""),$(n,_(v)?v:[v],u,i,o,"foreignObject"===x?"http://www.w3.org/1999/xhtml":e,r,f,r?r[0]:i.__k&&C(i,0),c,s),null!=r)for(h=r.length;h--;)b(r[h]);c||(h="value","progress"===x&&null==w?n.removeAttribute("value"):void 0!==w&&(w!==n[h]||"progress"===x&&!w||"option"===x&&w!==m[h])&&A(n,h,w,m[h],e),h="checked",void 0!==g&&g!==n[h]&&A(n,h,g,m[h],e))}return n}function V(n,l,u){try{if("function"==typeof n){var i="function"==typeof n.__u;i&&n.__u(),i&&null==l||(n.__u=n(l))}else n.current=l}catch(n){t.__e(n,u)}}function q(n,l,u){var i,o;if(t.unmount&&t.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||V(i,null,l)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(n){t.__e(n,l)}i.base=i.__P=null}if(i=n.__k)for(o=0;o<i.length;o++)i[o]&&q(i[o],l,u||"function"!=typeof n.type);u||b(n.__e),n.__c=n.__=n.__e=n.__d=void 0}function B(n,l,t){return this.constructor(n,t)}function D(n,u,i){var o,e,r,f;t.__&&t.__(n,u),e=(o="function"==typeof i)?null:i&&i.__k||u.__k,r=[],f=[],O(u,n=(!o&&i||u).__k=m(x,null,[n]),e||d,d,u.namespaceURI,!o&&i?[i]:e?null:u.firstChild?l.call(u.childNodes):null,r,!o&&i?i:e?e.__e:u.firstChild,o,f),z(r,n,f)}l=y.slice,t={__e:function(n,l,t,u){for(var i,o,e;l=l.__;)if((i=l.__c)&&!i.__)try{if((o=i.constructor)&&null!=o.getDerivedStateFromError&&(i.setState(o.getDerivedStateFromError(n)),e=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,u||{}),e=i.__d),e)return i.__E=i}catch(l){n=l}throw n}},u=0,i=function(n){return null!=n&&null==n.constructor},S.prototype.setState=function(n,l){var t;t=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=g({},this.state),"function"==typeof n&&(n=n(g({},t),this.props)),n&&g(t,n),null!=n&&this.__v&&(l&&this._sb.push(l),P(this))},S.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),P(this))},S.prototype.render=x,o=[],r="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,f=function(n,l){return n.__v.__b-l.__v.__b},T.__r=0,c=0,s=F(!1),h=F(!0),a=0,n.Component=S,n.Fragment=x,n.cloneElement=function(n,t,u){var i,o,e,r,f=g({},n.props);for(e in n.type&&n.type.defaultProps&&(r=n.type.defaultProps),t)"key"==e?i=t[e]:"ref"==e?o=t[e]:f[e]=void 0===t[e]&&void 0!==r?r[e]:t[e];return arguments.length>2&&(f.children=arguments.length>3?l.call(arguments,2):u),k(n.type,f,i||n.key,o||n.ref,null)},n.createContext=function(n,l){var t={__c:l="__cC"+a++,__:n,Consumer:function(n,l){return n.children(l)},Provider:function(n){var t,u;return this.getChildContext||(t=new Set,(u={})[l]=this,this.getChildContext=function(){return u},this.componentWillUnmount=function(){t=null},this.shouldComponentUpdate=function(n){this.props.value!==n.value&&t.forEach(function(n){n.__e=!0,P(n)})},this.sub=function(n){t.add(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){t&&t.delete(n),l&&l.call(n)}}),n.children}};return t.Provider.__=t.Consumer.contextType=t},n.createElement=m,n.createRef=function(){return{current:null}},n.h=m,n.hydrate=function n(l,t){D(l,t,n)},n.isValidElement=i,n.options=t,n.render=D,n.toChildArray=function n(l,t){return t=t||[],null==l||"boolean"==typeof l||(_(l)?l.some(function(l){n(l,t)}):t.push(l)),t}});
        const preact = module.exports;
        //# sourceMappingURL=preact.umd.js.map
        !function(n,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(n||self).htm=e()}(this,function(){var n=function(e,t,u,s){var r;t[0]=0;for(var p=1;p<t.length;p++){var h=t[p++],o=t[p]?(t[0]|=h?1:2,u[t[p++]]):t[++p];3===h?s[0]=o:4===h?s[1]=Object.assign(s[1]||{},o):5===h?(s[1]=s[1]||{})[t[++p]]=o:6===h?s[1][t[++p]]+=o+"":h?(r=e.apply(o,n(e,o,u,["",null])),s.push(r),o[0]?t[0]|=2:(t[p-2]=0,t[p]=r)):s.push(o)}return s},e=new Map;return function(t){var u=e.get(this);return u||(u=new Map,e.set(this,u)),(u=n(this,u.get(t)||(u.set(t,u=function(n){for(var e,t,u=1,s="",r="",p=[0],h=function(n){1===u&&(n||(s=s.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))?p.push(0,n,s):3===u&&(n||s)?(p.push(3,n,s),u=2):2===u&&"..."===s&&n?p.push(4,n,0):2===u&&s&&!n?p.push(5,0,!0,s):u>=5&&((s||!n&&5===u)&&(p.push(u,0,s,t),u=6),n&&(p.push(u,n,0,t),u=6)),s=""},o=0;o<n.length;o++){o&&(1===u&&h(),h(o));for(var f=0;f<n[o].length;f++)e=n[o][f],1===u?"<"===e?(h(),p=[p],u=3):s+=e:4===u?"--"===s&&">"===e?(u=1,s=""):s=e+s[0]:r?e===r?r="":s+=e:'"'===e||"'"===e?r=e:">"===e?(h(),u=1):u&&("="===e?(u=5,t=s,s=""):"/"===e&&(u<5||">"===n[o][f+1])?(h(),3===u&&(p=p[0]),u=p,(p=p[0]).push(2,0,u),u=0):" "===e||"\t"===e||"\n"===e||"\r"===e?(h(),u=2):s+=e),3===u&&"!--"===s&&(u=4,p=p[0])}return h(),p}(t)),u),arguments,[])).length>1?u:u[0]}});

        return { preact, htm: module.exports };
    })();

    /* ================= runtime ================= */
    let root, bodyEl;
    let inputEl = null;
    let lastSig = '';
    let lastData = null;
    let dataHref = '';
    let typed = '';
    let focused = false;
    let covered = false;
    let coverFocus = false;
    let gTs = 0;
    let autoPageLoading = false;
    let autoPageError = false;
    let nextPageUrl = null;
    let loadedPages = new Set();
    let opUidSticky = '';
    let opUidTid = '';
    let opNextNo = null;
    let opEnd = false;
    let locRenderTimer = null;
    let pageRequest = null;
    let sourceDirty = false;
    let sourceTimer = null;
    let pendingCount = '';
    let panel = null;
    let pendingReply = null;
    let composeText = '';
    let imeGuardUntil = 0;
    const expandedPosts = new Set();
    const revealedImages = new Set();
    const cmdHistory = [];
    let histIdx = -1;
    let slashIndex = 0;
    let suppressToggleChar = false;
    let openedAt = 0;
    const locMap = {};
    let boards = GM_getValue('cad_boards', []);
    let savedThreads = GM_getValue('cad_threads', []);
    const locCache = GM_getValue('cad_loc_cache', {});
    const nameCache = GM_getValue('cad_name_cache', {});
    const nameSources = Object.create(null);
    const FAVOR_CACHE_VER = 2;
    function titleLooksGarbled(t) {
        const s = String(t || '');
        if (!s) return false;
        // UTF-8 decode of GBK Chinese leaves U+FFFD, and 录 (GBK C2 BC) becomes U+00BC (¼).
        if (/\uFFFD/.test(s)) return true;
        if (/\u00BC/.test(s) && !/[\u4e00-\u9fff]/.test(s)) return true;
        return false;
    }
    function favorTopicsOk(topics) {
        return Array.isArray(topics) && !topics.some(t => t && titleLooksGarbled(t.title));
    }
    function readFavorCache() {
        const raw = GM_getValue('cad_fav_cache', null);
        if (!raw || typeof raw !== 'object') return { at: 0, topics: [], v: FAVOR_CACHE_VER };
        const topics = Array.isArray(raw.topics) ? raw.topics : [];
        if (!favorTopicsOk(topics)) return { at: 0, topics: [], v: FAVOR_CACHE_VER };
        return { at: raw.at || 0, topics, v: raw.v || FAVOR_CACHE_VER };
    }
    let favorCache = readFavorCache();
    let favorPending = false;
    let realTitle = '';
    let origIcon = null;
    let lastHref = '';

    /* ================= text and keys ================= */
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const line = (s, cls) => `<div class="cad-line${cls ? ' ' + cls : ''}">${s}</div>`;
    const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

    function noteCompositionEnd() { imeGuardUntil = Date.now() + 120; }

    // IME composition reports keyCode 229 / isComposing. A following Enter can also
    // arrive just after compositionend and would otherwise run the command or toggle.
    function isImeArtifact(e) {
        if (!e) return false;
        if (e.isComposing || e.keyCode === 229) return true;
        if (Date.now() >= imeGuardUntil) return false;
        return e.key === 'Enter' || e.key === '`' || e.code === 'Backquote';
    }

    function parseToggleSpec(spec) {
        const mods = { ctrl: false, alt: false, shift: false, meta: false };
        let key = '';
        String(spec || '').toLowerCase().split('+').map(s => s.trim()).filter(Boolean).forEach(part => {
            if (part === 'ctrl' || part === 'control') mods.ctrl = true;
            else if (part === 'alt' || part === 'option') mods.alt = true;
            else if (part === 'shift') mods.shift = true;
            else if (part === 'meta' || part === 'cmd' || part === 'command') mods.meta = true;
            else key = part;
        });
        return { mods, key };
    }

    function isToggleEvent(e) {
        if (!e || isImeArtifact(e)) return false;
        const spec = parseToggleSpec(store.toggleKey || '`');
        if (!spec.key) return false;
        if (!!e.ctrlKey !== spec.mods.ctrl) return false;
        if (!!e.altKey !== spec.mods.alt) return false;
        if (!!e.metaKey !== spec.mods.meta) return false;
        if (spec.mods.shift && !e.shiftKey) return false;
        if (spec.key === '`' || spec.key === 'backquote') {
            if (e.shiftKey) return false;
            if (e.key === '`') return true;
            // Layouts that have not produced a character yet. Never the IME "Process" key.
            return e.code === 'Backquote' && (e.key === 'Unidentified' || e.key === 'Dead');
        }
        return String(e.key || '').toLowerCase() === spec.key;
    }

    function isEditableTarget(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el.isContentEditable) return true;
        const attr = el.getAttribute && el.getAttribute('contenteditable');
        if (attr != null && /^(true|plaintext-only)?$/i.test(attr)) return true;
        const tag = el.tagName;
        if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (tag === 'INPUT') {
            const type = (el.type || 'text').toLowerCase();
            return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'range', 'color'].includes(type);
        }
        return !!(el.closest && el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'));
    }

    function normalizeCommand(raw) {
        let cmd = String(raw || '').trim().replace(/^:\s*/, '');
        cmd = cmd.replace(/^\/+/, '');
        return cmd.trim();
    }

    /* ================= page identity ================= */
    function fidFromHref(href) {
        const m = String(href || '').match(/[?&]fid=(-?\d+)/i);
        return m ? m[1] : '';
    }

    function pageFid(doc) {
        doc = doc || document;
        // A DOMParser document inherits the live page URL as baseURI, so only the live
        // document may take its fid from the address bar. Other documents use their own fields.
        if (doc === document) {
            const fromUrl = fidFromHref(location.href);
            if (fromUrl) return fromUrl;
        }
        const hidden = doc.querySelector('input[name="fid"]');
        if (hidden && /^-?\d+$/.test(hidden.value || '')) return hidden.value;
        const nav = [...doc.querySelectorAll('#m_nav a[href*="fid="], a.nav_link[href*="fid="], .nav_link[href*="fid="], #breadcrumbs a[href*="fid="], .crumbs a[href*="fid="]')];
        for (let i = nav.length - 1; i >= 0; i--) {
            const fid = fidFromHref(nav[i].getAttribute('href'));
            if (fid) return fid;
        }
        const any = [...doc.querySelectorAll('a[href*="fid="]')];
        for (let i = any.length - 1; i >= 0; i--) {
            const fid = fidFromHref(any[i].getAttribute('href'));
            if (fid) return fid;
        }
        return '';
    }

    function tidyName(s) {
        let t = String(s || '').replace(/\u00a0/g, ' ').replace(/[\u200b\u200c\u200d]/g, '').replace(/\s+/g, ' ').trim();
        // NGA sometimes letter-spaces a board name with regular spaces or nbsp ("网 事 杂 谈").
        if (/^([\u4e00-\u9fff]\s+)+[\u4e00-\u9fff]$/.test(t)) t = t.replace(/\s+/g, '');
        return t;
    }

    function pageBoardName(doc) {
        doc = doc || document;
        const fid = pageFid(doc);
        if (!fid) return '';
        const bad = /^(后页|前页|发表新帖|精华区|下一页|上一页|首页|尾页|[\d\s.]+)$/;
        const links = [...doc.querySelectorAll('#m_nav a[href*="fid="], .nav_link[href*="fid="], #breadcrumbs a[href*="fid="], .crumbs a[href*="fid="], a[href*="fid="]')];
        const named = links.filter(a => {
            if (fidFromHref(a.getAttribute('href')) !== fid) return false;
            const n = tidyName(a.textContent);
            return n && !bad.test(n) && !/recommend=|order_by=|page=/.test(a.getAttribute('href') || '');
        });
        const hit = named.find(a => a.closest && a.closest('#m_nav, .nav, #breadcrumbs, .crumbs')) || named[named.length - 1] || named[0];
        return hit ? tidyName(hit.textContent) : '';
    }

    function curTid() {
        return (location.href.match(/tid=(\d+)/) || [])[1] || '';
    }

    function curPageNo() {
        try { return Math.max(1, parseInt(new URL(location.href).searchParams.get('page') || '1', 10) || 1); }
        catch (err) { return 1; }
    }

    function cwdFor(data) {
        if (store.compact) return FAKE_DIR;
        if (data && data.kind === 'posts') return '~/threads/' + (curTid() || 'latest');
        if (data && data.kind === 'topics') return '~/boards/' + String(data.board || 'board').replace(/\s+/g, '-');
        return '~';
    }

    function pageLabel() {
        const cur = curPageNo();
        const pager = (lastData && lastData.pager) || [];
        const nums = pager.map(p => parseInt(p.t, 10)).filter(n => Number.isFinite(n) && n > 0);
        const max = nums.length ? Math.max.apply(null, nums) : 0;
        const list = (lastData && (lastData.posts || lastData.topics)) || [];
        const extra = list.filter(x => x.sep).length;
        return 'page ' + cur + (max >= cur ? ' of ' + max : '') + (extra ? ' +' + extra : '');
    }

    function currentUser() {
        // Header-only. A thread is full of profile links, and the first one is not the viewer.
        const sels = ['#user_name', '#nickname', 'a.userlink', '#ngainfobar a[href*="func=ucp"]', '#header a[href*="func=ucp"]'];
        for (const sel of sels) {
            const name = tidyName(text(document.querySelector(sel)));
            if (!name) continue;
            // NGA's logged-out header uses these labels.
            if (/^(\u767b\u5f55|\u767b\u5165|login|sign in)$/i.test(name)) continue;
            if (isUidLabel(name)) continue;
            return name;
        }
        return '';
    }

    /* ================= extract ================= */
    function isEmote(img) {
        return /smile|emoji/i.test((img.getAttribute('src') || '') + ' ' + (img.className || ''));
    }

    function absImg(u) {
        let raw = String(u || '').trim();
        if (!raw) return '';
        if (/^(?:about:blank|data:image\/gif)|loading|spacer|placeholder/i.test(raw) && !/\.(jpe?g|png|gif|webp|bmp)/i.test(raw)) return '';
        if (/^(?:about:blank)$/i.test(raw)) return '';
        raw = raw.replace(/^\.\//, '');
        if (/^https?:\/\//i.test(raw)) return raw;
        if (raw.startsWith('//')) return (location.protocol || 'https:') + raw;
        if (/^(?:mon_|attachments\/|\d{4}\/)/i.test(raw) || (/\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(raw) && !raw.startsWith('/') && raw.indexOf('://') < 0)) {
            return 'https://img.nga.cn/attachments/' + raw.replace(/^\/+/, '');
        }
        try { return new URL(raw, (location.href || 'https://bbs.nga.cn/')).href; } catch (err) { return raw; }
    }

    function imgSrc(img) {
        if (!img || !img.getAttribute) return { main: '', alt: '' };
        const attrs = ['data-srclazy', 'data-srcorg', 'data-apporg', 'data-original', 'data-src', 'data-lazy-src', 'data-src-lazy', 'src'];
        let main = '';
        for (const a of attrs) {
            const v = absImg(img.getAttribute(a));
            if (v && !/about:blank/i.test(v)) { main = v; break; }
        }
        const link = img.closest && img.closest('a');
        const href = link && (link.getAttribute('href') || link.href) || '';
        const alt = /\.(jpe?g|png|gif|webp|bmp)/i.test(href) ? absImg(href) : '';
        return { main: main || alt, alt: alt && alt !== main ? alt : '' };
    }

    function stripQuoteHeader(s) {
        let t = String(s || '').split(String.fromCharCode(0x200b)).join('').replace(/^\s+/, '');
        t = t.replace(/^(?:Reply\s+to\s*)?(?:\+?\s*R\s+)?by\s*(?:\[[^\]]*\]|\S+)?\s*(?:\([^)]*\))?\s*/i, '');
        t = t.replace(/^(?:Reply\s+to\s+)?(?:\+R\s+by|Reply(?:\s+to)?(?:\s+\+R\s+by)?|Post\s+by)[^\n]*/gim, '');
        t = t.replace(/\bundefined\b/gi, '');
        t = t.replace(/^\(\s*\)\s*/, '');
        t = t.replace(/^(?:\[[^\]]*\]\s*)?\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*/, '');
        return t;
    }

    function cleanText(s) {
        const lines = String(s || '').split(String.fromCharCode(0x200b)).join('').split('\n').map(l => l.trimEnd());
        const invis = /^\s*$/;
        while (lines.length && invis.test(lines[0])) lines.shift();
        while (lines.length && invis.test(lines[lines.length - 1])) lines.pop();
        if (lines.length) lines[0] = lines[0].replace(/^[ \t\u3000]+/, '');
        return lines.join('\n').replace(/\n{3,}/g, '\n\n');
    }

    // innerText drops <br> on display:none pages and on DOMParser documents.
    // Walk the tree so breaks and block boundaries stay, and indentation in <pre> stays.
    const BLOCK_RE = /^(P|DIV|LI|TR|TABLE|BLOCKQUOTE|H[1-6]|UL|OL|PRE|SECTION|ARTICLE|HR)$/;
    function plainText(node) {
        const walk = n => {
            if (!n) return '';
            if (n.nodeType === 3) return n.nodeValue || '';
            if (n.nodeType !== 1) return '';
            const tag = n.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE') return '';
            if (tag === 'BR') return '\n';
            const inner = [...n.childNodes].map(walk).join('');
            return BLOCK_RE.test(tag) ? '\n' + inner + '\n' : inner;
        };
        return walk(node);
    }

    function contentText(node) {
        if (!node) return { text: '', imgs: [] };
        const clone = node.cloneNode(true);
        clone.querySelectorAll('.quote').forEach(q => q.remove());
        stripInlineReplyChrome(clone);
        const imgs = [];
        clone.querySelectorAll('img').forEach(i => {
            if (isEmote(i)) {
                const alt = i.getAttribute('alt');
                i.replaceWith(alt ? '[' + alt + ']' : '');
                return;
            }
            const o = imgSrc(i);
            if (!o.main) { i.remove(); return; }
            imgs.push(o);
            i.replaceWith('%%IMG' + (imgs.length - 1) + '%%');
        });
        clone.querySelectorAll('script,style,button,.recommendvalue,.ogoodbtn,.postBtnPos,.postinfo,.single_ttip2,.postbtnsc,.right_').forEach(i => i.remove());
        let raw = plainText(clone);
        raw = raw.replace(/\[img\]\s*([^\[\]]+?)\s*\[\/img\]/gi, (_, u) => {
            const url = absImg(String(u).trim());
            if (!url) return '';
            if (imgs.some(o => o.main === url)) {
                return '%%IMG' + imgs.findIndex(o => o.main === url) + '%%';
            }
            imgs.push({ main: url, alt: '' });
            return '%%IMG' + (imgs.length - 1) + '%%';
        });
        return { text: cleanText(stripQuoteHeader(raw)), imgs };
    }

    function cleanTitle(t) {
        let s = tidyName(t);
        const filtered = s.match(/\u5728\s*(.*?)\s*\u4e2d\u7684\u56de\u590d/);
        if (filtered && filtered[1]) s = filtered[1];
        return s.replace(/[\s\-_]*(\u004eGA\u73a9\u5bb6\u793e\u533a|\u827e\u6cfd\u62c9\u65af\u56fd\u5bb6\u5730\u7406\u8bba\u575b|NGA)\s*$/i, '').replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();
    }

    function isUidLabel(s) {
        return /^(UID\s*[:：]?\s*)?\d+$/i.test(String(s || '').trim());
    }

    function cleanAuthorName(s) {
        return tidyName(String(s || '')
            .replace(/\u697c\u4e3b/g, '')
            .replace(/^\[+|\]+$/g, '')
            .replace(/^['"`]+|['"`]+$/g, ''));
    }

    function isJunkTopicTitle(t) {
        return /\u5e16\u5b50\u53d1\u5e03\u6216\u56de\u590d\u65f6\u95f4\u8d85\u8fc7\u9650\u5236/.test(String(t || ''));
    }

    function unquoteJsArg(s) {
        s = String(s || '').trim();
        if (!s || s === 'null' || s === 'undefined') return '';
        const dol = s.match(/^\$\(\s*(['"])(.*?)\1\s*\)$/);
        if (dol) return dol[2];
        if ((s.charAt(0) === "'" && s.charAt(s.length - 1) === "'") || (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"')) {
            return s.slice(1, -1);
        }
        return s;
    }

    function splitJsArgs(src) {
        const parts = [];
        let cur = '';
        let depth = 0;
        let inStr = false;
        let quote = '';
        let esc = false;
        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (inStr) {
                cur += c;
                if (esc) esc = false;
                else if (c === '\\') esc = true;
                else if (c === quote) inStr = false;
            } else if (c === '"' || c === "'") {
                inStr = true;
                quote = c;
                cur += c;
            } else if (c === '(' || c === '[' || c === '{') {
                depth++;
                cur += c;
            } else if (c === ')' || c === ']' || c === '}') {
                depth--;
                cur += c;
            } else if (c === ',' && depth === 0) {
                parts.push(cur.trim());
                cur = '';
            } else cur += c;
        }
        if (cur.trim()) parts.push(cur.trim());
        return parts.map(unquoteJsArg);
    }

    function formatUnix(ts) {
        const n = parseInt(ts, 10);
        if (!Number.isFinite(n) || n < 1e9) return '';
        const d = new Date(n * 1000);
        if (isNaN(d.getTime())) return '';
        const p = x => String(x).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    function scriptTexts(doc) {
        return [...(doc || document).querySelectorAll('script')].map(s => s.textContent || '').filter(Boolean);
    }

    function parseTopicArgs(doc) {
        doc = doc || document;
        const out = [];
        const re = /commonui\.topicArg\.add\s*\(/g;
        for (const src of scriptTexts(doc)) {
            let m;
            while ((m = re.exec(src))) {
                let depth = 1;
                let inStr = false;
                let quote = '';
                let esc = false;
                const start = m.end ? m.end() : (m.index + m[0].length);
                // m.end is not standard; use index + length
                const from = m.index + m[0].length;
                let end = from;
                for (let i = from; i < src.length; i++) {
                    const c = src[i];
                    if (inStr) {
                        if (esc) esc = false;
                        else if (c === '\\') esc = true;
                        else if (c === quote) inStr = false;
                    } else if (c === '"' || c === "'") {
                        inStr = true;
                        quote = c;
                    } else if (c === '(') depth++;
                    else if (c === ')') {
                        depth--;
                        if (depth === 0) { end = i; break; }
                    }
                }
                const args = splitJsArgs(src.slice(from, end));
                if (args.length < 15) continue;
                const idReplies = args[0];
                const idTopic = args[1];
                const idAuthor = args[2];
                const idPostTime = args[3];
                const idReplier = args[4];
                const idReplyTime = args[5];
                out.push({
                    idReplies, idTopic, idAuthor, idPostTime, idReplier, idReplyTime,
                    fid: args[7],
                    tid: String(args[8] || '').replace(/\D+/g, ''),
                    pid: args[9],
                    postdate: formatUnix(args[12]),
                    lastpost: formatUnix(args[13]),
                    replies: String(parseInt(args[14], 10) || 0),
                    postTs: args[12],
                    lastTs: args[13],
                });
            }
        }
        return out;
    }

    function extractJsCallArgs(src, fn) {
        const out = [];
        const needle = fn;
        let idx = 0;
        while ((idx = src.indexOf(needle, idx)) >= 0) {
            const rest = src.slice(idx + needle.length);
            const wm = rest.match(/^\s*\(/);
            // Only real calls: "(" must follow the name, not ".forEach(" in this script.
            if (!wm) { idx += needle.length; continue; }
            const open = idx + needle.length + wm[0].length - 1;
            let depth = 1, inStr = false, quote = '', esc = false, end = open + 1;
            for (let i = open + 1; i < src.length; i++) {
                const c = src[i];
                if (inStr) {
                    if (esc) esc = false;
                    else if (c === '\\') esc = true;
                    else if (c === quote) inStr = false;
                } else if (c === '"' || c === "'") { inStr = true; quote = c; }
                else if (c === '(' || c === '[' || c === '{') depth++;
                else if (c === ')' || c === ']' || c === '}') {
                    depth--;
                    if (depth === 0) { end = i; break; }
                }
            }
            out.push(splitJsArgs(src.slice(open + 1, end)));
            idx = end + 1;
        }
        return out;
    }

    function parsePostArgs(doc) {
        doc = doc || document;
        const byFloor = Object.create(null);
        let topicAuthor = '';
        let topicTid = '';
        let topicReplies = '';
        for (const src of scriptTexts(doc)) {
            extractJsCallArgs(src, 'commonui.postArg.setDefault').forEach(args => {
                // fid, stid, tid, tAid, ... tReplies at [11] or nearby
                if (args.length < 4) return;
                const tid = String(args[2] || '').replace(/\D+/g, '');
                const aid = String(args[3] || '').replace(/\D+/g, '');
                if (tid) topicTid = tid;
                if (aid) topicAuthor = aid;
                if (args.length > 11 && args[11] != null) {
                    const n = parseInt(String(args[11]).replace(/[\D-]+/g, ''), 10);
                    if (Number.isFinite(n) && n >= 0) topicReplies = String(n);
                }
            });
            extractJsCallArgs(src, 'commonui.postArg.proc').forEach(args => {
                // 0 i, 1-7 nodes, 8 fid, 9 tid, 10 pid, 11 type, 12 tAid, 13 pAid, 14 postTime, 15 recommend
                const floor = parseInt(String(args[0] || '').trim(), 10);
                if (!Number.isFinite(floor) || floor < 0 || floor > 999999 || args.length < 11) return;
                const pid = String(args[10] == null ? '' : args[10]).replace(/\D+/g, '');
                const uid = String(args[13] == null ? '' : args[13]).replace(/\D+/g, '');
                const postTs = args[14];
                byFloor[floor] = {
                    floor,
                    pid: pid === '' ? '' : pid,
                    uid,
                    postTime: formatUnix(postTs),
                    postTs,
                    recommend: args[15] || '',
                    type: args[11] || '',
                };
            });
        }
        return { byFloor, topicAuthor, topicTid, topicReplies };
    }

    function decodeUuname(raw) {
        const h = String(raw || '').trim();
        if (!h || /[^0-9a-fA-F]/.test(h) || h.length < 2 || (h.length % 2)) return '';
        try {
            let out = '';
            for (let i = 0; i < h.length; i += 2) out += '%' + h.slice(i, i + 2);
            const name = decodeURIComponent(out);
            return cleanAuthorName(name);
        } catch (err) { return ''; }
    }

    function parseAttachLoads(doc) {
        doc = doc || document;
        const byFloor = Object.create(null);
        for (const src of scriptTexts(doc)) {
            extractJsCallArgs(src, 'ubbcode.attach.load').forEach(args => {
                // postattachN, postcontentN, [ {url, type, ...}, ... ], pid, tid, uid, time, floor
                const floorRaw = String(args[7] != null ? args[7] : args[0] || '');
                const floorM = floorRaw.match(/(\d+)\s*$/);
                const contentId = String(args[1] || '');
                const floor = (contentId.match(/postcontent(\d+)/) || floorM || [])[1];
                if (floor == null) return;
                const list = [];
                const blob = args[2] || '';
                const re = /url\s*:\s*'([^']+)'|url\s*:\s*"([^"]+)"/g;
                let m;
                const rawList = String(blob);
                while ((m = re.exec(rawList))) {
                    const url = absImg(m[1] || m[2]);
                    if (url) list.push({ main: url, alt: '' });
                }
                if (list.length) byFloor[String(floor)] = list;
            });
        }
        return byFloor;
    }

    function ingestLiveUserInfo() {
        try {
            const users = (typeof commonui !== 'undefined' && commonui.userInfo && commonui.userInfo.users) || null;
            if (!users) return;
            Object.keys(users).forEach(k => {
                const u = users[k];
                if (!u) return;
                const decoded = decodeUuname(u.uuname);
                const name = (decoded && !isUidLabel(decoded) ? decoded : '') || (u.username || u.nickname || u.name);
                const uid = u.uid || k;
                rememberName(uid, name, 'page-userinfo');
            });
        } catch (err) { /* live object may be missing in tests */ }
    }

    function ingestHydratedAuthors(doc) {
        doc = doc || document;
        let added = false;
        doc.querySelectorAll('a[id^="postauthor"], a.author, a.userlink, td.c1 a[href*="uid="], td.c3 a[href*="uid="], td.c4 a[href*="uid="], .quote a[href*="uid="], a[name="uid"]').forEach(a => {
            const href = a.getAttribute('href') || '';
            const uid = (href.match(/uid=(\d+)/) || [])[1] || '';
            const name = cleanAuthorName(a.textContent);
            if (rememberName(uid, name, 'page-dom')) added = true;
        });
        return added;
    }

    function sanitizeJsonText(raw) {
        // NGA inline JSON sometimes has raw newlines or tabs inside string values
        // (signatures, honor), which JSON.parse rejects.
        const s = String(raw || '');
        let out = '';
        let inStr = false;
        let esc = false;
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            const code = c.charCodeAt(0);
            if (inStr) {
                if (esc) { out += c; esc = false; continue; }
                if (c === '\\') { out += c; esc = true; continue; }
                if (c === '"') { out += c; inStr = false; continue; }
                if (c === '\n') { out += '\\n'; continue; }
                if (c === '\r') { out += '\\r'; continue; }
                if (c === '\t') { out += '\\t'; continue; }
                if (code < 32) { out += '\\u' + code.toString(16).padStart(4, '0'); continue; }
                out += c;
            } else {
                if (c === '"') inStr = true;
                out += c;
            }
        }
        return out;
    }

    function parseUserInfoMap(doc) {
        doc = doc || document;
        const map = Object.create(null);
        const take = (uid, name, source) => {
            const id = String(uid || '').replace(/\D+/g, '');
            const n = cleanAuthorName(name);
            if (!id || !n || isUidLabel(n)) return;
            map[id] = n;
            rememberName(id, n, source || 'page-userinfo');
        };
        const tryJson = raw => {
            try {
                return JSON.parse(sanitizeJsonText(raw));
            } catch (err) { return null; }
        };
        const extractBalanced = (src, from) => {
            const i = src.indexOf('{', from);
            if (i < 0) return '';
            let depth = 0, inStr = false, esc = false;
            for (let j = i; j < src.length; j++) {
                const c = src[j];
                if (inStr) {
                    if (esc) esc = false;
                    else if (c === '\\') esc = true;
                    else if (c === '"') inStr = false;
                } else if (c === '"') inStr = true;
                else if (c === '{') depth++;
                else if (c === '}') {
                    depth--;
                    if (depth === 0) return src.slice(i, j + 1);
                }
            }
            return '';
        };
        for (const src of scriptTexts(doc)) {
            let idx = 0;
            while ((idx = src.indexOf('commonui.userInfo.setAll', idx)) >= 0) {
                const raw = extractBalanced(src, idx);
                idx += 24;
                const data = raw && tryJson(raw);
                if (!data || typeof data !== 'object') continue;
                Object.keys(data).forEach(k => {
                    const u = data[k];
                    if (u && typeof u === 'object') {
                        const decoded = decodeUuname(u.uuname);
                        take(u.uid || k, decoded || u.username || u.nickname || u.name, 'page-userinfo');
                    }
                });
            }
            const ucp = src.match(/__UCPUSER\s*=\s*(\{[\s\S]*?\})\s*;/);
            if (ucp) {
                const data = tryJson(ucp[1]);
                if (data) take(data.uid, data.username || data.nickname || data.name || decodeUuname(data.uuname), 'page-userinfo');
            }
        }
        (doc || document).querySelectorAll('a[href*="uid="], a.userlink, a.author, [id^="postauthor"]').forEach(a => {
            const href = a.getAttribute('href') || '';
            const uid = (href.match(/uid=(\d+)/) || [])[1] || '';
            take(uid, a.textContent, 'page-dom');
        });
        return map;
    }

    let userNameMap = Object.create(null);

    function resolveAuthorName(raw, uid) {
        const fromMap = uid && userNameMap[String(uid)];
        if (fromMap && !isUidLabel(fromMap)) return fromMap;
        const name = cleanAuthorName(raw);
        if (name && !isUidLabel(name)) return name;
        if (fromMap) return fromMap;
        if (name) return name;
        return uid || 'user';
    }

    function extractTopics(doc, baseUrl) {
        doc = doc || document;
        baseUrl = baseUrl || location.href;
        const abs = u => { try { return new URL(u, baseUrl).href; } catch (err) { return u || '#'; } };
        const rows = [...doc.querySelectorAll('.topicrow')];
        if (!rows.length) return null;
        userNameMap = Object.assign(Object.create(null), parseUserInfoMap(doc), userNameMap);
        const topicArgs = parseTopicArgs(doc);
        const argByTopicId = Object.create(null);
        const argByRepliesId = Object.create(null);
        const argByTid = Object.create(null);
        topicArgs.forEach(a => {
            if (a.idTopic) argByTopicId[a.idTopic] = a;
            if (a.idReplies) argByRepliesId[a.idReplies] = a;
            if (a.tid) argByTid[a.tid] = a;
        });
        const board = cleanTitle(
            tidyName((doc.querySelector('#m_nav .nav_link:last-child, #m_nav a.nav_link:last-of-type') || {}).textContent || '')
            || pageBoardName(doc)
            || tidyName(text(doc.querySelector('.nav_link:last-child')))
            || realTitle || document.title
        ) || 'board';
        const topics = rows.map(r => {
            const titleEl = r.querySelector('.c2 .topic, .c2 .topic_title, a[id^="t_tt"]');
            let a = titleEl ? (titleEl.closest('a') || titleEl.querySelector('a') || (titleEl.tagName === 'A' ? titleEl : null)) : null;
            if (!a) {
                a = [...r.querySelectorAll('.c2 a[href*="read.php"], .c2 a[href*="tid="]')]
                    .sort((x, y) => y.textContent.trim().length - x.textContent.trim().length)[0];
            }
            const title = tidyName(text(titleEl) || text(a));
            const hrefRaw = (a && a.getAttribute('href')) || (titleEl && titleEl.getAttribute('href')) || '';
            const href = abs(hrefRaw);
            const tid = ((href || '').match(/tid=(\d+)/) || [])[1] || '';
            const titleId = (a && a.id) || (titleEl && titleEl.id) || '';
            const repliesEl = r.querySelector('.c1 .replies, a[id^="t_rc"], .c1 a');
            const repliesId = (repliesEl && repliesEl.id) || '';
            const arg = (titleId && argByTopicId[titleId]) || (repliesId && argByRepliesId[repliesId]) || (tid && argByTid[tid]) || null;
            const domReplies = text(r.querySelector('.c1')).replace(/\D+/g, '');
            const replies = (arg && arg.replies) || (domReplies && domReplies !== '0' ? domReplies : '') || domReplies || '0';
            const authorEl = r.querySelector('.c3 .author, .c3 a[id^="t_ta"], .c3 a[href*="uid="]');
            const authorUid = authorEl ? (((authorEl.getAttribute('href') || '').match(/uid=(\d+)/) || [])[1] || '') : '';
            let author = tidyName(text(authorEl));
            if (!author || isUidLabel(author)) author = resolveAuthorName(author, authorUid);
            const postDate = tidyName(text(r.querySelector('.c3 .postdate, [id^="t_pt"]'))) || (arg && arg.postdate) || '';
            const replyDate = tidyName(text(r.querySelector('.c4 .replydate, [id^="t_rt"]'))) || (arg && arg.lastpost) || '';
            const replyer = tidyName(text(r.querySelector('.c4 .replyer, [id^="t_tr"]')));
            return {
                title: title || (tid ? 'tid ' + tid : ''),
                href,
                tid,
                replies: String(replies || '0'),
                author: author || '',
                postDate,
                replyDate,
                replyer,
            };
        }).filter(t => {
            if (isJunkTopicTitle(t.title)) return false;
            if (t.title) return Boolean(t.tid || t.href);
            return Boolean(t.tid);
        });
        ingestHydratedAuthors(doc);
        return { kind: 'topics', board, topics };
    }

    function postUid(b) {
        const named = b.querySelector('a[name="uid"]');
        if (named) {
            const n = text(named).replace(/\D+/g, '');
            if (n) return n;
        }
        const uidLink = b.querySelector('a[href*="uid="]');
        return (((uidLink && uidLink.getAttribute('href')) || '').match(/uid=(\d+)/) || [])[1] || '';
    }

    function pickPid(candidates) {
        const all = [];
        for (const raw of candidates) {
            const m = String(raw || '').match(/pid\s*[=:]?\s*(\d+)/i) || String(raw || '').match(/pid(\d+)/i);
            if (m) all.push(m[1]);
        }
        const nonzero = all.filter(p => p !== '0');
        // Prefer a real reply pid. The original post of a thread is genuinely pid 0.
        return (nonzero[0] || all[0] || '');
    }

    function pidFromNode(node) {
        if (!node || !node.querySelectorAll) return '';
        const idCands = [...node.querySelectorAll('[id*="pid" i], [name*="pid" i], a[id^="pid"]')]
            .map(el => el.id || el.getAttribute('name') || '');
        const fromId = pickPid(idCands);
        if (fromId && fromId !== '0') return fromId;
        const hrefs = [...node.querySelectorAll('a[href*="pid="], a[href*="topid="]')].map(a => a.getAttribute('href') || '');
        const fromHref = pickPid(hrefs);
        if (fromHref && fromHref !== '0') return fromHref;
        const oc = [...node.querySelectorAll('[onclick]')].map(el => el.getAttribute('onclick') || '');
        const fromClick = pickPid(oc);
        if (fromClick && fromClick !== '0') return fromClick;
        return fromId || fromHref || fromClick || '';
    }

    function postPid(b) {
        return pidFromNode(b)
            || pidFromNode(b.previousElementSibling)
            || pidFromNode(b.nextElementSibling)
            || pidFromNode(b.parentElement)
            || '';
    }

    function postFloor(b, i, infoText) {
        const floorM = String(infoText || '').match(/#\s*(\d+)/);
        if (floorM) return parseInt(floorM[1], 10);
        const nodes = [...b.querySelectorAll('[id^="l"], [name^="l"]')];
        if (b.parentElement) nodes.push(...b.parentElement.querySelectorAll(':scope > [id^="l"], :scope > [name^="l"], :scope > a[name^="l"]'));
        for (const n of nodes) {
            const m = String(n.id || n.getAttribute('name') || '').match(/^l(\d+)$/i);
            if (m) return parseInt(m[1], 10);
        }
        const ids = [b.id, ...[...b.querySelectorAll('[id^="postcontainer"], [id^="postauthor"], [id^="post1strow"], [id^="postcontent"]')].map(el => el.id)].join(' ');
        const idFloor = ids.match(/post(?:container|author|1strow|content)(\d+)/i);
        if (idFloor) return parseInt(idFloor[1], 10);
        return i;
    }

    function quoteTimeFrom(node) {
        if (!node) return '';
        const el = node.querySelector('span.xtxt, span.silver, .xtxt.silver, span[class*="xtxt"]');
        if (!el) return '';
        return tidyName(el.textContent).replace(/\bundefined\b/gi, '').replace(/^[()]+|[()]+$/g, '').trim();
    }

    function stripInlineReplyChrome(root) {
        if (!root) return;
        const nodes = [...root.childNodes];
        for (const n of nodes) {
            if (n.nodeType === 3 && /^\s*Reply\s+to\s*/i.test(n.nodeValue || '')) {
                n.nodeValue = (n.nodeValue || '').replace(/^\s*Reply\s+to\s*/i, '');
            }
        }
        root.querySelectorAll('a.block_txt, a[onclick*="fastViewPost"], a[title*="\u6253\u5f00\u94fe\u63a5"], a[title*="\u5feb\u901f\u6d4f\u89c8"]').forEach(a => {
            if (!a.closest('.quote')) a.remove();
        });
        // The Reply-to header is "Reply to + R by [name] (time)" and is not wrapped in .quote.
        // After dropping the +/R chrome, strip the leftover by-line so it does not land in the body.
        const kids = [...root.childNodes];
        for (const n of kids) {
            if (n.nodeType === 3) {
                const v = n.nodeValue || '';
                if (/^\s*(by\s*)?\[?\s*\]?\s*$/i.test(v)) { n.remove(); continue; }
                if (/\S/.test(v)) break;
                n.remove();
                continue;
            }
            if (n.nodeType !== 1) { n.remove(); continue; }
            const tag = (n.tagName || '').toLowerCase();
            const cls = String(n.className || '');
            const isUser = tag === 'a' && (n.classList.contains('userlink') || (n.getAttribute('href') || '').includes('uid='));
            const isTime = tag === 'span' && /xtxt|silver/.test(cls);
            if (isUser || isTime || tag === 'br') { n.remove(); continue; }
            break;
        }
    }

    function extractInlineReplyQuote(content) {
        if (!content) return null;
        if (content.querySelector('.quote')) return null;
        const uidLink = content.querySelector('a[href*="uid="], a.userlink');
        const firstText = [...content.childNodes].find(n => n.nodeType === 3 && /\S/.test(n.nodeValue || ''));
        const lead = firstText ? firstText.nodeValue : '';
        if (!/Reply\s+to/i.test(lead) && !/Reply\s+to/i.test(content.textContent.slice(0, 80))) return null;
        if (!uidLink) return null;
        const uid = ((uidLink.getAttribute('href') || '').match(/uid=(\d+)/) || [])[1] || '';
        const author = resolveAuthorName(uidLink.textContent, uid);
        const time = quoteTimeFrom(content);
        return { depth: 0, text: '', author, time, uid, pid: pidFromNode(content) };
    }

    function parseQuoteNode(q) {
        let depth = 0;
        let n = q.parentElement;
        while (n) {
            if (n.classList && n.classList.contains('quote')) depth++;
            n = n.parentElement;
        }
        const clone = q.cloneNode(true);
        clone.querySelectorAll('.quote').forEach(x => x.remove());
        const uidLink = clone.querySelector('a[href*="uid="], a.userlink');
        const uid = uidLink ? (((uidLink.getAttribute('href') || '').match(/uid=(\d+)/) || [])[1] || '') : '';
        let author = uidLink ? resolveAuthorName(uidLink.textContent, uid) : '';
        let time = quoteTimeFrom(clone);
        const pid = pidFromNode(clone);
        clone.querySelectorAll('a.block_txt, a[onclick*="fastViewPost"], a[title*="\u6253\u5f00\u94fe\u63a5"], a[title*="\u5feb\u901f\u6d4f\u89c8"]').forEach(a => a.remove());
        if (uidLink) uidLink.remove();
        const timeEl = clone.querySelector('span.xtxt, span.silver, .xtxt.silver, span[class*="xtxt"]');
        if (timeEl) timeEl.remove();
        let raw = cleanText(plainText(clone));
        let name = author;
        const header = raw.match(/^(?:Reply\s+to\s+)?(?:\+R\s+by|Post\s+by|Reply)\s+(?:\[([^\]]+)\]|([^\s(]+))\s*(?:\(([^)]*)\))?\s*/i);
        if (header) {
            if (!name || isUidLabel(name)) name = cleanAuthorName(header[1] || header[2] || '');
            if (!time) time = (header[3] || '').replace(/undefined/ig, '').trim();
            raw = raw.slice(header[0].length);
        }
        raw = raw
            .replace(/^(?:Reply\s+to\s*)?['"\s]*by\s*['"\s]*/i, '')
            .replace(/^\+R\s+by\s+/i, '')
            .replace(/^['"`\s]+/, '')
            .replace(/\bundefined\b/gi, '');
        return { depth, text: cleanText(raw), author: name, time, uid, pid };
    }

    function parsePost(b, i, opUid, postArgs, attachByFloor) {
        const content = b.querySelector('.postcontent, [id^="postcontent"]');
        const infoText = text(b.querySelector('[class*="postinfo" i], [id^="postInfo"], [id^="postdate"]')) || text(b.querySelector('.postBtnPos'));
        const dateEl = b.querySelector('[id^="postdate"], .postdatec, .postinfot');
        const dateM = (dateEl ? text(dateEl) : infoText).match(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/);
        const floor = postFloor(b, i, infoText);
        const arg = postArgs && postArgs.byFloor && postArgs.byFloor[floor];
        let uid = postUid(b) || (arg && arg.uid) || '';
        let pid = postPid(b);
        // postArg.proc is authoritative and survives NGA's later DOM rewrites.
        if (arg && arg.pid !== undefined && arg.pid !== '') {
            if (arg.pid !== '0' || floor === 0 || !pid || pid === '0') pid = String(arg.pid);
        }
        if (pid === '0' && floor !== 0) {
            const again = postPid(b);
            if (again && again !== '0') pid = again;
        }
        const rawName = text(b.querySelector('.posterinfo .author, .posterInfoLine .author, a.author, [id^="postauthor"]')) || '';
        let name = resolveAuthorName(rawName, uid);
        let authorFiltered = false;
        try { authorFiltered = new URL(location.href).searchParams.has('authorid'); } catch (err) { authorFiltered = false; }
        const isOP = /\u697c\u4e3b/.test(rawName) || (!authorFiltered && opUid && uid && uid === opUid);
        const likeEl = b.querySelector('.recommendvalue');
        const likes = likeEl ? recommendScore(text(likeEl)) : '';
        const quotes = content
            ? [...content.querySelectorAll('.quote')].map(parseQuoteNode).filter(q => q.text || q.author)
            : [];
        const inline = extractInlineReplyQuote(content);
        if (inline && !quotes.length) quotes.push(inline);
        if (postArgs && postArgs.byFloor) {
            quotes.forEach(q => {
                if (q.time) return;
                const hit = Object.values(postArgs.byFloor).find(a => (q.pid && String(a.pid) === String(q.pid) && a.pid !== '0') || (q.uid && a.uid && String(a.uid) === String(q.uid)));
                if (hit && hit.postTime) q.time = hit.postTime;
            });
        }
        const date = (dateM && dateM[0]) || (arg && arg.postTime) || '';
        const head = [
            '#' + floor,
            name + (uid && uid !== name ? '(' + uid + ')' : ''),
            date,
            likes !== '' ? formatScore(likes) : '',
        ].filter(Boolean).join(' · ');
        const body = contentText(content);
        const imgs = (body.imgs || []).slice();
        const seen = new Set(imgs.map(o => o.main));
        const extras = (attachByFloor && (attachByFloor[String(floor)] || attachByFloor[floor])) || [];
        extras.forEach(o => { if (o.main && !seen.has(o.main)) { seen.add(o.main); imgs.push(o); } });
        const id = 'floor:' + floor + ':' + uid + ':' + (pid || i);
        return { id, floor, pid, head, uid, name, isOP, date, likes, text: body.text, imgs, quotes };
    }

    function findHotBoxes(doc) {
        const heads = [...(doc || document).querySelectorAll('div,span,td,b')].filter(el => {
            const t = el.textContent.trim();
            return t.startsWith('\u70ed\u70b9\u56de\u590d') && t.length < 12;
        });
        for (const head of heads) {
            let node = head.parentElement;
            for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
                const found = [...node.querySelectorAll('.forumbox.postbox, .postbox, [id^="postcontainer"]')];
                if (found.length && found.length <= 10) return found;
            }
        }
        return [];
    }

    function uniqueBoxes(list) {
        const seen = new Set();
        const out = [];
        for (const el of list) {
            if (!el || seen.has(el)) continue;
            if (list.some(other => other && other !== el && other.contains(el))) continue;
            seen.add(el);
            out.push(el);
        }
        return out;
    }

    function postBoxes(doc) {
        const tables = uniqueBoxes([...doc.querySelectorAll('.forumbox.postbox, table.postbox')]);
        if (tables.length) return tables;
        const containers = uniqueBoxes([...doc.querySelectorAll('[id^="postcontainer"]')]);
        if (containers.length) return containers;
        const seen = new Set();
        const boxes = [];
        doc.querySelectorAll('.postcontent, [id^="postcontent"]').forEach(el => {
            const box = el.closest('table, .forumbox, [id^="post"]') || el.parentElement;
            if (box && !seen.has(box)) { seen.add(box); boxes.push(box); }
        });
        return uniqueBoxes(boxes);
    }

    function extractPosts(doc, opUidOverride) {
        doc = doc || document;
        userNameMap = Object.assign(Object.create(null), parseUserInfoMap(doc), userNameMap);
        Object.keys(nameCache).forEach(k => { if (nameCache[k] && !isUidLabel(nameCache[k])) userNameMap[k] = nameCache[k]; });
        ingestLiveUserInfo();
        ingestHydratedAuthors(doc);
        const postArgs = parsePostArgs(doc);
        const attachByFloor = parseAttachLoads(doc);
        const allBoxes = postBoxes(doc);
        if (!allBoxes.length) return null;
        const elTitle = text(doc.querySelector('#toppedtopic .topic, .catetitle, h1 .topic, #postsubject0, [id^="postsubject"]'));
        const title = cleanTitle(elTitle || realTitle || document.title);
        const hotBoxes = findHotBoxes(doc);
        const boxes = allBoxes.filter(b => !hotBoxes.some(hb => hb === b || hb.contains(b)));
        if (!boxes.length) return null;
        const markedOP = boxes.find(b => /\u697c\u4e3b/.test(text(b.querySelector('.posterinfo .author, .posterInfoLine .author, [id^="postauthor"]'))));
        let authorFiltered = false;
        try { authorFiltered = new URL(location.href).searchParams.has('authorid'); } catch (err) { authorFiltered = false; }
        const opUid = opUidOverride !== undefined ? opUidOverride
            : (authorFiltered ? '' : ((opUidTid === curTid() && opUidSticky) || (postArgs && postArgs.topicAuthor) || (markedOP ? postUid(markedOP) : curPageNo() <= 1 ? postUid(boxes[0]) : '')));
        if (opUid && !opUidSticky && opUidTid === curTid()) opUidSticky = opUid;
        if (opUid && curTid() && !opUidTid) { opUidTid = curTid(); opUidSticky = opUidSticky || opUid; }
        const posts = boxes.map((b, i) => parsePost(b, i, opUid, postArgs, attachByFloor));
        if (opUidOverride === undefined && posts.length && title && posts[0].text.startsWith(title)) {
            posts[0].text = cleanText(posts[0].text.slice(title.length));
        }
        const hot = doc === document
            ? hotBoxes.slice(0, 5).map((b, i) => parsePost(b, i, opUid, postArgs, attachByFloor)).filter(p => p.text || p.imgs.length)
            : [];
        return { kind: 'posts', title, posts, hot };
    }

    function extractPager(doc, baseUrl) {
        doc = doc || document;
        baseUrl = baseUrl || location.href;
        const isRead = location.pathname.includes('read');
        const pathKey = isRead ? 'read.php' : 'thread.php';
        const cur = new URLSearchParams(location.search).get('tid');
        const links = [...doc.querySelectorAll('#m_pbtnbtm a[href], #pagebbtm a[href], #m_pbtntop a[href], #pagebbtop a[href], #m_threads > .uitxt1 a[href]')];
        const seen = new Set();
        const out = [];
        for (const a of links) {
            const t = a.textContent.trim();
            if (!/^(\d{1,4}|\u4e0b\u4e00\u9875|\u4e0b\u9875|\u4e0a\u4e00\u9875|\u4e0a\u9875|>{1,2}|<{1,2}|\u5c3e\u9875|\u9996\u9875)$/.test(t)) continue;
            let u;
            try { u = new URL(a.getAttribute('href') || '', baseUrl); } catch (err) { continue; }
            if (!u.pathname.includes(pathKey)) continue;
            if (isRead && cur && u.searchParams.get('tid') !== cur) continue;
            const key = (u.searchParams.get('page') || '') + '|' + t;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ t, href: u.href });
        }
        return out;
    }

    const JUNK_BOARD_NAME = /^(后页|前页|发表新帖|精华区|下一页|上一页|首页|尾页|后页|\[\s*\]|\d+)$/;

    function discoverPageBoards(doc) {
        doc = doc || document;
        const out = [];
        const seen = new Set();
        const add = (fid, name) => {
            const id = String(fid || '').trim();
            if (!id || !/^-?\d+$/.test(id) || seen.has(id)) return;
            const label = tidyName(name).replace(/^\[|\]$/g, '').trim();
            if (label && (JUNK_BOARD_NAME.test(label) || /^\d+$/.test(label) || /^https?:/i.test(label) || /更多内容|BUG\s*反馈|建议及/.test(label))) return;
            seen.add(id);
            out.push({ fid: id, name: label || ('fid ' + id) });
        };
        add(pageFid(doc), pageBoardName(doc));
        (boards || []).forEach(b => add(b.fid, b.name));
        const pick = sel => [...doc.querySelectorAll(sel)];
        const subRoot = doc.getElementById('sub_forums') || doc.getElementById('sub_forums_c') || doc.querySelector('.subforum');
        const candidates = [
            ...pick('#m_nav a[href*="fid="]'),
            ...pick('.nav_link[href*="fid="]'),
            ...(subRoot ? [...subRoot.querySelectorAll('a[href*="fid="]')] : []),
            ...pick('#favorite_forums a[href*="fid="], #favor_forums a[href*="fid="], #userinfo a[href*="fid="], #ucp a[href*="thread.php"][href*="fid="]'),
        ];
        candidates.forEach(a => {
            const href = a.getAttribute('href') || '';
            if (/recommend=|order_by=|page=|favor=|key=|authorid=|content=/.test(href) && !/ff=/.test(href)) return;
            add(fidFromHref(href), a.textContent);
        });
        return out;
    }

    function rememberRecent(entry) {
        const tid = String(entry && entry.tid || '');
        if (!tid) return;
        let recent = GM_getValue('cad_recent', []);
        if (!Array.isArray(recent)) recent = [];
        recent = recent.filter(t => String(t.tid) !== tid);
        recent.unshift({ tid, fid: String(entry.fid || ''), title: entry.title || ('tid ' + tid) });
        if (recent.length > 20) recent.length = 20;
        GM_setValue('cad_recent', recent);
    }

    function threadEntry(t) {
        const tid = String(t && t.tid || ((t && t.href) || '').match(/tid=(\d+)/) && ((t.href || '').match(/tid=(\d+)/) || [])[1] || '');
        if (!tid) return null;
        const title = tidyName(t.title) || ('tid ' + tid);
        if (isJunkTopicTitle(title)) return null;
        const href = t.href || ('/read.php?tid=' + encodeURIComponent(tid));
        return { tid, title, href, fid: t.fid || '' };
    }

    function uniqueThreads(lists) {
        const out = [], seen = new Set();
        lists.forEach(list => (list || []).forEach(t => {
            const e = threadEntry(t);
            if (!e || seen.has(e.tid)) return;
            seen.add(e.tid);
            out.push(e);
        }));
        return out;
    }

    function sidebarFavorites() {
        const fromPage = (document.querySelector('#m_threads') && /favor=/.test(location.search || location.href))
            ? ((extractTopics() || {}).topics || [])
            : [];
        const cached = (favorCache && favorTopicsOk(favorCache.topics)) ? favorCache.topics : [];
        return uniqueThreads([savedThreads, fromPage, cached]);
    }

    function sidebarRecent() {
        const recent = GM_getValue('cad_recent', []);
        const current = (lastData && lastData.kind === 'posts' && curTid())
            ? [{ tid: curTid(), title: lastData.title, fid: pageFid() }]
            : [];
        const favIds = new Set(sidebarFavorites().map(t => t.tid));
        return uniqueThreads([recent, current]).filter(t => !favIds.has(t.tid));
    }

    function applyFavorDoc(doc, url) {
        const data = extractTopics(doc, url);
        const topics = ((data && data.topics) || []).map(t => ({ tid: t.tid, title: t.title, href: t.href, fid: t.fid || '' }));
        if (!favorTopicsOk(topics)) {
            // Decoded body still looks garbled: keep the previous good cache, or stay empty.
            return topics;
        }
        favorCache = { at: Date.now(), topics, v: FAVOR_CACHE_VER };
        try { GM_setValue('cad_fav_cache', favorCache); } catch (err) { /* ignore */ }
        return topics;
    }

    function ensureFavs() {
        if (TEST) return;
        favorCache = readFavorCache();
        const fresh = favorCache && favorCache.at && (Date.now() - favorCache.at < 5 * 60 * 1000) && favorTopicsOk(favorCache.topics);
        if (fresh || favorPending) return;
        favorPending = true;
        const host = location.host || 'bbs.nga.cn';
        const favUrl = (location.protocol || 'https:') + '//' + host + '/thread.php?favor=1';
        fetch(favUrl, { credentials: 'include', method: 'GET' })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return decodeRes(r); })
            .then(txt => {
                const doc = new DOMParser().parseFromString(txt, 'text/html');
                applyFavorDoc(doc, (location.origin || ('https://' + host)) + '/thread.php?favor=1');
                if (store.on && !covered) renderApp();
            })
            .catch(() => {})
            .finally(() => { favorPending = false; });
    }

    function extract() {
        let data;
        if (document.querySelector('#m_posts')) data = extractPosts();
        else if (document.querySelector('#m_threads')) data = extractTopics();
        else data = { kind: 'idle' };
        if (data) data.pager = extractPager();
        if (data && data.kind === 'posts' && curTid()) {
            rememberRecent({ tid: curTid(), fid: pageFid(), title: data.title });
        }
        return data;
    }

    /* ================= locations ================= */
    function walkUcpName(obj, depth) {
        if (!obj || depth > 6) return '';
        if (typeof obj === 'string') {
            const decoded = decodeUuname(obj);
            const n = cleanAuthorName(decoded || obj);
            return n && !isUidLabel(n) ? n : '';
        }
        if (typeof obj !== 'object') return '';
        const direct = obj.uuname || obj.uuName || obj.username || obj.nickname || obj.name || obj.uname;
        const fromDirect = walkUcpName(direct, depth + 1);
        if (fromDirect) return fromDirect;
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const n = walkUcpName(item, depth + 1);
                if (n) return n;
            }
        }
        const row = obj[0] || obj['0'];
        if (row && row !== obj) {
            const n = walkUcpName(row, depth + 1);
            if (n) return n;
        }
        if (obj.data && obj.data !== obj) {
            const n = walkUcpName(obj.data, depth + 1);
            if (n) return n;
        }
        return '';
    }

    function nameFromUcpData(res) {
        if (!res) return '';
        const data = res.data !== undefined ? res.data : res;
        return walkUcpName(data, 0);
    }

    function rememberName(uid, name, source) {
        const id = String(uid || '');
        const n = cleanAuthorName(name);
        if (!id || !n || isUidLabel(n)) return false;
        const prev = nameSources[id];
        const rank = { 'page-userinfo': 3, 'page-dom': 3, 'cache': 2, 'ucp': 1 };
        const incoming = rank[source] || 0;
        const existing = rank[prev] || 0;
        // Do not replace a real page name with a weaker source.
        if (userNameMap[id] && !isUidLabel(userNameMap[id]) && incoming < existing) return false;
        userNameMap[id] = n;
        nameCache[id] = n;
        if (source && (incoming > existing || !nameSources[id])) nameSources[id] = source;
        const keys = Object.keys(nameCache);
        if (keys.length > 800) {
            keys.slice(0, 400).forEach(k => { delete nameCache[k]; delete nameSources[k]; });
        }
        try { GM_setValue('cad_name_cache', nameCache); } catch (err) { /* ignore */ }
        return true;
    }

    function locFromUcpData(res) {
        if (!res) return '';
        const data = res.data !== undefined ? res.data : res;
        const row = Array.isArray(data) ? data[0] : (data && (data[0] || data['0'] || data));
        return (row && (row.ipLoc || row.iploc || row.ip_loc)) || (data && data.ipLoc) || '';
    }

    function ucpUrls(uid) {
        const host = (typeof location !== 'undefined' && location.host) ? location.host : 'bbs.nga.cn';
        const proto = (typeof location !== 'undefined' && location.protocol === 'http:') ? 'http:' : 'https:';
        const base = proto + '//' + host + '/nuke.php';
        const id = encodeURIComponent(String(uid || ''));
        // Official NGA call is __lib=ucp&__act=get&lite=js&uid=. __output=11 is JSON;
        // __output=8 is the same payload, often prefixed with window.script_muti_get_var_store=.
        return [
            base + '?__lib=ucp&__act=get&lite=js&uid=' + id + '&__output=11',
            base + '?__lib=ucp&__act=get&uid=' + id + '&__output=8',
            base + '?__lib=ucp&__act=get&lite=js&uid=' + id,
        ];
    }

    let lastNameProbe = null;
    const ucpInflight = Object.create(null);
    const ucpQueue = [];
    let ucpBusy = false;
    let ucpGaveUp = false;
    const UCP_GAP = TEST ? 0 : 300;

    function rememberLoc(id, loc) {
        if (!id || !loc) return;
        const keys = Object.keys(locCache);
        if (keys.length > 800) keys.slice(0, 400).forEach(k => delete locCache[k]);
        locCache[id] = loc;
        GM_setValue('cad_loc_cache', locCache);
    }

    function probeUcpUrl(uid, url) {
        const report = { uid: String(uid || ''), url: url, status: 0, contentType: '', bodyHead: '', parseError: '', name: '', loc: '' };
        return fetch(url, { credentials: 'include', method: 'GET' })
            .then(r => {
                report.status = r.status;
                report.contentType = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
                if (r.status === 503) ucpGaveUp = true;
                return decodeRes(r);
            })
            .then(text => {
                report.bodyHead = String(text || '').slice(0, 300);
                const parsed = parseNukeJson(text);
                if (!parsed.ok) {
                    report.parseError = parsed.error || 'parse failed';
                    lastNameProbe = report;
                    return { report, data: null };
                }
                report.name = nameFromUcpData(parsed.data);
                report.loc = locFromUcpData(parsed.data);
                lastNameProbe = report;
                return { report, data: parsed.data };
            })
            .catch(err => {
                report.parseError = (err && err.message) ? err.message : String(err);
                lastNameProbe = report;
                return { report, data: null };
            });
    }

    function actuallyFetchUcp(uid) {
        const id = String(uid || '');
        if (ucpGaveUp) return Promise.resolve(lastNameProbe ? { report: lastNameProbe, blocked: true } : null);
        const urls = ucpUrls(id);
        let i = 0;
        const step = () => {
            if (ucpGaveUp) return Promise.resolve({ report: lastNameProbe, blocked: true });
            if (i >= urls.length) return Promise.resolve(null);
            const url = urls[i++];
            return probeUcpUrl(id, url).then(out => {
                const status = out && out.report && out.report.status;
                // The live ucp API returns 503 / text/html with an empty body.
                // Stop every further ucp call in this page session after the first 503.
                if (status === 503) {
                    ucpGaveUp = true;
                    return { loc: '', name: '', report: out.report, blocked: true };
                }
                if (out && out.data) {
                    const loc = (out.report && out.report.loc) || locFromUcpData(out.data);
                    const name = (out.report && out.report.name) || nameFromUcpData(out.data);
                    if (loc) rememberLoc(id, loc);
                    if (name) rememberName(id, name, 'ucp');
                    return { loc, name, report: out.report };
                }
                // Parsed failure or HTTP failure: try the next official-style URL.
                return step();
            });
        };
        return step();
    }

    function fetchUcp(uid) {
        const id = String(uid || '');
        if (!id || !/^\d+$/.test(id)) return Promise.resolve(null);
        if (ucpGaveUp) return Promise.resolve(null);
        if (ucpInflight[id]) return ucpInflight[id];
        const req = new Promise(resolve => {
            ucpQueue.push({ id, resolve });
            pumpUcp();
        }).finally(() => { delete ucpInflight[id]; });
        ucpInflight[id] = req;
        return req;
    }

    function pumpUcp() {
        if (ucpGaveUp && ucpQueue.length) {
            while (ucpQueue.length) {
                const item = ucpQueue.shift();
                try { item.resolve(null); } catch (err) { /* ignore */ }
            }
            ucpBusy = false;
            return;
        }
        if (ucpBusy || !ucpQueue.length) return;
        ucpBusy = true;
        const { id, resolve } = ucpQueue.shift();
        actuallyFetchUcp(id)
            .then(r => resolve(r || null))
            .catch(() => resolve(null))
            .finally(() => {
                const done = () => { ucpBusy = false; pumpUcp(); };
                if (UCP_GAP) setTimeout(done, UCP_GAP);
                else done();
            });
    }

    function applyCachedNames(posts) {
        (posts || []).forEach(p => {
            if (!p || !p.uid) return;
            if (nameCache[p.uid] && !isUidLabel(nameCache[p.uid])) {
                userNameMap[p.uid] = nameCache[p.uid];
                if (!nameSources[p.uid]) nameSources[p.uid] = 'cache';
            }
            if (p.name && !isUidLabel(p.name)) {
                if (!nameSources[p.uid]) nameSources[p.uid] = 'page-dom';
                return;
            }
            const n = userNameMap[p.uid] || nameCache[p.uid];
            if (n && !isUidLabel(n)) p.name = n;
        });
    }

    function ensureLocs() {
        if (!lastData || lastData.kind !== 'posts') return;
        applyCachedNames(lastData.posts);
        applyCachedNames(lastData.hot);
        const uids = [...new Set([...(lastData.posts || []), ...(lastData.hot || [])].map(p => p.uid).filter(Boolean))];
        uids.filter(u => /^\d+$/.test(u)).forEach(uid => {
            const needLoc = !(uid in locMap);
            const needName = !userNameMap[uid] && !nameCache[uid] && (lastData.posts || []).some(p => p.uid === uid && isUidLabel(p.name));
            if (!needLoc && !needName) return;
            if (needLoc) locMap[uid] = locCache[uid] || '';
            fetchUcp(uid).then(r => {
                let changed = false;
                if (r && r.loc && locMap[uid] !== r.loc) { locMap[uid] = r.loc; changed = true; }
                if (r && r.name) {
                    applyCachedNames(lastData && lastData.posts);
                    applyCachedNames(lastData && lastData.hot);
                    changed = true;
                }
                if (changed) scheduleLocRender();
            });
        });
    }

    function scheduleLocRender() {
        if (locRenderTimer) return;
        locRenderTimer = setTimeout(() => {
            locRenderTimer = null;
            if (store.on && !covered && !document.hidden) renderApp();
        }, 400);
    }

    let nameWatchStarted = false;
    function watchHydratedNames() {
        if (TEST || nameWatchStarted) return;
        nameWatchStarted = true;
        [400, 1200, 3000, 8000].forEach(ms => setTimeout(() => {
            ingestLiveUserInfo();
            ingestHydratedAuthors();
            if (lastData && lastData.kind === 'posts') {
                const before = (lastData.posts || []).map(p => p.name).join('\0');
                applyCachedNames(lastData.posts);
                applyCachedNames(lastData.hot);
                if ((lastData.posts || []).map(p => p.name).join('\0') !== before) scheduleLocRender();
            }
            ensureLocs();
        }, ms));
    }

    /* ================= links ================= */
    function linkifySegments(value) {
        const textValue = String(value || '');
        const re = /https?:\/\/[^\s<>"']+/g;
        const out = [];
        let last = 0;
        let m;
        while ((m = re.exec(textValue))) {
            if (m.index > last) out.push({ type: 'text', value: textValue.slice(last, m.index) });
            let url = m[0];
            const trail = url.match(/[),.;:!?]+$/);
            let extra = '';
            if (trail) { extra = trail[0]; url = url.slice(0, -extra.length); }
            out.push({ type: 'link', value: url });
            if (extra) out.push({ type: 'text', value: extra });
            last = m.index + m[0].length;
        }
        if (last < textValue.length) out.push({ type: 'text', value: textValue.slice(last) });
        return out;
    }

    function linkProps(url) {
        try {
            const u = new URL(url, location.href);
            if (/nga\.cn|ngabbs\.com|ngacn\.cc|nga\.178\.com/i.test(u.host)) return { href: u.href };
            return { href: u.href, target: '_blank', rel: 'noopener noreferrer' };
        } catch (err) {
            return { href: url };
        }
    }

    /* ================= commands ================= */
    const CMDS = ['help', 'search:', 'board', 'board list', 'board add', 'board del', 'board fid', 'next page', 'prev page', 'go page', 'open', 'ls', 'top', 'floor', 'sort reply', 'sort post', 'author', 'author off', 'reply', 'quote', 'post', 'bookmark', 'bookmark list', 'unbookmark', 'vote', 'noti', 'user', 'send', 'theme', 'claude', 'codex', 'dark', 'light', 'img', 'op', 'expand', 'vim', 'autopage', 'compact', 'pause', 'togglekey', 'clear', 'exit', 'version', 'pwd', 'whoami'];
    const NEEDS_ARG = new Set(['search:', 'board', 'board add', 'board del', 'board fid', 'go page', 'open', 'floor', 'author', 'reply', 'quote', 'post', 'vote', 'user', 'togglekey']);

    function helpOut() {
        return [
            line('<b>boards and threads</b>  <span class="cad-faint">a leading / is optional</span>', 'cad-sect'),
            line(esc('ls · open <n>          list what is loaded, or open topic n'), 'cad-dim'),
            line(esc('next · prev · go page <n> · top · floor <n>'), 'cad-dim'),
            line(esc('sort reply · sort post latest reply, or latest new thread'), 'cad-dim'),
            line(esc('search: <words>        this board when a fid is known'), 'cad-dim'),
            line(esc('search: -g <words>     the whole site'), 'cad-dim'),
            line(esc('op · author <uid|name> · author off'), 'cad-dim'),
            line('<b>saved</b>', 'cad-sect'),
            line(esc('board list · board add [name] · board <n> · board del <n> · board fid <fid>'), 'cad-dim'),
            line(esc('bookmark · unbookmark  this thread. y confirms. bookmark list'), 'cad-dim'),
            line('<b>write</b>', 'cad-sect'),
            line(esc('reply [text] · reply <floor> [text] · quote <floor> [text]'), 'cad-dim'),
            line(esc('post [title]           new thread in the current board'), 'cad-dim'),
            line(esc('vote <floor>           recommend that floor'), 'cad-dim'),
            line(esc('y / n / edit           nothing is posted before y. quote <floor> quotes that floor.'), 'cad-dim'),
            line('<b>people</b>', 'cad-sect'),
            line(esc('user [uid|name] · whoami · noti'), 'cad-dim'),
            line('<b>view</b>', 'cad-sect'),
            line(esc('img · op · expand · vim · autopage · compact · pause'), 'cad-dim'),
            line(esc('theme · claude · codex · dark · light · togglekey <key>'), 'cad-dim'),
            line('<b>keys</b>', 'cad-sect'),
            line(esc('` toggles outside text fields. Esc closes help or a draft, then covers.'), 'cad-dim'),
            line(esc('Ctrl+[ leaves the prompt. Tab completes. Click a post to expand it.'), 'cad-dim'),
            line(esc('vim is off until you run vim. h/l scroll one screen and do not change pages.'), 'cad-dim'),
            line(esc('clear · exit · version · pwd'), 'cad-dim'),
        ];
    }

    function saveBoards() { GM_setValue('cad_boards', boards); }

    function gotoBoard(fid) {
        const u = new URL('/thread.php', location.href);
        u.searchParams.set('fid', fid);
        location.href = u.href;
    }

    function resolveBoardOp(op) {
        if (!/^-?\d+$/.test(op)) return null;
        const n = parseInt(op, 10);
        if (n >= 1 && n <= boards.length) return { type: 'index', index: n - 1, fid: String(boards[n - 1].fid) };
        return { type: 'fid', fid: op };
    }

    function boardCmd(sub) {
        const parts = sub.split(/\s+/).filter(Boolean);
        const op = parts[0] || '';
        const arg = parts.slice(1).join(' ');
        if (!op || op === 'list' || op === 'ls') {
            const cur = pageFid();
            const rows = boards.map((b, i) =>
                line('<span class="cad-topicnum">' + (i + 1) + '</span> <a class="cad-pagelink' + (String(b.fid) === String(cur) ? ' cad-boardcur' : '') + '" href="/thread.php?fid=' + encodeURIComponent(b.fid) + '">' + esc(b.name) + '</a> <span class="cad-faint">fid=' + esc(String(b.fid)) + (String(b.fid) === String(cur) ? ' · current' : '') + '</span>'));
            return [
                line(esc('board add [name] · board <n> · board del <n> · board fid <fid>'), 'cad-faint'),
                ...(rows.length ? rows : [line('No favorites yet. board add saves this board, or use board fid <fid>.', 'cad-faint')]),
            ];
        }
        if (op === 'add') {
            const fid = pageFid();
            if (!fid) return [line('No board id on this page. Open a board, or use board fid <fid>.', 'cad-faint')];
            const name = arg || pageBoardName() || (lastData && lastData.board) || ('fid ' + fid);
            if (!boards.some(b => String(b.fid) === String(fid))) {
                boards.push({ fid: String(fid), name });
                saveBoards();
            }
            return [line('Saved ' + esc(name) + ' (fid=' + esc(String(fid)) + ').', 'cad-faint')];
        }
        if (op === 'del' || op === 'rm') {
            const n = parseInt(arg, 10);
            if (n >= 1 && n <= boards.length) {
                const removed = boards.splice(n - 1, 1)[0];
                saveBoards();
                return [line('Removed ' + esc(removed.name) + '.', 'cad-faint')];
            }
            return [line(esc('usage: board del <n>'), 'cad-faint')];
        }
        if (op === 'fid' && arg) {
            gotoBoard(arg);
            return null;
        }
        const target = resolveBoardOp(op);
        if (target) {
            gotoBoard(target.fid);
            return null;
        }
        return [line(esc('usage: board list | add [name] | del <n> | <n> | fid <fid>'), 'cad-faint')];
    }

    function doSearch(kw, global) {
        const u = new URL('/thread.php', location.href);
        u.searchParams.set('key', kw);
        const fid = pageFid();
        if (!global && fid) u.searchParams.set('fid', fid);
        location.href = u.href;
    }

    function loadedPosts() {
        return lastData && lastData.kind === 'posts' ? lastData.posts.filter(p => !p.sep) : [];
    }

    function sortTarget(kind, doc) {
        doc = doc || document;
        const replySort = kind !== 'post' && kind !== 'new';
        const labelRe = replySort ? /\u6700\u65b0\u56de\u590d|\u6700\u540e\u56de\u590d|\u56de\u590d\u65f6\u95f4/ : /\u6700\u65b0\u53d1\u5e03|\u53d1\u5e16\u65f6\u95f4|\u53d1\u5e03\u65f6\u95f4|\u4e3b\u9898\u65f6\u95f4/;
        const link = [...doc.querySelectorAll('a[href*="order_by"], a[href*="orderby"]')].find(a => labelRe.test(a.textContent || ''));
        if (link) {
            try { return new URL(link.getAttribute('href'), location.href).href; } catch (err) { /* fall through */ }
        }
        const u = new URL('/thread.php', location.href);
        const fid = pageFid(doc);
        if (fid) u.searchParams.set('fid', fid);
        u.searchParams.set('order_by', replySort ? 'lastpostdesc' : 'postdatedesc');
        return u.href;
    }

    function floorTarget(n, posts, tid) {
        const perPage = 20;
        const post = (posts || []).find(p => p.floor === n);
        if (post && post.pid && tid) {
            const u = new URL('/read.php', location.href);
            u.searchParams.set('tid', tid);
            u.searchParams.set('pid', String(post.pid));
            return { type: 'pid', href: u.href, page: Math.floor(Math.max(0, n) / perPage) + 1 };
        }
        const page = Math.floor(Math.max(0, n) / perPage) + 1;
        const u = new URL('/read.php', location.href);
        if (tid) u.searchParams.set('tid', tid);
        u.searchParams.set('page', String(page));
        return { type: 'page', href: u.href, page };
    }

    function authorTarget(token, posts, tid) {
        const raw = String(token || '').trim();
        if (!raw || raw === 'off' || raw === 'clear') return { type: 'off' };
        let uid = /^\d+$/.test(raw) ? raw : '';
        let name = '';
        if (!uid) {
            const hit = (posts || []).find(p => p.name && p.name.toLowerCase() === raw.toLowerCase());
            if (!hit || !hit.uid) return { error: 'No uid for that name in the loaded posts. Use author <uid>.' };
            uid = hit.uid;
            name = hit.name;
        }
        const u = new URL('/read.php', location.href);
        if (tid) u.searchParams.set('tid', tid);
        u.searchParams.set('authorid', uid);
        u.searchParams.delete('page');
        return { type: 'author', uid, name, href: u.href };
    }

    function userCard(token) {
        const raw = String(token || '').trim();
        const posts = loadedPosts();
        let uid = /^\d+$/.test(raw) ? raw : '';
        let name = '';
        if (!raw) {
            name = currentUser();
            return { name: name || 'reader', uid: '', loc: '', floors: [] };
        }
        if (!uid) {
            const hit = posts.find(p => p.name && p.name.toLowerCase() === raw.toLowerCase());
            if (hit) { uid = hit.uid; name = hit.name; }
        }
        const mine = posts.filter(p => (uid && p.uid === uid) || (name && p.name === name));
        if (!name && mine[0]) name = mine[0].name;
        const loc = uid && locMap[uid] ? locMap[uid] : '';
        return {
            name: name || raw,
            uid,
            loc,
            floors: mine.map(p => p.floor),
            href: uid ? new URL('/nuke.php?func=ucp&uid=' + encodeURIComponent(uid), location.href).href : '',
        };
    }

    function buildVotePayload(post, tid, fid) {
        if (!post || !post.pid) return { error: 'That floor has no pid, so it cannot be recommended.' };
        const link = document.querySelector('a[href*="recommend"][href*="' + post.pid + '"], a[href*="post_recommend"]');
        const href = link && link.getAttribute('href') && !/^javascript:/i.test(link.getAttribute('href')) ? link.getAttribute('href') : '';
        return {
            action: href || '/nuke.php?__output=11',
            method: 'POST',
            acceptCharset: 'UTF-8',
            fields: [
                { name: '__lib', value: 'post_recommend' },
                { name: '__act', value: 'recommend' },
                { name: '__output', value: '11' },
                { name: 'pid', value: String(post.pid) },
                { name: 'tid', value: String(tid || '') },
                { name: 'fid', value: String(fid || '') },
                { name: 'value', value: '1' },
            ],
            body: 'Upvote #' + post.floor + ' ' + (post.name || '') + ' pid=' + post.pid + ' current ' + (post.likes === '' ? '0' : formatScore(post.likes)),
        };
    }

    function recommendScore(raw) {
        const match = String(raw || '').match(/-?\d+/);
        return match ? String(parseInt(match[0], 10)) : '0';
    }

    function formatScore(likes) {
        if (likes === '' || likes == null) return '';
        const n = Number(likes);
        if (!Number.isFinite(n)) return '';
        return n > 0 ? '+' + n : String(n);
    }

    function bookmarkActionHref(doc) {
        const links = [...(doc || document).querySelectorAll('a[href]')];
        const hit = links.find(a => {
            const href = a.getAttribute('href') || '';
            if (!href || /^javascript:/i.test(href)) return false;
            let path = href;
            try {
                const u = new URL(href, location.href);
                path = u.pathname + u.search;
            } catch (err) { path = href; }
            const low = path.toLowerCase();
            // thread.php?favor=1 is the favorites list, not the add/remove call.
            if (/thread\.php/.test(low)) return false;
            return /topic_favor/.test(low) || (/nuke\.php/.test(low) && /favor/.test(low));
        });
        return hit ? hit.getAttribute('href') : '';
    }

    function buildBookmarkPayload(opts) {
        opts = opts || {};
        const remove = !!opts.remove;
        const link = bookmarkActionHref(document);
        return {
            action: link || '/nuke.php?__output=11',
            method: 'POST',
            acceptCharset: 'UTF-8',
            fields: [
                { name: '__lib', value: 'topic_favor' },
                { name: '__act', value: remove ? 'del' : 'add' },
                { name: '__output', value: '11' },
                { name: 'tid', value: String(opts.tid || '') },
                { name: 'fid', value: String(opts.fid || '') },
            ],
            body: (remove ? 'Remove bookmark' : 'Bookmark thread') + ' tid=' + (opts.tid || '') + (opts.title ? ' ' + opts.title : ''),
        };
    }

    function rememberThread(entry, remove) {
        const tid = String(entry.tid || '');
        if (!tid) return;
        savedThreads = (savedThreads || []).filter(t => String(t.tid) !== tid);
        if (!remove) savedThreads.unshift({ tid, fid: String(entry.fid || ''), title: entry.title || ('tid ' + tid) });
        if (savedThreads.length > 200) savedThreads.length = 200;
        GM_setValue('cad_threads', savedThreads);
    }

    function buildThreadPayload(form, opts) {
        opts = opts || {};
        const fields = formFields(form);
        const contentName = contentFieldName(form);
        if (!contentName) return { error: 'This new-thread form has no content field.' };
        if (!String(opts.subject || '').trim()) return { error: 'A new thread needs a title.' };
        if (!String(opts.text || '').trim()) return { error: 'Write the thread body first.' };
        fields.forEach(f => { if (f.name === contentName) f.value = opts.text; });
        const subjectName = ['post_subject', 'subject', 'title'].find(n => fields.some(f => f.name === n)) || 'post_subject';
        const subject = fields.find(f => f.name === subjectName);
        if (subject) subject.value = opts.subject;
        else fields.push({ name: subjectName, value: opts.subject });
        const actionField = fields.find(f => f.name === 'action');
        if (actionField) actionField.value = 'new';
        else fields.push({ name: 'action', value: 'new' });
        ensureField(fields, 'fid', opts.fid || pageFid());
        ensureField(fields, 'step', '2');
        return {
            action: form.getAttribute('action') || '/post.php?action=new',
            method: (form.getAttribute('method') || 'POST').toUpperCase(),
            acceptCharset: form.getAttribute('accept-charset') || 'GBK',
            fields,
            contentName,
            body: opts.subject + '\n\n' + opts.text,
        };
    }

    function opModeOn() {
        return store.opOnly && !!lastData && lastData.kind === 'posts' && !!opUidSticky;
    }

    function withAuthorid(u) {
        if (!opModeOn()) return u;
        try {
            const x = new URL(u, location.href);
            if (x.pathname.includes('read.php')) x.searchParams.set('authorid', opUidSticky);
            return x.href;
        } catch (err) { return u; }
    }

    function pageNav(dir) {
        const pager = (lastData && lastData.pager) || [];
        const pick = dir > 0
            ? pager.find(l => /^(\u4e0b\u4e00\u9875|\u4e0b\u9875|>{1,2})$/.test(l.t))
            : pager.find(l => /^(\u4e0a\u4e00\u9875|\u4e0a\u9875|<{1,2})$/.test(l.t));
        if (pick) { location.href = withAuthorid(pick.href); return; }
        const u = new URL(location.href);
        const cur = parseInt(u.searchParams.get('page') || '1', 10);
        const nxt = cur + dir;
        if (nxt < 1) return;
        u.searchParams.set('page', String(nxt));
        location.href = withAuthorid(u.href);
    }

    function jumpPost(n) {
        const pager = (lastData && lastData.pager) || [];
        const hit = pager.find(l => l.t === String(n));
        if (hit) { location.href = withAuthorid(hit.href); return; }
        const u = new URL(location.href);
        u.searchParams.set('page', String(n));
        location.href = withAuthorid(u.href);
    }

    function contextLine(data) {
        const ctx = viewBits();
        if (data && data.kind === 'topics') {
            const n = (data.topics || []).reduce((a, t) => a + (t.sep ? 0 : 1), 0);
            return [ctx.key ? 'search: ' + ctx.key : data.board, n + ' topics', ctx.sort].filter(Boolean).join(' · ');
        }
        if (data && data.kind === 'posts') {
            const list = store.opOnly ? (data.posts || []).filter(p => p.isOP || p.sep) : (data.posts || []);
            const n = list.reduce((a, p) => a + (p.sep ? 0 : 1), 0);
            const label = store.opOnly
                ? (n ? n + ' OP posts' : (autoPageLoading ? 'loading OP posts' : 'no OP posts on this page'))
                : n + ' posts';
            return [label, ctx.filter, ctx.sort].filter(Boolean).join(' · ');
        }
        return 'No thread or board on this page. /help · /board fid';
    }

    function viewBits() {
        let order = '';
        let key = '';
        let author = '';
        try {
            const u = new URL(location.href);
            order = u.searchParams.get('order_by') || '';
            key = u.searchParams.get('key') || '';
            author = u.searchParams.get('authorid') || '';
        } catch (err) { /* keep defaults */ }
        const sort = /postdate/i.test(order) ? 'latest post' : (order || (key ? '' : 'latest reply'));
        const filter = store.opOnly ? 'OP only' : (author ? 'author ' + author : '');
        return { order, key, author, sort, filter };
    }

    function clearToggleLeak() {
        if (!inputEl) return;
        const key = (store.toggleKey || '`').split('+').pop();
        const v = inputEl.value || typed || '';
        if (v && (v === key || v === '`')) {
            typed = '';
            inputEl.value = '';
            renderApp();
        }
    }

    function focusPrompt() {
        const delay = suppressToggleChar ? 80 : 0;
        setTimeout(() => {
            if (!store.on || covered || !inputEl) return;
            const active = document.activeElement;
            if (active && active !== inputEl && root && !root.contains(active) && active.blur) active.blur();
            inputEl.focus();
            clearToggleLeak();
        }, delay);
    }

    function focusInput(preset) {
        if (!inputEl) return;
        if (typeof preset === 'string') {
            typed = preset;
            inputEl.value = preset;
            renderApp();
        }
        inputEl.focus();
        const len = inputEl.value.length;
        try { inputEl.setSelectionRange(len, len); } catch (err) { /* ignore */ }
    }

    function lsOut() {
        if (!lastData || lastData.kind === 'idle') {
            if (!boards.length) return [line('Nothing loaded. Try help, board list, or board fid <fid>.', 'cad-faint')];
            return [line('favorites', 'cad-sect')].concat(boards.map((b, i) =>
                line('<span class="cad-topicnum">' + (i + 1) + '</span> ' + esc(b.name) + ' <span class="cad-faint">fid=' + esc(String(b.fid)) + '</span>')));
        }
        if (lastData.kind === 'topics') {
            const list = lastData.topics.filter(t => !t.sep);
            return [line(list.length + ' topics', 'cad-faint')].concat(list.map((t, i) =>
                line('<span class="cad-topicnum">' + (i + 1) + '</span> ' + esc(t.title) + ' <span class="cad-faint">· ' + esc(t.replies || '0') + ' replies</span>')));
        }
        if (lastData.kind === 'posts') {
            const list = lastData.posts.filter(p => !p.sep);
            return [line(list.length + ' posts', 'cad-faint')].concat(list.map(p => line(esc(p.head), 'cad-faint')));
        }
        return [line('Nothing loaded.', 'cad-faint')];
    }

    function openN(n) {
        if (!lastData || lastData.kind !== 'topics') {
            finish('open ' + n, [line('This is not a topic list.', 'cad-faint')]);
            return;
        }
        const list = lastData.topics.filter(t => !t.sep);
        const topic = list[n - 1];
        if (!topic) {
            finish('open ' + n, [line('No topic ' + n + ' (' + list.length + ' loaded).', 'cad-faint')]);
            return;
        }
        location.href = topic.href;
    }

    function commandPrefix(v) {
        const raw = String(v || '');
        const slash = raw.startsWith('/');
        return { slash, rest: slash ? raw.slice(1) : raw, raw };
    }

    function slashHits(v) {
        const { rest } = commandPrefix(v);
        const q = rest.toLowerCase();
        return CMDS.filter(c => ('/' + c).startsWith('/' + q) || c.startsWith(q));
    }

    function applyCompletion(cmd, slash) {
        const next = (slash ? '/' : '') + cmd + (NEEDS_ARG.has(cmd) ? ' ' : '');
        typed = next;
        slashIndex = 0;
        renderApp();
        if (inputEl) {
            inputEl.value = next;
            try { inputEl.setSelectionRange(next.length, next.length); } catch (err) { /* ignore */ }
            inputEl.focus();
        }
        return next;
    }

    function tabComplete(v) {
        const { slash, rest } = commandPrefix(v);
        const hits = slashHits(v);
        if (hits.length === 1) {
            applyCompletion(hits[0], slash);
        } else if (hits.length > 1) {
            let p = hits[0];
            for (const c of hits) while (!c.startsWith(p)) p = p.slice(0, -1);
            if (p.length > rest.length) {
                typed = (slash ? '/' : '') + p;
                renderApp();
                if (inputEl) {
                    inputEl.value = typed;
                    try { inputEl.setSelectionRange(typed.length, typed.length); } catch (err) { /* ignore */ }
                }
            } else finish(v, [line(esc(hits.map(c => (slash ? '/' : '') + c).join('  ')), 'cad-faint')]);
        }
    }

    function findFloor(n) {
        if (!lastData || lastData.kind !== 'posts') return null;
        const want = Number(n);
        return lastData.posts.find(p => !p.sep && p.floor === want) || null;
    }

    function parseTarget(rest) {
        const trimmed = String(rest || '').trim();
        if (!trimmed) return { text: '' };
        const m = trimmed.match(/^(\d+)(?:\s+([\s\S]*))?$/);
        if (!m) return { text: trimmed };
        const floor = parseInt(m[1], 10);
        const post = findFloor(floor);
        if (post) return { floor, post, text: (m[2] || '').trim() };
        if (lastData && lastData.kind === 'posts') return { error: 'No floor #' + floor + ' in the loaded posts.' };
        return { text: trimmed };
    }

    /* ================= reply ================= */
    function quoteBlock(quote, tid) {
        const excerpt = String(quote.text || '').replace(/%%IMG\d+%%/g, '[image]').split('\n').slice(0, 12).join('\n');
        const pidTag = quote.pid ? '[pid=' + quote.pid + ',' + (tid || 0) + ',' + quote.floor + ']Reply[/pid] ' : '';
        const who = quote.uid ? '[uid=' + quote.uid + ']' + (quote.author || quote.uid) + '[/uid]' : (quote.author || 'user');
        return '[quote]' + pidTag + '[b]Post by ' + who + ' (#' + quote.floor + '):[/b]\n' + excerpt + '[/quote]\n';
    }

    function findReplyForm(doc) {
        const forms = [...(doc || document).querySelectorAll('form')].filter(f => {
            const action = (f.getAttribute('action') || '').toLowerCase();
            const id = (f.id || '').toLowerCase();
            const name = (f.getAttribute('name') || '').toLowerCase();
            return id === 'postform' || name === 'postform' || action.includes('post.php');
        });
        return forms.find(contentFieldName) || forms[0] || null;
    }

    function contentFieldName(form) {
        if (!form) return '';
        const names = [...form.querySelectorAll('textarea[name], input[name]')].map(el => el.name);
        for (const name of ['post_content', 'content', 'message']) {
            if (names.includes(name)) return name;
        }
        const area = form.querySelector('textarea[name]');
        return area ? area.name : '';
    }

    function formFields(form) {
        const fields = [];
        form.querySelectorAll('input, textarea, select').forEach(el => {
            if (!el.name || el.disabled) return;
            const type = (el.type || '').toLowerCase();
            if (type === 'button' || type === 'submit' || type === 'reset' || type === 'image' || type === 'file') return;
            if ((type === 'checkbox' || type === 'radio') && !el.checked) return;
            let value = el.value;
            if (el.tagName === 'SELECT') {
                const opt = el.selectedOptions && el.selectedOptions[0];
                value = opt ? opt.value : el.value;
            }
            fields.push({ name: el.name, value: value == null ? '' : String(value) });
        });
        return fields;
    }

    function ensureField(fields, name, value) {
        if (value == null || value === '') return;
        const found = fields.find(f => f.name === name);
        if (found) { if (!found.value) found.value = String(value); }
        else fields.push({ name, value: String(value) });
    }

    function buildReplyPayload(form, opts) {
        opts = opts || {};
        const fields = formFields(form);
        const contentName = contentFieldName(form);
        if (!contentName) return { error: 'This reply form has no content field.' };
        const quote = opts.quote || null;
        const body = (quote ? quoteBlock(quote, opts.tid || curTid()) : '') + (opts.text || '');
        if (!String(body).trim()) return { error: 'Write a reply first.' };
        fields.forEach(f => { if (f.name === contentName) f.value = body; });
        if (quote && quote.pid) {
            const pidField = fields.find(f => f.name === 'pid');
            if (pidField) pidField.value = String(quote.pid);
            else fields.push({ name: 'pid', value: String(quote.pid) });
        }
        ensureField(fields, 'tid', opts.tid || curTid());
        ensureField(fields, 'fid', opts.fid || pageFid());
        ensureField(fields, 'action', 'reply');
        ensureField(fields, 'step', '2');
        return {
            action: form.getAttribute('action') || '/post.php',
            method: (form.getAttribute('method') || 'POST').toUpperCase(),
            acceptCharset: form.getAttribute('accept-charset') || 'GBK',
            fields,
            contentName,
            body,
        };
    }

    function interpretReplyResponse(res) {
        res = res || {};
        const plain = String(res.text || '')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (/\u8bf7\u5148\u767b\u5f55|\u5c1a\u672a\u767b\u5f55|\u8bf7\u767b\u5f55|\u4f60\u8fd8\u6ca1\u6709\u767b\u5f55|not logged in/i.test(plain)) {
            return { ok: false, message: 'NGA says you are not logged in. Sign in on the site, then retry. ' + plain.slice(0, 180) };
        }
        if (/\u53d1\u5e16\u5b8c\u6bd5|\u56de\u590d\u5b8c\u6bd5|\u53d1\u8868\u6210\u529f|\u64cd\u4f5c\u6210\u529f|\u56de\u590d\u6210\u529f/.test(plain)) {
            return { ok: true, message: 'Reply submitted. Refresh the thread to see it.' };
        }
        if (!res.ok) return { ok: false, message: ('NGA reply failed (HTTP ' + (res.status || 0) + '). ' + plain).trim() };
        if (/\u9519\u8bef|\u5931\u8d25|\u9a8c\u8bc1\u7801|\u6ca1\u6709\u6743\u9650|\u7981\u6b62|\u592a\u77ed/.test(plain)) {
            return { ok: false, message: plain.slice(0, 300) || 'NGA rejected the reply.' };
        }
        if (res.url && /read\.php/.test(res.url)) return { ok: true, message: 'Reply submitted. Refresh the thread to see it.' };
        return { ok: false, message: plain.slice(0, 300) || ('Unexpected reply response (HTTP ' + (res.status || 0) + ').') };
    }

    function replyBody(pending) {
        return (pending.quote ? quoteBlock(pending.quote, curTid()) : '') + (pending.text || '');
    }

    function confirmHtml(body) {
        const quote = pendingReply && pendingReply.quote;
        const form = findReplyForm(document);
        const names = form ? formFields(form).map(f => f.name).filter((n, i, a) => a.indexOf(n) === i).join(', ') : '';
        const where = 'tid ' + (curTid() || '?') + ' · fid ' + (pageFid() || 'unknown') + ' · ' + (
            quote ? ('quote #' + quote.floor + (quote.pid ? ' · pid ' + quote.pid : ' · no pid on that floor')) : 'new reply'
        );
        const fields = names
            ? 'Form fields copied from this page: ' + names + '. Hidden values stay in the form and are not shown here.'
            : 'The reply form is not in this page. y loads post.php for this thread and uses its hidden fields.';
        return [
            line(esc('Nothing is sent until you confirm.\n' + where), 'cad-faint'),
            '<pre class="cad-preview">' + esc(body) + '</pre>',
            line(esc(fields), 'cad-faint'),
            line('Submit this reply? <b>y</b> sends it, <b>n</b> cancels, <b>edit</b> revises.', 'cad-faint'),
        ].join('');
    }

    function beginReply(opts) {
        if (!curTid()) {
            finish('reply', [line('Open a thread before replying.', 'cad-faint')]);
            return;
        }
        const post = opts.post || null;
        const quote = post ? {
            pid: post.pid || '',
            floor: post.floor,
            author: post.name || '',
            uid: post.uid || '',
            text: post.text || '',
        } : (opts.quote || null);
        const replyText = opts.text || '';
        if (opts.compose || !String(replyText).trim()) {
            pendingReply = { phase: 'compose', kind: 'reply', quote, text: replyText, sending: false };
            composeText = replyText;
            panel = null;
            if (root) renderApp();
            return;
        }
        pendingReply = { phase: 'confirm', kind: 'reply', quote, text: replyText, sending: false };
        panel = { title: 'reply', html: confirmHtml(replyBody(pendingReply)) };
        if (root) renderApp();
    }

    function cmdReply(rest, kind) {
        const parsed = parseTarget(rest);
        if (parsed.error) {
            finish(kind, [line(esc(parsed.error), 'cad-faint')]);
            return;
        }
        if (kind === 'quote' && !parsed.post) {
            finish('quote', [line(esc('usage: quote <floor> [text]'), 'cad-faint')]);
            return;
        }
        beginReply({ post: parsed.post || null, text: parsed.text || '', compose: !String(parsed.text || '').trim() });
    }

    async function loadNewThreadForm() {
        const live = [...document.querySelectorAll('form')].find(f => {
            const action = ((f.getAttribute('action') || '') + ' ' + (f.querySelector('input[name="action"]') || {}).value).toLowerCase();
            return action.includes('new') && contentFieldName(f);
        });
        if (live) return live;
        const fid = pageFid();
        if (!fid) throw new Error('Open a board before posting a new thread. board fid <fid> goes there.');
        const url = new URL('/post.php', location.href);
        url.searchParams.set('action', 'new');
        url.searchParams.set('fid', fid);
        let res;
        try { res = await fetch(url.href, { credentials: 'include' }); }
        catch (err) { throw new Error('Could not load the new-thread form.'); }
        if (!res.ok) throw new Error('Could not load the new-thread form (HTTP ' + res.status + ').');
        const htmlText = await decodeRes(res);
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const form = findReplyForm(doc);
        if (!form || !contentFieldName(form)) {
            const bodyText = doc.body ? doc.body.textContent : '';
            if (/\u8bf7\u5148\u767b\u5f55|\u5c1a\u672a\u767b\u5f55|\u8bf7\u767b\u5f55|not logged in/i.test(bodyText))
                throw new Error('NGA says you are not logged in. Sign in on the site, then retry.');
            throw new Error('NGA did not return a new-thread form.');
        }
        return form;
    }

    async function loadReplyForm() {
        const live = findReplyForm(document);
        if (live && contentFieldName(live)) return live;
        const tid = curTid();
        if (!tid) throw new Error('Open a thread before replying.');
        const url = new URL('/post.php', location.href);
        url.searchParams.set('action', 'reply');
        url.searchParams.set('tid', tid);
        const fid = pageFid();
        if (fid) url.searchParams.set('fid', fid);
        let res;
        try { res = await fetch(url.href, { credentials: 'include' }); }
        catch (err) { throw new Error('Could not load the reply form.'); }
        if (!res.ok) throw new Error('Could not load the reply form (HTTP ' + res.status + ').');
        const htmlText = await decodeRes(res);
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const form = findReplyForm(doc);
        if (!form || !contentFieldName(form)) {
            const bodyText = doc.body ? doc.body.textContent : '';
            if (/\u8bf7\u5148\u767b\u5f55|\u5c1a\u672a\u767b\u5f55|\u8bf7\u767b\u5f55|not logged in/i.test(bodyText))
                throw new Error('NGA says you are not logged in. Sign in on the site, then retry.');
            throw new Error('NGA did not return a reply form.');
        }
        return form;
    }

    function submitViaIframe(payload) {
        return new Promise((resolve, reject) => {
            let iframe = document.getElementById('cad__replyframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'cad__replyframe';
                iframe.name = 'cad__replyframe';
                iframe.hidden = true;
                iframe.setAttribute('aria-hidden', 'true');
                document.body.appendChild(iframe);
            }
            const previous = document.getElementById('cad__replyform');
            if (previous) previous.remove();
            const form = document.createElement('form');
            form.id = 'cad__replyform';
            form.method = payload.method || 'POST';
            form.action = new URL(payload.action || '/post.php', location.href).href;
            form.target = 'cad__replyframe';
            form.acceptCharset = payload.acceptCharset || 'GBK';
            form.style.display = 'none';
            payload.fields.forEach(f => {
                const input = document.createElement('textarea');
                input.name = f.name;
                input.value = f.value == null ? '' : String(f.value);
                form.appendChild(input);
            });
            document.body.appendChild(form);
            let settled = false;
            const timer = setTimeout(() => finish(reject, new Error('Timed out waiting for NGA.')), 20000);
            const finish = (fn, arg) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                iframe.onload = null;
                form.remove();
                fn(arg);
            };
            iframe.onload = () => {
                let href = '';
                try {
                    href = iframe.contentWindow.location.href || '';
                    if (!href || href === 'about:blank') return;
                    const textBody = iframe.contentDocument && iframe.contentDocument.documentElement
                        ? iframe.contentDocument.documentElement.outerHTML : '';
                    finish(resolve, { ok: true, status: 200, url: href, text: textBody });
                } catch (err) {
                    finish(resolve, {
                        ok: false,
                        status: 0,
                        url: href,
                        text: '',
                        message: 'NGA responded in a document this page cannot read. Check the thread before sending again.',
                    });
                }
            };
            form.submit();
        });
    }

    async function submitReplyPayload(payload) {
        if (typeof globalThis.__cadMockSubmit === 'function') {
            const result = await globalThis.__cadMockSubmit(payload);
            if (!result || typeof result.ok !== 'boolean') throw new Error('Reply was not submitted.');
            return result;
        }
        const raw = await submitViaIframe(payload);
        if (raw && raw.message && raw.ok === false && !raw.text) return raw;
        return interpretReplyResponse(raw);
    }

    async function confirmSend() {
        if (!pendingReply || pendingReply.phase !== 'confirm' || pendingReply.sending) return;
        pendingReply.sending = true;
        const snapshot = pendingReply;
        const title = snapshot.kind || 'reply';
        panel = { title, html: line('Sending…', 'cad-faint') };
        renderApp();
        try {
            let payload;
            if (snapshot.kind === 'vote') payload = buildVotePayload(snapshot.post, curTid(), pageFid());
            else if (snapshot.kind === 'bookmark') payload = buildBookmarkPayload(snapshot);
            else if (snapshot.kind === 'thread') {
                const form = await loadNewThreadForm();
                payload = buildThreadPayload(form, { subject: snapshot.subject, text: snapshot.text, fid: pageFid() });
            } else {
                const form = await loadReplyForm();
                payload = buildReplyPayload(form, {
                    text: snapshot.text,
                    quote: snapshot.quote,
                    tid: curTid(),
                    fid: pageFid(),
                });
            }
            if (payload.error) throw new Error(payload.error);
            const result = await submitReplyPayload(payload);
            if (result.ok && snapshot.kind === 'bookmark') rememberThread(snapshot, snapshot.remove);
            if (!result.ok) {
                snapshot.sending = false;
                pendingReply = snapshot;
                panel = {
                    title: 'reply',
                    html: line(esc(result.message || 'NGA rejected the reply.'), '')
                        + line('The reply was not posted. y retries, n cancels, edit revises.', 'cad-faint'),
                };
            } else {
                pendingReply = null;
                composeText = '';
                panel = { title: 'reply', html: line(esc(result.message || 'Reply submitted.'), 'cad-faint') };
            }
        } catch (err) {
            if (pendingReply === snapshot) pendingReply.sending = false;
            panel = { title: 'reply', html: line(esc(err && err.message ? err.message : String(err)), '') };
        }
        renderApp();
    }

    function previewCompose() {
        if (!pendingReply || pendingReply.phase !== 'compose') return;
        pendingReply.text = composeText;
        if (pendingReply.kind === 'thread') {
            if (!String(pendingReply.subject || '').trim() || !String(composeText || '').trim()) {
                finish('post', [line('A new thread needs a title and a body. post <title>, then preview.', 'cad-faint')]);
                return;
            }
            pendingReply.phase = 'confirm';
            pendingReply.sending = false;
            panel = {
                title: 'post',
                html: line(esc(pendingReply.subject), 'cad-faint')
                    + '<pre class="cad-preview">' + esc(composeText) + '</pre>'
                    + line('Submit this new thread? <b>y</b> sends it, <b>n</b> cancels, <b>edit</b> revises.', 'cad-faint'),
            };
            renderApp();
            return;
        }
        const empty = !String(composeText || '').trim() && !(pendingReply.quote && (pendingReply.quote.text || pendingReply.quote.pid));
        if (empty) {
            finish('reply', [line('Write a reply first.', 'cad-faint')]);
            return;
        }
        pendingReply.phase = 'confirm';
        pendingReply.sending = false;
        panel = { title: 'reply', html: confirmHtml(replyBody(pendingReply)) };
        renderApp();
    }

    async function loadNoti() {
        const link = document.querySelector('a[href*="func=noti"], a[href*="__lib=noti"], a[href*="action=noti"]');
        const url = link ? new URL(link.getAttribute('href'), location.href).href : new URL('/nuke.php?func=noti', location.href).href;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error('Could not load notifications (HTTP ' + res.status + ').');
        const htmlText = await decodeRes(res);
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const rows = collectThreadLinks(doc, url);
        const login = /\u8bf7\u5148\u767b\u5f55|\u5c1a\u672a\u767b\u5f55|\u8bf7\u767b\u5f55|not logged in/i.test(doc.body ? doc.body.textContent : '');
        return { rows: rows.slice(0, 20), url, login };
    }

    function collectThreadLinks(doc, baseUrl) {
        const out = [];
        const seen = new Set();
        (doc || document).querySelectorAll('a[href*="read.php"], a[href*="tid="]').forEach(a => {
            const href = a.getAttribute('href') || '';
            const title = text(a);
            if (!title || title.length < 2 || seen.has(href)) return;
            seen.add(href);
            let abs = href;
            try { abs = new URL(href, baseUrl || location.href).href; } catch (err) { abs = href; }
            out.push({ title, href: abs });
        });
        return out;
    }

    function favoriteLinks(doc) {
        const data = extractTopics(doc);
        if (data && data.topics && data.topics.filter(t => !t.sep).length) return data.topics.filter(t => !t.sep);
        return collectThreadLinks(doc, location.href);
    }

    async function cmdUser(token) {
        const card = userCard(token);
        let name = card.name;
        let loc = card.loc;
        if (card.uid) {
            try {
                const info = await fetchUcp(card.uid);
                if (info && info.name) name = info.name;
                if (info && info.loc) { loc = info.loc; locMap[card.uid] = info.loc; }
            } catch (err) { /* keep the name already on the page */ }
        }
        const href = card.href || (card.uid ? new URL('/nuke.php?func=ucp&uid=' + encodeURIComponent(card.uid), location.href).href : '');
        panel = {
            title: 'user',
            html: [
                line(esc((name || 'reader') + (card.uid ? ' · uid ' + card.uid : '') + (loc ? ' · ' + loc : '')), 'cad-faint'),
                href ? line('<a class="cad-pagelink" href="' + esc(href) + '">profile</a>', 'cad-faint') : line('No profile id on this page.', 'cad-faint'),
                line(card.floors && card.floors.length ? esc('floors on this page: ' + card.floors.join(', ')) : 'No posts by that person are loaded.', 'cad-faint'),
            ].join(''),
        };
        renderApp();
    }

    function sourceOfName(uid) {
        return nameSources[String(uid)] || (nameCache[String(uid)] ? 'cache' : (userNameMap[String(uid)] ? 'page-dom' : ''));
    }

    async function cmdDebugNames() {
        if (lastData && lastData.kind === 'posts') {
            applyCachedNames(lastData.posts);
            applyCachedNames(lastData.hot);
        }
        const posts = ((lastData && lastData.posts) || []).filter(p => !p.sep);
        const byUid = new Map();
        posts.forEach(p => {
            if (!p.uid) return;
            if (!byUid.has(p.uid)) byUid.set(p.uid, { uid: p.uid, name: p.name, floors: [] });
            const row = byUid.get(p.uid);
            row.floors.push(p.floor);
            if (p.name && !isUidLabel(p.name)) row.name = p.name;
        });
        const authors = [...byUid.values()];
        const resolved = authors.filter(a => a.name && !isUidLabel(a.name));
        const unresolved = authors.filter(a => !a.name || isUidLabel(a.name));
        const lines = [
            line('<b>debug names</b> · v' + VERSION, 'cad-sect'),
            line(esc(resolved.length + ' resolved, ' + unresolved.length + ' unresolved, ' + authors.length + ' unique authors on ' + posts.length + ' posts'), 'cad-faint'),
        ];
        if (resolved.length) {
            const sample = resolved.slice(0, 12).map(a => {
                const src = sourceOfName(a.uid) || 'unknown';
                return a.name + ' (' + a.uid + ', ' + src + ')';
            }).join(', ');
            lines.push(line(esc('resolved: ' + sample + (resolved.length > 12 ? '…' : '')), 'cad-faint'));
        }
        if (!unresolved.length) {
            lines.push(line('Every loaded author already has a real name. Sources are on-page (userInfo / DOM); ucp was not called.', 'cad-faint'));
            panel = { title: 'debug names', html: lines.join('') };
            renderApp();
            return;
        }
        const first = unresolved[0];
        lines.push(line(esc('first unresolved: uid ' + first.uid + ' · floors ' + first.floors.join(', ') + ' · display ' + (first.name || '—')), 'cad-faint'));
        if (ucpGaveUp) {
            lines.push(line('ucp skipped: a previous request in this session returned HTTP 503. Names come from the page only.', 'cad-faint'));
            if (lastNameProbe) {
                lines.push(line(esc('last ucp: HTTP ' + (lastNameProbe.status || '—') + ' ' + (lastNameProbe.url || '')), 'cad-faint'));
                lines.push(line('decoded body (first 300 characters):', 'cad-faint'));
                lines.push('<pre class="cad-preview">' + esc(lastNameProbe.bodyHead || '(empty)') + '</pre>');
            }
            panel = { title: 'debug names', html: lines.join('') };
            renderApp();
            return;
        }
        panel = { title: 'debug names', html: lines.join('') + line('Probing NGA ucp…', 'cad-faint') };
        renderApp();
        const result = await fetchUcp(first.uid);
        const probe = (result && result.report) || lastNameProbe;
        if (!probe) {
            lines.push(line('No probe result. The fetch may have been blocked.', 'cad-faint'));
        } else {
            lines.push(line(esc('URL: ' + probe.url), 'cad-faint'));
            lines.push(line(esc('HTTP ' + (probe.status || '—') + (probe.contentType ? ' · ' + probe.contentType : '')), 'cad-faint'));
            lines.push(line('decoded body (first 300 characters):', 'cad-faint'));
            lines.push('<pre class="cad-preview">' + esc(probe.bodyHead || '(empty)') + '</pre>');
            if (probe.parseError) lines.push(line(esc('parse error: ' + probe.parseError), ''));
            else {
                const bit = probe.name
                    ? 'JSON parsed · name ' + probe.name + (probe.loc ? ' · loc ' + probe.loc : '')
                    : 'JSON parsed · no display name in the payload' + (probe.loc ? ' · loc ' + probe.loc : '');
                lines.push(line(esc(bit), 'cad-faint'));
            }
            if (result && result.name) {
                applyCachedNames(lastData && lastData.posts);
                applyCachedNames(lastData && lastData.hot);
                lines.push(line(esc('applied name: ' + result.name + ' (ucp)'), 'cad-faint'));
                scheduleLocRender();
            }
            if (result && result.blocked) {
                lines.push(line('ucp is now stopped for this session after HTTP 503. Further names come from the page only.', 'cad-faint'));
            }
        }
        panel = { title: 'debug names', html: lines.join('') };
        renderApp();
    }

    async function cmdNoti() {
        panel = { title: 'noti', html: line('Loading notifications…', 'cad-faint') };
        renderApp();
        try {
            const data = await loadNoti();
            const lines = [line(esc('Source: ' + data.url), 'cad-faint')];
            if (data.login && !data.rows.length) lines.push(line('NGA says you are not logged in. Sign in on the site, then retry.', ''));
            else if (!data.rows.length) lines.push(line('No notification links were found on that page.', 'cad-faint'));
            data.rows.forEach(r => lines.push(line('<a class="cad-pagelink" href="' + esc(r.href) + '">' + esc(r.title) + '</a>')));
            panel = { title: 'noti', html: lines.join('') };
        } catch (err) {
            panel = { title: 'noti', html: line(esc(err && err.message ? err.message : String(err)), '') };
        }
        renderApp();
    }

    async function cmdBookmarkList() {
        const local = (savedThreads || []).map(t => line('<a class="cad-pagelink" href="/read.php?tid=' + encodeURIComponent(t.tid) + '">' + esc(t.title) + '</a> <span class="cad-faint">tid=' + esc(String(t.tid)) + '</span>'));
        panel = { title: 'bookmark', html: line('Loading NGA favorites…', 'cad-faint') };
        renderApp();
        let remote = [];
        let note = '';
        try {
            const url = new URL('/thread.php?favor=1', location.href).href;
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error('Could not load favorites (HTTP ' + res.status + ').');
            const htmlText = await decodeRes(res);
            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
            remote = favoriteLinks(doc).slice(0, 30);
            if (!remote.length && /\u8bf7\u5148\u767b\u5f55|\u8bf7\u767b\u5f55|not logged in/i.test(doc.body ? doc.body.textContent : ''))
                note = 'NGA asked you to log in before listing favorites.';
        } catch (err) {
            note = err && err.message ? err.message : String(err);
        }
        const lines = [line('<b>saved in this browser</b>', 'cad-sect')];
        lines.push.apply(lines, local.length ? local : [line('None yet. bookmark on a thread, then y.', 'cad-faint')]);
        lines.push(line('<b>NGA favorite list</b>', 'cad-sect'));
        if (note) lines.push(line(esc(note), 'cad-faint'));
        remote.forEach((t, i) => lines.push(line('<span class="cad-topicnum">' + (i + 1) + '</span> <a class="cad-pagelink" href="' + esc(t.href) + '">' + esc(t.title) + '</a>')));
        if (!remote.length && !note) lines.push(line('The favorite page returned no topics.', 'cad-faint'));
        panel = { title: 'bookmark', html: lines.join('') };
        renderApp();
    }

    function finish(cmd, lines) {
        if (lines) panel = { title: cmd, html: lines.join('') };
        if (store.on && !root) build();
        else refresh(true);
    }

    function cancelNoun(kind) {
        if (kind === 'bookmark') return 'Bookmark';
        if (kind === 'thread') return 'New thread';
        if (kind === 'vote') return 'Vote';
        return 'Reply';
    }

    function runCmd(raw) {
        const cmd = normalizeCommand(raw);
        if (!cmd) return Promise.resolve();
        return Promise.resolve(dispatchCmd(cmd));
    }

    function dispatchCmd(cmd) {
        cmdHistory.push(cmd);
        if (cmdHistory.length > 100) cmdHistory.shift();
        const m = cmd.toLowerCase();

        if (pendingReply && pendingReply.phase === 'confirm') {
            if (pendingReply.sending) return;
            if (m === 'y' || m === 'yes') return confirmSend();
            if (m === 'n' || m === 'no' || m === 'cancel') {
                const noun = cancelNoun(pendingReply.kind);
                pendingReply = null;
                finish(noun, [line(noun + ' cancelled.', 'cad-faint')]);
                return;
            }
            if (m === 'edit') {
                composeText = pendingReply.text || '';
                pendingReply.phase = 'compose';
                pendingReply.sending = false;
                panel = null;
                renderApp();
                return;
            }
            finish('reply', [line('A reply is waiting. y sends it, n cancels, edit revises.', 'cad-faint')]);
            return;
        }
        if (pendingReply && pendingReply.phase === 'compose' && (m === 'send' || m === 'preview')) {
            previewCompose();
            return;
        }

        let out;
        if (m === 'help' || m === '?') out = helpOut();
        else if (m === 'clear' || m === 'cls') {
            if (pendingReply && pendingReply.sending) return;
            panel = null;
            pendingReply = null;
            composeText = '';
            refresh(true);
            return;
        }
        else if (m === 'exit' || m === 'quit' || m === 'q') {
            if (pendingReply && pendingReply.sending) return;
            pendingReply = null;
            toggleDisguise();
            return;
        }
        else if (m === 'debug names' || m === 'debug name') return cmdDebugNames();
        else if (m === 'version' || m === 'about')
            out = [line('NGA Code Agent Disguise <b>v' + VERSION + '</b> · ` toggles outside text fields · /help', 'cad-faint')];
        else if (m === 'pwd') out = [line(esc(cwdFor(lastData || { kind: 'idle' })), 'cad-faint')];
        else if (m === 'whoami') {
            const name = currentUser();
            out = [line(name
                ? esc(name) + ' — name taken from this NGA page header'
                : 'reader — no signed-in name found in the page header', 'cad-faint')];
        }
        else if (m.startsWith('sudo')) out = [line(esc('sudo: permission denied'), 'cad-faint')];
        else if (m === 'ls' || m === 'topics') out = lsOut();
        else if (/^open\s+\d+$/.test(m)) { openN(+m.match(/\d+$/)[0]); return; }
        else if (/^search\s*[:：]/i.test(cmd)) {
            let q = cmd.replace(/^search\s*[:：]\s*/i, '');
            let global = false;
            if (/^-(?:g|a|global|all)(?:\s+|$)/i.test(q)) {
                global = true;
                q = q.replace(/^-(?:g|a|global|all)(?:\s+|$)/i, '').trim();
            }
            if (!q) out = [line(esc('usage: search: <words> · search: -g <words>'), 'cad-faint')];
            else { doSearch(q, global); return; }
        }
        else if (m === 'boards') { out = boardCmd('list'); }
        else if (m === 'board' || m.startsWith('board ')) {
            const r = boardCmd(cmd.slice(5).trim());
            if (r === null) return;
            out = r;
        }
        else if (m === 'next page' || m === 'next') { pageNav(1); return; }
        else if (m === 'prev page' || m === 'previous page' || m === 'prev') { pageNav(-1); return; }
        else if (/^go\s+page\s+\d+$/.test(m)) { jumpPost(+m.match(/\d+$/)[0]); return; }
        else if (m === 'top') { if (bodyEl) bodyEl.scrollTop = 0; return; }
        else if (m === 'reply' || m.startsWith('reply ')) { cmdReply(cmd.slice(5).trim(), 'reply'); return; }
        else if (m === 'quote' || m.startsWith('quote ')) { cmdReply(cmd.slice(5).trim(), 'quote'); return; }
        else if (m === 'post' || m.startsWith('post ') || m === 'new' || m.startsWith('new ')) {
            const subject = cmd.replace(/^(post|new)\s*/i, '').trim();
            pendingReply = { phase: 'compose', kind: 'thread', subject, text: '', quote: null, sending: false };
            composeText = '';
            panel = null;
            renderApp();
            return;
        }
        else if (m === 'floor' || m.startsWith('floor ')) {
            const n = parseInt(cmd.replace(/^floor\s*/i, ''), 10);
            if (!Number.isFinite(n)) { out = [line(esc('usage: floor <n>'), 'cad-faint')]; }
            else if (!curTid()) { out = [line('Open a thread before jumping to a floor.', 'cad-faint')]; }
            else {
                const el = document.getElementById('cad-floor-' + n);
                if (el) {
                    try { el.scrollIntoView({ block: 'start' }); } catch (err) { if (bodyEl) bodyEl.scrollTop = el.offsetTop || 0; }
                    out = [line('Floor #' + n + ' is on this page.', 'cad-faint')];
                } else {
                    location.href = floorTarget(n, loadedPosts(), curTid()).href;
                    return;
                }
            }
        }
        else if (m === 'sort reply' || m === 'sort post' || m === 'sort new' || m === 'sort') {
            if (m === 'sort') out = [line(esc('usage: sort reply · sort post'), 'cad-faint')];
            else { location.href = sortTarget(m === 'sort post' || m === 'sort new' ? 'post' : 'reply'); return; }
        }
        else if (m === 'author' || m.startsWith('author ')) {
            const target = authorTarget(cmd.slice(6).trim(), loadedPosts(), curTid());
            if (target.error) out = [line(esc(target.error), 'cad-faint')];
            else if (target.type === 'off') {
                store.opOnly = false;
                opNextNo = null;
                opEnd = false;
                const u = new URL(location.href);
                u.searchParams.delete('authorid');
                location.href = u.href;
                return;
            } else if (!curTid()) out = [line('Open a thread before filtering by author.', 'cad-faint')];
            else {
                store.opOnly = false;
                location.href = target.href;
                return;
            }
        }
        else if (m === 'user' || m.startsWith('user ')) return cmdUser(cmd.slice(4).trim());
        else if (m === 'vote' || m.startsWith('vote ') || m === 'upvote' || m.startsWith('upvote ')) {
            const n = parseInt(cmd.replace(/^(vote|upvote)\s*/i, ''), 10);
            const post = findFloor(n);
            if (!post) out = [line(esc('usage: vote <floor>'), 'cad-faint')];
            else {
                const payload = buildVotePayload(post, curTid(), pageFid());
                if (payload.error) out = [line(esc(payload.error), 'cad-faint')];
                else {
                    pendingReply = { phase: 'confirm', kind: 'vote', post, text: '', sending: false };
                    panel = { title: 'vote', html: line(esc(payload.body), 'cad-faint') + line('Submit this vote? <b>y</b> sends it, <b>n</b> cancels.', 'cad-faint') };
                    renderApp();
                    return;
                }
            }
        }
        else if (m === 'bookmark list' || m === 'fav list' || m === 'favorites') return cmdBookmarkList();
        else if (m === 'bookmark' || m === 'fav' || m === 'unbookmark' || m === 'unfav') {
            if (!curTid()) out = [line('Open a thread to bookmark it.', 'cad-faint')];
            else {
                const remove = m === 'unbookmark' || m === 'unfav';
                const payload = buildBookmarkPayload({ tid: curTid(), fid: pageFid(), title: lastData && lastData.title, remove });
                pendingReply = { phase: 'confirm', kind: 'bookmark', tid: curTid(), fid: pageFid(), title: lastData && lastData.title, remove, text: '', sending: false };
                panel = { title: 'bookmark', html: line(esc(payload.body), 'cad-faint') + line('Submit this bookmark? <b>y</b> sends it, <b>n</b> cancels.', 'cad-faint') };
                renderApp();
                return;
            }
        }
        else if (m === 'noti' || m === 'notifications' || m === 'inbox') return cmdNoti();
        else if (m === 'theme' || m === 't') {
            cycleTheme();
            out = [line('theme → ' + store.style + ' ' + store.mode, 'cad-faint')];
        }
        else if (m === 'claude' || m === 'style claude') { store.style = 'claude'; applyAttrs(); out = [line('style → claude', 'cad-faint')]; }
        else if (m === 'codex' || m === 'style codex') { store.style = 'codex'; applyAttrs(); out = [line('style → codex', 'cad-faint')]; }
        else if (m === 'dark') { store.mode = 'dark'; applyAttrs(); out = [line('mode → dark', 'cad-faint')]; }
        else if (m === 'light') { store.mode = 'light'; applyAttrs(); out = [line('mode → light', 'cad-faint')]; }
        else if (m === 'img' || m === 'images') {
            store.img = !store.img;
            if (!store.img) revealedImages.clear();
            out = [line('images → ' + (store.img ? 'on (lazy thumbnails)' : 'off ([image] until you open one)'), 'cad-faint')];
        }
        else if (m === 'op' || m === 'op only') {
            cancelPageRequest();
            autoPageError = false;
            store.opOnly = !store.opOnly;
            nextPageUrl = null;
            loadedPages = new Set([location.href]);
            opNextNo = null;
            opEnd = false;
            if (store.opOnly) {
                if (!opUidSticky) {
                    const args = parsePostArgs(document);
                    opUidSticky = args.topicAuthor || '';
                    if (curTid()) opUidTid = curTid();
                }
                lastData = extract();
                const hasOP = lastData && lastData.posts && lastData.posts.some(p => p.isOP && !p.sep);
                if (!hasOP && opUidSticky) {
                    out = [line('op only → on. Loading the original poster\'s posts via authorid.', 'cad-faint')];
                    loadNextPage();
                } else {
                    out = [line('op only → on (author pages append below)', 'cad-faint')];
                }
            } else {
                lastData = extract();
                out = [line('op only → off', 'cad-faint')];
            }
        }
        else if (m === 'expand') {
            store.expand = !store.expand;
            out = [line('expand → ' + (store.expand ? 'on' : 'off'), 'cad-faint')];
        }
        else if (m === 'vim') {
            store.vim = !store.vim;
            out = [line('vim → ' + (store.vim ? 'on (h/l scroll; they do not change pages)' : 'off'), 'cad-faint')];
        }
        else if (m === 'autopage' || m === 'auto page') {
            store.autopage = !store.autopage;
            if (!store.autopage) cancelPageRequest();
            if (store.autopage) maybeAutoLoad();
            out = [line('autopage → ' + (store.autopage ? 'on' : 'off'), 'cad-faint')];
        }
        else if (m === 'compact') {
            store.compact = !store.compact;
            out = [line('compact → ' + (store.compact ? 'on' : 'off'), 'cad-faint')];
        }
        else if (m === 'pause') { toggleCover(); return; }
        else if (m === 'togglekey' || m.startsWith('togglekey ')) {
            const arg = cmd.slice('togglekey'.length).trim();
            if (!arg) out = [line('toggle key is ' + esc(store.toggleKey || '`') + '. togglekey f2, or togglekey reset.', 'cad-faint')];
            else if (arg.toLowerCase() === 'reset' || arg.toLowerCase() === 'default') {
                store.toggleKey = '`';
                out = [line('toggle key → `', 'cad-faint')];
            } else if (!parseToggleSpec(arg).key) out = [line(esc('usage: togglekey <key>'), 'cad-faint')];
            else {
                store.toggleKey = arg.toLowerCase().replace(/\s+/g, '');
                out = [line('toggle key → ' + esc(store.toggleKey), 'cad-faint')];
            }
        }
        else out = [line(esc('command not found: ' + cmd + ' — help lists commands'), 'cad-faint')];

        finish(cmd, out);
    }

    /* ================= chrome ================= */
    function fakeTitle() { return store.style === 'claude' ? '✻ Claude Code' : 'Codex CLI'; }

    function setFavicon(on) {
        let link = document.querySelector('link[rel*="icon"]');
        if (on) {
            if (origIcon === null) origIcon = link ? link.href : '';
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                (document.head || document.documentElement).appendChild(link);
            }
            link.href = FAVICON;
            document.title = fakeTitle();
        } else {
            if (origIcon !== null && link) link.href = origIcon;
            origIcon = null;
            if (realTitle) document.title = realTitle;
        }
    }

    function applyAttrs() {
        if (document.documentElement) document.documentElement.classList.toggle('cad-on', store.on);
        if (root) root.className = 'cad-' + store.style + ' cad-' + store.mode + (covered ? ' cad-covered' : '');
    }

    const THEME_ORDER = ['claude-dark', 'claude-light', 'codex-dark', 'codex-light'];
    function cycleTheme() {
        const cur = store.style + '-' + store.mode;
        const nxt = THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1 + THEME_ORDER.length) % THEME_ORDER.length];
        const parts = nxt.split('-');
        store.style = parts[0];
        store.mode = parts[1];
        applyAttrs();
        renderApp();
        if (store.on) setFavicon(true);
    }

    function quickSig() {
        const el = document.querySelector('#m_posts') || document.querySelector('#m_threads');
        return [
            location.href,
            el ? el.id : 'idle',
            document.querySelectorAll('.forumbox.postbox').length,
            document.querySelectorAll('.topicrow').length,
            el ? el.childElementCount : 0,
        ].join('|');
    }

    function findNextUrl(pager) {
        const hit = (pager || []).find(x => /^(\u4e0b\u4e00\u9875|\u4e0b\u9875|>{1,2})$/.test(x.t));
        return hit ? hit.href : null;
    }

    function authoridUrl(n) {
        const u = new URL('/read.php', location.href);
        u.searchParams.set('tid', curTid());
        u.searchParams.set('page', String(n));
        u.searchParams.set('authorid', opUidSticky);
        return u.href;
    }

    function cancelPageRequest() {
        if (pageRequest) pageRequest.abort();
        pageRequest = null;
        autoPageLoading = false;
    }

    function appendPage(doc, pageUrl, opMode) {
        let pageNo = 0;
        try { pageNo = +(new URL(pageUrl).searchParams.get('page') || 0); } catch (err) { pageNo = 0; }
        const label = pageNo ? 'page ' + pageNo : 'next page';
        loadedPages.add(pageUrl);
        const end = () => { if (opMode) opEnd = true; else nextPageUrl = null; };
        const emptyFail = containerSel => {
            if (doc.querySelector(containerSel)) end();
            else autoPageError = true;
        };
        if (lastData.kind === 'posts') {
            const opUid = opUidSticky || (lastData.posts.find(p => p.isOP) || {}).uid || '';
            const data = extractPosts(doc, opUid);
            if (!data || !data.posts.length) { emptyFail('#m_posts'); return; }
            const seen = new Set(lastData.posts.filter(p => !p.sep).map(p => p.id));
            const freshPosts = data.posts.filter(p => !seen.has(p.id));
            if (!freshPosts.length) {
                // authorid page 1 can be entirely inside the current page; keep walking.
                let onAuthor = false;
                try { onAuthor = new URL(location.href).searchParams.has('authorid'); } catch (err) { onAuthor = false; }
                if (opMode && pageNo === 1 && !onAuthor) opNextNo = 2;
                else end();
                return;
            }
            if (opMode) freshPosts.forEach(p => { p.isOP = true; });
            lastData.posts.push({ sep: label });
            lastData.posts.push(...freshPosts);
            if (opMode) opNextNo++;
        } else if (lastData.kind === 'topics') {
            const data = extractTopics(doc, pageUrl);
            if (!data || !data.topics.length) { emptyFail('#m_threads'); return; }
            const seenT = new Set(lastData.topics.filter(t => !t.sep).map(t => t.href));
            const freshTopics = data.topics.filter(t => !seenT.has(t.href));
            if (!freshTopics.length) { nextPageUrl = null; return; }
            lastData.topics.push({ sep: label });
            lastData.topics.push(...freshTopics);
        } else return;
        if (!opMode) {
            let u = findNextUrl(extractPager(doc, pageUrl));
            if (!u) {
                try {
                    const x = new URL(pageUrl);
                    if (/read\.php|thread\.php/.test(x.pathname)) {
                        x.searchParams.set('page', String(Math.max(1, parseInt(x.searchParams.get('page') || '1', 10) || 1) + 1));
                        u = x.href;
                    }
                } catch (err) { /* keep empty */ }
            }
            nextPageUrl = (u && !loadedPages.has(u)) ? u : null;
        }
        ensureLocs();
    }

    function normalizeCharset(cs) {
        const c = String(cs || '').trim().toLowerCase().replace(/_/g, '-');
        if (!c) return '';
        if (/^(gbk|gb2312|gb-2312|gb18030|windows-936|cp936|x-gbk|csgb2312)$/i.test(c)) return 'gbk';
        if (/^utf-?8$/.test(c)) return 'utf-8';
        return c;
    }

    function textDecoder(cs, opts) {
        const TD = (typeof TextDecoder === 'function')
            ? TextDecoder
            : (typeof globalThis !== 'undefined' && typeof globalThis.TextDecoder === 'function' && globalThis.TextDecoder);
        if (typeof TD !== 'function') throw new Error('TextDecoder is not available');
        return new TD(cs, opts);
    }

    function asBytes(buf) {
        if (!buf) return new Uint8Array(0);
        try {
            if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(buf)) {
                return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
            }
        } catch (err) { /* cross-realm views */ }
        const len = (buf.byteLength != null) ? buf.byteLength : (buf.length != null ? buf.length : 0);
        try {
            const view = new Uint8Array(buf);
            if (view.byteLength === len) return view;
        } catch (err) { /* copy below */ }
        const out = new Uint8Array(len);
        try { out.set(new Uint8Array(buf)); }
        catch (err) {
            for (let i = 0; i < len; i++) out[i] = buf[i] & 0xff;
        }
        return out;
    }

    function decodeBuffer(buf, hint) {
        const raw = asBytes(buf);
        const trials = [];
        const add = cs => { if (cs && trials.indexOf(cs) < 0) trials.push(cs); };
        const declared = normalizeCharset(hint);
        // NGA serves GBK. Prefer it when UTF-8 is full of replacement glyphs.
        // A clean UTF-8 decode must win a 0-replacement tie: GBK can "decode"
        // almost any byte sequence without U+FFFD, including real UTF-8.
        add('gbk');
        add('gb18030');
        if (declared && declared !== 'gbk') add(declared);
        add('utf-8');
        let best = '', bestScore = -1e9, bestCs = '';
        for (const cs of trials) {
            try {
                const t = textDecoder(cs, { fatal: false }).decode(raw);
                const bad = (t.match(/\uFFFD/g) || []).length;
                const score = (-bad * 10000)
                    + (bad === 0 && cs === 'utf-8' ? 500 : 0)
                    + ((cs === 'gbk' || cs === 'gb18030') ? 2 : 0)
                    + (cs === declared ? 1 : 0);
                if (score > bestScore) { best = t; bestScore = score; bestCs = cs; }
            } catch (err) { /* try next */ }
        }
        return best;
    }

    function decodeRes(r) {
        const headerCs = ((r.headers && r.headers.get && r.headers.get('content-type')) || '').match(/charset=([\w-]+)/i);
        return r.arrayBuffer().then(buf => {
            let cs = headerCs && headerCs[1];
            if (!cs) {
                const head = textDecoder('latin1').decode(asBytes(buf).slice(0, 4096));
                const mm = String(head).match(/charset=["']?([\w-]+)/i);
                cs = mm && mm[1];
            }
            return decodeBuffer(buf, cs);
        });
    }

    function stripNukePrefix(text) {
        let s = String(text || '').replace(/^\uFEFF/, '').trim();
        s = s.replace(/^\/\*[\s\S]*?\*\/\s*/, '');
        s = s.replace(/^(?:window\s*\.\s*)?script_muti_get_var_store\s*=\s*/i, '');
        s = s.replace(/^\/\/[^\n]*\n/, '');
        s = s.replace(/;\s*$/, '');
        return s.trim();
    }

    function parseNukeJson(text) {
        const stripped = stripNukePrefix(text);
        const tryParse = raw => {
            try { return { ok: true, data: JSON.parse(raw), error: null }; }
            catch (err) { return { ok: false, data: null, error: (err && err.message) ? err.message : String(err) }; }
        };
        let out = tryParse(stripped);
        if (out.ok) return out;
        const i = stripped.indexOf('{');
        const j = stripped.lastIndexOf('}');
        if (i >= 0 && j > i) {
            const inner = tryParse(stripped.slice(i, j + 1));
            if (inner.ok) return inner;
            out = inner;
        }
        const k = stripped.indexOf('[');
        const l = stripped.lastIndexOf(']');
        if (k >= 0 && l > k) {
            const inner = tryParse(stripped.slice(k, l + 1));
            if (inner.ok) return inner;
        }
        return { ok: false, data: null, error: out.error || 'parse failed' };
    }

    function loadNextPage() {
        if (!store.on || covered || document.hidden || autoPageLoading || !lastData || lastData.kind === 'idle') return;
        const opMode = opModeOn();
        if (opMode ? opEnd : !nextPageUrl) return;
        autoPageLoading = true;
        autoPageError = false;
        if (opMode && opNextNo === null) {
            opNextNo = new URLSearchParams(location.search).has('authorid') ? curPageNo() + 1 : 1;
        }
        const fetchUrl = opMode ? authoridUrl(opNextNo) : nextPageUrl;
        const hrefAtStart = location.href;
        const controller = new AbortController();
        pageRequest = controller;
        let timedOut = false;
        const timeout = setTimeout(() => {
            // Still the active request: this abort is the deadline, not a navigation cancel.
            if (pageRequest !== controller) return;
            timedOut = true;
            autoPageLoading = false;
            autoPageError = true;
            controller.abort();
            renderApp();
        }, 15000);
        const isCurrent = () => pageRequest === controller && location.href === hrefAtStart && opMode === opModeOn();
        renderApp();
        fetch(fetchUrl, { credentials: 'include', signal: controller.signal })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return decodeRes(r); })
            .then(txt => {
                if (!isCurrent()) return;
                autoPageLoading = false;
                appendPage(new DOMParser().parseFromString(txt, 'text/html'), fetchUrl, opMode);
                renderApp();
                setTimeout(maybeAutoLoad, 250);
            })
            .catch(err => {
                if (!isCurrent()) return;
                // A cancel nulls pageRequest first, so it never reaches here. A deadline abort does.
                if (err && err.name === 'AbortError' && !timedOut) return;
                autoPageLoading = false;
                autoPageError = true;
                renderApp();
            })
            .finally(() => { clearTimeout(timeout); if (pageRequest === controller) pageRequest = null; });
    }

    function nearBottom() {
        return bodyEl && bodyEl.scrollTop + bodyEl.clientHeight >= bodyEl.scrollHeight - 600;
    }

    function maybeAutoLoad() {
        if (!store.on || covered || document.hidden || !store.autopage || autoPageLoading || autoPageError) return;
        if (nearBottom()) loadNextPage();
    }

    function onBodyScroll() { maybeAutoLoad(); }

    function refresh(force) {
        if (!store.on || !root) return;
        const tidNow = curTid();
        if (opUidTid !== tidNow) {
            opUidTid = tidNow;
            opUidSticky = '';
            expandedPosts.clear();
            revealedImages.clear();
        }
        const sig = quickSig();
        if (!force && sig === lastSig) return;
        lastSig = sig;
        const fresh = extract();
        if (fresh && fresh.kind === 'posts') {
            if (!opUidSticky) {
                const args = parsePostArgs(document);
                opUidSticky = args.topicAuthor || ((curPageNo() <= 1 || new URLSearchParams(location.search).has('authorid')) && fresh.posts[0] && fresh.posts[0].uid) || '';
            }
        }
        let merged = false;
        if (fresh && lastData && fresh.kind === lastData.kind && location.href === dataHref
            && (fresh.kind === 'posts' || fresh.kind === 'topics')) {
            const key = fresh.kind;
            const sepIdx = lastData[key].findIndex(x => x.sep);
            if (sepIdx >= 0) {
                let tail = lastData[key].slice(sepIdx);
                if (key === 'topics') {
                    const freshHrefs = new Set(fresh.topics.map(t => t.href));
                    tail = tail.filter(x => x.sep || !freshHrefs.has(x.href));
                }
                fresh[key] = fresh[key].concat(tail);
                merged = true;
            }
        }
        lastData = fresh;
        dataHref = location.href;
        if (!merged) {
            nextPageUrl = findNextUrl(lastData && lastData.pager);
            loadedPages.add(location.href);
        }
        ensureLocs();
        watchHydratedNames();
        renderApp();
        maybeAutoLoad();
    }

    function build() {
        if (document.getElementById('cad__root')) {
            root = document.getElementById('cad__root');
            applyAttrs();
            return;
        }
        root = document.createElement('div');
        root.id = 'cad__root';
        (document.body || document.documentElement).appendChild(root);
        applyAttrs();
        renderApp();
        refresh(true);
    }

    function toggleCover() {
        if (!store.on) return;
        covered = !covered;
        if (covered) {
            coverFocus = document.activeElement === inputEl;
            cancelPageRequest();
            if (inputEl) inputEl.blur();
        }
        applyAttrs();
        renderApp();
        if (!covered) {
            if (sourceDirty || location.href !== dataHref) scheduleRefresh();
            if (coverFocus && inputEl) inputEl.focus();
            maybeAutoLoad();
        }
    }

    function toggleDisguise() {
        if (pendingReply && pendingReply.sending) return;
        cancelPageRequest();
        covered = false;
        store.on = !store.on;
        if (store.on) {
            suppressToggleChar = true;
            openedAt = Date.now();
            const active = document.activeElement;
            if (active && active.blur && (!root || !root.contains(active))) active.blur();
            build();
            applyAttrs();
            setFavicon(true);
            refresh(true);
            focusPrompt();
            const done = () => {
                clearToggleLeak();
                suppressToggleChar = false;
            };
            document.addEventListener('keyup', done, { once: true, capture: true });
            setTimeout(done, 200);
        } else {
            setFavicon(false);
            applyAttrs();
        }
    }

    function onEscape() {
        if (pendingReply && pendingReply.sending) return true;
        if (pendingReply && pendingReply.phase === 'confirm') {
            pendingReply = null;
            panel = { title: 'reply', html: line('Reply cancelled.', 'cad-faint') };
            renderApp();
            return true;
        }
        if (panel) {
            panel = null;
            renderApp();
            return true;
        }
        if (pendingReply && pendingReply.phase === 'compose') {
            pendingReply = null;
            composeText = '';
            panel = { title: 'reply', html: line('Reply discarded.', 'cad-faint') };
            renderApp();
            return true;
        }
        return false;
    }

    function closePanel() {
        if (pendingReply && pendingReply.phase === 'confirm' && !pendingReply.sending) pendingReply = null;
        panel = null;
        renderApp();
    }

    function scrollBy(delta) {
        if (!bodyEl) return;
        if (typeof bodyEl.scrollBy === 'function') {
            try { bodyEl.scrollBy({ top: delta }); return; } catch (err) { /* jsdom */ }
        }
        bodyEl.scrollTop += delta;
    }

    function onInputKey(e) {
        e.stopPropagation();
        if (isImeArtifact(e)) return;
        const el = e.currentTarget;
        if (suppressToggleChar && isToggleEvent(e)) {
            e.preventDefault();
            clearToggleLeak();
            return;
        }
        if (e.ctrlKey && (e.key === '[' || e.code === 'BracketLeft')) {
            e.preventDefault();
            el.blur();
            return;
        }
        if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
            e.preventDefault();
            store.expand = !store.expand;
            renderApp();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const hits = typed.trim().startsWith('/') ? slashHits(typed) : [];
        if (hits.length && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            if (e.key === 'ArrowDown') slashIndex = (slashIndex + 1) % hits.length;
            else slashIndex = (slashIndex - 1 + hits.length) % hits.length;
            renderApp();
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (hits.length) {
                const cmd = hits[Math.max(0, Math.min(slashIndex, hits.length - 1))];
                const { slash } = commandPrefix(typed);
                const next = applyCompletion(cmd, slash);
                if (!NEEDS_ARG.has(cmd)) {
                    typed = '';
                    histIdx = -1;
                    slashIndex = 0;
                    renderApp();
                    runCmd(next);
                }
                return;
            }
            const v = el.value;
            typed = '';
            histIdx = -1;
            slashIndex = 0;
            renderApp();
            runCmd(v);
            return;
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            if (hits.length) {
                const { slash } = commandPrefix(typed);
                applyCompletion(hits[Math.max(0, Math.min(slashIndex, hits.length - 1))], slash);
            } else if (el.value) tabComplete(el.value);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            if (hits.length && typed.trim().startsWith('/')) {
                typed = '';
                slashIndex = 0;
                if (inputEl) inputEl.value = '';
                renderApp();
                return;
            }
            if (pendingReply && !pendingReply.sending) pendingReply = null;
            panel = null;
            toggleCover();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!cmdHistory.length) return;
            histIdx = histIdx < 0 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
            typed = cmdHistory[histIdx];
            renderApp();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx < 0) return;
            histIdx++;
            if (histIdx >= cmdHistory.length) { histIdx = -1; typed = ''; }
            else typed = cmdHistory[histIdx];
            renderApp();
        }
    }

    function onGlobalKey(e) {
        if (isImeArtifact(e)) return;
        if (isEditableTarget(e.target)) return;
        if (isToggleEvent(e)) {
            e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (covered) return;
            toggleDisguise();
            return;
        }
        if (!store.on) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (!onEscape()) toggleCover();
            return;
        }
        if (covered) {
            if (e.target && e.target.closest && e.target.closest('button, a, [role="button"]')) return;
            e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            return;
        }
        if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
            e.preventDefault();
            store.expand = !store.expand;
            renderApp();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target && e.target.closest && e.target.closest('button, a, [role="button"]')) return;
        if (!store.vim) return;
        const k = e.key;
        const vimKey = new Set(['j', 'k', 'h', 'l', 'g', 'G', '/', ':', 'i', 'o', 't', '?']);
        const handled = /^\d$/.test(k) || vimKey.has(k) || (k === 'Enter' && pendingCount);
        if (handled) {
            e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }
        if (/^\d$/.test(k)) {
            pendingCount += k;
            renderApp();
            return;
        }
        const count = Math.max(1, parseInt(pendingCount || '1', 10) || 1);
        const hadCount = !!pendingCount;
        switch (k) {
            case 'j': scrollBy(120 * count); break;
            case 'k': scrollBy(-120 * count); break;
            case 'h': scrollBy(-((bodyEl && bodyEl.clientHeight) || 400) * 0.9 * count); break;
            case 'l': scrollBy(((bodyEl && bodyEl.clientHeight) || 400) * 0.9 * count); break;
            case 'g': {
                const now = Date.now();
                if (now - gTs < 600) { if (bodyEl) bodyEl.scrollTop = 0; gTs = 0; }
                else gTs = now;
                break;
            }
            case 'G': if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight; break;
            case '/': focusInput('search: '); break;
            case ':': focusInput(); break;
            case 'i': focusInput(); break;
            case 'o':
                focusInput(lastData && lastData.kind === 'topics' ? 'open ' : 'search: ');
                break;
            case 't': cycleTheme(); break;
            case '?': runCmd('help'); break;
            case 'Enter':
                if (pendingCount && lastData && lastData.kind === 'topics') openN(count);
                break;
            default: break;
        }
        pendingCount = '';
        if (hadCount) renderApp();
    }

    document.addEventListener('keydown', onGlobalKey, true);

    function scheduleRefresh() {
        sourceDirty = true;
        if (TEST || sourceTimer || !store.on || covered || document.hidden) return;
        sourceTimer = setTimeout(() => {
            sourceTimer = null;
            if (!store.on || covered || document.hidden) return;
            sourceDirty = false;
            refresh(true);
        }, 180);
    }

    function watchSource() {
        if (!document.documentElement) return;
        new MutationObserver(records => {
            if (root && !root.isConnected && document.body) document.body.appendChild(root);
            if (records.some(r => {
                const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
                if (!el || (el.closest && el.closest('#cad__root, #cad__replyframe, #cad__replyform'))) return false;
                return (el.closest && el.closest('#m_posts, #m_threads, #m_nav, #m_pbtnbtm, #m_pbtntop, #pagebbtm, #pagebbtop'))
                    || [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && n.matches && (n.matches('#m_posts, #m_threads') || (n.querySelector && n.querySelector('#m_posts, #m_threads'))));
            })) scheduleRefresh();
        }).observe(document.documentElement, {
            childList: true, subtree: true, characterData: true, attributes: true,
            attributeFilter: ['src', 'data-src', 'data-lazy-src', 'data-original', 'href'],
        });
    }

    function watchTitle() {
        const t = document.querySelector('title');
        if (!t) return;
        new MutationObserver(() => {
            if (!store.on) { realTitle = document.title; return; }
            if (document.title !== fakeTitle()) {
                realTitle = document.title;
                document.title = fakeTitle();
            }
        }).observe(t, { childList: true, characterData: true, subtree: true });
    }

    function stripTrackerErrors() {
        window.addEventListener('error', e => {
            if (/ubbcode|common\.js|ngaco|track|_hmt|hm\.baidu/i.test((e.filename || '') + ' ' + (e.message || ''))) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    /* ================= view ================= */
    const { h, render: preactRender } = vendored.preact;
    const html = vendored.htm.bind(h);

    const Img = ({ o }) => html`<img class="cad-img" src=${o.main} loading="lazy" alt="" referrerpolicy="no-referrer"
        onError=${e => { const t = e.currentTarget; if (o.alt && t.src !== o.alt) t.src = o.alt; else t.classList.add('cad-imghide'); }} />`;
    const Loc = ({ uid }) => (uid && locMap[uid]) ? html`<span> · ${locMap[uid]}</span>` : null;
    const Quote = ({ q }) => html`<div class="cad-qline" style=${'margin-left:' + ((q.depth || 0) * 12) + 'px'}>
        ${(q.author || q.time) ? html`<div class="cad-qhead">${q.author || 'quote'}${q.time ? ' · ' + q.time : ''}</div>` : null}
        ${q.text ? html`<div>${q.text}</div>` : null}
    </div>`;
    const TextWithLinks = ({ text: value }) => html`${linkifySegments(value).map(seg => seg.type === 'link'
        ? html`<a class="cad-pagelink" ...${linkProps(seg.value)}>${seg.value}</a>`
        : seg.value)}`;

    function imageNode(p, index) {
        const o = p.imgs[index];
        if (!o) return null;
        const token = p.id + ':' + index;
        if (store.img || revealedImages.has(token)) return html`<a href=${o.main} target="_blank" rel="noopener noreferrer"><${Img} key=${o.main} o=${o} /></a>`;
        return html`<button type="button" class="cad-action cad-imglink" onClick=${() => { revealedImages.add(token); renderApp(); }}>[image]</button>`;
    }

    function clipState(text, maxLines) {
        const raw = String(text || '');
        const lines = raw.split('\n');
        if (lines.length > maxLines) return { clipped: true, shown: lines.slice(0, maxLines).join('\n'), extra: lines.length - maxLines };
        const limit = maxLines * 80;
        if (raw.length > limit) return { clipped: true, shown: raw.slice(0, limit), extra: Math.max(1, Math.ceil((raw.length - limit) / 80)) };
        return { clipped: false, shown: raw, extra: 0 };
    }

    const PostBody = ({ p, maxLines }) => {
        const expanded = store.expand || expandedPosts.has(p.id);
        const clip = clipState(p.text, maxLines);
        const clipped = !expanded && clip.clipped;
        const shown = clipped ? clip.shown : (p.text || '');
        const parts = shown.split(/%%IMG(\d+)%%/);
        return html`<div class="cad-text cad-line">${parts.map((part, i) => i % 2
            ? imageNode(p, +part)
            : html`<${TextWithLinks} text=${part} />`)}
            ${clip.clipped && !store.expand ? html`<button type="button" class="cad-action cad-expand" onClick=${() => {
                if (expandedPosts.has(p.id)) expandedPosts.delete(p.id); else expandedPosts.add(p.id);
                renderApp();
            }}>${clipped ? 'expand ' + clip.extra + ' more lines' : 'collapse'}</button>` : null}</div>`;
    };

    const ClaudeLogo = ({ size = 18 }) => html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2v4.4M12 17.6V22M4.93 4.93l3.11 3.11M15.96 15.96l3.11 3.11M2 12h4.4M17.6 12H22M4.93 19.07l3.11-3.11M15.96 8.04l3.11-3.11M7.4 3.45l1.95 3.96M14.65 16.59l1.95 3.96M3.45 16.6l3.96-1.95M16.59 9.35l3.96-1.95" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    const CodexLogo = ({ size = 18 }) => html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="4" stroke="var(--accent)" stroke-width="1.8"/>
        <path d="M8 9.5L11.5 12 8 14.5M12.5 14.5H16" stroke="var(--text)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    const FolderIcon = () => html`<svg class="cad-side-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.2 4.2A1.4 1.4 0 0 1 3.6 2.8h2.9l1.3 1.5h4.6a1.4 1.4 0 0 1 1.4 1.4v6.1a1.4 1.4 0 0 1-1.4 1.4H3.6a1.4 1.4 0 0 1-1.4-1.4V4.2Z" stroke="currentColor" stroke-width="1.3"/></svg>`;
    const StarIcon = () => html`<svg class="cad-side-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2.2l1.65 3.35 3.7.54-2.68 2.61.63 3.68L8 10.64l-3.3 1.74.63-3.68L2.65 6.09l3.7-.54L8 2.2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/></svg>`;
    const ChatIcon = () => html`<svg class="cad-side-ico" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4.2A1.7 1.7 0 0 1 4.7 2.5h6.6A1.7 1.7 0 0 1 13 4.2v5a1.7 1.7 0 0 1-1.7 1.7H6.8L4 13.3v-2.4A1.7 1.7 0 0 1 3 9.2v-5Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/></svg>`;
    const SendArrow = () => html`<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 12.5V3.5M8 3.5L4 7.5M8 3.5L12 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const PostBlock = ({ p, maxLines }) => {
        const clip = clipState(p.text, maxLines);
        const clipped = !store.expand && !expandedPosts.has(p.id) && clip.clipped;
        const tip = (p.uid ? 'uid ' + p.uid : p.name) + (p.uid && locMap[p.uid] ? ' · ' + locMap[p.uid] : '');
        const isFirstTurn = p.floor === 0 || p.isOP;
        const initial = String(p.name || '?').trim().slice(0, 1).toUpperCase() || '?';
        return html`<article id=${'cad-floor-' + p.floor} class=${'cad-post' + (isFirstTurn ? ' cad-post-op' : '') + (clipped ? ' cad-collapsed' : '')} onClick=${e => {
            if (!clipped) return;
            const t = e.target;
            if (t && t.closest && t.closest('a, button, textarea, input')) return;
            if (expandedPosts.has(p.id)) expandedPosts.delete(p.id); else expandedPosts.add(p.id);
            renderApp();
        }}>
            <header class="cad-posthead">
                <span class=${'cad-turn-ico ' + (isFirstTurn ? 'cad-turn-ico-user' : 'cad-turn-ico-bot')}>${isFirstTurn ? initial : (store.style === 'claude' ? html`<${ClaudeLogo} size=${13} />` : '●')}</span>
                <button type="button" class="cad-action cad-author" title=${tip} onClick=${() => runCmd('user ' + (p.uid || p.name))}>${p.name}</button>
                <span class="cad-floor">#${p.floor}</span>
                ${p.isOP ? html`<span class="cad-op">OP</span>` : null}
                ${p.date ? html`<span>${p.date}</span>` : null}
                ${p.likes !== '' ? html`<span class="cad-likes">${formatScore(p.likes)}</span>` : null}
                <${Loc} uid=${p.uid} />
                <span style="flex:1"></span>
                <button type="button" class="cad-action" onClick=${() => beginReply({ post: p, text: '', compose: true })}>quote</button>
            </header>
            ${(p.quotes || []).map(q => html`<${Quote} q=${q} />`)}
            <${PostBody} p=${p} maxLines=${maxLines} />
        </article>`;
    };

    const Pager = ({ pager }) => (pager && pager.length) ? html`<div class="cad-line" style="margin-top:8px"><span class="cad-sect">pages</span>${pager.map(l => html` <a class="cad-pagelink" href=${l.href}>${l.t}</a>`)}</div>` : null;
    const PageSep = ({ label }) => html`<div class="cad-pagesep">${label}</div>`;
    const TopicRow = ({ t, i }) => html`<div class="cad-trow cad-line">
        <span class="cad-topicnum">${i + 1}</span><span class="cad-trep">${t.replies || '0'}</span><a class="cad-tlink" href=${t.href}>${t.title}</a>
        <span class="cad-meta">${t.author}${t.postDate ? ' ' + t.postDate : ''}${t.replyer ? ' · last ' + t.replyer : ''}${t.replyDate ? ' ' + t.replyDate : ''}</span>
    </div>`;

    function topicNodes(topics) {
        let n = 0;
        return (topics || []).map(t => t.sep
            ? html`<${PageSep} key=${t.sep} label=${t.sep} />`
            : html`<${TopicRow} key=${t.href} t=${t} i=${n++} />`);
    }

    function visiblePosts(data) {
        return store.opOnly ? data.posts.filter(p => p.isOP || p.sep) : data.posts;
    }

    function postNodes(posts) {
        return (posts || []).map(p => p.sep
            ? html`<${PageSep} key=${p.sep} label=${p.sep} />`
            : html`<${PostBlock} key=${p.id} p=${p} maxLines=${POST_PREVIEW_LINES} />`);
    }

    function hotBlock(data) {
        if (store.opOnly || !data.hot || !data.hot.length) return null;
        return html`<div class="cad-line" style="margin-top:6px"><span class="cad-sect">${store.compact ? 'highlights' : 'hot replies'}</span></div>
            ${data.hot.map(p => html`<${PostBlock} key=${'hot-' + p.id} p=${p} maxLines=${POST_PREVIEW_LINES} />`)}`;
    }

    const CmdLine = ({ cwd, cmd }) => html`<div class="cad-cmd"><span class="cad-ps1">➜ ${cwd}</span><span>${cmd}</span></div>`;
    const Welcome = ({ cwd }) => store.compact
        ? html`<div class="cad-banner"><span><b>Claude Code</b> · ${cwd}</span><span class="cad-faint">/help · Esc covers</span></div>`
        : html`<div class="cad-welcome">
            <div class="left">
                <div class="logo"><${ClaudeLogo} size=${22} /><span>Claude Code</span></div>
                <div class="dim">cwd: ${cwd}</div>
                <div class="dim">Claude Sonnet 4.5 · /help for commands</div>
            </div>
            <div class="right">
                <div><span class="sec">Workspace shortcuts</span></div>
                <div>· <b>/help</b> lists commands. A leading / is optional.</div>
                <div>· <b>board list</b> and <b>board fid</b> open a board from an empty page.</div>
                <div>· <b>img</b> toggles lazy thumbnails. Click [image] to open one.</div>
                <div class="dim">vim is off. h/l scroll and do not change pages. \` toggles outside text fields.</div>
            </div>
        </div>`;
    const CodexBanner = () => html`<div class="cad-banner">
        <span style="display:inline-flex;align-items:center;gap:8px"><${CodexLogo} size=${18} /><b>OpenAI Codex</b> · gpt-5-codex · reasoning: medium</span>
        <span class="cad-faint">${store.compact ? FAKE_DIR : cwdFor(lastData || { kind: 'idle' })}</span>
    </div>`;

    const IdleView = () => html`<div>
        <div class="cad-line">No thread or board list on this page.</div>
        <div class="cad-line cad-faint">The disguise reads #m_posts and #m_threads. Other pages stay idle.</div>
        <div class="cad-line" style="margin-top:8px"><span class="cad-sect">try</span></div>
        <div class="cad-line">· <button type="button" class="cad-action cad-idlebtn" onClick=${() => runCmd('help')}>help</button> — commands and keys</div>
        <div class="cad-line">· <button type="button" class="cad-action cad-idlebtn" onClick=${() => runCmd('board list')}>board list</button> — favorites</div>
        <div class="cad-line">· <button type="button" class="cad-action cad-idlebtn" onClick=${() => focusInput('board fid ')}>board fid &lt;fid&gt;</button> — open a board by id</div>
        <div class="cad-line cad-faint">board add reads the fid from the URL, the reply form, or the breadcrumb.</div>
    </div>`;

    const ClaudeView = ({ data }) => {
        const cwd = cwdFor(data);
        if (data.kind === 'topics') {
            return html`<div>
                <${Welcome} cwd=${cwd} />
                <${CmdLine} cwd=${cwd} cmd=${contextLine(data)} />
                <div class="cad-kicker"><span class="cad-sect">${data.board}</span> · ${data.topics.reduce((a, t) => a + (t.sep ? 0 : 1), 0)} topics</div>
                ${topicNodes(data.topics)}
                <${Pager} pager=${data.pager} />
            </div>`;
        }
        if (data.kind === 'posts') {
            return html`<div>
                <${CmdLine} cwd=${cwd} cmd=${store.compact ? 'cat notes/review.md' : 'open "' + data.title + '"'} />
                <h1 class="cad-title">${data.title}</h1>
                <div class="cad-kicker">${contextLine(data)}</div>
                ${hotBlock(data)}
                <div class="cad-line" style="margin-top:6px"><span class="cad-sect">${store.compact ? 'output' : 'replies'}</span></div>
                ${postNodes(visiblePosts(data))}
                <${Pager} pager=${data.pager} />
                <div class="cad-kicker">ctrl+o ${store.expand ? 'collapses' : 'expands'} every post. reply, quote, post, and vote wait for y.</div>
            </div>`;
        }
        return html`<${IdleView} />`;
    };

    const CodexView = ({ data }) => {
        const cwd = cwdFor(data);
        if (data.kind === 'topics') {
            return html`<div>
                <${CodexBanner} />
                <div class="cad-blocktag">user</div>
                <div class="cad-line">${store.compact ? 'Inspect the workspace index' : 'List topics in ' + data.board}</div>
                <div class="cad-blocktag">codex</div>
                <div class="cad-line cad-faint">cwd: ${cwd} · ${data.topics.reduce((a, t) => a + (t.sep ? 0 : 1), 0)} topics</div>
                ${topicNodes(data.topics)}
                <${Pager} pager=${data.pager} />
            </div>`;
        }
        if (data.kind === 'posts') {
            const visible = visiblePosts(data);
            return html`<div>
                <${CodexBanner} />
                <div class="cad-blocktag">user</div>
                <div class="cad-line">${store.compact ? 'Read notes/review.md' : 'Open thread ' + data.title}</div>
                <div class="cad-blocktag">codex</div>
                <h1 class="cad-title">${data.title}</h1>
                <div class="cad-kicker">${visible.reduce((a, p) => a + (p.sep ? 0 : 1), 0)} posts${store.opOnly ? ' · OP only' : ''} · cwd: ${cwd}</div>
                ${hotBlock(data)}
                <div class="cad-line" style="margin-top:6px"><span class="cad-sect">${store.compact ? 'output' : 'replies'}</span></div>
                ${postNodes(visible)}
                <${Pager} pager=${data.pager} />
            </div>`;
        }
        return html`<div><${CodexBanner} /><${IdleView} /></div>`;
    };

    const AutoLoadState = () => {
        if (autoPageLoading) return html`<div class="cad-statusline cad-faint" role="status">Loading the next page…</div>`;
        if (autoPageError) return html`<div class="cad-statusline cad-error" role="alert"><button type="button" class="cad-action cad-idlebtn" onClick=${() => loadNextPage()}>Could not load the next page. Retry</button></div>`;
        const list = lastData && (lastData.posts || lastData.topics);
        if (store.opOnly && !(lastData && lastData.posts && lastData.posts.some(p => p.isOP && !p.sep)) && !autoPageLoading) {
            const msg = autoPageError
                ? 'Could not load the OP authorid view.'
                : (opUidSticky ? 'No OP posts on this page. Loading the authorid view…' : 'No original-poster uid on this page.');
            return html`<div class="cad-statusline cad-faint">${msg}</div>`;
        }
        if (store.autopage && (opModeOn() ? opEnd : !nextPageUrl) && list && list.some(x => x.sep))
            return html`<div class="cad-statusline cad-faint">End of pages</div>`;
        return null;
    };

    const HintBar = () => {
        const hint = (name, label, run) => html`<button type="button" class="cad-action cad-hint" data-hint=${name} onClick=${run}>${label}</button>`;
        return html`<div class="cad-hints">
            ${hint('help', '/help', () => runCmd('help'))}
            ${hint('reply', '/reply', () => focusInput('/reply '))}
            ${hint('quote', '/quote', () => focusInput('/quote '))}
            ${hint('post', '/post', () => focusInput('/post '))}
            ${hint('search', '/search', () => focusInput('/search: '))}
            ${hint('board', '/board', () => { typed = 'board list'; if (inputEl) inputEl.value = 'board list'; runCmd('board list'); })}
            ${hint('sort', 'sort', () => focusInput('sort '))}
            ${hint('noti', 'noti', () => runCmd('noti'))}
            <span class="cad-faint" style="font-size:11.5px">Tab completes · y confirms a post</span>
        </div>`;
    };

    const ReplyDock = () => {
        if (pendingReply && pendingReply.phase === 'confirm') return html`<div class="cad-modal"><div class="cad-modal-card">
            <div class="cad-panelhead"><span>${pendingReply.kind || 'confirm'}</span><button type="button" class="cad-action" onClick=${() => runCmd('n')}>Cancel</button></div>
            <div class="cad-panel" dangerouslySetInnerHTML=${{ __html: (panel && panel.html) || '' }} />
            <div><button type="button" class="cad-send" onClick=${() => runCmd('y')}>Send</button> <button type="button" class="cad-action" onClick=${() => runCmd('n')}>Cancel</button> <span class="cad-dim">or y / n</span></div>
        </div></div>`;
        if (panel) return html`<div class="cad-panel">
            <div class="cad-panelhead"><span>${panel.title}</span><button type="button" class="cad-action" onClick=${() => closePanel()}>close</button></div>
            <div dangerouslySetInnerHTML=${{ __html: panel.html }} />
        </div>`;
        if (pendingReply && pendingReply.phase === 'compose') return html`<div class="cad-panel">
            <div class="cad-panelhead"><span>${pendingReply.kind === 'thread' ? 'new thread' : (pendingReply.quote ? 'quote #' + pendingReply.quote.floor : 'reply')}</span><button type="button" class="cad-action" onClick=${() => { pendingReply = null; composeText = ''; renderApp(); }}>cancel</button></div>
            ${pendingReply.kind === 'thread' ? html`<input class="cad-compose" style="min-height:0" aria-label="Thread title" placeholder="Title" value=${pendingReply.subject || ''} onInput=${e => { if (pendingReply) pendingReply.subject = e.currentTarget.value; }} />` : null}
            <div class="cad-faint">${pendingReply.quote ? 'Quote is included when you preview. ' : ''}Enter inserts a newline. Nothing is posted from here.</div>
            <textarea class="cad-compose" value=${composeText}
                onInput=${e => { composeText = e.currentTarget.value; if (pendingReply) pendingReply.text = composeText; }}
                onCompositionEnd=${() => noteCompositionEnd()}></textarea>
            <div><button type="button" class="cad-action cad-idlebtn" onClick=${() => previewCompose()}>preview</button></div>
        </div>`;
        return null;
    };

    const InputBar = () => {
        const placeholder = pendingReply && pendingReply.phase === 'confirm'
            ? 'y sends, n cancels'
            : (store.style === 'claude' ? 'Reply to Claude or type /command...' : 'Ask Codex to do anything or type /command...');
        const slash = typed.trim().startsWith('/') ? slashHits(typed).slice(0, 10) : [];
        if (slashIndex >= slash.length) slashIndex = Math.max(0, slash.length - 1);
        const modelLabel = store.style === 'claude' ? 'Claude Sonnet 4.5 ⌄' : 'gpt-5-codex · medium ⌄';
        return html`<div class="cad-inputbar" onClick=${() => { if (inputEl) inputEl.focus(); }}>
            ${slash.length ? html`<div class="cad-slash" role="listbox" aria-label="Commands">${slash.map((c, i) => html`<button type="button" role="option" aria-selected=${i === slashIndex} class=${'cad-slash-item' + (i === slashIndex ? ' cad-slash-on' : '')} onMouseDown=${e => { e.preventDefault(); applyCompletion(c, true); }}><span class="cad-slash-cmd">${'/' + c}</span>${NEEDS_ARG.has(c) ? html`<span class="cad-slash-hint">arg</span>` : null}</button>`)}</div>` : null}
            <div class="cad-composer-box">
                <textarea class="cad-real" rows="2" aria-label="Message" placeholder=${placeholder} ref=${el => { inputEl = el; }} value=${typed}
                    spellcheck="false" autocomplete="off" autocapitalize="off"
                    onInput=${e => {
                        if (suppressToggleChar) {
                            const key = (store.toggleKey || '`').split('+').pop();
                            e.currentTarget.value = e.currentTarget.value.split(key).join('').replace(/`/g, '');
                        }
                        const prev = typed;
                        typed = e.currentTarget.value;
                        const slashNow = typed.trim().startsWith('/');
                        const slashPrev = String(prev || '').trim().startsWith('/');
                        if (slashNow && !slashPrev) slashIndex = 0;
                        if (slashNow || slashPrev) {
                            const s = e.currentTarget.selectionStart, e2 = e.currentTarget.selectionEnd;
                            renderApp();
                            if (inputEl) {
                                try { inputEl.setSelectionRange(s, e2); inputEl.focus(); } catch (err) { /* ignore */ }
                            }
                        }
                    }}
                    onKeyDown=${onInputKey}
                    onCompositionEnd=${() => noteCompositionEnd()}
                    onFocus=${() => { focused = true; }}
                    onBlur=${() => { focused = false; }}></textarea>
                <div class="cad-composer-foot">
                    <div class="cad-composer-meta">
                        <span>${store.style === 'claude' ? 'Local workspace' : 'Local · worktree'}</span>
                        <span>·</span>
                        <span>Enter runs</span>
                    </div>
                    <div class="cad-composer-right">
                        <button type="button" class="cad-model-pill" title="Switch client style" onClick=${e => { e.stopPropagation(); cycleTheme(); }}>
                            <span style="width:6px;height:6px;border-radius:50%;background:var(--accent);display:inline-block"></span>
                            <span>${modelLabel}</span>
                        </button>
                        <button type="button" class="cad-send" aria-label="Send" onClick=${e => { e.stopPropagation(); const v = typed; typed = ''; if (inputEl) inputEl.value = ''; runCmd(v); }}><${SendArrow} /></button>
                    </div>
                </div>
            </div>
        </div>`;
    };

    const StatusBar = () => {
        const flag = (name, label, cmd) => html`<button type="button" class="cad-action cad-flag" data-flag=${name} title=${name} onClick=${() => runCmd(cmd)}>${label}</button>`;
        return html`<div class="cad-statusbar">
            ${store.style === 'codex' ? html`<span class="seg hi">gpt-5-codex</span><span class="sep">|</span>` : html`<span class="seg hi">help</span><span class="sep">·</span>`}
            ${flag('img', 'img ' + (store.img ? 'on' : 'off'), 'img')}
            <span class="sep">·</span>
            ${flag('op', 'op ' + (store.opOnly ? 'on' : 'off'), 'op')}
            <span class="sep">·</span>
            ${flag('autopage', 'autopage ' + (store.autopage ? 'on' : 'off'), 'autopage')}
            <span class="sep">·</span>
            <span class="seg">${pageLabel()}</span>
            <span class="grow"></span>
            ${(store.vim && pendingCount) ? html`<span class="seg hi">${pendingCount}</span><span class="sep">·</span>` : null}
            ${store.vim ? html`<span class="seg">vim</span><span class="sep">·</span>` : null}
            <span class="seg cad-secondary">${store.mode}</span>
            <button type="button" class="cad-action" title="cycle theme" onClick=${() => cycleTheme()}>${store.style}</button>
            <span class="sep cad-secondary">·</span>
            <span class="seg cad-secondary">${new Date().toTimeString().slice(0, 5)}</span>
        </div>`;
    };

    const Sidebar = () => {
        const boardList = discoverPageBoards();
        const favs = sidebarFavorites();
        const recent = sidebarRecent();
        const cur = String(pageFid() || '');
        ensureFavs();
        return html`<aside class="cad-side">
            <div class="cad-side-top">
                <span class="cad-traffic" aria-hidden="true"><i></i><i></i><i></i></span>
                <button type="button" class="cad-action" title="Switch client style" onClick=${() => cycleTheme()}>${store.style === 'claude' ? 'Codex' : 'Claude'}</button>
            </div>
            <div class="cad-brand">
                ${store.style === 'claude' ? html`<${ClaudeLogo} size=${19} />` : html`<${CodexLogo} size=${19} />`}
                <span>${store.style === 'claude' ? 'Claude' : 'Codex'}</span>
                <span class="cad-brand-badge">${store.style === 'claude' ? 'Code' : 'Desktop'}</span>
            </div>
            <button type="button" class="cad-newbtn" onClick=${() => focusInput('/post ')}>
                <span>+</span>
                <span>${store.style === 'claude' ? 'New thread' : 'New task'}</span>
                <span class="cad-kbd">/post</span>
            </button>
            <div class="cad-side-label">Boards</div>
            ${boardList.length ? boardList.map(b => html`<a class=${String(b.fid) === cur ? 'cad-onitem' : ''} href=${'/thread.php?fid=' + encodeURIComponent(b.fid)} title=${'fid ' + b.fid}>${store.style === 'claude' ? html`<${FolderIcon} />` : html`<span class="cad-side-dot"></span>`}<span>${b.name}</span></a>`) : html`<button type="button" class="cad-sideitem" onClick=${() => runCmd('board add')}><span>Save this board</span></button>`}
            ${cur && !boardList.some(b => String(b.fid) === cur) ? html`<button type="button" class="cad-sideitem" onClick=${() => runCmd('board add')}><span>Save this board</span></button>` : null}
            <div class="cad-side-label">Favorites</div>
            ${favs.length ? favs.slice(0, 16).map(t => html`<a href=${t.href || ('/read.php?tid=' + encodeURIComponent(t.tid))} title=${t.title}><${StarIcon} /><span>${t.title}</span></a>`) : html`<div class="cad-sideitem cad-dim"><span>bookmark a thread, or open your favorites</span></div>`}
            <div class="cad-side-label">Recent</div>
            ${recent.length ? recent.slice(0, 10).map(t => html`<a href=${t.href || ('/read.php?tid=' + encodeURIComponent(t.tid))} title=${t.title}><${ChatIcon} /><span>${t.title}</span></a>`) : html`<div class="cad-sideitem cad-dim"><span>recent threads appear here</span></div>`}
            <div class="cad-side-foot">
                <span class="cad-avatar">${store.style === 'claude' ? 'C' : 'O'}</span>
                <div class="cad-side-footmeta">
                    <div class="cad-side-footname">${store.style === 'claude' ? 'Claude Desktop' : 'Codex Desktop'}</div>
                    <div class="cad-side-footsub">${cwdFor(lastData || { kind: 'idle' })}</div>
                </div>
            </div>
        </aside>`;
    };

    const TopBar = ({ data }) => {
        const ctx = viewBits();
        const board = (data && data.board) || pageBoardName() || 'board';
        const title = data && data.kind === 'posts' ? data.title : '';
        return html`<div class="cad-topbar">
            <span class="cad-crumb">${board}${title ? '  /  ' + title : ''}</span>
            <span class="cad-pill">${pageLabel()}</span>
            ${ctx.sort ? html`<button type="button" class="cad-pill" onClick=${() => runCmd(ctx.sort === 'latest post' ? 'sort reply' : 'sort post')}>${ctx.sort}</button>` : null}
            ${ctx.filter ? html`<button type="button" class="cad-pill" onClick=${() => runCmd(store.opOnly ? 'op' : 'author off')}>${ctx.filter}</button>` : null}
            <span style="flex:1"></span>
            <button type="button" class="cad-action cad-topbar-btn" onClick=${() => pageNav(-1)}>‹ Prev</button>
            <button type="button" class="cad-action cad-topbar-btn" onClick=${() => pageNav(1)}>Next ›</button>
            <button type="button" class="cad-action cad-topbar-btn" onClick=${() => { store.mode = store.mode === 'dark' ? 'light' : 'dark'; applyAttrs(); renderApp(); }}>${store.mode}</button>
            <button type="button" class="cad-action cad-topbar-btn" onClick=${() => toggleCover()}>Esc</button>
        </div>`;
    };

    const CoverScreen = () => html`<div class="cad-cover" role="dialog" aria-label="Code review">
        <div class="cad-cover-bar">
            <i></i><i></i><i></i>
            <div class="cad-cover-bar-title">src/server.ts — api-server — Review</div>
        </div>
        <div class="cad-cover-work">
            <nav class="cad-cover-tree" aria-label="Files">
                <div class="cad-cover-dir">src</div>
                <div class="cad-cover-file cad-onitem">server.ts</div>
                <div class="cad-cover-file">handleRequest.ts</div>
                <div class="cad-cover-file">errors.ts</div>
                <div class="cad-cover-dir">test</div>
                <div class="cad-cover-file">handleRequest.test.ts</div>
            </nav>
            <div class="cad-cover-editor">
                <div class="cad-cover-tabs">
                    <div class="cad-cover-tab cad-onitem">server.ts</div>
                    <div class="cad-cover-tab">handleRequest.test.ts</div>
                </div>
                <div class="cad-cover-diff">
                    ${COVER_DIFF.map(row => row.kind === 'hunk'
                        ? html`<div class="cad-cover-hunk">${row.text}</div>`
                        : html`<div class=${'cad-dline' + (row.kind === 'del' ? ' cad-del' : row.kind === 'add' ? ' cad-add' : '')}>
                            <span>${row.oldN || ''}</span><span>${row.newN || ''}</span><span>${(row.kind === 'del' ? '- ' : row.kind === 'add' ? '+ ' : '  ') + row.text}</span>
                        </div>`)}
                </div>
                <div class="cad-cover-foot">src/server.ts · Ln 43, Col 12 · TypeScript · UTF-8 · LF</div>
            </div>
        </div>
    </div>`;

    const App = () => {
        const data = lastData || { kind: 'idle' };
        return html`<div style="flex:1;min-height:0;display:flex;flex-direction:column;position:relative">
            ${covered ? html`<${CoverScreen} />` : null}
            <div class="cad-app">
            <${Sidebar} />
            <div class="cad-main">
                <${TopBar} data=${data} />
                <div class="cad-body" id="cad__body" ref=${el => { bodyEl = el; }} onScroll=${onBodyScroll}>
                    <div class="cad-measure">
                        <${ReplyDock} />
                        ${store.style === 'claude' ? html`<${ClaudeView} data=${data} />` : html`<${CodexView} data=${data} />`}
                        <${AutoLoadState} />
                    </div>
                </div>
                <${HintBar} />
                <${InputBar} />
                <${StatusBar} />
            </div>
        </div>
        </div>`;
    };

    function renderApp() {
        if (!root) return;
        if (!root.isConnected && document.body) document.body.appendChild(root);
        const hrefChanged = lastHref && location.href !== lastHref;
        lastHref = location.href;
        if (hrefChanged) {
            cancelPageRequest();
            expandedPosts.clear();
            revealedImages.clear();
            pendingReply = null;
            composeText = '';
            panel = null;
            autoPageError = false;
            autoPageLoading = false;
            loadedPages = new Set([location.href]);
            opNextNo = null;
            opEnd = false;
        }
        applyAttrs();
        preactRender(html`<${App} />`, root);
        if (hrefChanged && bodyEl) bodyEl.scrollTop = 0;
    }

    function boot() {
        realTitle = document.title || realTitle;
        lastHref = location.href;
        if (!TEST) {
            watchTitle();
            stripTrackerErrors();
            watchSource();
        }
        if (store.on) {
            build();
            setFavicon(true);
            focusPrompt();
        } else applyAttrs();
        if (startupGuard) clearTimeout(startupGuard);
    }

    if (!TEST) {
        setInterval(() => { if (store.on && !covered && !document.hidden && (sourceDirty || location.href !== dataHref)) scheduleRefresh(); }, 1000);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) cancelPageRequest();
            else {
                if (sourceDirty || location.href !== dataHref) scheduleRefresh();
                maybeAutoLoad();
            }
        });
        setInterval(() => { if (store.on && root && !covered && !document.hidden) renderApp(); }, 30000);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
        else boot();
    } else {
        globalThis.__cad = {
            VERSION,
            store,
            extract,
            extractTopics,
            extractPosts,
            pageFid,
            pageBoardName,
            normalizeCommand,
            runCmd,
            buildReplyPayload,
            quoteBlock,
            interpretReplyResponse,
            findReplyForm,
            isImeArtifact,
            isToggleEvent,
            isEditableTarget,
            onGlobalKey,
            onInputKey,
            noteCompositionEnd,
            boot,
            resolveBoardOp,
            linkifySegments,
            findFloor,
            sortTarget,
            floorTarget,
            authorTarget,
            userCard,
            buildVotePayload,
            buildBookmarkPayload,
            buildThreadPayload,
            tabComplete,
            slashHits,
            applyCompletion,
            tidyName,
            postBoxes,
            parseQuoteNode,
            parseTopicArgs,
            parsePostArgs,
            parseUserInfoMap,
            parseAttachLoads,
            decodeUuname,
            absImg,
            imgSrc,
            nameFromUcpData,
            locFromUcpData,
            rememberName,
            decodeBuffer,
            decodeRes,
            parseNukeJson,
            stripNukePrefix,
            ucpUrls,
            get lastNameProbe() { return lastNameProbe; },
            ensureLocs,
            ingestLiveUserInfo,
            ingestHydratedAuthors,
            applyCachedNames,
            nameCache,
            get nameSources() { return nameSources; },
            get ucpGaveUp() { return ucpGaveUp; },
            titleLooksGarbled,
            applyFavorDoc,
            readFavorCache,
            sanitizeJsonText,
            formatUnix,
            sidebarFavorites,
            sidebarRecent,
            discoverPageBoards,
            isUidLabel,
            getPanel: () => panel,
            getPending: () => pendingReply,
            getTyped: () => typed,
            setTyped: v => { typed = v; },
        };
    }
})();
