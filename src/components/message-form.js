import AutoCompleteComponent from "./autocomplete.js";
import { __ } from '@converse/headless/i18n';
import { _converse, api, converse } from '@converse/headless/converse-core';
import { html } from 'lit-element';

const u = converse.env.utils;
const i18n_hidden_message = __('Hidden message');
const i18n_message = __('Message');
const i18n_spoiler_hint = __('Spoiler hint');


export class MessageForm extends AutoCompleteComponent {

    static get properties () {
        const props = super.properties;
        return Object.assign({}, props, {
            'chatview': { type: Object },
            'composing_spoiler': { type: Boolean },
            'message_value': { type: String },
            'hint_value': { type: String },
        });
    }

    render () {
        const message_limit = api.settings.get('message_limit');
        const show_call_button = api.settings.get('visible_toolbar_buttons').call;
        const show_emoji_button = api.settings.get('visible_toolbar_buttons').emoji;
        const show_send_button = api.settings.get('show_send_button');
        const show_spoiler_button = api.settings.get('visible_toolbar_buttons').spoiler;
        const show_toolbar = api.settings.get('show_toolbar');
        const is_groupchat = this.chatview.model.get('type') === _converse.CHATROOMS_TYPE;
        const show_occupants_toggle = is_groupchat && _converse.visible_toolbar_buttons.toggle_occupants;
        const hidden_occupants = is_groupchat && this.chatview.model.get('hidden_occupants')

        return html`
            <form class="sendXMPPMessage">
                <converse-chat-toolbar
                    class="no-text-select"
                    .chatview=${this.chatview}
                    .model=${this.model}
                    ?hidden_occupants="${hidden_occupants}"
                    ?is_groupchat="${is_groupchat}"
                    ?show_call_button="${show_call_button}"
                    ?show_emoji_button="${show_emoji_button}"
                    ?show_occupants_toggle="${show_occupants_toggle}"
                    ?show_send_button="${show_send_button}"
                    ?show_spoiler_button="${show_spoiler_button}"
                    ?show_toolbar="${show_toolbar}"
                    message_limit="${message_limit}"
                ></converse-chat-toolbar>

                <input type="text" placeholder="${i18n_spoiler_hint || ''}" value="${this.hint_value || ''}" class="${this.composing_spoiler ? '' : 'hidden'} spoiler-hint"/>
                <div class="suggestion-box">
                    <ul class="suggestion-box__results suggestion-box__results--above" hidden=""></ul>
                    <textarea
                        @dragover=${this.onDragOver}
                        @drop=${this.onDrop}
                        @input=${this.inputChanged}
                        @keydown=${this.onKeyDown}
                        @keyup=${this.onKeyUp}
                        @paste=${this.onPaste}
                        name="${this.name}"
                        type="text"
                        class="chat-textarea suggestion-box__input
                            ${ this.show_send_button ? 'chat-textarea-send-button' : '' }
                            ${ this.composing_spoiler ? 'spoiler' : '' }"
                        placeholder="${this.composing_spoiler ? i18n_hidden_message : i18n_message}"
                    >${ this.message_value || '' }</textarea>
                    <span class="suggestion-box__additions visually-hidden" role="status" aria-live="assertive" aria-relevant="additions"></span>
                </div>
            </form>`;
    }


    onDragOver (ev) {  //eslint-disable-line class-methods-use-this
        ev.preventDefault();
    }


    inputChanged (ev) {  //eslint-disable-line class-methods-use-this
        const height = ev.target.scrollHeight + 'px';
        if (ev.target.style.height != height) {
            ev.target.style.height = 'auto';
            ev.target.style.height = height;
        }
    }


    onDrop (evt) {
        if (evt.dataTransfer.files.length == 0) {
            // There are no files to be dropped, so this isn’t a file
            // transfer operation.
            return;
        }
        evt.preventDefault();
        this.chatview.model.sendFiles(evt.dataTransfer.files);
    }


    onKeyUp (ev) {
        super.onKeyUp(ev);
        this.chatview.updateCharCounter(ev.target.value);
    }


    onPaste (ev) {
        if (ev.clipboardData.files.length !== 0) {
            ev.preventDefault();
            // Workaround for quirk in at least Firefox 60.7 ESR:
            // It seems that pasted files disappear from the event payload after
            // the event has finished, which apparently happens during async
            // processing in sendFiles(). So we copy the array here.
            this.chatview.model.sendFiles(Array.from(ev.clipboardData.files));
            return;
        }
        this.chatview.updateCharCounter(ev.clipboardData.getData('text/plain'));
    }

    onKeyDown (ev) {
        super.onKeyDown(ev);

        if (ev.ctrlKey) {
            // When ctrl is pressed, no chars are entered into the textarea.
            return;
        }
        if (!ev.shiftKey && !ev.altKey && !ev.metaKey) {
            if (ev.keyCode === converse.keycodes.FORWARD_SLASH) {
                // Forward slash is used to run commands. Nothing to do here.
                return;
            } else if (ev.keyCode === converse.keycodes.ESCAPE) {
                return this.onEscapePressed(ev);
            } else if (ev.keyCode === converse.keycodes.ENTER) {
                return this.onEnterPressed(ev);
            } else if (ev.keyCode === converse.keycodes.UP_ARROW && !ev.target.selectionEnd) {
                const textarea = this.el.querySelector('.chat-textarea');
                if (!textarea.value || u.hasClass('correcting', textarea)) {
                    return this.editEarlierMessage();
                }
            } else if (ev.keyCode === converse.keycodes.DOWN_ARROW &&
                    ev.target.selectionEnd === ev.target.value.length &&
                    u.hasClass('correcting', this.el.querySelector('.chat-textarea'))) {
                return this.editLaterMessage();
            }
        }
        if ([converse.keycodes.SHIFT,
                converse.keycodes.META,
                converse.keycodes.META_RIGHT,
                converse.keycodes.ESCAPE,
                converse.keycodes.ALT].includes(ev.keyCode)) {
            return;
        }
        if (this.chatview.model.get('chat_state') !== _converse.COMPOSING) {
            // Set chat state to composing if keyCode is not a forward-slash
            // (which would imply an internal command and not a message).
            this.chatview.model.setChatState(_converse.COMPOSING);
        }
    }

    onEnterPressed (ev) {
        return this.chatview.onFormSubmitted(ev);
    }
}


api.elements.define('converse-message-form', MessageForm);
