FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/.runtime && chown node:node /app/.runtime
USER node
ENV HOST=0.0.0.0 PORT=4173 NODE_ENV=production DATA_DIR=/app/.runtime
EXPOSE 4173
CMD ["node", "server.mjs"]
