import ChatMarker from './marker.js';
import log from '@converse/headless/log';
import { MARKER_TYPES } from './constants.js';
import { _converse, api, converse } from '@converse/headless/core.js';
import { getOpenPromise } from '@converse/openpromise';
import { initStorage } from '@converse/headless/utils/storage.js';
import { isIntermediateMAMMessage } from '@converse/headless/plugins/mam/utils.js';

const { $msg, Strophe, u } = converse.env;

export function getMessageIdToMark (message) {
    if (message.get('type') === 'groupchat') {
        const muc_jid = Strophe.getBareJidFromJid(message.get('from'));
        return message.get(`stanza_id ${muc_jid}`) || message.get('msgid');
    }
    return message.get('msgid');
}

/**
 * Given a message being marked by a particular JID, add (or update) a
 * ChatMarker message.
 *
 * See [XEP-0333](https://xmpp.org/extensions/xep-0333.html)
 *
 * @param { _converse.ChatBox | _converse.ChatRoom } chat
 * @param { _converse.Message } message - The message being marked
 * @param { String } by_jid - The JID of the user who sent a marker
 * @param { ('received'|'displayed'|'acknowledged') } type - The type of chat marker being added
 * @returns { ChatMarker }
 */
export function addChatMarker (chat, message, by_jid, type='received') {
    if (chat.get('type') === _converse.CHATROOMS_TYPE) {
        if (
            by_jid !== _converse.bare_jid &&
            chat.occupants.length > api.settings.get('muc_chat_markers_limit')
        ) {
            // Clear the existing markers, otrherwise we might get orphaned
            // ChatMarker instances in the chat, since new markers won't be
            // created to invalidate the old ones.
            chat.markers.clearStore();
            return;
        }
    }

    if (!Object.keys(MARKER_TYPES).includes(type)) {
        throw new TypeError('Invalid XEP-0333 chat marker type');
    }

    const marked_message_id = getMessageIdToMark(message);
    const marked = chat.markers.get(marked_message_id);
    const marked_entry = {};
    marked_entry[by_jid] = type;

    if (marked) {
        const marked_by = Object.assign(marked.get('marked_by') || {}, marked_entry);
        marked.save({ marked_by });
        return marked;
    } else {
        // Update (and potentially remove) existing markers to remove `by_jid`
        const predicate = m => m instanceof ChatMarker && m.get('marked_by')?.[by_jid];
        chat.markers.findWhere(predicate)?.removeMarkerJID(by_jid);
        const marker_data = {
            'id': marked_message_id,
            'marked_by': marked_entry,
            'time': message.get('time')
        }
        return chat.markers.add(new ChatMarker(marker_data));
    }
}


/**
 * Check wether a given message was sent before the latest marker, in which
 * case it's considered already marked.
 * @param { (_converse.ChatBox|_converse.ChatRoom) } chat
 * @param { _converse.Message } message
 * @returns { Boolean }
 */
function isAlreadyMarked (chat, message) {
    const marker = chat.markers.find(m => Object.keys(m.get('marked_by')).includes(_converse.bare_jid));
    return !!(marker && (message.get('time') <= marker.get('time')));
}


/**
 * Send out a XEP-0333 chat marker
 * @param { String } to_jid
 * @param { String } id - The id of the message being marked
 * @param { String } type - The marker type
 * @param { String } msg_type
 */
export function sendChatMarker (to_jid, id, type, msg_type) {
    if (!id) {
        log.warn("Won't send out a chat marker if we don't have a valid id attribute");
        return
    }
    const stanza = $msg({
        'from': _converse.connection.jid,
        'id': u.getUniqueId(),
        'to': to_jid,
        'type': msg_type ? msg_type : 'chat'
    }).c(type, {'xmlns': Strophe.NS.MARKERS, id });
    api.send(stanza);
}


/**
 * Finds the last eligible message and then sends a XEP-0333 chat marker for it.
 * @param { (_converse.ChatBox|_converse.ChatRoom) } chat
 * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
 * @param { Boolean } [force=false] - Whether a marker should be sent for the
 *  message, even if it didn't include a `markable` element.
 */
