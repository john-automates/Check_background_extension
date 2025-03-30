# Sex Offender Registry Checker - Chrome Extension

This Chrome extension automates the process of checking a list of members against the Utah Sex Offender Registry.

## Features

- Automatically searches each member name in the Utah Sex Offender Registry
- Removes duplicate member entries
- Tracks and reports any potential matches
- Simple user interface to start the checking process

## Setup Instructions

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension folder
5. The extension should now be installed and appear in your Chrome toolbar

## Usage

1. Click on the extension icon in your Chrome toolbar
2. Click "Check Members" to start the automated check process
3. The extension will open the Utah Sex Offender Registry and begin searching for each member
4. When matches are found, they will be displayed in the extension popup
5. You can also click "Go to Registry Search" to manually search the registry

## Member Data

The extension uses the `members.json` file to check against the registry. This file contains a list of members with their first and last names.

## Privacy and Data Usage

- Member data is stored locally in your browser and is not shared with any third parties
- Searches are conducted directly through the official Utah Sex Offender Registry website
- No data is retained after the browser is closed

## Technical Details

- Built with JavaScript for Chrome Extensions (Manifest V3)
- Uses Chrome's storage API to temporarily store member data and results
- Content scripts interact with the registry website to perform searches 