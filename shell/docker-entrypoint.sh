#!/bin/sh
set -e

: "${PEOPLE_REMOTE_URL:=/people-remote/remoteEntry.js}"
: "${DELIVERY_REMOTE_URL:=/delivery-remote/remoteEntry.js}"
: "${PEOPLE_UPSTREAM:=people:80}"
: "${DELIVERY_UPSTREAM:=delivery:80}"
: "${API_UPSTREAM:=api:3000}"

mkdir -p /usr/share/nginx/html/config

# The browser-facing runtime config. This is what "Remote URLs resolve at
# runtime from container configuration, never from the bundle" means in
# practice: this file is generated fresh every time the container starts,
# from environment variables docker-compose.yml controls -- nothing about
# these URLs is baked into the JS bundle at build time.
cat > /usr/share/nginx/html/config/env.js <<EOF
window.__BASELINE_CONFIG__ = {
  peopleRemoteEntry: "${PEOPLE_REMOTE_URL}",
  deliveryRemoteEntry: "${DELIVERY_REMOTE_URL}",
};
EOF

export PEOPLE_UPSTREAM DELIVERY_UPSTREAM API_UPSTREAM
envsubst '${PEOPLE_UPSTREAM} ${DELIVERY_UPSTREAM} ${API_UPSTREAM}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
