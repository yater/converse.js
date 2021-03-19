import 'shared/registry.js';
import tpl_chatbox_message_form from './templates/message-form.js';
import { CustomElement } from 'components/element.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";


export default class MessageForm extends CustomElement {

    static get properties () {
        return {
            jid: { type: String },
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.jid);

        // FIXME: moved into template
        this.addEventListener('focusin', ev => this.emitFocused(ev));
        this.addEventListener('focusout', ev => this.emitBlurred(ev));
    }

    render () {
        return tpl_chatbox_message_form(
            Object.assign(this.model.toJSON(), {
                'onDrop': ev => this.onDrop(ev),
                'hint_value': this.querySelector('.spoiler-hint')?.value,
                'inputChanged': ev => this.inputChanged(ev),
                'label_message': this.model.get('composing_spoiler') ? __('Hidden message') : __('Message'),
                'label_spoiler_hint': __('Optional hint'),
                'message_value': this.querySelector('.chat-textarea')?.value,
                'onChange': ev => this.updateCharCounter(ev.target.value),
                'onKeyDown': ev => this.onKeyDown(ev),
                'onKeyUp': ev => this.onKeyUp(ev),
                'onPaste': ev => this.onPaste(ev),
                'show_send_button': api.settings.get('show_send_button'),
                'show_toolbar': api.settings.get('show_toolbar'),
                'unread_msgs': __('You have unread messages'),
                'viewUnreadMessages': ev => this.viewUnreadMessages(ev),
            })
        );
    }

    emitFocused (ev) {
        _converse.chatboxviews.get(this.jid)?.emitFocused(ev);
    }

    emitBlurred (ev) {
        _converse.chatboxviews.get(this.jid)?.emitBlurred(ev);
    }
}

api.elements.define('converse-message-form', MessageForm);
