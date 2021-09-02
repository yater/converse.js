/*global mock, converse */

const {  u } = converse.env;

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

});
