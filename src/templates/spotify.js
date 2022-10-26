import { html } from 'lit';

export default (song_id, url, hide_url) => {
    return html`<iframe
        style="border-radius:12px"
        src="https://open.spotify.com/embed/track/${song_id}"
        width="100%"
        height="352"
        frameBorder="0"
        allowfullscreen=""
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>

        ${ hide_url ? '' : html`<a target="_blank" rel="noopener" href="${url}">${url}</a>` }
    `;
}
