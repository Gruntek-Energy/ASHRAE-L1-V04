#!/bin/bash
# Example cURL test for backend API

curl -X POST http://localhost:3000/api/get-report \
  -H "Content-Type: application/json" \
  -d @sample.json
