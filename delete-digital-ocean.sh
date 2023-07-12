#!/bin/bash

echo "Enter your DigitalOcean API token:"
read auth_key

curl -X DELETE \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $auth_key" \
    "https://api.digitalocean.com/v2/droplets?tag_name=api-started"

echo "All droplets with the tag 'api-started' have been deleted."
