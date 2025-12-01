const { Schema, model } = require('mongoose');

const CounterSchema = new Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

const Counter = model('Counter', CounterSchema);

const moderationActionSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['warn', 'mute', 'ban', 'kick', 'unban', 'unmute', 'role persist']
  },
  userId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true, index: true },
  reason: { type: String, default: 'No reason provided' },
  duration: { type: String, default: null },
  caseId: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: false
});

moderationActionSchema.index({ type: 1 });
moderationActionSchema.index({ timestamp: -1 });
moderationActionSchema.index({ userId: 1, timestamp: -1 });
moderationActionSchema.index({ moderatorId: 1, timestamp: -1 });

moderationActionSchema.statics.generateCaseId = async function () {
  const counter = await Counter.findOneAndUpdate(
    { name: 'caseId' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  return String(counter.seq).padStart(4, '0');
};

moderationActionSchema.statics.logAction = async function ({ type, userId, moderatorId, reason, duration }) {
  const caseId = await this.generateCaseId();

  const action = await this.create({
    type,
    userId,
    moderatorId,
    reason: reason || 'No reason provided',
    duration: duration || null,
    caseId,
    timestamp: Date.now()
  });

  const User = require('./UserModel');
  await User.addCase(userId, caseId);

  return action;
};

moderationActionSchema.statics.getUserCases = function (userId, limit = 10) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

moderationActionSchema.statics.getUserWarnings = function (userId) {
  return this.find({ userId, type: 'warn' }).lean();
};

moderationActionSchema.statics.getCase = function (caseId) {
  return this.findOne({ caseId }).lean();
};

moderationActionSchema.statics.deleteCase = function (caseId) {
  return this.deleteOne({ caseId });
};

moderationActionSchema.statics.updateCaseReason = function (caseId, newReason) {
  return this.findOneAndUpdate(
    { caseId },
    { $set: { reason: newReason } },
    { new: true }
  );
};

moderationActionSchema.statics.getStatistics = async function () {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86400000);
  const thirtyDaysAgo = new Date(now - 30 * 86400000);

  const data = await this.aggregate([
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
  ]);

  return formatStatistics(data[0]);
};

moderationActionSchema.statics.getModeratorStatistics = async function (moderatorId) {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86400000);
  const thirtyDaysAgo = new Date(now - 30 * 86400000);

  const pipeline = [
    { $match: { moderatorId } },
    {
      $group: {
        _id: "$type",
        allTime: { $sum: 1 },
        last30: { $sum: { $cond: [{ $gte: ["$timestamp", thirtyDaysAgo] }, 1, 0] } },
        last7: { $sum: { $cond: [{ $gte: ["$timestamp", sevenDaysAgo] }, 1, 0] } }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return formatModeratorStats(result);
};

  moderationActionSchema.statics.syncCounter = async function () {
  const highest = await this.findOne()
    .sort({ caseId: -1 })
    .lean();

  const highestNumber = highest ? parseInt(highest.caseId, 10) : 0;

  await Counter.findOneAndUpdate(
    { name: 'caseId' },
    { $set: { seq: highestNumber } },
    { upsert: true }
  );

  return highestNumber;
};

const DEFAULT_TYPES = ['warn', 'mute', 'ban', 'kick', 'unban', 'unmute', 'role persist'];

function formatStatistics(facetObj) {
  const stats = initStatsStructure();

  for (const entry of facetObj.allTime) {
    stats[entry._id].allTime = entry.count;
    stats.total.allTime += entry.count;
  }

  for (const entry of facetObj.last30) {
    stats[entry._id].last30 = entry.count;
    stats.total.last30 += entry.count;
  }

  for (const entry of facetObj.last7) {
    stats[entry._id].last7 = entry.count;
    stats.total.last7 += entry.count;
  }

  return stats;
}

function formatModeratorStats(results) {
  const stats = initStatsStructure();

  for (const entry of results) {
    stats[entry._id] = {
      allTime: entry.allTime,
      last30: entry.last30,
      last7: entry.last7
    };

    stats.total.allTime += entry.allTime;
    stats.total.last30 += entry.last30;
    stats.total.last7 += entry.last7;
  }

  return stats;
}

function initStatsStructure() {
  const base = { last7: 0, last30: 0, allTime: 0 };
  const obj = { total: { ...base } };
  for (const t of DEFAULT_TYPES) obj[t] = { ...base };
  return obj;
}

module.exports = model('ModerationAction', moderationActionSchema);
