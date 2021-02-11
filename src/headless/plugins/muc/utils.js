/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the MUC utilities module.
 */
import log from '../../log';
import sizzle from 'sizzle';
import { Strophe, $iq } from 'strophe.js/src/strophe';
import { _converse, api } from '../../core.js';
import { difference, indexOf } from "lodash-es";
import { getAttributes } from '@converse/headless/shared/parsers';


/**
 * Send an IQ stanza to the server asking for all groupchats
 */
export async function getMUCsForDomain (domain) {
    const iq = $iq({
        'to': domain,
        'from': _converse.connection.jid,
        'type': "get"
    }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS});
    let response;
    try {
        response = await api.sendIQ(iq);
    } catch (e) {
        log.error(e);
    }
    const rooms = response ? sizzle('query item', response) : [];
    if (rooms.length) {
        return rooms.map(getAttributes);
    } else {
        return [];
    }
}

/**
 * Send IQ stanzas to the server to set an affiliation for
 * the provided JIDs.
 * See: https://xmpp.org/extensions/xep-0045.html#modifymember
 *
 * Prosody doesn't accept multiple JIDs' affiliations
 * being set in one IQ stanza, so as a workaround we send
 * a separate stanza for each JID.
 * Related ticket: https://issues.prosody.im/345
 *
 * @param { String } muc_jid: The JID of the MUC in which to set the affiliation
 * @param { string } affiliation - The affiliation
 * @param { object } members - A map of jids, affiliations and
 *      optionally reasons. Only those entries with the
 *      same affiliation as being currently set will be considered.
 * @returns { Promise } A promise which resolves and fails depending on the XMPP server response.
 */
export function setAffiliation (muc_jid, affiliation, members) {
    members = members.filter(m => m.affiliation === undefined || m.affiliation === affiliation);
    return Promise.all(members.map(m => sendAffiliationIQ(muc_jid, affiliation, m)));
}

/**
 * Sets the given affiliation on all MUCs on the given domain.
 * This does *not* set the affiliation for future MUCs yet to be created on the
 * domain.
 * @param { String } domain
 * @param { string } affiliation - The affiliation
 * @param { object } members - A map of jids, affiliations and
 *      optionally reasons. Only those entries with the
 *      same affiliation as being currently set will be considered.
 * @returns { Promise } A promise which resolves and fails depending on the XMPP server response.
 */
export async function setAffiliationForDomain (domain, affiliation, members) {
    const mucs = await getMUCsForDomain(domain);
    return Promise.all(mucs.map(m => setAffiliation(m.jid, affiliation, members)));
}

/**
 * Send an IQ stanza specifying an affiliation change.
 * @param { String } muc_jid: The JID of the MUC to which the IQ must be sent
 * @param { String } affiliation: affiliation
 *     (could also be stored on the member object).
 * @param { Object } member: Map containing the member's jid and
 *     optionally a reason and affiliation.
 */
export function sendAffiliationIQ (muc_jid, affiliation, member) {
    const iq = $iq({ to: muc_jid, type: 'set' })
        .c('query', { xmlns: Strophe.NS.MUC_ADMIN })
        .c('item', {
            'affiliation': member.affiliation || affiliation,
            'nick': member.nick,
            'jid': member.jid
        });
    if (member.reason !== undefined) {
        iq.c('reason', member.reason);
    }
    return api.sendIQ(iq);
}

/**
 * Given two lists of objects with 'jid', 'affiliation' and
 * 'reason' properties, return a new list containing
 * those objects that are new, changed or removed
 * (depending on the 'remove_absentees' boolean).
 *
 * The affiliations for new and changed members stay the
 * same, for removed members, the affiliation is set to 'none'.
 *
 * The 'reason' property is not taken into account when
 * comparing whether affiliations have been changed.
 * @private
 * @method muc_utils#computeAffiliationsDelta
 * @param { boolean } exclude_existing - Indicates whether JIDs from
 *      the new list which are also in the old list
 *      (regardless of affiliation) should be excluded
 *      from the delta. One reason to do this
 *      would be when you want to add a JID only if it
 *      doesn't have *any* existing affiliation at all.
 * @param { boolean } remove_absentees - Indicates whether JIDs
 *      from the old list which are not in the new list
 *      should be considered removed and therefore be
 *      included in the delta with affiliation set
 *      to 'none'.
 * @param { array } new_list - Array containing the new affiliations
 * @param { array } old_list - Array containing the old affiliations
 * @returns { array }
 */
function computeAffiliationsDelta (exclude_existing, remove_absentees, new_list, old_list) {
    const new_jids = new_list.map(o => o.jid);
    const old_jids = old_list.map(o => o.jid);
    // Get the new affiliations
    let delta = difference(new_jids, old_jids).map(jid => new_list[indexOf(new_jids, jid)]);
    if (!exclude_existing) {
        // Get the changed affiliations
        delta = delta.concat(new_list.filter(item => {
            const idx = indexOf(old_jids, item.jid);
            return idx >= 0 ? (item.affiliation !== old_list[idx].affiliation) : false;
        }));
    }
    if (remove_absentees) { // Get the removed affiliations
        delta = delta.concat(difference(old_jids, new_jids).map(jid => ({'jid': jid, 'affiliation': 'none'})));
    }
    return delta;
}

/**
 * The MUC utils object. Contains utility functions related to multi-user chat.
 * @namespace muc_utils
 */
const muc_utils = {
    computeAffiliationsDelta
}

export default muc_utils;
