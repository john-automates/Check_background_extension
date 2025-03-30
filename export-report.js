// Export report functionality for sex offender registry checking
// This script handles exporting member check results to a CSV file

/**
 * Formats a date object or date string to a readable format
 * @param {string|Date} dateValue - The date to format
 * @returns {string} - The formatted date string
 */
function formatDate(dateValue) {
  if (!dateValue) return 'N/A';
  
  const date = new Date(dateValue);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Escapes special characters in CSV fields
 * @param {string} text - The text to escape
 * @returns {string} - The escaped text
 */
function escapeCSV(text) {
  if (text === null || text === undefined) return '';
  return String(text).replace(/"/g, '""');
}

/**
 * Creates a row for the CSV export
 * @param {Array} values - Array of values for the row
 * @returns {string} - The CSV row
 */
function createCSVRow(values) {
  return values.map(value => `"${escapeCSV(value)}"`).join(',') + '\r\n';
}

/**
 * Exports all search results to a CSV file
 * @param {Object} statusDisplay - The status display element to update (optional)
 */
function exportReportToCSV(statusDisplay) {
  if (statusDisplay) statusDisplay.textContent = 'Generating report...';

  // Get both the search results and the member list
  chrome.storage.local.get(null, function(data) {
    // Extract members list
    const members = data.members || [];
    
    // Create a Map for quick member lookup
    const membersMap = new Map();
    members.forEach(member => {
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      membersMap.set(fullName, member);
    });
    
    // Collect all search results
    const searchResults = [];
    for (const key in data) {
      if (key.startsWith('search_')) {
        searchResults.push(data[key]);
      }
    }
    
    if (searchResults.length === 0 && members.length === 0) {
      if (statusDisplay) statusDisplay.textContent = 'No data available for export.';
      alert('No search results or members found to export.');
      return;
    }
    
    // Start building CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add header row
    csvContent += createCSVRow([
      'Name', 
      'Date Checked', 
      'NSOPW Results', 
      'Utah Registry Results',
      'Confirmation Status',
      'Counselor 1',
      'Counselor 2',
      'Notes'
    ]);
    
    // If we have members but no searches, create rows for all members
    if (searchResults.length === 0 && members.length > 0) {
      members.forEach(member => {
        const fullName = `${member.firstName} ${member.lastName}`;
        csvContent += createCSVRow([
          fullName,
          'Not checked',
          'Not checked',
          'Not checked',
          'Not processed',
          '',
          '',
          ''
        ]);
      });
    } else {
      // Process search results
      // First, create a Map for quick lookup of results by name
      const resultsMap = new Map();
      searchResults.forEach(result => {
        if (result.searchedName) {
          resultsMap.set(result.searchedName.toLowerCase(), result);
        }
      });
      
      // If we have a members list, use it to ensure all members are included
      if (members.length > 0) {
        members.forEach(member => {
          const fullName = `${member.firstName} ${member.lastName}`;
          const fullNameLower = fullName.toLowerCase();
          const result = resultsMap.get(fullNameLower);
          
          if (result) {
            // Member has search results
            csvContent += createMemberRow(fullName, result);
            // Mark this result as processed
            resultsMap.delete(fullNameLower);
          } else {
            // Member has no search results
            csvContent += createCSVRow([
              fullName,
              'Not checked',
              'Not checked',
              'Not checked',
              'Not processed',
              '',
              '',
              ''
            ]);
          }
        });
        
        // Add any remaining results that weren't matched to members
        resultsMap.forEach((result, name) => {
          csvContent += createMemberRow(name, result);
        });
      } else {
        // No members list, just output all search results
        searchResults.forEach(result => {
          csvContent += createMemberRow(result.searchedName, result);
        });
      }
    }
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    link.setAttribute("download", `SexOffenderCheck_Report_${timestamp}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    
    if (statusDisplay) statusDisplay.textContent = 'Report exported successfully.';
    setTimeout(() => {
      if (statusDisplay && statusDisplay.textContent === 'Report exported successfully.') {
        statusDisplay.textContent = 'Ready to start batch processing.';
      }
    }, 3000);
  });
}

/**
 * Creates a CSV row for a member's search result
 * @param {string} memberName - The member's name
 * @param {Object} result - The search result object
 * @returns {string} - The CSV row
 */
function createMemberRow(memberName, result) {
  // Format confirmation status
  let confirmationStatus = 'Pending confirmation';
  let counselor1 = '';
  let counselor2 = '';
  
  if (result.confirmed) {
    confirmationStatus = result.confirmed.positiveMatch ? 
      'Confirmed MATCH' : 
      'Confirmed NO MATCH';
    
    counselor1 = result.confirmed.confirmedBy?.counselor1 ? 'Yes' : 'No';
    counselor2 = result.confirmed.confirmedBy?.counselor2 ? 'Yes' : 'No';
  }
  
  // Format NSOPW results
  let nsopwResults = 'Not searched';
  if (result.nsopw) {
    const offenderCount = result.nsopw.offenders ? result.nsopw.offenders.length : 0;
    nsopwResults = `Found ${offenderCount} offenders`;
  }
  
  // Format UCAOR results
  let ucaorResults = 'Not searched';
  if (result.ucaor) {
    ucaorResults = result.ucaor.results || 'No results';
  }
  
  // Create notes field with additional information
  const notes = [];
  if (result.nsopw && result.nsopw.offenders && result.nsopw.offenders.length > 0) {
    notes.push(`NSOPW offender names: ${result.nsopw.offenders.map(o => 
      `${o.name.givenName} ${o.name.surName}`).join(', ')}`);
  }
  
  return createCSVRow([
    memberName,
    formatDate(result.timestamp),
    nsopwResults,
    ucaorResults,
    confirmationStatus,
    counselor1,
    counselor2,
    notes.join('; ')
  ]);
}

// Export the function
export { exportReportToCSV }; 