import { __ } from 'i18n';
import { _converse } from '@converse/headless/core.js';
import { getMarkerActorsText } from '../utils.js'
import { getMessageIdToMark } from '@converse/headless/plugins/markers/utils.js';
import { html } from 'lit';


export default (el) => {
    const message = el.message;
    const markers = message.collection.chatbox.markers;
    const marker = markers?.get(getMessageIdToMark(message));
    const marked_by = Object.keys(marker?.get('marked_by') || {}).filter(k => k !== _converse.bare_jid);
    if (marked_by.length) {
        let text;
        if (message.get('type') === 'groupchat') {
            text = getMarkerActorsText(marked_by);
        } else {
            const contact = _converse.roster.get(marked_by[0]);
            text = __(`${contact.getDisplayName()} has read until here`);
        }
        return html`<div class="message chat-marker"><hr class="separator"/>
                <span class="separator-text"><span>${text}</span></span>
            </div>`;
    }
    return '';
}
