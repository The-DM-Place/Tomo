const { Schema, model } = require('mongoose');

const moderationActionSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['warn', 'mute', 'ban', 'kick', 'unban', 'unmute', 'role persist']
  },
  userId: {
    type: String,
    required: true
  },
  moderatorId: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    default: 'No reason provided'
  },
  duration: {
    type: String,
    default: null
  },
  caseId: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: () => new Date()
  }
}, {
  timestamps: true
});

moderationActionSchema.index({ caseId: 1 }, { unique: true });
moderationActionSchema.index({ userId: 1 });
moderationActionSchema.index({ moderatorId: 1 });
moderationActionSchema.index({ type: 1 });
moderationActionSchema.index({ timestamp: 1 });
moderationActionSchema.index({ userId: 1, timestamp: -1 }); // Ensure the index for optimized queries
moderationActionSchema.index({ moderatorId: 1, timestamp: -1 });

// Static methods
moderationActionSchema.statics.logAction = async function ({ type, userId, moderatorId, reason, duration }) {
  const caseId = await this.generateCaseId();

  const action = {
    type,
    userId,
    moderatorId,
    reason: reason || 'No reason provided',
    duration: duration || null,
    caseId,
    timestamp: new Date()
  };

  const savedAction = await this.create(action);

  const User = require('./UserModel');
  await User.addCase(userId, caseId);

  return savedAction;
};

moderationActionSchema.statics.generateCaseId = async function () {
  const result = await this.aggregate([
    {
      $addFields: {
        caseIdNum: { $toInt: "$caseId" }
      }
    },
    { $sort: { caseIdNum: -1 } },
    { $limit: 1 }
  ]);
  const highestNum = result.length > 0 ? result[0].caseIdNum : -1;
  const nextNum = highestNum + 1;
  return String(nextNum).padStart(4, '0');
};

// Optimized method to fetch user cases with sorting and pagination
moderationActionSchema.statics.getUserCases = async function (userId, limit = 10) {
  return await this.find({ userId })
    .sort({ timestamp: -1 }) // Sort by newest first
    .limit(limit) // Limit the number of results
    .lean(); // Use lean() for better performance with read-only data
};

moderationActionSchema.statics.getUserWarnings = async function (userId, guildId) {
  return await this.find({ userId, type: 'warn' }).lean();
};

moderationActionSchema.statics.getCase = async function (caseId) {
  return await this.findOne({ caseId }).lean();
};

moderationActionSchema.statics.deleteCase = async function (caseId) {
  return await this.deleteMany({ caseId });
};

moderationActionSchema.statics.updateCaseReason = async function (caseId, newReason) {
  return await this.findOneAndUpdate(
    { caseId },
    { $set: { reason: newReason } },
    { new: true }
  );
};

moderationActionSchema.statics.getStatistics = async function () {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $facet: {
        allTime: [
          { $group: { _id: "$type", count: { $sum: 1 } } }
        ],
        last30: [
          { $match: { timestamp: { $gte: thirtyDaysAgo } } },
          { $group: { _id: "$type", count: { $sum: 1 } } }
        ],
        last7: [
          { $match: { timestamp: { $gte: sevenDaysAgo } } },
          { $group: { _id: "$type", count: { $sum: 1 } } }
        ]
      }
    }
  ];
  const result = await this.aggregate(pipeline);
  const stats = {
    mute: { last7: 0, last30: 0, allTime: 0 },
    ban: { last7: 0, last30: 0, allTime: 0 },
    kick: { last7: 0, last30: 0, allTime: 0 },
    warn: { last7: 0, last30: 0, allTime: 0 },
    unban: { last7: 0, last30: 0, allTime: 0 },
    unmute: { last7: 0, last30: 0, allTime: 0 },
    total: { last7: 0, last30: 0, allTime: 0 }
  };
  if (result.length > 0) {
    for (const group of result[0].allTime) {
      stats[group._id]?.allTime !== undefined && (stats[group._id].allTime = group.count);
      stats.total.allTime += group.count;
    }
    for (const group of result[0].last30) {
      stats[group._id]?.last30 !== undefined && (stats[group._id].last30 = group.count);
      stats.total.last30 += group.count;
    }
    for (const group of result[0].last7) {
      stats[group._id]?.last7 !== undefined && (stats[group._id].last7 = group.count);
      stats.total.last7 += group.count;
    }
  }
  return stats;
};

// Optimized method to fetch moderator statistics
moderationActionSchema.statics.getModeratorStatistics = async function (moderatorId) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const pipeline = [
    { $match: { moderatorId } },
    {
      $group: {
        _id: "$type",
        allTime: { $sum: 1 },
        last30: {
          $sum: {
            $cond: [{ $gte: ["$timestamp", thirtyDaysAgo] }, 1, 0]
          }
        },
        last7: {
          $sum: {
            $cond: [{ $gte: ["$timestamp", sevenDaysAgo] }, 1, 0]
          }
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);

  const stats = {
    mute: { last7: 0, last30: 0, allTime: 0 },
    ban: { last7: 0, last30: 0, allTime: 0 },
    kick: { last7: 0, last30: 0, allTime: 0 },
    warn: { last7: 0, last30: 0, allTime: 0 },
    unban: { last7: 0, last30: 0, allTime: 0 },
    unmute: { last7: 0, last30: 0, allTime: 0 },
    total: { last7: 0, last30: 0, allTime: 0 }
  };

  result.forEach(group => {
    stats[group._id] = {
      last7: group.last7,
      last30: group.last30,
      allTime: group.allTime
    };
    stats.total.last7 += group.last7;
    stats.total.last30 += group.last30;
    stats.total.allTime += group.allTime;
  });

  return stats;
};

const ModerationAction = model('ModerationAction', moderationActionSchema);

module.exports = ModerationAction;