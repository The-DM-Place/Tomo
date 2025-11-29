const { Schema, model } = require('mongoose');
const ModerationActionModel = require('./ModerationActionModel'); // Import the model for detailed case data

const userSchema = new Schema({
  userId: {
    type: String,
    required: true
  },
  cases: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: () => new Date()
  }
}, {
  timestamps: true
});

// Static methods
userSchema.statics.ensureUser = async function(userId) {
  // Use .lean() for read-only if you only need a plain object
  let user = await this.findOne({ userId: userId });
  if (!user) {
    return await this.create({ 
      userId: userId, 
      createdAt: new Date() 
    });
  }
  return user;
};

// Get all cases for a user (detailed case information with optimization)
userSchema.statics.getCases = async function(userId, limit = 10) {
  // Fetch detailed case data in a single query, sorted and limited
  const detailedCases = await ModerationActionModel.find({ userId })
    .sort({ timestamp: -1 }) // Sort by timestamp (newest first)
    .limit(limit) // Limit the number of results
    .lean(); // Use lean() for better performance with read-only data

  return detailedCases;
};

userSchema.statics.addCase = async function(userId, caseId) {
  // Atomic update: add caseId to cases array only if not present
  return await this.findOneAndUpdate(
    { userId: userId },
    { $addToSet: { cases: caseId } },
    { new: true, upsert: true }
  );
};

const User = model('User', userSchema);

module.exports = User;