document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const searchButton = document.getElementById('searchButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsList = document.getElementById('resultsList');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const confirmationContainer = document.getElementById('confirmationContainer');
    const counselor1Checkbox = document.getElementById('counselor1');
    const counselor2Checkbox = document.getElementById('counselor2');
    const positiveResultsCheckbox = document.getElementById('positiveResults');
    const confirmButton = document.getElementById('confirmButton');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const retryContainer = document.getElementById('retryContainer');
    const retryButton = document.getElementById('retryButton');
    
    // Batch processing information display
    let batchInfoContainer = document.createElement('div');
    batchInfoContainer.id = 'batchInfoContainer';
    batchInfoContainer.style.display = 'none';
    batchInfoContainer.style.backgroundColor = '#f0f8ff';
    batchInfoContainer.style.padding = '10px';
    batchInfoContainer.style.marginBottom = '20px';
    batchInfoContainer.style.borderRadius = '4px';
    batchInfoContainer.style.border = '1px solid #b8daff';
    batchInfoContainer.innerHTML = `
        <h3 style="margin-top: 0; color: #004085;">Batch Processing Mode</h3>
        <p>Currently processing: <span id="currentBatchMember">...</span></p>
        <p>Progress: <span id="batchProgress">...</span></p>
        <button id="pauseBatchProcess" style="margin-top: 10px; padding: 8px 16px; background-color: #ffc107; color: #000; border: none; border-radius: 4px; cursor: pointer;">Pause Processing</button>
    `;
    document.querySelector('.search-container').insertBefore(batchInfoContainer, searchForm);
    
    // Current search results to be confirmed
    let currentSearchResults = null;

    // Search parameters for potential retry
    let lastSearchParams = null;

    // Import search functions
    import('./nsopwSearch.js').then(nsopwModule => {
        const { searchNSOPW } = nsopwModule;
        window.searchNSOPW = searchNSOPW;
    }).catch(error => {
        console.error('Error loading NSOPW search module:', error);
    });

    import('./ucaorSearch.js').then(ucaorModule => {
        const { getOffenderCountRegexOnly } = ucaorModule;
        window.getOffenderCountRegexOnly = getOffenderCountRegexOnly;
    }).catch(error => {
        console.error('Error loading UCAOR search module:', error);
    });
    
    // Check for any search parameters passed from the popup
    chrome.storage.local.get('advancedSearchParams', function(data) {
        if (data.advancedSearchParams) {
            // Populate the name fields
            if (data.advancedSearchParams.firstName) {
                firstNameInput.value = data.advancedSearchParams.firstName;
            }
            if (data.advancedSearchParams.lastName) {
                lastNameInput.value = data.advancedSearchParams.lastName;
            }
            
            // Check if this is part of batch processing
            if (data.advancedSearchParams.searchType === 'batch') {
                // Show batch processing info
                batchInfoContainer.style.display = 'block';
                document.getElementById('currentBatchMember').textContent = 
                    `${data.advancedSearchParams.firstName} ${data.advancedSearchParams.lastName}`;
                document.getElementById('batchProgress').textContent = 
                    `${data.advancedSearchParams.batchIndex + 1} of ${data.advancedSearchParams.totalMembers}`;
            }
            
            // Store search parameters for potential retry
            lastSearchParams = {
                firstName: data.advancedSearchParams.firstName,
                lastName: data.advancedSearchParams.lastName,
                searchType: data.advancedSearchParams.searchType,
                batchIndex: data.advancedSearchParams.batchIndex,
                totalMembers: data.advancedSearchParams.totalMembers,
                isResearch: data.advancedSearchParams.isResearch || false,
                researchTimestamp: data.advancedSearchParams.researchTimestamp || null
            };
            
            // Clear the stored parameters after use
            chrome.storage.local.remove('advancedSearchParams');
            
            // If both names are provided and autoSearch is true, automatically trigger the search
            if (data.advancedSearchParams.firstName && data.advancedSearchParams.lastName) {
                // Small delay to ensure everything is loaded
                setTimeout(() => {
                    if (data.advancedSearchParams.autoSearch) {
                        searchButton.click();
                    }
                }, 500);
            }
        }
    });

    // Add event listener for retry button
    retryButton.addEventListener('click', function() {
        // Hide error message and retry button
        errorMessage.textContent = '';
        errorMessage.classList.remove('visible');
        retryContainer.style.display = 'none';
        
        // Use the stored search parameters or get from input fields
        const firstName = lastSearchParams ? lastSearchParams.firstName : firstNameInput.value.trim();
        const lastName = lastSearchParams ? lastSearchParams.lastName : lastNameInput.value.trim();
        
        // Update input fields if needed
        firstNameInput.value = firstName;
        lastNameInput.value = lastName;
        
        // Trigger the search
        searchButton.click();
    });

    // Update the confirm button state based on checkbox changes
    function updateConfirmButtonState() {
        confirmButton.disabled = !(counselor1Checkbox.checked && counselor2Checkbox.checked);
    }

    counselor1Checkbox.addEventListener('change', updateConfirmButtonState);
    counselor2Checkbox.addEventListener('change', updateConfirmButtonState);

    // Handle confirm button click
    confirmButton.addEventListener('click', function() {
        if (!currentSearchResults) return;
        
        const confirmationData = {
            searchedName: currentSearchResults.searchedName,
            results: {
                nsopw: currentSearchResults.nsopw ? 
                    (currentSearchResults.nsopw.offenders ? 
                        `Found ${currentSearchResults.nsopw.offenders.length} offenders` : 
                        'No results') : 
                    'Not searched',
                ucaor: currentSearchResults.ucaor ? 
                    currentSearchResults.ucaor.results : 
                    'Not searched'
            },
            timestamp: new Date().toISOString(),
            confirmedBy: {
                counselor1: counselor1Checkbox.checked,
                counselor2: counselor2Checkbox.checked
            },
            positiveMatch: positiveResultsCheckbox.checked,
            searchKey: currentSearchResults.searchKey,
            isResearch: lastSearchParams?.isResearch || false
        };
        
        // Save confirmation to storage
        chrome.storage.local.set({
            'counselorConfirmation': confirmationData
        }, function() {
            // Update the current search results to include confirmation
            currentSearchResults.confirmed = confirmationData;
            
            // If this is a re-search, update the results by creating a new key
            // This ensures the most recent search will be displayed in the results page
            const searchTimestamp = new Date().toISOString().replace(/[:.]/g, '_');
            const searchKey = lastSearchParams?.isResearch ? 
                `search_${searchTimestamp}` : currentSearchResults.searchKey;
            
            // Also update the stored search results
            chrome.storage.local.set({
                [searchKey]: currentSearchResults,
                'lastSearchResults': currentSearchResults
            });
            
            // Record this member as processed to avoid duplicates in batch processing
            if (currentSearchResults.searchedName) {
                chrome.storage.local.get(['processedMemberNames'], function(data) {
                    let processed = data.processedMemberNames || [];
                    const fullName = currentSearchResults.searchedName.toLowerCase();
                    
                    if (!processed.includes(fullName)) {
                        processed.push(fullName);
                        chrome.storage.local.set({ 'processedMemberNames': processed });
                    }
                });
            }
            
            // Show confirmation message
            confirmationMessage.classList.add('visible');
            
            // Disable checkboxes and confirm button after confirmation
            counselor1Checkbox.disabled = true;
            counselor2Checkbox.disabled = true;
            positiveResultsCheckbox.disabled = true;
            confirmButton.disabled = true;
            
            // Notify any open results pages to refresh
            chrome.runtime.sendMessage({
                action: 'searchConfirmed',
                searchResults: currentSearchResults
            });
            
            // Check if this is part of batch processing
            chrome.storage.local.get('batchProcessing', function(data) {
                if (data.batchProcessing && data.batchProcessing.isActive) {
                    // Notify the batch processor that this member is completed
                    chrome.runtime.sendMessage({
                        action: 'memberSearchConfirmed',
                        searchResults: currentSearchResults
                    });
                    
                    // Auto-close this tab after a short delay
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                }
            });
        });
    });

    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();

        // Save search parameters for potential retry
        lastSearchParams = {
            firstName: firstName,
            lastName: lastName
        };

        if (!firstName || !lastName) {
            errorMessage.textContent = 'Please enter both first name and last name';
            errorMessage.classList.add('visible');
            return;
        }

        // Reset UI
        errorMessage.textContent = '';
        errorMessage.classList.remove('visible');
        resultsContainer.classList.remove('visible');
        confirmationContainer.classList.remove('visible');
        confirmationMessage.classList.remove('visible');
        retryContainer.style.display = 'none';
        counselor1Checkbox.checked = false;
        counselor2Checkbox.checked = false;
        positiveResultsCheckbox.checked = false;
        counselor1Checkbox.disabled = false;
        counselor2Checkbox.disabled = false;
        positiveResultsCheckbox.disabled = false;
        confirmButton.disabled = true;
        resultsList.innerHTML = '';
        
        // Show loading state
        loadingIndicator.classList.add('visible');
        searchButton.disabled = true;

        try {
            // Initialize results container
            resultsList.innerHTML = '<h3>Search Results</h3>';
            
            // Run searches in parallel
            const searchPromises = [];
            let nsopwResults = null;
            let ucaorResults = null;
            
            // NSOPW Search
            const nsopwPromise = chrome.runtime.sendMessage({
                action: 'performNSOPWSearch',
                searchParams: {
                    firstName: firstName,
                    lastName: lastName
                }
            }).then(response => {
                if (response.error) {
                    const nsopwErrorDiv = document.createElement('div');
                    nsopwErrorDiv.className = 'error-section';
                    nsopwErrorDiv.innerHTML = `<p>NSOPW Search Error: ${response.error}</p>`;
                    resultsList.appendChild(nsopwErrorDiv);
                    
                    // Show retry button for NSOPW search errors
                    retryContainer.style.display = 'block';
                } else {
                    nsopwResults = response.results;
                    displayNSOPWResults(response.results);
                }
            }).catch(error => {
                const nsopwErrorDiv = document.createElement('div');
                nsopwErrorDiv.className = 'error-section';
                nsopwErrorDiv.innerHTML = `<p>NSOPW Search Error: ${error.message || "Unknown error"}</p>`;
                resultsList.appendChild(nsopwErrorDiv);
                
                // Show retry button for NSOPW search errors
                retryContainer.style.display = 'block';
            });
            
            searchPromises.push(nsopwPromise);
            
            // UCAOR Search
            const ucaorPromise = (async () => {
                try {
                    // Perform UCAOR search directly
                    const offenderCount = await window.getOffenderCountRegexOnly(firstName, lastName);
                    
                    // Create a result object
                    ucaorResults = {
                        searchType: 'UCAOR',
                        searchedName: `${firstName} ${lastName}`,
                        results: offenderCount !== null ? `Found ${offenderCount} offenders` : 'Search failed',
                        timestamp: new Date().toISOString(),
                        source: 'Utah Sex Offender Registry',
                        url: `https://www.icrimewatch.net/results.php?AgencyID=56564&SubmitNameSearch=1&OfndrLast=${encodeURIComponent(lastName)}&OfndrFirst=${encodeURIComponent(firstName)}&OfndrCity=`,
                        offenderCount: offenderCount
                    };
                    
                    if (offenderCount === null) {
                        // Show retry button for failed UCAOR search
                        retryContainer.style.display = 'block';
                    }
                    
                    // Display UCAOR results
                    displayUCAORResults(ucaorResults);
                } catch (error) {
                    const ucaorErrorDiv = document.createElement('div');
                    ucaorErrorDiv.className = 'error-section';
                    ucaorErrorDiv.innerHTML = `<p>UCAOR Search Error: ${error.message}</p>`;
                    resultsList.appendChild(ucaorErrorDiv);
                    
                    // Show retry button for UCAOR search errors
                    retryContainer.style.display = 'block';
                }
            })();
            searchPromises.push(ucaorPromise);
            
            // Wait for all searches to complete
            await Promise.all(searchPromises);
            
            // Store combined results
            if (nsopwResults || ucaorResults) {
                const timestamp = new Date().toISOString();
                const searchKey = `search_${timestamp.replace(/[:.]/g, '_')}`;
                
                // Ensure consistent formatting of searchedName
                const standardizedName = `${firstName} ${lastName}`;
                
                const combinedResults = {
                    searchKey: searchKey,
                    timestamp: timestamp,
                    nsopw: nsopwResults,
                    ucaor: ucaorResults,
                    searchedName: standardizedName,
                    confirmed: false
                };
                
                // Save current search results for confirmation
                currentSearchResults = combinedResults;
                
                // Store in local storage
                chrome.storage.local.set({ 
                    [searchKey]: combinedResults,
                    'lastSearchResults': combinedResults
                });
                
                // Show the confirmation container
                confirmationContainer.classList.add('visible');
            }
            
            resultsContainer.classList.add('visible');

        } catch (error) {
            errorMessage.textContent = `Error: ${error.message}`;
            errorMessage.classList.add('visible');
            
            // Show retry button when search fails
            retryContainer.style.display = 'block';
        } finally {
            loadingIndicator.classList.remove('visible');
            searchButton.disabled = false;
        }
    });

    function displayNSOPWResults(results) {
        const nsopwSection = document.createElement('div');
        nsopwSection.className = 'results-section nsopw-results';
        
        if (!results || !results.offenders || results.offenders.length === 0) {
            nsopwSection.innerHTML = `
                <h3>NSOPW Search Results</h3>
                <p>No offenders found in the National Sex Offender Public Website registry.</p>
            `;
            resultsList.appendChild(nsopwSection);
            return;
        }

        nsopwSection.innerHTML = `
            <h3>NSOPW Search Results</h3>
            <p>Found ${results.offenders.length} offenders in the National Sex Offender Public Website registry.</p>
        `;
        
        const offendersContainer = document.createElement('div');
        offendersContainer.className = 'offenders-container';

        results.offenders.forEach(offender => {
            const offenderCard = document.createElement('div');
            offenderCard.className = 'offender-card';
            offenderCard.innerHTML = `
                ${offender.imageUri ? `<img src="${offender.imageUri}" alt="Offender photo">` : ''}
                <div class="offender-info">
                    <p><strong>Name:</strong> ${offender.name.givenName} ${offender.name.middleName || ''} ${offender.name.surName}</p>
                    <p><strong>Age:</strong> ${offender.age}</p>
                    <p><strong>Gender:</strong> ${offender.gender}</p>
                    <p><strong>Date of Birth:</strong> ${new Date(offender.dob).toLocaleDateString()}</p>
                    ${offender.locations && offender.locations.length > 0 ? `
                        <p><strong>Location:</strong> ${offender.locations[0].streetAddress}, ${offender.locations[0].city}, ${offender.locations[0].state} ${offender.locations[0].zipCode}</p>
                    ` : ''}
                    ${offender.offenderUri ? `
                        <p><a href="${offender.offenderUri}" target="_blank">View Details</a></p>
                    ` : ''}
                </div>
            `;
            offendersContainer.appendChild(offenderCard);
        });
        
        nsopwSection.appendChild(offendersContainer);
        resultsList.appendChild(nsopwSection);
    }

    function displayUCAORResults(results) {
        const ucaorSection = document.createElement('div');
        ucaorSection.className = 'results-section ucaor-results';
        
        // Create the UCAOR URL
        const ucaorUrl = `https://www.icrimewatch.net/results.php?AgencyID=56564&SubmitNameSearch=1&OfndrLast=${encodeURIComponent(results.lastName || '')}&OfndrFirst=${encodeURIComponent(results.firstName || '')}&OfndrCity=`;
        
        ucaorSection.innerHTML = `
            <h3>UCAOR Search Results</h3>
            <p>${results.results}</p>
            <p>To view details or perform a manual search, visit the <a href="${ucaorUrl}" target="_blank">Utah Sex Offender Registry</a>.</p>
        `;
        
        resultsList.appendChild(ucaorSection);
    }

    // Add pause button functionality
    const pauseButton = document.getElementById('pauseBatchProcess');
    if (pauseButton) {
        pauseButton.addEventListener('click', function() {
            // Store the current state
            chrome.storage.local.get('batchProcessing', function(data) {
                if (data.batchProcessing) {
                    // Update the batch processing state to paused
                    chrome.storage.local.set({
                        'batchProcessing': {
                            ...data.batchProcessing,
                            isPaused: true,
                            pausedAt: {
                                member: `${lastSearchParams.firstName} ${lastSearchParams.lastName}`,
                                index: lastSearchParams.batchIndex,
                                timestamp: new Date().toISOString()
                            }
                        }
                    }, function() {
                        // Update the button text
                        pauseButton.textContent = 'Processing Paused';
                        pauseButton.style.backgroundColor = '#ffc107';
                        pauseButton.disabled = true;
                        
                        // Show a message to the user
                        const statusMessage = document.createElement('div');
                        statusMessage.style.marginTop = '10px';
                        statusMessage.style.padding = '10px';
                        statusMessage.style.backgroundColor = '#fff3cd';
                        statusMessage.style.border = '1px solid #ffeeba';
                        statusMessage.style.borderRadius = '4px';
                        statusMessage.style.color = '#856404';
                        statusMessage.innerHTML = `
                            <p><strong>Processing Paused</strong></p>
                            <p>You can close this tab and continue later from where you left off.</p>
                            <p>Current member: ${lastSearchParams.firstName} ${lastSearchParams.lastName}</p>
                        `;
                        batchInfoContainer.appendChild(statusMessage);
                    });
                }
            });
        });
    }
}); 