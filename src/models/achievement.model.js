// Achievement-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
let model;
module.exports = function (app) {
  if (model) {
    return model;
  }

  const mongooseClient = app.get('mongooseClient');
  const { Schema } = mongooseClient;
  const achievement = new Schema({
    user_id: { type: String, required: true },
    name: { type: String, required: true },
    current_amount: { type: Number, required: true },
    total_amount: { type: Number, required: true },
    resetPeriod: {type: String, enum: ['daily', 'weekly', 'monthly', null], default: null}
  }, {
    timestamps: true  // This will add createdAt and updatedAt fields
  });

  achievement.index({ user_id: 1, name: 1 }, {unique: true});

  return model = mongooseClient.model('achievement', achievement);
};
