# Use Node 18 Alpine — small and fast
FROM node:18-alpine

# Install Docker CLI so our app can talk to Docker
RUN apk add --no-cache docker-cli

# Set working directory inside container
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy rest of the source code
COPY . .

# Create necessary folders
RUN mkdir -p storage temp public functions

# Expose our port
EXPOSE 4566

# Start the server
CMD ["node", "src/app.js"]