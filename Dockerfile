# Use a lightweight Node.js image as the base
FROM node:lts-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install

RUN npm install -g typescript ts-node

# Install necessary dependencies for Puppeteer and Chromium
RUN apk update && \
    apk add --no-cache chromium udev ttf-freefont

# Install Tor
RUN apk update && apk add tor

# install curl
RUN apk update && apk add curl

# Set environment variables for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

ENV RUN_HEADLESS=true

# Copy the application code
COPY app.ts action.ts worker.config webshare_proxy_provider.ts proxy_provider.ts ./

# create a directory for the tor data ./data
RUN mkdir data

# Specify the command to run your application
CMD [ "ts-node", "app.ts" ]
