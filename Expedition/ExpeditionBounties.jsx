import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson, getAuthEventName } from '../../utils/auth';
import { expeditionTeams } from './expedition-membership.mjs';
import './point-rewards.js';

const { readSettings } = globalThis.ExpeditionPointRewards;
const teams = expeditionTeams.filter(Boolean);
const teamLabel = team => team[0].toUpperCase() + team.slice(1);
const integer = (value, min = 0, max = Infinity) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min ? Math.min(number, max) : min;
};

export function getBountyProgress(bounty) {
  const progressMax = integer(bounty.progressMax, 0, 999);
  const progress = integer(bounty.myProgress?.progress, 0, 999);
  const maxClaimants = integer(bounty.maxClaimants, 1, 99);
  const claimCount = integer(bounty.claimCount);
  return {
    progress, progressMax, maxClaimants, claimCount,
    isOpen: Boolean(bounty.isActive) && claimCount < maxClaimants,
    isClaimed: Boolean(bounty.myProgress?.isClaimed),
  };
}

const styles = {
  page: { minHeight: '100%', padding: 'clamp(16px, 4vw, 40px)', background: '#1e1e1e', color: '#fff', fontFamily: 'system-ui, sans-serif' },
  layout: { display: 'grid', gap: '18px', width: '100%', maxWidth: '900px', margin: '0 auto' },
  stack: { display: 'grid', gap: '12px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  title: { margin: 0, color: 'inherit', font: '700 1.8rem system-ui, sans-serif' },
  link: { color: '#eee', textUnderlineOffset: '4px', justifySelf: 'start' },
  heading: { margin: 0, color: 'inherit', fontSize: '1.1rem' },
  card: { display: 'grid', gap: '10px', padding: '12px', background: '#1b1b1b', border: '1px solid #555', borderRadius: '8px', overflowWrap: 'anywhere' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(145px, 100%), 1fr))', gap: '10px' },
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  label: { display: 'grid', gap: '4px', minWidth: 0 },
  input: { width: '100%', minWidth: 0, padding: '7px 9px', background: '#161616', border: '1px solid #666', borderRadius: '5px', color: '#fff', font: 'inherit', boxSizing: 'border-box' },
  button: { padding: '7px 10px', background: '#343434', color: '#fff', border: '1px solid #666', borderRadius: '5px', font: 'inherit' },
  text: { margin: 0 },
  description: { margin: 0, whiteSpace: 'pre-wrap' },
};

async function bountyRequest(path, fallback, body, signal) {
  const { response, payload } = await fetchJson(`/expedition/bounties/${path}`, {
    method: 'POST',
    ...(body && { body: JSON.stringify(body) }),
    signal,
  });
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

export function loadBounties(signal) {
  return bountyRequest('list', 'Unable to load Expedition bounties.', undefined, signal);
}

function BountyFields({ rewards, busy, onCreate }) {
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const bounty = Object.fromEntries(fields);
    bounty.allowedTeams = fields.getAll('allowedTeams');
    bounty.supplyPointsReward ||= 0;
    bounty.campaignPointsReward ||= 0;
    bounty.maxClaimants ||= 1;
    bounty.progressMax ||= 0;
    onCreate({ bounty }, () => form.reset());
  }

  return (
    <form onSubmit={submit} style={styles.card} aria-labelledby="expedition-bounty-create">
      <h2 id="expedition-bounty-create" style={styles.heading}>Create Bounty</h2>
      <label style={styles.label}>Name
        <input name="name" maxLength={120} required style={styles.input} />
      </label>
      <div style={styles.grid}>
        <label style={styles.label}>Supply Reward
          <input name="supplyPointsReward" type="number" min="0" max="10" defaultValue={rewards.bountySupply} style={styles.input} />
        </label>
        <label style={styles.label}>Campaign Reward
          <input name="campaignPointsReward" type="number" min="0" defaultValue={rewards.bountyCampaign} style={styles.input} />
        </label>
        <label style={styles.label}>Claim Slots
          <input name="maxClaimants" type="number" min="1" defaultValue="1" style={styles.input} />
        </label>
        <label style={styles.label}>Progress Max
          <input name="progressMax" type="number" min="0" defaultValue="0" style={styles.input} />
        </label>
      </div>
      <fieldset>
        <legend>Eligible Teams</legend>
        <div style={styles.row}>
          {teams.map(team => <label key={team}><input type="checkbox" name="allowedTeams" value={team} /> {teamLabel(team)}</label>)}
        </div>
        <p style={styles.text}>Leave every team unchecked to make the bounty available to all teams.</p>
      </fieldset>
      <label style={styles.label}>Description
        <textarea name="description" maxLength={2000} rows={3} style={styles.input} />
      </label>
      <div><button type="submit" style={styles.button} disabled={busy}>Create Bounty</button></div>
    </form>
  );
}

