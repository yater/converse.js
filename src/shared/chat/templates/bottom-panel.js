import { html } from "lit-html";
import 'shared/chat/message-form.js';

export default (o) => html`<div class="message-form-container">
        <converse-message-form jid="${o.jid}"></converse-message-form>
    </div>`;
