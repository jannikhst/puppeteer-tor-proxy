echo "browsers=2" > worker.config
echo "workers=1" >> worker.config
echo "useOwnIp=y" >> worker.config

echo "Config file updated successfully."

# Build the Docker image
docker build . -t clicker:latest

echo "Docker image built successfully."

echo "Stopping all running clickers..."
./stopClickers.sh

echo "Starting 2 browsers and 1 workers in 1 clickers..."
./startClicker.sh