export function sendMarkerForLastMessage (chat, type='received', force=false) {
    const msgs = Array.from(chat.messages.models);
    msgs.reverse();
    const msg = msgs.find(m => force || m.get('is_markable'));
    if (!msg) {
        return;
    }
    if (isAlreadyMarked(chat, msg)) {
        return;
    }
    if (msg.get('type') === 'groupchat') {
        sendMarkerForMUCMessage(chat, msg, type) && addChatMarker(chat, msg, _converse.bare_jid);
    } else {
        sendMarkerForMessage(msg, type, force) && addChatMarker(chat, msg, _converse.bare_jid);
    }
}


/**
 * Given the passed in message object, send a XEP-0333 chat marker if appropriate.
 * @param { _converse.Message } msg
 * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
 * @param { Boolean } [force=false] - Whether a marker should be sent for the
 *  message, even if it didn't include a `markable` element.
 * @returns { Boolean } Returns `true` or `false` depending on whether the
 *  marker was actually sent out.
 */
export function sendMarkerForMessage (msg, type='received', force=false) {
    if (!msg || !api.settings.get('send_chat_markers').includes(type)) {
        return false;
    }
    if (msg?.get('is_markable') || force) {
        const from_jid = Strophe.getBareJidFromJid(msg.get('from'));
        sendChatMarker(from_jid, msg.get('msgid'), type, msg.get('type'));
        const field_name = `marked_${type}`;
        const marked = msg.get(field_name) || [];
        msg.save({field_name: [...marked, _converse.bare_jid]});
        return true;
    }
    return false;
}

/**
 * Given the passed in MUC message, send a XEP-0333 chat marker if appropriate.
 * @param { _converse.MUCMessage } msg
 * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
 * @returns { Boolean } Returns `true` or `false` depending on whether the
 *  marker was actually sent out.
 */
export function sendMarkerForMUCMessage (chat, msg, type='received') {
    if (!Object.keys(MARKER_TYPES).includes(type)) {
        throw new TypeError('Invalid XEP-0333 chat marker type');
    }

    if (!msg || !api.settings.get('send_chat_markers').includes(type)) {
        return false;
    }
    if (msg?.get('is_markable')) {
        const mid = getMessageIdToMark(msg);
        if (chat.markers.get(mid)?.get('marked_by')?.[_converse.bare_jid] ?? -1 > MARKER_TYPES[type]) {
            // Already marked, either by the same marker value or by a higher ranked one.
            // https://xmpp.org/extensions/xep-0333.html#format
            return false;
        }

        // FIXME: first check whether XEP-0359 is supported, otherwise
        // <stanza-id> elements from the MUC must be considered as spoofed
        const key = `stanza_id ${chat.get('jid')}`;
        const id = msg.get(key);
        // https://xmpp.org/extensions/xep-0333.html#rules-muc
        if (!id) {
            log.error(`Can't send marker for message without stanza ID: ${key}`);
            return false;
        }
        const from_jid = Strophe.getBareJidFromJid(msg.get('from'));
        sendChatMarker(from_jid, id, type, msg.get('type'));
        return true;
    }
    return false;
}


/**
 * Given a new unread message in a chat, see whether we should send out a chat
 * marker for it.
 * @param { (_converse.ChatBox|_converse.ChatRoom) } chat
 * @param { _converse.Message } message
 */
export function handleUnreadMessage (chat, message) {
    if (!message || !message?.get('body') || isIntermediateMAMMessage(message) || isAlreadyMarked(chat, message)) {
        return
    }
    const type = chat.isHidden() ? 'received' : 'displayed';
    if (message.get('type') === 'groupchat') {
        sendMarkerForMUCMessage(chat, message, type) && addChatMarker(chat, message, _converse.bare_jid);
    } else {
        sendMarkerForMessage(message, type) && addChatMarker(chat, message, _converse.bare_jid);
    }
}


function getMarkerIdKey (chat) {
    if (chat.get('type') === _converse.CHATROOMS_TYPE) {
        return `stanza_id ${chat.get('jid')}`;
    } else {
        return 'msgid';
    }
}

