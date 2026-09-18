export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initServerScheduler } = await import('@/lib/serverScheduler');
    initServerScheduler();
  }
}
