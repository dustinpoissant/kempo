FROM node:22-alpine

# pg_dump and psql: Kempo backs the database up before an update that changes data, and puts the backup back if that update fails.
RUN apk add --no-cache postgresql16-client

# The site as it is when the image is built. The first time a container starts it is copied onto the /site volume, and from
# then on the volume is the site (its pages, templates, uploads and the Kempo it runs), so what the admin changes, installs and
# updates survives rebuilding or replacing the container. Rebuild the image to change Node, not to change the site.
WORKDIR /seed
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

# The startup script and the module it shares with the site.
RUN mkdir -p /opt/kempo \
 && cp node_modules/kempo/docker/entrypoint.mjs node_modules/kempo/server/utils/updates/siteLayout.js /opt/kempo/

ENV NODE_ENV=production \
    KEMPO_SITE_ROOT=/site \
    KEMPO_SEED=/seed \
    KEMPO_RESTART=exit

VOLUME /site
EXPOSE 9876
ENTRYPOINT ["node", "/opt/kempo/entrypoint.mjs"]
