FROM oven/bun:1.3.6

WORKDIR /app

COPY apps/router apps/router
RUN cd apps/router && bun install

ENV NODE_ENV=production \
    PORT=4002

EXPOSE 4002

CMD ["bun", "apps/router/src/index.ts"]
