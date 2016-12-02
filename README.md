# phin-license-scanner

Phin's scanner for OSS license dependencies

Scans for *node* and *bower* dependencies

## Installation

```npm install -g @connectedyard/phin-license-scanner```

## Usage: Scan a Project Folder

```phin-license-scanner project-folder```

## Usage: Scan all of pHin

```./scripts/scan_phin.sh ~/repos/phin```

## Overview of The Scan Process

From the Project Root Folder:

1. Ensure that the repo is clean (offer to git pull)
2. Ensure that the dependencies are up to date
    a. npm install
    b. npm prune
    c. bower install
    d. bower prune
3. Run the license checkers
4. Collect all results in csv file


TODO

multi-folder:
    enable to aggregate results in to another file
    uniquify on dependency/version/license
    warn for certain licenses ("GPL","UNknown") using regex
    settings file in each project with local settings (production/dev/excludes)
    