FROM node:12

# Create app directory
WORKDIR /usr/src/app

COPY *.json ./

COPY . .
RUN yarn
RUN yarn build

EXPOSE 3535
CMD [ "node", "build/gba.js" ]