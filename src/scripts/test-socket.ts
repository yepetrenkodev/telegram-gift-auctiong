/**
 * 🧪 Socket.IO Test Script
 * 
 * Tests real-time functionality:
 * - Connection
 * - Auction join/leave
 * - Bid events
 * - Leaderboard updates
 * - Timer sync
 */

import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

interface TestClient {
  name: string;
  socket: Socket;
}

const clients: TestClient[] = [];

// Create test clients
async function createClient(name: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      auth: {
        // Can add token here for authenticated tests
      },
    });

    socket.on('connect', () => {
      console.log(`✅ [${name}] Connected: ${socket.id}`);
      resolve({ name, socket });
    });

    socket.on('connect_error', (error) => {
      console.error(`❌ [${name}] Connection error:`, error.message);
      reject(error);
    });

    socket.on('welcome', (data) => {
      console.log(`👋 [${name}] Welcome:`, data.message);
    });

    // Listen for events
    socket.on('bid:placed', (data) => {
      console.log(`💰 [${name}] Bid placed:`, {
        user: data.userName,
        amount: data.amount,
        position: data.position,
      });
    });

    socket.on('leaderboard:update', (data) => {
      console.log(`📊 [${name}] Leaderboard update:`, {
        topBidder: data.topBidders[0]?.userName || 'None',
        totalBidders: data.totalBidders,
      });
    });

    socket.on('timer:tick', (data) => {
      if (data.secondsLeft % 10 === 0 || data.secondsLeft <= 5) {
        console.log(`⏱️ [${name}] Timer: ${data.secondsLeft}s left`);
      }
    });

    socket.on('round:ending', (data) => {
      console.log(`⚠️ [${name}] Round ending in ${data.secondsLeft}s!`);
    });

    socket.on('round:extended', (data) => {
      console.log(`🔄 [${name}] Round extended! Count: ${data.extensionCount}`);
    });

    socket.on('round:ended', (data) => {
      console.log(`🏁 [${name}] Round ended! Winners:`, data.winners);
    });

    socket.on('viewers:count', (data) => {
      console.log(`👥 [${name}] Viewers: ${data.count}`);
    });

    socket.on('notification', (data) => {
      console.log(`🔔 [${name}] Notification: ${data.title} - ${data.message}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [${name}] Disconnected`);
    });

    clients.push({ name, socket });
  });
}

// Test: Join auction room
async function testJoinAuction(client: TestClient, auctionId: string): Promise<void> {
  console.log(`\n🎯 [${client.name}] Joining auction: ${auctionId}`);
  client.socket.emit('auction:join', { auctionId });
  
  return new Promise((resolve) => {
    client.socket.once('auction:update', (data) => {
      console.log(`✅ [${client.name}] Joined auction:`, data);
      resolve();
    });
    setTimeout(resolve, 1000); // Fallback timeout
  });
}

// Test: Leave auction room
async function testLeaveAuction(client: TestClient, auctionId: string): Promise<void> {
  console.log(`\n👋 [${client.name}] Leaving auction: ${auctionId}`);
  client.socket.emit('auction:leave', { auctionId });
}

// Cleanup
function cleanup(): void {
  console.log('\n🧹 Cleaning up...');
  clients.forEach(({ name, socket }) => {
    socket.disconnect();
    console.log(`[${name}] Disconnected`);
  });
}

// Main test runner
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 Socket.IO Real-Time Tests');
  console.log('='.repeat(60));

  try {
    // Create test clients
    console.log('\n📡 Creating test clients...');
    const client1 = await createClient('User1');
    const client2 = await createClient('User2');
    const client3 = await createClient('Viewer');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get test auction ID (you can replace with actual ID)
    const testAuctionId = 'test-auction-123';

    // Test joining auction
    await testJoinAuction(client1, testAuctionId);
    await testJoinAuction(client2, testAuctionId);
    await testJoinAuction(client3, testAuctionId);

    console.log('\n⏳ Waiting for events (10 seconds)...');
    console.log('You can now make API calls to place bids and see real-time updates');
    
    // Keep running to see events
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Leave auction
    await testLeaveAuction(client1, testAuctionId);
    await testLeaveAuction(client2, testAuctionId);

    // Final cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    cleanup();
    console.log('\n✅ Tests completed!');
    process.exit(0);
  }
}

// Run if executed directly
runTests();
