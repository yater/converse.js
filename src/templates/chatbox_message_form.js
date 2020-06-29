import "../components/message-form.js";
import { api } from "@converse/headless/converse-core";
import { html } from "lit-html";


export default (o) => {
    return html`
        <div class="new-msgs-indicator hidden">▼ ${ o.unread_msgs } ▼</div>
        <form class="setNicknameButtonForm hidden">
            <input type="submit" class="btn btn-primary" name="join" value="Join"/>
        </form>
        <converse-message-form
            .chatview=${o.chatview}
            .getAutoCompleteList=${o.getAutoCompleteList}}
            ?composing_spoiler="${o.composing_spoiler}"
            auto_first=${true}
            filter=${api.settings.get('muc_mention_autocomplete_filter')}
            message_value="${o.message_value || ''}"
            min_chars=${api.settings.get('muc_mention_autocomplete_min_chars')}
            name="chat_message"
        ></converse-message-form>`;
}
