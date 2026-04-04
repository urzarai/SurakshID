// controllers/auditController.js
// Handles audit log retrieval for the KYC dashboard.
// Exposes three routes:
//   GET /api/audit              — paginated list of all verifications with filters
//   GET /api/audit/:verificationId — full details of a single verification
//   GET /api/audit/stats        — aggregate statistics for the dashboard summary
//
// Filters supported on the list route:
//   page         — page number (default 1)
//   limit        — results per page (default 10, max 50)
//   riskBand     — filter by Low / Medium / High
//   documentType — filter by document type
//   status       — filter by pipeline status
//   startDate    — filter by createdAt >= startDate
//   endDate      — filter by createdAt <= endDate
//   search       — search by verificationId or customerId

const Verification = require('../models/Verification');

/**
 * getAuditLog
 * GET /api/audit
 * Returns a paginated, filterable list of all verification records.
 */
const getAuditLog = async (req, res) => {
  try {
    const {
      page        = 1,
      limit       = 10,
      riskBand,
      documentType,
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    // --- Build filter object ---
    const filter = {};

    if (riskBand)     filter.riskBand     = riskBand;
    if (documentType) filter.documentType = documentType;
    if (status)       filter.status       = status;

    // Date range filter on createdAt
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    // Search by verificationId or customerId
    if (search) {
      filter.$or = [
        { verificationId: { $regex: search, $options: 'i' } },
        { customerId:     { $regex: search, $options: 'i' } },
      ];
    }

    // --- Pagination ---
    const pageNum   = Math.max(1, parseInt(page));
    const limitNum  = Math.min(50, Math.max(1, parseInt(limit)));
    const skipNum   = (pageNum - 1) * limitNum;

    // --- Query ---
    const [records, total] = await Promise.all([
      Verification.find(filter)
        .select('-rawOcrText -__v') // exclude large fields from list view
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .lean(),
      Verification.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        records,
        pagination: {
          total,
          totalPages,
          currentPage: pageNum,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
        appliedFilters: {
          riskBand:     riskBand     || null,
          documentType: documentType || null,
          status:       status       || null,
          startDate:    startDate    || null,
          endDate:      endDate      || null,
          search:       search       || null,
        },
      },
    });
  } catch (error) {
    console.error('getAuditLog error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit log.',
      error: error.message,
    });
  }
};

/**
 * getVerificationById
 * GET /api/audit/:verificationId
 * Returns the complete verification record including rawOcrText.
 */
const getVerificationById = async (req, res) => {
  try {
    const { verificationId } = req.params;

    const verification = await Verification.findOne({ verificationId }).lean();

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: `No verification found with ID: ${verificationId}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    console.error('getVerificationById error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch verification.',
      error: error.message,
    });
  }
};

/**
 * getAuditStats
 * GET /api/audit/stats
 * Returns aggregate statistics used by the dashboard summary cards.
 */
const getAuditStats = async (req, res) => {
  try {
    const [
      totalVerifications,
      riskBandCounts,
      documentTypeCounts,
      statusCounts,
      amlHits,
      recentActivity,
    ] = await Promise.all([
      // Total count
      Verification.countDocuments(),

      // Count by risk band
      Verification.aggregate([
        { $match: { riskBand: { $ne: null } } },
        { $group: { _id: '$riskBand', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // Count by document type
      Verification.aggregate([
        { $group: { _id: '$documentType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Count by pipeline status
      Verification.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // AML watchlist hits
      Verification.countDocuments({ 'amlResult.matched': true }),

      // Last 7 days activity
      Verification.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Normalise risk band counts into a flat object
    const riskSummary = { Low: 0, Medium: 0, High: 0 };
    riskBandCounts.forEach((r) => {
      if (r._id) riskSummary[r._id] = r.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        totalVerifications,
        riskSummary,
        amlHits,
        documentTypes: documentTypeCounts.map((d) => ({
          type: d._id,
          count: d.count,
        })),
        pipelineStatuses: statusCounts.map((s) => ({
          status: s._id,
          count: s.count,
        })),
        recentActivity: recentActivity.map((a) => ({
          date: a._id,
          count: a.count,
        })),
      },
    });
  } catch (error) {
    console.error('getAuditStats error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit statistics.',
      error: error.message,
    });
  }
};

module.exports = { getAuditLog, getVerificationById, getAuditStats };