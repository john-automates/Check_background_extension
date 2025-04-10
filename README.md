# Sex Offender Registry Checker - Chrome Extension

This Chrome extension automates the process of checking a list of members against multiple sex offender registries including the Utah Sex Offender Registry (UCAOR) and the National Sex Offender Public Website (NSOPW).

## Features

- Automatically searches each member name in multiple sex offender registries:
  - Utah Corrections And Offender Registry (UCAOR)
  - National Sex Offender Public Website (NSOPW)
- Import members directly from the LCR "Members with Callings" page
- Performs batch processing of multiple members
- Two-counselor confirmation system for search results
- Removes duplicate member entries
- Tracks and reports any potential matches
- Export reports of search results to CSV
- Remembers already processed members to avoid redundant searches

## Setup Instructions

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension folder
5. The extension should now be installed and appear in your Chrome toolbar

## Usage

1. Click on the extension icon in your Chrome toolbar
2. To import members:
   - Click "Get Member List" to open the LCR members page
   - The extension will automatically extract member information
3. To check individual members:
   - Enter a first and last name in the search fields
   - Click "Advanced Search" to search multiple registry sources
4. To process all members:
   - Click "Batch Process" to start automated checking
   - Track progress with the built-in progress bar
   - Stop the process at any time with the "Stop" button
5. View results:
   - Click "View Results" to see all search results and potential matches
   - Export results to CSV for further analysis

## Member Data

The extension can import member data directly from LCR or use the `members.json` file for testing. All member data is stored locally in your browser's storage.

## Privacy and Data Usage

- Member data is stored locally in your browser and is not shared with any third parties
- Searches are conducted directly through the official registry websites
- The two-counselor confirmation system ensures responsible handling of sensitive information
- No data is retained after the browser is closed unless explicitly saved

## Technical Details

- Built with JavaScript for Chrome Extensions (Manifest V3)
- Uses Chrome's storage API to temporarily store member data and results
- Content scripts interact with registry websites to perform searches
- Background service worker manages search operations and data storage 

## Last Updated
- Repository last updated: April 2025 