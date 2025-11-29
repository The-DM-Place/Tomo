const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true
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
  let user = await this.findOne({ userId: userId });
  if (!user) {
    return await this.create({ 
      userId: userId, 
      createdAt: new Date() 
    });
  }
  return user;
};

userSchema.statics.addCase = async function(userId, caseId) {
  const user = await this.ensureUser(userId);
  const cases = user.cases || [];
  if (!cases.includes(caseId)) {
    cases.push(caseId);
    user.cases = cases;
    return await user.save();
  }
  return user;
};

const User = model('User', userSchema);

module.exports = User;