const { Schema, model } = require('mongoose');

const warningsSchema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  moderatorId: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    default: 'No reason provided'
  },
  caseId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

warningsSchema.statics.getUserWarnings = function (userId) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .lean();
};

warningsSchema.statics.addWarning = function (userId, moderatorId, reason, caseId) {
  return this.create({
    userId,
    moderatorId,
    reason,
    caseId,
    timestamp: Date.now()
  });
};

warningsSchema.statics.getWarningByCaseId = function (caseId) {
  return this.findOne({ caseId }).lean();
};

warningsSchema.statics.removeWarning = function (caseId) {
  return this.deleteOne({ caseId });
};

module.exports = model('Warnings', warningsSchema);
