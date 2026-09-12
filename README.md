# Baseline Planning Suite

## Run

    docker compose up

Open http://localhost:8080. No Node needed on the host -- everything builds and runs in containers.

People and Delivery also run standalone, on their own build, with no Shell around them:

- People: http://localhost:8081
- Delivery: http://localhost:8082

Edits persist in a Docker volume, not just the browser tab. To reset back to the seed data:

    docker compose down -v
    docker compose up

## Break a remote on purpose

    docker compose stop people
    docker compose stop delivery

Then open (or switch to) that tab in Shell. Shell stays up and shows a fallback panel in place of it:

> "people" is unavailable right now.
> The rest of the suite is unaffected. This is expected if that container is stopped or unreachable -- try again shortly, or check `docker compose logs people`.

Bring it back with `docker compose start people`, then hit Retry in the panel.

## Tests

    cd domain
    npm install
    npm test

`domain` is the only package with tests -- it's the only one that's pure calculation logic with no
browser or server involved, which is what the brief asks to see tested. `api`, `people`, `delivery`
and `shell` have no `test` script.

## Repo map

    domain/    pure calculation logic (rates, units, rounding, roll-up) -- no browser, no server
    api/       one small server: seed data, REST endpoints, SSE for live updates
    people/    remote: employee register + rate history
    delivery/  remote: work breakdown + staffing grid
    shell/     host app: navigation, display currency, active user, loads people/delivery at runtime

`people` and `delivery` both depend on `domain` but never on each other or on `shell`. `shell` never
imports either remote's source -- it only loads their built `remoteEntry.js` at runtime.
