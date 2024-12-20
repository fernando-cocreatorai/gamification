const moment = require('moment');
const yaml = require('js-yaml');
const fs   = require('fs');

class AchievementRule {
  constructor(rule, name) {
    this.name = name;
    const requirements = rule['requirements'] === undefined ? [] : rule['requirements'];
    this.requirements = requirements.map(requirement => Requirement.fromYamlRequirement(requirement));
    this.replaces = rule['replaces'] === undefined ? [] : rule['replaces'] ;

    let maxAwarded = rule['maxAwarded'];
    let maxAwardedTotal = rule['maxAwardedTotal'];
    if (maxAwarded === undefined && maxAwardedTotal === undefined) {
      // By default, an achievement can only be awarded once, ever.
      maxAwarded = maxAwardedTotal = 1;
    } else if (maxAwarded === undefined && maxAwardedTotal !== undefined) {
      // If only maxAwardedTotal is set, we can also safely set maxAwarded to
      // the same value.
      maxAwarded = maxAwardedTotal;
    } else if (maxAwarded !== undefined && maxAwardedTotal === undefined) {
      // In case only maxAwarded is set, we need to set maxAwardedTotal to +Infinity.
      maxAwardedTotal = Number.POSITIVE_INFINITY;
    }
    if (maxAwarded > maxAwardedTotal) {
      throw new Error(`The achievement "${this.name}" has maxAwarded > maxAwardedTotal (${this.maxAwarded} > ${this.maxAwardedTotal}).`);
    }
    this.maxAwarded = maxAwarded;
    this.maxAwardedTotal = maxAwardedTotal;

    this.scope = rule['scope'] === undefined ? ['user_id'] : rule['scope'];
    this.actions = rule['actions'] === undefined ? [] : rule['actions'];
    this.hidden = rule['hidden'] === undefined ? false : rule['hidden'];
    this.resetPeriod = rule.resetPeriod;
  }

  async isFulfilled(context, isFirstCycle) {
    for (const requirement of this.requirements) {
      if (!await requirement.isFulfilled(context, isFirstCycle)) {
        return false;
      }
    }
    return true;
  }

  async canBeAwarded(context) {
    const achievementService = context.app.service('achievements');
    const [existingAchievement] = await achievementService.find({
      query: {
        user_id: context.data.user_id,
        name: this.name
      }
    });

    if (!existingAchievement) {
      return true;
    }

    if (this.resetPeriod) {
      const lastAwardedDate = moment(existingAchievement.updatedAt);
      const now = moment();
      let shouldReset = false;

      switch (this.resetPeriod) {
        case 'daily':
          shouldReset = lastAwardedDate.isBefore(now, 'day');
          break;
        case 'weekly':
          shouldReset = lastAwardedDate.isBefore(now.startOf('isoWeek'));
          break;
        case 'monthly':
          shouldReset = lastAwardedDate.isBefore(now.startOf('month'));
          break;
      }

      if (shouldReset) {
        await achievementService.patch(existingAchievement._id, {
          current_amount: 0
        });
        return true;
      }
    }

    const currentAmount = existingAchievement.current_amount;
    const totalAmount = existingAchievement.total_amount;
    return currentAmount < this.maxAwarded && totalAmount < this.maxAwardedTotal;
  }

}

class Requirement {
  constructor(requirement) {
    this.requirement = requirement;
  }

  static fromYamlRequirement(requirement) {
    if (requirement['achievement'] !== undefined) {
      return new AchievementRequirement(requirement['achievement']);
    }
    if (requirement['xp'] !== undefined) {
      return new XPRequirement(requirement['xp']);
    }
    if (requirement['event'] !== undefined) {
      return new EventRequirement(requirement['event']);
    }
    if (requirement['AnyOf'] !== undefined) {
      return new AnyOfRequirement(requirement['AnyOf']);
    }
    throw new Error('Invalid requirement: Either achievement, xp or event needs to be set: ' + JSON.stringify(requirement));
  }

  // eslint-disable-next-line no-unused-vars
  async isFulfilled(context) {
    throw new Error('This method needs to be implemented in my subclasses.');
  }

