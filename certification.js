/**
 * Certification Module
 * Handles member certification functionality for the Sex Offender Registry Checker extension
 */

// Keep track of all tabs opened during certification
let certificationTabs = [];
let isBatchProcessing = false;

// Function to look up member and get profile URL
async function getMemberProfileLink(firstName, lastName, timestamp) {
  // Clear any previously tracked tabs for this new certification
  certificationTabs = [];
  
  // Check if this is part of a batch process
  chrome.storage.local.get('isBatchProcessing', (data) => {
    isBatchProcessing = !!data.isBatchProcessing;
  });
  
  // First, we'll use chrome.tabs API to open the LCR member list
  chrome.tabs.create({
    url: 'https://lcr.churchofjesuschrist.org/records/member-list?lang=eng',
    active: true
  }, function(tab) {
    // Store this tab ID for later cleanup
    certificationTabs.push(tab.id);
    
    // We need to wait for the page to load before injecting the script
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        // Remove the listener to avoid multiple executions
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Wait a bit before injecting script to ensure page is fully rendered
        setTimeout(() => {
          console.log("Page loaded, preparing to inject script...");
          
          // Execute script in the context of the LCR page
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: function(firstName, lastName, originalTimestamp) {
              // Add debug console logging
              console.log("%c Sex Offender Registry Certification Extension - Debug Mode", "background: #34a853; color: white; padding: 5px; border-radius: 3px;");
              
              // This function runs in the context of the LCR page
              setTimeout(async function() {
                try {
                  const fullName = `${firstName} ${lastName}`;
                  const encodedName = encodeURIComponent(fullName.toLowerCase());
                  // Generate a NEW timestamp for the API call
                  const apiTimestamp = Date.now(); 
                  
                  console.log("Searching for member:", fullName);
                  
                  // Make the API request using the new timestamp
                  const apiUrl = `https://mltp-api.churchofjesuschrist.org/api/member-lookup?term=${encodedName}&timestamp=${apiTimestamp}`;
                  
                  const response = await fetch(apiUrl, {
                    method: "GET",
                    headers: {
                      "accept": "application/json",
                      "accept-language": "en-US,en;q=0.9"
                    },
                    credentials: "include"
                  });
                  
                  if (!response.ok) {
                    alert(`Error: ${response.status} ${response.statusText}`);
                    return;
                  }
                  
                  const data = await response.json();
                  console.log("Member data:", data);
                  
                  if (data && data.memberResults && data.memberResults.length > 0) {
                    const uuid = data.memberResults[0].uuid;
                    const profileUrl = `https://lcr.churchofjesuschrist.org/records/member-profile/${uuid}`;
                    
                    console.log("Navigating to profile:", profileUrl);
                    
                    // Store member info and the ORIGINAL timestamp in sessionStorage
                    sessionStorage.setItem('certificationMemberName', fullName);
                    sessionStorage.setItem('certificationMemberUuid', uuid);
                    sessionStorage.setItem('certificationTimestamp', originalTimestamp); // Store the original one
                    
                    // Navigate to the profile page
                    window.location.href = profileUrl;
                    
                    // This will run after navigation, so we need to set up handling for the new page
                    // Set a flag in sessionStorage to trigger certification process after navigation
                    sessionStorage.setItem('runCertificationProcess', 'true');
                  } else {
                    alert(`No member found with name: ${fullName}`);
                    
                    // Signal completion with failure
                    chrome.runtime.sendMessage({
                      action: "certificationStatusUpdate",
                      timestamp: originalTimestamp,
                      status: "Failed",
                      details: "No member found"
                    });
                  }
                } catch (error) {
                  console.error("Error searching for member:", error);
                  alert(`Error: ${error.message}`);
                  
                  // Signal completion with failure
                  chrome.runtime.sendMessage({
                    action: "certificationStatusUpdate",
                    timestamp: originalTimestamp,
                    status: "Failed",
                    details: `Search error: ${error.message}`
                  });
                }
              }, 2000);  // Increased delay to 2 seconds to make sure page is fully loaded
            },
            args: [firstName, lastName, timestamp]
          });
          
          // Now set up a listener to run when the page navigates to the profile
          chrome.tabs.onUpdated.addListener(function profileListener(tabId, changeInfo, tab) {
            // Check if this is the tab we're interested in and if it's loaded
            if (tabId === tab.id && changeInfo.status === 'complete') {
              // Check if this is a member profile page
              if (tab.url && tab.url.includes('lcr.churchofjesuschrist.org/records/member-profile/')) {
                // Store this new profile tab ID
                certificationTabs.push(tabId);
                
                // Remove this listener to avoid multiple triggers
                chrome.tabs.onUpdated.removeListener(profileListener);
                
                // Execute the certification script on the profile page
                setTimeout(() => {
                  chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    function: processCertificationTab
                  });
                }, 3000); // Wait 3 seconds after profile page loads
              }
            }
          });
        }, 1000);
      }
    });
  });
}

