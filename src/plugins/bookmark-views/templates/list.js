import bookmark_item from './item.js';
import { __ } from 'i18n';
import { _converse } from '@converse/headless/core.js';
import { html } from "lit";

export default (el) => {
    const should_show = !!_converse.bookmarks.getUnopenedBookmarks().length;
    const desc_bookmarks = __('Click to toggle the bookmarks list');
    const label_bookmarks = __('Bookmarks');
    const toggle_state = el.model.get('toggle-state');
    return html`
        <div class="list-container list-container--bookmarks ${ should_show ? 'fade-in' : 'hidden' }">
            <a class="list-toggle bookmarks-toggle controlbox-padded"
               title="${desc_bookmarks}"
               @click=${() => el.toggleBookmarksList()}>

                <span class="fa ${(toggle_state === _converse.OPENED) ? 'fa-caret-down' : 'fa-caret-right' }">
                </span> ${label_bookmarks}</a>
            <div class="items-list bookmarks rooms-list ${ (toggle_state === _converse.OPENED) ? 'fade-in' : 'hidden fade-out' }">
            ${ _converse.bookmarks.map(bm => bookmark_item(bm)) }
            </div>
        </div>
    `;
}