  static isValidAmount(actualAmount, amountCondition) {
    amountCondition = Number.isInteger(amountCondition) ? `>= ${amountCondition}` : amountCondition;
    amountCondition = amountCondition.trim();
    const operator = amountCondition.split(/\s+/)[0];
    const number = parseInt(amountCondition.split(/\s+/)[1]);

    switch(operator) {
      case '==':
        return actualAmount === number;
      case '>':
        return actualAmount > number;
      case '<':
        return actualAmount < number;
      case '>=':
        return actualAmount >= number;
      case '<=':
        return actualAmount <= number;
      case '!=':
        return actualAmount !== number;
      default:
        throw new Error(`Unexpected operator : ${operator}`);
    }
  }
}

class XPRequirement extends Requirement {
  constructor(requirement) {
    requirement['amount'] = requirement['amount'] === undefined ? 1 : requirement['amount'];
    super(requirement);
  }

  async isFulfilled(context) {
    const matches = await context.app.service('xp').find({
      query: {
        user_id: context.data.user_id,
        name: this.requirement['name']
      }
    });
    if (matches.length === 0) return false;
    if (matches.length > 1) throw new Error('Found more than one match, this should be impossible');
    if (!Requirement.isValidAmount(matches[0].amount, this.requirement['amount'])) return false;

    return true;
  }
}

class AchievementRequirement extends Requirement {
  constructor(requirement) {
    requirement['amount'] = requirement['amount'] === undefined ? 1 : requirement['amount'];
    super(requirement);
  }

  async isFulfilled(context) {
    const matches = await context.app.service('achievements').find({
      query: {
        user_id: context.data.user_id,
        name: this.requirement['name']
      }
    });
    if (matches.length === 0) return false;
    if (matches.length > 1) throw new Error('Found more than one match, this should be impossible');
    if (!Requirement.isValidAmount(matches[0].current_amount, this.requirement['amount'])) return false;

    return true;
  }
}

class EventRequirement extends  Requirement {

  constructor(requirement) {
    requirement['amount'] = requirement['amount'] === undefined ? 1 : requirement['amount'];
    requirement['conditions'] = requirement['conditions'] === undefined ? [] : requirement['conditions'];
    super(requirement);
  }

  conditionFulfilled(condition, matchedEvent) {
    switch(true) {
      case condition['parameter'] !== undefined:
        return condition['value'] === matchedEvent['payload'][condition['parameter']];
      case condition['AnyOf'] !== undefined:
        return this.checkAnyOf(condition['AnyOf'], matchedEvent);
      default:
        throw new Error(`Invalid Condition params: ${JSON.stringify(condition)}`);
    }
  }

  checkAnyOf(conditions, matchedEvent) {
    return conditions.some(c => {
      return this.conditionFulfilled(c, matchedEvent);
    });
  }

  evalConditions(matchedEvent) {
    const conditions = this.requirement.conditions;

    return conditions.every(c => {
      return this.conditionFulfilled(c, matchedEvent);
    });
  }

  async isFulfilled(context, isFirstCycle) {
    // event requirements should be only checked in first achievement cycle
    if (!isFirstCycle) {
      return false;
    }
    const matches = await context.app.service('events').find({
      query: {
        user_id: context.data.user_id,
        name: this.requirement['name']
      }
    });

    const filteredMatches = matches.filter(match => {
      return this.evalConditions(match);
    });
    const matchAmount = filteredMatches.length;
    return Requirement.isValidAmount(matchAmount, this.requirement['amount']);
  }
}

class AnyOfRequirement extends Requirement {
  constructor(innerRequirements) {
    super();
    this.innerRequirements = innerRequirements.map(requirement => Requirement.fromYamlRequirement(requirement));
  }

  async isFulfilled(context, isFirstCycle) {
    for (const requirement of this.innerRequirements) {
      if(await requirement.isFulfilled(context, isFirstCycle)) return true;
    }
    return false;
  }
}

module.exports = function (config_path) {
  const rules = yaml.safeLoad(fs.readFileSync(config_path, 'utf8'));

  const achievementRules = [];

  for (const achievementName of Object.keys(rules['achievements'])) {
    const rule = new AchievementRule(rules['achievements'][achievementName], achievementName);
    achievementRules.push(rule);
  }

  rules['achievements'] = achievementRules;

  return rules;
};

module.exports.AchievementRule = AchievementRule;
