import { NextResponse } from 'next/server';

interface Centre {
  id: string;
  regionSite: string;
  name: string;
  gamesTotal: number;
}

// Delay helper to avoid rate limiting
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch games total for a single centre with retries
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
          await delay(1000 * (attempt + 1)); // Exponential backoff
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

export async function GET() {
  try {
    // First, fetch the list of centres
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

    // Process centres one by one with delays to avoid rate limiting
    for (let i = 0; i < centreList.length; i++) {
      const c = centreList[i];
      
      // Add delay between requests (200ms) to avoid rate limiting
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
    }

    return NextResponse.json({ centres });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch centres', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
