const { Schema, model } = require('mongoose');

const warningsSchema = new Schema({
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
    caseId: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: () => new Date()
    }
}, {
    timestamps: true
});

// Indexes for fast lookups (only use schema.index, not index: true in fields)
warningsSchema.index({ userId: 1 });
warningsSchema.index({ caseId: 1 });

// static methods
warningsSchema.statics.getUserWarnings = async function(userId) {
    // Use .lean() for read-only queries
    return this.find({ userId }).lean();
};

warningsSchema.statics.addWarning = async function(userId, moderatorId, reason, caseId) {
    const warning = new this({
        userId,
        moderatorId,
        reason,
        caseId,
        timestamp: new Date()
    });
    return await warning.save();
};

warningsSchema.statics.getWarningByCaseId = async function(caseId) {
    // Use .lean() for read-only queries
    return this.findOne({ caseId }).lean();
};

warningsSchema.statics.removeWarning = async function(caseId) {
    // Atomic delete for unique caseId
    return this.deleteOne({ caseId });
};

const Warnings = model('Warnings', warningsSchema);

module.exports = Warnings;