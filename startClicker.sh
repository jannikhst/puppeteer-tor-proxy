#!/bin/bash

highest_number=0
next_number=1

# Find the highest numbered clicker container
for container in $(docker ps -aq --filter "name=clicker-*"); do
    container_name=$(docker inspect --format '{{.Name}}' $container)
    container_number=${container_name#"/clicker-"}

    if (( container_number > highest_number )); then
        highest_number=$container_number
    fi
done

if (( highest_number > 0 )); then
    next_number=$((highest_number + 1))

    # Check if the existing container is running
    container_name="clicker-$highest_number"
    container_status=$(docker inspect --format '{{.State.Status}}' $container_name)

    if [[ "$container_status" != "running" ]]; then
        # Start the existing container
        echo "Starting container $container_name..."
        docker start $container_name
        exit 0
    fi
else
    echo "No existing clicker container found."
fi

# Run a new clicker container with the next number
container_name="clicker-$next_number"
echo "Starting a new container $container_name..."
docker run -d --name $container_name clicker:latest