function BountyCard({ bounty, canSubmit, canReview, showProgress, busy, onToggleProgress, onRequest, onDelete }) {
  const { progress, progressMax, maxClaimants, claimCount, isOpen, isClaimed } = getBountyProgress(bounty);
  const name = bounty.name || 'Untitled Bounty';
  const eligibleTeams = Array.isArray(bounty.allowedTeams)
    ? [...new Set(bounty.allowedTeams)].filter(team => teams.includes(team))
    : [];
  const pending = bounty.myPendingRequest;
  const canAct = canSubmit && bounty.canAccess !== false && isOpen && !pending && !isClaimed;
  const needsProgress = progress < progressMax;
  const progressOpen = canAct && needsProgress && showProgress;

  function submitProgress(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    onRequest(bounty.id, {
      requestType: 'progress',
      progressAmount: fields.get('progressAmount') || 1,
      comment: fields.get('comment') || '',
    }, onToggleProgress);
  }

  return (
    <article style={styles.card}>
      <h3 style={styles.heading}>{name}</h3>
      {bounty.description && <p style={styles.description}>{bounty.description}</p>}
      <div style={styles.grid}>
        <div><strong>Supply Reward</strong><br />{integer(bounty.supplyPointsReward, 0, 10)}</div>
        <div><strong>Campaign Reward</strong><br />{integer(bounty.campaignPointsReward)}</div>
        <div><strong>Claims</strong><br />{claimCount} / {maxClaimants}</div>
        <div><strong>Eligible Teams</strong><br />{eligibleTeams.map(teamLabel).join(', ') || 'All Teams'}</div>
        <div><strong>Created By</strong><br />{bounty.createdByUsername || 'Unknown'}</div>
      </div>
      <p style={styles.text}><strong>Your Progress</strong> {progressMax ? `${progress} / ${progressMax}` : 'No progress tracker required'}</p>
      {bounty.myProgress?.claimedAt && <p style={styles.text}>Claimed on {new Date(bounty.myProgress.claimedAt).toLocaleString()}.</p>}
      {!isOpen && <p style={styles.text}>This bounty is closed.</p>}
      {pending && <p style={styles.text}>You already have a pending {String(pending.request?.requestType).toLowerCase() === 'claim' ? 'claim' : 'progress'} request for this bounty.</p>}
      {progressOpen && (
        <form onSubmit={submitProgress} style={styles.card}>
          <label style={styles.label}>Progress Increase
            <input name="progressAmount" type="number" min="1" defaultValue="1" style={styles.input} />
          </label>
          <label style={styles.label}>Progress Comment
            <textarea name="comment" maxLength={1000} rows={3} style={styles.input} />
          </label>
          <div style={styles.row}>
            <button type="submit" disabled={busy} style={styles.button}>Send Progress Request</button>
            <button type="button" disabled={busy} style={styles.button} onClick={onToggleProgress}>Cancel</button>
          </div>
        </form>
      )}
      {(canAct || canReview) && (
        <div style={styles.row}>
          {canAct && needsProgress && (
            <button type="button" disabled={busy} style={styles.button} aria-expanded={progressOpen} onClick={onToggleProgress}>
              {progressOpen ? 'Hide Progress Form' : 'Update Progress'}
            </button>
          )}
          {canAct && !needsProgress && (
            <button type="button" disabled={busy} style={styles.button} onClick={() => onRequest(bounty.id, { requestType: 'claim' })}>Send Claim Request</button>
          )}
          {canReview && <button type="button" disabled={busy} style={styles.button} onClick={() => onDelete(bounty.id, name)}>Delete Bounty</button>}
        </div>
      )}
    </article>
  );
}

function PendingRequest({ record, bountyName, busy, onReview }) {
  const request = record.request;
  const type = String(request?.requestType).toLowerCase();
  return (
    <article style={styles.card}>
      <p style={styles.text}><strong>Bounty</strong> {bountyName || `Bounty #${record.bountyId}`}</p>
      <p style={styles.text}><strong>Traveler</strong> {record.requesterUsername || 'Unknown'}</p>
      <p style={styles.text}><strong>Type</strong> {type === 'claim' ? 'Claim' : 'Progress'}</p>
      {type === 'progress' && <p style={styles.text}><strong>Progress Increase</strong> {integer(request.progressAmount)}</p>}
      <p style={styles.text}><strong>Submitted Round</strong> {integer(request?.submissionRound, 1)}</p>
      {request?.comment && <p style={styles.description}><strong>Comment</strong> {request.comment}</p>}
      <div style={styles.row}>
        <button type="button" disabled={busy} style={styles.button} onClick={() => onReview('accept', record.id)}>Accept Request</button>
        <button type="button" disabled={busy} style={styles.button} onClick={() => onReview('deny', record.id)}>Deny Request</button>
      </div>
    </article>
  );
}

