/*global mock, converse */

const { Strophe, u } = converse.env;

describe("A XEP-0333 Chat Marker", function () {

    it("will not be sent along with a sent 1:1 message",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)

        const model = _converse.chatboxes.get(contact_jid);
        const message = 'This message is sent from this chatbox';
        await model.sendMessage({'body': message});

        const sent_stanzas = _converse.connection.sent_stanzas;
        const p = u.getOpenPromise();
        setTimeout(() => {
            expect(sent_stanzas.filter(m => m.matches('message')).length).toBe(2);
            p.resolve();
        }, 500);
        return p;

    }));

    it("is sent when a markable message is received from a roster contact",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const model = _converse.chatboxes.get(contact_jid);

        // When the chat is hidden, a <received> marker is sent out
        model.set('hidden', true);
        let msgid = u.getUniqueId();
        let stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${msgid}'
                type="chat"
                to='${_converse.jid}'>
              <body>My lord, dispatch; read o'er these articles.</body>
              <markable xmlns='urn:xmpp:chat-markers:0'/>
            </message>`);

        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => sent_stanzas.length === 1);
        expect(Strophe.serialize(sent_stanzas[0])).toBe(
            `<message from="romeo@montague.lit/orchard" `+
                    `id="${sent_stanzas[0].getAttribute('id')}" `+
                    `to="${contact_jid}" type="chat" xmlns="jabber:client">`+
            `<received id="${msgid}" xmlns="urn:xmpp:chat-markers:0"/>`+
            `</message>`);

        // When the chat is not hidden, a <displayed> marker is sent out
        model.set('hidden', false);
        msgid = u.getUniqueId();
        stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${msgid}'
                type="chat"
                to='${_converse.jid}'>
              <body>My lord, dispatch; read o'er these articles.</body>
              <markable xmlns='urn:xmpp:chat-markers:0'/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => sent_stanzas.length === 2);
        expect(Strophe.serialize(sent_stanzas[1])).toBe(
            `<message from="romeo@montague.lit/orchard" `+
                    `id="${sent_stanzas[1].getAttribute('id')}" `+
                    `to="${contact_jid}" type="chat" xmlns="jabber:client">`+
            `<displayed id="${msgid}" xmlns="urn:xmpp:chat-markers:0"/>`+
            `</message>`);
    }));


    it("is not sent when a markable message is received from someone not on the roster",
            mock.initConverse([], {'allow_non_roster_messaging': true}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        const contact_jid = 'someone@montague.lit';
        const msgid = u.getUniqueId();
        const stanza = u.toStanza(`
            <message from='${contact_jid}'
                id='${msgid}'
                type="chat"
                to='${_converse.jid}'>
              <body>My lord, dispatch; read o'er these articles.</body>
              <markable xmlns='urn:xmpp:chat-markers:0'/>
            </message>`);

        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s));
        await _converse.handleMessageStanza(stanza);
        const sent_messages = sent_stanzas
            .map(s => s?.nodeTree ?? s)
            .filter(e => e.nodeName === 'message');

        await u.waitUntil(() => sent_messages.length === 2);
        expect(Strophe.serialize(sent_messages[0])).toBe(
            `<message id="${sent_messages[0].getAttribute('id')}" to="${contact_jid}" type="chat" xmlns="jabber:client">`+
                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                `<no-store xmlns="urn:xmpp:hints"/>`+
                `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
            `</message>`
        );
    }));
});
