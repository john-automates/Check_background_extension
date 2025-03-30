// Function to format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Function to open search page for a member
function reSearchMember(firstName, lastName) {
  // Open the search page with the member's name
  chrome.tabs.create({
    url: chrome.runtime.getURL('search.html'),
    active: true
  }, function(tab) {
    // Store search parameters for the member
    chrome.storage.local.set({
      'advancedSearchParams': {
        firstName: firstName,
        lastName: lastName,
        autoSearch: true,
        isResearch: true,  // Flag to indicate this is a re-search
        researchTimestamp: new Date().toISOString()  // Add timestamp for tracking
      }
    });
    
    // Create a listener for tab updates to refresh results when the search tab closes
    chrome.tabs.onRemoved.addListener(function onTabClose(tabId) {
      if (tabId === tab.id) {
        // Tab was closed, refresh the results after a short delay
        // to ensure storage has been updated
        setTimeout(() => {
          loadResults();
        }, 500);
        
        // Remove this listener to prevent memory leaks
        chrome.tabs.onRemoved.removeListener(onTabClose);
      }
    });
  });
}

// Function to load and display results
function loadResults() {
  chrome.storage.local.get(null, function(data) {
    const resultsTableBody = document.getElementById('resultsTableBody');
    const searchInput = document.getElementById('searchInput');
    let allResults = [];

    // Collect all search results
    for (let key in data) {
      if (key.startsWith('search_')) {
        allResults.push(data[key]);
      }
    }

    // Sort results by date (most recent first)
    allResults.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Create a map to hold the most recent result for each unique person
    const memberResultsMap = new Map();
    allResults.forEach(result => {
      if (result.searchedName) {
        const nameKey = result.searchedName.toLowerCase();
        // Only add if not already in map (first occurrence is most recent due to sorting)
        if (!memberResultsMap.has(nameKey)) {
          memberResultsMap.set(nameKey, result);
        }
      }
    });
    
    // Convert map back to array for display
    const uniqueResults = Array.from(memberResultsMap.values());

    // Function to display filtered results
    function displayResults(filtered = false) {
      let resultsToShow = filtered ? uniqueResults.filter(result => 
        result.searchedName.toLowerCase().includes(searchInput.value.toLowerCase())
      ) : uniqueResults;

      if (resultsToShow.length === 0) {
        resultsTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="no-results">
              ${filtered ? 'No results match your search.' : 'No results found. Start by checking some names.'}
            </td>
          </tr>
        `;
        return;
      }

      resultsTableBody.innerHTML = resultsToShow.map(result => {
        // Combine results from both NSOPW and UCAOR
        let combinedResultText = '';
        
        if (result.nsopw && result.ucaor) {
          // This is a combined search from the new UI
          const nsopwCount = result.nsopw.offenders ? result.nsopw.offenders.length : 0;
          const ucaorCount = result.ucaor.offenderCount || 0;
          
          combinedResultText = `NSOPW: Found ${nsopwCount} offenders | UCAOR: ${result.ucaor.results}`;
        } else if (result.results) {
          // This is from the old UI
          combinedResultText = result.results;
        }
        
        // Determine search type
        let searchType = '';
        if (result.nsopw && result.ucaor) {
          searchType = 'Both Registries';
        } else if (result.searchType) {
          searchType = result.searchType;
        }
        
        // Check if result is confirmed by counselors
        const isConfirmed = result.confirmed || false;
        
        // Check if a positive match was found (from the new checkbox)
        let confirmationText = 'Pending confirmation';
        if (isConfirmed) {
          if (result.confirmed.positiveMatch) {
            confirmationText = 'Confirmed MATCH by counselors';
          } else {
            confirmationText = 'Confirmed NO MATCH by counselors';
          }
        }
        
        // Check if this was a re-search
        const isResearch = result.confirmed?.isResearch || false;
        
        // Add visual indicator for re-searched members
        const researchIndicator = isResearch ? 
          '<span class="research-indicator" title="This member was re-searched">↻</span> ' : '';
        
        // Extract first and last name for re-search button
        let nameParts = result.searchedName.split(' ');
        let firstName = nameParts[0] || '';
        let lastName = nameParts.slice(1).join(' ') || '';
        
        // Format name for data attribute - will be used by event handler
        const nameData = `data-firstname="${firstName}" data-lastname="${lastName}"`;
        
        return `
          <tr ${isResearch ? 'class="researched-row"' : ''}>
            <td>${researchIndicator}${result.searchedName}</td>
            <td>${searchType}</td>
            <td>${combinedResultText}</td>
            <td>${formatDate(result.timestamp)}</td>
            <td class="${isConfirmed ? 'status-confirmed' : 'status-pending'}">
              ${confirmationText}
            </td>
            <td>
              <button class="action-button research-button researchBtn" ${nameData}>
                Re-Search
              </button>
            </td>
          </tr>
        `;
      }).join('');
      
      // Add event listeners to re-search buttons
      document.querySelectorAll('.researchBtn').forEach(button => {
        button.addEventListener('click', function() {
          const firstName = this.getAttribute('data-firstname');
          const lastName = this.getAttribute('data-lastname');
          reSearchMember(firstName, lastName);
        });
      });
    }

    // Initial display
    displayResults();

    // Add search functionality
    searchInput.addEventListener('input', () => {
      displayResults(true);
    });
  });
}

// Clear all data from storage
function clearAllData() {
  // Get all keys in storage
  chrome.storage.local.get(null, function(data) {
    // Create an array of keys to remove
    const keysToRemove = [];
    
    // Add all search result keys
    for (let key in data) {
      if (key.startsWith('search_') || 
          key === 'lastSearchResults' || 
          key === 'savedResults' || 
          key === 'counselorConfirmation') {
        keysToRemove.push(key);
      }
    }
    
    // Remove the keys
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, function() {
        console.log('All search data has been cleared');
        // Reload the results
        loadResults();
      });
    }
  });
}

// Set up the modal and clear data functionality
function setupClearDataButton() {
  const clearDataButton = document.getElementById('clearDataButton');
  const confirmationModal = document.getElementById('confirmationModal');
  const cancelClearButton = document.getElementById('cancelClearButton');
  const confirmClearButton = document.getElementById('confirmClearButton');
  
  // Show the confirmation modal when clear button is clicked
  clearDataButton.addEventListener('click', function() {
    confirmationModal.style.display = 'block';
  });
  
  // Hide the modal when cancel is clicked
  cancelClearButton.addEventListener('click', function() {
    confirmationModal.style.display = 'none';
  });
  
  // Clear data when confirm is clicked
  confirmClearButton.addEventListener('click', function() {
    clearAllData();
    confirmationModal.style.display = 'none';
  });
  
  // Hide the modal when clicked outside of it
  window.addEventListener('click', function(event) {
    if (event.target === confirmationModal) {
      confirmationModal.style.display = 'none';
    }
  });
}

// Load results when the page loads
document.addEventListener('DOMContentLoaded', function() {
  loadResults();
  setupClearDataButton();
  
  // Listen for search confirmations from other tabs
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'searchConfirmed') {
      // Refresh results when a search is confirmed
      loadResults();
      sendResponse({ received: true });
    }
    return true;
  });
});

// Listen for storage changes and reload results
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local') {
    loadResults();
  }
});