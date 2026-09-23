// ==UserScript==
// @name         NGA Code Agent 伪装（Claude Code / Codex）
// @namespace    https://github.com/zhaoyifan
// @version      2.2.3
// @description  将 NGA 页面伪装成 Claude Code / Codex CLI 终端会话，旁人看来你在用 code agent。` 一键切换，? 帮助，输入栏可敲命令（search: 搜索 · board 切版 · help 查看全部），vim 键位。渲染层 Preact 重构
// @author       zhaoyifan
// @match        *://bbs.nga.cn/*
// @match        *://ngabbs.com/*
// @match        *://bbs.ngacn.cc/*
// @match        *://nga.178.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    /* ================= 配置 ================= */
    const store = {
        get on()    { return GM_getValue('cad_on', true); },
        get style() { return GM_getValue('cad_style', 'claude'); },  // claude | codex
        get mode()  { return GM_getValue('cad_mode', 'dark'); },     // dark | light
        get img()   { return GM_getValue('cad_img', false); },       // 是否显示图片
        get opOnly(){ return GM_getValue('cad_op_only', false); },   // 仅楼主
        get expand(){ return GM_getValue('cad_expand', false); },    // 展开全部截断楼层
        get vim()   { return GM_getValue('cad_vim', true); },        // vim 键位
        get autopage(){ return GM_getValue('cad_autopage', true); }, // 滚到底自动加载下一页
        set on(v)    { GM_setValue('cad_on', v); },
        set style(v) { GM_setValue('cad_style', v); },
        set mode(v)  { GM_setValue('cad_mode', v); },
        set img(v)   { GM_setValue('cad_img', v); },
        set opOnly(v){ GM_setValue('cad_op_only', v); },
        set expand(v){ GM_setValue('cad_expand', v); },
        set vim(v)   { GM_setValue('cad_vim', v); },
        set autopage(v){ GM_setValue('cad_autopage', v); },
    };

    const FAKE_DIR  = '~/projects/api-server';
    const FAVICON = "data:image/svg+xml," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#0d0d0d"/><text x="50" y="70" font-size="62" text-anchor="middle" fill="#fff" font-family="monospace">›</text></svg>`
    );

    /* ================= 样式 ================= */
    const css = /* css */ `
    /* 隐藏原始页面；伪装关闭时隐藏伪装层 */
    html.cad-on body > *:not(#cad__root) { display:none !important; }
    html.cad-on body { overflow:hidden !important; background:#0d0d0d; }
    html:not(.cad-on) #cad__root { display:none !important; }

    /* ---------- 主题变量 ---------- */
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
        font-family:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,"Maple Mono NF CN","Sarasa Mono SC","Microsoft YaHei UI",monospace;
        font-size:14px; line-height:1.58; letter-spacing:0.25px;
    }

    /* 顶部极简窗口点 */
    .cad-topbar { flex-shrink:0; height:22px; display:flex; align-items:center; padding:0 10px; user-select:none; }
    .cad-topbar i { width:10px; height:10px; border-radius:50%; display:block; margin-right:6px; }
    .cad-topbar i:nth-child(1){background:#ff5f57;} .cad-topbar i:nth-child(2){background:#febc2e;} .cad-topbar i:nth-child(3){background:#28c840;}

    /* 欢迎框 */
    .cad-welcome {
        border:1px solid var(--accent); border-radius:6px;
        display:flex; gap:24px; padding:12px 18px; margin:6px 0 18px;
    }
    .cad-welcome .left { text-align:center; min-width:200px; display:flex; flex-direction:column; justify-content:center; gap:4px; }
    .cad-welcome .logo { font-size:15px; font-weight:700; }
    .cad-welcome .right { border-left:1px solid var(--border); padding-left:24px; color:var(--text); }
    .cad-welcome .sec { color:var(--accent2); font-weight:700; }
    .cad-welcome .dim { color:var(--dim); }

    /* 内容区 */
    .cad-body { flex:1; overflow-y:auto; padding:12px 22px 16px; scrollbar-width:thin; scrollbar-color:var(--border) transparent; }
    /* 选中色贴合主题 */
    #cad__root ::selection { background:var(--accent); color:var(--bg); }
    /* 话题行：整行 hover 高亮，可点区域更大；列对齐（ls -l 风） */
    .cad-trow { margin:0 -22px; padding:3px 22px; font-variant-numeric:tabular-nums; }
    .cad-trow:hover { background:var(--band); }
    .cad-trow a.cad-tlink { color:inherit; text-decoration:none; transition:color .08s; }
    .cad-trow:hover a.cad-tlink { color:var(--accent2); }
    .cad-trep { display:inline-block; min-width:52px; text-align:right; padding-right:10px; color:var(--dim); }
    /* boards 收藏快捷栏 */
    .cad-boards { margin:0 -22px 6px; padding:2px 22px; }
    .cad-boardcur { color:var(--accent2) !important; font-weight:700; }
    .cad-boardadd { cursor:pointer; color:var(--faint); padding:0 2px; user-select:none; }
    .cad-boardadd:hover { color:var(--accent2); }
    /* 区块标题（hot replies / all replies / pages） */
    .cad-sect { color:var(--accent2) !important; font-weight:600; }
    .cad-line { white-space:pre-wrap; word-break:break-word; }
    /* 用户输入回显：整行暖色底带 */
    .cad-user  {
        color:var(--text); font-weight:600;
        background:var(--band); margin:6px -22px 2px; padding:3px 22px;
    }
    .cad-user::before { content:'❯ '; color:var(--accent); font-weight:700; }
    .cad-meta  { color:var(--faint); font-size:12px; }
    .cad-dim   { color:var(--dim); }
    .cad-faint { color:var(--faint); }
    .cad-gap   { height:4px; }
    .cad-img   { display:block; max-width:480px; max-height:320px; border-radius:6px; margin:6px 0; border:1px solid var(--border); box-sizing:border-box; }
    .cad-imghide { display:none; }

    /* shell 线性排版（redditshell 风） */
    .cad-cmd { color:var(--text); font-weight:600; background:var(--band); margin:6px -22px 2px; padding:3px 22px; }
    .cad-topicnum { color:var(--faint); display:inline-block; min-width:38px; }
    .cad-pagelink { color:var(--link) !important; text-decoration:none !important; padding:0 2px; }
    .cad-pagelink:hover { text-decoration:underline !important; }
    /* OP 反色徽章 */
    .cad-op { background:var(--accent); color:var(--bg); border-radius:3px; padding:0 5px; font-weight:700; font-size:11px; margin-left:2px; }
    /* shell 提示符 */
    .cad-ps1 { color:var(--green); }
    /* 终端滚动条 */
    .cad-body::-webkit-scrollbar { width:10px; }
    .cad-body::-webkit-scrollbar-thumb { background:var(--border); border-radius:5px; border:2px solid var(--bg); }
    .cad-body::-webkit-scrollbar-thumb:hover { background:var(--faint); }
    .cad-body::-webkit-scrollbar-track { background:transparent; }
    /* 楼层块：bullet + 悬挂缩进，层间虚线分隔 */
    .cad-post { position:relative; padding:5px 0 5px 18px; border-bottom:1px dashed var(--border); }
    .cad-post:last-child { border-bottom:none; }
    .cad-post::before { content:'●'; position:absolute; left:0; top:5px; color:var(--bullet); }
    .cad-post .cad-posthead { color:var(--faint); font-size:12px; margin:0 0 1px; }
    .cad-post .cad-text { color:var(--text); }
    .cad-qline { color:var(--dim); white-space:pre-wrap; word-break:break-word; }

    /* codex 风格元素 */
    .cad-blocktag {
        display:inline-block; padding:0 8px; border-radius:4px; font-weight:700;
        background:var(--accent); color:var(--bg); font-size:12px; margin:6px 0 2px;
    }
    .cad-bullet::before { content:'• '; color:var(--accent); }
    .cad-banner {
        border:1px solid var(--border); border-radius:8px; padding:8px 14px;
        color:var(--dim); margin-bottom:12px; font-size:12.5px;
    }
    .cad-banner b { color:var(--text); }

    /* 底部输入行（全宽、上下分隔线，真实 input 受控输入） */
    .cad-inputbar {
        flex-shrink:0; padding:10px 22px; position:relative; cursor:text;
        border-top:1px solid var(--border); border-bottom:1px solid var(--border);
        background:color-mix(in srgb, var(--text) 3%, transparent);
        display:flex; align-items:center; gap:8px; color:var(--text);
    }
    .cad-inputbar .prompt { color:var(--text); font-weight:700; }
    .cad-real {
        flex:1; min-width:60px; background:transparent; border:none; outline:none;
        color:inherit; font:inherit; letter-spacing:inherit; padding:0; margin:0;
        caret-color:var(--text);
    }
    .cad-cursor {
        width:8px; height:16px; background:var(--text); display:inline-block; flex-shrink:0;
        animation:cad-blink 1.06s step-end infinite;
    }
    @keyframes cad-blink { 50% { opacity:0; } }

    /* 状态栏（分段式） */
    .cad-statusbar {
        flex-shrink:0; height:28px; display:flex; align-items:center; gap:10px;
        padding:0 22px; color:var(--faint); font-size:11.5px; user-select:none;
        background:color-mix(in srgb, var(--text) 4%, transparent);
    }
    .cad-statusbar .seg { color:var(--dim); }
    .cad-statusbar .seg.hi { color:var(--link); }
    .cad-statusbar .sep { color:var(--faint); }
    .cad-statusbar .grow { flex:1; }
    .cad-themeswitch { cursor:pointer; color:var(--faint); }
    .cad-themeswitch:hover { color:var(--accent2); }

    /* 无限滚动：分页分隔线 */
    .cad-pagesep {
        color:var(--faint); margin:12px 0 2px; display:flex; align-items:center; gap:10px;
        user-select:none;
    }
    .cad-pagesep::before, .cad-pagesep::after { content:''; flex:1; border-top:1px dashed var(--border); }

    /* 窄屏适配 */
    @media (max-width:760px) {
        .cad-welcome .right { display:none; }
        .cad-welcome .left { min-width:0; }
        .cad-body { padding:8px 12px 12px; }
        .cad-user, .cad-cmd { margin-left:-12px; margin-right:-12px; padding-left:12px; padding-right:12px; }
        .cad-trow { margin:0 -12px; padding:3px 12px; }
        .cad-boards { margin:0 -12px 6px; padding:2px 12px; }
        .cad-inputbar { padding:8px 12px; }
        .cad-statusbar { padding:0 12px; }
        .cad-img { max-width:100%; }
    }
    `;

    const injectStyle = () => {
        if (typeof GM_addStyle === 'function') GM_addStyle(css);
        else {
            const s = document.createElement('style');
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
        }
    };
    injectStyle();

    /* 保险：移除页面可能的 meta 自动刷新（head 未解析完时用观察者兜底） */
    const stripMetaRefresh = () => {
        const kill = () => document.querySelectorAll('meta[http-equiv="refresh" i]').forEach(m => m.remove());
        kill();
        if (document.readyState === 'loading') {
            new MutationObserver((_, obs) => {
                kill();
                if (document.head) obs.disconnect();
            }).observe(document.documentElement, { childList: true, subtree: true });
        }
    };
    stripMetaRefresh();

    // ===== vendored: preact 10.24.3 UMD (MIT, https://github.com/preactjs/preact) =====
