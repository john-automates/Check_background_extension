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
          
          // Extract name parts and age
          let nameParts = result.searchedName.split(' ');
          let firstName = nameParts[0] || '';
          let lastName = nameParts.slice(1).join(' ') || '';
          let age = result.age ? parseInt(result.age, 10) : NaN; // Parse age, default to NaN if missing
          
          // Add to queue only if age is valid for lookup
          if (!isNaN(age)) {
            certificationQueue.push({
              firstName,
              lastName,
              timestamp: result.timestamp,
              age // Add age to the queue object
            });
          } else {
            console.warn(`Skipping batch certification for ${firstName} ${lastName} due to missing or invalid age.`);
            // Optionally update status immediately to indicate failure due to bad data
            updateStoredCertificationStatus(result.timestamp, 'Failed', 'Invalid or missing age');
          }
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
  
  // -- Add validation for age before proceeding --
  if (isNaN(nextMember.age)) {
      console.error(`Skipping certification for ${nextMember.firstName} ${nextMember.lastName} (Timestamp: ${nextMember.timestamp}) due to invalid age in queue.`);
      // Update status to Failed
      updateStoredCertificationStatus(nextMember.timestamp, 'Failed', 'Invalid age encountered during batch process');
      // Skip to the next member immediately
      setTimeout(processBatchCertification, 100); // Short delay before next
      return; 
  }
  // -- End age validation --
  
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
            nextMember.timestamp,
            nextMember.age // Pass the age here
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
      resultsTableBody.innerHTML = ''; // Clear existing rows
      let displayedResults = 0;

      // Sort results by timestamp descending (most recent first)
      const sortedKeys = Object.keys(data)
        .filter(key => key.startsWith('search_'))
        .sort((a, b) => new Date(data[b].timestamp) - new Date(data[a].timestamp));

      for (const key of sortedKeys) {
        const result = data[key];
        const searchTerm = searchInput.value.toLowerCase();
        
        // Filter logic
        if (filtered && !result.searchedName.toLowerCase().includes(searchTerm)) {
          continue; // Skip if it doesn't match the search term
        }

        displayedResults++;
        const row = resultsTableBody.insertRow();
        row.id = `result-${result.timestamp}`; // Add unique ID for updates

        // Apply researched style if applicable
        if (result.researchTimestamp) {
          row.classList.add('researched-row');
        }

        // Extract name parts (handle cases with or without middle names)
        let nameParts = result.searchedName.split(' ');
        let firstName = nameParts[0];
        let lastName = nameParts.slice(1).join(' '); // Join remaining parts as last name

        // Cell 1: Name
        row.insertCell(0).textContent = result.searchedName;

        // Cell 2: Search Type
        row.insertCell(1).textContent = result.searchType || 'N/A';

        // Cell 3: Results
        const resultsCell = row.insertCell(2);
        if (result.researchTimestamp) {
          const indicator = document.createElement('span');
          indicator.className = 'research-indicator';
          indicator.title = `Re-searched on ${formatDate(result.researchTimestamp)}`;
          indicator.textContent = '🔄'; // Use an icon or symbol
          resultsCell.appendChild(indicator);
        }
        resultsCell.appendChild(document.createTextNode(result.resultText || 'N/A'));


        // Cell 4: Date Checked
        row.insertCell(3).textContent = formatDate(result.timestamp);

        // Cell 5: Confirmation Status
        const confirmationCell = row.insertCell(4);
        let confirmationStatusText = 'Pending';
        if (result.confirmed) {
          confirmationStatusText = result.confirmed.positiveMatch 
            ? 'Confirmed MATCH by counselors' 
            : 'Confirmed NO MATCH by counselors';
          confirmationCell.classList.add('status-confirmed');
          // Add specific class for confirmed match
          if (result.confirmed.positiveMatch) {
            confirmationCell.classList.add('status-confirmed-match'); 
          }
        } else {
          confirmationCell.classList.add('status-pending');
        }
        confirmationCell.textContent = confirmationStatusText;

        // Cell 6: Certification Status
        const certificationCell = row.insertCell(5);
        certificationCell.textContent = result.certificationStatus || 'Pending'; // Default to Pending if not set

        // Cell 7: Actions
        const actionsCell = row.insertCell(6);
        // Add 'Re-Search' button
        const researchButton = document.createElement('button');
        researchButton.textContent = 'Re-Search';
        researchButton.className = 'action-button research-button';
        researchButton.onclick = () => reSearchMember(firstName, lastName);
        actionsCell.appendChild(researchButton);
        
        // Add 'Certify' button if needed
        const needsCertification = result.confirmed && !result.confirmed.positiveMatch &&
                                  (!result.certificationStatus || result.certificationStatus === 'Pending' || result.certificationStatus.startsWith('Failed'));

        if (needsCertification) {
          const certifyButton = document.createElement('button');
          certifyButton.textContent = 'Certify';
          certifyButton.className = 'action-button certification-button';
          certifyButton.onclick = () => {
            // Parse age before calling certification
            let age = result.age ? parseInt(result.age, 10) : NaN;
            if (isNaN(age)) {
                alert('Cannot certify: Member age is missing or invalid.');
                return;
            }
            giveUserCertification(firstName, lastName, result.timestamp, age);
          };
          actionsCell.appendChild(certifyButton);
        }
      }
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