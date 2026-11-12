// ==UserScript==
// @name         NGA Code Agent Disguise
// @namespace    https://github.com/aromaw/nga-code-agent-disguise
// @version      4.0.0
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
    const VERSION = '4.0.0';
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
    const COVER_TEXT = [
        'src/server.ts',
        'You',
        'Review the error path in handleRequest before we ship.',
        '',
        'Claude',
        'I read src/server.ts. The handler returns ok even when the service rejects.',
        '',
        '  @@ handleRequest',
        '  - return response.ok(result);',
        '  + if (!result.ok) return response.error(result.error);',
        '  + return response.ok(result);',
        '',
        'The change stays inside handleRequest. Waiting on you.',
    ].join('\n');
    const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#0d0d0d"/><text x="50" y="70" font-size="62" text-anchor="middle" fill="#fff" font-family="monospace">›</text></svg>'
    );

    /* ================= styles ================= */
    const css = /* css */ `
    html.cad-on body > *:not(#cad__root) { display:none !important; }
    html.cad-on body { overflow:hidden !important; background:#0d0d0d; }
    html:not(.cad-on) #cad__root { display:none !important; }

    #cad__root { --radius:6px; }
    #cad__root.cad-claude.cad-dark {
        --bg:#1f1e1d; --bg-input:#2b2a28;
        --text:#e8e6dd; --dim:#9c9a93; --faint:#6b6a64;
        --accent:#d97757; --accent2:#e8987d; --border:#3a3936; --link:#e8987d;
        --bullet:#d97757; --green:#7fce8a; --band:rgba(217,119,87,.10);
    }
    #cad__root.cad-claude.cad-light {
        --bg:#fbfaf6; --bg-input:#fbfaf6;
        --text:#1f1e1d; --dim:#6f6e67; --faint:#a3a29a;
        --accent:#c25d3f; --accent2:#b55c3d; --border:#e3e1d9; --link:#3b6fa0;
        --bullet:#c25d3f; --green:#2e7d46; --band:#f6ede5;
    }
    #cad__root.cad-codex.cad-dark {
        --bg:#0d0d0d; --bg-input:#1a1a1a;
        --text:#ececec; --dim:#a3a3a3; --faint:#6e6e6e;
        --accent:#10a37f; --accent2:#2fd6a8; --border:#2e2e2e; --link:#2fd6a8;
        --bullet:#10a37f; --green:#2fd6a8; --band:rgba(16,163,127,.10);
    }
    #cad__root.cad-codex.cad-light {
        --bg:#ffffff; --bg-input:#ffffff;
        --text:#0d0d0d; --dim:#5d5d5d; --faint:#8f8f8f;
        --accent:#0b7a5e; --accent2:#10a37f; --border:#e5e5e5; --link:#0b7a5e;
        --bullet:#0b7a5e; --green:#0b7a5e; --band:#e8f5f1;
    }

    #cad__root {
        position:fixed; inset:0; z-index:2147483000;
        display:flex; flex-direction:column;
        background:var(--bg); color:var(--text);
        font-family:"Segoe UI","PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif;
        font-size:15px; line-height:1.65; letter-spacing:0;
    }
    #cad__root, #cad__root * { box-sizing:border-box; }
    #cad__root button { font:inherit; color:inherit; }
    #cad__root a:focus-visible, #cad__root button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    /* The shell is one column inside the fixed root, so the post list scrolls and the prompt stays put. */
    .cad-app { flex:1; min-height:0; display:flex; flex-direction:row; overflow:hidden; }
    .cad-main { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; background:var(--bg); }
    .cad-side { width:248px; flex-shrink:0; border-right:1px solid var(--border); background:color-mix(in srgb, var(--text) 3%, var(--bg)); display:flex; flex-direction:column; min-height:0; overflow:auto; padding:14px 10px; }
    .cad-brand { font-weight:650; font-size:14px; padding:4px 8px 12px; }
    .cad-side-label { font-size:11px; letter-spacing:.04em; text-transform:uppercase; color:var(--dim); padding:10px 8px 4px; }
    .cad-side a, .cad-side button.cad-sideitem { display:block; width:100%; text-align:left; border:0; background:transparent; color:var(--text); border-radius:8px; padding:7px 8px; text-decoration:none; }
    .cad-side a:hover, .cad-side button.cad-sideitem:hover, .cad-side .cad-onitem { background:var(--band); }
    .cad-pill { border:1px solid var(--border); border-radius:999px; padding:2px 8px; font-size:12px; color:var(--dim); background:transparent; }
    .cad-crumb { font-size:13px; color:var(--dim); }
    .cad-modal { margin:8px 0 12px; }
    .cad-modal-card { border:1px solid var(--border); border-radius:12px; padding:12px 14px; background:var(--bg-input); color:var(--text); }
    #cad__root pre, #cad__root .cad-preview, #cad__root .cad-cover-code { background:transparent !important; color:var(--text) !important; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px; }
    #cad__root .cad-body { min-height:0; overflow-x:hidden; overscroll-behavior:contain; }

    .cad-topbar { flex-shrink:0; min-height:30px; display:flex; align-items:center; gap:6px; padding:0 10px; user-select:none; border-bottom:1px solid var(--border); }
    .cad-topbar i { width:10px; height:10px; border-radius:50%; display:block; }
    .cad-topbar i:nth-child(1){background:#ff5f57;} .cad-topbar i:nth-child(2){background:#febc2e;} .cad-topbar i:nth-child(3){background:#28c840;}
    .cad-windowtitle { margin:auto; color:var(--dim); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cad-action { border:0; background:none; color:var(--dim); cursor:pointer; padding:2px 6px; }
    .cad-action:hover { color:var(--accent2); }
    .cad-topbar .cad-action { font-size:11px; }

    .cad-welcome {
        border:1px solid var(--accent); border-radius:6px;
        display:flex; gap:24px; padding:12px 18px; margin:6px 0 18px;
    }
    .cad-welcome .left { text-align:center; min-width:200px; display:flex; flex-direction:column; justify-content:center; gap:4px; }
    .cad-welcome .logo { font-size:15px; font-weight:700; }
    .cad-welcome .right { border-left:1px solid var(--border); padding-left:24px; color:var(--text); }
    .cad-welcome .sec { color:var(--accent2); font-weight:700; }
    .cad-welcome .dim { color:var(--dim); }

    .cad-body { flex:1; overflow-y:auto; padding:4px 0 20px; scrollbar-width:thin; scrollbar-color:var(--border) transparent; }
    .cad-measure { max-width:92ch; margin:0 auto; padding:12px 28px 8px; }
    #cad__root ::selection { background:var(--accent); color:var(--bg); }
    .cad-trow { margin:0 -22px; padding:3px 22px; font-variant-numeric:tabular-nums; display:grid; grid-template-columns:38px 62px minmax(0,1fr); column-gap:0; }
    .cad-trow:hover { background:var(--band); }
    .cad-trow a.cad-tlink { color:inherit; text-decoration:none; min-width:0; }
    .cad-trow:hover a.cad-tlink { color:var(--accent2); }
    .cad-trow .cad-meta { grid-column:3; font-size:11px; }
    .cad-trep { display:inline-block; min-width:52px; text-align:right; padding-right:10px; color:var(--dim); }
    .cad-boards { margin:0 -22px 6px; padding:2px 22px; }
    .cad-boardcur { color:var(--accent2) !important; font-weight:700; }
    .cad-sect { color:var(--accent2) !important; font-weight:600; }
    .cad-line { white-space:pre-wrap; word-break:break-word; }
    .cad-user { color:var(--text); font-weight:600; background:var(--band); margin:6px -22px 2px; padding:3px 22px; }
    .cad-user::before { content:'❯ '; color:var(--accent); font-weight:700; }
    .cad-meta { color:var(--faint); font-size:12px; }
    .cad-dim { color:var(--dim); }
    .cad-faint { color:var(--faint); }
    .cad-img { display:block; max-width:min(480px, 100%); max-height:320px; border-radius:6px; margin:6px 0; border:1px solid var(--border); }
    .cad-imghide { display:none; }
    .cad-cmd { color:var(--text); font-weight:600; background:var(--band); margin:6px -22px 2px; padding:3px 22px; }
    .cad-topicnum { color:var(--faint); display:inline-block; min-width:38px; }
    .cad-pagelink { color:var(--link) !important; text-decoration:none !important; padding:0 2px; }
    .cad-pagelink:hover { text-decoration:underline !important; }
    .cad-op { background:var(--accent); color:var(--bg); border-radius:3px; padding:0 5px; font-weight:700; font-size:11px; margin-left:2px; }
    .cad-ps1 { color:var(--green); }
    .cad-body::-webkit-scrollbar { width:10px; }
    .cad-body::-webkit-scrollbar-thumb { background:var(--border); border-radius:5px; border:2px solid var(--bg); }
    .cad-title { font-size:18px; line-height:1.35; font-weight:650; margin:8px 0 2px; letter-spacing:-0.01em; }
    .cad-kicker { color:var(--faint); font-size:12px; margin-bottom:12px; }
    .cad-post { position:relative; margin:0 0 12px; padding:10px 14px 12px; border:1px solid var(--border); border-radius:8px; background:color-mix(in srgb, var(--text) 3.5%, transparent); }
    .cad-post.cad-collapsed { cursor:pointer; }
    .cad-post.cad-collapsed:hover { border-color:var(--accent); }
    .cad-post .cad-posthead { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; color:var(--dim); font-size:13px; margin:0 0 8px; }
    .cad-floor { color:var(--accent); font-weight:700; min-width:2.2em; }
    .cad-author { color:var(--text); font-weight:650; padding:0; }
    .cad-likes { color:var(--accent2); }
    .cad-post .cad-text { color:var(--text); }
    .cad-qline { color:var(--dim); white-space:pre-wrap; word-break:break-word; margin:6px 0; padding:6px 10px; border-left:2px solid var(--accent); border-radius:0 6px 6px 0; background:var(--band); }
    .cad-expand { display:flex; width:100%; margin-top:10px; padding:6px 10px; border:1px dashed var(--border); border-radius:6px; text-align:left; color:var(--accent2); }
    .cad-expand:hover { border-color:var(--accent); color:var(--accent); }
    .cad-blocktag { display:inline-block; padding:0 8px; border-radius:4px; font-weight:700; background:var(--accent); color:var(--bg); font-size:12px; margin:6px 0 2px; }
    .cad-banner { border:1px solid var(--border); border-radius:8px; padding:8px 14px; color:var(--dim); margin-bottom:12px; font-size:12.5px; }
    .cad-banner b { color:var(--text); }
    .cad-hints { flex-shrink:0; display:flex; flex-wrap:wrap; gap:6px; align-items:center; width:100%; box-sizing:border-box; padding:8px max(28px, calc((100% - 92ch) / 2)) 0; background:var(--bg); }
    .cad-hint { border:1px solid var(--border); border-radius:999px; padding:2px 8px; color:var(--dim); background:transparent; }
    .cad-hint:hover { border-color:var(--accent); color:var(--accent2); }
    .cad-inputbar {
        flex-shrink:0; position:relative; cursor:text;
        border-top:1px solid var(--border); border-bottom:1px solid var(--border);
        background:var(--bg);
        display:flex; align-items:center; gap:8px; color:var(--text);
        width:100%; box-sizing:border-box;
        padding:10px max(28px, calc((100% - 92ch) / 2));
    }
    .cad-inputbar > .cad-faint { max-width:35%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cad-inputbar .prompt { color:var(--text); font-weight:700; }
    .cad-real {
        flex:1; width:100%; min-height:52px; resize:vertical; background:var(--bg-input); color:var(--text);
        border:1px solid var(--border); border-radius:12px; outline:none; font:inherit; padding:10px 12px; caret-color:var(--text);
    }
    .cad-send { align-self:flex-end; background:var(--accent); color:var(--bg); border:0; border-radius:8px; padding:6px 14px; cursor:pointer; }
    .cad-inputbar { flex-direction:column; align-items:stretch; }
    .cad-real::placeholder { color:var(--faint); }
    .cad-cursor { width:8px; height:16px; background:var(--text); display:inline-block; flex-shrink:0; animation:cad-blink 1.06s step-end infinite; }
    @keyframes cad-blink { 50% { opacity:0; } }
    .cad-statusbar {
        flex-shrink:0; min-height:32px; display:flex; align-items:center; gap:8px;
        padding:0 16px; color:var(--dim); font-size:13px; user-select:none; overflow:hidden; white-space:nowrap;
        background:var(--bg); border-top:1px solid var(--border);
    }
    .cad-statusbar .seg { color:var(--dim); }
    .cad-statusbar .seg.hi { color:var(--link); }
    .cad-statusbar .sep { color:var(--faint); }
    .cad-statusbar .grow { flex:1; }
    .cad-statusbar .cad-flag { padding:0 4px; }
    .cad-pagesep { color:var(--faint); margin:12px 0 2px; display:flex; align-items:center; gap:10px; user-select:none; }
    .cad-pagesep::before, .cad-pagesep::after { content:''; flex:1; border-top:1px dashed var(--border); }
    .cad-panel { max-height:none; overflow:visible; border:1px solid var(--border); border-radius:12px; background:var(--bg-input); color:var(--text); padding:12px 14px; margin:0 0 14px; }
    .cad-panelhead { display:flex; justify-content:space-between; align-items:center; gap:12px; color:var(--accent2); position:sticky; top:0; background:var(--bg); }
    .cad-compose { width:100%; min-height:7em; margin:8px 0; background:var(--bg-input); color:inherit; border:1px solid var(--border); font:inherit; padding:8px; resize:vertical; }
    .cad-preview { white-space:pre-wrap; word-break:break-word; margin:8px 0; padding:8px 10px; border:1px dashed var(--border); border-radius:6px; }
    /* cad-covered is on #cad__root; the thread, prompt, and reply panel live under .cad-app. */
    .cad-covered .cad-body, .cad-covered .cad-inputbar, .cad-covered .cad-statusbar, .cad-covered .cad-panel, .cad-covered .cad-hints { display:none !important; }
    .cad-statusline { margin-top:14px; padding:8px 12px; border:1px solid var(--border); border-radius:8px; }
    .cad-statusline.cad-error { border-color:var(--accent); }
    .cad-cover { flex:1; overflow:auto; padding:28px 32px; background:var(--bg); color:var(--text); }
    .cad-cover-code { color:var(--dim) !important; background:transparent !important; line-height:1.7; white-space:pre-wrap; margin:0; }
    .cad-idlebtn { color:var(--link); }
    @media (prefers-reduced-motion:reduce) { .cad-cursor { animation:none; } }
    @media (max-width:760px) {
        .cad-welcome .right { display:none; }
        .cad-welcome .left { min-width:0; }
        .cad-body { padding:4px 0 16px; }
        .cad-measure, .cad-hints, .cad-inputbar { padding-left:16px; padding-right:16px; }
        .cad-user, .cad-cmd { margin-left:-12px; margin-right:-12px; padding-left:12px; padding-right:12px; }
        .cad-trow { margin:0 -12px; padding:3px 12px; }
        .cad-boards { margin:0 -12px 6px; padding:2px 12px; }
        .cad-inputbar, .cad-panel { padding-left:12px; padding-right:12px; }
        .cad-statusbar { padding:0 12px; }
        .cad-statusbar .cad-secondary { display:none; }
        .cad-inputbar > .cad-faint { display:none; }
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
    const locMap = {};
    let boards = GM_getValue('cad_boards', []);
    let savedThreads = GM_getValue('cad_threads', []);
    const locCache = GM_getValue('cad_loc_cache', {});
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

    function pageBoardName(doc) {
        doc = doc || document;
        const fid = pageFid(doc);
        if (!fid) return '';
        const links = [...doc.querySelectorAll('a[href*="fid="]')].reverse();
        const hit = links.find(a => fidFromHref(a.getAttribute('href')) === fid && text(a));
        return hit ? text(hit) : '';
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
            const name = text(document.querySelector(sel));
            if (!name) continue;
            // NGA's logged-out header uses these labels.
            if (/^(\u767b\u5f55|\u767b\u5165|login|sign in)$/i.test(name)) continue;
            return name;
        }
        return '';
    }

    /* ================= extract ================= */
    function isEmote(img) {
        return /smile|emoji/i.test((img.getAttribute('src') || '') + ' ' + (img.className || ''));
    }

    function imgSrc(img) {
        const raw = img.getAttribute('data-src') || img.getAttribute('data-lazy-src')
            || img.getAttribute('data-original') || img.getAttribute('src') || '';
        const abs = u => { try { return new URL(u, location.href).href; } catch (err) { return ''; } };
        const main = raw && !/loading|blank|spacer|placeholder/i.test(raw) ? abs(raw) : '';
        const link = img.closest && img.closest('a');
        const alt = link && /\.(jpe?g|png|gif|webp)/i.test(link.href) ? abs(link.href) : '';
        return { main: main || alt, alt: alt && alt !== main ? alt : '' };
    }

    function stripQuoteHeader(s) {
        return String(s || '')
            .replace(/^(?:Reply\s+to\s+)?(?:\+R\s+by|Reply(?:\s+to)?(?:\s+\+R\s+by)?|Post\s+by)[^\n]*$/gim, '')
            .replace(/\bundefined\b/gi, '');
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
        return { text: cleanText(stripQuoteHeader(plainText(clone))), imgs };
    }

    function cleanTitle(t) {
        let s = String(t || '');
        const filtered = s.match(/\u5728\s*(.*?)\s*\u4e2d\u7684\u56de\u590d/);
        if (filtered && filtered[1]) s = filtered[1];
        return s.replace(/[\s\-_]*(\u004eGA\u73a9\u5bb6\u793e\u533a|\u827e\u6cfd\u62c9\u65af\u56fd\u5bb6\u5730\u7406\u8bba\u575b|NGA)\s*$/i, '').replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();
    }

    function extractTopics(doc, baseUrl) {
        doc = doc || document;
        baseUrl = baseUrl || location.href;
        const abs = u => { try { return new URL(u, baseUrl).href; } catch (err) { return u || '#'; } };
        const rows = [...doc.querySelectorAll('.topicrow')];
        if (!rows.length) return null;
        const board = cleanTitle(
            text(doc.querySelector('#m_nav .nav_link:last-child, .nav_link:last-child'))
            || realTitle || document.title
        ) || 'board';
        return {
            kind: 'topics',
            board,
            topics: rows.map(r => {
                const titleEl = r.querySelector('.c2 .topic, .c2 .topic_title');
                let a = titleEl ? (titleEl.closest('a') || titleEl.querySelector('a')) : null;
                if (!a) {
                    a = [...r.querySelectorAll('.c2 a[href*="read.php"], .c2 a[href*="tid="]')]
                        .sort((x, y) => y.textContent.trim().length - x.textContent.trim().length)[0];
                }
                const title = text(titleEl) || text(a);
                const href = abs((a && a.getAttribute('href')) || (titleEl && titleEl.getAttribute('href')) || '');
                return {
                    title: title || '(no title)',
                    href,
                    replies: text(r.querySelector('.c1')).replace(/\D+/g, ''),
                    author: text(r.querySelector('.c3 .author')) || text(r.querySelector('.c3 a')),
                    postDate: text(r.querySelector('.c3 .postdate')),
                    replyDate: text(r.querySelector('.c4 .replydate')),
                    replyer: text(r.querySelector('.c4 .replyer')),
                };
            }).filter(t => t.title),
        };
    }

    function postUid(b) {
        const uidLink = b.querySelector('a[href*="uid="]');
        const uidEl = b.querySelector('[id^="postauthor"]');
        return text(b.querySelector('a[name="uid"]'))
            || (((uidLink && uidLink.getAttribute('href')) || '').match(/uid=(\d+)/) || [])[1]
            || (((uidEl && uidEl.id) || '').match(/postauthor(\d+)/) || [])[1]
            || '';
    }

    function pidFromNode(node) {
        if (!node || !node.querySelectorAll) return '';
        const ids = [...node.querySelectorAll('[id*="pid" i], [name*="pid" i]')].map(el => (el.id || el.getAttribute('name') || '')).join(' ');
        const idMatch = ids.match(/pid(\d+)/i);
        if (idMatch) return idMatch[1];
        const hrefs = [...node.querySelectorAll('a[href*="pid="]')].map(a => a.getAttribute('href') || '').join(' ');
        const hrefMatch = hrefs.match(/[?&#]pid=(\d+)/i);
        if (hrefMatch) return hrefMatch[1];
        const oc = [...node.querySelectorAll('[onclick]')].map(el => el.getAttribute('onclick') || '').join(' ');
        const click = oc.match(/quote\(\s*(\d+)\s*\)|pid[=:]\s*(\d+)/i);
        return (click && (click[1] || click[2])) || '';
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
        return i;
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
        const uidLink = clone.querySelector('a[href*="uid="]');
        const uid = uidLink ? (((uidLink.getAttribute('href') || '').match(/uid=(\d+)/) || [])[1] || '') : '';
        const author = uidLink ? text(uidLink) : '';
        const pid = pidFromNode(clone);
        let raw = cleanText(plainText(clone));
        let time = '';
        let name = author;
        const header = raw.match(/^(?:Reply\s+to\s+)?(?:\+R\s+by|Post\s+by|Reply)\s+(?:\[([^\]]+)\]|([^\s(]+))\s*(?:\(([^)]*)\))?\s*/i);
        if (header) {
            if (!name) name = (header[1] || header[2] || '').trim();
            time = (header[3] || '').replace(/undefined/ig, '').trim();
            raw = raw.slice(header[0].length);
        }
        raw = raw.replace(/\bundefined\b/gi, '');
        return { depth, text: cleanText(raw), author: name, time, uid, pid };
    }

    function parsePost(b, i, opUid) {
        const content = b.querySelector('.postcontent, [id^="postcontent"]');
        const infoText = text(b.querySelector('[class*="postinfo" i]')) || text(b.querySelector('.postBtnPos'));
        const dateM = infoText.match(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/);
        const uid = postUid(b);
        let pid = postPid(b);
        let name = text(b.querySelector('.posterinfo .author, .posterInfoLine .author'))
            || text(b.querySelector('[id^="postauthor"]')) || uid || 'user';
        let authorFiltered = false;
        try { authorFiltered = new URL(location.href).searchParams.has('authorid'); } catch (err) { authorFiltered = false; }
        const isOP = /\u697c\u4e3b/.test(name) || (!authorFiltered && opUid && uid && uid === opUid);
        name = name.replace(/\u697c\u4e3b/g, '').replace(/^\[|\]$/g, '').replace(/^UID\s*[:：]\s*/i, '').trim() || uid || 'user';
        const likeEl = b.querySelector('.recommendvalue');
        const likes = likeEl ? recommendScore(text(likeEl)) : '';
        const quotes = content
            ? [...content.querySelectorAll('.quote')].map(parseQuoteNode).filter(q => q.text || q.author)
            : [];
        if (!pid) pid = (quotes.find(q => q.pid) || {}).pid || '';
        const floor = postFloor(b, i, infoText);
        const head = [
            '#' + floor,
            name + (uid && uid !== name ? '(' + uid + ')' : ''),
            dateM && dateM[0],
            likes !== '' ? formatScore(likes) : '',
        ].filter(Boolean).join(' · ');
        const body = contentText(content);
        const id = 'floor:' + floor + ':' + uid;
        return { id, floor, pid, head, uid, name, isOP, date: dateM && dateM[0] || '', likes, text: body.text, imgs: body.imgs, quotes };
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

    function postBoxes(doc) {
        const direct = [...doc.querySelectorAll('.forumbox.postbox, table.postbox, [id^="postcontainer"]')];
        if (direct.length) return direct;
        const seen = new Set();
        const boxes = [];
        doc.querySelectorAll('.postcontent, [id^="postcontent"]').forEach(el => {
            const box = el.closest('table, .forumbox, [id^="post"]') || el.parentElement;
            if (box && !seen.has(box)) { seen.add(box); boxes.push(box); }
        });
        return boxes;
    }

    function extractPosts(doc, opUidOverride) {
        doc = doc || document;
        const allBoxes = postBoxes(doc);
        if (!allBoxes.length) return null;
        const elTitle = text(doc.querySelector('#toppedtopic .topic, .catetitle, h1 .topic'));
        const title = cleanTitle(elTitle || realTitle || document.title);
        const hotBoxes = findHotBoxes(doc);
        const boxes = allBoxes.filter(b => !hotBoxes.some(hb => hb === b || hb.contains(b)));
        if (!boxes.length) return null;
        const markedOP = boxes.find(b => /\u697c\u4e3b/.test(text(b.querySelector('.posterinfo .author, .posterInfoLine .author, [id^="postauthor"]'))));
        let authorFiltered = false;
        try { authorFiltered = new URL(location.href).searchParams.has('authorid'); } catch (err) { authorFiltered = false; }
        const opUid = opUidOverride !== undefined ? opUidOverride
            : (authorFiltered ? '' : ((opUidTid === curTid() && opUidSticky) || (markedOP ? postUid(markedOP) : curPageNo() <= 1 ? postUid(boxes[0]) : '')));
        const posts = boxes.map((b, i) => parsePost(b, i, opUid));
        if (opUidOverride === undefined && posts.length && posts[0].text.startsWith(title)) {
            posts[0].text = cleanText(posts[0].text.slice(title.length));
        }
        const hot = doc === document
            ? hotBoxes.slice(0, 5).map((b, i) => parsePost(b, i, opUid)).filter(p => p.text || p.imgs.length)
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

    function extract() {
        let data;
        if (document.querySelector('#m_posts')) data = extractPosts();
        else if (document.querySelector('#m_threads')) data = extractTopics();
        else data = { kind: 'idle' };
        if (data) data.pager = extractPager();
        return data;
    }

    /* ================= locations ================= */
    function fetchLoc(uid) {
        if (locCache[uid]) return Promise.resolve(locCache[uid]);
        return fetch('https://' + location.host + '/nuke.php?__output=11&__act=get&__lib=ucp&uid=' + uid, { credentials: 'include' })
            .then(r => r.json())
            .then(res => {
                const loc = res && res.data && res.data[0] && res.data[0].ipLoc || '';
                if (loc) {
                    const keys = Object.keys(locCache);
                    if (keys.length > 800) keys.slice(0, 400).forEach(k => delete locCache[k]);
                    locCache[uid] = loc;
                    GM_setValue('cad_loc_cache', locCache);
                }
                return loc;
            })
            .catch(() => '');
    }

    function ensureLocs() {
        if (!lastData || lastData.kind !== 'posts') return;
        const uids = [...new Set([...(lastData.posts || []), ...(lastData.hot || [])].map(p => p.uid).filter(Boolean))];
        uids.filter(u => !(u in locMap) && /^\d+$/.test(u)).forEach(uid => {
            locMap[uid] = '';
            fetchLoc(uid).then(loc => {
                if (loc) {
                    locMap[uid] = loc;
                    scheduleLocRender();
                }
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
            const n = (data.posts || []).reduce((a, p) => a + (p.sep ? 0 : 1), 0);
            return [n + ' posts', ctx.filter, ctx.sort].filter(Boolean).join(' · ');
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

    function focusPrompt() {
        setTimeout(() => {
            if (!store.on || covered || !inputEl) return;
            const active = document.activeElement;
            if (active && active !== inputEl && root && !root.contains(active) && active.blur) active.blur();
            inputEl.focus();
        }, 0);
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

    function tabComplete(v) {
        const hits = CMDS.filter(c => c.startsWith(String(v || '').toLowerCase()));
        if (hits.length === 1) {
            typed = hits[0] + (NEEDS_ARG.has(hits[0]) ? ' ' : '');
            renderApp();
        } else if (hits.length > 1) {
            let p = hits[0];
            for (const c of hits) while (!c.startsWith(p)) p = p.slice(0, -1);
            if (p.length > v.length) {
                typed = p;
                renderApp();
            } else finish(v, [line(esc(hits.join('  ')), 'cad-faint')]);
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
        const rows = [];
        const seen = new Set();
        [...doc.querySelectorAll('a[href*="read.php"], a[href*="tid="]')].forEach(a => {
            const title = text(a);
            const href = a.getAttribute('href') || '';
            if (!title || title.length < 2 || seen.has(href)) return;
            seen.add(href);
            let abs = href;
            try { abs = new URL(href, url).href; } catch (err) { abs = href; }
            rows.push({ title, href: abs });
        });
        const login = /\u8bf7\u5148\u767b\u5f55|\u5c1a\u672a\u767b\u5f55|\u8bf7\u767b\u5f55|not logged in/i.test(doc.body ? doc.body.textContent : '');
        return { rows: rows.slice(0, 20), url, login };
    }

    function favoriteLinks(doc) {
        const data = extractTopics(doc);
        if (data && data.topics && data.topics.filter(t => !t.sep).length) return data.topics.filter(t => !t.sep);
        const out = [];
        const seen = new Set();
        doc.querySelectorAll('a[href*="read.php"], a[href*="tid="]').forEach(a => {
            const href = a.getAttribute('href') || '';
            const title = text(a);
            if (!title || title.length < 2 || seen.has(href)) return;
            seen.add(href);
            let abs = href;
            try { abs = new URL(href, location.href).href; } catch (err) { abs = href; }
            out.push({ title, href: abs });
        });
        return out;
    }

    async function cmdUser(token) {
        const card = userCard(token);
        let name = card.name;
        let loc = card.loc;
        if (card.uid) {
            try {
                const res = await fetch('https://' + location.host + '/nuke.php?__output=11&__act=get&__lib=ucp&uid=' + encodeURIComponent(card.uid), { credentials: 'include' });
                const json = await res.json();
                const row = json && json.data && json.data[0] || {};
                name = row.username || row.nick || row.name || name;
                loc = row.ipLoc || loc;
                if (loc) locMap[card.uid] = loc;
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
            lastData = null;
            nextPageUrl = null;
            loadedPages = new Set([location.href]);
            opNextNo = null;
            opEnd = false;
            out = [line('op only → ' + (store.opOnly ? 'on (author pages append below)' : 'off'), 'cad-faint')];
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

    function decodeRes(r) {
        const m = (r.headers.get('content-type') || '').match(/charset=([\w-]+)/i);
        return r.arrayBuffer().then(buf => {
            let cs = m && m[1];
            if (!cs) {
                const head = new TextDecoder('latin1').decode(buf.slice(0, 4096));
                const mm = head.match(/charset=["']?([\w-]+)/i);
                cs = mm && mm[1];
            }
            try { return new TextDecoder(cs || 'gbk').decode(buf); }
            catch (err) { return new TextDecoder('gbk').decode(buf); }
        });
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
            if (!opUidSticky && (curPageNo() <= 1 || new URLSearchParams(location.search).has('authorid')))
                opUidSticky = (fresh.posts[0] && fresh.posts[0].uid) || '';
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
            const active = document.activeElement;
            if (active && active.blur && (!root || !root.contains(active))) active.blur();
            build();
            applyAttrs();
            setFavicon(true);
            refresh(true);
            focusPrompt();
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
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const v = el.value;
            typed = '';
            histIdx = -1;
            renderApp();
            runCmd(v);
            return;
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            if (el.value) tabComplete(el.value);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
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

    const PostBlock = ({ p, maxLines }) => {
        const clip = clipState(p.text, maxLines);
        const clipped = !store.expand && !expandedPosts.has(p.id) && clip.clipped;
        const tip = (p.uid ? 'uid ' + p.uid : p.name) + (p.uid && locMap[p.uid] ? ' · ' + locMap[p.uid] : '');
        return html`<article id=${'cad-floor-' + p.floor} class=${'cad-post' + (clipped ? ' cad-collapsed' : '')} onClick=${e => {
            if (!clipped) return;
            const t = e.target;
            if (t && t.closest && t.closest('a, button, textarea, input')) return;
            if (expandedPosts.has(p.id)) expandedPosts.delete(p.id); else expandedPosts.add(p.id);
            renderApp();
        }}>
            <header class="cad-posthead">
                <span class="cad-floor">#${p.floor}</span>
                <button type="button" class="cad-action cad-author" title=${tip} onClick=${() => runCmd('user ' + (p.uid || p.name))}>${p.name}</button>
                ${p.isOP ? html`<span class="cad-op">OP</span>` : null}
                ${p.date ? html`<span>${p.date}</span>` : null}
                ${p.likes !== '' ? html`<span class="cad-likes">${formatScore(p.likes)}</span>` : null}
                <${Loc} uid=${p.uid} />
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

    const BoardsBar = () => {
        const cur = pageFid();
        const save = cur
            ? html`<button type="button" class="cad-action" title="board add" onClick=${() => runCmd('board add')}>[+]</button>`
            : null;
        // Element children only. Adjacent text nodes make Preact's diff throw in jsdom
        // ("The child can not be found in the parent") when the row gains its first board.
        if (!boards.length) return save;
        return html`<div class="cad-boards cad-line cad-faint"><span>boards:</span>${boards.map((b, i) => html`<a class=${'cad-pagelink' + (String(b.fid) === String(cur) ? ' cad-boardcur' : '')} href=${'/thread.php?fid=' + encodeURIComponent(b.fid)} title=${'board ' + (i + 1)}>${b.name}</a>`)}${save}</div>`;
    };

    const CmdLine = ({ cwd, cmd }) => html`<div class="cad-cmd"><span class="cad-ps1">➜ ${cwd}</span> ${cmd}</div>`;
    const Welcome = ({ cwd }) => store.compact
        ? html`<div class="cad-banner"><b>✻ Claude Code</b><br />workspace: ${cwd}<br /><span class="cad-faint">/help · Esc covers</span></div>`
        : html`<div class="cad-welcome">
            <div class="left">
                <div class="logo">✻ Welcome to Claude Code</div>
                <div class="dim">/help for help</div>
                <div class="dim">cwd: ${cwd}</div>
            </div>
            <div class="right">
                <div><span class="sec">Tips</span></div>
                <div>· <b>/help</b> lists commands. A leading / is optional.</div>
                <div>· <b>board list</b> and <b>board fid</b> open a board from an empty page.</div>
                <div>· <b>img</b> toggles lazy thumbnails. Click [image] to open one.</div>
                <div class="dim">vim is off. h/l scroll and do not change pages. \` toggles outside text fields.</div>
            </div>
        </div>`;
    const CodexBanner = () => html`<div class="cad-banner"><b>› OpenAI Codex</b><br />model: <b>gpt-5-codex</b> · reasoning: medium<br />directory: ${store.compact ? FAKE_DIR : cwdFor(lastData || { kind: 'idle' })}</div>`;

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
            let tn = 0;
            return html`<div>
                <${Welcome} cwd=${cwd} />
                <${CmdLine} cwd=${cwd} cmd=${contextLine(data)} />
                <div class="cad-kicker"><span class="cad-sect">${data.board}</span> · ${data.topics.reduce((a, t) => a + (t.sep ? 0 : 1), 0)} topics</div>
                ${data.topics.map(t => t.sep ? html`<${PageSep} key=${t.sep} label=${t.sep} />` : html`<${TopicRow} key=${t.href} t=${t} i=${tn++} />`)}
                <${Pager} pager=${data.pager} />
            </div>`;
        }
        if (data.kind === 'posts') {
            const visible = store.opOnly ? data.posts.filter(p => p.isOP || p.sep) : data.posts;
            return html`<div>
                <${CmdLine} cwd=${cwd} cmd=${store.compact ? 'cat notes/review.md' : 'open "' + data.title + '"'} />
                <h1 class="cad-title">${data.title}</h1>
                <div class="cad-kicker">${contextLine(data)}</div>
                ${(!store.opOnly && data.hot && data.hot.length) ? html`<div class="cad-line" style="margin-top:6px"><span class="cad-sect">${store.compact ? 'highlights' : 'hot replies'}</span></div>
                    ${data.hot.map(p => html`<${PostBlock} key=${'hot-' + p.id} p=${p} maxLines=${POST_PREVIEW_LINES} />`)}` : null}
                <div class="cad-line" style="margin-top:6px"><span class="cad-sect">${store.compact ? 'output' : 'replies'}</span></div>
                ${visible.map(p => p.sep ? html`<${PageSep} key=${p.sep} label=${p.sep} />` : html`<${PostBlock} key=${p.id} p=${p} maxLines=${POST_PREVIEW_LINES} />`)}
                <${Pager} pager=${data.pager} />
                <div class="cad-kicker">ctrl+o ${store.expand ? 'collapses' : 'expands'} every post. reply, quote, post, and vote wait for y.</div>
            </div>`;
        }
        return html`<${IdleView} />`;
    };

    const CodexView = ({ data }) => {
        const cwd = cwdFor(data);
        if (data.kind === 'topics') {
            let tn = 0;
            return html`<div>
                <${CodexBanner} />
                <div class="cad-blocktag">user</div>
                <div class="cad-line">${store.compact ? 'Inspect the workspace index' : 'List topics in ' + data.board}</div>
                <div class="cad-blocktag">codex</div>
                <div class="cad-line cad-faint">cwd: ${cwd} · ${data.topics.reduce((a, t) => a + (t.sep ? 0 : 1), 0)} topics</div>
                ${data.topics.map(t => t.sep ? html`<${PageSep} key=${t.sep} label=${t.sep} />` : html`<${TopicRow} key=${t.href} t=${t} i=${tn++} />`)}
                <${Pager} pager=${data.pager} />
            </div>`;
        }
        if (data.kind === 'posts') {
            const visible = store.opOnly ? data.posts.filter(p => p.isOP || p.sep) : data.posts;
            return html`<div>
                <${CodexBanner} />
                <div class="cad-blocktag">user</div>
                <div class="cad-line">${store.compact ? 'Read notes/review.md' : 'Open thread ' + data.title}</div>
                <div class="cad-blocktag">codex</div>
                <h1 class="cad-title">${data.title}</h1>
                <div class="cad-kicker">${data.posts.reduce((a, p) => a + (p.sep ? 0 : 1), 0)} posts${store.opOnly ? ' · OP only' : ''} · cwd: ${cwd}</div>
                ${(!store.opOnly && data.hot && data.hot.length) ? html`<div class="cad-line" style="margin-top:6px"><span class="cad-sect">${store.compact ? 'highlights' : 'hot replies'}</span></div>
                    ${data.hot.map(p => html`<${PostBlock} key=${'hot-' + p.id} p=${p} maxLines=${POST_PREVIEW_LINES} />`)}` : null}
                <div class="cad-line" style="margin-top:6px"><span class="cad-sect">${store.compact ? 'output' : 'replies'}</span></div>
                ${visible.map(p => p.sep ? html`<${PageSep} key=${p.sep} label=${p.sep} />` : html`<${PostBlock} key=${p.id} p=${p} maxLines=${POST_PREVIEW_LINES} />`)}
                <${Pager} pager=${data.pager} />
            </div>`;
        }
        return html`<div><${CodexBanner} /><${IdleView} /></div>`;
    };

    const AutoLoadState = () => {
        if (autoPageLoading) return html`<div class="cad-statusline cad-faint" role="status">Loading the next page…</div>`;
        if (autoPageError) return html`<div class="cad-statusline cad-error" role="alert"><button type="button" class="cad-action cad-idlebtn" onClick=${() => loadNextPage()}>Could not load the next page. Retry</button></div>`;
        const list = lastData && (lastData.posts || lastData.topics);
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
            <span class="cad-faint">Tab completes · y confirms a post</span>
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
            : 'Message or /command';
        const slash = typed.trim().startsWith('/') ? CMDS.filter(c => ('/' + c).startsWith(typed.trim().toLowerCase()) || c.startsWith(typed.trim().slice(1).toLowerCase())).slice(0, 8) : [];
        return html`<div class="cad-inputbar" onClick=${() => { if (inputEl) inputEl.focus(); }}>
            ${slash.length ? html`<div class="cad-slash">${slash.map(c => html`<button type="button" class="cad-action cad-hint" onClick=${() => focusInput('/' + c + ' ')}>${'/' + c}</button>`)}</div>` : null}
            <textarea class="cad-real" rows="2" aria-label="Message" placeholder=${placeholder} ref=${el => { inputEl = el; }} value=${typed}
                spellcheck="false" autocomplete="off" autocapitalize="off"
                onInput=${e => { typed = e.currentTarget.value; }}
                onKeyDown=${onInputKey}
                onCompositionEnd=${() => noteCompositionEnd()}
                onFocus=${() => { focused = true; }}
                onBlur=${() => { focused = false; }}></textarea>
            <button type="button" class="cad-send" onClick=${() => { const v = typed; typed = ''; if (inputEl) inputEl.value = ''; runCmd(v); }}>Send</button>
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

    const Sidebar = () => html`<aside class="cad-side">
        <div class="cad-brand">${store.style === 'claude' ? 'Claude' : 'Codex'}</div>
        <div class="cad-side-label">Projects</div>
        ${boards.length ? boards.map(b => html`<a class=${String(b.fid) === String(pageFid()) ? 'cad-onitem' : ''} href=${'/thread.php?fid=' + encodeURIComponent(b.fid)}>${b.name}</a>`) : html`<button type="button" class="cad-sideitem" onClick=${() => runCmd('board add')}>Save this board</button>`}
        <div class="cad-side-label">Sessions</div>
        ${(savedThreads || []).slice(0, 12).map(t => html`<a href=${'/read.php?tid=' + encodeURIComponent(t.tid)}>${t.title}</a>`)}
    </aside>`;

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
            <button type="button" class="cad-action" onClick=${() => pageNav(-1)}>Prev</button>
            <button type="button" class="cad-action" onClick=${() => pageNav(1)}>Next</button>
            <button type="button" class="cad-action" onClick=${() => { store.mode = store.mode === 'dark' ? 'light' : 'dark'; applyAttrs(); renderApp(); }}>${store.mode}</button>
            <button type="button" class="cad-action" onClick=${() => toggleCover()}>Esc</button>
        </div>`;
    };

    const App = () => {
        const data = lastData || { kind: 'idle' };
        return html`<div class="cad-app">
            <${Sidebar} />
            <div class="cad-main">
                <${TopBar} data=${data} />
                ${covered ? html`<div class="cad-cover"><div class="cad-brand">${store.style === 'claude' ? 'Claude' : 'Codex'}</div><pre class="cad-cover-code">${COVER_TEXT}</pre></div>` : null}
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
            getPanel: () => panel,
            getPending: () => pendingReply,
        };
    }
})();
