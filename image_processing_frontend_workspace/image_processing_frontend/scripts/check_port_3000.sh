#!/bin/bash
# Checks if port 3000 is in use and gives instructions to terminate it if needed.

echo "Checking if port 3000 is in use..."
PORT_IN_USE=$(lsof -i:3000 | grep LISTEN)

if [ -z "$PORT_IN_USE" ]; then
  echo "Port 3000 is free. You can start the React frontend on this port."
else
  echo "Port 3000 is currently in use:"
  lsof -i:3000
  echo ""
  echo "To terminate the process using port 3000, run:"
  echo "kill -9 <PID>"
  echo "Replace <PID> with the value in the PID column above."
  echo "After terminating, you can start the React frontend using: npm start"
fi
