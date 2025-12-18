#!/bin/bash
# Script to run the app using the local Node v22 environment

# Add local Node 22 to PATH
export PATH="$PWD/node_env_22/bin:$PATH"

# Run dev server
npm run dev
