# base
FROM node:14.16.0 AS base
WORKDIR /application
COPY package*.json /application/

# development
FROM base AS development
ARG NODE_ENV=development
ENV NODE_ENV $NODE_ENV
ARG PORT=8080
ENV PORT $PORT
COPY . /application/
WORKDIR /application
RUN npm install
RUN npm run compile
ENV AWS_DEFAULT_REGION ""
ENV AWS_ACCESS_KEY_ID ""
ENV AWS_SECRET_ACCESS_KEY ""
CMD [ "npm", "run", "local"]

EXPOSE 80
