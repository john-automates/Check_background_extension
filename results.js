// Import the certification functionality from the certification module
import { giveUserCertification, closeAllCertificationTabs } from './certification.js';

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

// Batch certification queue and state
let certificationQueue = [];
let isBatchProcessing = false;
let currentTabId = null;

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

// Function to start batch certification
function startBatchCertification() {
  // Get all eligible members (with 'Pending' or 'Failed' certification status)
  chrome.storage.local.get(null, function(data) {
    // Reset the queue and state
    certificationQueue = [];
    isBatchProcessing = false;
    
    // Collect all eligible members for certification
    for (let key in data) {
      if (key.startsWith('search_')) {
        const result = data[key];
        const certificationStatus = result.certificationStatus || 'Pending';
        const isConfirmed = result.confirmed || false;
        
        // Only process members that are confirmed NO MATCH and not already certified
        if (isConfirmed && !result.confirmed.positiveMatch && 
            (certificationStatus === 'Pending' || certificationStatus.startsWith('Failed'))) {
          
          // Extract name parts
          let nameParts = result.searchedName.split(' ');
          let firstName = nameParts[0] || '';
          let lastName = nameParts.slice(1).join(' ') || '';
          
          // Add to queue
          certificationQueue.push({
            firstName,
            lastName,
            timestamp: result.timestamp
          });
        }
      }
    }
    
    if (certificationQueue.length === 0) {
      alert('No members found that need certification.');
      return;
    }
    
    // Inform the user how many members will be processed
    alert(`Found ${certificationQueue.length} members for certification. Starting process for all.`);
    
    // Store the batch processing state for certification module to access
    chrome.storage.local.set({ 'isBatchProcessing': true }, () => {
      // Start the batch process
      isBatchProcessing = true;
      processBatchCertification();
    });
  });
}