export default function ExpeditionBounties() {
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    const event = getAuthEventName();
    const refresh = () => setAuthRevision(value => value + 1);
    window.addEventListener(event, refresh);
    return () => window.removeEventListener(event, refresh);
  }, []);

  return <BountyPage key={authRevision} />;
}

function BountyPage() {
  const [access, setAccess] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [feedback, setFeedback] = useState({ message: 'Loading Expedition bounties…' });
  const [rewards, setRewards] = useState(null);
  const [progressFormId, setProgressFormId] = useState(null);
  const canReview = access?.role === 'admin' || access?.role === 'owner';
  const canSubmit = access?.role === 'traveler' && teams.includes(access.team);
  const bounties = Array.isArray(data?.bounties) ? data.bounties : [];
  const pending = Array.isArray(data?.pendingRequests) ? data.pendingRequests : [];

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    fetchJson('/expedition/access', { method: 'GET', signal }).then(({ response, payload }) => {
      if (!signal.aborted && response.ok) setAccess(payload?.access);
    }).catch(() => {});
    loadBounties(signal).then(result => {
      if (!signal.aborted) {
        setData(result);
        setFeedback(null);
      }
    }).catch(error => {
      if (!signal.aborted) setFeedback({ error: true, message: error.message });
    }).finally(() => {
      if (!signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!canReview) return;
    const controller = new AbortController();
    const { signal } = controller;
    fetchJson('/expedition/map', { method: 'GET', signal })
      .then(({ response, payload }) => {
        if (!signal.aborted) setRewards(readSettings(response.ok ? payload?.pointRewards : undefined));
      })
      .catch(() => {
        if (!signal.aborted) setRewards(readSettings());
      });
    return () => controller.abort();
  }, [canReview]);

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setFeedback({ message: action ? 'Saving bounty changes…' : 'Refreshing bounties…' });
    let success;
    try {
      success = await action?.();
      try {
        setData(await loadBounties());
      } catch (error) {
        setData(null);
        throw error;
      }
      setFeedback(success ? { message: success } : null);
    } catch (error) {
      setFeedback({ error: true, message: success ? `${success} ${error.message}` : error.message });
    } finally {
      setBusy(false);
    }
  }

  function mutate(path, body, failure, success, onSaved) {
    run(async () => {
      const result = await bountyRequest(path, failure, body);
      onSaved?.();
      return result?.message || success;
    });
  }

  function submitRequest(bountyId, request, onSaved) {
    mutate('requests', { bountyId, request }, 'Unable to submit the bounty request.', 'Bounty request submitted.', onSaved);
  }

  function reviewRequest(action, requestId) {
    const accepted = action === 'accept';
    mutate(`requests/${action}`, { requestId }, `Unable to ${action} the bounty request.`,
      accepted ? 'Bounty request accepted.' : 'Bounty request denied.');
  }

  function deleteBounty(bountyId, name) {
    if (window.confirm(`Delete "${name}"? This will remove its pending requests and progress.`)) {
      mutate('delete', { bountyId }, 'Unable to delete the bounty.', 'Bounty deleted.');
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.layout}>
        <Link to="/projects/Expedition" style={styles.link}>← Back to Expedition</Link>
        <div style={styles.header}>
          <h1 style={styles.title}>Expedition Bounties</h1>
          <button type="button" style={styles.button} disabled={busy} onClick={() => run()}>Refresh Bounties</button>
        </div>
        {feedback && <p role={feedback.error ? 'alert' : 'status'} style={styles.text}>{feedback.message}</p>}
        {canReview && rewards && (
          <BountyFields rewards={rewards} busy={busy} onCreate={(body, onSaved) =>
            mutate('create', body, 'Unable to create the bounty.', 'Bounty created.', onSaved)} />
        )}
        {data && (
          <section style={styles.stack} aria-labelledby="expedition-available-bounties">
            <h2 id="expedition-available-bounties" style={styles.heading}>Available Bounties</h2>
            {bounties.length === 0 && <p style={styles.text}>No Expedition bounties have been created yet.</p>}
            {bounties.map(bounty => (
              <BountyCard key={bounty.id} bounty={bounty} busy={busy} canSubmit={canSubmit} canReview={canReview}
                showProgress={progressFormId === bounty.id} onToggleProgress={() => setProgressFormId(current => current === bounty.id ? null : bounty.id)}
                onRequest={submitRequest} onDelete={deleteBounty} />
            ))}
          </section>
        )}
        {canReview && data && (
          <section style={styles.stack} aria-labelledby="expedition-pending-bounties">
            <h2 id="expedition-pending-bounties" style={styles.heading}>Pending Bounty Requests</h2>
            {pending.length === 0 && <p style={styles.text}>No pending bounty requests.</p>}
            {pending.map(record => (
              <PendingRequest key={record.id} record={record} busy={busy} onReview={reviewRequest}
                bountyName={bounties.find(bounty => String(bounty.id) === String(record.bountyId))?.name} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
