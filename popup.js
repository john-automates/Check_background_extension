document.addEventListener('DOMContentLoaded', function() {
  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  const advancedSearchButton = document.getElementById('advancedSearch');
  const viewResultsButton = document.getElementById('viewResults');
  const getMemberListButton = document.getElementById('getMemberList');
  const viewMemberListButton = document.getElementById('viewMemberList');
  const batchProcessButton = document.getElementById('batchProcess');
  
  // Hide View Member List button initially
  viewMemberListButton.style.display = 'none';
  
  // Hide Batch Process button initially
  if (batchProcessButton) {
    batchProcessButton.style.display = 'none';
  }
  
  // Load any saved results
  loadSavedResults();
  loadLastSearchResults();
  
  // Check if members have been imported
  checkForImportedMembers();
  
  // Handle Advanced Search button click
  advancedSearchButton.addEventListener('click', function() {
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    
    // Open the search page in a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('search.html')
    }, function(tab) {
      // If name fields are filled, store them for auto-fill in the search page
      if (firstName || lastName) {
        chrome.storage.local.set({
          'advancedSearchParams': {
            firstName: firstName,
            lastName: lastName,
            searchType: 'both'
          }
        });
      }
    });
  });
  
  // Handle Get Member List button click
  getMemberListButton.addEventListener('click', function() {
    // Open the LCR member list page in a new tab
    chrome.tabs.create({
      url: 'https://lcr.churchofjesuschrist.org/records/member-list?lang=eng'
    });
  });
  
  // Handle View Member List button click
  viewMemberListButton.addEventListener('click', function() {
    // Open the member list page in a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('member-list.html')
    });
  });
  
  // Handle Batch Process button click
  if (batchProcessButton) {
    batchProcessButton.addEventListener('click', function() {
      // Open the batch process page in a new tab
      chrome.tabs.create({
        url: chrome.runtime.getURL('batch-process.html')
      });
    });
  }
  
  // Listen for messages about search results and other events
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'searchResultsFound') {
      displaySearchResults(message.searchData);
      sendResponse({ received: true });
    } else if (message.action === 'membersCleared') {
      // Hide the View Member List button
      viewMemberListButton.style.display = 'none';
      
      // Hide the Batch Process button
      if (batchProcessButton) {
        batchProcessButton.style.display = 'none';
      }
      
      // Update status
      statusDiv.innerHTML = 'Member list has been cleared';
    }
    return true;
  });
  
  // Function to check for imported members
  function checkForImportedMembers() {
    chrome.storage.local.get('members', function(data) {
      if (data.members && data.members.length > 0) {
        // Show the View Member List button
        viewMemberListButton.style.display = 'block';
        
        // Show the Batch Process button
        if (batchProcessButton) {
          batchProcessButton.style.display = 'block';
        }
        
        // Add a status message about imported members
        const importedMembersCount = data.members.length;
        statusDiv.innerHTML = `${importedMembersCount} members imported from LCR. Ready to check against registry.`;
      }
    });
  }
  
  // Function to load saved results
  function loadSavedResults() {
    chrome.storage.local.get('savedResults', function(data) {
      if (data.savedResults && data.savedResults.length > 0) {
        displayTestResults(data.savedResults);
        statusDiv.innerHTML = 'Displaying saved results from previous test.';
      }
    });
  }
  
  // Function to display test results in the popup
  function displayTestResults(matches) {
    if (!matches || matches.length === 0) {
      statusDiv.innerHTML = 'Test completed. No matches found.';
      return;
    }
    
    statusDiv.innerHTML = `Test completed. Found ${matches.length} potential matches.`;
    
    // Clear previous results
    resultsDiv.innerHTML = '';
    
    // Add each match to the results
    matches.forEach(match => {
      const matchArray = Array.isArray(match) ? match : [match];
      
      matchArray.forEach(item => {
        const memberInfo = item.member;
        const offenderInfo = item.offender;
        
        const matchElement = document.createElement('div');
        matchElement.className = 'potential-match';
        matchElement.innerHTML = `
          <h3>Potential Match Found</h3>
          <p><strong>Member:</strong> ${memberInfo.firstName} ${memberInfo.lastName}</p>
          <p><strong>Registry Match:</strong> ${offenderInfo.fullName}</p>
          ${offenderInfo.detailsUrl ? `<p><a href="${offenderInfo.detailsUrl}" target="_blank">View Details</a></p>` : ''}
        `;
        
        resultsDiv.appendChild(matchElement);
      });
    });
    
    // Save results to local storage
    chrome.storage.local.set({ 'savedResults': matches });
  }
  
  // Function to load last search results from storage
  function loadLastSearchResults() {
    chrome.storage.local.get('lastSearchResults', function(data) {
      if (data.lastSearchResults) {
        displaySearchResults(data.lastSearchResults);
      }
    });
  }
  
  // Function to get time ago string
  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);
    
    if (interval > 1) return interval + " years ago";
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + " months ago";
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + " days ago";
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + " hours ago";
    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  }
  
  // Function to display search results
  function displaySearchResults(searchData) {
    statusDiv.innerHTML = searchData.results;
    
    // Create a results container
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'results-container';
    
    const timeAgo = getTimeAgo(new Date(searchData.timestamp));
    
    resultsContainer.innerHTML = `
      <h3>${searchData.searchType} Search Results</h3>
      <p><strong>Name searched:</strong> ${searchData.searchedName}</p>
      <p><strong>Source:</strong> ${searchData.source}</p>
      <p>${searchData.results}</p>
      <p class="search-time">Last updated: ${timeAgo}</p>
    `;
    
    // Clear previous results and add new ones
    resultsDiv.innerHTML = '';
    resultsDiv.appendChild(resultsContainer);
  }

  // View Results button handler
  viewResultsButton.addEventListener('click', function() {
    // Open the results page in a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('results.html')
    });
  });
}); 