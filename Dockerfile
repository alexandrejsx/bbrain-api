FROM node:20

COPY ["dist", "./dist"]
COPY ["package.json", "yarn.lock", "./"]

RUN npm install -g yarn
RUN yarn install --production=true
