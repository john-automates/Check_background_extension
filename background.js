// Function to search the NSOPW API
async function searchNSOPW(firstNameToSearch, lastNameToSearch) {
  const apiUrl = "https://nsopw-api.ojp.gov/nsopw/v1/v1.0/search";

  const allJurisdictions = ["ASTRIBE","AKCHIN","ACTRIBE","BLACKFEET","BOISFORTE","CADDO","CHEROKEE","CATRIBES","CHEYENNERIVER","CHICKASAW","CHIPPEWACREE","CHITIMACHA","POTAWATOMI","COCOPAH","CRIT","COMANCHE","CHEHALIS","YAKAMA","COLVILLETRIBES","CTUIR","WARMSPRINGS","CROWNATIONS","DNATION","NCCHEROKEE","ESTOO","ELY","FSST","FTBELKNAP","FTMCDOWELL","MOJAVEINDIANTRIBE","FORTPECKTRIBES","GRIC","GTB","HAVASUPAI","HOPI","HUALAPAI","IOWANATION","JICARILLA","KAIBABPAIUTE","KALISPELTRIBE","KAW","SANTODOMINGO","KBIC","KICKAPOO","ELWHA","LUMMI","MAKAH","MPTN","MITW","MESCALEROAPACHE","METLAKATLA","MIAMINATION","MICCOSUKEETRIBE","CHOCTAW","MODOC","MUSCOGEE","NAVAJO","NEZPERCE","NISQUALLY","NOOKSACK","NORTHERNARAPAHO","NORTHERNCHEYENNE","NHBPI","OGLALA","OHKAYOWINGEH","OMAHA","ONEIDA","OSAGE","OMTRIBE","OTTAWATRIBE","PASCUAYAQUI","PAWNEENATION","PEORIATRIBE","PCI","POKAGON","PORTGAMBLE","PBPNATION","SANIPUEBLO","PUEBLOOFACOMA","ISLETA","JEMEZ","LAGUNA","SANTAANA","ZUNI","PUYALLUPTRIBE","PLPT","QUAPAW","QUINAULT","REDLAKE","RSIC","ROSEBUD","SACANDFOXNATION","MESKWAKI","SRPMIC","SCAT","SANTEE","SAULTSAINTEMARIE","SEMINOLENATION","SCTRIBE","SHOALWATERBAY","SBTRIBES","SHOSHONEPAIUTE","SWO","SKOKOMISH","SPIRITLAKE","SPOKANETRIBE","SQUAXINISLAND","SRST","SUQUAMISH","TEMOAKTRIBE","MHANATION","TONATION","TONKAWA","TONTOAPACHE","TULALIP","TMBCI","UNITEDKEETOOWAHBAND","UPPERSKAGIT","UTETRIBE","WAMPANOAG","WASHOETRIBE","WMAT","WINNEBAGOTRIBE","WYANDOTTE","YANKTON","YAVAPAIAPACHE","YPIT","AL","AK","AMERICANSAMOA","AZ","AR","CA","CO","CT","DE","DC","FL","GA","GU","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","CNMI","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX","USVI","UT","VT","VA","WA","WV","WI","WY"];

  const searchPayload = {
    firstName: firstNameToSearch,
    lastName: lastNameToSearch,
    city: "",
    county: "",
    jurisdictions: allJurisdictions,
    clientIp: ""
  };

  console.log("Sending search for:", firstNameToSearch, lastNameToSearch);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "sec-ch-ua": "\"Chromium\";v=\"134\", \"Not:A-Brand\";v=\"24\", \"Google Chrome\";v=\"134\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site"
      },
      referrer: "https://www.nsopw.gov/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: JSON.stringify(searchPayload),
      mode: "cors",
      credentials: "omit"
    });

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error("Error details:", errorBody);
      return null;
    }

    const results = await response.json();
    console.log("Search Results:", results);
    return results;

  } catch (error) {
    console.error("Network or other error during fetch:", error);
    return null;
  }
}

