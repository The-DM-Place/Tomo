const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
}, {
  timestamps: true
});

userSchema.statics.ensureUser = function (userId) {
  return this.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true }
  );
};

userSchema.statics.addCase = function (userId, caseId) {
  return this.findOneAndUpdate(
    { userId },
    { 
      $setOnInsert: { userId },
      $push: { latestCase: caseId }
    },
    { new: true, upsert: true }
  );
};

userSchema.statics.getCases = function (userId, limit = 10) {
  const ModerationActionModel = require('./ModerationActionModel');
  
  return ModerationActionModel.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

module.exports = model('User', userSchema);
