const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    liveUrl: env.LIVE_URL || null,
    historyUrl: env.HISTORY_URL || null,
  });
}));

module.exports = router;
