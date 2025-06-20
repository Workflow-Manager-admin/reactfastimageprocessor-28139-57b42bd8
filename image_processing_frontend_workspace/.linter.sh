#!/bin/bash
cd /home/kavia/workspace/code-generation/reactfastimageprocessor-28139-57b42bd8/image_processing_frontend_workspace/image_processing_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

