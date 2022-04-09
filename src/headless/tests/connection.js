/*global mock */

describe("The Converse connection object", function () {

    it("will discover alternative connection methods", mock.initConverse([], {'auto_login': false}, function (_converse) {
        const { api } = _converse;
        const ws_url = "wss://web.example.com:443/ws";
        const bosh_url = "https://web.example.com:5280/bosh";

        const response = new Response(JSON.stringify({
            "links": [{
                    "rel": "urn:xmpp:alt-connections:xbosh",
                    "href": bosh_url
                },
                {
                    "rel": "urn:xmpp:alt-connections:websocket",
                    "href": ws_url
                }
            ]
        })
        , { 'status': 200 });

        spyOn(window, 'fetch').and.returnValue(Promise.resolve(response));

        _converse.connection.discoverConnectionMethods('chat.example.org')

        expect(api.settings.get('websocket_url')).toBe(ws_url);
        expect(api.settings.get('bosh_url')).toBe(ws_url);
    }));
});
