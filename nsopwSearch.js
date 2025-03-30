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

// Export the function
export { searchNSOPW }; 