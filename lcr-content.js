// Wait for the page to fully load
window.addEventListener('load', function() {
  // Check if we're on the members with callings page
  if (window.location.href.includes('lcr.churchofjesuschrist.org/orgs/members-with-callings')) {
    console.log('LCR Members page detected - adding import button');
    
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
      extractAndSaveMembers();
    });
    
    document.body.appendChild(importButton);
  }
});

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
    // 1. Select all the specific anchor tags containing member profiles
    const memberLinks = document.querySelectorAll('a[href^="/records/member-profile/"]');
    
    // 2. Initialize an array to store the parsed names
    const members = [];
    
    // 3. Loop through each link
    memberLinks.forEach(link => {
      // 4. Find the specific span inside the link
      const nameSpan = link.querySelector('span.ng-binding');
    
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
            
            // Add to our members array as an object with firstName and lastName properties
            members.push({
              firstName: firstName,
              lastName: lastName
            });
          }
        }
      }
    });
    
    // 6. Save the results to Chrome storage
    if (members.length > 0) {
      chrome.storage.local.set({ 'members': members }, function() {
        statusMessage.textContent = `Successfully imported ${members.length} members! Data is ready for use in the Sex Offender Registry Checker.`;
        
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
        console.log("Found members:", members.length);
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