// Content script to interact with the registry website

// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'searchStarted') {
      startSearchProcess(message.isTest);
    }
    return true;
  });
  
  // Check if we're on the registry search page and auto-start the process
  if (window.location.href.includes('icrimewatch.net/index.php?AgencyID=56564')) {
    // Allow the page to fully render
    setTimeout(() => {
      startSearchProcess();
    }, 1500);
  }

  // Check if we're on the NSOPW page and handle the search
  if (window.location.href.includes('nsopw.gov/search-public-sex-offender-registries')) {
    // Get the search parameters from storage
    chrome.storage.local.get(['lastSearchParams'], function(data) {
      if (data.lastSearchParams) {
        setTimeout(() => {
          performNSOPWSearch(data.lastSearchParams);
        }, 2000); // Wait for page to fully load
      }
    });
  }

  // Check if we're on a results page and capture the results count
  if (window.location.href.includes('results.php')) {
    captureSearchResults();
  }
});

// Function to capture search results information
function captureSearchResults() {
  // Look for the "Found X offenders" text
  const resultsText = document.querySelector('.searchArea strong[style*="color: #aa0000"]');
  
  // Look for the search criteria name
  let searchedName = '';
  const searchAreaTables = document.querySelectorAll('.searchArea');
  searchAreaTables.forEach(table => {
    const cells = table.querySelectorAll('td');
    cells.forEach(cell => {
      if (cell.textContent.includes('Search Criteria:')) {
        const cellText = cell.textContent;
        const nameMatch = cellText.match(/Name:(.*?)City:/);
        if (nameMatch && nameMatch[1]) {
          searchedName = nameMatch[1].trim();
        }
      }
    });
  });
  
  if (resultsText) {
    const resultsCount = resultsText.textContent.trim();
    const timestamp = new Date().toISOString();
    const searchKey = `search_${timestamp.replace(/[:.]/g, '_')}`;
    
    // Save the results to local storage with search type information
    const searchData = {
      searchType: 'UCAOR',
      searchedName: searchedName,
      results: resultsCount,
      timestamp: timestamp,
      source: 'Utah Corrections And Offender Registry',
      url: window.location.href
    };

    // Store in chrome.storage.local
    chrome.storage.local.set({ 
      [searchKey]: searchData,
      'lastSearchResults': searchData
    }, function() {
      // Send the results back to the popup
      chrome.runtime.sendMessage({
        action: 'searchResultsFound',
        searchData: searchData
      });
    });
  }
}

// Function to add the confirmation dialog
function addConfirmationDialog(searchedName, resultsCount) {
  // Create the dialog styles
  const styles = document.createElement('style');
  styles.textContent = `
    .counselor-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      width: 400px;
    }
    .counselor-dialog h2 {
      margin-top: 0;
      color: #333;
    }
    .counselor-checkbox {
      margin: 15px 0;
    }
    .counselor-checkbox label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .counselor-dialog button {
      background: #4285f4;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      margin-top: 15px;
    }
    .counselor-dialog button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
    }
  `;
  document.head.appendChild(styles);

  // Create the overlay
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);

  // Create the dialog
  const dialog = document.createElement('div');
  dialog.className = 'counselor-dialog';
  dialog.innerHTML = `
    <h2>Counselors Confirmation</h2>
    <p><strong>Name:</strong> ${searchedName}</p>
    <p><strong>Results:</strong> ${resultsCount}</p>
    <div class="counselor-checkbox">
      <label>
        <input type="checkbox" id="counselor1"> First Counselor has reviewed results
      </label>
    </div>
    <div class="counselor-checkbox">
      <label>
        <input type="checkbox" id="counselor2"> Second Counselor has reviewed results
      </label>
    </div>
    <button id="confirmButton" disabled>Confirm Results</button>
  `;
  document.body.appendChild(dialog);

  // Add event listeners
  const counselor1Checkbox = document.getElementById('counselor1');
  const counselor2Checkbox = document.getElementById('counselor2');
  const confirmButton = document.getElementById('confirmButton');

  function updateButtonState() {
    confirmButton.disabled = !(counselor1Checkbox.checked && counselor2Checkbox.checked);
  }

  counselor1Checkbox.addEventListener('change', updateButtonState);
  counselor2Checkbox.addEventListener('change', updateButtonState);

  confirmButton.addEventListener('click', () => {
    // Save confirmation to storage
    chrome.storage.local.set({
      'counselorConfirmation': {
        searchedName: searchedName,
        results: resultsCount,
        timestamp: new Date().toISOString(),
        confirmedBy: {
          counselor1: true,
          counselor2: true
        }
      }
    }, function() {
      // Remove the dialog and overlay
      dialog.remove();
      overlay.remove();
      
      // Show confirmation message
      alert('Results have been confirmed by both counselors.');
    });
  });
}

