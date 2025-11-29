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
        required: true,
    },
    timestamp: {
        type: Date,
        default: () => new Date()
    }
}, {
    timestamps: true
});

// static methods
warningsSchema.statics.getUserWarnings = async function(userId) {
    return this.find({ userId });
};

warningsSchema.statics.addWarning = async function(userId, moderatorId, reason, caseId) {
    const warning = new this({
        userId,
        moderatorId,
        reason,
        caseId
    });
    return warning.save();
};

warningsSchema.statics.getWarningByCaseId = async function(caseId) {
    return this.findOne({ caseId });
};

warningsSchema.statics.removeWarning = async function(caseId) {
    return this.deleteMany({ caseId });
};

const Warnings = model('Warnings', warningsSchema);

module.exports = Warnings;