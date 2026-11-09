# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim
WORKDIR /app
COPY . .
RUN --mount=type=secret,id=proxy_ca if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --prefix server --omit=dev --ignore-scripts --no-audit --no-fund && chmod -R a+rX /app && mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=8080 DATA_FILE=/data/webcraft.sqlite
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server/entrypoint.cjs"]
