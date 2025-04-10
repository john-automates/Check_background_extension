// Batch processing functionality for sex offender registry checking
// This script allows automated searching of all imported members

let currentMemberIndex = 0;
let membersList = [];
let isProcessing = false;
let processedMembers = new Set(); // Track already processed members

// Import the export report functionality
import { exportReportToCSV } from './export-report.js';

document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startBatchProcess');
  const statusDisplay = document.getElementById('batchStatus');
  const progressBar = document.getElementById('progressBar');
  const progressContainer = document.getElementById('progressContainer');
  const currentMemberDisplay = document.getElementById('currentMember');
  const stopButton = document.getElementById('stopBatchProcess');
  const resetButton = document.getElementById('resetProcessedMembers');
  const exportButton = document.getElementById('exportReport');
  const processedCountDisplay = document.getElementById('processedCount');
  
  // Initialize - check for already processed members
  updateProcessedMembersCount();
  
  if (startButton) {
    startButton.addEventListener('click', startBatchProcessing);
  }
  
  if (stopButton) {
    stopButton.addEventListener('click', stopBatchProcessing);
    // Initially hide the stop button
    stopButton.style.display = 'none';
  }
  
  if (resetButton) {
    resetButton.addEventListener('click', resetProcessedMembers);
  }
  
  // Set up export button
  if (exportButton) {
    exportButton.addEventListener('click', function() {
      exportReportToCSV(statusDisplay);
    });
  }
  
  // Listen for messages from search.js about completed confirmations
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'memberSearchConfirmed' && isProcessing) {
      // Add the confirmed member to the processed set
      if (message.searchResults && message.searchResults.searchedName) {
        processedMembers.add(message.searchResults.searchedName.toLowerCase());
        updateProcessedMembersCount();
      }
      
      // Proceed to the next member after confirmation
      setTimeout(() => {
        processNextMember();
      }, 1000);
      sendResponse({ received: true });
    }
    return true;
  });
});

// Function to update the displayed count of processed members
function updateProcessedMembersCount() {
  const processedCountDisplay = document.getElementById('processedCount');
  
  if (processedCountDisplay) {
    chrome.storage.local.get(['processedMemberNames'], function(data) {
      const processed = data.processedMemberNames || [];
      processedCountDisplay.textContent = `Already processed: ${processed.length} members`;
    });
  }
}

// Function to reset the list of processed members
function resetProcessedMembers() {
  if (isProcessing) {
    alert('Please stop the current batch process before resetting the processed members list.');
    return;
  }
  
  // Confirm with the user
  if (confirm('Are you sure you want to reset the list of processed members? This will allow you to reprocess all members again. Note: This will NOT delete any search results or report data.')) {
    chrome.storage.local.remove('processedMemberNames', function() {
      processedMembers.clear();
      updateProcessedMembersCount();
      alert('The list of processed members has been cleared. You can now process members again, but previous search results are still available for reports.');
    });
  }
}

// Start the batch processing
function startBatchProcessing() {
  if (isProcessing) return;
  
  // Get the status and button elements
  const statusDisplay = document.getElementById('batchStatus');
  const startButton = document.getElementById('startBatchProcess');
  const stopButton = document.getElementById('stopBatchProcess');
  const progressBar = document.getElementById('progressBar');
  const progressContainer = document.getElementById('progressContainer');
  const currentMemberDisplay = document.getElementById('currentMember');
  
  // Show the progress UI
  if (progressContainer) progressContainer.style.display = 'block';
  if (stopButton) stopButton.style.display = 'inline-block';
  if (startButton) startButton.disabled = true;
  
  // Update status
  if (statusDisplay) statusDisplay.textContent = 'Loading member list...';
  
  // Reset the tracking set
  processedMembers = new Set();
  
  // Load previously processed members and check for paused state
  chrome.storage.local.get(['processedMemberNames', 'batchProcessing'], function(data) {
    // If we have previously processed members, add them to our set
    if (data.processedMemberNames && Array.isArray(data.processedMemberNames)) {
      data.processedMemberNames.forEach(name => processedMembers.add(name.toLowerCase()));
      updateProcessedMembersCount();
    }
    
    // Check if there's a paused state
    if (data.batchProcessing && data.batchProcessing.isPaused) {
      if (confirm(`Batch processing was paused at ${data.batchProcessing.pausedAt.member}.\nWould you like to resume from where you left off?`)) {
        // Resume from paused state
        currentMemberIndex = data.batchProcessing.pausedAt.index;
        if (statusDisplay) statusDisplay.textContent = `Resuming from ${data.batchProcessing.pausedAt.member}...`;
      } else {
        // Clear paused state and start from beginning
        chrome.storage.local.set({
          'batchProcessing': {
            isActive: true,
            isPaused: false
          }
        });
      }
    }
    
    // Now load the members to process
    loadMembersAndStart();
  });
}

