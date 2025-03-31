// Wait for the page to fully load
window.addEventListener('load', function() {
  // Check if we're on the member list page
  if (window.location.href.includes('lcr.churchofjesuschrist.org/records/member-list')) {
    console.log('LCR Member List page detected - adding import button');
    
    // Create a button and add it to the page
    const importButton = document.createElement('button');
    importButton.textContent = 'Import Member List';
    importButton.style.position = 'fixed';
    importButton.style.top = '100px';
    importButton.style.right = '20px';
    importButton.style.zIndex = '9999';
    importButton.style.backgroundColor = '#34a853';
    importButton.style.color = 'white';
    importButton.style.padding = '10px 15px';
    importButton.style.border = 'none';
    importButton.style.borderRadius = '4px';
    importButton.style.cursor = 'pointer';
    importButton.style.fontWeight = 'bold';
    
    // Add hover effect
    importButton.addEventListener('mouseover', function() {
      this.style.backgroundColor = '#2e8b47';
    });
    
    importButton.addEventListener('mouseout', function() {
      this.style.backgroundColor = '#34a853';
    });
    
    // Add click event listener to extract member data
    importButton.addEventListener('click', function() {
      showScrollWarning();
    });
    
    document.body.appendChild(importButton);
  }
});

function showScrollWarning() {
  // Create warning dialog
  const warningDialog = document.createElement('div');
  warningDialog.id = 'scroll-warning-dialog';
  warningDialog.style.position = 'fixed';
  warningDialog.style.top = '50%';
  warningDialog.style.left = '50%';
  warningDialog.style.transform = 'translate(-50%, -50%)';
  warningDialog.style.zIndex = '10000';
  warningDialog.style.backgroundColor = 'white';
  warningDialog.style.padding = '20px';
  warningDialog.style.borderRadius = '8px';
  warningDialog.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  warningDialog.style.maxWidth = '400px';
  warningDialog.style.width = '90%';
  
  // Add warning content
  warningDialog.innerHTML = `
    <h3 style="margin-top: 0; color: #d93025;">Important: Scroll Required</h3>
    <p>To import all members, you must first scroll to the bottom of the page to load all member data.</p>
    <p>Please scroll to the bottom of the page and then click "Import Members" to ensure all members are included.</p>
    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
      <button id="cancel-import" style="padding: 8px 16px; background-color: #f1f3f4; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
      <button id="confirm-import" style="padding: 8px 16px; background-color: #34a853; color: white; border: none; border-radius: 4px; cursor: pointer;">Import Members</button>
    </div>
  `;
  
  // Add overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  overlay.style.zIndex = '9999';
  
  // Add elements to page
  document.body.appendChild(overlay);
  document.body.appendChild(warningDialog);
  
  // Add event listeners
  document.getElementById('cancel-import').addEventListener('click', function() {
    warningDialog.remove();
    overlay.remove();
  });
  
  document.getElementById('confirm-import').addEventListener('click', function() {
    warningDialog.remove();
    overlay.remove();
    extractAndSaveMembers();
  });
}

function extractAndSaveMembers() {
  // Create a status message element
  let statusMessage = document.getElementById('import-status-message');
  if (!statusMessage) {
    statusMessage = document.createElement('div');
    statusMessage.id = 'import-status-message';
    statusMessage.style.position = 'fixed';
    statusMessage.style.top = '150px';
    statusMessage.style.right = '20px';
    statusMessage.style.zIndex = '9999';
    statusMessage.style.backgroundColor = '#f8f9fa';
    statusMessage.style.border = '1px solid #ddd';
    statusMessage.style.padding = '10px';
    statusMessage.style.borderRadius = '4px';
    statusMessage.style.maxWidth = '300px';
    document.body.appendChild(statusMessage);
  }
  
  statusMessage.textContent = 'Extracting member data...';
  
  try {
    // 1. Select all member-card elements
    const memberCards = document.querySelectorAll('member-card');
    
    // 2. Initialize an array to store the parsed names and a Set for duplicate checking
    const members = [];
    const uniqueMembers = new Set();
    
    // 3. Loop through each member card
    memberCards.forEach(card => {
      // 4. Find the span with the name inside the card
      const nameSpan = card.querySelector('span.ng-binding');
    
      // 5. If a span is found, process its text content
      if (nameSpan) {
        const fullName = nameSpan.textContent.trim();
        if (fullName) { // Process only if the name is not empty after trimming
          // Parse the name which is in format "Last, First Middle"
          const parts = fullName.split(',');
          
          if (parts.length >= 2) {
            const lastName = parts[0].trim();
            // For the first name, take only the first word after the comma
            const firstParts = parts[1].trim().split(' ');
            const firstName = firstParts[0].trim();
            
            // Create a unique key for this member
            const memberKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
            
            // Only add if we haven't seen this member before
            if (!uniqueMembers.has(memberKey)) {
              uniqueMembers.add(memberKey);
              members.push({
                firstName: firstName,
                lastName: lastName
              });
            }
          }
        }
      }
    });
    
    // 6. Save the results to Chrome storage
    if (members.length > 0) {
      chrome.storage.local.set({ 'members': members }, function() {
        statusMessage.textContent = `Successfully imported ${members.length} unique members! Data is ready for use in the Sex Offender Registry Checker.`;
        
        // Show a sample of imported names
        if (members.length > 0) {
          const sampleList = document.createElement('div');
          sampleList.style.marginTop = '10px';
          sampleList.style.fontSize = '12px';
          
          const sampleSize = Math.min(5, members.length);
          let sampleHTML = '<strong>Sample of imported names:</strong><br>';
          for (let i = 0; i < sampleSize; i++) {
            sampleHTML += `${members[i].firstName} ${members[i].lastName}<br>`;
          }
          if (members.length > sampleSize) {
            sampleHTML += `... and ${members.length - sampleSize} more`;
          }
          
          sampleList.innerHTML = sampleHTML;
          statusMessage.appendChild(sampleList);
        }
        
        // Log to console for debugging
        console.log("Found unique members:", members.length);
        console.log(members);
      });
    } else {
      statusMessage.textContent = 'No member data found. Please make sure the page is fully loaded.';
    }
  } catch (error) {
    statusMessage.textContent = 'Error extracting member data: ' + error.message;
    console.error('Error extracting member data:', error);
  }
} 