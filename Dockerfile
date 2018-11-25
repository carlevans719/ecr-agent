FROM node:8 as build

RUN mkdir -p /home/node/app
WORKDIR /home/node/app

COPY --chown=node package* webpack.config.js ./
COPY --chown=node src ./src/

RUN npm i && npx webpack


FROM node:8-alpine as deploy

RUN mkdir -p /home/node/app
WORKDIR /home/node/app

COPY --from=build /home/node/app/dist/bundle.js ./

CMD [ "node", "bundle.js" ]
