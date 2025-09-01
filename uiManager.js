class UIManager {
    constructor() {
        this.overlay = document.getElementById('ui-overlay');
        this._hud = null;
        this._narrativeBox = null;
        this._narrativeTyping = null;
        this.clearUI();
    }
    clearUI() {
        this.overlay.innerHTML = '';
        this._hud = null; // Ensure HUD reference is reset when UI is cleared
        this._narrativeBox = null;
        this._narrativeTyping = null;
    }
    showMainMenu(onStart) {
        this.clearUI();
        const panel = document.createElement('div');
        panel.className = 'ui-panel';
        panel.innerHTML = `<h1>Coinboy Platformer</h1>
            <div style="margin-bottom:16px;font-size:1.13rem;">Arrow keys or A/D to move, Space to jump.<br>
            Avoid Coinboy when he rolls at you!</div>
            <button id="start-btn">Start Game</button>`;
        this.overlay.appendChild(panel);
        // Ensure pointer events are enabled for the overlay and panel
        this.overlay.style.pointerEvents = 'auto';
        panel.style.pointerEvents = 'auto';
        // Use addEventListener instead of .onclick to avoid event loss
        const startBtn = panel.querySelector('#start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Disable pointer events after click to avoid double starts
                this.overlay.style.pointerEvents = 'none';
                onStart();
            });
        }
    }
    showGameOver(score, onRestart) {
        this.clearUI();
        const panel = document.createElement('div');
        panel.className = 'ui-panel';
        panel.innerHTML = `<h1>Game Over</h1>
            <div style="margin-bottom:16px;">You survived for <b>${score.toFixed(1)}</b> seconds!</div>
            <button id="restart-btn">Restart</button>`;
        this.overlay.appendChild(panel);
        // Ensure pointer events are enabled for the overlay and panel
        this.overlay.style.pointerEvents = 'auto';
        panel.style.pointerEvents = 'auto';
        const restartBtn = panel.querySelector('#restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.overlay.style.pointerEvents = 'none';
                onRestart();
            });
        }
    }
    showHUD(score, lives) {
        if (!this._hud) {
            this._hud = document.createElement('div');
            this._hud.id = 'hud';
            this.overlay.appendChild(this._hud);
        }
        // Remove HP from HUD (now shown as health bar above player)
        this._hud.innerHTML = `
            <div class="hud-section">⏱ Time: ${score.toFixed(1)}s</div>
            <div class="hud-section">❤️ Lives: ${lives}</div>
        `;
    }
    hideHUD() {
        if (this._hud && this._hud.parentNode) {
            this._hud.parentNode.removeChild(this._hud);
            this._hud = null;
        }
    }

    // --- NARRATIVE DIALOGUE BOX ---
    showNarrative(text, options = {}) {
        // options: { onComplete, allowSkip }
        // Only one narrative box at a time
        this.hideNarrative();

        // Create box
        const box = document.createElement('div');
        box.className = 'narrative-box';
        box.style.position = 'absolute';
        box.style.left = '50%';
        box.style.top = '50%';
        box.style.transform = 'translate(-50%, -50%)';
        box.style.background = 'rgba(255,255,255,0.97)';
        box.style.borderRadius = '18px';
        box.style.padding = '36px 44px 32px 44px';
        box.style.boxShadow = '0 4px 32px rgba(0,0,0,0.18)';
        box.style.fontSize = '1.25rem';
        box.style.fontFamily = "'Segoe UI', Arial, sans-serif";
        box.style.color = '#2a2a2a';
        box.style.maxWidth = '700px';
        box.style.minWidth = '340px';
        box.style.maxHeight = '350px';
        box.style.overflow = 'hidden';
        box.style.zIndex = 200;
        box.style.textAlign = 'left';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.justifyContent = 'center';
        box.style.alignItems = 'center';
        box.style.pointerEvents = 'auto';

        // Inner text area (for typing)
        const textArea = document.createElement('div');
        textArea.className = 'narrative-text';
        textArea.style.width = '100%';
        textArea.style.whiteSpace = 'pre-line';
        textArea.style.wordBreak = 'break-word';
        textArea.style.fontSize = '1.19rem';
        textArea.style.lineHeight = '1.55';
        textArea.style.letterSpacing = '0.01em';
        textArea.style.marginBottom = '18px';
        textArea.style.minHeight = '110px';
        textArea.style.maxHeight = '210px';
        textArea.style.overflow = 'hidden';
        textArea.style.textAlign = 'left';

        box.appendChild(textArea);

        // Continue/skip prompt
        const continuePrompt = document.createElement('div');
        continuePrompt.className = 'narrative-continue';
        continuePrompt.style.fontSize = '1.02rem';
        continuePrompt.style.color = '#b53c1a';
        continuePrompt.style.marginTop = '12px';
        continuePrompt.style.fontWeight = 'bold';
        continuePrompt.style.opacity = '0.86';
        continuePrompt.style.userSelect = 'none';
        continuePrompt.innerText = '';
        box.appendChild(continuePrompt);

        this.overlay.appendChild(box);
        this._narrativeBox = box;

        // --- TYPEWRITER EFFECT WITH WORD WRAP AND SCROLL ---
        // We'll simulate a typewriter effect, word-wrapping as we go.
        // If text exceeds max lines, scroll/clear to next "page" as it types.

        // Settings
        const CHAR_DELAY = 15; // ms per character (faster for long text)
        const PAGE_DELAY = 500; // ms pause after page before next page
        const MAX_LINES = 6; // max lines per page
        const MAX_CHARS_PER_LINE = 56; // rough estimate for wrapping

        // Split text into words for wrapping
        const words = text.split(/\s+/);
        let currentPage = [];
        let allPages = [];
        let currentLine = '';
        let lines = [];

        // --- Preprocess: split into pages of lines ---
        for (let i = 0; i < words.length; ++i) {
            let word = words[i];
            // If adding this word exceeds line length, start new line
            if ((currentLine + (currentLine ? ' ' : '') + word).length > MAX_CHARS_PER_LINE) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine += (currentLine ? ' ' : '') + word;
            }
            // If last word, push last line
            if (i === words.length - 1 && currentLine.length > 0) {
                lines.push(currentLine);
            }
        }
        // Now, group lines into pages
        for (let i = 0; i < lines.length; i += MAX_LINES) {
            allPages.push(lines.slice(i, i + MAX_LINES));
        }

        // --- Typing state ---
        let pageIdx = 0;
        let charIdx = 0;
        let typing = true;
        let skipRequested = false;
        let onComplete = typeof options.onComplete === "function" ? options.onComplete : null;
        let allowSkip = options.allowSkip !== false; // default true

        // Helper: type out a page
        const typePage = (pageLines, cb) => {
            textArea.innerHTML = '';
            let fullText = pageLines.join('\n');
            let displayText = '';
            charIdx = 0;
            typing = true;
            skipRequested = false; // <-- FIX: Reset skipRequested for each page!
            continuePrompt.innerText = '';
            // Typewriter loop
            function typeChar() {
                if (skipRequested) {
                    // Show full page instantly
                    textArea.innerText = fullText;
                    typing = false;
                    continuePrompt.innerText = (pageIdx < allPages.length - 1) ? 'Press Space or Enter to continue...' : 'Press Space or Enter to start!';
                    if (cb) cb();
                    return;
                }
                if (charIdx <= fullText.length) {
                    displayText = fullText.slice(0, charIdx);
                    textArea.innerText = displayText;
                    charIdx++;
                    setTimeout(typeChar, CHAR_DELAY);
                } else {
                    typing = false;
                    continuePrompt.innerText = (pageIdx < allPages.length - 1) ? 'Press Space or Enter to continue...' : 'Press Space or Enter to start!';
                    if (cb) cb();
                }
            }
            typeChar();
        };

        // --- Page navigation ---
        const nextPage = () => {
            if (pageIdx < allPages.length) {
                typePage(allPages[pageIdx], () => {});
            }
        };

        // --- Keyboard skip/continue handler ---
        // Store the handler so we can remove it properly (fixes stuck/frozen bug)
        const keyHandler = (e) => {
            if (!this._narrativeBox) return;
            if (!allowSkip) return;
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                if (typing) {
                    // Skip typing, show full page
                    skipRequested = true;
                } else {
                    // Next page or finish
                    skipRequested = false;
                    pageIdx++;
                    if (pageIdx < allPages.length) {
                        nextPage();
                    } else {
                        // Done
                        this.hideNarrative();
                        window.removeEventListener('keydown', keyHandler);
                        if (onComplete) onComplete();
                    }
                }
            }
        };
        // Remove any previous narrative key handler before adding a new one
        if (window._uiManagerNarrativeKeyHandler) {
            window.removeEventListener('keydown', window._uiManagerNarrativeKeyHandler);
        }
        window._uiManagerNarrativeKeyHandler = keyHandler;
        window.addEventListener('keydown', keyHandler);

        // Start first page
        nextPage();
    }

    hideNarrative() {
        if (this._narrativeBox && this._narrativeBox.parentNode) {
            this._narrativeBox.parentNode.removeChild(this._narrativeBox);
            this._narrativeBox = null;
        }
        // Remove narrative key handler if present
        if (window._uiManagerNarrativeKeyHandler) {
            window.removeEventListener('keydown', window._uiManagerNarrativeKeyHandler);
            window._uiManagerNarrativeKeyHandler = null;
        }
    }
}
window.UIManager = UIManager;