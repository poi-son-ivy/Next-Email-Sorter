import puppeteer from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Process unsubscribe job with Puppeteer
 * This runs on Render.com with full Chrome support
 */
async function processUnsubscribeJob(jobId) {
  console.log(`[Worker] Processing job ${jobId}`);

  try {
    // Get job from database
    const job = await prisma.unsubscribeJob.findUnique({
      where: { id: jobId },
      include: { email: true },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (!job.email.unsubscribeUrl) {
      throw new Error('No unsubscribe URL found');
    }

    // Mark as processing
    await prisma.unsubscribeJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        attempts: job.attempts + 1,
      },
    });

    console.log(`[Worker] Opening browser for: ${job.email.unsubscribeUrl}`);

    // Launch Puppeteer (full Chrome available on Render!)
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to unsubscribe page
    await page.goto(job.email.unsubscribeUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Take screenshot for verification
    const screenshot = await page.screenshot({
      fullPage: true,
      encoding: 'base64'
    });

    // Get page content before closing browser
    const pageContent = await page.content();

    await browser.close();

    // Simple success check (you can enhance with AI later)
    const isSuccess =
      /unsubscribed|success|confirmed|removed/i.test(pageContent);

    // Update job status
    await prisma.unsubscribeJob.update({
      where: { id: jobId },
      data: {
        status: isSuccess ? 'COMPLETED' : 'NEEDS_CONFIRMATION',
        completedAt: new Date(),
        result: JSON.stringify({
          status: isSuccess ? 'success' : 'needs_confirmation',
          method: 'puppeteer',
          message: isSuccess
            ? 'Successfully unsubscribed'
            : 'Visited page but needs manual verification',
          screenshotBase64: screenshot,
        }),
      },
    });

    // Update email status
    if (isSuccess) {
      await prisma.email.update({
        where: { id: job.emailId },
        data: { unsubscribeStatus: 'SUCCEEDED' },
      });
    }

    console.log(`[Worker] Job ${jobId} completed: ${isSuccess ? 'SUCCESS' : 'NEEDS_CONFIRMATION'}`);

    return { success: true, status: isSuccess ? 'success' : 'needs_confirmation' };
  } catch (error) {
    console.error(`[Worker] Error processing job ${jobId}:`, error);

    // Mark as failed
    await prisma.unsubscribeJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: error.message,
      },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Simple HTTP server to receive job requests from Inngest
 */
import { createServer } from 'http';

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.WORKER_API_KEY || 'change-me-in-production';

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Process job endpoint
  if (req.url === '/process' && req.method === 'POST') {
    // Check API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { jobId } = JSON.parse(body);

        if (!jobId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'jobId is required' }));
          return;
        }

        console.log(`[Worker] Received job request: ${jobId}`);

        // Process job (don't await - run in background)
        processUnsubscribeJob(jobId).catch(err => {
          console.error(`[Worker] Background processing error:`, err);
        });

        // Return immediately
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Job accepted for processing',
          jobId
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[Worker] Server running on port ${PORT}`);
  console.log(`[Worker] Health check: http://localhost:${PORT}/health`);
  console.log(`[Worker] Process endpoint: POST http://localhost:${PORT}/process`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, closing server...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
