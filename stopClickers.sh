#!/bin/bash

# Find and stop/delete containers matching the pattern
for container in $(docker ps -aq --filter "name=clicker-*"); do
    docker stop $container
    docker rm $container
done