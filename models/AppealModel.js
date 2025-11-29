const { Schema, model } = require('mongoose');

const appealSchema = new Schema({
  caseId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  learned: {
    type: String,
    required: true
  },
  comments: {
    type: String,
    default: null
  },
  contact: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: () => new Date()
  },
  processedAt: {
    type: Date,
    default: null
  },
  processedBy: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Static methods
appealSchema.statics.submitAppeal = async function({ caseId, userId, reason, learned, comments, contact }) {
  const appeal = {
    caseId,
    userId,
    reason,
    learned,
    comments: comments || null,
    contact: contact || null,
    status: 'pending',
    submittedAt: new Date(),
    processedAt: null,
    processedBy: null
  };

  return await this.create(appeal);
};

appealSchema.statics.hasActivePendingAppeal = async function(caseId, userId) {
  const existingAppeal = await this.findOne({ 
    caseId, 
    userId, 
    status: 'pending' 
  });
  return !!existingAppeal;
};

appealSchema.statics.getAppealHistory = async function(userId) {
  return await this.find({ userId });
};

appealSchema.statics.getAppeal = async function(caseId, userId) {
  return await this.findOne({ caseId, userId });
};

appealSchema.statics.updateAppealStatus = async function(caseId, userId, status, processedBy) {
  const appeal = await this.findOne({ caseId, userId, status: 'pending' });
  if (appeal) {
    appeal.status = status;
    appeal.processedAt = new Date();
    appeal.processedBy = processedBy;
    return await appeal.save();
  }
  return null;
};

appealSchema.statics.getAllPendingAppeals = async function() {
  return await this.find({ status: 'pending' });
};

const Appeal = model('Appeal', appealSchema);

module.exports = Appeal;