!function(n,l){"object"==typeof exports&&"undefined"!=typeof module?l(exports):"function"==typeof define&&define.amd?define(["exports"],l):l((n||self).preact={})}(this,function(n){var l,t,u,i,o,e,r,f,c,s,h,a,p=65536,v=1<<17,d={},y=[],w=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,_=Array.isArray;function g(n,l){for(var t in l)n[t]=l[t];return n}function b(n){n&&n.parentNode&&n.parentNode.removeChild(n)}function m(n,t,u){var i,o,e,r={};for(e in t)"key"==e?i=t[e]:"ref"==e?o=t[e]:r[e]=t[e];if(arguments.length>2&&(r.children=arguments.length>3?l.call(arguments,2):u),"function"==typeof n&&null!=n.defaultProps)for(e in n.defaultProps)void 0===r[e]&&(r[e]=n.defaultProps[e]);return k(n,r,i,o,null)}function k(n,l,i,o,e){var r={type:n,props:l,key:i,ref:o,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,constructor:void 0,__v:null==e?++u:e,__i:-1,__u:0};return null==e&&null!=t.vnode&&t.vnode(r),r}function x(n){return n.children}function S(n,l){this.props=n,this.context=l}function C(n,l){if(null==l)return n.__?C(n.__,n.__i+1):null;for(var t;l<n.__k.length;l++)if(null!=(t=n.__k[l])&&null!=t.__e)return t.__e;return"function"==typeof n.type?C(n):null}function M(n){var l,t;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(t=n.__k[l])&&null!=t.__e){n.__e=n.__c.base=t.__e;break}return M(n)}}function P(n){(!n.__d&&(n.__d=!0)&&o.push(n)&&!T.__r++||e!==t.debounceRendering)&&((e=t.debounceRendering)||r)(T)}function T(){var n,l,u,i,e,r,c,s;for(o.sort(f);n=o.shift();)n.__d&&(l=o.length,i=void 0,r=(e=(u=n).__v).__e,c=[],s=[],u.__P&&((i=g({},e)).__v=e.__v+1,t.vnode&&t.vnode(i),O(u.__P,i,e,u.__n,u.__P.namespaceURI,32&e.__u?[r]:null,c,null==r?C(e):r,!!(32&e.__u),s),i.__v=e.__v,i.__.__k[i.__i]=i,z(c,i,s),i.__e!=r&&M(i)),o.length>l&&o.sort(f));T.__r=0}function $(n,l,t,u,i,o,e,r,f,c,s){var h,a,v,w,_,g=u&&u.__k||y,b=l.length;for(t.__d=f,I(t,l,g),f=t.__d,h=0;h<b;h++)null!=(v=t.__k[h])&&(a=-1===v.__i?d:g[v.__i]||d,v.__i=h,O(n,v,a,i,o,e,r,f,c,s),w=v.__e,v.ref&&a.ref!=v.ref&&(a.ref&&V(a.ref,null,v),s.push(v.ref,v.__c||w,v)),null==_&&null!=w&&(_=w),v.__u&p||a.__k===v.__k?f=H(v,f,n):"function"==typeof v.type&&void 0!==v.__d?f=v.__d:w&&(f=w.nextSibling),v.__d=void 0,v.__u&=-196609);t.__d=f,t.__e=_}function I(n,l,t){var u,i,o,e,r,f=l.length,c=t.length,s=c,h=0;for(n.__k=[],u=0;u<f;u++)null!=(i=l[u])&&"boolean"!=typeof i&&"function"!=typeof i?(e=u+h,(i=n.__k[u]="string"==typeof i||"number"==typeof i||"bigint"==typeof i||i.constructor==String?k(null,i,null,null,null):_(i)?k(x,{children:i},null,null,null):void 0===i.constructor&&i.__b>0?k(i.type,i.props,i.key,i.ref?i.ref:null,i.__v):i).__=n,i.__b=n.__b+1,o=null,-1!==(r=i.__i=L(i,t,e,s))&&(s--,(o=t[r])&&(o.__u|=v)),null==o||null===o.__v?(-1==r&&h--,"function"!=typeof i.type&&(i.__u|=p)):r!==e&&(r==e-1?h--:r==e+1?h++:(r>e?h--:h++,i.__u|=p))):i=n.__k[u]=null;if(s)for(u=0;u<c;u++)null!=(o=t[u])&&0==(o.__u&v)&&(o.__e==n.__d&&(n.__d=C(o)),q(o,o))}function H(n,l,t){var u,i;if("function"==typeof n.type){for(u=n.__k,i=0;u&&i<u.length;i++)u[i]&&(u[i].__=n,l=H(u[i],l,t));return l}n.__e!=l&&(l&&n.type&&!t.contains(l)&&(l=C(n)),t.insertBefore(n.__e,l||null),l=n.__e);do{l=l&&l.nextSibling}while(null!=l&&8===l.nodeType);return l}function L(n,l,t,u){var i=n.key,o=n.type,e=t-1,r=t+1,f=l[t];if(null===f||f&&i==f.key&&o===f.type&&0==(f.__u&v))return t;if(u>(null!=f&&0==(f.__u&v)?1:0))for(;e>=0||r<l.length;){if(e>=0){if((f=l[e])&&0==(f.__u&v)&&i==f.key&&o===f.type)return e;e--}if(r<l.length){if((f=l[r])&&0==(f.__u&v)&&i==f.key&&o===f.type)return r;r++}}return-1}function j(n,l,t){"-"===l[0]?n.setProperty(l,null==t?"":t):n[l]=null==t?"":"number"!=typeof t||w.test(l)?t:t+"px"}function A(n,l,t,u,i){var o;n:if("style"===l)if("string"==typeof t)n.style.cssText=t;else{if("string"==typeof u&&(n.style.cssText=u=""),u)for(l in u)t&&l in t||j(n.style,l,"");if(t)for(l in t)u&&t[l]===u[l]||j(n.style,l,t[l])}else if("o"===l[0]&&"n"===l[1])o=l!==(l=l.replace(/(PointerCapture)$|Capture$/i,"$1")),l=l.toLowerCase()in n||"onFocusOut"===l||"onFocusIn"===l?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+o]=t,t?u?t.t=u.t:(t.t=c,n.addEventListener(l,o?h:s,o)):n.removeEventListener(l,o?h:s,o);else{if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==t?"":t;break n}catch(n){}"function"==typeof t||(null==t||!1===t&&"-"!==l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==t?"":t))}}function F(n){return function(l){if(this.l){var u=this.l[l.type+n];if(null==l.u)l.u=c++;else if(l.u<u.t)return;return u(t.event?t.event(l):l)}}}function O(n,l,u,i,o,e,r,f,c,s){var h,a,p,v,d,y,w,b,m,k,C,M,P,T,I,H,L=l.type;if(void 0!==l.constructor)return null;128&u.__u&&(c=!!(32&u.__u),e=[f=l.__e=u.__e]),(h=t.__b)&&h(l);n:if("function"==typeof L)try{if(b=l.props,m="prototype"in L&&L.prototype.render,k=(h=L.contextType)&&i[h.__c],C=h?k?k.props.value:h.__:i,u.__c?w=(a=l.__c=u.__c).__=a.__E:(m?l.__c=a=new L(b,C):(l.__c=a=new S(b,C),a.constructor=L,a.render=B),k&&k.sub(a),a.props=b,a.state||(a.state={}),a.context=C,a.__n=i,p=a.__d=!0,a.__h=[],a._sb=[]),m&&null==a.__s&&(a.__s=a.state),m&&null!=L.getDerivedStateFromProps&&(a.__s==a.state&&(a.__s=g({},a.__s)),g(a.__s,L.getDerivedStateFromProps(b,a.__s))),v=a.props,d=a.state,a.__v=l,p)m&&null==L.getDerivedStateFromProps&&null!=a.componentWillMount&&a.componentWillMount(),m&&null!=a.componentDidMount&&a.__h.push(a.componentDidMount);else{if(m&&null==L.getDerivedStateFromProps&&b!==v&&null!=a.componentWillReceiveProps&&a.componentWillReceiveProps(b,C),!a.__e&&(null!=a.shouldComponentUpdate&&!1===a.shouldComponentUpdate(b,a.__s,C)||l.__v===u.__v)){for(l.__v!==u.__v&&(a.props=b,a.state=a.__s,a.__d=!1),l.__e=u.__e,l.__k=u.__k,l.__k.some(function(n){n&&(n.__=l)}),M=0;M<a._sb.length;M++)a.__h.push(a._sb[M]);a._sb=[],a.__h.length&&r.push(a);break n}null!=a.componentWillUpdate&&a.componentWillUpdate(b,a.__s,C),m&&null!=a.componentDidUpdate&&a.__h.push(function(){a.componentDidUpdate(v,d,y)})}if(a.context=C,a.props=b,a.__P=n,a.__e=!1,P=t.__r,T=0,m){for(a.state=a.__s,a.__d=!1,P&&P(l),h=a.render(a.props,a.state,a.context),I=0;I<a._sb.length;I++)a.__h.push(a._sb[I]);a._sb=[]}else do{a.__d=!1,P&&P(l),h=a.render(a.props,a.state,a.context),a.state=a.__s}while(a.__d&&++T<25);a.state=a.__s,null!=a.getChildContext&&(i=g(g({},i),a.getChildContext())),m&&!p&&null!=a.getSnapshotBeforeUpdate&&(y=a.getSnapshotBeforeUpdate(v,d)),$(n,_(H=null!=h&&h.type===x&&null==h.key?h.props.children:h)?H:[H],l,u,i,o,e,r,f,c,s),a.base=l.__e,l.__u&=-161,a.__h.length&&r.push(a),w&&(a.__E=a.__=null)}catch(n){if(l.__v=null,c||null!=e){for(l.__u|=c?160:128;f&&8===f.nodeType&&f.nextSibling;)f=f.nextSibling;e[e.indexOf(f)]=null,l.__e=f}else l.__e=u.__e,l.__k=u.__k;t.__e(n,l,u)}else null==e&&l.__v===u.__v?(l.__k=u.__k,l.__e=u.__e):l.__e=N(u.__e,l,u,i,o,e,r,c,s);(h=t.diffed)&&h(l)}function z(n,l,u){l.__d=void 0;for(var i=0;i<u.length;i++)V(u[i],u[++i],u[++i]);t.__c&&t.__c(l,n),n.some(function(l){try{n=l.__h,l.__h=[],n.some(function(n){n.call(l)})}catch(n){t.__e(n,l.__v)}})}function N(n,u,i,o,e,r,f,c,s){var h,a,p,v,y,w,g,m=i.props,k=u.props,x=u.type;if("svg"===x?e="http://www.w3.org/2000/svg":"math"===x?e="http://www.w3.org/1998/Math/MathML":e||(e="http://www.w3.org/1999/xhtml"),null!=r)for(h=0;h<r.length;h++)if((y=r[h])&&"setAttribute"in y==!!x&&(x?y.localName===x:3===y.nodeType)){n=y,r[h]=null;break}if(null==n){if(null===x)return document.createTextNode(k);n=document.createElementNS(e,x,k.is&&k),c&&(t.__m&&t.__m(u,r),c=!1),r=null}if(null===x)m===k||c&&n.data===k||(n.data=k);else{if(r=r&&l.call(n.childNodes),m=i.props||d,!c&&null!=r)for(m={},h=0;h<n.attributes.length;h++)m[(y=n.attributes[h]).name]=y.value;for(h in m)if(y=m[h],"children"==h);else if("dangerouslySetInnerHTML"==h)p=y;else if(!(h in k)){if("value"==h&&"defaultValue"in k||"checked"==h&&"defaultChecked"in k)continue;A(n,h,null,y,e)}for(h in k)y=k[h],"children"==h?v=y:"dangerouslySetInnerHTML"==h?a=y:"value"==h?w=y:"checked"==h?g=y:c&&"function"!=typeof y||m[h]===y||A(n,h,y,m[h],e);if(a)c||p&&(a.__html===p.__html||a.__html===n.innerHTML)||(n.innerHTML=a.__html),u.__k=[];else if(p&&(n.innerHTML=""),$(n,_(v)?v:[v],u,i,o,"foreignObject"===x?"http://www.w3.org/1999/xhtml":e,r,f,r?r[0]:i.__k&&C(i,0),c,s),null!=r)for(h=r.length;h--;)b(r[h]);c||(h="value","progress"===x&&null==w?n.removeAttribute("value"):void 0!==w&&(w!==n[h]||"progress"===x&&!w||"option"===x&&w!==m[h])&&A(n,h,w,m[h],e),h="checked",void 0!==g&&g!==n[h]&&A(n,h,g,m[h],e))}return n}function V(n,l,u){try{if("function"==typeof n){var i="function"==typeof n.__u;i&&n.__u(),i&&null==l||(n.__u=n(l))}else n.current=l}catch(n){t.__e(n,u)}}function q(n,l,u){var i,o;if(t.unmount&&t.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||V(i,null,l)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(n){t.__e(n,l)}i.base=i.__P=null}if(i=n.__k)for(o=0;o<i.length;o++)i[o]&&q(i[o],l,u||"function"!=typeof n.type);u||b(n.__e),n.__c=n.__=n.__e=n.__d=void 0}function B(n,l,t){return this.constructor(n,t)}function D(n,u,i){var o,e,r,f;t.__&&t.__(n,u),e=(o="function"==typeof i)?null:i&&i.__k||u.__k,r=[],f=[],O(u,n=(!o&&i||u).__k=m(x,null,[n]),e||d,d,u.namespaceURI,!o&&i?[i]:e?null:u.firstChild?l.call(u.childNodes):null,r,!o&&i?i:e?e.__e:u.firstChild,o,f),z(r,n,f)}l=y.slice,t={__e:function(n,l,t,u){for(var i,o,e;l=l.__;)if((i=l.__c)&&!i.__)try{if((o=i.constructor)&&null!=o.getDerivedStateFromError&&(i.setState(o.getDerivedStateFromError(n)),e=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,u||{}),e=i.__d),e)return i.__E=i}catch(l){n=l}throw n}},u=0,i=function(n){return null!=n&&null==n.constructor},S.prototype.setState=function(n,l){var t;t=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=g({},this.state),"function"==typeof n&&(n=n(g({},t),this.props)),n&&g(t,n),null!=n&&this.__v&&(l&&this._sb.push(l),P(this))},S.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),P(this))},S.prototype.render=x,o=[],r="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,f=function(n,l){return n.__v.__b-l.__v.__b},T.__r=0,c=0,s=F(!1),h=F(!0),a=0,n.Component=S,n.Fragment=x,n.cloneElement=function(n,t,u){var i,o,e,r,f=g({},n.props);for(e in n.type&&n.type.defaultProps&&(r=n.type.defaultProps),t)"key"==e?i=t[e]:"ref"==e?o=t[e]:f[e]=void 0===t[e]&&void 0!==r?r[e]:t[e];return arguments.length>2&&(f.children=arguments.length>3?l.call(arguments,2):u),k(n.type,f,i||n.key,o||n.ref,null)},n.createContext=function(n,l){var t={__c:l="__cC"+a++,__:n,Consumer:function(n,l){return n.children(l)},Provider:function(n){var t,u;return this.getChildContext||(t=new Set,(u={})[l]=this,this.getChildContext=function(){return u},this.componentWillUnmount=function(){t=null},this.shouldComponentUpdate=function(n){this.props.value!==n.value&&t.forEach(function(n){n.__e=!0,P(n)})},this.sub=function(n){t.add(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){t&&t.delete(n),l&&l.call(n)}}),n.children}};return t.Provider.__=t.Consumer.contextType=t},n.createElement=m,n.createRef=function(){return{current:null}},n.h=m,n.hydrate=function n(l,t){D(l,t,n)},n.isValidElement=i,n.options=t,n.render=D,n.toChildArray=function n(l,t){return t=t||[],null==l||"boolean"==typeof l||(_(l)?l.some(function(l){n(l,t)}):t.push(l)),t}});
//# sourceMappingURL=preact.umd.js.map

    // ===== vendored: htm 3.1.1 UMD (MIT, https://github.com/developit/htm) =====
