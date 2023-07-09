git pull


# Prompt for browsers value
read -p "Enter the number of browsers: " browsers

# Prompt for workers value
read -p "Enter the number of workers: " workers

# Prompt for number of clickers
read -p "Enter the number of clickers to start: " clickers

# Update the config file
echo "browsers=$browsers" > worker.config
echo "workers=$workers" >> worker.config

echo "Config file updated successfully."

# Build the Docker image
docker build . -t clicker:latest

echo "Docker image built successfully."
echo "Stopping all running clickers..."
./stopClickers.sh

echo "Starting $browsers browsers and $workers workers in $clickers clickers..."

# Start the clickers
for ((i=1; i<=$clickers; i++))
do
    ./startClicker.sh
done