// Start the registry search process
function startSearchProcess(isTest) {
  console.log('Starting search process on the registry website');
  
  // Get our members from Chrome storage
  chrome.storage.local.get(['membersToCheck', 'isTestMode'], function(data) {
    if (!data.membersToCheck || data.membersToCheck.length === 0) {
      alert('No members found to check. Please try again from the extension popup.');
      return;
    }
    
    const members = data.membersToCheck;
    const isTestMode = isTest || data.isTestMode || false;
    
    console.log(`Loaded ${members.length} members to check. Test mode: ${isTestMode}`);
    
    // Clear any previous potential matches if we're starting a new test
    if (isTestMode) {
      chrome.storage.local.set({ 'potentialMatches': [] });
    }
    
    // Navigate to the search page if not already there
    navigateToSearchPage(members, isTestMode);
  });
}

// Navigate to the search page of the registry
function navigateToSearchPage(members, isTestMode) {
  // Check if we're on the main page and need to click "Search for Offenders"
  const searchLink = Array.from(document.querySelectorAll('a'))
    .find(a => a.textContent.includes('Search for Offenders in Utah'));
  
  if (searchLink) {
    console.log('Clicking on "Search for Offenders" link');
    searchLink.click();
    
    // Wait for the search page to load before continuing
    setTimeout(() => {
      processSearchPage(members, isTestMode);
    }, 2000);
  } else {
    // We might already be on the search page
    processSearchPage(members, isTestMode);
  }
}

// Process the search page with our member list
function processSearchPage(members, isTestMode) {
  console.log('Processing search page');
  
  // Check if we're on the search page
  const searchForm = document.querySelector('form[name="searchform"]');
  if (!searchForm) {
    console.log('Search form not found. We might be on the wrong page.');
    return;
  }
  
  // Set up our search process for the members list
  processMembersList(members, 0, isTestMode);
}

// Process the members list one at a time
function processMembersList(members, index, isTestMode) {
  if (index >= members.length) {
    console.log('Completed checking all members');
    if (isTestMode) {
      // Notify that the test is complete so results can be shown in popup
      chrome.runtime.sendMessage({
        action: 'testCompleted'
      });
    } else {
      alert('Completed checking all members against the registry.');
    }
    return;
  }
  
  const member = members[index];
  console.log(`Processing member ${index + 1}/${members.length}: ${member.firstName} ${member.lastName}`);
  
  // Fill out the search form
  const firstNameField = document.querySelector('input[name="OfndrFirst"]') || document.querySelector('input[name="first"]');
  const lastNameField = document.querySelector('input[name="OfndrLast"]') || document.querySelector('input[name="last"]');
  const searchButton = document.querySelector('input[type="submit"][value="Search"]');
  
  if (firstNameField && lastNameField && searchButton) {
    // Clear any previous values
    firstNameField.value = '';
    lastNameField.value = '';
    
    // Fill in the form with the current member
    // Based on the URL pattern, the first name should go in OfndrFirst and last name in OfndrLast
    firstNameField.value = member.firstName;
    lastNameField.value = member.lastName;
    
    // Submit the form
    console.log(`Searching for: ${member.firstName} ${member.lastName}`);
    searchButton.click();
    
    // Wait for the results to load
    setTimeout(() => {
      checkSearchResults(members, index, member, isTestMode);
    }, 2500);
  } else {
    console.log('Search form fields not found');
    processMembersList(members, index + 1, isTestMode); // Move to the next member
  }
}