/**
 * A {@link _converse.Marker} has a `marked_by` field which stores a mapping of
 * JIDs to marker values ('received', 'displayed', 'acknowledged').
 * This function is used to get the JID used as lookup key in the mapping.
 *
 * If the person marking is the current user, then we always want to store the
 * bare real JID, regardless of whether the context is a MUC or a 1:1 chat.
 * This is to faciliate easier lookups (see {@link isAlreadyMarked} and because
 * (relevant to 1:1 chats), the full JID's resource is not permanent, and can
 * change over sessions.
 *
 * For other persons marking, we store the bare JID in 1:1 chats and the MUC
 * JID for MUCs.
 *
 * @param { (_converse.ChatBox|_converse.ChatRoom) } chat
 * @param { MessageAttributes } attrs
 * @returns { String }
 */
function getMarkerJID (chat, attrs) {
    if (chat.get('type') === _converse.CHATROOMS_TYPE) {
        const own_muc_jid = `${chat.get('jid')}/${chat.getOwnOccupant().get('nick')}`;
        if (own_muc_jid === attrs.from) {
            // For easier lookup, we always use our real bare jid, even in MUCs
            return _converse.bare_jid;
        } else {
            // For other MUC users, we use their MUC jid
            return attrs.from;
        }
    } else {
        // For 1:1, we store the bare JID, to simplify lookups and since
        // resources aren't permanent
        return Strophe.getBareJidFromJid(attrs.from);
    }
}


/**
 * Given an incoming message's attributes, check whether its a chat marker, and
 * if so, create a {@link _converse.ChatMarker}.
 * @param { MessageAttributes } attrs
 * @returns { Boolean } Returns `true` if the attributes are from a marker, and `false` otherwise.
 */
export function handleChatMarker (data, handled) {
    const { attrs, model } = data;
    if (!attrs.is_marker) {
        return handled;
    }
    const key = getMarkerIdKey(model);
    const message = model.messages.models.find(m => m.get(key) === attrs.marker_id);
    if (!message || isAlreadyMarked(model, message)) {
        return handled;
    }
    const by_jid = getMarkerJID(model, attrs);
    addChatMarker(model, message, by_jid, attrs.marked)
    return true;
}


/**
 * Handler for the `messageUpdate` event. The point here is to send a marker
 * once we receive a reflected MUC message.
 *
 * The `muc_send_markers_for_own_messages` setting determines whether a marker
 * will be sent out.
 *
 * We send chat markers for our own sent messages to prevent Prosody's
 * mod_muc_rai (which implements XEP-0437 Room Activity Indicators) from
 * sending activity indicators for our own messages.
 *
 * @param { _converse.ChatRoom } chat
 * @param { _converse.Message } message
 */
export function onMessageUpdated (chat, message) {
    if (chat.get('type') !== _converse.CHATROOMS_TYPE ||
            (message.get('sender') === 'me' && !api.settings.get('muc_send_markers_for_own_messages')) ||
            isAlreadyMarked(chat, message)) {
        return;
    }
    const type = chat.isHidden() ? 'received' : 'displayed';
    sendMarkerForMUCMessage(chat, message, type) && addChatMarker(chat, message, _converse.bare_jid);
}


export function onUnreadsCleared (chat) {
    const type = chat.isHidden() ? 'received' : 'displayed';
    if (chat.get('type') === _converse.CHATROOMS_TYPE) {
        if (chat.get('num_unread_general') > 0 || chat.get('num_unread') > 0 || chat.get('has_activity')) {
            sendMarkerForLastMessage(chat, type);
        }
    } else {
        if (chat.get('num_unread') > 0) {
            sendMarkerForLastMessage(chat, type);
        }
    }
}

/**
 * Creates a ChatMarkers collection, set it on the chat and fetch any cached markers
 * @param { (_converse.ChatBox|_converse.ChatRoom) }
 */
export function initChatMarkers (model) {
    model.markers = new _converse.ChatMarkers();
    const id = `converse.markers-${model.get('jid')}`;
    initStorage(model.markers, id);
    model.markers.fetched = getOpenPromise();
    const resolve = model.markers.fetched.resolve;
    model.markers.fetch({
        'add': true,
        'success':  resolve,
        'error': resolve
    });
}
