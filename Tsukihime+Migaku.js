// ==UserScript==
// @name         Tsukiweb + Migaku
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Hides original text and shows a stable Migaku mirror text.
// @author       .RVN
// @match        https://tsukiweb.holofield.fr/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /**
     * STYLES INJECTION
     * Categorized CSS rules for layout, typography, and interface fixes.
     */
    const style = document.createElement('style');
    style.innerHTML = `
        /**
        *     1. CONTAINERS & LAYOUT
        */

        /* ------------ Hide Original Text ------------ */
        .text-container[data-mgk-ignore="true"] {
            position: absolute !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -1 !important;
        }

        /* ------------ Mirror Text ------------ */
        #migaku-mirror-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
        }

        #migaku-mirror-text, .migaku-surface {
            white-space: pre !important;
            display: block !important;
            width: 100% !important;
        }



        /**
        *     2. TEXT HEIGHT
        */

        #migaku-mirror-text .migaku-sentence,
        #migaku-mirror-text span {
            margin: 0 !important;
        }

        #migaku-mirror-text > .migaku-sentence,
        #migaku-mirror-text > span > span,
        #migaku-mirror-text > span > div > span {
            line-height: var(--orig-lh) !important;
        }



        /**
        *     3. FIX TYPOGRAPHY
        */

        /* ------------ Leading Space ------------ */
        .mgk-visual-indent::before {
            content: attr(data-indent-content);
            display: inline-block !important;
            white-space: pre !important;
        }

        /* ------------ Dash ------------ */
        .dash {
            letter-spacing: -1000px !important; /* hidde content */
            color: transparent !important;
            text-shadow: 0 0 0 transparent !important;
        }

        .dash::before {
            content: attr(data-dash-content);
            text-decoration: line-through !important;
            letter-spacing: 1px !important; /* fix spacing */
            color: var(--dash-color) !important;
            /* TODO： Find how to copy */
            text-shadow: #000 .8px .8px .6px, #000 -.8px .8px .6px, #000 -.8px -.8px .6px, #000 .8px -.8px .6px;
        }

        /* ------------ Punctuation ------------ */
        .punct-space-fix {
            display: inline-block !important;
        }
        .punct-space-fix::after {
            content: attr(data-punct-space);
            white-space: pre !important;
            display: inline-block !important;
        }



        /**
        *     3. UI COMPONENTS
        */

        /* --- Navigation & Interaction --- */
        .cursor {
            height: clamp(1.6em, 4.8cqw, 1.95em) !important;
            width: clamp(1.6em, 4.8cqw, 1.95em) !important;
            padding: 0.4em !important;
        }

        /* --- Layout Buttons --- */
        .layer-btns {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
        }
        .action-btns {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            width: 100% !important;
        }
    `;
    document.head.appendChild(style);

    let lastHTML = "";





    /**
     * MIGAKU ENGINE TRIGGER
     * Resets the processed flag and simulates Alt+P to scan the mirror text.
     */

    function runMigaku() {
        const mirror = document.querySelector('#migaku-mirror-text');
        if (!mirror) return;
        mirror.removeAttribute('data-mgk-processed');
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'p', code: 'KeyP', altKey: true, bubbles: true
        }));
    }





    /**
     * TEXT PROCESSING LOGIC
     * Handles indents, dashes, and punctuation spacing before mirror injection.
     */

    function processMirrorContent(sourceHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sourceHTML;


        // Leading Space Fix ( \u2002 and \u3000 spaces )
        tempDiv.querySelectorAll('span:not(.dash)').forEach(span => {
            const match = span.innerHTML.match(/^([\u2002\u3000]+)/);
            if (match) {
                span.setAttribute('data-indent-content', match[1]);
                span.innerHTML = span.innerHTML.replace(/^([\u2002\u3000]+)/, '');
                span.classList.add('mgk-visual-indent');
            }
        });


        // Dashes Fix
        tempDiv.querySelectorAll('.dash').forEach(dash => {
            dash.setAttribute('data-dash-content', dash.textContent);
            dash.textContent = '<i></i>'; // Empty = bad. Symbol = bad.
        });


        // Punctuation Fix
        return tempDiv.innerHTML.replace(/([.!?。！？])\s/g, (match, punct) => {
            return `<span class="punct-space-fix" data-punct-space=" ">${punct}</span>`;
        });
    }





    /**
     * MAIN OBSERVER
     * Monitors DOM changes to sync the original game text with the Migaku mirror.
     */

    const observer = new MutationObserver(() => {
        // Ignore UI menus
        const menu = document.querySelector('menu');
        if (menu && !menu.hasAttribute('data-mgk-ignore')) {
            menu.setAttribute('data-mgk-ignore', 'true');
            menu.querySelectorAll('*').forEach(el => el.setAttribute('data-mgk-ignore', 'true'));
        }

        const original = document.querySelector('.text-container:not([id*="migaku"])');
        if (!original || original.innerHTML === lastHTML) return;

        lastHTML = original.innerHTML;
        const s = window.getComputedStyle(original);

        // Sync global CSS variables
        document.documentElement.style.setProperty('--orig-lh', s.lineHeight);

        // Ensure mirror wrapper exists
        let wrapper = document.querySelector('#migaku-mirror-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'migaku-mirror-wrapper';
            original.parentElement.appendChild(wrapper);
        }

        // Rebuild mirror content
        wrapper.innerHTML = '<div id="migaku-mirror-text" class="text-container"></div>';
        const mirror = document.querySelector('#migaku-mirror-text');

        // Apply processed content
        mirror.innerHTML = processMirrorContent(lastHTML);

        // Synchronize Styles
        Object.assign(mirror.style, {
            textShadow: s.textShadow,
            fontSize: s.fontSize,
            fontFamily: s.fontFamily,
            color: s.color,
            textAlign: s.textAlign
        });

        mirror.style.setProperty('--dash-color', s.color);
        mirror.style.setProperty('--dash-shadow', s.textShadow);

        // Flag original to be ignored by Migaku and trigger re-scan
        original.setAttribute('data-mgk-ignore', 'true');
        setTimeout(runMigaku, 200);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

})();
