// Use this hook to manipulate incoming or outgoing data.
// For more information on hooks see: http://docs.feathersjs.com/api/hooks.html

// eslint-disable-next-line no-unused-vars
module.exports = function (options = {}) {
  return async context => {

    const rules = context.app.get('rules');
    const eventRule = rules['events'][context.data.name];

    if (eventRule) {
      const eventActions = eventRule['actions'];

      // perform actions for the event. Only performs xp actions for the event.
      for (const action of eventActions) {
        let user_id;
        if (action['xp']['awardee_id']) {
          user_id = context.data.payload[action['xp']['awardee_id']];
        } else {
          user_id = context.data.user_id;
        }

        //post to xp
        const appFromContext = context.app;
        const xpService = appFromContext.service('xp');
        const uniqueCombination = await xpService.find({
          query: {
            user_id: user_id,
            name: action['xp']['name']
          }
        });

        // if the combination already exists, increment the amount
        if (uniqueCombination.length > 0) {
          await xpService.patch(uniqueCombination[0]._id, {amount: uniqueCombination[0].amount + action['xp']['amount']});
        } else {
          await xpService.create({user_id: user_id, name: action['xp']['name'], amount: action['xp']['amount']});
        }
      }
    }

    return context;
  };
};
