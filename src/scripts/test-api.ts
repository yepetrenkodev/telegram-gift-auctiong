/**
 * 🧪 API Test Script
 * 
 * Тестирование основных API endpoints для Этапа 1
 */

const BASE_URL = 'http://localhost:3000/api';

interface TestResult {
  name: string;
  success: boolean;
  response?: unknown;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    const response = await fn();
    results.push({ name, success: true, response });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ 
      name, 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
    console.log(`❌ ${name}: ${error}`);
  }
}

async function request(
  method: string, 
  path: string, 
  body?: unknown, 
  token?: string
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json() as Record<string, unknown>;
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
  }
  
  return data;
}

async function runTests(): Promise<void> {
  console.log('\n🧪 Starting API Tests for Stage 1\n');
  console.log('='.repeat(50));
  
  let token: string | undefined;
  let auctionId: string | undefined;
  let roundId: string | undefined;

  // 1. Health Check
  await runTest('Health Check', async () => {
    return request('GET', '/health');
  });

  // 2. Auth - Register/Login
  await runTest('Auth - Register/Login via Telegram', async () => {
    const data = await request('POST', '/users/auth/telegram', {
      telegramId: '111111111',
      firstName: 'Алексей',
      lastName: 'Иванов',
      username: 'alexey_whale',
    }) as { data: { token: string; user: { _id: string } } };
    
    token = data.data.token;
    return data;
  });

  // 3. Get Profile
  await runTest('Get User Profile', async () => {
    return request('GET', '/users/me/profile', undefined, token);
  });

  // 4. Get Balance
  await runTest('Get User Balance', async () => {
    return request('GET', '/users/me/balance', undefined, token);
  });

  // 5. Add Funds
  await runTest('Add Funds to Balance', async () => {
    return request('POST', '/users/me/balance/add', { amount: 1000 }, token);
  });

  // 6. Get Leaderboard
  await runTest('Get Leaderboard', async () => {
    return request('GET', '/users/leaderboard');
  });

  // 7. Get All Auctions
  await runTest('Get All Auctions', async () => {
    const data = await request('GET', '/auctions') as { data: Array<{ _id: string }> };
    if (data.data.length > 0) {
      auctionId = data.data[0]._id;
    }
    return data;
  });

  // 8. Get Specific Auction
  if (auctionId) {
    await runTest('Get Specific Auction', async () => {
      return request('GET', `/auctions/${auctionId}`);
    });

    // 9. Start Auction
    await runTest('Start Auction', async () => {
      const data = await request('POST', `/auctions/${auctionId}/start`, undefined, token) as { 
        data: { _id: string } 
      };
      return data;
    });

    // 10. Get Active Auctions
    await runTest('Get Active Auctions', async () => {
      return request('GET', '/auctions/active');
    });

    // 11. Get Current Round
    await runTest('Get Current Round', async () => {
      const data = await request('GET', `/auctions/${auctionId}/round`) as { data: { _id: string } };
      if (data.data) {
        roundId = data.data._id;
      }
      return data;
    });

    // 12. Place Bid
    if (roundId) {
      await runTest('Place Bid', async () => {
        return request('POST', '/bids', {
          auctionId,
          roundId,
          amount: 100,
        }, token);
      });

      // 13. Get Top Bids
      await runTest('Get Top Bids', async () => {
        return request('GET', `/bids/round/${roundId}/top`);
      });

      // 14. Get My Bid in Round
      await runTest('Get My Bid in Round', async () => {
        return request('GET', `/bids/round/${roundId}/my-bid`, undefined, token);
      });

      // 15. Check Winning Status
      await runTest('Check Winning Status', async () => {
        return request('GET', `/bids/round/${roundId}/winning-status`, undefined, token);
      });

      // 16. Get Minimum Bid
      await runTest('Get Minimum Bid', async () => {
        return request('GET', `/bids/round/${roundId}/minimum`);
      });

      // 17. Place Higher Bid (test anti-snipe)
      await runTest('Place Higher Bid', async () => {
        return request('POST', '/bids', {
          auctionId,
          roundId,
          amount: 150,
        }, token);
      });
    }

    // 18. Get Auction Leaderboard
    await runTest('Get Auction Leaderboard', async () => {
      return request('GET', `/auctions/${auctionId}/leaderboard`);
    });
  }

  // 19. Get Bid History
  await runTest('Get Bid History', async () => {
    return request('GET', '/bids/history', undefined, token);
  });

  // 20. Get Transaction History
  await runTest('Get Transaction History', async () => {
    return request('GET', '/users/me/transactions', undefined, token);
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Summary\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total:  ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n🏁 Tests completed!\n');
}

// Run tests
runTests().catch(console.error);
