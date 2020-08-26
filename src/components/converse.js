import { converse } from "@converse/headless/converse-core";


class Converse extends HTMLElement {

    constructor () {
        super();
        const ev = new CustomEvent('converse-initialize', )
        ev.element = this;
        window.dispatchEvent(ev);
        if (typeof this.settings !== 'undefined') {
            converse.initialize(this.settings);
        }
    }
}

customElements.define('converse-init', Converse);
