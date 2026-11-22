(() => {
    function rewardRow(label, key, campaign = 0, supply = 0, campaignKey = `${key}Campaign`) {
        return {
            label,
            fields: [[campaignKey, 'Campaign Points', campaign], [`${key}Supply`, 'Supply Points', supply, 10]],
        };
    }
    const standard = {
        victor: rewardRow('Victor', 'standardWin', 2),
        draw: rewardRow('Draw', 'standardDraw', 0, 1),
        loser: rewardRow('Loser', 'standardLoss', 0, 1),
    };
    const joint = {
        victor: rewardRow('Victor', 'jointWin', 1, 0, 'jointCampaign'),
        draw: rewardRow('Draw', 'jointDraw'),
        loser: rewardRow('Loser', 'jointLoss'),
    };
    const adversary = {
        victor: rewardRow('Victor', 'adversaryWin', 3),
        draw: rewardRow('Draw', 'adversaryDraw', 0, 2),
        loser: rewardRow('Loser', 'adversaryLoss', 0, 2),
    };
    const multiplayer = {
        victor3: rewardRow('Victor · 3 players', 'multiplayerWin3', 3),
        draw3: rewardRow('Draw · 3 players', 'multiplayerDraw3', 3),
        victor4: rewardRow('Victor · 4 players', 'multiplayerWin4', 4),
        draw4: rewardRow('Draw · 4 players', 'multiplayerDraw4', 4),
        loser: rewardRow('Loser', 'multiplayerLoss', 0, 2),
    };
    const battleGroups = [
        ['Standard', Object.values(standard)],
        ['Joint Op', Object.values(joint)],
        ['Adversary Op', Object.values(adversary)],
        ['Multiplayer Op', Object.values(multiplayer)],
    ];
    const battleFields = battleGroups.flatMap(([, rows]) => rows.flatMap(row => row.fields));
    const mapGroups = [
        ['Resupply', [
            ['baseTarget', 'Own base target balance', 10, 10],
            ['ownCampMin', 'Own camp minimum', 4, 10],
            ['ownCampMax', 'Own camp maximum', 6, 10],
            ['otherCampMin', 'Other team’s camp minimum', 1, 10],
            ['otherCampMax', 'Other team’s camp maximum', 3, 10],
            ['otherHexSupply', 'Other hex Supply Points', 1, 10],
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
    const fields = [...mapGroups.flatMap(([, entries]) => entries), ...battleFields];
    const defaults = Object.fromEntries(fields.map(([key, , amount]) => [key, amount]));
    const campRanges = [['ownCampMin', 'ownCampMax'], ['otherCampMin', 'otherCampMax']];
    const validAmount = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= max;
    const validRanges = rewards => campRanges.every(([min, max]) => rewards[min] <= rewards[max]);

    function readSettings(settings) {
        const legacyMultiplier = settings?.multiplayerWinCampaignPerTeam;
        const scaledReward = size => Math.min(Number.MAX_SAFE_INTEGER, size * legacyMultiplier);
        const legacyRewards = validAmount(legacyMultiplier) ? {
            multiplayerWin3Campaign: scaledReward(3), multiplayerDraw3Campaign: scaledReward(3),
            multiplayerWin4Campaign: scaledReward(4), multiplayerDraw4Campaign: scaledReward(4),
        } : {};
        const rewards = Object.fromEntries(fields.map(([key, , fallback, max]) => [
            key, validAmount(settings?.[key], max) ? settings[key] : legacyRewards[key] ?? fallback,
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
        const normalize = value => String(value || '').trim().toLowerCase();
        const type = normalize(changeSet.battleType);
        if (type === 'compound-op') return [];
        const rewards = readSettings(settings);
        const team = value => {
            const normalized = normalize(value);
            return normalized === 'outside-player' || teams.includes(normalized) ? normalized : '';
        };
        const teamList = values => [...new Set(
            (Array.isArray(values) ? values : String(values || '').split(',')).map(team).filter(Boolean)
        )];
        const requester = team(changeSet.requesterTeam);
        const opponent = team(changeSet.battleOpponent);
        const outcome = normalize(changeSet.battleOutcome || changeSet.battleResult);
        const winner = team(outcome) || (outcome === 'won' ? requester : outcome === 'lost' ? opponent : '');
        const participants = type === 'multiplayer-op'
            ? teamList([requester, ...teamList(changeSet.battleOpponents)])
            : teamList([requester, opponent]);
        const awardsFor = (recipient, row) => {
            if (!teams.includes(recipient) || !row) return [];
            const [campaign, supply] = row.fields.map(([key]) => rewards[key]);
            return [['campaignPoints', campaign], ['supplyPoints', supply]]
                .filter(([, amount]) => amount > 0)
                .map(([field, amount]) => [recipient, field, amount]);
        };
        switch (type) {
        case 'standard':
        case 'adversary-op': {
            const rows = type === 'standard' ? standard : adversary;
            if (outcome === 'draw') return participants.flatMap(participant => awardsFor(participant, rows.draw));
            if (!winner) return [];
            return [...awardsFor(winner, rows.victor),
                ...participants.filter(participant => participant !== winner).flatMap(participant => awardsFor(participant, rows.loser))];
        }
        case 'joint-op': {
            let row;
            if (outcome === 'draw') row = joint.draw;
            else if (outcome === 'lost' || outcome === 'joint-loss') row = joint.loser;
            else if (outcome === 'joint-win' || participants.includes(winner)) row = joint.victor;
            return participants.flatMap(participant => awardsFor(participant, row));
        }
        case 'multiplayer-op': {
            const legacyWinners = teamList(changeSet.battleWinners);
            const leaders = outcome === 'draw' ? teamList(changeSet.battleTiedTeams ?? participants)
                : winner ? [winner] : legacyWinners.length ? legacyWinners : teamList(changeSet.battleWinner);
            const row = multiplayer[`${leaders.length > 1 ? 'draw' : 'victor'}${participants.length}`];
            return participants.flatMap(participant => awardsFor(participant, leaders.includes(participant) ? row : multiplayer.loser));
        }
        default:
            return [];
        }
    }

    globalThis.ExpeditionPointRewards = { battleFields, battleGroups, mapGroups, readSettings, validateSettings, battleAwards };
})();
