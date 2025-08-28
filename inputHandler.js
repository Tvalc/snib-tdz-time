class InputHandler {
    constructor() {
        this.keys = {};
        this._bindEvents();
    }
    _bindEvents() {
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });
    }
    isDown(code) {
        return !!this.keys[code];
    }
}
window.InputHandler = InputHandler;