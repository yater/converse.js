/**
 * @module converse-minimize
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "converse-chatview";
import { MinimizedChats } from './views.js';
import { __ } from '@converse/headless/i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";
import { chatTrimmer, minimizableChatBox, minimizableChatBoxView } from './mixins.js';
import { debounce } from 'lodash-es';

const { dayjs } = converse.env;


function initMinimizedChats () {
    _converse.minimized_chats?.remove();
    _converse.minimized_chats = new MinimizedChats({model: _converse.chatboxes});
    /**
     * Triggered once the _converse.MinimizedChats instance has been initialized
     * @event _converse#minimizedChatsInitialized
     * @example _converse.api.listen.on('minimizedChatsInitialized', () => { ... });
     */
    api.trigger('minimizedChatsInitialized');
}

function addMinimizeButtonToChat (view, buttons) {
    const data = {
        'a_class': 'toggle-chatbox-button',
        'handler': ev => view.minimize(ev),
        'i18n_text': __('Minimize'),
        'i18n_title': __('Minimize this chat'),
        'icon_class': "fa-minus",
        'name': 'minimize',
        'standalone': _converse.api.settings.get("view_mode") === 'overlayed'
    }
    const names = buttons.map(t => t.name);
    const idx = names.indexOf('close');
    return idx > -1 ? [...buttons.slice(0, idx), data, ...buttons.slice(idx)] : [data, ...buttons];
}

function addMinimizeButtonToMUC (view, buttons) {
    const data = {
        'a_class': 'toggle-chatbox-button',
        'handler': ev => view.minimize(ev),
        'i18n_text': __('Minimize'),
        'i18n_title': __('Minimize this groupchat'),
        'icon_class': "fa-minus",
        'name': 'minimize',
        'standalone': _converse.api.settings.get("view_mode") === 'overlayed'
    }
    const names = buttons.map(t => t.name);
    const idx = names.indexOf('signout');
    return idx > -1 ? [...buttons.slice(0, idx), data, ...buttons.slice(idx)] : [data, ...buttons];
}


converse.plugins.add('converse-minimize', {
    /* Optional dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin. They are called "optional" because they might not be
     * available, in which case any overrides applicable to them will be
     * ignored.
     *
     * It's possible however to make optional dependencies non-optional.
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: [
        "converse-chatview",
        "converse-controlbox",
        "converse-muc-views",
        "converse-headlines-view",
        "converse-dragresize"
    ],

    enabled (_converse) {
        return _converse.api.settings.get("view_mode") === 'overlayed';
    },

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // New functions which don't exist yet can also be added.

        ChatBox: {
            initialize () {
                this.__super__.initialize.apply(this, arguments);
                this.on('show', this.maximize, this);

                if (this.get('id') === 'controlbox') {
                    return;
                }
                this.save({
                    'minimized': this.get('minimized') || false,
                    'time_minimized': this.get('time_minimized') || dayjs(),
                });
            },

            maybeShow (force) {
                if (!force && this.get('minimized')) {
                    // Must return the chatbox
                    return this;
                }
                return this.__super__.maybeShow.apply(this, arguments);
            }
        },

        ChatBoxView: {
            show () {
                const { _converse } = this.__super__;
                if (_converse.api.settings.get("view_mode") === 'overlayed' && this.model.get('minimized')) {
                    this.model.minimize();
                    return this;
                } else {
                    return this.__super__.show.apply(this, arguments);
                }
            },

            isNewMessageHidden () {
                return this.model.get('minimized') ||
                    this.__super__.isNewMessageHidden.apply(this, arguments);
            },

            shouldShowOnTextMessage () {
                return !this.model.get('minimized') &&
                    this.__super__.shouldShowOnTextMessage.apply(this, arguments);
            },

            setChatBoxHeight (height) {
                if (!this.model.get('minimized')) {
                    return this.__super__.setChatBoxHeight.call(this, height);
                }
            },

            setChatBoxWidth (width) {
                if (!this.model.get('minimized')) {
                    return this.__super__.setChatBoxWidth.call(this, width);
                }
            }
        }
    },


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */

        api.settings.extend({'no_trimming': false});
        api.promises.add('minimizedChatsInitialized');

        Object.assign(_converse.ChatBox.prototype, minimizableChatBox);
        Object.assign(_converse.ChatBoxView.prototype, minimizableChatBoxView);
        Object.assign(_converse.ChatBoxViews.prototype, chatTrimmer);

        /************************ BEGIN Event Handlers ************************/
        api.listen.on('chatBoxInsertedIntoDOM', view => _converse.chatboxviews.trimChats(view));
        api.listen.on('connected', () => initMinimizedChats());
        api.listen.on('controlBoxOpened', view => _converse.chatboxviews.trimChats(view));
        api.listen.on('chatBoxViewInitialized', v => v.listenTo(v.model, 'change:minimized', v.onMinimizedChanged));

        api.listen.on('chatRoomViewInitialized', view => {
            view.listenTo(view.model, 'change:minimized', view.onMinimizedChanged)
            view.model.get('minimized') && view.hide();
        });

        api.listen.on('getHeadingButtons', (view, buttons) => {
            if (view.model.get('type') === _converse.CHATROOMS_TYPE) {
                return addMinimizeButtonToMUC(view, buttons);
            } else {
                return addMinimizeButtonToChat(view, buttons);
            }
        });

        const debouncedTrimChats = debounce(() => _converse.chatboxviews.trimChats(), 250);
        api.listen.on('registeredGlobalEventHandlers', () => window.addEventListener("resize", debouncedTrimChats));
        api.listen.on('unregisteredGlobalEventHandlers', () => window.removeEventListener("resize", debouncedTrimChats));
        /************************ END Event Handlers ************************/
    }
});
