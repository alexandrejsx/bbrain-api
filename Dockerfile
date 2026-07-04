FROM node:20

COPY ["dist", "./dist"]
COPY ["package.json", "pnpm-lock.yaml", "./"]

RUN corepack enable
RUN pnpm install --prod --frozen-lockfile
