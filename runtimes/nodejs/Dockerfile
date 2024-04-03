FROM node:20.10.0

RUN apt update && apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev git -y

# RUN npm install npm -g

EXPOSE 8000
EXPOSE 9000

WORKDIR /app
ENV LOG_LEVEL=debug

# enable chalk colors
ENV FORCE_COLOR=1

COPY . /app
# COPY --chown=node:node . /app
RUN mkdir /app/data || true
RUN mkdir /app/cloud_functions || true
RUN mkdir /tmp/custom_dependency || true
RUN chown node:node /app/data
RUN chown node:node /app/functions
RUN chown -R node:node /app/cloud_functions
RUN chown node:node /tmp/custom_dependency
# RUN npm install
# RUN npm run build
RUN chown -R node:node /app/node_modules
RUN chown node:node /app/package.json
RUN chown node:node /app/package-lock.json

USER node
CMD [ "sh", "/app/start.sh" ]