// Function to process the certification tab and add a certification if needed
function processCertificationTab() {
  // Check if we should run the certification process
  if (sessionStorage.getItem('runCertificationProcess') === 'true') {
    // Clear the flag
    sessionStorage.removeItem('runCertificationProcess');
    
    // Get member info and timestamp from sessionStorage
    const memberName = sessionStorage.getItem('certificationMemberName') || 'Unknown Member';
    const timestamp = sessionStorage.getItem('certificationTimestamp');
    
    console.log(`Starting certification process for ${memberName}... (Timestamp: ${timestamp})`);
    
    // Helper function to send status updates back to the results page
    function updateCertificationStatus(status, details = null) {
      if (!timestamp) {
        console.error("Cannot update status: Timestamp is missing from sessionStorage.");
        return;
      }
      console.log(`Sending status update: ${status}`, details ? details : '');
      chrome.runtime.sendMessage({
        action: "certificationStatusUpdate",
        timestamp: timestamp,
        status: status,
        details: details
      });
      
      // For batch processing, auto-close this tab after a short delay
      const isBatchProcessing = sessionStorage.getItem('isBatchProcessing') === 'true';
      if (isBatchProcessing) {
        setTimeout(() => {
          // Signal to close all certification tabs
          chrome.runtime.sendMessage({
            action: "closeCertificationTabs",
            timestamp: timestamp
          });
        }, 2000);
      }
    }
    
    // Store batch processing state
    const pageIsBatchProcessing = sessionStorage.getItem('isBatchProcessing') === 'true';
    console.log(`Batch processing: ${pageIsBatchProcessing}`);
    
    // Debug function to log all li elements 
    function debugElements() {
      console.log("Debugging all navigation elements:");
      
      // Get all the list items in the page
      const allLIs = document.querySelectorAll('li');
      console.log(`Found ${allLIs.length} list items in total`);
      
      // Log all li elements that contain anchor tags
      const liWithAnchors = document.querySelectorAll('li a');
      console.log(`Found ${liWithAnchors.length} list items with anchor tags`);
      
      // Log the text content of each
      liWithAnchors.forEach((a, index) => {
        console.log(`Anchor ${index}:`, a.textContent.trim());
      });
      
      // Specifically look for anything related to certification
      const certElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.toLowerCase().includes('certif')
      );
      
      console.log(`Found ${certElements.length} elements containing 'certif' text`);
      certElements.forEach((el, i) => {
        console.log(`Certification element ${i}:`, el.tagName, el.className, el.textContent.trim());
      });
    }
    
    // Start the certification process after a delay
    setTimeout(async function() {
      try {
        console.log("Looking for certification tab...");
        
        // Debug to see what's available
        debugElements();
        
        // Try a broader selector first to find navigation tabs
        const allLiWithA = document.querySelectorAll('li a');
        console.log(`Found ${allLiWithA.length} potential navigation tabs`);
        
        // Try to find the certification tab manually first
        const certificationTab = Array.from(allLiWithA).find(a => 
          a.textContent && a.textContent.toLowerCase().includes('certif')
        );
        
        if (certificationTab) {
          console.log("Found certification tab:", certificationTab);
          certificationTab.click();
          console.log("Clicked certification tab");
          
          // Increase timeout to ensure certifications are fully loaded
          setTimeout(async () => {
            try {
              console.log("Checking for existing certifications...");
              
              // Wait briefly to ensure any dynamic content is loaded
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Function to find certification rows with multiple approaches
              function findCertificationRows() {
                // Try multiple selectors in order of specificity
                const selectors = [
                  'table[role="grid"] tbody tr',
                  'div.table-responsive table tr',
                  'table.table tr',
                  'table tr'
                ];
                
                for (const selector of selectors) {
                  const rows = document.querySelectorAll(selector);
                  if (rows && rows.length > 0) {
                    console.log(`Found ${rows.length} rows using selector: ${selector}`);
                    return rows;
                  }
                }
                
                // If no rows found, try looking for any element containing cert text
                const certElements = Array.from(document.querySelectorAll('*')).filter(el => 
                  el.textContent && 
                  (el.textContent.toLowerCase().includes('certification') || 
                   el.textContent.toLowerCase().includes('utah 2024'))
                );
                
                if (certElements.length > 0) {
                  console.log(`Found ${certElements.length} elements containing certification text`);
                  return certElements;
                }
                
                return [];
              }
              
              // Add retry mechanism for finding certification rows
              let retryAttempt = 0;
              const maxRetries = 3;
              let existingCertRows = [];
              
              // First attempt
              existingCertRows = findCertificationRows();
              
              // Retry if no rows found
              while (existingCertRows.length === 0 && retryAttempt < maxRetries) {
                console.log(`No certification rows found, retrying... (Attempt ${retryAttempt + 1}/${maxRetries})`);
                // Wait longer between attempts
                await new Promise(resolve => setTimeout(resolve, 2000));
                existingCertRows = findCertificationRows();
                retryAttempt++;
              }
              
              let alreadyExists = false;
              const targetCertName = "Utah 2024 Youth Service Organizations";
              
              console.log(`Found ${existingCertRows.length} potential certification elements after ${retryAttempt} retry attempts`);
              
              // Take a screenshot of the page content for debugging
              console.log("Page title:", document.title);
              console.log("Current URL:", window.location.href);
              
              // Check the entire page content as a last resort
              const pageContent = document.body.textContent || '';
              if (pageContent.includes(targetCertName)) {
                console.log(`MATCH FOUND in page content: Page contains "${targetCertName}"`);
                alreadyExists = true;
              }
              
              // Additional check for any element that might contain our target text
              const allElements = document.querySelectorAll('*');
              console.log(`Checking ${allElements.length} DOM elements for target text...`);
              
              for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i];
                if (el.textContent && el.textContent.includes(targetCertName)) {
                  console.log(`Found target text in element:`, el.tagName, el.className);
                  console.log(`Element content:`, el.textContent.trim());
                  alreadyExists = true;
                  break;
                }
              }
              
              // Log all certification rows for debugging
              existingCertRows.forEach((row, index) => {
                console.log(`Row ${index} HTML:`, row.innerHTML);
                console.log(`Row ${index} text content:`, row.textContent.trim());
              });
              
              // Check each row for the target certification
              existingCertRows.forEach((row, index) => {
                // First check if the entire row text contains our target
                const rowText = row.textContent.trim();
                // Only check non-empty rows, and require exact match or very close match
                if (rowText && rowText.includes(targetCertName)) {
                  // Make sure it's not just a header or empty element that happens to contain the word "certification"
                  // Ensure we've found a complete enough match (should be more than just "certification")
                  if (rowText.length > targetCertName.length / 2) {
                    alreadyExists = true;
                    console.log(`MATCH FOUND in row text: "${rowText}" contains "${targetCertName}"`);
                    return;
                  }
                }
                
                // Try multiple approaches to find the certification name
                const certNameElement = row.querySelector('td:first-child') || 
                                       row.querySelector('td') || 
                                       row.firstElementChild;
                
                if (certNameElement) {
                  const certName = certNameElement.textContent.trim();
                  console.log(`Row ${index} certification name: "${certName}"`);
                  
                  // Only consider non-empty certification names
                  if (certName && certName.length > 0) {
                    // For full string comparison, require more precision
                    if (certName === targetCertName) {
                      alreadyExists = true;
                      console.log(`EXACT MATCH FOUND: "${certName}" matches target "${targetCertName}"`);
                    }
                    // For partial match, ensure it's a substantial match (at least 70% of the target length)
                    else if ((certName.includes(targetCertName) || targetCertName.includes(certName)) && 
                             certName.length > (targetCertName.length * 0.7)) {
                      alreadyExists = true;
                      console.log(`PARTIAL MATCH FOUND: "${certName}" matches target "${targetCertName}"`);
                    }
                    // Exclude just "Certification" text by itself
                    else if (certName.toLowerCase() === "certification") {
                      console.log(`Ignoring generic "Certification" header text`);
                    }
                  } else {
                    console.log(`Ignoring empty certification name in row ${index}`);
                  }
                }
              });
              
              // Check for LCR alert notifications about existing certification
              const alertMessages = document.querySelectorAll('.alert, .notification, .message, [role="alert"]');
              alertMessages.forEach(alert => {
                const alertText = alert.textContent.trim();
                console.log(`Found alert/notification with text: "${alertText}"`);
                if (alertText.includes(targetCertName) && 
                    (alertText.includes('already exists') || 
                     alertText.includes('No action taken'))) {
                  console.log(`Found alert message about existing certification: "${alertText}"`);
                  alreadyExists = true;
                }
              });
              
              // Look specifically for the message format shown in the screenshot
              // "lcr.churchofjesuschrist.org says
              // Certification 'Utah 2024 Youth Service Organizations' already exists for this member. No action taken."
              const pageText = document.body.textContent;
              if (pageText.includes(`'${targetCertName}'`) && 
                  (pageText.includes('already exists') || 
                   pageText.includes('No action taken'))) {
                console.log('Found specific "already exists" text in page that matches the alert format');
                alreadyExists = true;
              }
              
              // Also look for elements containing this specific text pattern
              const alertElements = Array.from(document.querySelectorAll('*')).filter(el => {
                const text = el.textContent?.trim();
                return text && 
                       text.includes(`'${targetCertName}'`) && 
                       (text.includes('already exists') || 
                        text.includes('No action taken'));
              });
              
              if (alertElements.length > 0) {
                console.log(`Found ${alertElements.length} elements with specific certification exists message`);
                alertElements.forEach((el, i) => {
                  console.log(`Alert element ${i}:`, el.tagName, el.className, el.textContent.trim());
                });
                alreadyExists = true;
              }
              
              // Check if there's an alert popup visible (like the one in the screenshot)
              const dialogExists = document.querySelector('.ui-dialog, .modal, dialog, [role="dialog"]');
              if (dialogExists) {
                console.log('Found dialog/modal element:', dialogExists.outerHTML);
                
                // Check if dialog contains the site name and certification text
                const dialogText = dialogExists.textContent.trim();
                if (dialogText.includes('lcr.churchofjesuschrist.org') && 
                    dialogText.includes(targetCertName)) {
                  console.log(`Dialog contains certification info: "${dialogText}"`);
                  alreadyExists = true;
                  
                  // Since we found the dialog, try to automatically click the OK button
                  // to dismiss it and avoid manual intervention
                  const okButton = dialogExists.querySelector('button, .button, .btn');
                  if (okButton) {
                    console.log('Found OK button in dialog, clicking it...');
                    okButton.click();
                  }
                }
              }
              
              // Specifically look for a button that says "OK" within any kind of dialog
              const okButtons = document.querySelectorAll('button, .button, .btn');
              const okInDialog = Array.from(okButtons).find(btn => 
                btn.textContent.trim() === 'OK' && 
                (btn.closest('.ui-dialog, .modal, dialog, [role="dialog"]') || 
                 document.body.textContent.includes('Certification') && 
                 document.body.textContent.includes('already exists'))
              );
              
              if (okInDialog) {
                console.log('Found OK button in certification dialog:', okInDialog);
                alreadyExists = true;
              }
              
              if (alreadyExists) {
                console.log(`Certification '${targetCertName}' already exists for this member.`);
                updateCertificationStatus('Exists');
                if (!pageIsBatchProcessing) {
                  alert(`Certification '${targetCertName}' already exists for this member. No action taken.`);
                }
                return; // Stop the process
              }
              
              console.log("Target certification not found, proceeding to add...");
              
              // If not found, proceed to click Add Certification button
              console.log("Looking for Add Certification button...");
              
              // Debug to see what's available after checking
              const allLinks = document.querySelectorAll('a');
              console.log(`Found ${allLinks.length} links`);
              
              // Look for the add certification button
              const addButtons = Array.from(allLinks).filter(a => 
                a.textContent && a.textContent.includes('Add') &&
                a.textContent.includes('Certification')
              );
              
              console.log(`Found ${addButtons.length} potential Add Certification buttons`);
              
              const addCertButton = addButtons.length > 0 ? addButtons[0] : null;
              
              if (addCertButton) {
                console.log("Found Add Certification button:", addCertButton);
                addCertButton.click();
                console.log("Clicked Add Certification button");
                
                // Wait for form fields to appear
                setTimeout(async () => {
                  try {
                    console.log("Looking for certification form fields...");
                    
                    // Debug to see what form fields are available
                    const allInputs = document.querySelectorAll('input');
                    console.log(`Found ${allInputs.length} input fields in the form`);
                    allInputs.forEach((input, i) => {
                      console.log(`Input ${i}:`, input.id, input.type, input.className);
                    });
                    
                    // Try to find the name field with a broader approach
                    const nameInput = document.querySelector('#cert-name') || 
                                    document.querySelector('input[id*="cert"][id*="name"]') ||
                                    document.querySelector('input.ng-pristine[type="text"]');
                    
                    if (nameInput) {
                      console.log("Found certification name field:", nameInput);
                      nameInput.value = "Utah 2024 Youth Service Organizations";
                      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                      console.log("Set certification name");
                    } else {
                      console.error("Could not find certification name field");
                    }
                    
                    // Try to find the document ID field
                    const numberInput = document.querySelector('#cert-number') || 
                                      document.querySelector('input[id*="cert"][id*="number"]') ||
                                      document.querySelectorAll('input.ng-pristine[type="text"]')[1];
                    
                    if (numberInput) {
                      console.log("Found document ID field:", numberInput);
                      numberInput.value = "NA";
                      numberInput.dispatchEvent(new Event('input', { bubbles: true }));
                      console.log("Set document ID");
                    } else {
                      console.error("Could not find document ID field");
                    }
                    
                    // Try to find the expiration date field
                    const expirationInput = document.querySelector('#expirationDate') || 
                                          document.querySelector('input.hasDatepicker') ||
                                          document.querySelector('input[type="text"][id*="date"]');
                    
                    if (expirationInput) {
                      console.log("Found expiration date field:", expirationInput);
                      expirationInput.value = "NA";
                      expirationInput.dispatchEvent(new Event('input', { bubbles: true }));
                      expirationInput.dispatchEvent(new Event('change', { bubbles: true }));
                      console.log("Set expiration date");
                    } else {
                      console.error("Could not find expiration date field");
                    }
                    
                    console.log("Form filled out, looking for Add button...");
                    
                    // Wait for the Add button and click it
                    setTimeout(() => {
                      try {
                        // Get all buttons on the page
                        const allButtons = document.querySelectorAll('button');
                        console.log(`Found ${allButtons.length} buttons on the page`);
                        
                        allButtons.forEach((btn, i) => {
                          console.log(`Button ${i}:`, btn.textContent.trim(), btn.className);
                        });
                        
                        // Refined logic to find the correct Add button
                        let addButton = Array.from(document.querySelectorAll('button.btn.btn-primary')).find(b => 
                          b.textContent.trim() === 'Add'
                        );
                        
                        // Fallback if the primary selector doesn't work
                        if (!addButton) {
                          console.log("Primary selector failed, trying fallback...");
                          addButton = Array.from(document.querySelectorAll('button')).find(b => 
                            b.textContent.trim() === 'Add' || 
                            (b.textContent.trim().includes('Add') && !b.textContent.trim().includes('Cancel'))
                          );
                        }
                        
                        if (addButton) {
                          console.log("Found Add button:", addButton);
                          addButton.click();
                          console.log("Clicked Add button. Certification process complete!");
                          
                          // Show success message
                          setTimeout(() => {
                            updateCertificationStatus('Added');
                            if (!pageIsBatchProcessing) {
                              alert('Certification has been successfully added!');
                            }
                          }, 1000);
                        } else {
                          console.error("Add button not found or not accessible");
                          updateCertificationStatus('Failed', 'Add button not found');
                          if (!pageIsBatchProcessing) {
                            alert("Could not find the Add Certification button. Please try again or add certification manually.");
                          }
                        }
                      } catch (error) {
                        console.error("Error in final step:", error);
                        updateCertificationStatus('Failed', `Final step error: ${error.message}`);
                      }
                    }, 1500);
                    
                  } catch (error) {
                    console.error("Error filling out form:", error);
                    updateCertificationStatus('Failed', `Form filling error: ${error.message}`);
                  }
                }, 2500);
                
              } else {
                console.error("Add Certification button not found or not accessible");
                updateCertificationStatus('Failed', 'Add Certification button not found');
                if (!pageIsBatchProcessing) {
                  alert("Could not find the Add Certification button. Please try again or add certification manually.");
                }
              }
            } catch (error) {
              console.error("Error looking for Add Certification button:", error);
              updateCertificationStatus('Failed', `Finding Add button error: ${error.message}`);
            }
          }, 2500);
          
        } else {
          console.error("Certification tab not found or not accessible");
          updateCertificationStatus('Failed', 'Certification tab not found');
          if (!pageIsBatchProcessing) {
            alert("Could not find the Certification tab. The member may not have the necessary permissions for certification.");
          }
        }
      } catch (error) {
        console.error("Error starting certification process:", error);
        updateCertificationStatus('Failed', `Process start error: ${error.message}`);
      }
    }, 4000);
  }
}

// Function to close all tabs opened during certification
function closeAllCertificationTabs() {
  if (certificationTabs.length > 0) {
    console.log(`Closing ${certificationTabs.length} certification tabs: ${certificationTabs.join(', ')}`);
    
    // Remove each tab in the list
    certificationTabs.forEach(tabId => {
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          console.error(`Error closing tab ${tabId}: ${chrome.runtime.lastError.message}`);
        }
      });
    });
    
    // Clear the array
    certificationTabs = [];
  }
}

// Function to give certification to a user - public API
function giveUserCertification(firstName, lastName, timestamp) {
  // Store batch processing state for this certification
  chrome.storage.local.get('isBatchProcessing', (data) => {
    // Store the batch processing state in storage so it persists through navigation
    sessionStorage.setItem('isBatchProcessing', String(!!data.isBatchProcessing));
    
    // Start the certification process
    getMemberProfileLink(firstName, lastName, timestamp);
  });
}

// Export functions for use in other modules
export { giveUserCertification, closeAllCertificationTabs }; 