import { __ } from 'i18n';

export function getMarkerActorsText (jids) {
    const actors = jids.map(a => this.getOccupant(a)?.getDisplayName() || a);
    if (actors.length === 1) {
        return __('%1$s has read until here', actors[0]);
    } else if (actors.length > 1) {
        let actors_str;
        if (actors.length > 3) {
            actors_str = `${Array.from(actors)
                .slice(0, 2)
                .join(', ')} and others`;
        } else {
            const last_actor = actors.pop();
            actors_str = __('%1$s and %2$s', actors.join(', '), last_actor);
        }
        return __('%1$s have read until here', actors_str);
    }
}