// Process the certification queue
function processBatchCertification() {
  if (!isBatchProcessing || certificationQueue.length === 0) {
    if (isBatchProcessing) {
      // Clean up batch state
      chrome.storage.local.remove('isBatchProcessing', () => {
        alert('Batch certification complete!');
        isBatchProcessing = false;
      });
    }
    return;
  }
  
  // Close any existing certification tab
  if (currentTabId) {
    chrome.tabs.remove(currentTabId, () => {
      currentTabId = null;
      // Continue with next member after a delay
      setTimeout(processBatchCertification, 500);
    });
    return;
  }
  
  // Get next member from queue
  const nextMember = certificationQueue.shift();
  
  // Set up listener for certification completion
  const certificationListener = function(message, sender, sendResponse) {
    if (message.action === 'certificationStatusUpdate') {
      console.log('Received certification status update during batch process:', message);
      
      if (message.status === 'Added' || message.status === 'Exists') {
        console.log('Certification successful for current member, moving to next');
        
        // Add delay before proceeding
        setTimeout(() => {
          // Clean up any LCR tabs first
          closeAllCertificationTabs();
          
          // Now close the main certification tab
          if (currentTabId) {
            chrome.tabs.remove(currentTabId, () => {
              currentTabId = null;
              // Remove this listener
              chrome.runtime.onMessage.removeListener(certificationListener);
              // Continue with next member after a delay
              setTimeout(processBatchCertification, 1000);
            });
          } else {
            // Just in case tab ID is missing, continue anyway
            chrome.runtime.onMessage.removeListener(certificationListener);
            setTimeout(processBatchCertification, 1000);
          }
        }, 2000);
      } else if (message.status.startsWith('Failed')) {
        console.log('Certification failed for current member, will retry later');
        // Move failed member to end of queue (for retry)
        certificationQueue.push(nextMember);
        
        // Clean up any LCR tabs first
        closeAllCertificationTabs();
        
        // Now close the main certification tab and continue
        setTimeout(() => {
          if (currentTabId) {
            chrome.tabs.remove(currentTabId, () => {
              currentTabId = null;
              // Remove this listener
              chrome.runtime.onMessage.removeListener(certificationListener);
              // Continue with next member after a delay
              setTimeout(processBatchCertification, 1000);
            });
          } else {
            // Just in case tab ID is missing, continue anyway
            chrome.runtime.onMessage.removeListener(certificationListener);
            setTimeout(processBatchCertification, 1000);
          }
        }, 2000);
      }
      
      sendResponse({ received: true });
    } else if (message.action === 'closeCertificationTabs') {
      // Close all open LCR tabs from certification process
      closeAllCertificationTabs();
      sendResponse({ received: true });
    }
    return true; // Keep channel open for async response
  };
  
  // Register the listener
  chrome.runtime.onMessage.addListener(certificationListener);
  
  // Start certification for this member
  console.log(`Starting certification for ${nextMember.firstName} ${nextMember.lastName}`);
  
  // Create a tab for this certification
  chrome.tabs.create({
    url: chrome.runtime.getURL('blank.html'), // Just a blank page to start
    active: true
  }, function(tab) {
    currentTabId = tab.id;
    
    // Need to do this on tab load
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        // Remove this listener
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Start the certification process
        setTimeout(() => {
          giveUserCertification(
            nextMember.firstName, 
            nextMember.lastName, 
            nextMember.timestamp
          );
        }, 500);
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
        
        // Display age if available
        const ageDisplay = result.age ? ` (Age: ${result.age})` : '';
        
        // Extract first and last name for re-search button
        let nameParts = result.searchedName.split(' ');
        let firstName = nameParts[0] || '';
        let lastName = nameParts.slice(1).join(' ') || '';
        
        // Format name for data attribute - will be used by event handler
        const nameData = `data-firstname="${firstName}" data-lastname="${lastName}"`;
        // Add timestamp data attribute to identify the specific search record
        const timestampData = `data-timestamp="${result.timestamp}"`;
        
        // Get certification status, default to 'Pending' if not set
        const certificationStatus = result.certificationStatus || 'Pending';
        let certificationStatusText = certificationStatus;
        let certificationButtonDisabled = false;
        
        // Customize display and button state based on status
        if (certificationStatus === 'Added' || certificationStatus === 'Exists') {
          certificationStatusText = `✓ ${certificationStatus}`;
          certificationButtonDisabled = true;
        } else if (certificationStatus.startsWith('Failed')) {
          certificationStatusText = `✗ ${certificationStatus}`;
          // Keep button enabled for retry
        }

        return `
          <tr ${isResearch ? 'class="researched-row"' : ''}>
            <td>${researchIndicator}${result.searchedName}${ageDisplay}</td>
            <td>${searchType}</td>
            <td>${combinedResultText}</td>
            <td>${formatDate(result.timestamp)}</td>
            <td class="${isConfirmed ? 'status-confirmed' : 'status-pending'}">
              ${confirmationText}
            </td>
            <td>${certificationStatusText}</td>
            <td>
              <button class="action-button research-button researchBtn" ${nameData}>
                Re-Search
              </button>
              <button 
                class="action-button certification-button certifyBtn" 
                ${nameData} 
                ${timestampData}
                ${certificationButtonDisabled ? 'disabled' : ''}
              >
                ${certificationButtonDisabled ? 'Certified' : 'Give Certification'}
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
      
      // Add event listeners to certification buttons
      document.querySelectorAll('.certifyBtn').forEach(button => {
        button.addEventListener('click', function() {
          const firstName = this.getAttribute('data-firstname');
          const lastName = this.getAttribute('data-lastname');
          const timestamp = this.getAttribute('data-timestamp'); // Get the timestamp
          giveUserCertification(firstName, lastName, timestamp); // Pass timestamp
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

// Setup batch certification button
function setupBatchCertificationButton() {
  const batchCertifyButton = document.getElementById('batchCertifyButton');
  
  if (batchCertifyButton) {
    batchCertifyButton.addEventListener('click', function() {
      if (isBatchProcessing) {
        alert('Batch certification is already in progress.');
        return;
      }
      startBatchCertification();
    });
  }
}

// Load results when the page loads
document.addEventListener('DOMContentLoaded', function() {
  loadResults();
  setupClearDataButton();
  setupBatchCertificationButton();
  
  // Listen for search confirmations from other tabs
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'searchConfirmed') {
      // Refresh results when a search is confirmed
      loadResults();
      sendResponse({ received: true });
    } else if (message.action === 'certificationStatusUpdate') {
      // Handle status updates from the certification process
      console.log('Received certification status update:', message);
      updateStoredCertificationStatus(message.timestamp, message.status, message.details);
      sendResponse({ received: true });
    }
    return true; // Keep the message channel open for asynchronous response
  });
});

// Function to update the certification status in storage
function updateStoredCertificationStatus(timestamp, status, details) {
  chrome.storage.local.get(null, function(data) {
    let recordKey = null;
    // Find the key corresponding to the timestamp
    for (let key in data) {
      if (key.startsWith('search_') && data[key].timestamp === timestamp) {
        recordKey = key;
        break;
      }
    }

    if (recordKey) {
      let updatedRecord = { ...data[recordKey], certificationStatus: status };
      if (details) {
        updatedRecord.certificationDetails = details; // Store failure details if provided
      }
      
      // Save the updated record
      chrome.storage.local.set({ [recordKey]: updatedRecord }, function() {
        if (chrome.runtime.lastError) {
          console.error("Error updating certification status:", chrome.runtime.lastError);
        } else {
          console.log(`Certification status updated for ${recordKey} to ${status}`);
          // Optionally, reload results immediately to reflect the change
          loadResults(); 
        }
      });
    } else {
      console.error('Could not find search record to update status for timestamp:', timestamp);
    }
  });
}

// Listen for storage changes and reload results
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local') {
    loadResults();
  }
});