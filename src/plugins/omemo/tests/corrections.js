/*global mock, converse */

const { omemo, u } = converse.env;

describe("An OMEMO encrypted message", function() {

    it("may be a correction of a previous message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await u.waitUntil(() => mock.initializedOMEMO(_converse));
        await mock.openChatBoxFor(_converse, contact_jid);
        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        let stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.connection.jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '555'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.omemo_store);

        const contact_devicelist = _converse.devicelists.get({'jid': contact_jid});
        await u.waitUntil(() => contact_devicelist.devices.length === 1);

        const view = _converse.chatboxviews.get(contact_jid);
        view.model.set('omemo_active', true);

        // Test reception of an encrypted message
        const first_message = 'But soft, what light through yonder airlock breaks?';
        const msg_id = u.getUniqueId();
        let obj = await omemo.encryptMessage(first_message);
        // XXX: Normally the key will be encrypted via libsignal.
        // However, we're mocking libsignal in the tests, so we include it as plaintext in the message.
        stanza = $msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': msg_id
            }).c('body').t('This is a fallback message').up()
                .c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                    .c('header', {'sid':  '555'})
                        .c('key', {'rid':  _converse.omemo_store.get('device_id')}).t(u.arrayBufferToBase64(obj.key_and_tag)).up()
                        .c('iv').t(obj.iv)
                        .up().up()
                    .c('payload').t(obj.payload);
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.querySelectorAll('.chat-msg__body')[0].textContent.trim())
            .toBe(first_message);

        // Receive a message correction
        obj = await omemo.encryptMessage('But soft, what light through yonder chimney breaks?');
        stanza = $msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': u.getUniqueId(),
            }).c('body').t('This is a fallback message').up()
                .c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                    .c('header', {'sid':  '555'})
                        .c('key', {'rid':  _converse.omemo_store.get('device_id')}).t(u.arrayBufferToBase64(obj.key_and_tag)).up()
                        .c('iv').t(obj.iv)
                        .up().up()
                    .c('payload').t(obj.payload).up().up()
                .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree();
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await new Promise(resolve => view.model.messages.once('rendered', resolve));

        expect(view.querySelector('.chat-msg__text').textContent)
            .toBe('But soft, what light through yonder chimney breaks?');
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
        expect(view.model.messages.models.length).toBe(1);
    }));
});
