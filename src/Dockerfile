# Use the Bun image as the base image
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . .

# Install bun
RUN npm install -g bun

# Install dependencies
RUN bun install --frozen-lockfile

# Expose the port on which the API will listen
EXPOSE 3000

# Run the server when the container launches
CMD ["bun", "start"]
