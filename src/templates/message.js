import { html } from 'lit-element';


export default (o) => html`
    <converse-chat-message
        .chatview=${o.chatview}
        .hats=${o.hats}
        .model=${o.model}
        ?allow_retry=${o.retry}
        ?correcting=${o.correcting}
        ?editable=${o.editable}
        ?has_mentions=${o.has_mentions}
        ?is_delayed=${o.is_delayed}
        ?is_encrypted=${o.is_encrypted}
        ?is_me_message=${o.is_me_message}
        ?is_only_emojis=${o.is_only_emojis}
        ?is_retracted=${o.is_retracted}
        ?is_spoiler=${o.is_spoiler}
        ?is_spoiler_visible=${o.is_spoiler_visible}
        ?retractable=${o.retractable}
        error=${o.error || ''}
        error_text=${o.error_text || ''}
        from=${o.from}
        message_type=${o.type || ''}
        moderated_by=${o.moderated_by || ''}
        moderation_reason=${o.moderation_reason || ''}
        msgid=${o.msgid}
        occupant_affiliation=${o.model.occupant ? o.model.occupant.get('affiliation') : ''}
        occupant_role=${o.model.occupant ? o.model.occupant.get('role') : ''}
        oob_url=${o.oob_url || ''}
        pretty_type=${o.pretty_type}
        progress=${o.progress || ''}
        reason=${o.reason || ''}
        received=${o.received}
        sender=${o.sender}
        spoiler_hint=${o.spoiler_hint || ''}
        subject=${o.subject || ''}
        time=${o.time}
        username=${o.username}></converse-chat-message>
`;
