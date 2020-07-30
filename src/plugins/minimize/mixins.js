const u = converse.env.utils;
import { _converse, api, converse } from "@converse/headless/converse-core";


/**
 * Mixin object which makes it possible to minimize chat boxes.
 * @mixin
 */
export const minimizableChatBox = {
    maximize () {
        u.safeSave(this, {
            'minimized': false,
            'time_opened': (new Date()).getTime()
        });
    },

    minimize () {
        u.safeSave(this, {
            'minimized': true,
            'time_minimized': (new Date()).toISOString()
        });
    }
}


/**
 * Mixin object which adds support for minimization to chat views.
 * @mixin
 */
export const minimizableChatBoxView = {
    /**
     * Handler which gets called when a {@link _converse#ChatBox} has it's
     * `minimized` property set to false.
     *
     * Will trigger {@link _converse#chatBoxMaximized}
     * @private
     * @returns {_converse.ChatBoxView|_converse.ChatRoomView}
     */
    onMaximized () {
        const { _converse } = this.__super__;
        this.insertIntoDOM();

        if (!this.model.isScrolledUp()) {
            this.model.clearUnreadMsgCounter();
        }
        this.model.setChatState(_converse.ACTIVE);
        this.show();
        /**
         * Triggered when a previously minimized chat gets maximized
         * @event _converse#chatBoxMaximized
         * @type { _converse.ChatBoxView }
         * @example _converse.api.listen.on('chatBoxMaximized', view => { ... });
         */
        api.trigger('chatBoxMaximized', this);
        return this;
    },

    /**
     * Handler which gets called when a {@link _converse#ChatBox} has it's
     * `minimized` property set to true.
     *
     * Will trigger {@link _converse#chatBoxMinimized}
     * @private
     * @returns {_converse.ChatBoxView|_converse.ChatRoomView}
     */
    onMinimized (ev) {
        const { _converse } = this.__super__;
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        // save the scroll position to restore it on maximize
        if (this.model.collection && this.model.collection.browserStorage) {
            this.model.save({'scroll': this.content.scrollTop});
        } else {
            this.model.set({'scroll': this.content.scrollTop});
        }
        this.model.setChatState(_converse.INACTIVE);
        this.hide();
        /**
         * Triggered when a previously maximized chat gets Minimized
         * @event _converse#chatBoxMinimized
         * @type { _converse.ChatBoxView }
         * @example _converse.api.listen.on('chatBoxMinimized', view => { ... });
         */
        api.trigger('chatBoxMinimized', this);
        return this;
    },

    /**
     * Minimizes a chat box.
     * @returns {_converse.ChatBoxView|_converse.ChatRoomView}
     */
    minimize (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        this.model.minimize();
        return this;
    }
}


/**
 * Mixin object which adds support for showing minimized chats
 * @mixin
 */
export const chatTrimmer = {
    getChatBoxWidth (view) {
        if (view.model.get('id') === 'controlbox') {
            const controlbox = this.get('controlbox');
            // We return the width of the controlbox or its toggle,
            // depending on which is visible.
            if (!controlbox || !u.isVisible(controlbox.el)) {
                return u.getOuterWidth(_converse.controlboxtoggle.el, true);
            } else {
                return u.getOuterWidth(controlbox.el, true);
            }
        } else if (!view.model.get('minimized') && u.isVisible(view.el)) {
            return u.getOuterWidth(view.el, true);
        }
        return 0;
    },

    getShownChats () {
        return this.filter((view) =>
            // The controlbox can take a while to close,
            // so we need to check its state. That's why we checked
            // the 'closed' state.
            !view.model.get('minimized') &&
                !view.model.get('closed') &&
                u.isVisible(view.el)
        );
    },

    getMinimizedWidth () {
        const minimized_el = _converse.minimized_chats?.el;
        return this.model.pluck('minimized').includes(true) ? u.getOuterWidth(minimized_el, true) : 0;
    },

    getBoxesWidth (newchat) {
        const new_id = newchat ? newchat.model.get('id') : null;
        const newchat_width = newchat ? u.getOuterWidth(newchat.el, true) : 0;
        return Object.values(this.xget(new_id))
            .reduce((memo, view) => memo + this.getChatBoxWidth(view), newchat_width);
    },

    /**
     * This method is called when a newly created chat box will be shown.
     * It checks whether there is enough space on the page to show
     * another chat box. Otherwise it minimizes the oldest chat box
     * to create space.
     * @private
     * @method _converse.ChatBoxViews#trimChats
     * @param { _converse.ChatBoxView|_converse.ChatRoomView|_converse.ControlBoxView|_converse.HeadlinesBoxView } [newchat]
     */
    async trimChats (newchat) {
        if (api.settings.get('no_trimming') || !api.connection.connected() || api.settings.get("view_mode") !== 'overlayed') {
            return;
        }
        const shown_chats = this.getShownChats();
        if (shown_chats.length <= 1) {
            return;
        }
        const body_width = u.getOuterWidth(document.querySelector('body'), true);
        if (this.getChatBoxWidth(shown_chats[0]) === body_width) {
            // If the chats shown are the same width as the body,
            // then we're in responsive mode and the chats are
            // fullscreen. In this case we don't trim.
            return;
        }
        await api.waitUntil('minimizedChatsInitialized');
        const minimized_el = _converse.minimized_chats?.el;
        if (minimized_el) {
            while ((this.getMinimizedWidth() + this.getBoxesWidth(newchat)) > body_width) {
                const new_id = newchat ? newchat.model.get('id') : null;
                const oldest_chat = this.getOldestMaximizedChat([new_id]);
                if (oldest_chat) {
                    // We hide the chat immediately, because waiting
                    // for the event to fire (and letting the
                    // ChatBoxView hide it then) causes race
                    // conditions.
                    const view = this.get(oldest_chat.get('id'));
                    if (view) {
                        view.hide();
                    }
                    oldest_chat.minimize();
                } else {
                    break;
                }
            }
        }
    },

    getOldestMaximizedChat (exclude_ids) {
        // Get oldest view (if its id is not excluded)
        exclude_ids.push('controlbox');
        let i = 0;
        let model = this.model.sort().at(i);
        while (exclude_ids.includes(model.get('id')) || model.get('minimized') === true) {
            i++;
            model = this.model.at(i);
            if (!model) {
                return null;
            }
        }
        return model;
    }
}
