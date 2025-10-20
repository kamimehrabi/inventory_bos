FROM node:20-alpine

WORKDIR /usr/src

COPY package*.json ./

COPY yarn.lock ./

RUN yarn install

COPY . .

EXPOSE 3000

CMD [ "yarn", "run", "start:dev" ]