// Check the search results for potential matches
function checkSearchResults(members, index, member, isTestMode) {
  console.log('Checking search results');
  
  // Check if we got any search results
  const noResults = document.querySelector('.search-no-results');
  if (noResults) {
    console.log('No results found for this member');
    
    // Move to the next member
    setTimeout(() => {
      // Go back to the search page
      const backToSearchLink = document.querySelector('a[href*="search"]');
      if (backToSearchLink) {
        backToSearchLink.click();
        setTimeout(() => {
          processMembersList(members, index + 1, isTestMode);
        }, 1500);
      } else {
        processMembersList(members, index + 1, isTestMode);
      }
    }, 1000);
    return;
  }
  
  // Check if there are any results
  const resultRows = document.querySelectorAll('.offender-row, .searchresult-row');
  if (resultRows && resultRows.length > 0) {
    console.log(`Found ${resultRows.length} potential matches`);
    
    // Process each result to check if it's a match
    const potentialMatches = [];
    
    resultRows.forEach(row => {
      const nameElement = row.querySelector('.name, .search-name');
      if (nameElement) {
        const fullName = nameElement.textContent.trim();
        const nameParts = fullName.split(',');
        
        if (nameParts.length >= 2) {
          const lastName = nameParts[0].trim();
          const firstName = nameParts[1].trim().split(' ')[0]; // Get just the first name
          
          console.log(`Checking: ${firstName} ${lastName} against ${member.firstName} ${member.lastName}`);
          
          // Check if this is a match for our member - using more flexible comparison for testing
          if ((firstName.toLowerCase().includes(member.firstName.toLowerCase()) || 
               member.firstName.toLowerCase().includes(firstName.toLowerCase())) && 
              (lastName.toLowerCase().includes(member.lastName.toLowerCase()) || 
               member.lastName.toLowerCase().includes(lastName.toLowerCase()))) {
            
            console.log(`Found a potential match: ${firstName} ${lastName}`);
            
            // Get the link to the offender details
            const detailsLink = row.querySelector('a[href*="offenderdetails"]');
            const detailsUrl = detailsLink ? detailsLink.href : '';
            
            // Get the image if available
            const imageElement = row.querySelector('img');
            const imageUrl = imageElement ? imageElement.src : '';
            
            // Store this potential match
            potentialMatches.push({
              member: member,
              offender: {
                firstName: firstName,
                lastName: lastName,
                fullName: fullName,
                detailsUrl: detailsUrl,
                imageUrl: imageUrl
              }
            });
          }
        }
      }
    });
    
    // Store any potential matches we found
    if (potentialMatches.length > 0) {
      chrome.runtime.sendMessage({
        action: 'storePotentialMatch',
        match: potentialMatches
      });
    }
  }
  
  // Capture screenshot of results page if in test mode
  if (isTestMode) {
    // Note: can't actually take a screenshot with content script permissions
    // Would need to use chrome.tabs.captureVisibleTab in background script
    console.log('Would capture screenshot of results here in a real implementation');
  }
  
  // Move to the next member
  setTimeout(() => {
    // Go back to the search page
    const backToSearchLink = document.querySelector('a[href*="search"]');
    if (backToSearchLink) {
      backToSearchLink.click();
      setTimeout(() => {
        processMembersList(members, index + 1, isTestMode);
      }, 1500);
    } else {
      processMembersList(members, index + 1, isTestMode);
    }
  }, 1500);
}

// Function to perform NSOPW search
async function performNSOPWSearch(searchParams) {
  console.log('Starting NSOPW search for:', searchParams);
  
  try {
    const results = await searchNSOPW(searchParams.firstName, searchParams.lastName);
    
    if (results && results.offenders) {
      const timestamp = new Date().toISOString();
      const searchKey = `search_${timestamp.replace(/[:.]/g, '_')}`;
      
      const searchData = {
        searchType: 'NSOPW',
        searchedName: `${searchParams.firstName} ${searchParams.lastName}`,
        results: `Found ${results.offenders.length} offenders`,
        timestamp: timestamp,
        source: 'National Sex Offender Public Website',
        url: 'https://www.nsopw.gov/',
        offenders: results.offenders
      };

      // Store in chrome.storage.local
      chrome.storage.local.set({ 
        [searchKey]: searchData,
        'lastSearchResults': searchData
      }, function() {
        // Send the results back to the popup
        chrome.runtime.sendMessage({
          action: 'searchResultsFound',
          searchData: searchData
        });
      });
    }
  } catch (error) {
    console.error('Error performing NSOPW search:', error);
  }
}

// Function to observe results and capture them
function setupResultsObserver(searchParams) {
  // Create an observer instance
  const observer = new MutationObserver((mutations, obs) => {
    // Look for results table or no results message
    const resultsTable = document.querySelector('table.results-table');
    const noResults = document.querySelector('.no-results-message');

    if (resultsTable || noResults) {
      let resultsCount = '0 offenders found';
      if (resultsTable) {
        const rows = resultsTable.querySelectorAll('tbody tr');
        resultsCount = `Found ${rows.length} offenders`;
      }

      // Save the results
      const timestamp = new Date().toISOString();
      const searchKey = `search_${timestamp.replace(/[:.]/g, '_')}`;
      
      const searchData = {
        searchType: 'NSOPW',
        searchedName: `${searchParams.firstName} ${searchParams.lastName}`,
        results: resultsCount,
        timestamp: timestamp,
        source: 'National Sex Offender Public Website',
        url: window.location.href
      };

      // Store in chrome.storage.local
      chrome.storage.local.set({ 
        [searchKey]: searchData,
        'lastSearchResults': searchData
      }, function() {
        // Send the results back to the popup
        chrome.runtime.sendMessage({
          action: 'searchResultsFound',
          searchData: searchData
        });
      });

      // Disconnect the observer
      obs.disconnect();
    }
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
} 