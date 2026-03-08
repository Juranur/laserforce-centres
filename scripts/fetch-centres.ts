interface Centre {
  id: string;
  regionSite: string;
  name: string;
  gamesTotal: number;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCentreGames(centreId: string, retries = 3): Promise<number> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const formData = new URLSearchParams();
      formData.append('requestId', '1');
      formData.append('regionId', '9999');
      formData.append('siteId', '9999');
      formData.append('memberRegion', '0');
      formData.append('memberSite', '0');
      formData.append('memberId', '0');
      formData.append('selectedCentreId', centreId);
      formData.append('selectedGroupId', '0');
      formData.append('selectedQueryType', '0');

      const response = await fetch('https://v2.iplaylaserforce.com/globalScoring.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        if (attempt < retries - 1) {
          await delay(1000 * (attempt + 1));
          continue;
        }
        return 0;
      }

      const data = await response.json();
      const gamesTotal = (data.top100 || []).reduce(
        (sum: number, player: { '3': number }) => sum + (player['3'] || 0),
        0
      );

      return gamesTotal;
    } catch {
      if (attempt < retries - 1) {
        await delay(1000 * (attempt + 1));
        continue;
      }
      return 0;
    }
  }
  return 0;
}

async function main() {
  console.log('Starting to fetch centres data...');
  console.log('This will take a few minutes.\n');

  // Fetch list of centres
  const centresFormData = new URLSearchParams();
  centresFormData.append('regionId', '9999');
  centresFormData.append('siteId', '9999');

  const centresResponse = await fetch('https://v2.iplaylaserforce.com/globalScoringDropdownInfo.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: centresFormData.toString(),
  });

  if (!centresResponse.ok) {
    throw new Error(`Failed to fetch centres: ${centresResponse.status}`);
  }

  const centresData = await centresResponse.json();
  const centreList = centresData.centres;
  const centres: Centre[] = [];

  console.log(`Found ${centreList.length} centres to process.\n`);

  // Process each centre
  for (let i = 0; i < centreList.length; i++) {
    const c = centreList[i];

    if (i > 0) {
      await delay(200);
    }

    const gamesTotal = await fetchCentreGames(c.centreId);

    centres.push({
      id: c.centreId,
      regionSite: c.regionSite,
      name: c.centre,
      gamesTotal: gamesTotal,
    });

    // Progress update every 10 centres
    if ((i + 1) % 10 === 0) {
      console.log(`Progress: ${i + 1}/${centreList.length} centres processed`);
    }
  }

  // Sort by games total descending
  centres.sort((a, b) => b.gamesTotal - a.gamesTotal);

  // Save to file
  const outputData = {
    lastUpdated: new Date().toISOString(),
    totalCentres: centres.length,
    centres: centres,
  };

  const fs = await import('fs/promises');
  await fs.writeFile('data/centres.json', JSON.stringify(outputData, null, 2));

  console.log(`\nDone! Saved ${centres.length} centres to data/centres.json`);
}

main().catch(console.error);
