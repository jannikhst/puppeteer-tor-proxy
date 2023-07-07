git pull
# Prompt for browsers value
read -p "Enter the number of browsers: " browsers

# Prompt for workers value
read -p "Enter the number of workers: " workers

# Update the config file
echo "browsers=$browsers" > worker.config
echo "workers=$workers" >> worker.config

echo "Config file updated successfully."


docker build . -t clicker:latest
./startClicker.sh
