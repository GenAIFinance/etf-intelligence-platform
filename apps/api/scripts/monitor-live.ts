import { prisma } from '../src/db';

async function monitorLive() {
  let lastCount = 0;
  let noChangeCount = 0;

  console.log('🔄 Live ETF Sync Monitor');
  console.log('Press Ctrl+C to stop\n');
  console.log('='.repeat(60));

  while (true) {
    const total = await prisma.etf.count();
    const synced = await prisma.etf.count({
      where: {
        OR: [
          { netExpenseRatio: { not: null } },
          { benchmarkIndex: { not: null } },
        ],
      },
    });

    const needsSync = total - synced;
    const progress = ((synced / total) * 100).toFixed(1);

    // Calculate change since last check
    const change = synced - lastCount;
    const changePerMin = change * (60 / 10); // Extrapolate to per minute

    // Clear screen
    console.clear();
    console.log('🔄 Live ETF Sync Monitor - Updates every 10 seconds');
    console.log('Press Ctrl+C to stop\n');
    console.log('='.repeat(60));
    console.log(`Total ETFs:        ${total}`);
    console.log(`✅ Synced:          ${synced}`);
    console.log(`❌ Remaining:       ${needsSync}`);
    console.log(`📊 Progress:        ${progress}%`);
    console.log('='.repeat(60));

    // Progress bar
    const barLength = 50;
    const filled = Math.floor((synced / total) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    console.log(`\n[${bar}] ${progress}%\n`);

    // Show activity
    if (change > 0) {
      console.log(`🟢 ACTIVE: +${change} ETFs in last 10 sec (~${changePerMin.toFixed(0)}/min)`);
      noChangeCount = 0;
    } else {
      noChangeCount++;
      if (noChangeCount > 6) { // 1 minute of no activity
        console.log(`🔴 STALLED: No progress for ${noChangeCount * 10} seconds`);
      } else {
        console.log(`🟡 Waiting: ${noChangeCount * 10} sec since last update...`);
      }
    }

    // Time estimate
    if (needsSync > 0 && changePerMin > 0) {
      const minutesLeft = Math.ceil(needsSync / changePerMin);
      const hours = Math.floor(minutesLeft / 60);
      const mins = minutesLeft % 60;
      console.log(`⏱️  Est. time left: ${hours}h ${mins}m (at ${changePerMin.toFixed(0)} ETFs/min)`);
    } else if (needsSync === 0) {
      console.log('🎉 SYNC COMPLETE!');
      break;
    }

    // Show last synced ETF
    const lastSynced = await prisma.etf.findFirst({
      where: { netExpenseRatio: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { ticker: true, name: true, updatedAt: true },
    });

    if (lastSynced) {
      const timeAgo = Math.floor((Date.now() - lastSynced.updatedAt.getTime()) / 1000);
      console.log(`\n📝 Last synced: ${lastSynced.ticker} (${timeAgo}s ago)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Last updated: ${new Date().toLocaleTimeString()}`);

    lastCount = synced;
    await new Promise(r => setTimeout(r, 10000)); // Update every 10 seconds
  }

  await prisma.$disconnect();
}

monitorLive().catch(console.error);