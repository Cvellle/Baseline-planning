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

## Repo map

    domain/                 pure calculation logic -- no browser, no server
      src/
        rates.ts              rate-splitting (Fig. 4: slices, blended rate)
        units.ts              hours / person-months / % / cost conversions
        rounding.ts           largest-remainder rounding (totals reconcile)
        rollup.ts             parent = sum of children, tree -> table
        workingDays.ts        Mon-Fri counting, month splitting
        currency.ts           EUR <-> display currency
      test/                  vitest, one file per concern above

    api/                    one small Express server, shared by both remotes
      data/baseline-seed.json  the fixed-ID seed fixture
      src/server.js            REST endpoints (employees, rates, breakdown, allocations, rollup)
      src/store.js             in-memory store, persisted to a Docker volume
      src/events.js            SSE broadcast (rate/allocation/breakdown changes, live)

    people/                 remote: employee register + rate history
      src/PeopleApp.tsx        entry point (exposed via Module Federation)
      src/usePeopleData.ts     state, SSE subscriptions, rate CRUD
      src/EmployeeList.tsx     search + list panel
      src/RateHistoryPanel.tsx rate table, inline add/edit/remove

    delivery/               remote: work breakdown tree + staffing grid
      src/DeliveryApp.tsx      entry point (exposed via Module Federation)
      src/useDeliveryData.ts   state, SSE subscriptions, breakdown/allocation CRUD
      src/BreakdownTree.tsx    tree: add/rename/move/delete, inline
      src/RollupView.tsx       read-only roll-up table
      src/StaffingGrid.tsx     editable leaf grid (people x months)

    shell/                  host app: navigation, display currency, active user
      src/App.tsx              owns currency + active user, pushes both into remotes as props
      src/loadRemote.ts        Module Federation init + runtime remote URLs
      src/RemoteBoundary.tsx   catches a failed remote, shows the fallback panel
      docker-entrypoint.sh   writes runtime config (remote URLs) at container start, not build time

`people` and `delivery` both depend on `domain` (imported as a package) but never on each other or
on `shell`. `shell` never imports either remote's source -- it only loads their built `remoteEntry.js`
over HTTP at runtime, resolved from container config (see "Break a remote on purpose" above).