// Load members and start processing
function loadMembersAndStart() {
  // Load all members from storage
  chrome.storage.local.get('members', function(data) {
    if (!data.members || data.members.length === 0) {
      const statusDisplay = document.getElementById('batchStatus');
      const startButton = document.getElementById('startBatchProcess');
      const stopButton = document.getElementById('stopBatchProcess');
      const progressContainer = document.getElementById('progressContainer');
      
      if (statusDisplay) statusDisplay.textContent = 'No members found. Please import members first.';
      if (startButton) startButton.disabled = false;
      if (stopButton) stopButton.style.display = 'none';
      if (progressContainer) progressContainer.style.display = 'none';
      return;
    }
    
    // Store member list and reset index
    membersList = data.members;
    currentMemberIndex = 0;
    isProcessing = true;
    
    // Update UI
    const statusDisplay = document.getElementById('batchStatus');
    const progressBar = document.getElementById('progressBar');
    
    if (statusDisplay) statusDisplay.textContent = `Processing ${membersList.length} members...`;
    if (progressBar) {
      progressBar.max = membersList.length;
      progressBar.value = 0;
    }
    
    // Count how many members are already processed
    let remainingCount = 0;
    membersList.forEach(member => {
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      if (!processedMembers.has(fullName)) {
        remainingCount++;
      }
    });
    
    if (remainingCount === 0) {
      if (statusDisplay) statusDisplay.textContent = 'All members have already been processed. Use the "Reset Processed Members" button to start over.';
      if (startButton) startButton.disabled = false;
      if (stopButton) stopButton.style.display = 'none';
      if (progressContainer) progressContainer.style.display = 'none';
      isProcessing = false;
      return;
    }
    
    if (statusDisplay) statusDisplay.textContent = `Processing ${remainingCount} remaining members out of ${membersList.length} total...`;
    
    // Start processing the first member
    processNextMember();
  });
}

// Stop the batch processing
function stopBatchProcessing() {
  isProcessing = false;
  
  const statusDisplay = document.getElementById('batchStatus');
  const startButton = document.getElementById('startBatchProcess');
  const stopButton = document.getElementById('stopBatchProcess');
  
  if (statusDisplay) statusDisplay.textContent = 'Processing stopped by user.';
  if (startButton) startButton.disabled = false;
  if (stopButton) stopButton.style.display = 'none';
  
  // Clear paused state when manually stopped
  chrome.storage.local.set({
    'batchProcessing': {
      isActive: false,
      isPaused: false
    }
  });
}

// Process the next member in the list
function processNextMember() {
  if (!isProcessing || currentMemberIndex >= membersList.length) {
    completeProcessing();
    return;
  }
  
  const member = membersList[currentMemberIndex];
  const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
  
  // Check if this member has already been processed and confirmed
  chrome.storage.local.get(null, function(data) {
    const processed = data.processedMemberNames || [];
    
    // Check all search results for this member's confirmation
    let isConfirmed = false;
    for (const key in data) {
      if (key.startsWith('search_')) {
        const searchResult = data[key];
        if (searchResult.searchedName && 
            searchResult.searchedName.toLowerCase() === fullName &&
            searchResult.confirmed &&
            searchResult.confirmed.confirmedBy &&
            searchResult.confirmed.confirmedBy.counselor1 &&
            searchResult.confirmed.confirmedBy.counselor2) {
          isConfirmed = true;
          break;
        }
      }
    }
    
    // If member is in processed list but not confirmed, we need to process them again
    if (processed.includes(fullName) && !isConfirmed) {
      console.log(`Member ${fullName} was processed but not confirmed. Processing again...`);
      processedMembers.delete(fullName); // Remove from current session's processed set
      
      // Remove from processed members list
      const updatedProcessed = processed.filter(name => name.toLowerCase() !== fullName);
      chrome.storage.local.set({ 'processedMemberNames': updatedProcessed });
      updateProcessedMembersCount();
    }
    
    // If member is confirmed, skip them
    if (isConfirmed) {
      console.log(`Skipping confirmed member: ${member.firstName} ${member.lastName}`);
      currentMemberIndex++;
      
      // Update progress bar
      const progressBar = document.getElementById('progressBar');
      if (progressBar) progressBar.value = currentMemberIndex;
      
      // Process the next member
      processNextMember();
      return;
    }
    
    // If we get here, we need to process this member
    const statusDisplay = document.getElementById('batchStatus');
    const progressBar = document.getElementById('progressBar');
    const currentMemberDisplay = document.getElementById('currentMember');
    
    // Update UI
    if (statusDisplay) statusDisplay.textContent = `Processing ${currentMemberIndex + 1} of ${membersList.length}`;
    if (progressBar) progressBar.value = currentMemberIndex + 1;
    if (currentMemberDisplay) currentMemberDisplay.textContent = `${member.firstName} ${member.lastName}`;
    
    // Add to processed members set to prevent duplicates in the current session
    processedMembers.add(fullName);
    
    // Save processed members to storage
    if (!processed.includes(fullName)) {
      processed.push(fullName);
      chrome.storage.local.set({ 'processedMemberNames': processed });
      updateProcessedMembersCount();
    }
    
    // Open the search page with the member's name
    chrome.tabs.create({
      url: chrome.runtime.getURL('search.html'),
      active: true
    }, function(tab) {
      // Store search parameters for the member
      chrome.storage.local.set({
        'advancedSearchParams': {
          firstName: member.firstName,
          lastName: member.lastName,
          age: member.age,
          searchType: 'batch',
          batchIndex: currentMemberIndex,
          totalMembers: membersList.length,
          autoSearch: true
        }
      });
      
      // Store the batch processing state
      chrome.storage.local.set({
        'batchProcessing': {
          isActive: true,
          currentIndex: currentMemberIndex,
          totalMembers: membersList.length
        }
      });
      
      // Move to the next member for next iteration
      currentMemberIndex++;
    });
  });
}

// Handle completion of batch processing
function completeProcessing() {
  isProcessing = false;
  
  const statusDisplay = document.getElementById('batchStatus');
  const startButton = document.getElementById('startBatchProcess');
  const stopButton = document.getElementById('stopBatchProcess');
  const progressContainer = document.getElementById('progressContainer');
  
  if (statusDisplay) statusDisplay.textContent = 'Batch processing completed!';
  if (startButton) startButton.disabled = false;
  if (stopButton) stopButton.style.display = 'none';
  
  // Store the batch processing state as inactive and clear paused state
  chrome.storage.local.set({
    'batchProcessing': {
      isActive: false,
      isPaused: false
    }
  });
  
  // Alert the user of completion
  alert('Batch processing of all members is complete!');
} 