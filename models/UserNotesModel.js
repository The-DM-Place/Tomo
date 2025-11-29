const { Schema, model } = require('mongoose');

const userNoteSchema = new Schema({
  userId: {
    type: String,
    required: true
  },
  moderatorId: {
    type: String,
    required: true
  },
  note: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: () => new Date()
  },
  noteId: {
    type: String,
    default: () => Date.now().toString()
  }
}, {
  timestamps: true
});

// Indexes for fast lookups (only use schema.index, not index: true in fields)
userNoteSchema.index({ userId: 1 });
userNoteSchema.index({ noteId: 1 }, { unique: true });

userNoteSchema.statics.addNote = async function(userId, moderatorId, note) {
  const noteData = {
    userId,
    moderatorId,
    note,
    timestamp: new Date(),
    noteId: Date.now().toString()
  };

  return await this.create(noteData);
};

userNoteSchema.statics.getUserNotes = async function(userId) {
  // Use .lean() for read-only queries
  return await this.find({ userId }).lean();
};

userNoteSchema.statics.deleteNote = async function(noteId) {
  // Atomic delete for unique noteId
  return await this.deleteOne({ noteId: noteId });
};

userNoteSchema.statics.getAllNotes = async function() {
  // Use .lean() for read-only queries
  return await this.find().lean();
};

const UserNote = model('UserNote', userNoteSchema);

module.exports = UserNote;