const express = require('express');

let cachedApp = null;
let initializationError = null;
let isInitializing = false;

async function initializeApp() {
  // If already cached, return it
  if (cachedApp) {
    return cachedApp;
  }

  // If initialization failed before, throw the error
  if (initializationError) {
    throw initializationError;
  }

  // Prevent concurrent initialization
  if (isInitializing) {
    // Wait for initialization to complete
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (cachedApp) return cachedApp;
    if (initializationError) throw initializationError;
  }

  isInitializing = true;

  try {
    console.log('[Vercel] Initializing NestJS application...');
    
    // Check if bootstrap exists
    let bootstrap;
    try {
      bootstrap = require('../dist/bootstrap');
    } catch (error) {
      throw new Error('Build files not found. Run "npm run build" first. Error: ' + error.message);
    }

    if (!bootstrap || !bootstrap.createNestApplication) {
      throw new Error('createNestApplication not found in bootstrap. Build may be incomplete.');
    }

    // Create Express app
    const expressApp = express();
    
    // Create NestJS app with Express adapter
    console.log('[Vercel] Creating NestJS application with Express adapter...');
    const { app } = await bootstrap.createNestApplication(expressApp);
    
    // Initialize the app (but don't listen, Vercel handles that)
    await app.init();
    
    console.log('[Vercel] NestJS application initialized successfully');
    
    // Cache the Express app (which now has NestJS mounted on it)
    cachedApp = expressApp;
    isInitializing = false;
    
    return cachedApp;
  } catch (error) {
    isInitializing = false;
    initializationError = error;
    console.error('[Vercel] Failed to initialize NestJS application:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  try {
    // Log incoming request for debugging
    console.log(`[Vercel] ${req.method} ${req.url}`);
    
    // Get or initialize the app
    const app = await initializeApp();
    
    // Pass the request to Express/NestJS
    app(req, res);
  } catch (error) {
    // Return error response
    console.error('[Vercel] Handler error:', error);
    
    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'Application initialization failed' 
        : error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      timestamp: new Date().toISOString()
    });
  }
};

