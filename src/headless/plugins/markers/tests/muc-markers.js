/*global mock, converse */

const { Strophe, dayjs, u } = converse.env;

describe("A XEP-0333 Chat Marker", function () {

    it("may be sent along with a sent groupchat message",
            mock.initConverse([], {'muc_send_markers_for_own_messages': true},
            async function (_converse) {

        const base_time = new Date();
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const model = _converse.chatboxes.get(muc_jid);
        const message = await model.sendMessage({'body': 'Hello world'});
        const reflection_stanza = u.toStanza(`
            <message xmlns="jabber:client"
                    from="${message.get('from')}"
                    to="${_converse.connection.jid}"
                    id="${_converse.connection.getUniqueId()}"
                    type="groupchat">
                <body>${message.get('message')}</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                        id="reflected-message"
                        by="lounge@montague.lit"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="${message.get('origin_id')}"/>
            </message>`);

        await model.handleMessageStanza(reflection_stanza);

        const sent_stanzas = _converse.connection.sent_stanzas;
        await u.waitUntil(() => sent_stanzas.filter(iq => iq.matches('message')).length === 2);

        const messages = sent_stanzas.filter(iq => iq.matches('message'));
        expect(Strophe.serialize(messages[0])).toBe(
            `<message from="${_converse.jid}" id="${message.get('id')}" to="${muc_jid}" type="groupchat" xmlns="jabber:client">`+
                `<body>Hello world</body>`+
                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                `<origin-id id="${message.get('id')}" xmlns="urn:xmpp:sid:0"/>`+
            `</message>`
        );
        expect(Strophe.serialize(messages[1])).toBe(
            `<message from="${_converse.jid}" id="${messages[1].getAttribute('id')}" to="${muc_jid}" type="groupchat" xmlns="jabber:client">`+
                `<displayed id="reflected-message" xmlns="urn:xmpp:chat-markers:0"/>`+
            `</message>`);

        expect(model.markers.length).toBe(1);

        const o = {};
        o[_converse.bare_jid] = 'received';
        expect(model.markers.at(0).get('marked_by')).toEqual(o);

        model.save({'hidden': true});

        // Receive a delayed older message, which sets the unread counters.
        const id = _converse.connection.getUniqueId();
        const stanza = u.toStanza(`
            <message xmlns="jabber:client"
                    from="${muc_jid}/juliet"
                    to="${_converse.jid}"
                    id="${id}"
                    type="groupchat">
                <body>Hello</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                        id="new-message"
                        by="lounge@montague.lit"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="${id}"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
                <delay xmlns="urn:xmpp:delay" stamp="${dayjs(base_time).subtract(5, 'minutes').toISOString()}"/>
            </message>`);
        await model.handleMessageStanza(stanza);
        await u.waitUntil(() => model.get('num_unread_general'));

        // When 'hidden' is set to false on the chat, the counters get
        // cleared and normally a chat marker gets sent out, but this
        // time it shouldn't because the latest message is already read.
        model.save({'hidden': false});

        const p = u.getOpenPromise();
        setTimeout(() => {
            expect(sent_stanzas.filter(s => s.matches('message')).length).toBe(2);
            p.resolve();
        }, 500);
        return p;
    }));


    it("will be sent out for the last MAM message",
        mock.initConverse(
            [], {
                'allow_bookmarks': false, // Hack to get the rooms list to render
                'view_mode': 'fullscreen'},
            async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const sent_IQs = _converse.connection.IQ_stanzas;
        const iq = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());

        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        const first_msg_id = _converse.connection.getUniqueId();
        const last_msg_id = _converse.connection.getUniqueId();
        let message = u.toStanza(
            `<message xmlns="jabber:client"
                    to="romeo@montague.lit/orchard"
                    from="${muc_jid}">
                <result xmlns="urn:xmpp:mam:2" queryid="${iq.querySelector('query').getAttribute('queryid')}" id="${first_msg_id}">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2021-01-09T06:15:23Z"/>
                        <message from="${muc_jid}/some1" type="groupchat">
                            <body>1st MAM Message</body>
                            <markable xmlns="urn:xmpp:chat-markers:0"></markable>
                        </message>
                    </forwarded>
                </result>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message));

        message = u.toStanza(
            `<message xmlns="jabber:client"
                    to="romeo@montague.lit/orchard"
                    from="${muc_jid}">
                <result xmlns="urn:xmpp:mam:2" queryid="${iq.querySelector('query').getAttribute('queryid')}" id="${last_msg_id}">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2021-01-09T06:16:23Z"/>
                        <message from="${muc_jid}/some1" type="groupchat">
                            <body>2nd MAM Message</body>
                            <markable xmlns="urn:xmpp:chat-markers:0"></markable>
                        </message>
                    </forwarded>
                </result>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message));

        const result = u.toStanza(
            `<iq type='result' id='${iq.getAttribute('id')}'>
                <fin xmlns='urn:xmpp:mam:2'>
                    <set xmlns='http://jabber.org/protocol/rsm'>
                        <first index='0'>${first_msg_id}</first>
                        <last>${last_msg_id}</last>
                        <count>2</count>
                    </set>
                </fin>
            </iq>`);
        _converse.connection._dataRecv(mock.createRequest(result));
        await u.waitUntil(() => model.messages.length === 2);
        await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'message').length === 1);
        expect(Strophe.serialize(sent_stanzas[0])).toBe(
            `<message from="${_converse.jid}" id="${sent_stanzas[0].getAttribute('id')}" to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">`+
                `<displayed id="${last_msg_id}" xmlns="urn:xmpp:chat-markers:0"/>`+
            `</message>`
        );
    }));


    fit("may be restored from a MAM message",
        mock.initConverse(
            [], {
                'allow_bookmarks': false, // Hack to get the rooms list to render
                'view_mode': 'fullscreen'},
            async function (_converse) {

        const nickname = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, nickname);
        const sent_IQs = _converse.connection.IQ_stanzas;
        const iq = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());

        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        const first_msg_id = u.getUniqueId();
        const last_msg_id = u.getUniqueId();
        const marker_id = u.getUniqueId();
        let message = u.toStanza(
            `<message xmlns="jabber:client"
                    to="romeo@montague.lit/orchard"
                    from="${muc_jid}">
                <result xmlns="urn:xmpp:mam:2" queryid="${iq.querySelector('query').getAttribute('queryid')}" id="${first_msg_id}">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2021-01-09T06:15:23Z"/>
                        <message from="${muc_jid}/some1" type="groupchat">
                            <body>1st MAM Message</body>
                            <markable xmlns="urn:xmpp:chat-markers:0"></markable>
                        </message>
                    </forwarded>
                </result>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message));

        message = u.toStanza(
            `<message xmlns="jabber:client"
                    to="romeo@montague.lit/orchard"
                    from="${muc_jid}">
                <result xmlns="urn:xmpp:mam:2" queryid="${iq.querySelector('query').getAttribute('queryid')}" id="${last_msg_id}">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2021-01-09T06:16:23Z"/>
                        <message from="${muc_jid}/some1" type="groupchat">
                            <body>2nd MAM Message</body>
                            <markable xmlns="urn:xmpp:chat-markers:0"></markable>
                        </message>
                    </forwarded>
                </result>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message));

        message = u.toStanza(
            `<message xmlns="jabber:client"
                    to="${_converse.jid}"
                    from="${muc_jid}">
                <result xmlns="urn:xmpp:mam:2" queryid="${iq.querySelector('query').getAttribute('queryid')}" id="${marker_id}">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2021-01-09T06:16:29Z"/>
                        <message from="${muc_jid}/${nickname}" type="groupchat">
                            <displayed id="${last_msg_id}" xmlns="urn:xmpp:chat-markers:0"/>
                        </message>
                    </forwarded>
                </result>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message));

        const result = u.toStanza(
            `<iq type='result' id='${iq.getAttribute('id')}'>
                <fin xmlns='urn:xmpp:mam:2'>
                    <set xmlns='http://jabber.org/protocol/rsm'>
                        <first index='0'>${first_msg_id}</first>
                        <last>${marker_id}</last>
                        <count>3</count>
                    </set>
                </fin>
            </iq>`);
        _converse.connection._dataRecv(mock.createRequest(result));
        await u.waitUntil(() => model.messages.length === 2);

        expect(sent_stanzas.filter(s => s.nodeName === 'message').length).toBe(0);
        expect(model.markers.length).toBe(1);
        const marker = model.markers.at(0);
        const data = {};
        data[_converse.bare_jid] = 'displayed';
        expect(marker.get('marked_by')).toEqual(data);
        expect(marker.get('time')).toBe('2021-01-09T06:16:23.000Z'); // Needs to be same as <delay>

        // Receive a delayed older message and check that a marker isn't sent out for it
        const id = _converse.connection.getUniqueId();
        const stanza = u.toStanza(`
            <message xmlns="jabber:client"
                    from="${muc_jid}/juliet"
                    to="${_converse.jid}"
                    id="${id}"
                    type="groupchat">
                <body>Hello</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                        id="new-message"
                        by="lounge@montague.lit"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="${id}"/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
                <delay xmlns="urn:xmpp:delay" stamp="2021-01-09T06:10:29Z"/>
            </message>`);
        await model.handleMessageStanza(stanza);

        const p = u.getOpenPromise();
        setTimeout(() => {
            expect(model.markers.length).toBe(1);
            p.resolve();
        }, 500);
        return p;
    }));
});
