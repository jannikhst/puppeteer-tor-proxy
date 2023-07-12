#!/bin/bash

echo "Enter the number of droplets to create:"
read count

echo "Enter your DigitalOcean API token:"
read auth_key

echo "Enter the wait time before starting (in minutes):"
read wait_time

echo "Waiting for $wait_time minutes before starting..."

sleep "$(($wait_time * 60))"

for ((i=1; i<=$count; i++))
do
    droplet_name="clicker-$i"
    user_data="#!/bin/bash
git clone https://github.com/jannikhst/unblocked-browser.git && cd unblocked-browser
echo \"browsers=2\" > worker.config
echo \"workers=1\" >> worker.config
echo \"useOwnIp=y\" >> worker.config
docker build . -t clicker:latest
docker run -d --restart always --name clicker clicker:latest
"

    payload='{
        "name": "'"$droplet_name"'",
        "region": "fra1",
        "size": "s-4vcpu-8gb",
        "image": "docker-20-04",
        "ssh_keys": [
            38762337
        ],
        "tags": ["api-started"],
        "user_data": "'"$user_data"'"
    }'

    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $auth_key" \
        -d "$payload" \
        "https://api.digitalocean.com/v2/droplets" > /dev/null

    echo "Created droplet $droplet_name"
done
