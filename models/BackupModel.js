const { Schema, model } = require('mongoose');

const permissionSchema = new Schema({
    id: { type: String, required: true },
    type: { type: Number, required: true },
    allow: { type: String, required: true },
    deny: { type: String, required: true }
}, { _id: false });

const channelSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: Number, required: true },
    position: { type: Number, required: true },
    permissions: { type: [permissionSchema], default: [] },
    parentId: { type: String }
}, { _id: false });

const roleSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    permissions: { type: [String], default: [] },
    position: { type: Number },
    color: { type: Number }
}, { _id: false });

const backupSchema = new Schema({
    channels: { type: [channelSchema], default: [] },
    roles: { type: [roleSchema], default: [] },
    createdAt: { type: Date, default: () => new Date() }
}, {
    timestamps: true
});

// static methods

backupSchema.statics.createBackup = async function (channels, roles) {
    const count = await this.countDocuments();
    if (count >= 3) {
        const oldest = await this.findOne({}, {}, { sort: { createdAt: 1 } });
        if (oldest) {
            await this.findByIdAndDelete(oldest._id);
        }
    }
    return await this.create({ channels, roles, createdAt: new Date() });
};

backupSchema.statics.getBackups = async function () {
    return await this.find({});
};

backupSchema.statics.getBackupById = async function (backupId) {
    return await this.findById(backupId);
};

backupSchema.statics.deleteBackup = async function (backupId) {
    return await this.findByIdAndDelete(backupId);
};

const Backup = model('Backup', backupSchema);

module.exports = Backup;