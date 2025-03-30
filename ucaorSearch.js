// Function to get offender count from UCAOR registry
async function getOffenderCountRegexOnly(firstName, lastName) {
  // --- Configuration ---
  const agencyID = "56564";
  const baseUrl = "https://www.icrimewatch.net/results.php";
  // --- End Configuration ---

  if (!firstName || !lastName) {
    console.error("Error: Please provide both a first name and a last name.");
    return null;
  }

  console.log(`Fetching results for: ${firstName} ${lastName} to find offender count via regex...`);

  // Encode names and construct the URL
  const encodedFirstName = encodeURIComponent(firstName);
  const encodedLastName = encodeURIComponent(lastName);
  const searchUrl = `${baseUrl}?AgencyID=${agencyID}&SubmitNameSearch=1&OfndrLast=${encodedLastName}&OfndrFirst=${encodedFirstName}&OfndrCity=`;

  console.log(`Fetch URL: ${searchUrl}`);

  try {
    // Make the fetch request
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', // Simplified Accept header slightly
      },
      referrer: `https://www.icrimewatch.net/index.php?AgencyID=${agencyID}`,
      mode: 'cors',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const htmlText = await response.text();
    console.log("Successfully fetched page source.");

    // --- Extract Count using Regular Expression on Raw HTML ---

    // Regex to find "Found [digits] offenders" (case-insensitive, handles surrounding whitespace)
    // It looks for the literal string "Found ", captures one or more digits (\d+),
    // then looks for the literal string " offenders".
    // The 'i' flag makes it case-insensitive.
    const regex = /Found\s+(\d+)\s+offenders/i;
    const match = htmlText.match(regex);

    if (match && match[1]) {
      // match[0] would be the full matched string (e.g., "Found 0 offenders")
      // match[1] is the captured group (the digits)
      const offenderCount = parseInt(match[1], 10);
      console.log(`--- Offender Count Found (Regex): ${offenderCount} ---`);
      return offenderCount; // Return the extracted number
    } else {
      console.warn("Could not find the offender count pattern ('Found [number] offenders') in the HTML source.");
      // This could mean 0 offenders (if the text isn't present) or >0 offenders (if the text changes when results exist)
      // You might need to test with a known positive result to see if the text pattern holds.
      return null; // Indicate pattern not found
    }

  } catch (error) {
    console.error("Error during fetch or processing:", error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn("This might be a CORS issue. Ensure you are running this script from the console while on the 'www.icrimewatch.net' domain.");
    }
    // Add check for fetch itself being undefined
    if (error instanceof ReferenceError && error.message.includes('fetch')) {
         console.error("FATAL: fetch is not defined. Ensure you are running this in a standard browser console (F12 -> Console).");
    }
    return null; // Indicate failure due to error
  }
}

// Export the function
export { getOffenderCountRegexOnly }; 