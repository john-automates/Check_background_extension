document.addEventListener('DOMContentLoaded', function() {
  const membersList = document.getElementById('membersList');
  const memberCount = document.getElementById('memberCount');
  const backButton = document.getElementById('backButton');
  const clearMembersButton = document.getElementById('clearMembers');
  const confirmDialog = document.getElementById('confirmDialog');
  const cancelClearButton = document.getElementById('cancelClear');
  const confirmClearButton = document.getElementById('confirmClear');
  
  // Load and display members
  loadMembers();
  
  // Set up event listeners
  backButton.addEventListener('click', function() {
    window.close();
  });
  
  clearMembersButton.addEventListener('click', function() {
    confirmDialog.style.display = 'block';
  });
  
  cancelClearButton.addEventListener('click', function() {
    confirmDialog.style.display = 'none';
  });
  
  confirmClearButton.addEventListener('click', function() {
    clearMembers();
    confirmDialog.style.display = 'none';
  });
  
  // Function to load members from storage
  function loadMembers() {
    chrome.storage.local.get('members', function(data) {
      if (data.members && data.members.length > 0) {
        // Update member count
        memberCount.textContent = `${data.members.length} members imported`;
        
        // Clear list and empty state
        membersList.innerHTML = '';
        
        // Sort the members alphabetically by last name
        const sortedMembers = [...data.members].sort((a, b) => 
          a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
        );
        
        // Add each member to the list
        sortedMembers.forEach((member, index) => {
          const memberItem = document.createElement('div');
          memberItem.className = 'member-item';
          
          // Create the grid cells
          const numberCell = document.createElement('div');
          numberCell.textContent = index + 1;
          
          const lastNameCell = document.createElement('div');
          lastNameCell.textContent = member.lastName;
          
          const firstNameCell = document.createElement('div');
          firstNameCell.textContent = member.firstName;
          
          // Add cells to the row
          memberItem.appendChild(numberCell);
          memberItem.appendChild(lastNameCell);
          memberItem.appendChild(firstNameCell);
          
          // Add row to the list
          membersList.appendChild(memberItem);
        });
      } else {
        // Show empty state
        membersList.innerHTML = '<div class="empty-state">No members imported yet</div>';
        memberCount.textContent = '0 members imported';
      }
    });
  }
  
  // Function to clear all members
  function clearMembers() {
    chrome.storage.local.remove('members', function() {
      // Show empty state
      membersList.innerHTML = '<div class="empty-state">No members imported yet</div>';
      memberCount.textContent = '0 members imported';
      
      // Send a message to the popup to update its UI
      chrome.runtime.sendMessage({
        action: 'membersCleared'
      });
    });
  }
}); 