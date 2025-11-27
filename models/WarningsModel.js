const { Schema, model } = require('synz-db');

const warningsSchema = new Schema({
    userId: {
        type: 'string',
        required: true
    },
    moderatorId: {
        type: 'string',
        required: true
    },
    reason: {
        type: 'string',
        default: 'No reason provided'
    },
    caseId: {
        type: 'string',
        required: true,
    },
    timestamp: {
        type: 'date',
        default: () => new Date()
    }
}, {
    timestamps: true
});

// static shite
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

module.exports = model('Warnings', warningsSchema);