#!/usr/bin/env python3
"""Replace this process with the agent so the terminal stays interactive."""
import json
import os
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    argv = json.load(handle)
os.execvp(argv[0], argv)
