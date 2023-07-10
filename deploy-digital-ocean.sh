#!/bin/bash

echo "Enter the number of droplets to create:"
read count

echo "Enter your DigitalOcean API token:"
read auth_key

for ((i=1; i<=$count; i++))
do
    droplet_name="clicker-$i"
    user_data="git clone https://github.com/jannikhst/unblocked-browser.git && cd unblocked-browser && ./digital-ocean-autostart.sh"

    payload='{
        "name": "'"$droplet_name"'",
        "region": "fra1",
        "size": "s-4vcpu-8gb",
        "image": "docker-20-04",
        "tags": ["api-started"],
        "user_data": "'"$user_data"'"
    }'

    curl -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth_key" \
        -d "$payload" \
        "https://api.digitalocean.com/v2/droplets"

    echo "Created droplet $droplet_name"
done
