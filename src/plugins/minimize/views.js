import tpl_chats_panel from "./templates/chats_panel.js";
import tpl_toggle_chats from "./templates/toggle_chats.js";
import tpl_trimmed_chat from "./templates/trimmed_chat.js";
import { Model } from '@converse/skeletor/src/model.js';
import { Overview } from "@converse/skeletor/src/overview";
import { View } from "@converse/skeletor/src/view";
import { _converse, api, converse } from "@converse/headless/converse-core";
import { render } from 'lit-html';
import { debounce, sum } from 'lodash-es';

const u = converse.env.utils;


_converse.MinimizedChatBoxView = View.extend({
    tagName: 'div',
    events: {
        'click .close-chatbox-button': 'close',
        'click .restore-chat': 'restore'
    },

    initialize () {
        this.listenTo(this.model, 'change:num_unread', this.render)
        this.listenTo(this.model, 'change:name', this.render)
        this.listenTo(this.model, 'change:fullname', this.render)
        this.listenTo(this.model, 'change:jid', this.render)
        this.listenTo(this.model, 'destroy', this.remove)
        /**
         * Triggered once a {@link _converse.MinimizedChatBoxView } has been initialized
         * @event _converse#minimizedChatViewInitialized
         * @type { _converse.MinimizedChatBoxView }
         * @example _converse.api.listen.on('minimizedChatViewInitialized', view => { ... });
         */
        api.trigger('minimizedChatViewInitialized', this);
    },

    render () {
        const data = Object.assign(this.model.toJSON(), {'title': this.model.getDisplayName()});
        render(tpl_trimmed_chat(data), this.el);
        return this.el;
    },

    close (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        this.remove();
        const view = _converse.chatboxviews.get(this.model.get('id'));
        if (view) {
            // This will call model.destroy(), removing it from the
            // collection and will also emit 'chatBoxClosed'
            view.close();
        } else {
            this.model.destroy();
            api.trigger('chatBoxClosed', this);
        }
        return this;
    },

    restore: debounce(function (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        this.model.off('change:num_unread', null, this);
        this.remove();
        this.model.maximize();
    }, 200, {'leading': true})
});


_converse.MinimizedChatsToggle = Model.extend({
    defaults: {
        'collapsed': false,
        'num_minimized': 0,
        'num_unread':  0
    }
});


export const MinimizedChats = _converse.MinimizedChats = Overview.extend({
    tagName: 'div',
    id: "minimized-chats",
    className: 'hidden',
    events: {
        "click #toggle-minimized-chats": "toggle"
    },

    async initialize () {
        this.render();
        await this.initToggle();
        const chats = this.model.where({'minimized': true});
        chats.length && this.addMultipleChats(chats);
        this.listenTo(this.model, "add", this.onChanged)
        this.listenTo(this.model, "destroy", this.removeChat)
        this.listenTo(this.model, "change:minimized", this.onChanged)
        this.listenTo(this.model, 'change:num_unread', this.updateUnreadMessagesCounter)
    },

    render () {
        if (!this.el.parentElement) {
            render(tpl_chats_panel(), this.el);
            _converse.chatboxviews.insertRowColumn(this.el);
        }
        if (this.keys().length === 0) {
            this.el.classList.add('hidden');
        } else if (this.keys().length > 0 && !u.isVisible(this.el)) {
            this.el.classList.remove('hidden');
        }
        return this.el;
    },

    async initToggle () {
        const id = `converse.minchatstoggle-${_converse.bare_jid}`;
        const model = new _converse.MinimizedChatsToggle({id});
        model.browserStorage = _converse.createStore(id);
        await new Promise(resolve => model.fetch({'success': resolve, 'error': resolve}));
        this.toggleview = new _converse.MinimizedChatsToggleView({model});
    },

    toggle (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        this.toggleview.model.save({'collapsed': !this.toggleview.model.get('collapsed')});
        u.slideToggleElement(this.el.querySelector('.minimized-chats-flyout'), 200);
    },

    onChanged (item) {
        if (item.get('id') === 'controlbox')  {
            // The ControlBox has it's own minimize toggle
            return;
        }
        if (item.get('minimized')) {
            this.addChat(item);
        } else if (this.get(item.get('id'))) {
            this.removeChat(item);
        }
    },

    addChatView (item) {
        const existing = this.get(item.get('id'));
        if (existing && existing.el.parentNode) {
            return;
        }
        const view = new _converse.MinimizedChatBoxView({model: item});
        this.el.querySelector('.minimized-chats-flyout').insertAdjacentElement('beforeEnd', view.render());
        this.add(item.get('id'), view);
    },

    addMultipleChats (items) {
        items.forEach(item => this.addChatView(item));
        this.toggleview.model.set({'num_minimized': this.keys().length});
        this.render();
    },

    addChat (item) {
        this.addChatView(item);
        this.toggleview.model.set({'num_minimized': this.keys().length});
        this.render();
    },

    removeChat (item) {
        this.remove(item.get('id'));
        this.toggleview.model.set({'num_minimized': this.keys().length});
        this.render();
    },

    updateUnreadMessagesCounter () {
        this.toggleview.model.save({'num_unread': sum(this.model.pluck('num_unread'))});
        this.render();
    }
});


_converse.MinimizedChatsToggleView = View.extend({
    _setElement (){
        this.el = _converse.root.querySelector('#toggle-minimized-chats');
    },

    initialize () {
        this.listenTo(this.model, 'change:num_minimized', this.render)
        this.listenTo(this.model, 'change:num_unread', this.render)
        this.flyout = this.el.parentElement.querySelector('.minimized-chats-flyout');
    },

    render () {
        render(tpl_toggle_chats(Object.assign(this.model.toJSON())), this.el);

        if (this.model.get('collapsed')) {
            u.hideElement(this.flyout);
        } else {
            u.showElement(this.flyout);
        }
        return this.el;
    }
});