// Import the UCAOR search function
import { getOffenderCountRegexOnly } from './ucaorSearch.js';

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startSearch') {
    // When the popup tells us to start searching, we'll wait for the page to load
    // then inject the content script
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
      if (tabId === message.tabId && changeInfo.status === 'complete') {
        // Remove this listener since we only need it once
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Execute the content script to start the search process
        chrome.scripting.executeScript({
          target: { tabId: message.tabId },
          func: initiateSearch,
          args: [message.isTest || false]
        });
      }
    });
  }
  
  // Check if a member matches a registry entry, sent from content script
  if (message.action === 'checkMatch') {
    const member = message.member;
    const registry = message.registry;
    
    // Simple matching logic - if both first and last name match
    const isMatch = 
      member.firstName.toLowerCase() === registry.firstName.toLowerCase() &&
      member.lastName.toLowerCase() === registry.lastName.toLowerCase();
    
    sendResponse({ isMatch });
    return true; // Keep the message channel open for the asynchronous response
  }
  
  // Store potential matches
  if (message.action === 'storePotentialMatch') {
    chrome.storage.local.get(['potentialMatches', 'isTestMode'], function(data) {
      let matches = data.potentialMatches || [];
      matches.push(message.match);
      
      chrome.storage.local.set({ 'potentialMatches': matches }, function() {
        sendResponse({ success: true });
        
        // If we're in test mode, send the results back to the popup when they're found
        if (data.isTestMode) {
          chrome.runtime.sendMessage({
            action: 'displayTestResults',
            matches: matches
          });
        }
      });
    });
    return true; // Keep the message channel open for the asynchronous response
  }
  
  // Test completed, return results to popup
  if (message.action === 'testCompleted') {
    chrome.storage.local.get('potentialMatches', function(data) {
      chrome.runtime.sendMessage({
        action: 'displayTestResults',
        matches: data.potentialMatches || []
      });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'performNSOPWSearch') {
    // Handle NSOPW search request
    handleNSOPWSearch(message.searchParams, sendResponse);
    return true; // Keep the message channel open for async response
  }

  if (message.action === 'performUCAORSearch') {
    // Handle UCAOR search request
    handleUCAORSearch(message.searchParams, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// This function will be injected into the page
function initiateSearch(isTest) {
  // Let the page know that we're starting a search
  chrome.runtime.sendMessage({ 
    action: 'searchStarted',
    isTest: isTest
  });
}

// Function to handle NSOPW search
async function handleNSOPWSearch(searchParams, sendResponse) {
  try {
    const results = await searchNSOPW(searchParams.firstName, searchParams.lastName);
    
    if (!results) {
      sendResponse({ error: 'No results found or search failed' });
      return;
    }

    // Send the results back
    sendResponse({ results: results });

  } catch (error) {
    console.error('Error in NSOPW search:', error);
    sendResponse({ error: error.message });
  }
}

// Function to handle UCAOR search
async function handleUCAORSearch(searchParams, sendResponse) {
  try {
    const offenderCount = await getOffenderCountRegexOnly(
      searchParams.firstName,
      searchParams.lastName
    );
    
    if (offenderCount === null) {
      sendResponse({ error: 'No results found or search failed' });
      return;
    }

    // Create a result structure similar to NSOPW
    const results = {
      searchType: 'UCAOR',
      offenderCount: offenderCount,
      searchedName: `${searchParams.firstName} ${searchParams.lastName}`,
      url: `https://www.icrimewatch.net/results.php?AgencyID=56564&SubmitNameSearch=1&OfndrLast=${encodeURIComponent(searchParams.lastName)}&OfndrFirst=${encodeURIComponent(searchParams.firstName)}&OfndrCity=`
    };

    // Send the results back
    sendResponse({ results: results });

  } catch (error) {
    console.error('Error in UCAOR search:', error);
    sendResponse({ error: error.message });
  }
} 