!function(n,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(n||self).htm=e()}(this,function(){var n=function(e,t,u,s){var r;t[0]=0;for(var p=1;p<t.length;p++){var h=t[p++],o=t[p]?(t[0]|=h?1:2,u[t[p++]]):t[++p];3===h?s[0]=o:4===h?s[1]=Object.assign(s[1]||{},o):5===h?(s[1]=s[1]||{})[t[++p]]=o:6===h?s[1][t[++p]]+=o+"":h?(r=e.apply(o,n(e,o,u,["",null])),s.push(r),o[0]?t[0]|=2:(t[p-2]=0,t[p]=r)):s.push(o)}return s},e=new Map;return function(t){var u=e.get(this);return u||(u=new Map,e.set(this,u)),(u=n(this,u.get(t)||(u.set(t,u=function(n){for(var e,t,u=1,s="",r="",p=[0],h=function(n){1===u&&(n||(s=s.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))?p.push(0,n,s):3===u&&(n||s)?(p.push(3,n,s),u=2):2===u&&"..."===s&&n?p.push(4,n,0):2===u&&s&&!n?p.push(5,0,!0,s):u>=5&&((s||!n&&5===u)&&(p.push(u,0,s,t),u=6),n&&(p.push(u,n,0,t),u=6)),s=""},o=0;o<n.length;o++){o&&(1===u&&h(),h(o));for(var f=0;f<n[o].length;f++)e=n[o][f],1===u?"<"===e?(h(),p=[p],u=3):s+=e:4===u?"--"===s&&">"===e?(u=1,s=""):s=e+s[0]:r?e===r?r="":s+=e:'"'===e||"'"===e?r=e:">"===e?(h(),u=1):u&&("="===e?(u=5,t=s,s=""):"/"===e&&(u<5||">"===n[o][f+1])?(h(),3===u&&(p=p[0]),u=p,(p=p[0]).push(2,0,u),u=0):" "===e||"\t"===e||"\n"===e||"\r"===e?(h(),u=2):s+=e),3===u&&"!--"===s&&(u=4,p=p[0])}return h(),p}(t)),u),arguments,[])).length>1?u:u[0]}});

    // ===== end vendored =====


    /* ================= 运行状态 ================= */
    let root, bodyEl;
    let inputEl = null;          // 真实输入框（InputBar 渲染后引用）
    let lastSig = '';
    let lastData = null;
    let dataHref = '';           // lastData 锚定的 URL（无限滚动合并判断）
    let typed = '';              // 输入栏受控文本
    let focused = false;         // 输入栏是否聚焦（控制假光标显示）
    let gTs = 0;                 // vim gg 等待窗口
    let autoPageLoading = false; // 下一页抓取中
    let autoPageError = false;   // 上次抓取失败（显示重试入口）
    let nextPageUrl = null;      // 下一页 URL（refresh 时提取，append 后更新）
    let loadedPages = new Set(); // 已加载页 URL（防循环）
    let opUidSticky = '';        // 当前帖楼主 uid（op 模式 authorid 抓取用）
    let opUidTid = '';           // opUidSticky 对应的 tid
    let opNextNo = null;         // op 模式：下一个待抓 authorid 页码（null=未初始化）
    let opEnd = false;           // op 模式：authorid 页链到底
    let locRenderTimer = null;   // 属地渲染合并定时器
    const echoLog = [];          // { cmd, out: [htmlLine] } — 命令回显 scrollback
    const cmdHistory = [];
    let histIdx = -1;
    const locMap = {};           // uid → IP 属地（组件读取，fetch 完成后 renderApp）

    /* ================= 工具 ================= */
    /* esc 仅服务于命令层输出的 HTML 串（line()）；组件层由 Preact 自动转义，不需要它 */
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    /* 截断：store.expand 时全量展开；提示与真实的 ctrl+o 快捷键对应 */
    const truncate = (s, n) => {
        if (store.expand) return s;
        const lines = s.split('\n');
        const joined = lines.slice(0, n).join('\n');
        return lines.length > n ? joined + `\n… +${lines.length - n} lines (ctrl+o to expand)` : joined;
    };

    /* 伪 shell 工作目录 */
    const cwdFor = data => {
        if (data.kind === 'posts') return `~/threads/${(location.href.match(/tid=(\d+)/) || [])[1] || 'latest'}`;
        if (data.kind === 'topics') return `~/boards/${(data.board || 'board').replace(/\s+/g, '-')}`;
        return '~';
    };

    /* ================= 数据抽取 ================= */
    const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

    /* 表情图判定（src 或 class 含表情特征） */
    const isEmote = img => /smile|emoji/i.test((img.getAttribute('src') || '') + ' ' + (img.className || ''));

    /* 懒加载真实地址 + 绝对化；外层链接作备胎（NGA 图常包一层 a） */
    const imgSrc = img => {
        const raw = img.getAttribute('data-src') || img.getAttribute('data-lazy-src')
            || img.getAttribute('data-original') || img.getAttribute('src') || '';
        const abs = u => { try { return new URL(u, location.href).href; } catch { return ''; } };
        const main = raw && !/loading|blank|spacer|placeholder/i.test(raw) ? abs(raw) : '';
        const link = img.closest && img.closest('a');
        const alt = link && /\.(jpe?g|png|gif|webp)/i.test(link.href) ? abs(link.href) : '';
        return { main: main || alt, alt: alt && alt !== main ? alt : '' };
    };

    /* 不可见字符清理 + 去除空首行（NGA 会塞 ZWSP） */
    const cleanText = s => {
        // ZWSP (U+200B) 用 fromCharCode 引用，源码里不放不可见字符
        const lines = s.split(String.fromCharCode(0x200b)).join('').split('\n').map(l => l.trim());
        const invis = /^\s*$/;   // JS \s 本身覆盖 U+00A0 / U+3000
        while (lines.length && invis.test(lines[0])) lines.shift();
        while (lines.length && invis.test(lines[lines.length - 1])) lines.pop();
        return lines.join('\n').replace(/\n{3,}/g, '\n\n');
    };

    /* 正文抽取：返回 { text, imgs }。
       显示图片时，正文图替换为占位 token %%IMGN%%（N = imgs 下标），
       渲染阶段按 token 把图片插回原始位置，不再全部堆到文字后面。 */
    const contentText = (node, showImg) => {
        if (!node) return { text: '', imgs: [] };
        const clone = node.cloneNode(true);
        // 引用块单独抽取，此处移除避免混入正文
        clone.querySelectorAll('.quote').forEach(q => q.remove());
        const imgs = [];
        clone.querySelectorAll('img').forEach(i => {
            const src = i.getAttribute('src') || '';
            if (isEmote(i)) {
                const alt = i.getAttribute('alt');
                i.replaceWith(alt ? `[${alt}]` : '');
            } else if (/about:blank|loading|spacer|placeholder/i.test(src)) {
                i.remove(); // 追踪图/占位图，静默移除
            } else if (showImg) {
                const o = imgSrc(i);
                if (!o.main) { i.remove(); return; }
                imgs.push(o);
                i.replaceWith(`%%IMG${imgs.length - 1}%%`);
            } else {
                i.replaceWith('[image]');
            }
        });
        // 点赞数、操作按钮等噪声
        clone.querySelectorAll('script,style,button,.recommendvalue,.ogoodbtn,.postBtnPos,.postinfo,.single_ttip2,.postbtnsc,.right_').forEach(i => i.remove());
        return { text: cleanText(clone.innerText), imgs };
    };

    /* 记录真实标题，避免被伪装标题污染 */
    let realTitle = '';

    /* 标题去站名后缀 */
    const cleanTitle = t => t.replace(/[\s\-_]*(NGA玩家社区|艾泽拉斯国家地理论坛|NGA)\s*$/i, '').trim();

    const extractTopics = (doc = document, baseUrl = location.href) => {
        const abs = u => { try { return new URL(u, baseUrl).href; } catch { return u || '#'; } };
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
                // 标题在 .topic 里；[xx] 是分类标签链接，不能直接抓第一个 a
                const titleEl = r.querySelector('.c2 .topic, .c2 .topic_title');
                let a = titleEl
                    ? (titleEl.closest('a') || titleEl.querySelector('a'))
                    : null;
                if (!a) {
                    // 兜底：取文字最长的帖子链接
                    a = [...r.querySelectorAll('.c2 a[href*="read.php"], .c2 a[href*="tid="]')]
                        .sort((x, y) => y.textContent.trim().length - x.textContent.trim().length)[0];
                }
                const title = text(titleEl) || text(a);
                const href = abs((a && a.getAttribute('href')) || (titleEl && titleEl.getAttribute('href')) || '');
                // c3 = 作者 + 发帖时间，c4 = 最后回复时间 + 回复人，需分开取
                const author = text(r.querySelector('.c3 .author')) || text(r.querySelector('.c3 a'));
                const postDate = text(r.querySelector('.c3 .postdate'));
                const replyDate = text(r.querySelector('.c4 .replydate'));
                const replyer = text(r.querySelector('.c4 .replyer'));
                return {
                    title: title || '(no title)',
                    href,
                    replies: text(r.querySelector('.c1')).replace(/\D+/g, ''),
                    author, postDate, replyDate, replyer,
                };
            }).filter(t => t.title),
        };
    };

    /* uid 提取兜底链：uid 锚文本 → 名片链接 uid= 参数 → postauthor 元素 id */
    const postUid = b => {
        const uidLink = b.querySelector('a[href*="uid="]');
        const uidEl = b.querySelector('[id^="postauthor"]');
        return text(b.querySelector('a[name="uid"]'))
            || (((uidLink && uidLink.getAttribute('href')) || '').match(/uid=(\d+)/) || [])[1]
            || (((uidEl && uidEl.id) || '').match(/postauthor(\d+)/) || [])[1]
            || '';
    };

    /* 单个楼层解析：楼号/用户名/UID/日期/赞数 */
    const parsePost = (b, i, opUid) => {
        const content = b.querySelector('.postcontent, [id^="postcontent"]');
        const infoText = text(b.querySelector('[class*="postinfo" i]')) || text(b.querySelector('.postBtnPos'));
        const floorM = infoText.match(/#\s*(\d+)/);
        const dateM = infoText.match(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/);
        const uid = postUid(b);
        let name = text(b.querySelector('.posterinfo .author, .posterInfoLine .author'))
            || text(b.querySelector('[id^="postauthor"]')) || uid || 'uid';
        const isOP = (opUid && uid && uid === opUid) || /楼主/.test(name);
        name = name.replace(/楼主/g, '').replace(/^\[|\]$/g, '').replace(/^UID\s*[:：]\s*/i, '').trim() || uid || 'uid';
        const likes = text(b.querySelector('.recommendvalue'));
        // 引用块：带嵌套深度（depth = 祖先引用层数）
        const quotes = content
            ? [...content.querySelectorAll('.quote')].map(q => {
                let depth = 0, n = q.parentElement;
                while (n) {
                    if (n.classList && n.classList.contains('quote')) depth++;
                    n = n.parentElement;
                }
                const c = q.cloneNode(true);
                c.querySelectorAll('.quote').forEach(x => x.remove());
                c.querySelectorAll('img').forEach(im => {
                    const alt = im.getAttribute('alt');
                    isEmote(im) ? im.replaceWith(alt ? `[${alt}]` : '') : im.remove();
                });
                return { depth, text: cleanText(c.innerText) };
            }).filter(q => q.text)
            : [];
        const head = [
            '#' + (floorM ? floorM[1] : i + 1),
            name + (uid && uid !== name ? `(${uid})` : ''),
            dateM && dateM[0],
            likes && likes !== '0' ? `+${likes}` : '',
        ].filter(Boolean).join(' · ');
        const body = contentText(content, store.img);
        return { head, uid, isOP, text: body.text, imgs: body.imgs, quotes };
    };

    /* 按「热点回复」文字定位热楼容器（NGA 该模块 id/class 不稳定） */
    const findHotBoxes = (doc = document) => {
        const heads = [...doc.querySelectorAll('div,span,td,b')].filter(el => {
            const t = el.textContent.trim();
            return t.startsWith('热点回复') && t.length < 12;
        });
        for (const head of heads) {
            let node = head.parentElement;
            for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
                const found = [...node.querySelectorAll('.forumbox.postbox, .postbox, [id^="postcontainer"]')];
                if (found.length && found.length <= 10) return found;
            }
        }
        return [];
    };

    /* doc 参数支持解析抓取到的下一页文档；opUidOverride 让追加页沿用首楼的楼主判定 */
    const extractPosts = (doc = document, opUidOverride) => {
        const allBoxes = [...doc.querySelectorAll('.forumbox.postbox')];
        if (!allBoxes.length) return null;
        const elTitle = text(doc.querySelector('#toppedtopic .topic, .catetitle, h1 .topic'));
        const title = cleanTitle(elTitle || realTitle || document.title);
        // 热点楼层先从主列表剔除，避免污染楼主判定与楼层列表
        const hotBoxes = findHotBoxes(doc);
        const boxes = allBoxes.filter(b => !hotBoxes.some(hb => hb === b || hb.contains(b)));
        if (!boxes.length) return null;
        // 首楼 UID 即楼主（追加页用 override）
        const opUid = opUidOverride !== undefined ? opUidOverride : postUid(boxes[0]);
        const posts = boxes.map((b, i) => parsePost(b, i, opUid));
        // 1 楼正文首行常与标题重复，去掉（仅当前页首楼）
        if (opUidOverride === undefined && posts.length && posts[0].text.startsWith(title)) {
            posts[0].text = cleanText(posts[0].text.slice(title.length));
        }
        // 热点回复只取当前页，追加页不重复展示
        const hot = doc === document
            ? hotBoxes.slice(0, 5).map((b, i) => parsePost(b, i, opUid)).filter(p => p.text || p.imgs.length)
            : [];
        return { kind: 'posts', title, posts, hot };
    };

    /* 分页链接抽取：只取顶/底翻页条，且必须指向当前页面类型（防止抓到帖子行内迷你分页） */
    const extractPager = (doc = document, baseUrl = location.href) => {
        const isRead = location.pathname.includes('read');
        const pathKey = isRead ? 'read.php' : 'thread.php';
        const curTid = new URLSearchParams(location.search).get('tid');
        const links = [...doc.querySelectorAll('#m_pbtnbtm a[href], #pagebbtm a[href], #m_pbtntop a[href], #pagebbtop a[href], #m_threads > .uitxt1 a[href]')];
        const seen = new Set();
        const out = [];
        for (const a of links) {
            const t = a.textContent.trim();
            if (!/^(\d{1,4}|下一页|下页|上一页|上页|>{1,2}|<{1,2}|尾页|首页)$/.test(t)) continue;
            let u;
            try { u = new URL(a.getAttribute('href') || '', baseUrl); } catch { continue; }
            if (!u.pathname.includes(pathKey)) continue;
            if (isRead && curTid && u.searchParams.get('tid') !== curTid) continue;
            const key = (u.searchParams.get('page') || '') + '|' + t;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ t, href: u.href });
        }
        return out;
    };

    const extract = () => {
        let data;
        if (document.querySelector('#m_posts')) data = extractPosts();
        else if (document.querySelector('#m_threads')) data = extractTopics();
        else data = { kind: 'idle' };
        if (data) data.pager = extractPager();
        return data;
    };

    /* ================= IP 属地（nuke.php 接口 + GM 缓存，容量封顶） ================= */
    const locCache = GM_getValue('cad_loc_cache', {});
    const fetchLoc = uid => {
        if (locCache[uid]) return Promise.resolve(locCache[uid]);
        return fetch(`https://${location.host}/nuke.php?__output=11&__act=get&__lib=ucp&uid=${uid}`, { credentials: 'include' })
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
    };
    /* 为当前数据里出现的 uid 预取属地；完成后触发重渲染（组件直接读 locMap） */
    const ensureLocs = () => {
        if (!lastData || lastData.kind !== 'posts') return;
        const uids = [...new Set([...(lastData.posts || []), ...(lastData.hot || [])].map(p => p.uid).filter(Boolean))];
        uids.filter(u => !(u in locMap)).forEach(uid => {
            locMap[uid] = '';   // 占位防重复请求
            fetchLoc(uid).then(loc => {
                if (loc) {
                    locMap[uid] = loc;
                    scheduleLocRender();   // 合并触发，避免逐 uid 连续重渲染
                }
            });
        });
    };

    /* 属地渲染合并：多个 uid 先后返回时 400ms 内只渲染一次 */
    const scheduleLocRender = () => {
        if (locRenderTimer) return;
        locRenderTimer = setTimeout(() => {
            locRenderTimer = null;
            if (store.on) renderApp();
        }, 400);
    };

    /* ================= Preact 组件层 ================= */
    const { h, render: preactRender } = self.preact;
    const html = self.htm.bind(h);

    /* 图片：主源失败回退外层链接，再失败隐藏 */
    const Img = ({ o }) => html`<img class="cad-img" src=${o.main} loading="lazy" referrerpolicy="no-referrer"
        onError=${e => { const t = e.currentTarget; if (o.alt && t.src !== o.alt) t.src = o.alt; else t.classList.add('cad-imghide'); }} />`;

    /* IP 属地（fetchLoc 完成后写 locMap 并触发 renderApp） */
    const Loc = ({ uid }) => (uid && locMap[uid]) ? html`<span> · ${locMap[uid]}</span>` : null;

    /* 引用块：按嵌套深度缩进 */
    const Quote = ({ q }) => html`<div class="cad-qline" style=${'margin-left:' + (q.depth * 14) + 'px'}>▎${q.text}</div>`;

    /* 正文：按 %%IMGN%% token 把图片插回原始位置（Preact 自动转义文本） */
    const PostBody = ({ p, maxLines }) => {
        const parts = truncate(p.text, maxLines).split(/%%IMG(\d+)%%/);
        return html`<div class="cad-text cad-line">${parts.map((part, i) =>
            i % 2 ? (p.imgs[+part] ? html`<${Img} o=${p.imgs[+part]} />` : null) : part)}</div>`;
    };

    const PostBlock = ({ p, maxLines }) => html`
    <div class="cad-post">
        <div class="cad-posthead">${p.head}${p.isOP ? html` <span class="cad-op">OP</span>` : ''}<${Loc} uid=${p.uid} /></div>
        ${(p.quotes || []).map(q => html`<${Quote} q=${q} />`)}
        <${PostBody} p=${p} maxLines=${maxLines} />
    </div>`;

    const Pager = ({ pager }) => (pager && pager.length) ? html`
    <div class="cad-line" style="margin-top:8px"><span class="cad-sect">pages</span>${pager.map(l => html` <a class="cad-pagelink" href=${l.href}>${l.t}</a>`)}
    </div>` : null;

    /* ls -l 风列对齐：序号 | 回复数(右对齐定宽) | 标题 | 元信息 */
    const TopicRow = ({ t, i, bullet }) => html`
    <div class="cad-trow cad-line">
        <span class="cad-topicnum">${i + 1}</span><span class="cad-trep">${t.replies || '0'}</span>${bullet ? html`<span class="cad-bullet"></span>` : null}<a class="cad-tlink" href=${t.href}>${t.title}</a>
        <span class="cad-meta"> · ${t.author}${t.postDate ? ' ' + t.postDate : ''}${t.replyer ? ' · 最后 ' + t.replyer : ''}${t.replyDate ? ' ' + t.replyDate : ''}</span>
    </div>`;

    /* 收藏板块快捷栏：可见的板块切换入口（boards: 名字可点击，[+] 收藏当前版） */
    const BoardsBar = () => {
        if (!boards.length) return null;
        const cur = curFid();
        return html`
    <div class="cad-boards cad-line cad-faint">boards:${boards.map((b, i) => html` <a class="cad-pagelink${String(b.fid) === String(cur) ? ' cad-boardcur' : ''}" href=${'/thread.php?fid=' + encodeURIComponent(b.fid)} title=${'board ' + (i + 1)}>${b.name}</a>`)}${cur ? html` <span class="cad-boardadd" title="board add 收藏当前版" onClick=${() => runCmd('board add')}>[+]</span>` : null}
    </div>`;
    };

    /* 伪 shell 命令回显行（视图顶部那条 band 背景行） */
    const CmdLine = ({ cwd, cmd }) => html`<div class="cad-cmd"><span class="cad-ps1">➜ ${cwd}</span> ${cmd}</div>`;

    const Welcome = ({ cwd }) => html`
    <div class="cad-welcome">
        <div class="left">
            <div class="logo">✻ Welcome to Claude Code</div>
            <div class="dim">/help for help · ? for shortcuts</div>
            <div class="dim">cwd: ${cwd}</div>
        </div>
        <div class="right">
            <div><span class="sec">Tips</span></div>
            <div>· 底部输入 <b>help</b> 查看全部命令 · <b>Tab</b> 补全</div>
            <div>· <b>search: 关键词</b> 搜索本版 · <b>search: -g 关键词</b> 全站搜索</div>
            <div>· 顶部 <b>boards:</b> 栏点击切换收藏板块 · <b>[+]</b> 收藏当前版</div>
            <div class="dim">滚到底自动加载下一页（autopage 开关） · vim j/k/gg/G · / 搜索 · \` 退出伪装</div>
        </div>
    </div>`;

    const CodexBanner = () => html`
    <div class="cad-banner"><b>OpenAI Codex</b> CLI v0.42.0 · model: <b>gpt-5-codex</b> · reasoning: medium · dir: ${FAKE_DIR} · approvals: on-request</div>`;

    const ClaudeView = ({ data }) => {
        const cwd = cwdFor(data);
        if (data.kind === 'topics') {
            let tn = 0;
            return html`
        <${Welcome} cwd=${cwd} />
        <${CmdLine} cwd=${cwd} cmd="ls" />
        <div class="cad-line"><span class="cad-sect">${data.board}</span> <span class="cad-faint">· ${data.topics.reduce((a, t) => a + (t.sep ? 0 : 1), 0)} topics</span></div>
        ${data.topics.map(t => t.sep ? html`<${PageSep} label=${t.sep} />` : html`<${TopicRow} t=${t} i=${tn++} />`)}
        <${Pager} pager=${data.pager} />`;
        }
        if (data.kind === 'posts') {
            const visible = store.opOnly ? data.posts.filter(p => p.isOP || p.sep) : data.posts;
            return html`
        <${CmdLine} cwd=${cwd} cmd=${'open "' + data.title + '"'} />
        <div class="cad-line cad-faint">thread: ${data.title} · ${data.posts.reduce((a, p) => a + (p.sep ? 0 : 1), 0)} replies${store.opOnly ? ' · OP only' : ''}</div>
        ${(!store.opOnly && data.hot && data.hot.length) ? html`
        <div class="cad-line" style="margin-top:6px"><span class="cad-sect">hot replies</span></div>
        ${data.hot.map(p => html`<${PostBlock} p=${p} maxLines=${14} />`)}` : null}
        <div class="cad-line" style="margin-top:6px"><span class="cad-sect">all replies</span></div>
        ${visible.map(p => p.sep ? html`<${PageSep} label=${p.sep} />` : html`<${PostBlock} p=${p} maxLines=${14} />`)}
        <${Pager} pager=${data.pager} />
        <div class="cad-line cad-faint" style="margin-top:8px">✻ Rendered ${visible.reduce((a, p) => a + (p.sep ? 0 : 1), 0)} replies · next page / go page N 翻页 · ctrl+o ${store.expand ? '收起' : '展开'}截断</div>`;
        }
        return html`<div class="cad-line cad-faint">⏵⏵ 此页面暂无可伪装的帖子/板块数据 — \` 退出伪装，F5 重试</div>`;
    };

    const CodexView = ({ data }) => {
        const cwd = cwdFor(data);
        if (data.kind === 'topics') {
            let tn = 0;
            return html`
        <${CodexBanner} />
        <div class="cad-blocktag">user</div>
        <div class="cad-line">列出板块「${data.board}」的帖子</div>
        <div class="cad-blocktag">codex</div>
        <div class="cad-line cad-faint">cwd: ${cwd} · ${data.topics.reduce((a, t) => a + (t.sep ? 0 : 1), 0)} topics</div>
        ${data.topics.map(t => t.sep ? html`<${PageSep} label=${t.sep} />` : html`<${TopicRow} t=${t} i=${tn++} bullet=${true} />`)}
        <${Pager} pager=${data.pager} />
        <div class="cad-line cad-faint" style="margin-top:8px">Working… (esc to interrupt)</div>`;
        }
        if (data.kind === 'posts') {
            const visible = store.opOnly ? data.posts.filter(p => p.isOP || p.sep) : data.posts;
            return html`
        <${CodexBanner} />
        <div class="cad-blocktag">user</div>
        <div class="cad-line">打开帖子「${data.title}」</div>
        <div class="cad-blocktag">codex</div>
        <div class="cad-line cad-faint">${data.posts.reduce((a, p) => a + (p.sep ? 0 : 1), 0)} replies${store.opOnly ? ' · OP only' : ''} · cwd: ${cwd}</div>
        ${(!store.opOnly && data.hot && data.hot.length) ? html`
        <div class="cad-line" style="margin-top:6px"><span class="cad-sect">hot replies</span></div>
        ${data.hot.map(p => html`<${PostBlock} p=${p} maxLines=${12} />`)}` : null}
        <div class="cad-line" style="margin-top:6px"><span class="cad-sect">all replies</span></div>
        ${visible.map(p => p.sep ? html`<${PageSep} label=${p.sep} />` : html`<${PostBlock} p=${p} maxLines=${12} />`)}
        <${Pager} pager=${data.pager} />
        <div class="cad-line cad-faint" style="margin-top:8px">Working… (esc to interrupt)</div>`;
        }
        return html`<${CodexBanner} /><div class="cad-line cad-faint">Idle — 此页面暂无可伪装数据，\` 退出伪装</div>`;
    };

    /* 命令回显 scrollback：命令层产出 HTML 串（内部已 esc），走 dangerouslySetInnerHTML */
    const EchoLog = () => html`${echoLog.map(e => html`
    <div>
        <div class="cad-line cad-user">${e.cmd}</div>
        <div dangerouslySetInnerHTML=${{ __html: e.out.join('') }} />
    </div>`)}`;

    /* Tab 补全命令表（NEEDS_ARG 补全后自动带空格） */
    const CMDS = ['help', 'search:', 'board', 'board list', 'board add', 'board del', 'board fid', 'next page', 'prev page', 'go page', 'open', 'ls', 'top', 'theme', 'claude', 'codex', 'dark', 'light', 'img', 'op', 'expand', 'vim', 'autopage', 'clear', 'exit', 'version', 'pwd', 'whoami'];
    const NEEDS_ARG = new Set(['search:', 'board', 'board add', 'board del', 'board fid', 'go page', 'open']);
    const tabComplete = v => {
        const hits = CMDS.filter(c => c.startsWith(v.toLowerCase()));
        if (hits.length === 1) {
            typed = hits[0] + (NEEDS_ARG.has(hits[0]) ? ' ' : '');
            renderApp();
        } else if (hits.length > 1) {
            let p = hits[0];
            for (const c of hits) while (!c.startsWith(p)) p = p.slice(0, -1);
            if (p.length > v.length) {
                typed = p;
                renderApp();
            } else {
                echoLog.push({ cmd: v, out: [line(esc(hits.join('  ')), 'cad-faint')] });
                refresh(true);
                if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
            }
        }
    };

    /* 输入栏键盘逻辑：与全局快捷键隔离，Enter 执行命令，Tab 补全，↑↓ 历史，Esc 失焦，` 退出伪装 */
    const onInputKey = e => {
        e.stopPropagation();
        const el = e.currentTarget;
        if (e.key === 'Enter') {
            const v = el.value;
            typed = ''; histIdx = -1;
            renderApp();
            runCmd(v);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (el.value) tabComplete(el.value);
        } else if (e.key === 'Escape') {
            el.blur();
        } else if (e.key === 'Backquote') {
            e.preventDefault();
            toggleDisguise();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length) {
                histIdx = histIdx < 0 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
                typed = cmdHistory[histIdx];
                renderApp();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx >= 0) {
                histIdx++;
                if (histIdx >= cmdHistory.length) { histIdx = -1; typed = ''; }
                else typed = cmdHistory[histIdx];
                renderApp();
            }
        }
    };

    const InputBar = () => html`
    <div class="cad-inputbar" onClick=${() => { if (inputEl) inputEl.focus(); }}>
        <span class="cad-ps1">➜</span>
        <span class="cad-faint">${cwdFor(lastData || { kind: 'idle' })}</span>
        <span class="prompt">❯</span>
        <input class="cad-real" ref=${el => { inputEl = el; }} value=${typed}
            spellcheck="false" autocomplete="off" autocapitalize="off"
            onInput=${e => { typed = e.currentTarget.value; }}
            onKeyDown=${onInputKey}
            onFocus=${() => { focused = true; renderApp(); }}
            onBlur=${() => { focused = false; renderApp(); }} />
        ${(!focused && !typed) ? html`<span class="cad-cursor"></span>` : null}
    </div>`;

    const StatusBar = () => html`
    <div class="cad-statusbar">
        ${store.style === 'claude' ? html`
            <span class="seg hi">? for shortcuts</span><span class="sep">·</span><span class="seg">⏵⏵ accept edits</span>`
        : html`
            <span class="seg hi">gpt-5-codex</span><span class="sep">|</span><span class="seg">94% context left</span><span class="sep">|</span><span class="seg">${FAKE_DIR}</span><span class="sep">|</span><span class="seg">? help</span>`}
        <span class="grow"></span>
        ${(store.vim && pendingCount) ? html`<span class="seg hi">${pendingCount}</span><span class="sep">·</span>` : null}
        ${store.vim ? html`<span class="seg">vim</span><span class="sep">·</span>` : null}
        <span class="seg">${store.mode}</span>
        <span class="cad-themeswitch" title="t 切换主题" onClick=${() => cycleTheme()}>${store.style}</span>
        <span class="sep">·</span>
        <span class="seg">${new Date().toTimeString().slice(0, 5)}</span>
    </div>`;

    /* 无限滚动：分页分隔标记 */
    const PageSep = ({ label }) => html`<div class="cad-pagesep">${label}</div>`;

    /* 无限滚动状态行：加载中 / 失败重试 / 到底（仅无限滚动已追加过时显示） */
    const AutoLoadState = () => {
        if (autoPageLoading) return html`<div class="cad-line cad-faint" style="margin-top:6px">⏵⏵ 正在加载下一页…</div>`;
        if (autoPageError) return html`<div class="cad-line" style="margin-top:6px"><span class="cad-pagelink" onClick=${() => loadNextPage()}>加载下一页失败 · 点击重试</span></div>`;
        const list = lastData && (lastData.posts || lastData.topics);
        if (store.autopage && (opModeOn() ? opEnd : !nextPageUrl) && list && list.some(x => x.sep))
            return html`<div class="cad-line cad-faint" style="margin-top:6px">── 已到最后一页 ──</div>`;
        return null;
    };

    const App = () => {
        const data = lastData || { kind: 'idle' };
        return html`
        <div class="cad-topbar"><i></i><i></i><i></i></div>
        <div class="cad-body" id="cad__body" ref=${el => { bodyEl = el; }} onScroll=${onBodyScroll}>
            <${BoardsBar} />
            ${store.style === 'claude' ? html`<${ClaudeView} data=${data} />` : html`<${CodexView} data=${data} />`}
            <${AutoLoadState} />
            <${EchoLog} />
        </div>
        <${InputBar} />
        <${StatusBar} />`;
    };

    /* 全量 render（Preact diff 保住 DOM/滚动/焦点）；URL 变化（pjax 翻页）时回滚到顶部 */
    let lastHref = location.href;
    const renderApp = () => {
        if (!root) return;
        const hrefChanged = location.href !== lastHref;
        lastHref = location.href;
        if (hrefChanged) {
            autoPageError = false;
            autoPageLoading = false;
            loadedPages = new Set([location.href]);
            opNextNo = null;
            opEnd = false;
        }
        preactRender(html`<${App} />`, root);
        if (hrefChanged && bodyEl) bodyEl.scrollTop = 0;
    };
    const syncChrome = () => renderApp();

    /* ================= 无限滚动（滚到底自动抓取下一页，内容接在下方） ================= */
    const findNextUrl = pager => {
        const l = (pager || []).find(x => /^(下一页|下页|>{1,2})$/.test(x.t));
        return l ? l.href : null;
    };
    /* op 模式：改用 NGA 原生 authorid（只看楼主）分页 —— 追加页整页都是楼主楼，连续滚动阅读 */
    const curTid = () => (location.href.match(/tid=(\d+)/) || [])[1] || '';
    const curPageNo = () => {
        try { return Math.max(1, parseInt(new URL(location.href).searchParams.get('page') || '1', 10) || 1); }
        catch { return 1; }
    };
    const opModeOn = () => store.opOnly && !!lastData && lastData.kind === 'posts' && !!opUidSticky;
    const authoridUrl = n => {
        const u = new URL('/read.php', location.href);
        u.searchParams.set('tid', curTid());
        u.searchParams.set('page', String(n));
        u.searchParams.set('authorid', opUidSticky);
        return u.href;
    };
    /* 手动翻页在 op 模式下同样带 authorid，保持只看楼主语义 */
    const withAuthorid = u => {
        if (!opModeOn()) return u;
        try {
            const x = new URL(u, location.href);
            if (x.pathname.includes('read.php')) x.searchParams.set('authorid', opUidSticky);
            return x.href;
        } catch { return u; }
    };
    /* 距底 600px 即触发（提前抓取，滚动不中断） */
    const nearBottom = () => bodyEl
        && bodyEl.scrollTop + bodyEl.clientHeight >= bodyEl.scrollHeight - 600;

    /* 把抓取到的下一页内容追加到当前数据（带分页分隔标记）；op 模式走 authorid 页链（opNextNo 自增），普通模式走翻页条链 */
    const appendPage = (doc, pageUrl, opMode) => {
        let pageNo = 0;
        try { pageNo = +(new URL(pageUrl).searchParams.get('page') || 0); } catch { }
        const label = pageNo ? `page ${pageNo}` : 'next page';
        loadedPages.add(pageUrl);
        const end = () => { if (opMode) opEnd = true; else nextPageUrl = null; };
        // 解析为空分两种：有效 NGA 页但零内容=真到底；无页面容器=异常页（限流/验证码），标记失败可点击重试
        const emptyFail = containerSel => {
            if (doc.querySelector(containerSel)) end();
            else autoPageError = true;
        };
        if (lastData.kind === 'posts') {
            const opUid = opUidSticky || (lastData.posts.length ? lastData.posts[0].uid : undefined);
            const data = extractPosts(doc, opUid);
            if (!data || !data.posts.length) { emptyFail('#m_posts'); return; }
            // 防重复：与已有楼层重叠的一律剔除，零新增即到底
            const seen = new Set(lastData.posts.filter(p => !p.sep).map(p => p.head));
            const freshPosts = data.posts.filter(p => !seen.has(p.head));
            if (!freshPosts.length) { end(); return; }
            if (opMode) freshPosts.forEach(p => { p.isOP = true; });   // authorid 页整页都是楼主
            lastData.posts.push({ sep: label });
            lastData.posts.push(...freshPosts);
            if (opMode) opNextNo++;
        } else if (lastData.kind === 'topics') {
            const data = extractTopics(doc, pageUrl);
            if (!data || !data.topics.length) { emptyFail('#m_threads'); return; }
            // 防重复：置顶帖在每页重复出现，重叠一律剔除，零新增即到底
            const seenT = new Set(lastData.topics.filter(t => !t.sep).map(t => t.href));
            const freshTopics = data.topics.filter(t => !seenT.has(t.href));
            if (!freshTopics.length) { nextPageUrl = null; return; }
            lastData.topics.push({ sep: label });
            lastData.topics.push(...freshTopics);
        } else return;
        if (!opMode) {   // op 模式由 opNextNo 驱动，不动普通分页链
            let u = findNextUrl(extractPager(doc, pageUrl));
            if (!u) {   // 抓到页的翻页条常由 NGA 前端 JS 动态渲染（原始 HTML 无链接），按页码顺推兜底
                try {
                    const x = new URL(pageUrl);
                    if (/read\.php|thread\.php/.test(x.pathname)) {
                        x.searchParams.set('page', String(Math.max(1, parseInt(x.searchParams.get('page') || '1', 10) || 1) + 1));
                        u = x.href;
                    }
                } catch { }
            }
            nextPageUrl = (u && !loadedPages.has(u)) ? u : null;
        }
        ensureLocs();   // 为追加楼层的 uid 预取属地
    };

    /* NGA 页面是 GBK 编码：fetch 的 .text() 固定按 UTF-8 解码会乱码，须按 charset 显式解码 */
    const decodeRes = r => {
        const m = (r.headers.get('content-type') || '').match(/charset=([\w-]+)/i);
        return r.arrayBuffer().then(buf => {
            let cs = m && m[1];
            if (!cs) {   // 响应头没带 charset 时从 meta 嗅探（前 4KB 按 latin1 读即可）
                const head = new TextDecoder('latin1').decode(buf.slice(0, 4096));
                const mm = head.match(/charset=["']?([\w-]+)/i);
                cs = mm && mm[1];
            }
            try { return new TextDecoder(cs || 'gbk').decode(buf); }
            catch { return new TextDecoder('gbk').decode(buf); }   // NGA 默认 GBK
        });
    };

    const loadNextPage = () => {
        if (autoPageLoading || !lastData || lastData.kind === 'idle') return;
        const opMode = opModeOn();
        if (opMode ? opEnd : !nextPageUrl) return;
        autoPageLoading = true;
        autoPageError = false;
        if (opMode && opNextNo === null) {
            // 当前已是 authorid 页则顺推下一页，否则从 authorid 第 1 页补起（重叠楼层由 appendPage 剔除）
            opNextNo = new URLSearchParams(location.search).has('authorid') ? curPageNo() + 1 : 1;
        }
        const fetchUrl = opMode ? authoridUrl(opNextNo) : nextPageUrl;
        const hrefAtStart = location.href;
        renderApp();
        fetch(fetchUrl, { credentials: 'include' })
            .then(decodeRes)
            .then(txt => {
                autoPageLoading = false;
                if (location.href !== hrefAtStart) return;   // 抓取期间已翻页，丢弃
                appendPage(new DOMParser().parseFromString(txt, 'text/html'), fetchUrl, opMode);
                renderApp();
                setTimeout(maybeAutoLoad, 250);   // 追加后仍贴近底部（短页）时链式补齐，限速降低限流概率
            })
            .catch(() => {
                autoPageLoading = false;
                autoPageError = true;
                renderApp();
            });
    };

    const maybeAutoLoad = () => {
        if (!store.autopage || autoPageLoading || autoPageError) return;
        if (nearBottom()) loadNextPage();   // 是否有下一页（含 opEnd）由 loadNextPage 自判
    };
    const onBodyScroll = () => maybeAutoLoad();

    /* ================= 命令层 ================= */
    /* 回显行 HTML 串（内容一律先 esc 再拼） */
    const line = (s, cls) => `<div class="cad-line${cls ? ' ' + cls : ''}">${s}</div>`;

    const helpOut = () => [
        line('<b>搜索</b>', 'cad-sect'),
        line(esc('search: <kw>      本版搜索（在板块页时自动带 fid）'), 'cad-dim'),
        line(esc('search: -g <kw>   全站搜索'), 'cad-dim'),
        line('<b>板块</b>', 'cad-sect'),
        line(esc('board list            收藏列表 · board add [name] 收藏当前版'), 'cad-dim'),
        line(esc('board <n>             跳转收藏 · board del <n> 删除 · board fid <fid> 直达'), 'cad-dim'),
        line('<b>翻页 / 跳转</b>', 'cad-sect'),
        line(esc('next page / prev page 下/上一页（帖子与列表通用）'), 'cad-dim'),
        line(esc('go page <n>           跳到第 n 页 · top 回顶部'), 'cad-dim'),
        line(esc('autopage              滚到底自动加载下一页（无限滚动）'), 'cad-dim'),
        line(esc('ls                    列出当前内容 · open <n> 打开第 n 帖'), 'cad-dim'),
        line('<b>显示 / 开关</b>', 'cad-sect'),
        line(esc('theme · claude/codex · dark/light   主题切换'), 'cad-dim'),
        line(esc('img · op · expand · vim · autopage  图片/只看楼主/展开截断/vim/无限滚动'), 'cad-dim'),
        line('<b>vim 键位</b>', 'cad-sect'),
        line(esc('j/k 滚动 · h/l 上/下页 · gg/G 顶/底 · 数字前缀如 5j · 数字+Enter 开帖'), 'cad-dim'),
        line(esc('/ 搜索 · : 命令 · i 聚焦输入框 · o 预填 open/search · ctrl+o 展开截断'), 'cad-dim'),
        line(esc('Tab                   命令补全（多候选时列出） · ↑↓ 历史'), 'cad-dim'),
        line('<b>其他</b>', 'cad-sect'),
        line(esc('clear 清屏 · exit 退出伪装（` 同效） · version 版本信息'), 'cad-dim'),
    ];

    /* NGA 搜索：thread.php?key=kw，非全站且在板块页时带 fid 限定本版 */
    const doSearch = (kw, global) => {
        const u = new URL('/thread.php', location.href);
        u.searchParams.set('key', kw);
        const fid = curFid();
        if (!global && fid) u.searchParams.set('fid', fid);
        location.href = u.href;
    };

    /* 板块收藏（GM 持久化） */
    let boards = GM_getValue('cad_boards', []);
    const saveBoards = () => GM_setValue('cad_boards', boards);
    const curFid = () => new URLSearchParams(location.search).get('fid') || '';
    const gotoBoard = fid => {
        const u = new URL('/thread.php', location.href);
        u.searchParams.set('fid', fid);
        location.href = u.href;
    };
    /* board 子命令：返回回显行数组；需要跳转时自行导航并返回 null */
    const boardCmd = sub => {
        const [op, ...rest] = sub.split(/\s+/).filter(Boolean);
        const arg = rest.join(' ');
        if (!op || op === 'list' || op === 'ls') {
            const cur = curFid();
            const rows = boards.map((b, i) =>
                line(`<span class="cad-topicnum">${i + 1}</span> <a class="cad-pagelink${String(b.fid) === String(cur) ? ' cad-boardcur' : ''}" href="/thread.php?fid=${encodeURIComponent(b.fid)}">${esc(b.name)}</a> <span class="cad-faint">fid=${esc(String(b.fid))}${String(b.fid) === String(cur) ? ' · current' : ''}</span>`));
            return [
                line(esc('board add [name] 收藏 · board <n> 跳转 · board del <n> 删除 · board fid <fid> 直达'), 'cad-faint'),
                ...(rows.length ? rows : [line('（空）— 在板块页输入 board add 收藏', 'cad-faint')]),
            ];
        }
        if (op === 'add') {
            const fid = curFid();
            if (!fid) return [line('当前页面没有 fid（请在板块列表页使用）', 'cad-faint')];
            const name = arg || (lastData && lastData.board) || `fid ${fid}`;
            if (!boards.some(b => String(b.fid) === String(fid))) {
                boards.push({ fid, name });
                saveBoards();
            }
            return [line(`已收藏 ${esc(name)} (fid=${esc(String(fid))})`, 'cad-faint')];
        }
        if (op === 'del' || op === 'rm') {
            const n = parseInt(arg, 10);
            if (n >= 1 && n <= boards.length) {
                const [b] = boards.splice(n - 1, 1);
                saveBoards();
                return [line(`已删除 ${esc(b.name)}`, 'cad-faint')];
            }
            return [line(esc('usage: board del <n>'), 'cad-faint')];
        }
        if (op === 'fid' && arg) {
            gotoBoard(arg);
            return null;
        }
        const n = parseInt(op, 10);
        if (n >= 1 && n <= boards.length) {
            gotoBoard(boards[n - 1].fid);
            return null;
        }
        return [line(esc('usage: board list|add [name]|del <n>|<n>|fid <fid>'), 'cad-faint')];
    };

    /* 上/下页：优先翻页条链接，兜底按 URL page 参数推算；命令与 vim h/l 共用 */
    const pageNav = dir => {
        const pager = (lastData && lastData.pager) || [];
        const pick = dir > 0
            ? pager.find(l => /^(下一页|下页|>{1,2})$/.test(l.t))
            : pager.find(l => /^(上一页|上页|<{1,2})$/.test(l.t));
        if (pick) {
            location.href = withAuthorid(pick.href);
            return;
        }
        const u = new URL(location.href);
        const cur = parseInt(u.searchParams.get('page') || '1', 10);
        const nxt = cur + dir;
        if (nxt < 1) return;
        u.searchParams.set('page', String(nxt));
        location.href = withAuthorid(u.href);
    };

    /* go page <n>：翻页条精确匹配，否则直接改 page 参数 */
    const jumpPost = n => {
        const pager = (lastData && lastData.pager) || [];
        const hit = pager.find(l => l.t === String(n));
        if (hit) {
            location.href = withAuthorid(hit.href);
            return;
        }
        const u = new URL(location.href);
        u.searchParams.set('page', String(n));
        location.href = withAuthorid(u.href);
    };

    const topOf = () => {
        if (bodyEl) bodyEl.scrollTop = 0;
    };

    /* 输入框聚焦（可选预填命令） */
    const focusInput = preset => {
        if (!inputEl) return;
        if (typeof preset === 'string') {
            typed = preset;
            inputEl.value = preset;
            renderApp();
        }
        inputEl.focus();
        const len = inputEl.value.length;
        try { inputEl.setSelectionRange(len, len); } catch { }
    };

    /* ls：topics 页列帖子，posts 页列楼层头 */
    const lsOut = () => {
        if (!lastData) return [line('no data', 'cad-faint')];
        if (lastData.kind === 'topics')
            return lastData.topics.filter(t => !t.sep).slice(0, 20).map((t, i) =>
                line(`<span class="cad-topicnum">${i + 1}</span> ${esc(t.title)} <span class="cad-faint">· ${esc(t.replies || '0')} 回复</span>`));
        if (lastData.kind === 'posts')
            return lastData.posts.filter(p => !p.sep).map(p => line(esc(p.head), 'cad-faint'));
        return [line('no data', 'cad-faint')];
    };

    /* open <n>：打开板块页第 n 帖 */
    const openN = n => {
        const fail = msg => {
            echoLog.push({ cmd: `open ${n}`, out: [line(msg, 'cad-faint')] });
            refresh(true);
            if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
        };
        if (!lastData || lastData.kind !== 'topics') return fail('当前不是板块列表页');
        const list = lastData.topics.filter(t => !t.sep);
        const t = list[n - 1];
        if (!t) return fail(`没有第 ${n} 帖（共 ${list.length}）`);
        location.href = t.href;
    };

    const fallbackMsg = cmd => {
        return [line(esc(`command not found: ${cmd} — 输入 help 查看全部命令`), 'cad-faint')];
    };

    /* 命令分发：分支要么给 out 赋值走统一回显，要么自行处理并 return */
    const runCmd = raw => {
        const cmd = (raw || '').trim().replace(/^:\s*/, '');
        if (!cmd) return;
        cmdHistory.push(cmd);
        if (cmdHistory.length > 100) cmdHistory.shift();
        const m = cmd.toLowerCase();
        let out;

        if (m === 'help' || m === '?') out = helpOut();
        else if (m === 'clear' || m === 'cls') {
            echoLog.length = 0;
            refresh(true);
            return;
        }
        else if (m === 'exit' || m === 'quit' || m === 'q') {
            toggleDisguise();
            return;
        }
        else if (m === 'version' || m === 'about')
            out = [line('NGA Code Agent 伪装 <b>v2.2.3</b> · 渲染层 Preact 重构 · ` 切换伪装', 'cad-faint')];
        else if (m === 'pwd') out = [line(esc(cwdFor(lastData || { kind: 'idle' })), 'cad-faint')];
        else if (m === 'whoami') out = [line('ivan — 正在认真调试 code agent（并没有摸鱼）', 'cad-faint')];
        else if (m.startsWith('sudo')) out = [line(esc('sudo: permission denied — 老板在看着'), 'cad-faint')];
        else if (m === 'ls' || m === 'topics') out = lsOut();
        else if (/^open\s+\d+$/.test(m)) {
            openN(+m.match(/\d+$/)[0]);
            return;
        }
        else if (/^search\s*[:：]/i.test(cmd)) {
            let q = cmd.replace(/^search\s*[:：]\s*/i, '');
            let global = false;
            if (/^-(?:g|a|global|all)(?:\s+|$)/i.test(q)) {
                global = true;
                q = q.replace(/^-(?:g|a|global|all)(?:\s+|$)/i, '').trim();
            }
            if (!q) {
                echoLog.push({ cmd, out: [line(esc('usage: search: <kw> · search: -g <kw>（全站）'), 'cad-faint')] });
                refresh(true);
                if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
                return;
            }
            doSearch(q, global);
            return;
        }
        else if (m === 'board' || m.startsWith('board ')) {
            const r = boardCmd(cmd.slice(5).trim());
            if (r === null) return;
            out = r;
        }
        else if (m === 'next page' || m === 'next') {
            pageNav(1);
            return;
        }
        else if (m === 'prev page' || m === 'previous page' || m === 'prev') {
            pageNav(-1);
            return;
        }
        else if (/^go\s+page\s+\d+$/.test(m)) {
            jumpPost(+m.match(/\d+$/)[0]);
            return;
        }
        else if (m === 'top') {
            topOf();
            return;
        }
        else if (m === 'theme' || m === 't') {
            cycleTheme();
            out = [line(`theme → ${store.style} ${store.mode}`, 'cad-faint')];
        }
        else if (m === 'claude' || m === 'style claude') {
            store.style = 'claude';
            applyAttrs();
            syncChrome();
            out = [line('style → claude', 'cad-faint')];
        }
        else if (m === 'codex' || m === 'style codex') {
            store.style = 'codex';
            applyAttrs();
            syncChrome();
            out = [line('style → codex', 'cad-faint')];
        }
        else if (m === 'dark') {
            store.mode = 'dark';
            applyAttrs();
            syncChrome();
            out = [line('mode → dark', 'cad-faint')];
        }
        else if (m === 'light') {
            store.mode = 'light';
            applyAttrs();
            syncChrome();
            out = [line('mode → light', 'cad-faint')];
        }
        else if (m === 'img' || m === 'images') {
            store.img = !store.img;
            out = [line(`images → ${store.img ? 'on（显示图片）' : 'off（[image] 占位）'}`, 'cad-faint')];
        }
        else if (m === 'op' || m === 'op only') {
            store.opOnly = !store.opOnly;
            opNextNo = null;   // 切模式后 op 页链重新初始化
            opEnd = false;
            out = [line(`op only → ${store.opOnly ? 'on（只看楼主 · 自动连载整页楼主楼）' : 'off'}`, 'cad-faint')];
        }
        else if (m === 'expand') {
            store.expand = !store.expand;
            out = [line(`expand → ${store.expand ? 'on（不截断）' : 'off'}`, 'cad-faint')];
        }
        else if (m === 'vim') {
            store.vim = !store.vim;
            out = [line(`vim mode → ${store.vim ? 'on' : 'off'}`, 'cad-faint')];
        }
        else if (m === 'autopage' || m === 'auto page') {
            store.autopage = !store.autopage;
            if (store.autopage) maybeAutoLoad();
            out = [line(`autopage → ${store.autopage ? 'on（滚到底自动加载下一页）' : 'off'}`, 'cad-faint')];
        }
        else out = fallbackMsg(cmd);

        echoLog.push({ cmd, out });
        if (echoLog.length > 50) echoLog.shift();
        refresh(true);
        if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
    };

    /* ================= 伪装壳 ================= */
    const fakeTitle = () => store.style === 'claude' ? '✻ Claude Code' : 'Codex CLI';
    let origIcon = null;
    const setFavicon = on => {
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
    };

    /* html.cad-on 控制原页隐藏；root class 控制主题变量 */
    const applyAttrs = () => {
        document.documentElement.classList.toggle('cad-on', store.on);
        if (root) root.className = `cad-${store.style} cad-${store.mode}`;
    };

    /* 廉价签名：href + 容器 id + 结构计数（不含文本长度 —— 广告/赞数等文本级变动不再触发重渲染） */
    const quickSig = () => {
        const el = document.querySelector('#m_posts') || document.querySelector('#m_threads');
        return [
            location.href,
            el ? el.id : 'idle',
            document.querySelectorAll('.forumbox.postbox').length,
            document.querySelectorAll('.topicrow').length,
            el ? el.childElementCount : 0,
        ].join('|');
    };

    const THEME_ORDER = ['claude-dark', 'claude-light', 'codex-dark', 'codex-light'];
    const cycleTheme = () => {
        const cur = `${store.style}-${store.mode}`;
        const nxt = THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1 + THEME_ORDER.length) % THEME_ORDER.length];
        const [style, mode] = nxt.split('-');
        store.style = style;
        store.mode = mode;
        applyAttrs();
        renderApp();
        if (store.on) setFavicon(true);
    };

    /* 刷新：签名未变直接跳过；Preact diff 自动保住滚动/焦点/图片加载状态 */
    const refresh = force => {
        if (!store.on || !root) return;
        const sig = quickSig();
        if (!force && sig === lastSig) return;
        lastSig = sig;
        const fresh = extract();
        // 记录楼主 uid：首页或 authorid 页的首楼必是楼主（op 模式 authorid 抓取依赖）
        if (fresh && fresh.kind === 'posts') {
            const tid = curTid();
            if (opUidTid !== tid) { opUidTid = tid; opUidSticky = ''; }
            if (!opUidSticky && (curPageNo() <= 1 || new URLSearchParams(location.search).has('authorid')))
                opUidSticky = (fresh.posts[0] && fresh.posts[0].uid) || '';
        }
        // 无限滚动：同页数据刷新时保留已追加的分页（只替换第一页部分；topics 对新增导致的位移去重）
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
        maybeAutoLoad();   // 首屏不足一屏（短页）时立即补下一页
    };

    const build = () => {
        if (document.getElementById('cad__root')) return;
        root = document.createElement('div');
        root.id = 'cad__root';
        document.body.appendChild(root);
        applyAttrs();
        renderApp();
        refresh(true);
    };

    const toggleDisguise = () => {
        store.on = !store.on;
        if (store.on) {
            build();
            applyAttrs();
            setFavicon(true);
            refresh(true);
        } else {
            setFavicon(false);
            applyAttrs();
        }
    };

    /* ================= 全局键位 ================= */
    let pendingCount = '';
    document.addEventListener('keydown', e => {
        // 输入栏内部事件由 onInputKey 处理（且已 stopPropagation）
        if (e.target && e.target.classList && e.target.classList.contains('cad-real')) return;
        if (e.key === '`' || e.code === 'Backquote') {
            e.preventDefault();
            toggleDisguise();
            return;
        }
        if (!store.on) return;
        if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
            e.preventDefault();
            store.expand = !store.expand;
            renderApp();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (!store.vim) {
            if (e.key === '?') runCmd('help');
            else if (e.key === 't') cycleTheme();
            else if (e.key === 'i') focusInput();
            return;
        }
        // ---- vim 模式 ----
        const k = e.key;
        if (/^\d$/.test(k)) {
            pendingCount += k;
            renderApp();   // showcmd：状态栏实时显示数字前缀
            return;
        }
        const count = Math.max(1, parseInt(pendingCount || '1', 10) || 1);
        const hadCount = !!pendingCount;
        switch (k) {
            case 'j': if (bodyEl) bodyEl.scrollBy({ top: 120 * count }); break;
            case 'k': if (bodyEl) bodyEl.scrollBy({ top: -120 * count }); break;
            case 'h': pageNav(-1); break;
            case 'l': pageNav(1); break;
            case 'g': {
                const now = Date.now();
                if (now - gTs < 600) {
                    topOf();
                    gTs = 0;
                } else gTs = now;
                break;
            }
            case 'G': if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight; break;
            case '/': e.preventDefault(); focusInput('search: '); break;
            case ':': e.preventDefault(); focusInput(); break;
            case 'i': focusInput(); break;
            case 'o':
                if (lastData && lastData.kind === 'topics') focusInput('open ');
                else focusInput('search: ');
                break;
            case 't': cycleTheme(); break;
            case '?': runCmd('help'); break;
            case 'Enter':
                if (pendingCount && lastData && lastData.kind === 'topics') openN(count);
                break;
            default: break;
        }
        pendingCount = '';
        if (hadCount) renderApp();   // 清除 showcmd 显示
    }, true);

    /* ================= 杂项与启动 ================= */
    /* 吃掉 NGA 统计/广告脚本在伪装态下的报错噪声 */
    const stripTrackerErrors = () => {
        window.addEventListener('error', e => {
            if (/ubbcode|common\.js|ngaco|track|_hmt|hm\.baidu/i.test((e.filename || '') + ' ' + (e.message || ''))) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    };

    /* NGA pjax 会改标题：记下真实标题并回写伪装标题 */
    const watchTitle = () => {
        const t = document.querySelector('title');
        if (!t) return;
        new MutationObserver(() => {
            if (!store.on) {
                realTitle = document.title;
                return;
            }
            if (document.title !== fakeTitle()) {
                realTitle = document.title;
                document.title = fakeTitle();
            }
        }).observe(t, { childList: true, characterData: true, subtree: true });
    };

    setInterval(() => { if (store.on) refresh(false); }, 1200);
    /* 状态栏时钟：每 30s 轻量重渲染（Preact diff 成本极低） */
    setInterval(() => { if (store.on && root) renderApp(); }, 30000);

    const boot = () => {
        realTitle = document.title || realTitle;
        watchTitle();
        stripTrackerErrors();
        if (store.on) {
            build();
            setFavicon(true);
        } else applyAttrs();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
