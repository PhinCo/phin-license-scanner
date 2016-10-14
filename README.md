# phin-license-scanner

Phin's scanner for OSS license dependencies

Scans for *node* and *bower* dependencies

## Process

From the Root Folder:

1. Ensure that the repo is clean (offer to git pull)
2. Ensure that the dependencies are up to date
    a. npm install
    b. npm prune
    c. bower install
    d. bower prune
3. Run the license checkers
    a. license-checker --production --unknown --csv --out license_list_node_production.csv		
    b. license-checker --development --unknown --csv --out license_list_node_development.csv
    c. bower-license -e json
4. Collect all results in csv file
