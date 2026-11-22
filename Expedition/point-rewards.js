(() => {
    const groups = [
        ['Resupply', [
            ['baseTarget', 'Own base target balance', 10, 10],
            ['ownCampMin', 'Own camp minimum', 4, 10],
            ['ownCampMax', 'Own camp maximum', 6, 10],
            ['otherCampMin', 'Other team’s camp minimum', 1, 10],
            ['otherCampMax', 'Other team’s camp maximum', 3, 10],
            ['otherHexSupply', 'Other hex Supply Points', 1, 10],
        ]],
        ['Battle Rewards', [
            ['standardWinCampaign', 'Standard win Campaign Points', 2],
            ['standardLossSupply', 'Standard loss Supply Points', 1, 10],
            ['standardDrawSupply', 'Standard draw Supply Points per team', 1, 10],
            ['jointCampaign', 'Joint Op Campaign Points per team', 1],
            ['adversaryWinCampaign', 'Adversary Op win Campaign Points', 3],
            ['adversaryLossSupply', 'Adversary Op loss Supply Points', 2, 10],
            ['adversaryDrawSupply', 'Adversary Op draw Supply Points per team', 2, 10],
            ['compoundDefenderCampaign', 'Compound Op defender win Campaign Points', 2],
            ['compoundDefenderSupply', 'Compound Op defender win Supply Points', 3, 10],
            ['compoundDrawSupply', 'Compound Op draw Supply Points per team', 1, 10],
            ['multiplayerWinCampaignPerTeam', 'Multiplayer win Campaign Points per participant', 1],
            ['multiplayerLossSupply', 'Multiplayer loss Supply Points', 2, 10],
        ]],
        ['Reward Defaults', [
            ['searchSupply', 'Search Supply Points', 0, 10],
            ['searchCampaign', 'Search Campaign Points', 0],
            ['manoeuvreSupply', 'Manoeuvre Supply Points', 0, 10],
            ['manoeuvreCampaign', 'Manoeuvre Campaign Points', 0],
            ['bountySupply', 'New bounty Supply Points', 0, 10],
            ['bountyCampaign', 'New bounty Campaign Points', 0],
        ]],
    ];
    const fields = groups.flatMap(([, entries]) => entries);
    const battleFields = groups.find(([title]) => title === 'Battle Rewards')[1];
    const mapGroups = groups.filter(([title]) => title !== 'Battle Rewards');
    const defaults = Object.fromEntries(fields.map(([key, , amount]) => [key, amount]));
    const campRanges = [['ownCampMin', 'ownCampMax'], ['otherCampMin', 'otherCampMax']];
    const validAmount = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= max;
    const validRanges = rewards => campRanges.every(([min, max]) => rewards[min] <= rewards[max]);

    function readSettings(settings) {
        const rewards = Object.fromEntries(fields.map(([key, , fallback, max]) => [
            key, validAmount(settings?.[key], max) ? settings[key] : fallback,
        ]));
        for (const [min, max] of campRanges) {
            if (rewards[min] > rewards[max]) {
                rewards[min] = defaults[min];
                rewards[max] = defaults[max];
            }
        }
        return rewards;
    }

    function validateSettings(rewards) {
        return rewards && Object.keys(rewards).length === fields.length
            && fields.every(([key, , , max]) => Object.hasOwn(rewards, key) && validAmount(rewards[key], max))
            && validRanges(rewards);
    }

    function battleAwards(changeSet, settings, teams) {
        const rewards = readSettings(settings);
        const normalize = value => String(value || '').trim().toLowerCase();
        const team = value => {
            const normalized = normalize(value);
            return normalized === 'outside-player' || teams.includes(normalized) ? normalized : '';
        };
        const teamList = values => [...new Set(
            (Array.isArray(values) ? values : String(values || '').split(',')).map(team).filter(Boolean)
        )];
        const requester = team(changeSet.requesterTeam);
        const opponent = team(changeSet.battleOpponent);
        const result = normalize(changeSet.battleResult);
        const awards = [];
        const grant = (recipient, field, amount) => {
            if (teams.includes(recipient) && amount > 0) awards.push([recipient, field, amount]);
        };
        const supply = (recipient, amount) => grant(recipient, 'supplyPoints', amount);
        const campaign = (recipient, amount) => grant(recipient, 'campaignPoints', amount);
        const supplyBoth = amount => [requester, opponent].forEach(recipient => supply(recipient, amount));

        switch (normalize(changeSet.battleType)) {
        case 'standard':
            if (result === 'won') {
                campaign(requester, rewards.standardWinCampaign);
                supply(opponent, rewards.standardLossSupply);
            } else if (result === 'draw') {
                supplyBoth(rewards.standardDrawSupply);
            } else if (result === 'lost') {
                supply(requester, rewards.standardLossSupply);
            }
            break;
        case 'joint-op':
            [requester, opponent].forEach(recipient => campaign(recipient, rewards.jointCampaign));
            break;
        case 'adversary-op':
            if (result === 'draw') {
                supplyBoth(rewards.adversaryDrawSupply);
            } else if (result === 'won' || result === 'lost') {
                campaign(result === 'won' ? requester : opponent, rewards.adversaryWinCampaign);
                supply(result === 'won' ? opponent : requester, rewards.adversaryLossSupply);
            }
            break;
        case 'compound-op':
            if (result === 'draw') {
                supplyBoth(rewards.compoundDrawSupply);
            } else if (result === 'defender') {
                const defender = normalize(changeSet.battleSide) === 'defender' ? requester : opponent;
                campaign(defender, rewards.compoundDefenderCampaign);
                supply(defender, rewards.compoundDefenderSupply);
            }
            break;
        case 'multiplayer-op': {
            const participants = teamList([requester, ...teamList(changeSet.battleOpponents)]);
            const winners = teamList(changeSet.battleWinners);
            const winnerReward = Math.min(Number.MAX_SAFE_INTEGER, participants.length * rewards.multiplayerWinCampaignPerTeam);
            for (const participant of participants) {
                if (winners.includes(participant)) campaign(participant, winnerReward);
                else supply(participant, rewards.multiplayerLossSupply);
            }
            break;
        }
        }
        return awards;
    }

    globalThis.ExpeditionPointRewards = { battleFields, mapGroups, readSettings, validateSettings, battleAwards };
})();
