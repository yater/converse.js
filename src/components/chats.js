import { api } from "@converse/headless/converse-core";

/**
 * `converse-chats` is an optional custom element which can be used to
 * declaratively insert the Converse UI into the DOM.
 *
 * It can be inserted into the DOM before or after Converse has loaded or been
 * initialized.
 */
class ConverseChats extends HTMLElement {

    async connectedCallback () { // eslint-disable-line class-methods-use-this
        await api.waitUntil('initialized');
    }
}


customElements.define('converse-chats', ConverseChats);
