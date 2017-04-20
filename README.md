# phin-license-scanner

Phin's scanner for OSS license dependencies

Scans for *node* and *bower* dependencies

## Installation

```npm install -g @connectedyard/phin-license-scanner```

## Usage: Scan a Project Folder

```phin-license-scanner project-folder```

## Usage: Scan all of pHin

```
cd ~/repos/phin     # top of phin git repo tree
phin-licenese-scanner --run all-phin
```

Outputs complete csv files in each repo, and an aggregate `phin-license.json` in the current folder.

## Configuration

A configuration file is installed with the scanner in the scanner's folder in your global node modules. An alternative
configuration file can be loaded by passing the `--config [filepath]` parameter.

### Config File Keys
* *node*: Provides a map of node dependency to license when the scanner cannot identify
* *bower*: Provides a map of bower dependency to license when the scanner cannot identify
* *warnOnLicenses*: Warn when these regular expression strings match a license
* *excludedDependencies*: Don't look for licenses from matching dependencies
* *runners*: Map of 'scripts' to run scans

### Config Values

#### node

Example: `"ns@0.7.1": "MIT"`

#### bower

Example: `"ng-tags-input@3.0.0": "MIT"`

#### warnOnLicenses

Example: 
```
    "GPL": {
      "pattern": "GPL.*"
    },
    "GNU": {
      "pattern": "GNU.*"
    },
    "Apache": "Apache 2.0"
```

For each member of the array, if a string compare the string exactly, and if an object, use the `pattern` key to define a RegExp to compare to the license. Comparisons are case-insensitive.

#### excludedDependencies

Example:
```
[
	"@connectedyard",
	"phin-admin",
	"api@1.2.3"
]
```

For each member of the array exclude dependency from license checks, using the following rules:
* If the exclusion begins with an "@" compare the dependency's private registry
* If the exclusion contains an "@semver", compare the dependency exactly
* else remove the dependency semver and compare generally

#### runners

Example:
```
	runners: {
		runnername: { ... },
		...
	}
```

## Runner Specs

Example Runner:
```
{
	runner-example: {
		options: {
			"unknowns": true,
			"prod: true,
			"output" : {
				"path" : "output.json",
				"format": "json"
			}
		},
		directories: {
			node-blower: {
				"overrideCategorization": "dev"
			}
		}
	}
}
```

Runners are executed by adding `--run runner-name` to the command line arguments.

The `options` key defines the default scanning options. These can be overridden from the command line arguments. The `options.output` key instructs the runner to produce an aggregated output file.

The `directories` key enumerates the directories to scan, relative to the directory run from. The value of each key is the
local options to override the defaults and command-line arguments for given directory.

## Overview of The Scan Process

From a Project Root Folder, the following steps are performed. Most of them can be activated
or deactivated through command line arguments.

1. Ensure that the repo is clean (offer to git pull)
2. Ensure that the dependencies are up to date
    a. npm install
    b. npm prune
    c. bower install
    d. bower prune
3. Run the license checkers
4. Collect all results in csv file

# Resources for Licenses
    
https://opensource.org/licenses

Underlying scan is done through these modules:
 * bower-license
 * license-checker


